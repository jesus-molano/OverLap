/**
 * irsdk constants that are not in TELEMETRY_VARS' enums. Kept as plain
 * numbers (not the @irsdk-node/types enum) so the renderer and the mock can
 * use them without the SDK package.
 */

/** irsdk_Flags bits of SessionFlags and CarIdxSessionFlags (mirrors GlobalFlags in @irsdk-node/types). */
export const SessionFlag = {
  Checkered: 0x1,
  White: 0x2,
  Green: 0x4,
  Yellow: 0x8,
  Red: 0x10,
  Blue: 0x20,
  Debris: 0x40,
  Crossed: 0x80,
  YellowWaving: 0x100,
  OneLapToGreen: 0x200,
  GreenHeld: 0x400,
  TenToGo: 0x800,
  FiveToGo: 0x1000,
  RandomWaving: 0x2000,
  Caution: 0x4000,
  CautionWaving: 0x8000,
  /** Per car: black flag (drive-through / stop-and-go). */
  Black: 0x10000,
  Disqualify: 0x20000,
  Servicible: 0x40000,
  Furled: 0x80000,
  /** Per car: meatball (the car must be repaired). */
  Repair: 0x100000
} as const

/** irsdk_EngineWarnings bits (mirrors EngineWarnings in @irsdk-node/types). */
export const EngineWarning = {
  WaterTemp: 0x1,
  FuelPressure: 0x2,
  OilPressure: 0x4,
  Stalled: 0x8,
  PitSpeedLimiter: 0x10,
  RevLimiter: 0x20,
  OilTemp: 0x40,
  MandatoryRepairs: 0x80,
  OptionalRepairs: 0x100
} as const

/** Full-course caution, shown or being waved. */
export const CAUTION_FLAGS = SessionFlag.Caution | SessionFlag.CautionWaving

/** SessionLapsRemainEx in timed or unlimited sessions. */
export const LAPS_REMAIN_UNLIMITED = 32767
