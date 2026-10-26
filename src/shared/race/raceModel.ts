/**
 * RaceModel: stateful race timing fed by the telemetry loop on every tick
 * (60 Hz) and read by the providers through `view` (RaceView, raceView.ts).
 *
 * Per tick and car (O(cars), no allocations in steady state):
 * - Distance = CarIdxLapCompleted + CarIdxLapDistPct, with the lap counter
 *   fixed up when it wraps a few ticks before/after the pct at the S/F line.
 * - Every timing line crossed since the previous tick gets its SessionTime by
 *   linear interpolation (several per tick at low rates). Teleports (tows,
 *   resets, world exits/entries) record nothing and dirty the lap
 *   (advance.ts).
 * - S/F crossings produce lap records (laps.ts); pit-road edges count stops.
 * - Pace (last clean laps), smoothed speed and time stopped on track
 *   (motion.ts), without spikes across teleports.
 * - The race finish comes from the crossing times; finishers' timing,
 *   position and last lap freeze at their finish line.
 * - Class and overall order, debounced per segment so rows do not flicker at
 *   the line (positions.ts).
 * - Elapsed-time profiles of the last and the best clean lap, for the delta
 *   (profiles.ts).
 * Queries (timeGap, gapHistory, lapsRemaining...) run at provider rate
 * (queries.ts).
 */
import { CAUTION_FLAGS, LAPS_REMAIN_UNLIMITED, SessionFlag } from '../flags'
import { isValidPct } from '../lapDist'
import { finiteOr, frac } from '../num'
import { isRaceSession, resolveFocusCarIdx, resolvePlayerCarIdx } from '../sessionInfo'
import { MAX_CARS, SessionState, TrackLocation } from '../telemetry'
import type { TelemetryFrame } from '../telemetry'
import type { DriverEntry, SessionDetails, SessionMeta } from '../types'
import { TELEPORT_LAPS, advanceTrack, stintStart, updatePitEdges } from './advance'
import { CarTrack, FLAG_CAUTION, FLAG_PIT, NO_LINE } from './carTrack'
import { entryKey } from './entry'
import { closeLap, updateLapTimes } from './laps'
import { crossingsUntil, lapLimitedLapsLeft, timedRaceEndS } from './lapsRemaining'
import { STOP_FRACTION, updateMotion } from './motion'
import { RaceOrder } from './order'
import { currentLap, lapProfile } from './profiles'
import { gapHistory, lapSectors, lapsBehind, pace, timeGap } from './queries'
import { RACE_TIMING_LINES } from './raceView'
import type { RaceCarState, RaceView } from './raceView'

const LINES = RACE_TIMING_LINES
/** A new leader finishing lap must hold this long (lap counter and laps left wrap apart). */
const FINISH_LAP_HOLD_S = 0.5
const DISCONNECT_S = 10
/** The leader's S/F crossing up to this long before SessionState turns Checkered is its finish. */
const FINISH_LAG_S = 1
/** Untimed sessions report SessionTimeRemain = 604800 (a week): anything this long is "no limit". */
const UNLIMITED_TIME_S = 6 * 24 * 3600
/** SessionTime going back more than this (replay, restarted session): start over. */
const TIME_BACKWARD_S = 1
/** Offline sessions all have SubSessionID 0: a reconnect resumes one only within this gap. */
const OFFLINE_RESUME_S = 60
/** Crawl threshold (s per lap) of a car with no pace, for the standing-start check. */
const FALLBACK_LAP_S = 120
/**
 * The green light (SessionFlags Green before SessionState reads Racing) is the race start when it
 * came on at most this long (s) before: iRacing times lap 1 from it (online: lights at 105.42,
 * Racing at 106.47, lap 1 of 1:17.440 from the lights).
 */
const GREEN_LIGHT_LEAD_S = 5

