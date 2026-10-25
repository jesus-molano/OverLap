/**
 * Delta widget (v2.2): seconds up or down on a reference lap at your point of the lap, how that
 * is changing, the predicted lap and the sectors of the lap in progress. Runs at 30 Hz.
 *
 * References: 'pb' your all-time best with this car on this layout (PersonalBestStore, on disk),
 * 'session' your best clean lap of the session and 'class' the fastest clean lap of your class by
 * anyone (RaceView.lapProfile); 'optimal' your best time in each sector this session and
 * 'classOptimal' the best in each sector by anyone in your class, joined into a lap (clean laps,
 * OptimalLaps in optimal.ts). With `fallback` the chain DELTA_FALLBACK of the chosen one is
 * walked. A reference is only switched at the start of a lap (its first DELTA.switchS, before
 * the first sector line), when there is none or when the options change: a faster lap or a best
 * sector set mid-lap never makes the delta jump, and the sectors of one lap compare with one
 * reference. Its profile is copied, so the store and the model may replace theirs at will.
 *
 * Delta = seconds into the lap (RaceView.currentLap) - the reference's time at the same lap
 * fraction (linear between timing lines). In the first DELTA.guardPct of a lap, where the lap
 * counter and CarIdxLapDistPct may disagree, the lap just finished shows instead: its actual
 * delta, lap time and every sector (also after the chequered flag); without one, the last delta
 * holds. Sector crossings of the lap in progress are interpolated between computes.
 *
 * Per compute the work is O(sectors) plus one payload; references are looked up again at most
 * every DELTA.refreshS (every DELTA.searchS while there is none or the lap is starting), and
 * only then are the laps completed since taken into the optimal laps.
 */
import { arrayEqual } from '../equal'
import { CAUTION_FLAGS } from '../flags'
import { formatDriverName } from '../format'
import { isValidPct } from '../lapDist'
import { finiteOr, quantise } from '../num'
import { RACE_TIMING_LINES } from '../race/raceView'
import type { RaceView } from '../race/raceView'
import { resolvePlayerCarIdx } from '../sessionInfo'
import { SessionState } from '../telemetry'
import type { TelemetryFrame } from '../telemetry'
import type { DeltaData, DeltaOptions, DeltaReference, SessionMeta } from '../types'
import { OptimalLaps } from './optimal'
import { personalBestKey, usableLap } from './references'
import type { PersonalBestStore } from './references'

const LINES = RACE_TIMING_LINES

export const DELTA = {
  /** Lap fraction after the S/F line where the lap just finished shows (or the delta holds). */
  guardPct: 0.02,
  /** EMA time constant of the trend (s). */
  trendTauS: 0.5,
  /** Computes further apart than this (s) are not continuous: nothing is interpolated across. */
  maxGapS: 1,
  /** A forward step of the pct above this in one compute is a jump (tow, reset). */
  maxStepPct: 0.1,
  /** A delta below -this x the reference lap is impossible: a glitch, the last value holds. */
  maxGainFraction: 0.5,
  /**
   * A new reference may still be taken this long (s) into a lap, before its first sector line:
   * the loop offers a new personal best ~5.5 s after the line (once its official time is in).
   */
  switchS: 8,
  /** References are looked up again this often (s) while one is in use... */
  refreshS: 1,
  /** ...and this often while there is none or the lap is starting. */
  searchS: 0.25
} as const

/**
 * The chain each reference walks with DeltaOptions.fallback, the chosen one first. Your optimal
 * exists exactly when your session best does (a clean lap of yours), so it skips it: your record,
 * then the optimal of your class. Until someone in your class has a clean lap, your record is
 * the only lap a class optimal can fall back to. The class best has no fallback.
 */
export const DELTA_FALLBACK: Readonly<Record<DeltaReference, readonly DeltaReference[]>> = {
  pb: ['pb', 'session', 'class'],
  session: ['session', 'class'],
  optimal: ['optimal', 'pb', 'classOptimal'],
  class: ['class'],
  classOptimal: ['classOptimal', 'pb']
}

const isReference = (v: unknown): v is DeltaReference =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(DELTA_FALLBACK, v)

