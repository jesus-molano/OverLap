/**
 * MockRace: one session of the simulated multi-class timed race,
 * deterministic per seed (simulation.ts describes the cast and the timeline).
 *
 * Every car's race distance is one number, `dist` = laps completed + lap
 * fraction, so CarIdxLapDistPct and CarIdxLapCompleted can never disagree,
 * even for cars whose position is scripted relative to the player.
 *
 * Per step: O(cars), no allocation in steady state.
 */
import { LAPS_REMAIN_UNLIMITED, SessionFlag } from '@shared/flags'
import { wrapPctDelta } from '@shared/lapDist'
import { clamp, frac } from '@shared/num'
import { CarLeftRight, TrackLocation } from '@shared/telemetry'
import type { TelemetryFrame } from '@shared/telemetry'
import { lapTimeS } from './car'
import type { CarIncident, SimCar } from './car'
import { CLOCK_LEFT_AT_START_S, START_SESSION_TIME_S } from './constants'
import {
  DEFAULT_PLAYER_CAR_IDX,
  MOCK_CLASSES,
  MOCK_DRIVERS,
  rosterForSession,
  seatOf
} from './drivers'
import type { MockDriver } from './drivers'
import { buildField } from './field'
import type { MockCast } from './field'
import { RaceFinish, SESSION_STATE_OF } from './finish'
import type { MockRacePhase } from './finish'
import { MockFrameBuffer } from './frameBuffer'
import { PlayerInputs } from './inputs'
import { approach, crossedPct, insertionSort } from './math'
import {
  ENGINE_PIT_LIMITER,
  MAX_CARS_IN_PITS,
  PIT_APPROACH_PCT,
  PIT_EVERY_LAPS,
  PIT_IN_PCT,
  PIT_LANE_LAT_M,
  PIT_OUT_PCT,
  PIT_PCT_PER_S,
  PlayerPitStop
} from './pitLane'
import { MockPlayerAlerts } from './playerAlerts'
import { playerLapPace } from './playerPace'
import { mulberry32 } from './rng'
import type { Rng } from './rng'
import {
  ARM_WINDOW_S,
  INCIDENT_LAT_RATE,
  MOCK_TIMELINE,
  pickIncidentCar,
  startIncident,
  stepIncident
} from './scenarios'
import type { MockEvent, MockEventKind } from './scenarios'
import { LANE_M, battleGapS, sampleEscort } from './scripts'
import { buildGrid, buildSessionInfo } from './sessionInfo'
import type { MockQualifyResult, MockSessionInfo } from './sessionInfo'
import { STEERING_MAX_RAD, TRACK_LENGTH_M } from './track'
import {
  escortNear,
  freerSide,
  laneTaken,
  nearestLineCarM,
  spotterState,
  trackGapM
} from './traffic'

export type { MockCast } from './field'
export type { MockRacePhase } from './finish'

const DEFAULT_SEED = 1
/** Each lap is driven up to this much faster or slower (lap-to-lap consistency, ~0.3 s). */
const LAP_PACE_JITTER = 0.0025
const REPAIR_EXTRA_S = 15
/** A finisher that pits on the cool-down lap leaves the car this long after stopping. */
const LEAVE_AFTER_STALL_S = 4

// Spotter (CarLeftRight): longitudinal overlap ~ one car length.
const OVERLAP_M = 5
const SIDE_MIN_M = 1
/** Blue flag on the player: a car lapping it is at most this far behind (s at its pace). */
const BLUE_BEHIND_S = 3
/** The green flag waves this long when the race goes green again after a caution. */
const GREEN_AFTER_CAUTION_S = 5
/** Step of the leader's next-crossing prediction (the white flag), seconds. */
const PREDICT_DT_S = 0.05
/** No free car starts a pit stop with less than this on the clock (s): the last laps are raced. */
const NO_STOPS_LAST_S = 300
// Free cars moving off the line of the player (and of the battle cars) when they get close.
const LANE_PICK_M = 45
const LANE_RELEASE_M = 60
const LAT_RATE_MPS = 2.5

