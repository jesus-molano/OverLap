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
  // CarIdxPosition, CarIdxF2Time (planned fallback for intervals: race time
  // behind the leader, granularity unverified) and CarIdxTireCompound (tyre column).
  /** Seconds, -1 when none. */
  CarIdxLastLapTime: 'number',
  /** Seconds, -1 when none (also for disconnected drivers). */
  CarIdxBestLapTime: 'number',
  /** irsdk_Flags per car (SessionFlag in flags.ts: Black, Furled, Repair, Disqualify). */
  CarIdxSessionFlags: 'number',
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

  // --- v2.1: alerts (player only) ---
  /** irsdk_EngineWarnings bits: pit speed limiter 0x10, engine stalled 0x08, ... */
  EngineWarnings: 'number',
  /** The player is between the pit-lane cones. */
  OnPitRoad: 'boolean',

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
  Skies: 'number'
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