/** SectorStartPct values snapped to timing lines; [] unless they start at 0. */
function snapSectors(starts: readonly number[]): number[] {
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

export class RaceModel {
  /** Live read-only view handed to providers; stays the same object across updates. */
  readonly view: RaceView

  private readonly tracks = new Array<CarTrack | undefined>(MAX_CARS).fill(undefined)
  private readonly drivers = new Array<DriverEntry | undefined>(MAX_CARS).fill(undefined)
  /** entryKey() of each eligible CarIdx of the current SessionMeta. */
  private readonly entryKeys = new Array<string>(MAX_CARS).fill('')
  /** Eligible CarIdx of the current SessionMeta (has a DriverEntry, not pace car/spectator). */
  private readonly eligible = new Int32Array(MAX_CARS)
  private eligibleCount = 0
  /** Grid position (overall and in class) by CarIdx, Infinity when unknown. */
  private readonly gridPos = new Float64Array(MAX_CARS)
  private readonly gridClassPos = new Float64Array(MAX_CARS)
  /**
   * By CarIdx: the last grid slot of its class (0 without a grid), so a car without one
   * goes after every entry of the grid, loaded or not. gridLast: the same overall.
   */
  private readonly gridClassLast = new Float64Array(MAX_CARS)
  private gridLast = 0
  /** By CarIdx: pace fallbacks from the earlier sessions (CarTrack.priorBest / classPriorBest). */
  private readonly priorBest = new Float64Array(MAX_CARS)
  private readonly classPriorBest = new Float64Array(MAX_CARS)
  private sessionRef: SessionMeta | null = null
  private sessionDetails: ReadonlyMap<number, SessionDetails> = new Map()
  private sectorLines: number[] = []
  private teamRacing = false

  private subSessionId = NaN
  private sessionNum = NaN
  private epoch = 0
  private key = ''
  /** reset() ran: the next tick decides between resuming and starting over. */
  private resumePending = false
  private isRace = false
  private sessionState = 0
  /** Race session at SessionState >= Racing. */
  private racing = false
  /** Race session at exactly Racing (green flag running, before the chequered). */
  private racingNow = false
  /** A pre-green tick of this race was seen. */
  private sawPreRace = false
  /** SessionTime of the green flag; -Infinity when the model joined after it. */
  private raceStartT = NaN
  /** SessionTime the green light came on before the race (NaN: not on). */
  private greenLightT = NaN
  /** SessionTime SessionState first read Checkered. */
  private checkeredAt = NaN
  /** SessionTime the overall leader took the flag: crossings from then on finish. */
  private finishStartT = NaN
  private caution = false
  private time = 0
  private hasTime = false
  private playerIdx = -1
  private distanceDriven = 0
  private distanceSeeded = false
  private incidents = 0
  private timeRemain = NaN
  private lapsRemainEx = NaN
  /**
   * Practice/qualifying by laps: your laps left, as seen in the car. Out of it iRacing resets
   * SessionLapsRemainEx to the session's laps; a rise is only taken while IsOnTrack.
   */
  private playerLapsLeft = NaN
  /** Lap-limited races: lap count at which the leader takes the flag, debounced. */
  private leaderFinishLap = NaN
  private finishLapCandidate = NaN
  private finishLapSince = 0

  private readonly order = new RaceOrder()
  private membershipDirty = false
  private carsList: readonly RaceCarState[] = []

  /** S/F crossing `g` (line 0 of lap g / LINES) at SessionTime `tc`. */
  private readonly onSfLine = (track: CarTrack, g: number, tc: number): void => {
    // A finisher's timing stopped at the flag: cool-down laps are not laps.
    if (track.state.finished) return
    track.state.outLap = false
    closeLap(track, g, tc, this.isRace, this.raceStartT)
    if (
      this.isRace &&
      track.startSfLine === NO_LINE &&
      Number.isFinite(this.raceStartT) &&
      tc >= this.raceStartT
    ) {
      track.startSfLine = g
    }
    track.lastSfLap = g / LINES
    track.lastSfT = tc
    if (this.isRace && tc >= this.finishStartT) track.finish(track.lastSfLap, tc)
  }

  constructor() {
    // The getters run with `this` = the view object.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this
    this.view = {
      get sessionTime(): number {
        return self.time
      },
      get sessionKey(): string {
        return self.key
      },
      get racing(): boolean {
        return self.racing
      },
      get playerCarIdx(): number {
        return self.playerIdx
      },
      car: (carIdx) => self.activeTrack(carIdx)?.state,
      cars: () => self.carsList,
      timeGap: (behind, ahead) => {
        const b = self.activeTrack(behind)
        const a = self.activeTrack(ahead)
        return a && b ? timeGap(b, a, self.time) : null
      },
      lapsBehind: (behind, ahead) => {
        const b = self.activeTrack(behind)
        const a = self.activeTrack(ahead)
        return a && b
          ? lapsBehind(b, a, self.isRace && self.sessionState >= SessionState.CoolDown)
          : 0
      },
      gapHistory: (behind, ahead, laps) => {
        const b = self.activeTrack(behind)
        const a = self.activeTrack(ahead)
        return a && b ? gapHistory(b, a, laps) : []
      },
      lastLapSectors: (carIdx) => {
        const track = self.activeTrack(carIdx)
        if (!track || track.lastSfLap === NO_LINE) return null
        return lapSectors(track, track.lastSfLap, self.sectorLines)
      },
      lapSectors: (carIdx, lap) => {
        const track = self.activeTrack(carIdx)
        return track ? lapSectors(track, lap, self.sectorLines) : null
      },
      lapsRemaining: (carIdx) => self.lapsRemaining(carIdx),
      currentLap: (carIdx) => {
        const track = self.activeTrack(carIdx)
        return track ? currentLap(track, self.time) : null
      },
      lapProfile: (carIdx, which) => {
        const track = self.activeTrack(carIdx)
        return track ? lapProfile(track, which) : null
      },
      get timeRemainingS(): number | null {
        return self.timeRemainingS()
      },
      get playerDistanceDriven(): number {
        return self.distanceDriven
      },
      get playerIncidents(): number {
        return self.incidents
      }
    }
  }

  /** Feed one tick. Starts over when SubSessionID or SessionNum change or time goes back. */
  update(frame: TelemetryFrame, session: SessionMeta): void {
    const t = frame.SessionTime[0]
    if (t === undefined || !Number.isFinite(t)) return
    this.syncSessionKey(session.subSessionId, finiteOr(frame.SessionNum[0], -1), t)
    if (session !== this.sessionRef) this.adoptSession(session)

    this.time = t
    this.hasTime = true
    const state = finiteOr(frame.SessionState[0], SessionState.Invalid)
    this.sessionState = state
    this.racing = this.isRace && state >= SessionState.Racing
    this.racingNow = this.isRace && state === SessionState.Racing
    const sessionFlags = finiteOr(frame.SessionFlags[0], 0)
    if (this.isRace && state >= SessionState.GetInCar && state < SessionState.Racing) {
      this.sawPreRace = true
      // The start lights go green a moment before SessionState reads Racing.
      if ((sessionFlags & SessionFlag.Green) === 0) this.greenLightT = NaN
      else if (Number.isNaN(this.greenLightT)) this.greenLightT = t
    }
    const raceStart = this.racing && Number.isNaN(this.raceStartT)
    // Joined after the green: its time (and the first racing lap) is unknown.
    if (raceStart) this.raceStartT = this.sawPreRace ? this.greenAt(t) : -Infinity
    this.caution = (sessionFlags & CAUTION_FLAGS) !== 0

    for (let k = 0; k < this.eligibleCount; k++) {
      this.updateCar(this.eligible[k] ?? 0, frame, raceStart)
    }
    this.updateFinish()
    this.updatePlayer(frame, session)
    this.timeRemain = finiteOr(frame.SessionTimeRemain[0], NaN)
    this.lapsRemainEx = finiteOr(frame.SessionLapsRemainEx[0], NaN)
    this.updatePlayerLapsLeft(frame.IsOnTrack[0] === true)

    const mode = this.racing ? 'race' : this.isRace ? 'grid' : 'best'
    this.order.update(this.tracks, mode, this.gridPos, t, this.membershipDirty)
    if (mode === 'grid') this.gridPositions()
    this.updateLeaderFinishLap()
    if (this.membershipDirty) {
      const list: RaceCarState[] = []
      for (const track of this.tracks) if (track?.active) list.push(track.state)
      this.carsList = list
      this.membershipDirty = false
    }
  }

  /**
   * Connection lost (reconnect, telemetry restart). Nothing is forgotten yet:
   * when the next tick belongs to the same session, pit stops, laps, best
   * laps and the SR distance carry on (only continuity is broken); otherwise
   * the model starts over. sessionKey reads '' until then and changes either way.
   */
  reset(): void {
    for (const track of this.tracks) track?.breakContinuity()
    this.resumePending = true
    this.key = ''
  }

  /**
   * A stretch of frames this model did not see, in the same session (a replay played
   * meanwhile): no lap or line is timed across it and speeds start over; laps, pit stops,
   * bests and sessionKey stay, so the providers keep their state.
   */
  breakContinuity(): void {
    for (const track of this.tracks) track?.breakContinuity()
  }

  /** Forgets everything, as for a new session. */
  hardReset(): void {
    this.clearAll()
    this.subSessionId = NaN
    this.sessionNum = NaN
    this.resumePending = false
    this.key = ''
  }

  // -------------------------------------------------------------------------
  // Per tick
  // -------------------------------------------------------------------------

  private syncSessionKey(sub: number, num: number, t: number): void {
    const backward = this.hasTime && t < this.time - TIME_BACKWARD_S
    const same = sub === this.subSessionId && num === this.sessionNum && !backward
    const resumed = this.resumePending
    this.resumePending = false
    if (same && !resumed) return
    if (same && (sub > 0 || t - this.time <= OFFLINE_RESUME_S)) {
      // Same session after a reconnect: keep everything, re-sort from scratch.
      this.membershipDirty = true
    } else {
      this.clearAll()
      this.subSessionId = sub
      this.sessionNum = num
    }
    this.key = `${sub}:${num}#${++this.epoch}`
  }

  private clearAll(): void {
    for (const track of this.tracks) track?.clear()
    this.sessionRef = null
    this.teamRacing = false
    this.isRace = false
    this.sessionState = SessionState.Invalid
    this.racing = false
    this.racingNow = false
    this.sawPreRace = false
    this.raceStartT = NaN
    this.greenLightT = NaN
    this.checkeredAt = NaN
    this.finishStartT = NaN
    this.caution = false
    this.time = 0
    this.hasTime = false
    this.playerIdx = -1
    this.distanceDriven = 0
    this.distanceSeeded = false
    this.incidents = 0
    this.timeRemain = NaN
    this.lapsRemainEx = NaN
    this.playerLapsLeft = NaN
    this.leaderFinishLap = NaN
    this.finishLapCandidate = NaN
    this.order.clear()
    this.membershipDirty = false
    this.carsList = []
  }

  private adoptSession(session: SessionMeta): void {
    this.sessionRef = session
    this.sessionDetails = session.sessions
    this.teamRacing = session.teamRacing
    this.drivers.fill(undefined)
    this.gridPos.fill(Infinity)
    this.gridClassPos.fill(Infinity)
    this.gridClassLast.fill(0)
    this.priorBest.fill(0)
    this.classPriorBest.fill(0)
    this.gridLast = 0
    this.eligibleCount = 0
    // Per class: the last grid slot and the fastest qualifying time (small: a few classes).
    const classLast = new Map<number, number>()
    const classBest = new Map<number, number>()
    for (const [idx, d] of session.drivers) {
      if (!Number.isInteger(idx) || idx < 0 || idx >= MAX_CARS) continue
      if (d.isPaceCar || d.isSpectator || idx === session.paceCarIdx) continue
      this.drivers[idx] = d
      this.entryKeys[idx] = entryKey(d, session.teamRacing)
      this.eligible[this.eligibleCount++] = idx
      const g = session.grid.get(idx)
      if (!g) continue
      this.gridPos[idx] = g.position
      this.gridClassPos[idx] = g.classPosition
      this.gridLast = Math.max(this.gridLast, g.position)
      classLast.set(d.classId, Math.max(classLast.get(d.classId) ?? 0, g.classPosition))
      if (g.bestLap !== null && g.bestLap > 0) {
        this.priorBest[idx] = g.bestLap
        const best = classBest.get(d.classId)
        if (best === undefined || g.bestLap < best) classBest.set(d.classId, g.bestLap)
      }
    }
    for (let k = 0; k < this.eligibleCount; k++) {
      const idx = this.eligible[k] ?? 0
      const classId = this.drivers[idx]?.classId ?? 0
      this.gridClassLast[idx] = classLast.get(classId) ?? 0
      this.classPriorBest[idx] = classBest.get(classId) ?? 0
    }
    // A slot taken over by another entry, or no longer eligible, starts over. A driver
    // change inside the same team car keeps its history.
    for (let i = 0; i < MAX_CARS; i++) {
      const track = this.tracks[i]
      if (!track?.active) continue
      const d = this.drivers[i]
      if (!d || this.entryKeys[i] !== track.entryKey) {
        track.clear()
        this.membershipDirty = true
        continue
      }
      track.estLapTime = d.classEstLapTime
      track.priorBest = this.priorBest[i] ?? 0
      track.classPriorBest = this.classPriorBest[i] ?? 0
      if (d.classId !== track.classId) {
        track.classId = d.classId
        this.membershipDirty = true
      }
    }
    this.sectorLines = snapSectors(session.sectorStarts)
    const type =
      session.sessionTypes.get(this.sessionNum) ?? this.sessionDetails.get(this.sessionNum)?.type
    this.isRace = isRaceSession(type ?? null)
  }

  private updateCar(i: number, frame: TelemetryFrame, raceStart: boolean): void {
    const pct = frame.CarIdxLapDistPct[i]
    const lapRaw = frame.CarIdxLapCompleted[i]
    const surface = frame.CarIdxTrackSurface[i] ?? TrackLocation.NotInWorld
    let track = this.tracks[i]
    if (
      surface === TrackLocation.NotInWorld ||
      !isValidPct(pct) ||
      lapRaw === undefined ||
      !Number.isFinite(lapRaw)
    ) {
      if (track?.active) this.outOfWorld(track, frame, i)
      return
    }
    const driver = this.drivers[i]
    if (!driver) return
    if (!track) {
      track = new CarTrack(i)
      this.tracks[i] = track
    }
    if (!track.active) {
      track.active = true
      track.entryKey = this.entryKeys[i] ?? ''
      track.classId = driver.classId
      track.estLapTime = driver.classEstLapTime
      track.priorBest = this.priorBest[i] ?? 0
      track.classPriorBest = this.classPriorBest[i] ?? 0
      this.membershipDirty = true
    }

    const onPitRoad = frame.CarIdxOnPitRoad[i] === true
    const inPits = onPitRoad || surface === TrackLocation.InPitStall
    const offTrack = surface === TrackLocation.OffTrack
    // Before this tick's crossings: an excursion at the line counts for the lap it ends.
    if (offTrack) track.lapOffTrack = true
    const flags = (inPits ? FLAG_PIT : 0) | (this.caution ? FLAG_CAUTION : 0)
    // Standing still just behind the line at the green (as of the ticks before it): a standing
    // start, whose first crossing only reaches the line.
    if (raceStart) {
      track.gridStart = this.sawPreRace && frac(track.lastD) > 0.5 && this.crawling(track)
    }
    const d = advanceTrack(track, lapRaw, pct, this.time, flags, this.onSfLine)
    if (this.racing) track.seenRacing = true
    // A lap credited without driving it (a towed car in its box) is not a stint lap.
    if (track.creditedLaps > 0) track.stintStartLap += track.creditedLaps
    // Joined after a green flag it missed: as far as the model knows the car has run since the
    // start (stops it never saw are not counted, like pitStops), so a restart mid-race does not
    // reset every stint.
    if (raceStart || Number.isNaN(track.stintStartLap)) {
      track.stintStartLap = this.racing && this.raceStartT === -Infinity ? 0 : stintStart(d)
    }
    updatePitEdges(track, onPitRoad, this.racingNow, lapRaw, d, this.time)

    const st = track.state
    st.distance = d
    st.inWorld = true
    st.inPits = inPits
    st.offTrack = offTrack
    st.disconnected = false
    st.sessionFlags = frame.CarIdxSessionFlags[i] ?? 0
    const completed = st.finished ? track.finishLap : Math.floor(d)
    st.stintLaps = Math.max(0, completed - track.stintStartLap)
    updateLapTimes(
      track,
      finiteOr(frame.CarIdxLastLapTime[i], -1),
      finiteOr(frame.CarIdxBestLapTime[i], -1),
      completed,
      this.time
    )
    st.pace = pace(track)
    updateMotion(track, d, this.time, inPits)
  }

  private outOfWorld(track: CarTrack, frame: TelemetryFrame, i: number): void {
    if (track.prevValid) {
      track.prevValid = false
      track.dirty = true
    }
    track.lastDelta = 0
    if (!Number.isNaN(track.motionT)) track.resetMotion()
    const st = track.state
    st.distance = NaN
    st.inWorld = false
    st.inPits = false
    st.offTrack = false
    // The class estimate may change while it is away (a new SessionMeta).
    st.pace = pace(track)
    // A finisher leaving the car after the flag has not retired.
    st.disconnected =
      !st.finished && track.seenRacing && this.time - track.lastInWorldT > DISCONNECT_S
    st.sessionFlags = frame.CarIdxSessionFlags[i] ?? 0
  }

  /**
   * Race finish from the crossing times, not from the state on the crossing
   * tick: Checkered can arrive a few ticks before or after the leader's line.
   * The overall leader's first crossing at or just before it (FINISH_LAG_S)
   * starts the finish; every crossing from that moment on takes the flag,
   * including the ones already processed in the lag or earlier this tick.
   */
  private updateFinish(): void {
    if (!this.isRace || this.sessionState < SessionState.Checkered) return
    if (Number.isNaN(this.checkeredAt)) this.checkeredAt = this.time
    if (!Number.isNaN(this.finishStartT)) return
    const leader = this.finishLeader()
    if (!leader || !(leader.lastSfT >= this.checkeredAt - FINISH_LAG_S)) return
    const start = leader.lastSfT
    this.finishStartT = start
    for (let k = 0; k < this.eligibleCount; k++) {
      const track = this.tracks[this.eligible[k] ?? 0]
      if (track?.active && !track.state.finished && track.lastSfT >= start) {
        track.finish(track.lastSfLap, track.lastSfT)
      }
    }
  }

  /** Furthest car among those in the world or just out of it (a winner parking past the line). */
  private finishLeader(): CarTrack | undefined {
    let best: CarTrack | undefined
    for (let k = 0; k < this.eligibleCount; k++) {
      const track = this.tracks[this.eligible[k] ?? 0]
      if (!track?.active || !(track.lastD > (best?.lastD ?? -Infinity))) continue
      if (!track.state.inWorld && this.time - track.lastInWorldT > DISCONNECT_S) continue
      best = track
    }
    return best
  }

  /**
   * SR distance: laps the player drove this session, only while in the car
   * (IsOnTrack: not while a teammate drives or a replay plays), without
   * tows/teleports. Seeded once from the car's laps when the model starts
   * mid-session, so it spans the same as PlayerCarMyIncidentCount. Always your
   * own car's, also while the camera follows another one.
   */
  private updatePlayer(frame: TelemetryFrame, session: SessionMeta): void {
    // The player, or the car on camera at a replay's live point (the tape is never fed).
    this.playerIdx = resolveFocusCarIdx(frame, session)
    const own = resolvePlayerCarIdx(frame, session)
    const pt = own >= 0 ? this.tracks[own] : undefined
    if (pt?.active && pt.state.inWorld) {
      if (!this.distanceSeeded) {
        this.distanceSeeded = true
        // On the grid (lap 0) the pct is ~0.9x of a lap not driven yet. A team car's laps
        // include teammates' stints, which are not the user's corners.
        if (!this.teamRacing && pt.lastD >= 1) this.distanceDriven = pt.lastD
      } else if (
        frame.IsOnTrack[0] === true &&
        frame.PlayerTrackSurface[0] !== TrackLocation.NotInWorld &&
        pt.lastDelta > 0 &&
        pt.lastDelta < TELEPORT_LAPS
      ) {
        this.distanceDriven += pt.lastDelta
      }
    }
    this.incidents = finiteOr(frame.PlayerCarMyIncidentCount[0], 0)
  }

  /** The race start at the tick SessionState reads Racing (`t`): the green light, when just before. */
  private greenAt(t: number): number {
    const lead = t - this.greenLightT
    return lead >= 0 && lead <= GREEN_LIGHT_LEAD_S ? this.greenLightT : t
  }

  /** The car's measured speed is a crawl (motion.ts): stopped on the grid, in its box... */
  private crawling(track: CarTrack): boolean {
    const st = track.state
    return track.spdKnown && st.speed < STOP_FRACTION / (st.pace ?? FALLBACK_LAP_S)
  }

  /**
   * Before the green: every car at its grid slot (QualifyResultsInfo), so the positions are
   * the real ones while entries are still loading; a car without a slot goes after the
   * whole grid, in the order's ranking. Without any grid, the order's numbering stays.
   */
  private gridPositions(): void {
    if (this.gridLast <= 0) return
    for (let k = 0; k < this.eligibleCount; k++) {
      const i = this.eligible[k] ?? 0
      const track = this.tracks[i]
      if (!track?.active) continue
      const pos = this.gridPos[i] ?? Infinity
      if (Number.isFinite(pos)) {
        track.state.overallPosition = pos
        track.state.classPosition = this.gridClassPos[i] ?? 0
        continue
      }
      // Ranked by the order among the other cars without a slot (none, nearly always).
      let overall = this.gridLast + 1
      let cls = (this.gridClassLast[i] ?? 0) + 1
      const own = track.state.overallPosition
      for (let j = 0; j < this.eligibleCount; j++) {
        const other = this.tracks[this.eligible[j] ?? 0]
        if (!other?.active || other === track) continue
        if (Number.isFinite(this.gridPos[other.carIdx] ?? Infinity)) continue
        if (other.state.overallPosition >= own) continue
        overall++
        if (other.classId === track.classId) cls++
      }
      track.state.overallPosition = overall
      track.state.classPosition = cls
    }
  }

  /** Non-race sessions by laps: your laps left only go up while you are in the car. */
  private updatePlayerLapsLeft(onTrack: boolean): void {
    if (this.isRace || !this.lapLimited()) {
      this.playerLapsLeft = NaN
      return
    }
    const ex = this.lapsRemainEx
    if (onTrack || !(this.playerLapsLeft <= ex)) this.playerLapsLeft = ex
  }

  /**
   * Lap-limited race: the leader's finishing lap = its completed laps +
   * SessionLapsRemainEx (assumed to count the leader's laps left including
   * the current one). Both wrap at the line on possibly different ticks, so
   * a new value must hold for FINISH_LAP_HOLD_S.
   */
  private updateLeaderFinishLap(): void {
    const leader = this.leaderTrack()
    if (!this.racingNow || !this.lapLimited() || !leader) {
      this.leaderFinishLap = NaN
      return
    }
    const v = Math.floor(leader.orderDistance()) + this.lapsRemainEx
    if (v === this.leaderFinishLap || Number.isNaN(this.leaderFinishLap)) {
      this.leaderFinishLap = v
      this.finishLapCandidate = v
    } else if (v !== this.finishLapCandidate) {
      this.finishLapCandidate = v
      this.finishLapSince = this.time
    } else if (this.time - this.finishLapSince >= FINISH_LAP_HOLD_S) {
      this.leaderFinishLap = v
    }
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  private activeTrack(carIdx: number): CarTrack | undefined {
    if (!Number.isInteger(carIdx) || carIdx < 0 || carIdx >= MAX_CARS) return undefined
    const track = this.tracks[carIdx]
    return track?.active ? track : undefined
  }

  private leaderTrack(): CarTrack | undefined {
    const idx = this.order.leaderIdx()
    return idx >= 0 ? this.tracks[idx] : undefined
  }

  private lapLimited(): boolean {
    const ex = this.lapsRemainEx
    return ex >= 0 && ex < LAPS_REMAIN_UNLIMITED
  }

  /** The session's scheduled time limit (s), null when it has none. */
  private scheduledTimeS(): number | null {
    const s = this.sessionDetails.get(this.sessionNum)?.timeS ?? null
    return s !== null && s > 0 && s < UNLIMITED_TIME_S ? s : null
  }

  /**
   * Clock left for the laps estimate: SessionTimeRemain, or the scheduled length before the
   * start. Before a race's green SessionTimeRemain counts down the grid, not the race.
   */
  private timeLeftForLaps(): number | null {
    if (this.isRace && this.sessionState < SessionState.Racing) return this.scheduledTimeS()
    const remain = this.timeRemain
    if (remain >= 0 && remain < UNLIMITED_TIME_S) return remain
    return this.sessionState < SessionState.Racing ? this.scheduledTimeS() : null
  }

  private lapsRemaining(carIdx: number): number | null {
    const track = this.activeTrack(carIdx)
    if (!track) return null
    const ex = this.lapsRemainEx
    if (!this.isRace) {
      // Practice/qualifying: lap limits are the player's own; time limits end each car's lap.
      if (this.lapLimited()) {
        if (carIdx !== this.playerIdx) return null
        return this.sessionState >= SessionState.CoolDown ? 0 : this.playerLapsLeft
      }
      const remain = this.timeLeftForLaps()
      const p = pace(track)
      if (remain === null || p === null) return null
      return crossingsUntil(remain, frac(track.lastD), p)
    }
    if (track.state.finished) return 0
    // The cool-down: the race is over, flag taken or not (a car parked in its box for good).
    if (this.sessionState >= SessionState.CoolDown) return 0
    // Flag out, not crossed since the leader took it: this lap is the last.
    if (this.sessionState >= SessionState.Checkered) return 1
    if (this.lapLimited()) {
      const leader = this.leaderTrack()
      if (
        this.sessionState < SessionState.Racing ||
        !leader ||
        Number.isNaN(this.leaderFinishLap)
      ) {
        return ex
      }
      const laps = lapLimitedLapsLeft(
        this.leaderFinishLap,
        leader.orderDistance(),
        track.orderDistance()
      )
      return Math.max(this.racingNow ? 1 : 0, laps)
    }
    const remain = this.timeLeftForLaps()
    const leader = this.leaderTrack() ?? track
    const leaderPace = pace(leader)
    const p = pace(track)
    if (remain === null || leaderPace === null || p === null) return null
    const endS = timedRaceEndS(remain, frac(leader.orderDistance()), leaderPace)
    const d = track.orderDistance()
    const n = crossingsUntil(endS, frac(d), p)
    // On the grid (lap -1) the first crossing only reaches the line: no lap done.
    return d < 0 ? Math.max(1, n - 1) : n
  }

  private timeRemainingS(): number | null {
    // A race's clock: its scheduled length before the green. Any session's is over once the
    // flag is out (SessionTimeRemain then counts the time left to finish, or to leave).
    if (this.isRace && this.sessionState < SessionState.Racing) return this.scheduledTimeS()
    if (this.sessionState >= SessionState.Checkered) return null
    // By laps, a clock only when the session has a time limit too.
    if (this.lapLimited() && this.scheduledTimeS() === null) return null
    const remain = this.timeRemain
    return remain >= 0 && remain < UNLIMITED_TIME_S ? remain : null
  }
}