/**
 * Seconds into the lap of `profile` (RACE_TIMING_LINES + 1 cumulative times) at lap fraction
 * `pct` (clamped to 0..1), linear between timing lines.
 */
export function profileAt(profile: ArrayLike<number>, pct: number): number {
  const x = (pct >= 1 ? 1 : pct > 0 ? pct : 0) * LINES
  const i = Math.min(LINES - 1, Math.floor(x))
  const a = profile[i] ?? Number.NaN
  const b = profile[i + 1] ?? Number.NaN
  return a + (b - a) * (x - i)
}

/** SectorStartPct values snapped to timing lines, as the RaceModel does; [] unless they start at 0. */
export function sectorLines(starts: readonly number[]): number[] {
  if (starts.length === 0 || starts[0] !== 0) return []
  const out: number[] = []
  let prev = 0
  for (const s of starts) {
    const line = Math.min(LINES - 1, Math.max(prev, Math.round(s * LINES)))
    out.push(line)
    prev = line
  }
  return out
}

type CurrentLap = NonNullable<ReturnType<RaceView['currentLap']>>

interface Candidate {
  kind: DeltaReference
  /** Car of the lap; -1 for a personal best (not a lap of this session) or a class optimal. */
  carIdx: number
  /** Its lap number this session; -1 for a personal best; OptimalLap.id for an optimal lap. */
  lap: number
  lapTime: number
  profile: readonly number[]
}

/** What the lap just finished looked like: shown in the first DELTA.guardPct of the next one. */
interface LapSummary {
  lap: number
  data: DeltaData
}

function hiddenPayload(reference: DeltaReference): DeltaData {
  return {
    visible: false,
    reference,
    refDriver: '',
    refSelf: false,
    refLapTime: null,
    delta: null,
    trend: 0,
    predictedLap: null,
    sectors: [],
    lapValid: true
  }
}

/**
 * One per telemetry loop. compute() runs at the widget rate; reset() on a reconnect or a new
 * session (a changed RaceView.sessionKey or SessionTime going back also start it over).
 */
export class DeltaProvider {
  private sessionKey: string | null = null
  private lastT = Number.NaN
  private player = -1
  private optRef: DeltaReference | null = null
  private optFallback = false

  /** personalBestKey() of keySession/keyPlayer (rebuilt only when either changes). */
  private keySession: SessionMeta | null = null
  private keyPlayer = -1
  private pbKey: string | null = null

  /** SessionMeta.sectorStarts last seen (compared by value: the YAML is re-parsed often). */
  private starts: readonly number[] = []
  /** Start line of each sector. */
  private bounds: number[] = []
  /** Seconds into the lap in progress at each sector start line; NaN = not seen. */
  private cross = new Float64Array(0)

  // The reference in use (a copy).
  private ref: DeltaReference | null = null
  private refCar = -1
  private refLap = -1
  private refTime = Number.NaN
  /** DeltaData.refDriver / refSelf of the reference in use. */
  private refDriver = ''
  private refSelf = false
  private readonly refProfile = new Float64Array(LINES + 1)
  private refreshT = Number.NaN
  /** Every car's best sectors this session (the optimal references). */
  private readonly optimal = new OptimalLaps()
  /** Last scan of the laps while you are not driving (no reference lookups then). */
  private scanT = Number.NaN

  // The lap in progress.
  private lap = Number.NaN
  private lapStartT = Number.NaN
  private prevPct = Number.NaN
  private prevElapsed = Number.NaN
  private prevT = Number.NaN
  private lapInvalid = false
  private summary: LapSummary | null = null

  // Output.
  private shownDelta: number | null = null
  private trendEma = 0
  private trendT = Number.NaN
  private trendRaw = Number.NaN

  reset(): void {
    this.sessionKey = null
    this.lastT = Number.NaN
    this.player = -1
    this.optRef = null
    this.optFallback = false
    this.keySession = null
    this.keyPlayer = -1
    this.pbKey = null
    this.starts = []
    this.bounds = []
    this.cross = new Float64Array(0)
    this.refreshT = Number.NaN
    this.optimal.reset()
    this.scanT = Number.NaN
    this.dropReference()
    this.endLap()
    this.summary = null
  }

