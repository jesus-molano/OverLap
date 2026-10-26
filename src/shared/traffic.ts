/**
 * Traffic widget: faster cars closing on you from behind, slower cars you are closing on
 * ahead (each with the seconds until you meet and where on the lap) and hazards ahead
 * (stopped, crawling or off-track cars). Runs at 4 Hz over the RaceModel's per-car pace and
 * speed; values are quantised so SKIP_EMIT drops unchanged payloads. The only state, when each
 * car was last inside its window (so an entry does not flicker at the edge), lives in one
 * TrafficProvider per telemetry loop.
 *
 * Road gaps come from CarIdxLapDistPct: a car |dPct| laps behind needs |dPct| x its pace
 * seconds to reach where you are; a car dPct laps ahead is dPct x your pace seconds away.
 * Closing rates are pace differences in laps per second. Faster/slower is the class speed
 * (CarClassRelSpeed); a car of your own class only counts in a race when it is on another lap.
 * A car coming to lap you (your class, a lap or more ahead) and, while you are shown the blue
 * flag, any car behind that can be passing you, are listed as faster whatever "Multiclass only"
 * and the pace margin say (B08), marked as passing you. Nothing in a lone session: the other
 * cars there are not on track with you (B11). With one class in the session no line names it.
 */
import { driverIdentity, identityEqual } from './driver'
import { arrayEqual } from './equal'
import { CAUTION_FLAGS, SessionFlag } from './flags'
import { isValidPct, wrapPctDelta } from './lapDist'
import { finiteOr, frac, quantise } from './num'
import type { RaceCarState, RaceView } from './race/raceView'
import {
  currentSessionType,
  isLoneSession,
  resolveFocusCarIdx,
  resolvePlayerCarIdx
} from './sessionInfo'
import { SessionState, TrackLocation } from './telemetry'
import type { TelemetryFrame } from './telemetry'
import type {
  DriverEntry,
  HazardKind,
  SessionMeta,
  TrafficData,
  TrafficEntry,
  TrafficKind,
  TrafficOptions,
  TrafficPassing
} from './types'

export const TRAFFIC = {
  /** An entry shown last time stays this long (s of SessionTime) after it leaves its window. */
  holdS: 1,
  /**
   * Without class speeds to tell (CarClassRelSpeed unknown, or your own class outside a race),
   * a car whose pace is this fraction quicker than yours counts as faster (and vice versa).
   */
  paceMargin: 0.02,
  /** Hazard 'stopped': crawling (RaceCarState.stoppedForS) for at least this long (s). */
  stoppedS: 1,
  /** Hazard 'slow': below this fraction of its own pace... */
  slowFraction: 0.5,
  /** ...and, like 'stopped', of your current speed: nothing is a hazard while everybody crawls. */
  slowerThanYou: 0.5,
  /** Meeting further away than this (s) is not converging in any practical sense. */
  maxEtaS: 600
} as const

/**
 * +1 when `them` is faster than you, -1 when slower, 0 when neither. Class speeds decide when
 * both are known and differ (CarClassRelSpeed, bigger = faster); otherwise the paces do, with
 * TRAFFIC.paceMargin so two similar cars never count.
 */
export function speedRelation(
  me: DriverEntry,
  myPace: number,
  them: DriverEntry,
  theirPace: number | null
): -1 | 0 | 1 {
  if (
    me.classId !== them.classId &&
    me.classRelSpeed > 0 &&
    them.classRelSpeed > 0 &&
    me.classRelSpeed !== them.classRelSpeed
  ) {
    return them.classRelSpeed > me.classRelSpeed ? 1 : -1
  }
  if (theirPace === null || !(theirPace > 0)) return 0
  if (theirPace <= myPace * (1 - TRAFFIC.paceMargin)) return 1
  if (myPace <= theirPace * (1 - TRAFFIC.paceMargin)) return -1
  return 0
}

