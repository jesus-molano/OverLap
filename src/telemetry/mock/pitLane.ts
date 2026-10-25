/**
 * Pit lane of the mock circuit and the player's own pit stop. The lane runs
 * beside the main straight: entry before the S/F line, stalls just after it,
 * exit before T1. The limit is WeekendInfo.TrackPitSpeedLimit (60 km/h).
 */
import { MOCK_PIT_SPEED_LIMIT_KMH } from './constants'
import { lerp, smooth01 } from './math'
import { TRACK_LENGTH_M } from './track'

// Lap fractions.
export const PIT_IN_PCT = 0.96
export const PIT_OUT_PCT = 0.06
const PIT_STALL_PCT = 0.006
const PIT_STALL_SPACING_PCT = 0.0004
/** The pit lane speed limit, m/s. */
export const PIT_LIMIT_MS = MOCK_PIT_SPEED_LIMIT_KMH / 3.6
/** Speed the limiter holds, half a km/h under the limit (m/s); free cars use it all along the lane. */
export const PIT_SPEED_MS = (MOCK_PIT_SPEED_LIMIT_KMH - 0.5) / 3.6
export const PIT_PCT_PER_S = PIT_SPEED_MS / TRACK_LENGTH_M
/** Lateral offset of the pit lane from the racing line (m). */
export const PIT_LANE_LAT_M = 15
/** irsdk_EngineWarnings pitSpeedLimiter bit. */
export const ENGINE_PIT_LIMITER = 0x10
/** Free cars do not enter while this many cars (the player included) are on pit road. */
export const MAX_CARS_IN_PITS = 2
export const PIT_EVERY_LAPS = 6

/** Lap fraction of a car's pit stall (one box per CarIdx). */
export function stallPctOf(carIdx: number): number {
  return PIT_STALL_PCT + PIT_STALL_SPACING_PCT * carIdx
}

/** Braking distance before the pit entry line (m): ~8 m/s² from top speed to the entry speed. */
const APPROACH_M = 170
/** Lap fraction where the player brakes for the pit entry. */
export const PIT_APPROACH_PCT = PIT_IN_PCT - APPROACH_M / TRACK_LENGTH_M
const STOP_DECEL_MS2 = 5
const LAUNCH_ACCEL_MS2 = 3.5
/** Closer than this to the box (m), the car is in it. */
const STALL_SNAP_M = 0.3
/** Stationary time in the stall (tyres and fuel). */
export const PLAYER_STALL_S = 24
/** Clutch in, first gear: this long after stopping in the box and before leaving it. */
export const STALL_CLUTCH_S = 1.5
export const STALL_READY_S = 2
/** The clutch pedal comes up over this long while pulling away. */
export const LAUNCH_CLUTCH_S = 1.2
/** Back to the lap-rate model over this long after the pit exit line. */
const REJOIN_S = 4

// The late limiter, once per stop: the player crosses the entry line just under the limit
// without the limiter, gets back on the throttle after a second and creeps over the limit,
// presses the limiter LIMITER_LATE_S after the line and coasts back down to the limiter speed.
// The alerts see OFF, then the limiter on but over the limit, then on.
/** Speed at the entry line (m/s): braked to 2 km/h under the limit. */
const ENTRY_SPEED_MS = (MOCK_PIT_SPEED_LIMIT_KMH - 2) / 3.6
/** Seconds after the entry line when the player gets back on the throttle. */
export const CREEP_FROM_S = 1
/** Seconds after the entry line when the limiter goes on. */
export const LIMITER_LATE_S = 2
/** Top of the creep over the limit (km/h above it). */
export const PIT_OVERSPEED_KMH = 5
const OVERSPEED_MS = (MOCK_PIT_SPEED_LIMIT_KMH + PIT_OVERSPEED_KMH) / 3.6
const CREEP_ACCEL_MS2 = (OVERSPEED_MS - ENTRY_SPEED_MS) / (LIMITER_LATE_S - CREEP_FROM_S)
/** The limiter cuts the engine: the car coasts down to the limiter speed at this rate. */
const LIMITER_DECEL_MS2 = 0.8

/**
 * approach: braking on track for the entry; lane-in: on pit road (the late
 * limiter, then at the limiter), then braking into the box; stall:
 * stationary; lane-out: pulling away and at the limiter to the exit line;
 * rejoin: back up to racing pace.
 */
export type PlayerPitPhase = 'none' | 'approach' | 'lane-in' | 'stall' | 'lane-out' | 'rejoin'

/** The player's pit stop, driven by physical speed instead of the lap rate. */
export class PlayerPitStop {
  private current: PlayerPitPhase = 'none'
  private speed = 0
  private inPhaseS = 0
  private decel = 0
  private braking = false
  private entryDist = 0
  private stallDist = 0
  private exitDist = 0