  compute(
    frame: TelemetryFrame,
    session: SessionMeta,
    race: RaceView,
    bests: PersonalBestStore,
    opts: DeltaOptions
  ): DeltaData {
    const reference: DeltaReference = isReference(opts.reference) ? opts.reference : 'pb'
    const now = finiteOr(frame.SessionTime[0], Number.NaN)
    if (race.sessionKey !== this.sessionKey || !(now >= this.lastT)) {
      this.reset()
      this.sessionKey = race.sessionKey
    }
    this.lastT = now

    const player = resolvePlayerCarIdx(frame, session)
    if (player !== this.player) {
      this.dropReference()
      this.endLap()
      this.summary = null
      this.player = player
    }
    this.syncSectors(session.sectorStarts)
    // Not driving (garage, replay, a teammate's stint): nothing to compare.
    if (frame.IsOnTrack[0] !== true || player < 0 || !Number.isFinite(now)) {
      this.dropReference()
      this.endLap()
      this.summary = null
      // The laps of the others still count for the class optimal.
      if (Number.isFinite(now) && !(now - this.scanT < DELTA.refreshS)) {
        this.scanT = now
        this.optimal.scan(race, session)
      }
      return hiddenPayload(reference)
    }

    const rawPct = frame.CarIdxLapDistPct[player]
    const pct = isValidPct(rawPct) ? rawPct : Number.NaN
    const cur = Number.isNaN(pct) ? null : race.currentLap(player)
    const lapChanged = this.followLap(frame, race, player, cur, pct, now)
    // No lap in progress, or one just starting (before its first sector): a reference may change.
    const starting =
      cur === null ||
      pct < DELTA.guardPct ||
      (cur.elapsedS < DELTA.switchS && Number.isNaN(this.cross[1] ?? Number.NaN))
    this.updateReference(
      session,
      race,
      bests,
      reference,
      opts.fallback,
      player,
      now,
      lapChanged,
      starting
    )
    if (this.ref === null) return hiddenPayload(reference)
    return this.payload(race, player, cur, pct, now)
  }

  // ---------------------------------------------------------------------------
  // The lap in progress
  // ---------------------------------------------------------------------------

  /** Follows the lap in progress; true when a new one started (or was first seen). */
  private followLap(
    frame: TelemetryFrame,
    race: RaceView,
    player: number,
    cur: CurrentLap | null,
    pct: number,
    now: number
  ): boolean {
    if (cur === null || !Number.isFinite(cur.elapsedS)) {
      // The lap we followed just ended without a new one (the chequered flag, a tow).
      if (Number.isFinite(this.lap)) this.summarise(race, player, null, pct, now)
      this.endLap()
      return false
    }
    let changed = false
    if (cur.lap !== this.lap) {
      if (Number.isFinite(this.lap)) this.summarise(race, player, cur, pct, now)
      else this.summary = null
      this.startLap(cur.lap, now - cur.elapsedS)
      changed = true
    }
    this.detectCrossings(pct, cur.elapsedS, now)

    const me = race.car(player)
    const state = frame.SessionState[0] ?? SessionState.Invalid
    if (
      (me !== undefined && (me.inPits || me.offTrack || me.stoppedForS > 0 || me.outLap)) ||
      ((frame.SessionFlags[0] ?? 0) & CAUTION_FLAGS) !== 0 ||
      // Warm-up and parade laps before the green are never timed.
      (state > SessionState.Invalid && state < SessionState.Racing)
    ) {
      this.lapInvalid = true
    }
    return changed
  }

  private startLap(lap: number, startT: number): void {
    this.lap = lap
    this.lapStartT = startT
    // The lap starts at the line: crossings right after it interpolate from there.
    this.prevPct = 0
    this.prevElapsed = 0
    this.prevT = startT
    this.lapInvalid = false
    this.cross.fill(Number.NaN)
    if (this.cross.length > 0) this.cross[0] = 0
    this.resetTrend()
  }

  private endLap(): void {
    this.lap = Number.NaN
    this.lapStartT = Number.NaN
    this.prevPct = Number.NaN
    this.prevElapsed = Number.NaN
    this.prevT = Number.NaN
    this.lapInvalid = false
    this.cross.fill(Number.NaN)
    this.resetTrend()
  }

