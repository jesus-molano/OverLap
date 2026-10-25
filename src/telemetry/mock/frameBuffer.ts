/** Output buffers of the mock race and the telemetry frame copied from them. */
import { TELEMETRY_VAR_NAMES, TrackLocation } from '@shared/telemetry'
import type { TelemetryFrame, TelemetryVarName } from '@shared/telemetry'
import { MOCK_CAR_SLOTS } from './constants'

/**
 * Every variable the mock produces, as arrays the race writes in place
 * (scalars are 1-element arrays). snapshot() copies the TELEMETRY_VARS ones;
 * a var the mock produces before TELEMETRY_VARS lists it stays out of the frame.
 */
export interface MockVars {
  SessionTime: number[]
  SessionNum: number[]
  SessionState: number[]
  PlayerCarIdx: number[]
  IsOnTrack: boolean[]
  CarLeftRight: number[]
  CarIdxLapDistPct: number[]
  CarIdxEstTime: number[]
  CarIdxLapCompleted: number[]
  CarIdxOnPitRoad: boolean[]
  CarIdxTrackSurface: number[]
  CarIdxClass: number[]
  CarIdxClassPosition: number[]
  CarIdxLastLapTime: number[]
  CarIdxBestLapTime: number[]
  CarIdxSessionFlags: number[]
  SessionTimeRemain: number[]
  SessionLapsRemainEx: number[]
  SessionFlags: number[]
  PlayerCarMyIncidentCount: number[]
  PlayerTrackSurface: number[]
  Throttle: number[]
  Brake: number[]
  Clutch: number[]
  SteeringWheelAngle: number[]
  SteeringWheelAngleMax: number[]
  Gear: number[]
  Speed: number[]
  BrakeABSactive: boolean[]
  /** irsdk_EngineWarnings of the player (pit limiter 0x10). */
  EngineWarnings: number[]
  /** The player is on pit road (same as its CarIdxOnPitRoad). */
  OnPitRoad: boolean[]
}

function perCar<T>(value: T): T[] {
  return new Array<T>(MOCK_CAR_SLOTS).fill(value)
}

export class MockFrameBuffer {
  readonly vars: MockVars = {
    SessionTime: [0],
    SessionNum: [0],
    SessionState: [0],
    PlayerCarIdx: [0],
    IsOnTrack: [false],
    CarLeftRight: [0],
    CarIdxLapDistPct: perCar(-1),
    CarIdxEstTime: perCar(0),
    CarIdxLapCompleted: perCar(-1),
    CarIdxOnPitRoad: perCar(false),
    CarIdxTrackSurface: perCar<number>(TrackLocation.NotInWorld),
    CarIdxClass: perCar(0),
    CarIdxClassPosition: perCar(0),
    CarIdxLastLapTime: perCar(-1),
    CarIdxBestLapTime: perCar(-1),
    CarIdxSessionFlags: perCar(0),
    SessionTimeRemain: [0],
    SessionLapsRemainEx: [0],
    SessionFlags: [0],
    PlayerCarMyIncidentCount: [0],
    PlayerTrackSurface: [TrackLocation.NotInWorld],
    Throttle: [0],
    Brake: [0],
    Clutch: [0],
    SteeringWheelAngle: [0],
    SteeringWheelAngleMax: [0],
    Gear: [0],
    Speed: [0],
    BrakeABSactive: [false],
    EngineWarnings: [0],
    OnPitRoad: [false]
  }
  /** Same object: the assignment fails to compile if TELEMETRY_VARS lists a var the mock lacks. */
  private readonly listed: TelemetryFrame = this.vars

  /** Fresh copies of the TELEMETRY_VARS arrays (the race keeps writing its own). */
  snapshot(): TelemetryFrame {
    const out: Partial<Record<TelemetryVarName, readonly number[] | readonly boolean[]>> = {}
    for (const name of TELEMETRY_VAR_NAMES) out[name] = this.listed[name].slice()
    return out as TelemetryFrame
  }
}
