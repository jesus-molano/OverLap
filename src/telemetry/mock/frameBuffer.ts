/** Output buffers of the mock race and the telemetry frame copied from them. */
import { TELEMETRY_VAR_NAMES, TrackLocation } from '@shared/telemetry'
import type { TelemetryFrame, TelemetryVarName } from '@shared/telemetry'
import { MOCK_CAR_SLOTS } from './constants'
import { initialFuelVars, type MockFuelVars } from './fuel'
import { initialWeatherVars, type MockWeatherVars } from './weather'

/**
 * Every variable the mock produces, as arrays the race writes in place
 * (scalars are 1-element arrays). snapshot() copies the TELEMETRY_VARS ones;
 * a var the mock produces before TELEMETRY_VARS lists it stays out of the frame.
 * The weather and the player's heading are weather.ts's, the fuel, pit menu and tyres fuel.ts's.
 */
export interface MockVars extends MockWeatherVars, MockFuelVars {
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
  /** TireIndex in DriverTires (tyres.ts), -1 for no car. */
  CarIdxTireCompound: number[]
  SessionTimeRemain: number[]
  SessionTimeOfDay: number[]
  SessionLapsRemainEx: number[]
  SessionFlags: number[]
  PlayerCarMyIncidentCount: number[]
  PlayerTrackSurface: number[]
  /** Incidents (playerIncidents.ts): the team's count, the last report, the surface. */
  PlayerCarTeamIncidentCount: number[]
  PlayerIncidents: number[]
  PlayerTrackSurfaceMaterial: number[]
  Throttle: number[]
  Brake: number[]
  Clutch: number[]
  SteeringWheelAngle: number[]
  SteeringWheelAngleMax: number[]
  Gear: number[]
  Speed: number[]
  BrakeABSactive: boolean[]
  /** The car block (cockpit.ts): the bias and TC dialled in, the force feedback. */
  dcBrakeBias: number[]
  dcTractionControl: number[]
  SteeringWheelPctTorque: number[]
  /** irsdk_EngineWarnings of the player (pit limiter 0x10). */
  EngineWarnings: number[]
  /** The player is on pit road (same as its CarIdxOnPitRoad). */
  OnPitRoad: boolean[]
  // The player's own lap fraction, tow, engine temperatures and revs (playerAlerts.ts).
  LapDistPct: number[]
  PlayerCarTowTime: number[]
  WaterTemp: number[]
  OilTemp: number[]
  RPM: number[]
  /** The repairs' time while the scripted damage lasts (playerAlerts.ts). */
  PitRepairLeft: number[]
  PitOptRepairLeft: number[]
  /** Live driving: no replay, the camera on the player, the UI shown (screen.ts changes them). */
  IsReplayPlaying: boolean[]
  /** At the live point (0) unless screen.ts plays the tape. */
  ReplayFrameNumEnd: number[]
  ReplaySessionNum: number[]
  ReplaySessionTime: number[]
  CamCarIdx: number[]
  CamCameraState: number[]
  IsGarageVisible: boolean[]
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
    CarIdxTireCompound: perCar(-1),
    SessionTimeRemain: [0],
    SessionTimeOfDay: [0],
    SessionLapsRemainEx: [0],
    SessionFlags: [0],
    PlayerCarMyIncidentCount: [0],
    PlayerTrackSurface: [TrackLocation.NotInWorld],
    PlayerCarTeamIncidentCount: [0],
    PlayerIncidents: [0],
    PlayerTrackSurfaceMaterial: [0],
    Throttle: [0],
    Brake: [0],
    Clutch: [0],
    SteeringWheelAngle: [0],
    SteeringWheelAngleMax: [0],
    Gear: [0],
    Speed: [0],
    BrakeABSactive: [false],
    dcBrakeBias: [0],
    dcTractionControl: [0],
    SteeringWheelPctTorque: [0],
    EngineWarnings: [0],
    OnPitRoad: [false],
    LapDistPct: [0],
    PlayerCarTowTime: [0],
    WaterTemp: [0],
    OilTemp: [0],
    RPM: [0],
    PitRepairLeft: [0],
    PitOptRepairLeft: [0],
    IsReplayPlaying: [false],
    ReplayFrameNumEnd: [0],
    ReplaySessionNum: [0],
    ReplaySessionTime: [0],
    CamCarIdx: [0],
    CamCameraState: [0],
    IsGarageVisible: [false],
    ...initialWeatherVars(),
    ...initialFuelVars()
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