  /** Sector start lines crossed since the last compute get their time, interpolated. */
  private detectCrossings(pct: number, elapsed: number, now: number): void {
    const p0 = this.prevPct
    const e0 = this.prevElapsed
    const dp = pct - p0
    const dt = now - this.prevT
    if (dp > 0 && dp <= DELTA.maxStepPct && dt > 0 && dt <= DELTA.maxGapS && elapsed >= e0) {
      const bounds = this.bounds
      for (let j = 1; j < bounds.length; j++) {
        if (!Number.isNaN(this.cross[j] ?? 0)) continue
        const at = (bounds[j] ?? 0) / LINES
        if (p0 < at && pct >= at) this.cross[j] = e0 + ((elapsed - e0) * (at - p0)) / dp
      }
    }
    this.prevPct = pct
    this.prevElapsed = elapsed
    this.prevT = now
  }

  /**
   * The lap we followed ended: when the model closed it (its last lap) or a new one started
   * right after it, keeps what it looked like against the reference it was driven against.
   */
  private summarise(
    race: RaceView,
    player: number,
    cur: CurrentLap | null,
    pct: number,
    now: number
  ): void {
    this.summary = null
    if (this.ref === null || !(now - this.prevT <= DELTA.maxGapS) || !(this.prevPct >= 0.5)) {
      return
    }
    // Crossed the line from the second half of the lap, without a jump.
    if (!(pct < DELTA.guardPct)) return
    const last = race.lapProfile(player, 'last')
    let lapTime = Number.NaN
    if (last !== null && last.lap === this.lap) lapTime = last.lapTime
    else if (cur !== null && cur.lap === this.lap + 1) lapTime = now - cur.elapsedS - this.lapStartT
    if (!(lapTime > 0) || !Number.isFinite(lapTime)) return
    const n = this.bounds.length
    const sectors = new Array<number | null>(n)
    for (let k = 0; k < n; k++) {
      const end = k + 1 < n ? (this.cross[k + 1] ?? Number.NaN) : lapTime
      sectors[k] = this.sectorDelta(k, this.cross[k] ?? Number.NaN, end)
    }
    this.summary = {
      lap: this.lap,
      data: {
        visible: true,
        reference: this.ref,
        refDriver: this.refDriver,
        refSelf: this.refSelf,
        refLapTime: this.refTime,
        delta: quantise(lapTime - this.refTime, 100),
        trend: 0,
        predictedLap: quantise(lapTime, 1000),
        sectors,
        lapValid: !this.lapInvalid
      }
    }
  }

  /** Sector k driven from `start` to `end` (s into the lap) versus the reference; null when unknown. */
  private sectorDelta(k: number, start: number, end: number): number | null {
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null
    const a = this.bounds[k] ?? 0
    const b = this.bounds[k + 1] ?? LINES
    const ref = (this.refProfile[b] ?? Number.NaN) - (this.refProfile[a] ?? Number.NaN)
    return quantise(end - start - ref, 100)
  }

  private syncSectors(starts: readonly number[]): void {
    if (starts === this.starts) return
    let same = starts.length === this.starts.length
    for (let i = 0; same && i < starts.length; i++) same = starts[i] === this.starts[i]
    this.starts = starts
    if (same) return
    this.bounds = sectorLines(starts)
    this.cross = new Float64Array(this.bounds.length).fill(Number.NaN)
    if (this.cross.length > 0 && Number.isFinite(this.lap)) this.cross[0] = 0
    this.summary = null
    // Best times between other lines mean nothing now: the optimal laps start over.
    this.optimal.setSectors(this.bounds)
  }

  // ---------------------------------------------------------------------------
  // References
  // ---------------------------------------------------------------------------