/** 1-based sector of lap fraction `pct` (sectorStarts ascending from 0), null when unknown. */
export function sectorOf(pct: number, sectorStarts: readonly number[]): number | null {
  if (sectorStarts.length === 0 || !Number.isFinite(pct)) return null
  let sector = 1
  for (let i = 1; i < sectorStarts.length; i++) {
    const start = sectorStarts[i]
    if (start === undefined || pct < start) break
    sector = i + 1
  }
  return sector
}

/** When a car was last inside its window, per group. */
interface Hold {
  lastSeen: number
  /** compute() call that last touched it: records not touched are swept. */
  stamp: number
  /** Hazards: the last kind seen, for an entry held after the car is moving again. */
  hazard: HazardKind | null
}

/** One entry before sorting and capping, with its sort key (etaS, Infinity when null). */
interface Candidate {
  entry: TrafficEntry
  eta: number
}

/** Everything one compute() shares between the cars. */
interface Run {
  frame: TelemetryFrame
  session: SessionMeta
  race: RaceView
  prev: TrafficData | null
  now: number
  me: RaceCarState
  myDriver: DriverEntry
  myPct: number
  myPace: number
  caution: boolean
  /** You are shown the blue flag: a car behind is passing, or lapping, you. */
  blue: boolean
  /** Every entry of the session is in one class: no line names it. */
  oneClass: boolean
}

/**
 * A car behind you on the road that is passing you, so it is listed as faster traffic whatever
 * "Multiclass only" and the pace margin say (B08): one of your class a lap or more ahead in a
 * race (it is coming to lap you, at whatever pace), or, under your blue flag, any car that can be
 * the reason for it: not a rival on your lap (your class in a race) nor a car you lapped.
 */
function passingYou(run: Run, d: DriverEntry, laps: number): boolean {
  const sameClass = d.classId === run.myDriver.classId
  if (run.race.racing && sameClass && laps >= 1) return true
  if (!run.blue || laps <= -1) return false
  return !(run.race.racing && sameClass && laps === 0)
}

/**
 * Whole laps between a car dPct laps from you on the road and you in race distance (+ = it is
 * ahead); 0 outside races (laps completed say nothing there) or when unknown.
 */
function lapsApart(run: Run, car: RaceCarState, dPct: number): number {
  if (!run.race.racing) return 0
  const diff = car.distance - run.me.distance
  // Race distance minus road distance: a whole number of laps.
  return Number.isFinite(diff) ? Math.round(diff - dPct) : 0
}

/**
 * +1 faster traffic, -1 slower, 0 neither. In a race a car of your own class is traffic only on
 * another lap and at a clearly different pace (lapping you, or being lapped); on your lap it is
 * a rival (the battle widget's), and a lapped car at your pace is never reached.
 */
function relation(run: Run, d: DriverEntry, pace: number, laps: number): -1 | 0 | 1 {
  const rel = speedRelation(run.myDriver, run.myPace, d, pace)
  if (!run.race.racing || d.classId !== run.myDriver.classId) return rel
  return (rel > 0 && laps >= 1) || (rel < 0 && laps <= -1) ? rel : 0
}

function candidate(
  run: Run,
  d: DriverEntry,
  kind: TrafficKind,
  gapS: number,
  etaS: number | null,
  lap: boolean,
  hazard: HazardKind | null,
  passing: TrafficPassing | null = null
): Candidate {
  const eta = etaS !== null && Number.isFinite(etaS) && etaS <= TRAFFIC.maxEtaS ? etaS : null
  let meetPct: number | null = null
  let meetSector: number | null = null
  if (eta !== null) {
    // Where you are after `eta` at your pace.
    const at = frac(run.myPct + eta / run.myPace)
    const q = quantise(at, 100)
    meetPct = q >= 1 ? 0 : q
    meetSector = sectorOf(at, run.session.sectorStarts)
  }
  const qEta = eta === null ? null : quantise(eta, 10)
  return {
    entry: {
      driver: driverIdentity(d),
      kind,
      className: run.oneClass ? '' : d.classShortName,
      gapS: quantise(gapS, 10),
      etaS: qEta,
      meetPct,
      meetSector,
      lapping: lap,
      passing,
      hazard
    },
    eta: qEta ?? Infinity
  }
}

