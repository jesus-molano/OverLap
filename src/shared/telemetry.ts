import type { TelemetryVarList } from '@irsdk-node/types'

/**
 * Telemetry variables read from the sim on every tick.
 *
 * This is the single list of per-tick variables the telemetry process reads
 * with `getTelemetryVariable(name)`. Reading only these (instead of
 * `getTelemetry()`, which copies every variable) keeps the 60 Hz loop cheap.
 * A new widget that needs another variable adds it here. Names are checked
 * against irsdk-node's TelemetryVarList, so a typo does not compile.
 *
 * Car-specific variables (dcBrakeBias, dcABS, ...) do not exist in every car.
 * The real source only reads names present in the current var header (asking
 * the native SDK for a missing one segfaults the process); missing ones arrive
 * as an empty array, which providers must treat as "no data".
 *
 * Values are always arrays, exactly as irsdk-node returns them: scalars are
 * read as `frame.PlayerCarIdx[0]`, per-car arrays are indexed by CarIdx.
 */
export const TELEMETRY_VARS = {
  SessionTime: 'number',
  SessionNum: 'number',
  /** irsdk_SessionState: lap relations are meaningless before Racing. */
  SessionState: 'number',
  PlayerCarIdx: 'number',
  /** Player in the car with physics running: CarLeftRight is only valid then. */
  IsOnTrack: 'boolean',
  CarLeftRight: 'number',
  CarIdxLapDistPct: 'number',
  CarIdxEstTime: 'number',
  CarIdxLapCompleted: 'number',
  CarIdxOnPitRoad: 'boolean',
  CarIdxTrackSurface: 'number',
  CarIdxClass: 'number',
  CarIdxClassPosition: 'number',

  // --- v2: timing, standings, battle, ratings ---
  // Not read, so not listed (add each back with its first consumer): CarIdxLap,
  // CarIdxPosition and CarIdxF2Time (planned fallback for intervals: race time
  // behind the leader, granularity unverified).
  /** Seconds, -1 when none. */
  CarIdxLastLapTime: 'number',
  /** Seconds, -1 when none (also for disconnected drivers). */
  CarIdxBestLapTime: 'number',
  /** irsdk_Flags per car (SessionFlag in flags.ts: Black, Furled, Repair, Disqualify). */
  CarIdxSessionFlags: 'number',
  /**
   * TireIndex of each car's compound in DriverInfo.DriverTires (which only names your own car
   * model's tyres), -1 when unknown. Missing in builds without it: an empty array, like any
   * absent var.
   */
  CarIdxTireCompound: 'number',
  /** Seconds left; -1 before Racing. */
  SessionTimeRemain: 'number',
  /** Laps left; LAPS_REMAIN_UNLIMITED (flags.ts) in timed sessions. */
  SessionLapsRemainEx: 'number',
  /** irsdk_Flags of the session (SessionFlag in flags.ts: Caution, CautionWaving, ...). */
  SessionFlags: 'number',
  /** The player's own incident count (not the team's). */
  PlayerCarMyIncidentCount: 'number',
  /** irsdk_TrkLoc of the player (for SR corner counting: skip tows). */
  PlayerTrackSurface: 'number',
  // Incidents (shared/incidents): the team's count, what each incident was and where.
  /** The whole team's incident count (team races). */
  PlayerCarTeamIncidentCount: 'number',
  /** irsdk_IncidentFlags of the player's last incident: report byte | penalty byte (pulse?). */
  PlayerIncidents: 'number',
  /** irsdk_TrkSurf under the player's car (asphalt, kerb, grass, gravel...). */
  PlayerTrackSurfaceMaterial: 'number',

  // --- v2: inputs widget (player only) ---
  /** 0 = off throttle, 1 = full. */
  Throttle: 'number',
  /** 0 = released, 1 = max pedal force. */
  Brake: 'number',
  /** 0 = disengaged (pedal fully pressed), 1 = engaged: the pedal position is 1 - Clutch. */
  Clutch: 'number',
  /** Radians, positive = left (verify sign live). */
  SteeringWheelAngle: 'number',
  /** Radians: half of the wheel's lock-to-lock range. */
  SteeringWheelAngleMax: 'number',
  /** -1 reverse, 0 neutral, 1.. forward. */
  Gear: 'number',
  /** m/s. */
  Speed: 'number',
  BrakeABSactive: 'boolean',
  // The pedals' car block (shared/inputs.ts): per car model, an empty array when the car has none.
  /** The brake bias as the car's display shows it (most cars: % front; some an offset). */
  dcBrakeBias: 'number',
  /** The traction-control setting (no car exposes TC acting live). */
  dcTractionControl: 'number',
  /** Force-feedback torque on the steering shaft, '%' read as 0..1: 1 is clipping (unverified). */
  SteeringWheelPctTorque: 'number',

  // --- v2.1: alerts (player only) ---
  /** irsdk_EngineWarnings bits: pit speed limiter 0x10, engine stalled 0x08, ... */
  EngineWarnings: 'number',
  /** The player is between the pit-lane cones. */
  OnPitRoad: 'boolean',
  /** The player's own lap fraction (wrong-way detection). */
  LapDistPct: 'number',
  /** Seconds until the tow reaches the pits; 0 when not being towed. */
  PlayerCarTowTime: 'number',
  /** °C. Per car model: missing in some cars (an empty array then, see above). */
  WaterTemp: 'number',
  /** °C. Per car model, like WaterTemp. */
  OilTemp: 'number',
  /** Engine revs: a pressure light means nothing with a stopped engine below its idle. */
  RPM: 'number',
  /** Seconds the mandatory repairs take (the warning lights' 'REPARAR · 42 s'), 0 without. */
  PitRepairLeft: 'number',
  /** Seconds the optional repairs take ('OPC. · 38 s'), 0 without. */
  PitOptRepairLeft: 'number',

  // --- What the sim's screen shows (simScreen.ts): hide with its UI, follow replays ---
  /**
   * The replay system is on: a replay of the tape (the per-car arrays and SessionTime are the
   * tape's), or its live point, such as the session screen (live frames). ReplayPoint in
   * simScreen.ts tells them apart. Nothing seen while it is on is a new incident.
   */
  IsReplayPlaying: 'boolean',
  /** Replay frames (60 a second) from the end of the tape: 0 at the live point. */
  ReplayFrameNumEnd: 'number',
  /** SessionNum the replay shows (only read without ReplayFrameNumEnd). */
  ReplaySessionNum: 'number',
  /** SessionTime the replay shows, s (only read without ReplayFrameNumEnd). */
  ReplaySessionTime: 'number',
  /** CarIdx the active camera follows (any car in a replay; meaningless on a scenic camera). */
  CamCarIdx: 'number',
  /** irsdk_CameraState bits (IsSessionScreen 0x1, IsScenicActive 0x2, UIHidden 0x8), signed. */
  CamCameraState: 'number',
  /** The garage screen is open. */
  IsGarageVisible: 'boolean',

  // --- v2.3: track conditions (conditions.ts; the weather is measured at the S/F line) ---
  /** °C, measured by the crew around the track (TrackTemp is its deprecated alias). */
  TrackTempCrew: 'number',
  /** °C. */
  AirTemp: 'number',
  /** m/s. */
  WindVel: 'number',
  /** Radians from north, read as where the wind blows FROM (unverified, see conditions.ts). */
  WindDir: 'number',
  /** Radians: the player's heading from north, in WindDir's sense (unverified). */
  YawNorth: 'number',
  /** irsdk_TrackWetness: 0 unknown, 1 dry .. 7 extremely wet. */
  TrackWetness: 'number',
  /** The SDK's unit is '%': read as 0..1 like Throttle (unverified, see conditions.ts). */
  Precipitation: 'number',
  /** The stewards allow rain tyres. */
  WeatherDeclaredWet: 'boolean',
  /** 0 clear, 1 partly cloudy, 2 mostly cloudy, 3 overcast. */
  Skies: 'number',

  // --- v2.4: fuel and pit strategy (shared/fuel; the player's car only) ---
  /** Litres in the tank. */
  FuelLevel: 'number',
  /** 0..1 of the tank: what it holds when the session YAML does not say (FuelLevel / it). */
  FuelLevelPct: 'number',
  /** Litres the pit menu adds (counted only with its fuel box ticked, PitSvFlags 0x10). */
  PitSvFuel: 'number',
  /** irsdk_PitSvFlags of the pit menu: tyres 0x01..0x08, fuel 0x10, fast repair 0x40. */
  PitSvFlags: 'number',
  /** In your pit stall: the only place iRacing measures the tyres. */
  PlayerCarInPitStall: 'boolean',
  /** Fast repairs left, 255 when unlimited. */
  FastRepairAvailable: 'number',
  FastRepairUsed: 'number',
  /** Tyre sets left, 255 when unlimited. */
  TireSetsAvailable: 'number',
  TireSetsUsed: 'number',
  /**
   * Tread left per tyre and band (left, middle, right), '%' read as 0..1 (fuel/tracker.ts);
   * only updated while the car sits in its pit stall.
   */
  LFwearL: 'number',
  LFwearM: 'number',
  LFwearR: 'number',
  RFwearL: 'number',
  RFwearM: 'number',
  RFwearR: 'number',
  LRwearL: 'number',
  LRwearM: 'number',
  LRwearR: 'number',
  RRwearL: 'number',
  RRwearM: 'number',
  RRwearR: 'number'
} as const satisfies Partial<Record<keyof TelemetryVarList, 'number' | 'boolean'>>

export type TelemetryVarName = keyof typeof TELEMETRY_VARS

export const TELEMETRY_VAR_NAMES = Object.keys(TELEMETRY_VARS) as TelemetryVarName[]

/** One telemetry tick: every variable in TELEMETRY_VARS, as an array. */
export type TelemetryFrame = {
  readonly [K in TelemetryVarName]: (typeof TELEMETRY_VARS)[K] extends 'boolean'
    ? readonly boolean[]
    : readonly number[]
}

/**
 * Upper bound for CarIdx. The SDK header documents 64, current iRacing builds
 * send 72-entry per-car arrays; 128 leaves headroom at no real cost (reads past
 * the end of an array fall back to "not in world").
 */
export const MAX_CARS = 128

/**
 * irsdk_TrkLoc, the value of CarIdxTrackSurface (not to be confused with
 * irsdk_TrkSurf, which is CarIdxTrackSurfaceMaterial). Mirrors
 * `TrackLocation` in @irsdk-node/types.
 */
export { TrackLocation, CarLeftRight, SessionState } from '@irsdk-node/types'