  private updateReference(
    session: SessionMeta,
    race: RaceView,
    bests: PersonalBestStore,
    reference: DeltaReference,
    fallback: boolean,
    player: number,
    now: number,
    lapChanged: boolean,
    starting: boolean
  ): void {
    const optsChanged = reference !== this.optRef || fallback !== this.optFallback
    this.optRef = reference
    this.optFallback = fallback
    const every = this.ref === null || starting ? DELTA.searchS : DELTA.refreshS
    if (!optsChanged && !lapChanged && now - this.refreshT < every) return
    this.refreshT = now
    // Whatever the reference: an optimal one chosen later has the laps before it.
    this.optimal.scan(race, session)

    const chain = DELTA_FALLBACK[reference]
    const end = fallback ? chain.length : 1
    let cand: Candidate | null = null
    for (let i = 0; i < end && cand === null; i++) {
      cand = this.candidate(chain[i] ?? 'pb', session, race, bests, player)
    }
    const canSwitch = this.ref === null || optsChanged || lapChanged || starting
    if (cand === null) {
      if (canSwitch) this.dropReference()
      return
    }
    const sameLap =
      cand.kind === this.ref &&
      cand.carIdx === this.refCar &&
      cand.lap === this.refLap &&
      // A personal best is identified by its time: a new one is another lap.
      (cand.kind !== 'pb' || cand.lapTime === this.refTime)
    if (sameLap) {
      // The same lap with its official time (CarIdxLastLapTime refines it after the line).
      if (cand.lapTime !== this.refTime) this.copyProfile(cand)
    } else if (canSwitch) {
      this.adopt(cand, session, player)
    }
  }

  private candidate(
    kind: DeltaReference,
    session: SessionMeta,
    race: RaceView,
    bests: PersonalBestStore,
    player: number
  ): Candidate | null {
    if (kind === 'pb') {
      const key = this.personalBestKey(session, player)
      const pb = key === null ? null : bests.get(key)
      if (!pb || !usableLap(pb.lapTime, pb.profile)) return null
      return { kind, carIdx: -1, lap: -1, lapTime: pb.lapTime, profile: pb.profile }
    }
    if (kind === 'session') {
      const p = race.lapProfile(player, 'best')
      if (!p || !p.clean || !usableLap(p.lapTime, p.profile)) return null
      return { kind, carIdx: player, lap: p.lap, lapTime: p.lapTime, profile: p.profile }
    }
    if (kind === 'optimal') {
      const o = this.optimal.ofCar(player)
      if (!o || !usableLap(o.lapTime, o.profile)) return null
      return { kind, carIdx: player, lap: o.id, lapTime: o.lapTime, profile: o.profile }
    }
    const mine = session.drivers.get(player)
    if (!mine) return null
    if (kind === 'classOptimal') {
      const o = this.optimal.ofClass(mine.classId)
      if (!o || !usableLap(o.lapTime, o.profile)) return null
      return { kind, carIdx: -1, lap: o.id, lapTime: o.lapTime, profile: o.profile }
    }
    let best: Candidate | null = null
    for (const car of race.cars()) {
      const idx = car.carIdx
      if (session.drivers.get(idx)?.classId !== mine.classId) continue
      const p = race.lapProfile(idx, 'best')
      if (!p || !p.clean || !usableLap(p.lapTime, p.profile)) continue
      // Ties: yours, then the lowest CarIdx (a stable choice).
      const better =
        best === null ||
        p.lapTime < best.lapTime ||
        (p.lapTime === best.lapTime &&
          best.carIdx !== player &&
          (idx === player || idx < best.carIdx))
      if (better) best = { kind, carIdx: idx, lap: p.lap, lapTime: p.lapTime, profile: p.profile }
    }
    return best
  }

  private personalBestKey(session: SessionMeta, player: number): string | null {
    if (session !== this.keySession || player !== this.keyPlayer) {
      this.keySession = session
      this.keyPlayer = player
      this.pbKey = personalBestKey(session, player)
    }
    return this.pbKey
  }

  private adopt(cand: Candidate, session: SessionMeta, player: number): void {
    this.ref = cand.kind
    this.refCar = cand.carIdx
    this.refLap = cand.lap
    this.refSelf = cand.kind === 'class' && cand.carIdx === player
    this.refDriver = this.refSelf ? '' : refDriverOf(cand, session)
    this.copyProfile(cand)
    // A delta against another lap: nothing to hold or smooth from.
    this.shownDelta = null
    this.resetTrend()
  }

  private copyProfile(cand: Candidate): void {
    this.refTime = cand.lapTime
    for (let i = 0; i <= LINES; i++) this.refProfile[i] = cand.profile[i] ?? 0
  }