export interface MockRaceOptions {
  seed?: number
  /** CarIdx of the player in this session's roster; must be a race car. Default: the GT3 #07. */
  playerCarIdx?: number
  /** 0-based session of a series: SubSessionID offset and seating (rosterForSession). Default 0. */
  sessionIndex?: number
}

interface TimedEvent {
  readonly atS: number
  readonly apply: () => void
}

export class MockRace {
  readonly cast: MockCast
  readonly sessionIndex: number
  private readonly roster: readonly MockDriver[]
  private readonly playerIdx: number
  private readonly player: SimCar
  /** Race cars in CarIdx order (pace car and spectator are never in the world). */
  private readonly cars: SimCar[]
  private readonly battleCars: SimCar[]
  private readonly escortCars: SimCar[]
  /** Reused for class positions. */
  private readonly byClass: SimCar[]
  private readonly rng: Rng
  /** Second stream for the v2 data, so the original sequence (paces, pit stops) stays the same. */
  private readonly rng2: Rng
  private readonly grid: readonly MockQualifyResult[]
  private readonly events: readonly TimedEvent[]
  private nextEvent = 0
  private readonly playerStartDist: number
  private time = START_SESSION_TIME_S
  private elapsedS = 0
  /** Cars on pit road, the player included. */
  private inPits = 0
  private carLeftRight: number = CarLeftRight.Clear
  private incidents = 0
  private caution = false
  /** SessionFlags Green until this many seconds since the start (the restart after a caution). */
  private greenUntilS = -Infinity
  private armedKind: CarIncident['kind'] | null = null
  private armedAtS = 0
  private playerPitArmed = false
  /** Laps the player started in this session (its pace follows them, playerPace.ts). */
  private playerLaps = 0
  private readonly eventLog: MockEvent[] = []

  private readonly end: RaceFinish
  private readonly pitStop = new PlayerPitStop()
  private readonly inputs = new PlayerInputs()
  private readonly playerAlerts = new MockPlayerAlerts()
  private readonly out = new MockFrameBuffer()

  constructor(opts: MockRaceOptions = {}) {
    const seed = opts.seed ?? DEFAULT_SEED
    this.sessionIndex = Math.max(0, Math.trunc(opts.sessionIndex ?? 0) || 0)
    this.roster = rosterForSession(this.sessionIndex)
    this.rng = mulberry32(seed)
    this.rng2 = mulberry32((seed ^ 0x5bd1e995) >>> 0)
    this.playerIdx = opts.playerCarIdx ?? defaultPlayerSeat(this.roster)
    const field = buildField(this.roster, this.playerIdx, this.rng, this.rng2)
    this.cars = field.cars
    this.player = field.player
    this.cast = field.cast
    this.playerStartDist = field.playerStartDist
    this.battleCars = this.cars.filter((c) => c.role === 'battle')
    this.escortCars = this.cars.filter((c) => c.role === 'escort')
    this.byClass = this.cars.slice()
    this.grid = buildGrid(this.cars, this.playerIdx, this.rng2)
    this.events = this.buildEvents()
    this.end = new RaceFinish(
      {
        log: (kind, carIdx) => this.logEvent(kind, carIdx),
        onFlag: () => this.onFlag(),
        nextCrossingS: (car) => this.nextCrossingS(car)
      },
      START_SESSION_TIME_S + CLOCK_LEFT_AT_START_S
    )

    const v = this.out.vars
    for (const d of this.roster) v.CarIdxClass[d.carIdx] = MOCK_CLASSES[d.classKey].id
    v.PlayerCarIdx[0] = this.playerIdx
    v.IsOnTrack[0] = true
    v.SessionLapsRemainEx[0] = LAPS_REMAIN_UNLIMITED
    v.SteeringWheelAngleMax[0] = STEERING_MAX_RAD
    this.updateInputs()
    this.publish()
  }

  get sessionTime(): number {
    return this.time
  }

  get playerCarIdx(): number {
    return this.playerIdx
  }

  get phase(): MockRacePhase {
    return this.end.phase
  }

  /** The cool-down is over: a series moves on to its next session. */
  get done(): boolean {
    return this.end.done
  }

  /** Flags, incidents, pit stops, finishes... in order. */
  get log(): readonly MockEvent[] {
    return this.eventLog
  }