/** Closest first: by etaS (not converging last), then |gapS|, then CarIdx (a stable order). */
function byClosest(a: Candidate, b: Candidate): number {
  return (
    (a.eta === b.eta ? 0 : a.eta < b.eta ? -1 : 1) ||
    Math.abs(a.entry.gapS) - Math.abs(b.entry.gapS) ||
    a.entry.driver.carIdx - b.entry.driver.carIdx
  )
}

function closest(candidates: Candidate[], max: number): TrafficEntry[] {
  candidates.sort(byClosest)
  const n = Math.min(candidates.length, max)
  const out = new Array<TrafficEntry>(n)
  for (let i = 0; i < n; i++) out[i] = (candidates[i] as Candidate).entry
  return out
}

function listed(list: readonly TrafficEntry[] | undefined, carIdx: number): boolean {
  if (!list) return false
  for (const e of list) if (e.driver.carIdx === carIdx) return true
  return false
}

/**
 * What makes a car ahead a hazard right now, null when nothing. Crawling only counts when it
 * is also much slower than you: at a standing start or behind the pace car everybody crawls.
 */
function hazardKind(run: Run, car: RaceCarState): HazardKind | null {
  if (car.offTrack) return 'off-track'
  if (!(car.speed < TRAFFIC.slowerThanYou * run.me.speed)) return null
  if (car.stoppedForS >= TRAFFIC.stoppedS) return 'stopped'
  // Under a full-course caution the whole field is slow; braking for the pit entry is expected.
  if (run.caution) return null
  if (run.frame.CarIdxTrackSurface[car.carIdx] === TrackLocation.ApproachingPits) return null
  const pace = car.pace !== null && car.pace > 0 ? car.pace : run.myPace
  return car.speed < TRAFFIC.slowFraction / pace ? 'slow' : null
}

/**
 * One per telemetry loop. compute() runs at the widget rate with the last payload as `prev`
 * (null after a reconnect, a new session or a rule hiding the widget); reset() on a reconnect
 * or a new session.
 */
export class TrafficProvider {
  private readonly holds: Record<TrafficKind, Map<number, Hold>> = {
    faster: new Map(),
    slower: new Map(),
    hazard: new Map()
  }
  private stamp = 0
  private lastT = Number.NaN

  reset(): void {
    this.clearHolds()
    this.lastT = Number.NaN
  }