  private dropReference(): void {
    this.ref = null
    this.refCar = -1
    this.refLap = -1
    this.refTime = Number.NaN
    this.refDriver = ''
    this.refSelf = false
    this.shownDelta = null
    this.resetTrend()
  }

  // ---------------------------------------------------------------------------
  // Output
  // ---------------------------------------------------------------------------

  private payload(
    race: RaceView,
    player: number,
    cur: CurrentLap | null,
    pct: number,
    now: number
  ): DeltaData {
    const s = this.summary
    if (s !== null) {
      // At the line (also on the cool-down lap after your flag): the lap just finished.
      const next = cur === null || cur.lap === s.lap + 1
      if ((next && pct < DELTA.guardPct) || (cur === null && race.car(player)?.finished === true)) {
        this.shownDelta = s.data.delta
        return { ...s.data, sectors: s.data.sectors.slice() }
      }
    }
    const n = this.bounds.length
    const sectors = new Array<number | null>(n)
    for (let k = 0; k < n; k++) {
      // The last sector ends at the line: it shows in the summary of the lap.
      const end = k + 1 < n ? (this.cross[k + 1] ?? Number.NaN) : Number.NaN
      sectors[k] = this.sectorDelta(k, this.cross[k] ?? Number.NaN, end)
    }
    let delta: number | null = null
    let trend = 0
    if (cur !== null) {
      const raw = cur.elapsedS - profileAt(this.refProfile, pct)
      if (pct < DELTA.guardPct || !(raw > -DELTA.maxGainFraction * this.refTime)) {
        delta = this.shownDelta
        this.resetTrend()
      } else {
        delta = quantise(raw, 100)
        trend = this.updateTrend(raw, now)
      }
    }
    this.shownDelta = delta
    return {
      visible: true,
      reference: this.ref ?? 'pb',
      refDriver: this.refDriver,
      refSelf: this.refSelf,
      refLapTime: this.refTime,
      delta,
      trend,
      predictedLap: delta === null ? null : quantise(this.refTime + delta, 1000),
      sectors,
      // Without a lap in progress (a tow, before your first line) nothing would count.
      lapValid: cur !== null && !this.lapInvalid
    }
  }

  /** EMA (DELTA.trendTauS) of d(delta)/dt over SessionTime, from 0; quantised 0.01. */
  private updateTrend(raw: number, now: number): number {
    const dt = now - this.trendT
    if (dt === 0) return quantise(this.trendEma, 100)
    if (dt > 0 && dt <= DELTA.maxGapS) {
      const rate = (raw - this.trendRaw) / dt
      this.trendEma += (rate - this.trendEma) * (1 - Math.exp(-dt / DELTA.trendTauS))
    } else {
      this.trendEma = 0
    }
    this.trendT = now
    this.trendRaw = raw
    return quantise(this.trendEma, 100)
  }

  private resetTrend(): void {
    this.trendEma = 0
    this.trendT = Number.NaN
    this.trendRaw = Number.NaN
  }
}

/**
 * DeltaData.refDriver of another driver's class best: '#44 J. Lindqvist' (number and
 * abbreviated name, no words: the widget names every other reference in its language); '' for
 * the other kinds and for a driver no longer in the session info.
 */
function refDriverOf(cand: Candidate, session: SessionMeta): string {
  if (cand.kind !== 'class') return ''
  const d = session.drivers.get(cand.carIdx)
  if (!d) return ''
  const name = formatDriverName(d.userName, 'abbr')
  return d.carNumber !== '' ? `#${d.carNumber} ${name}` : name
}

/** Structural equality of two payloads (for SKIP_EMIT). */
export function deltaEqual(a: DeltaData, b: DeltaData): boolean {
  return (
    a.visible === b.visible &&
    a.reference === b.reference &&
    a.refDriver === b.refDriver &&
    a.refSelf === b.refSelf &&
    a.refLapTime === b.refLapTime &&
    a.delta === b.delta &&
    a.trend === b.trend &&
    a.predictedLap === b.predictedLap &&
    a.lapValid === b.lapValid &&
    arrayEqual(a.sectors, b.sectors)
  )
}