  /** irsdk_EngineWarnings of the player, as in the frame. */
  get engineWarnings(): number {
    return this.out.vars.EngineWarnings[0] ?? 0
  }

  step(dtS: number): void {
    if (!(dtS > 0)) return
    this.time += dtS
    this.elapsedS += dtS
    this.runEvents()
    if (this.armedKind) this.tryIncident()
    for (const car of this.cars) {
      car.prevDist = car.dist
      car.crossAtS = Number.NaN
    }
    this.movePlayer(dtS)
    const player = this.player
    // Free cars only move off the line of a player that is on track.
    const lineDist = this.pitStop.onPitRoad ? Number.NaN : player.dist
    for (const car of this.cars) {
      if (car.role === 'escort' && car.script) {
        car.dist = player.dist + sampleEscort(car.script, this.elapsedS, 1) / TRACK_LENGTH_M
        car.latM = sampleEscort(car.script, this.elapsedS, 2)
      } else if (car.role === 'battle') {
        this.stepBattle(car, dtS)
      } else if (car.role === 'free') {
        this.stepFree(car, dtS, lineDist)
      }
    }
    this.timeLap(player, dtS)
    for (const car of this.cars) if (car !== player) this.timeLap(car, dtS)
    this.end.update(this.cars, player, this.elapsedS)
    this.inPits -= this.end.departures(this.cars, this.elapsedS)
    this.updateInputs()
    this.publish()
  }

  /** The current tick: fresh arrays every call. */
  frame(): TelemetryFrame {
    return this.out.snapshot()
  }

  sessionInfo(): MockSessionInfo {
    return buildSessionInfo({
      sessionIndex: this.sessionIndex,
      playerCarIdx: this.playerIdx,
      roster: this.roster,
      grid: this.grid
    })
  }

  // --- timeline ----------------------------------------------------------------

  private buildEvents(): readonly TimedEvent[] {
    const tl = MOCK_TIMELINE
    const events: TimedEvent[] = []
    const meatball = this.cars.find((c) => c.idx === this.cast.meatball)
    const black = this.cars.find((c) => c.idx === this.cast.blackFlag)
    if (meatball) {
      events.push({
        atS: tl.meatballOffS,
        apply: () => {
          meatball.offTrackUntilS = tl.meatballOffS + tl.meatballOffTrackS
          this.logEvent('off-track', meatball.idx)
        }
      })
      events.push({
        atS: tl.meatballFlagS,
        apply: () => {
          penalise(meatball, SessionFlag.Repair)
          this.logEvent('repair-flag', meatball.idx)
        }
      })
    }
    if (black) {
      events.push({
        atS: tl.blackFlagS,
        apply: () => {
          penalise(black, SessionFlag.Black)
          this.logEvent('black-flag', black.idx)
        }
      })
    }
    for (const [atS, points, offS] of tl.playerIncidents) {
      events.push({
        atS,
        apply: () => {
          this.incidents += points
          this.player.offTrackUntilS = atS + offS
          this.logEvent('incident', this.playerIdx)
        }
      })
    }
    for (const atS of tl.hazardStopsS) events.push({ atS, apply: () => this.arm('stop') })
    for (const atS of tl.offTracksS) events.push({ atS, apply: () => this.arm('off') })
    events.push({ atS: tl.cautionS, apply: () => this.setCaution(true) })
    events.push({ atS: tl.cautionS + tl.cautionLengthS, apply: () => this.setCaution(false) })
    events.push({
      atS: tl.playerPitS,
      apply: () => {
        this.playerPitArmed = this.end.phase === 'racing' && !this.player.finished
      }
    })
    return events.sort((a, b) => a.atS - b.atS)
  }

  private runEvents(): void {
    let e = this.events[this.nextEvent]
    while (e && e.atS <= this.elapsedS) {
      e.apply()
      e = this.events[++this.nextEvent]
    }
  }

  private logEvent(kind: MockEventKind, carIdx: number): void {
    this.eventLog.push({ atS: this.elapsedS, kind, carIdx })
  }

  private arm(kind: CarIncident['kind']): void {
    if (this.end.phase !== 'racing') return
    this.armedKind = kind
    this.armedAtS = this.elapsedS
  }