  compute(
    frame: TelemetryFrame,
    session: SessionMeta,
    race: RaceView,
    opts: TrafficOptions,
    prev: TrafficData | null = null
  ): TrafficData {
    const now = finiteOr(frame.SessionTime[0], Number.NaN)
    // The clock went back (a replay, a new session before the reset): the holds are stale.
    if (!(now >= this.lastT)) this.clearHolds()
    this.lastT = now
    this.stamp++

    const run = begin(frame, session, race, prev, now)
    if (!run || (!opts.showFaster && !opts.showSlower && !opts.showHazards)) {
      this.clearHolds()
      return { visible: false, faster: [], slower: [], hazards: [] }
    }
    const behindS = finiteOr(opts.behindS, 0)
    const aheadS = finiteOr(opts.aheadS, 0)
    const hazardS = finiteOr(opts.hazardS, 0)
    const classes =
      (opts.showFaster || opts.showSlower) && (!opts.onlyMulticlass || multiclass(run))
    const wantFaster = opts.showFaster && classes
    const wantSlower = opts.showSlower && classes

    const faster: Candidate[] = []
    const slower: Candidate[] = []
    const hazards: Candidate[] = []
    const myIdx = run.me.carIdx
    for (const car of race.cars()) {
      if (car.carIdx === myIdx || !car.inWorld || car.inPits || car.finished) continue
      const pct = frame.CarIdxLapDistPct[car.carIdx]
      const d = session.drivers.get(car.carIdx)
      if (!isValidPct(pct) || !d) continue
      const dPct = wrapPctDelta(pct, run.myPct)
      const pace = car.pace !== null && car.pace > 0 ? car.pace : null

      if (dPct > 0) {
        const kind = hazardKind(run, car)
        const gap = dPct * run.myPace
        if (
          opts.showHazards &&
          this.keep('hazard', car.carIdx, kind !== null && gap <= hazardS, run, kind)
        ) {
          const shown = kind ?? this.holds.hazard.get(car.carIdx)?.hazard ?? null
          if (shown !== null) {
            // Time to reach it at your pace is the gap itself; you meet where it is.
            hazards.push(candidate(run, d, 'hazard', gap, gap, false, shown))
            // A hazard is not listed as slower traffic as well.
            continue
          }
        }
        if (!wantSlower || pace === null) continue
        const laps = lapsApart(run, car, dPct)
        if (relation(run, d, pace, laps) >= 0) continue
        if (!this.keep('slower', car.carIdx, gap <= aheadS, run, null)) continue
        // A crawling car is reached at its actual speed, not at its pace.
        const theirRate = kind === 'stopped' || kind === 'slow' ? car.speed : 1 / pace
        const closing = 1 / run.myPace - theirRate
        const eta = closing > 0 && !run.caution ? dPct / closing : null
        slower.push(candidate(run, d, 'slower', gap, eta, laps <= -1, null))
      } else {
        if (!opts.showFaster) continue
        const laps = lapsApart(run, car, dPct)
        const passing = passingYou(run, d, laps)
        if (!passing && (!wantFaster || pace === null || relation(run, d, pace, laps) <= 0)) {
          continue
        }
        // Without a pace of its own (no clean lap yet) it reaches you at about yours.
        const theirPace = pace ?? run.myPace
        const gap = -dPct * theirPace
        if (!this.keep('faster', car.carIdx, gap <= behindS, run, null)) continue
        const closing = 1 / theirPace - 1 / run.myPace
        const eta = closing > 0 && !run.caution ? -dPct / closing : null
        const why: TrafficPassing | null = !passing ? null : run.blue ? 'blue' : 'lap'
        faster.push(candidate(run, d, 'faster', -gap, eta, laps >= 1, null, why))
      }
    }
    this.sweep()

    const max = Math.max(1, Math.round(finiteOr(opts.maxEntries, 1)))
    const result: TrafficData = {
      visible: false,
      faster: closest(faster, max),
      slower: closest(slower, max),
      hazards: closest(hazards, max)
    }
    result.visible =
      result.faster.length > 0 || result.slower.length > 0 || result.hazards.length > 0
    return result
  }

  /**
   * Whether a car that fits a group (right side, right class) is listed: inside the group's
   * window, or shown last time and out of it for less than TRAFFIC.holdS.
   */
  private keep(
    kind: TrafficKind,
    carIdx: number,
    inWindow: boolean,
    run: Run,
    hazard: HazardKind | null
  ): boolean {
    const map = this.holds[kind]
    let h = map.get(carIdx)
    if (inWindow) {
      if (h) {
        h.lastSeen = run.now
        h.hazard = hazard
      } else {
        h = { lastSeen: run.now, stamp: 0, hazard }
        map.set(carIdx, h)
      }
      h.stamp = this.stamp
      return true
    }
    if (!h || !(run.now - h.lastSeen < TRAFFIC.holdS)) return false
    const prev = run.prev
    const shown =
      kind === 'faster' ? prev?.faster : kind === 'slower' ? prev?.slower : prev?.hazards
    if (!listed(shown, carIdx)) return false
    h.stamp = this.stamp
    return true
  }

