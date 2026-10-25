/**
 * What happens when in every mock session (seconds since the session
 * started), and the scripted incidents of free cars. The first 10 minutes
 * only have the cast's flags and incidents (the end-to-end tests read that
 * stretch); the hazards, the caution and the player's pit stop come later.
 */
import { wrapPctDelta } from '@shared/lapDist'
import { frac } from '@shared/num'
import type { CarIncident, SimCar } from './car'
import { PIT_IN_PCT, PIT_OUT_PCT } from './pitLane'
import { LANE_M } from './scripts'
import { TRACK_LENGTH_M } from './track'

export interface MockTimeline {
  /** The meatball car goes off, gets the repair flag and pits for longer. */
  readonly meatballOffS: number
  readonly meatballOffTrackS: number
  readonly meatballFlagS: number
  /** A car of the other class gets a black flag (drive-through). */
  readonly blackFlagS: number
  /** Player incidents: [time, points, seconds off track]. */
  readonly playerIncidents: readonly (readonly [atS: number, points: number, offS: number])[]
  /**
   * From each time, the next free car 250-900 m ahead of the player (further
   * when nobody is there) stops on track until the player has gone by (10-40 s).
   */
  readonly hazardStopsS: readonly number[]
  /**
   * From each time, the next free car 100-450 m ahead of the player (further
   * when nobody is there) runs off the track for ~3 s.
   */
  readonly offTracksS: readonly number[]
  /** A short caution (SessionFlags 0x4000). */
  readonly cautionS: number
  readonly cautionLengthS: number
  /** From this time, the player pits at the next pit entry. */
  readonly playerPitS: number
}

export const MOCK_TIMELINE: MockTimeline = {
  meatballOffS: 26,
  meatballOffTrackS: 2,
  meatballFlagS: 28,
  blackFlagS: 420,
  playerIncidents: [
    [90, 1, 1.2],
    [300, 2, 2.2],
    [960, 1, 1]
  ],
  hazardStopsS: [640, 1500],
  offTracksS: [1100],
  cautionS: 1380,
  cautionLengthS: 30,
  playerPitS: 1740
}

/** What the log records, with the CarIdx it concerns (-1 for the session). */
export type MockEventKind =
  | 'off-track'
  | 'repair-flag'
  | 'black-flag'
  | 'warning-flag'
  | 'warning-end'
  | 'incident'
  | 'hazard'
  | 'hazard-end'
  | 'caution'
  | 'caution-end'
  | 'pit-in'
  | 'pit-out'
  | 'white-flag'
  | 'checkered'
  | 'finish'
  | 'cool-down'
  | 'left-world'
  | 'session-end'

export interface MockEvent {
  /** Seconds since the session started. */
  readonly atS: number
  readonly kind: MockEventKind
  readonly carIdx: number
}

/** An armed incident waits this long at most for a car. */
export const ARM_WINDOW_S = 300
/** Track gap ahead of the player (m) in which a car is picked, by incident kind. */
const INCIDENT_WINDOW_M = { stop: [250, 900], off: [100, 450] } as const
/** Nobody in the window after this long (a sparse field ahead): it reaches further, at this rate. */
const WIDEN_AFTER_S = 180
const WIDEN_M_PER_S = 15

// Stop: slows to a halt in ~2.5 s while pulling two lanes over, waits until
// the player has gone by (10-40 s), then pulls away in ~6 s.
const STOP_SLOW_RATE = 1 / 2.5
const STOP_HOLD_MIN_S = 10
const STOP_HOLD_MAX_S = 40
/** The stopped car waits until the player is this far past it (m). */
const STOP_PASSED_M = 30
const STOP_RESUME_RATE = 1 / 6
const STOP_LAT_M = 2 * LANE_M
// Off: runs wide beyond the kerb at ~55 % pace for 3 s, then back on and up to speed in ~4 s.
const OFF_PACE = 0.55
const OFF_SLOW_RATE = 0.6
const OFF_S = 3
const OFF_RESUME_RATE = 1 / 4
const OFF_LAT_M = 10
/** Lateral speed of a car having an incident (m/s). */
export const INCIDENT_LAT_RATE = { stop: 2.5, off: 5 } as const
/** No incidents this close to the pit lane (lap fraction): the lane would hide them. */
const PIT_ZONE_MARGIN = 0.02

/**
 * First free car (by CarIdx) in the window of `kind` ahead of `playerDist` on
 * track that can have an incident now, `waitedS` after arming; null when none.
 */
export function pickIncidentCar(
  cars: readonly SimCar[],
  playerDist: number,
  kind: CarIncident['kind'],
  waitedS: number,
  elapsedS: number
): SimCar | null {
  const span = INCIDENT_WINDOW_M[kind]
  const minM = span[0]
  const widenM = Math.max(0, waitedS - WIDEN_AFTER_S) * WIDEN_M_PER_S
  const maxM = Math.min(TRACK_LENGTH_M / 2, span[1] + widenM)
  const playerPct = frac(playerDist)
  for (const car of cars) {
    if (car.role !== 'free' || car.pit !== 'none' || car.finished || !car.inWorld) continue
    // Backmarkers keep their pace: they are the slower traffic the player catches.
    if (car.backmarker) continue
    if (car.incident || car.speedScale !== 1 || elapsedS < car.offTrackUntilS) continue
    const pct = frac(car.dist)
    if (pct > PIT_IN_PCT - PIT_ZONE_MARGIN || pct < PIT_OUT_PCT + PIT_ZONE_MARGIN) continue
    const aheadM = wrapPctDelta(pct, playerPct) * TRACK_LENGTH_M
    if (aheadM >= minM && aheadM <= maxM) return car
  }
  return null
}

export function startIncident(car: SimCar, kind: CarIncident['kind'], elapsedS: number): void {
  const side: -1 | 1 = car.idx % 2 === 0 ? 1 : -1
  car.incident = { kind, stage: 'slow', stageS: 0, side }
  if (kind === 'stop') {
    car.speedTarget = 0
    car.speedRate = STOP_SLOW_RATE
    car.latOverride = side * STOP_LAT_M
  } else {
    car.speedTarget = OFF_PACE
    car.speedRate = OFF_SLOW_RATE
    car.latOverride = side * OFF_LAT_M
    car.offTrackUntilS = elapsedS + OFF_S
  }
}

/**
 * Advances the incident of `car` (before its speed scale moves this step);
 * `playerDist` is the player's race distance. Returns true on the step the
 * car starts pulling away again.
 */
export function stepIncident(car: SimCar, dtS: number, playerDist: number): boolean {
  const inc = car.incident
  if (!inc) return false
  inc.stageS += dtS
  switch (inc.stage) {
    case 'resume':
      if (car.speedScale >= 1) car.incident = null
      return false
    case 'slow':
      if (inc.kind === 'off') return inc.stageS >= OFF_S && resume(car, inc, OFF_RESUME_RATE)
      if (car.speedScale <= 0) {
        inc.stage = 'hold'
        inc.stageS = 0
      }
      return false
    case 'hold': {
      if (inc.stageS < STOP_HOLD_MIN_S) return false
      const passedM = -wrapPctDelta(frac(car.dist), frac(playerDist)) * TRACK_LENGTH_M
      if (passedM < STOP_PASSED_M && inc.stageS < STOP_HOLD_MAX_S) return false
      return resume(car, inc, STOP_RESUME_RATE)
    }
  }
}

function resume(car: SimCar, inc: CarIncident, rate: number): true {
  inc.stage = 'resume'
  inc.stageS = 0
  car.speedTarget = 1
  car.speedRate = rate
  car.latOverride = Number.NaN
  return true
}