  /** Starts the armed incident on a car in its window ahead of the player, if there is one. */
  private tryIncident(): void {
    const kind = this.armedKind
    if (!kind) return
    const waitedS = this.elapsedS - this.armedAtS
    if (this.end.phase !== 'racing' || waitedS > ARM_WINDOW_S) {
      this.armedKind = null
      return
    }
    if (this.pitStop.active || this.player.finished) return
    const car = pickIncidentCar(this.cars, this.player.dist, kind, waitedS, this.elapsedS)
    if (!car) return
    this.armedKind = null
    startIncident(car, kind, this.elapsedS)
    this.logEvent(kind === 'stop' ? 'hazard' : 'off-track', car.idx)
  }

  private setCaution(on: boolean): void {
    if (on === this.caution || (on && this.end.phase !== 'racing')) return
    this.caution = on
    // Back to green: the flag waves for a few seconds (not when the chequered flag ends it).
    if (!on && this.end.phase === 'racing') {
      this.greenUntilS = this.elapsedS + GREEN_AFTER_CAUTION_S
    }
    this.logEvent(on ? 'caution' : 'caution-end', -1)
  }

  private onFlag(): void {
    this.playerPitArmed = false
    this.armedKind = null
    this.setCaution(false)
    this.releaseCast()
  }

  /** The scripted cars race on their own (player pit stop, chequered flag). */
  private releaseCast(): void {
    for (const car of this.cars) {
      if (car.role !== 'battle' && car.role !== 'escort') continue
      car.role = 'free'
      car.side = car.latM < -SIDE_MIN_M ? -1 : car.latM > SIDE_MIN_M ? 1 : 0
      car.lapsToPit = PIT_EVERY_LAPS
    }
  }

  // --- motion ------------------------------------------------------------------

  private movePlayer(dtS: number): void {
    const p = this.player
    const pit = this.pitStop
    if (pit.active) {
      const wasOnPit = pit.onPitRoad
      p.dist = pit.advance(p.dist, dtS, 1 / lapTimeS(p, this.elapsedS))
      if (pit.onPitRoad !== wasOnPit) {
        this.inPits += pit.onPitRoad ? 1 : -1
        this.logEvent(pit.onPitRoad ? 'pit-in' : 'pit-out', p.idx)
      }
      p.latM = pit.onPitRoad ? PIT_LANE_LAT_M : 0
      return
    }
    p.speedScale = approach(p.speedScale, p.speedTarget, p.speedRate * dtS)
    const before = p.dist
    p.dist += (dtS * p.speedScale) / lapTimeS(p, this.elapsedS)
    if (this.playerPitArmed && crossedPct(before, p.dist, PIT_APPROACH_PCT)) {
      this.playerPitArmed = false
      // The battles and the radar escorts do not follow the player into the pits.
      this.releaseCast()
      pit.begin(p.dist, this.inputs.speed, p.stallPct)
    }
  }

  private stepBattle(car: SimCar, dtS: number): void {
    if (!car.battle) return
    const laps = this.player.dist - this.playerStartDist
    const gap = battleGapS(
      car.battle,
      laps,
      this.elapsedS,
      car.noiseW1,
      car.noisePh1,
      car.noiseW2,
      car.noisePh2
    )
    car.dist = this.player.dist + (car.battleSide * gap) / this.player.baseLapS
    // Stays in line, stepping aside while an escort passes through it.
    const escorts = this.escortCars
    let target = 0
    if (escortNear(car, 0, escorts)) target = escortNear(car, -LANE_M, escorts) ? LANE_M : -LANE_M
    else if (car.latM !== 0 && escortNear(car, car.latM, escorts)) {
      target = -Math.sign(car.latM) * LANE_M
    }
    const maxMove = LAT_RATE_MPS * dtS
    car.latM += clamp(target - car.latM, -maxMove, maxMove)
  }

