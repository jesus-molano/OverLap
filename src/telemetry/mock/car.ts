/** State of one simulated car. */
import type { GapKey, Keyframe } from './scripts'

/**
 * - player: driven by the race (lap rate, pit stop, cool-down);
 * - escort / battle: scripted relative to the player until the cast is released
 *   (player pit stop, chequered flag), then free;
 * - free: races at its own pace, pits, has incidents.
 */
export type Role = 'player' | 'escort' | 'battle' | 'free'
/** Pit stop of a free car. */
export type PitPhase = 'none' | 'in' | 'stall' | 'out'

/** Scripted trouble of a free car: stopped on track or a trip off it. */
export interface CarIncident {
  readonly kind: 'stop' | 'off'
  stage: 'slow' | 'hold' | 'resume'
  stageS: number
  /** -1 = to the left of the racing line, 1 = to the right. */
  readonly side: -1 | 1
}

export interface SimCar {
  readonly idx: number
  readonly classId: number
  readonly classEstS: number
  role: Role
  readonly script: readonly Keyframe[] | null
  /** Battle cars: gap script and side (1 = ahead of the player, -1 = behind). */
  readonly battle: readonly GapKey[] | null
  readonly battleSide: 1 | -1
  readonly baseLapS: number
  readonly noiseAmp1: number
  readonly noiseW1: number
  readonly noisePh1: number
  readonly noiseAmp2: number
  readonly noiseW2: number
  readonly noisePh2: number
  readonly stallPct: number
  /** A slow lapped classmate the player catches (never picked for an incident). */
  readonly backmarker: boolean
  /** Race distance in laps: CarIdxLapCompleted + CarIdxLapDistPct. */
  dist: number
  /** `dist` before the current step. */
  prevDist: number
  /** Lateral offset from the racing line (m, - = left). */
  latM: number
  /** Free cars: lane picked to pass the player (-1 left, 0 racing line, 1 right). */
  side: -1 | 0 | 1
  pit: PitPhase
  pitStallDist: number
  pitExitDist: number
  stallLeftS: number
  lapsToPit: number
  /** SessionTime at its last S/F crossing (estimated for the lap in progress at the start). */
  lapStartS: number
  /** Pace factor of the lap in progress. */
  lapPace: number
  /** Seconds, -1 when none. */
  lastLapS: number
  bestLapS: number
  /** CarIdxSessionFlags; penalties clear when the pit stop is served. */
  flags: number
  /** Off track (CarIdxTrackSurface OffTrack) until this many seconds since the start. */
  offTrackUntilS: number
  /** Multiplies the lap rate (1 = racing pace), moved toward speedTarget at speedRate per second. */
  speedScale: number
  speedTarget: number
  speedRate: number
  incident: CarIncident | null
  /** Lateral target that overrides the lane logic (incidents), NaN when none. */
  latOverride: number
  /** SessionTime of its S/F crossing during the current step, NaN when none. */
  crossAtS: number
  /** Took the chequered flag. */
  finished: boolean
  /** CarIdxLapCompleted at the flag. */
  finishLap: number
  /** SessionTime of the finish, Infinity before. */
  finishAtS: number
  inWorld: boolean
  /** Seconds since the start at which a finisher leaves the car (Infinity = stays). */
  leaveAtS: number
  /** Race order key written by publish(): finish lap for finishers, else distance. */
  orderKey: number
}

/** Current lap time of `car` at `tS` seconds since the start (pace of the lap plus slow noise). */
export function lapTimeS(car: SimCar, tS: number): number {
  return (
    car.baseLapS *
    car.lapPace *
    (1 +
      car.noiseAmp1 * Math.sin(car.noiseW1 * tS + car.noisePh1) +
      car.noiseAmp2 * Math.sin(car.noiseW2 * tS + car.noisePh2))
  )
}