  get phase(): PlayerPitPhase {
    return this.current
  }

  /** m/s while a stop is under way. */
  get speedMs(): number {
    return this.speed
  }

  /** Seconds in the current phase. */
  get phaseS(): number {
    return this.inPhaseS
  }

  get active(): boolean {
    return this.current !== 'none'
  }

  /** CarIdxOnPitRoad / OnPitRoad: from the entry line to the exit line, stall included. */
  get onPitRoad(): boolean {
    return this.current === 'lane-in' || this.current === 'stall' || this.current === 'lane-out'
  }

  get inStall(): boolean {
    return this.current === 'stall'
  }

  /** Pit speed limiter engaged (EngineWarnings 0x10): on pit road from LIMITER_LATE_S after the entry. */
  get limiter(): boolean {
    if (this.current === 'lane-in') return this.inPhaseS >= LIMITER_LATE_S
    return this.onPitRoad
  }

  /** Lane-in: braking into the box (the speed follows the stopping curve). */
  get boxBraking(): boolean {
    return this.braking
  }

  /** 0..1 while rejoining (0 at the exit line), 1 otherwise. */
  get rejoinBlend(): number {
    return this.current === 'rejoin' ? smooth01(this.inPhaseS / REJOIN_S) : 1
  }

  /** Starts the stop at race distance `dist`, at or after PIT_APPROACH_PCT, at `speedMs`. */
  begin(dist: number, speedMs: number, stallPct: number): void {
    const lap = Math.floor(dist)
    this.entryDist = lap + PIT_IN_PCT
    this.stallDist = lap + 1 + stallPct
    this.exitDist = lap + 1 + PIT_OUT_PCT
    const brakingM = Math.max(1, (this.entryDist - dist) * TRACK_LENGTH_M)
    const entry2 = ENTRY_SPEED_MS * ENTRY_SPEED_MS
    this.decel = Math.max(2, (speedMs * speedMs - entry2) / (2 * brakingM))
    this.speed = Math.max(speedMs, ENTRY_SPEED_MS)
    this.enter('approach')
  }

  /** Moves the car along the stop; returns the new race distance. `lapRate` is racing pace (laps/s). */
  advance(dist: number, dtS: number, lapRate: number): number {
    this.inPhaseS += dtS
    switch (this.current) {
      case 'none':
        return dist
      case 'approach': {
        this.speed = Math.max(ENTRY_SPEED_MS, this.speed - this.decel * dtS)
        const next = dist + (this.speed * dtS) / TRACK_LENGTH_M
        if (next >= this.entryDist) this.enter('lane-in')
        return next
      }
      case 'lane-in': {
        const leftM = (this.stallDist - dist) * TRACK_LENGTH_M
        const cruise = this.laneInSpeed(dtS)
        const stopping = Math.sqrt(2 * STOP_DECEL_MS2 * Math.max(0, leftM))
        this.braking = stopping < cruise
        this.speed = Math.min(cruise, stopping)
        const moveM = this.speed * dtS
        if (leftM - moveM > STALL_SNAP_M) return dist + moveM / TRACK_LENGTH_M
        this.speed = 0
        this.enter('stall')
        return this.stallDist
      }
      case 'stall':
        if (this.inPhaseS >= PLAYER_STALL_S) this.enter('lane-out')
        return dist
      case 'lane-out': {
        this.speed = Math.min(PIT_SPEED_MS, this.speed + LAUNCH_ACCEL_MS2 * dtS)
        const next = dist + (this.speed * dtS) / TRACK_LENGTH_M
        if (next >= this.exitDist) this.enter('rejoin')
        return next
      }
      case 'rejoin': {
        const rate = lerp(PIT_SPEED_MS / TRACK_LENGTH_M, lapRate, this.rejoinBlend)
        if (this.inPhaseS >= REJOIN_S) this.enter('none')
        return dist + rate * dtS
      }
    }
  }

  /** Lane-in speed before braking for the box: rolling, creeping over the limit, then the limiter. */
  private laneInSpeed(dtS: number): number {
    const t = this.inPhaseS
    if (t < CREEP_FROM_S) return ENTRY_SPEED_MS
    if (t < LIMITER_LATE_S) {
      return Math.min(OVERSPEED_MS, ENTRY_SPEED_MS + CREEP_ACCEL_MS2 * (t - CREEP_FROM_S))
    }
    return Math.max(PIT_SPEED_MS, this.speed - LIMITER_DECEL_MS2 * dtS)
  }

  private enter(phase: PlayerPitPhase): void {
    this.current = phase
    this.inPhaseS = 0
    this.braking = false
  }
}