  /** `lineDist`: the player's race distance, NaN while it is on pit road. */
  private stepFree(car: SimCar, dtS: number, lineDist: number): void {
    if (!car.inWorld) return
    if (stepIncident(car, dtS, this.player.dist) && car.incident?.kind === 'stop') {
      this.logEvent('hazard-end', car.idx)
    }
    car.speedScale = approach(car.speedScale, car.speedTarget, car.speedRate * dtS)
    const before = car.dist
    switch (car.pit) {
      case 'none':
        car.dist += (dtS * car.speedScale) / lapTimeS(car, this.elapsedS)
        break
      case 'in':
        car.dist = Math.min(car.dist + dtS * PIT_PCT_PER_S, car.pitStallDist)
        if (car.dist >= car.pitStallDist) {
          car.pit = 'stall'
          if (car.finished) {
            // End of the cool-down lap: out of the car shortly after stopping.
            car.stallLeftS = Infinity
            car.leaveAtS = Math.min(car.leaveAtS, this.elapsedS + LEAVE_AFTER_STALL_S)
          } else {
            car.stallLeftS = 18 + this.rng() * 8
            // Repairs take longer; a black flag is a drive-through.
            if (car.flags & SessionFlag.Repair) car.stallLeftS += REPAIR_EXTRA_S
            else if (car.flags & SessionFlag.Black) car.stallLeftS = 0
          }
        }
        break
      case 'stall':
        car.stallLeftS -= dtS
        if (car.stallLeftS <= 0) {
          car.pit = 'out'
          car.flags = 0
        }
        break
      case 'out':
        car.dist += dtS * PIT_PCT_PER_S
        if (car.dist >= car.pitExitDist) {
          car.pit = 'none'
          car.latM = LANE_M * 2
          const nextStop = PIT_EVERY_LAPS - 1 + Math.floor(this.rng() * 3)
          // A penalty given on the way out is served on the next lap.
          car.lapsToPit = car.flags !== 0 ? 0 : nextStop
          this.inPits--
        }
        break
    }
    if (Math.floor(car.dist) > Math.floor(before)) car.lapsToPit--

    // Finishers pit at the end of the cool-down lap; nobody starts a stop in the last minutes
    // (the leader's last lap stays predictable for the white flag) or after the flag otherwise.
    if (car.pit === 'none' && crossedPct(before, car.dist, PIT_IN_PCT)) {
      const stop = car.finished
        ? true
        : this.end.phase === 'racing' &&
          car.lapsToPit <= 0 &&
          this.inPits < MAX_CARS_IN_PITS &&
          CLOCK_LEFT_AT_START_S - this.elapsedS > NO_STOPS_LAST_S
      if (stop) {
        const lap = Math.floor(car.dist)
        car.pit = 'in'
        car.pitStallDist = lap + 1 + car.stallPct
        car.pitExitDist = lap + 1 + PIT_OUT_PCT
        car.side = 0
        this.inPits++
      }
    }

    if (car.pit !== 'none') {
      car.latM = PIT_LANE_LAT_M
      return
    }
    let target: number
    if (!Number.isNaN(car.latOverride)) {
      target = car.latOverride
    } else {
      // Move off the line of the player (or of a battle car) before getting close, like a real overtake.
      const gapM = nearestLineCarM(car, lineDist, this.battleCars)
      if (gapM < LANE_PICK_M && car.side === 0) car.side = freerSide(car.idx, this.escortCars)
      else if (gapM > LANE_RELEASE_M) car.side = 0
      target = car.side * LANE_M
      if (target !== 0 && laneTaken(car, target, this.cars)) target *= 2
    }
    const maxMove = (car.incident ? INCIDENT_LAT_RATE[car.incident.kind] : LAT_RATE_MPS) * dtS
    car.latM += clamp(target - car.latM, -maxMove, maxMove)
  }