  /** Forgets the cars that left their group (or the world) this tick. */
  private sweep(): void {
    for (const map of [this.holds.faster, this.holds.slower, this.holds.hazard]) {
      for (const [idx, h] of map) if (h.stamp !== this.stamp) map.delete(idx)
    }
  }

  private clearHolds(): void {
    this.holds.faster.clear()
    this.holds.slower.clear()
    this.holds.hazard.clear()
  }
}

/** The player's state for this tick, null when there is nothing to compute. */
function begin(
  frame: TelemetryFrame,
  session: SessionMeta,
  race: RaceView,
  prev: TrafficData | null,
  now: number
): Run | null {
  // Gridding, pace laps and the cool-down: nobody races, every closing rate would be wrong.
  const state = frame.SessionState[0]
  if (state !== SessionState.Racing && state !== SessionState.Checkered) return null
  // Alone on track: the other cars run their own laps, not with you.
  if (isLoneSession(currentSessionType(frame, session))) return null
  // You, or the car on camera at a replay's live point.
  const idx = resolveFocusCarIdx(frame, session)
  const me = idx >= 0 ? race.car(idx) : undefined
  const myDriver = session.drivers.get(idx)
  const myPct = frame.CarIdxLapDistPct[idx]
  // On pit road your speed is not your pace, so the ETAs would be wrong; after your flag, done.
  if (!me || !myDriver || !me.inWorld || me.inPits || me.finished || !isValidPct(myPct)) {
    return null
  }
  const myPace = me.pace
  if (myPace === null || !(myPace > 0)) return null
  const caution = ((frame.SessionFlags[0] ?? 0) & CAUTION_FLAGS) !== 0
  // Your flags; another car's own (on camera) when you are not the one followed.
  const flags =
    idx === resolvePlayerCarIdx(frame, session)
      ? frame.SessionFlags[0]
      : frame.CarIdxSessionFlags[idx]
  const blue = (((flags ?? 0) >>> 0) & SessionFlag.Blue) !== 0
  const oneClass = singleClass(session)
  return { frame, session, race, prev, now, me, myDriver, myPct, myPace, caution, blue, oneClass }
}

/** Every entry of the session (not the pace car nor a spectator) is in the same class. */
function singleClass(session: SessionMeta): boolean {
  let cls: number | null = null
  for (const [idx, d] of session.drivers) {
    if (d.isPaceCar || d.isSpectator || idx === session.paceCarIdx) continue
    if (cls === null) cls = d.classId
    else if (d.classId !== cls) return false
  }
  return true
}

/** More than one class among the cars in the world, you included. */
function multiclass(run: Run): boolean {
  const mine = run.myDriver.classId
  for (const car of run.race.cars()) {
    if (!car.inWorld || car.inPits) continue
    const d = run.session.drivers.get(car.carIdx)
    if (d && d.classId !== mine) return true
  }
  return false
}

function entryEqual(a: TrafficEntry, b: TrafficEntry): boolean {
  return (
    a.kind === b.kind &&
    a.gapS === b.gapS &&
    a.etaS === b.etaS &&
    a.meetPct === b.meetPct &&
    a.meetSector === b.meetSector &&
    a.lapping === b.lapping &&
    a.passing === b.passing &&
    a.hazard === b.hazard &&
    a.className === b.className &&
    identityEqual(a.driver, b.driver)
  )
}

/** Structural equality of two payloads (for SKIP_EMIT). */
export function trafficEqual(a: TrafficData, b: TrafficData): boolean {
  return (
    a.visible === b.visible &&
    arrayEqual(a.faster, b.faster, entryEqual) &&
    arrayEqual(a.slower, b.slower, entryEqual) &&
    arrayEqual(a.hazards, b.hazards, entryEqual)
  )
}