  /**
   * SessionTime of the next S/F crossing of `car` while it races on the lap-rate
   * model (the integration the steps do, at a fine step); NaN for scripted
   * cars, pit stops, incidents and finishers.
   */
  private nextCrossingS(car: SimCar): number {
    const onModel =
      car === this.player ? !this.pitStop.active : car.role === 'free' && car.pit === 'none'
    if (!onModel || car.incident || car.finished || !car.inWorld) return Number.NaN
    if (car.speedScale !== 1 || car.speedTarget !== 1) return Number.NaN
    let left = Math.floor(car.dist) + 1 - car.dist
    let t = this.elapsedS
    // At most two laps ahead: anything slower is not on the model.
    for (let k = 0; k < (2 * car.baseLapS) / PREDICT_DT_S; k++) {
      t += PREDICT_DT_S
      const d = PREDICT_DT_S / lapTimeS(car, t)
      if (d >= left) {
        // Crosses during this step: interpolated, like timeLap.
        const crossAt = t - PREDICT_DT_S + (PREDICT_DT_S * left) / d
        return this.time + crossAt - this.elapsedS
      }
      left -= d
    }
    return Number.NaN
  }

  /** Records a lap when the car crossed the S/F line during the last step; finishes it after the flag. */
  private timeLap(car: SimCar, dtS: number): void {
    const before = car.prevDist
    const lap = Math.floor(car.dist)
    if (lap <= Math.floor(before) || !(car.dist > before)) return
    // Interpolated inside the step, like the sim's own timing.
    const crossAt = this.time - (dtS * (car.dist - lap)) / (car.dist - before)
    car.crossAtS = crossAt
    const lapS = crossAt - car.lapStartS
    car.lapStartS = crossAt
    // One draw per crossing for every car keeps the sequence stable.
    const jitter = LAP_PACE_JITTER * (this.rng2() * 2 - 1)
    car.lapPace =
      car === this.player ? playerLapPace(jitter, ++this.playerLaps, this.sessionIndex) : 1 + jitter
    if (lapS > 0) {
      car.lastLapS = lapS
      if (car.bestLapS < 0 || lapS < car.bestLapS) car.bestLapS = lapS
    }
    if (this.end.phase !== 'racing' && !car.finished) {
      this.end.finish(car, crossAt, lap, this.player, this.elapsedS)
    }
  }

  // --- output ------------------------------------------------------------------

  private updateInputs(): void {
    this.inputs.update(frac(this.player.dist), this.elapsedS, this.pitStop, this.player.speedScale)
  }

  private onPitRoad(car: SimCar): boolean {
    return car === this.player ? this.pitStop.onPitRoad : car.pit !== 'none'
  }

  private surfaceOf(car: SimCar, onPitRoad: boolean): TrackLocation {
    if (car === this.player ? this.pitStop.inStall : car.pit === 'stall') {
      return TrackLocation.InPitStall
    }
    if (onPitRoad) return TrackLocation.ApproachingPits
    // Like iRacing's, the player's pit surface also covers the lead-in and the exit.
    if (car === this.player && this.pitStop.active) return TrackLocation.ApproachingPits
    return this.elapsedS < car.offTrackUntilS ? TrackLocation.OffTrack : TrackLocation.OnTrack
  }

  /**
   * Blue flag for the player: while racing on track, a car that is lapping it
   * (a lap or more up, behind on the road) is within BLUE_BEHIND_S. The radar
   * escorts and the battle cars run on the player's lap, so never.
   */
  private blueFlag(): boolean {
    const p = this.player
    if (this.end.phase !== 'racing' || p.finished || this.pitStop.onPitRoad) return false
    const myPct = frac(p.dist)
    for (const car of this.cars) {
      if (car === p || !car.inWorld || car.pit !== 'none' || car.finished || car.incident) continue
      // More than half a lap up in race distance while behind on the road: a lap or more up.
      if (car.dist - p.dist < 0.5) continue
      const behind = wrapPctDelta(myPct, frac(car.dist))
      if (behind > 0 && behind * car.baseLapS <= BLUE_BEHIND_S) return true
    }
    return false
  }

  /** Writes the output arrays: per-car state, CarLeftRight, class positions and the scalars. */
  private publish(): void {
    const v = this.out.vars
    const player = this.player
    const playerOnPit = this.pitStop.onPitRoad
    let left = 0
    let right = 0
    for (const car of this.cars) {
      const i = car.idx
      car.orderKey = car.finished ? car.finishLap : car.dist
      v.CarIdxLapCompleted[i] = Math.floor(car.dist)
      v.CarIdxLastLapTime[i] = car.lastLapS
      v.CarIdxBestLapTime[i] = car.bestLapS
      v.CarIdxSessionFlags[i] = car.flags
      if (!car.inWorld) {
        v.CarIdxLapDistPct[i] = -1
        v.CarIdxEstTime[i] = 0
        v.CarIdxOnPitRoad[i] = false
        v.CarIdxTrackSurface[i] = TrackLocation.NotInWorld
        continue
      }
      const pct = frac(car.dist)
      const onPit = this.onPitRoad(car)
      v.CarIdxLapDistPct[i] = pct
      v.CarIdxEstTime[i] = estCurve(pct) * car.classEstS
      v.CarIdxOnPitRoad[i] = onPit
      v.CarIdxTrackSurface[i] = this.surfaceOf(car, onPit)
      if (car === player || onPit || playerOnPit) continue
      if (trackGapM(car.dist, player.dist) >= OVERLAP_M) continue
      const dLat = car.latM - player.latM
      if (dLat < -SIDE_MIN_M) left++
      else if (dLat > SIDE_MIN_M) right++
    }
    this.carLeftRight = spotterState(left, right)
    v.CarIdxSessionFlags[this.playerIdx] = player.flags | (this.blueFlag() ? SessionFlag.Blue : 0)

    insertionSort(this.byClass, byClassThenOrder)
    let classId = Number.NaN
    let pos = 0
    for (const car of this.byClass) {
      pos = car.classId === classId ? pos + 1 : 1
      classId = car.classId
      v.CarIdxClassPosition[car.idx] = pos
    }

    const phase = this.end.phase
    v.SessionTime[0] = this.time
    v.SessionState[0] = SESSION_STATE_OF[phase]
    v.CarLeftRight[0] = this.carLeftRight
    v.SessionTimeRemain[0] = Math.max(0, CLOCK_LEFT_AT_START_S - this.elapsedS)
    v.SessionFlags[0] =
      (this.caution ? SessionFlag.Caution : 0) |
      (this.elapsedS < this.greenUntilS ? SessionFlag.Green : 0) |
      (this.end.white ? SessionFlag.White : 0) |
      (phase === 'racing' ? 0 : SessionFlag.Checkered)
    v.PlayerCarMyIncidentCount[0] = this.incidents
    v.PlayerTrackSurface[0] = v.CarIdxTrackSurface[this.playerIdx] ?? TrackLocation.OnTrack
    v.EngineWarnings[0] = this.pitStop.limiter ? ENGINE_PIT_LIMITER : 0
    v.OnPitRoad[0] = playerOnPit
    const inp = this.inputs
    v.Throttle[0] = inp.throttle
    v.Brake[0] = inp.brake
    v.Clutch[0] = inp.clutch
    v.SteeringWheelAngle[0] = inp.steer
    v.Gear[0] = inp.gear
    v.Speed[0] = inp.speed
    v.BrakeABSactive[0] = inp.abs
    this.playerAlerts.apply(v, this.elapsedS, this.playerIdx)
  }
}

// --- helpers -----------------------------------------------------------------

/** Fraction of the class reference lap at `pct`: monotonic, 0 at 0, 1 at 1, not linear. */
export function estCurve(pct: number): number {
  return pct + 0.02 * Math.sin(2 * Math.PI * pct)
}

function penalise(car: SimCar, flag: number): void {
  car.flags |= flag
  // Served at the next pit entry (or the one after, if the pit lane is full).
  car.lapsToPit = 0
}

/** Class, then finishers by finishing lap and time, then everybody else by distance (orderKey). */
function byClassThenOrder(a: SimCar, b: SimCar): number {
  return (
    a.classId - b.classId ||
    b.orderKey - a.orderKey ||
    (a.finished !== b.finished
      ? a.finished
        ? -1
        : 1
      : a.finished
        ? a.finishAtS - b.finishAtS
        : 0) ||
    a.idx - b.idx
  )
}

/** The default player's (GT3 #07) seat in `roster`. */
function defaultPlayerSeat(roster: readonly MockDriver[]): number {
  const me = MOCK_DRIVERS.find((d) => d.carIdx === DEFAULT_PLAYER_CAR_IDX)
  return (me && seatOf(roster, me.userId)) ?? DEFAULT_PLAYER_CAR_IDX
}
