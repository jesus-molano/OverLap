/**
 * The mock's track conditions (the variables of the tables' conditions footer), a pure function
 * of the time into the session, plus the player's heading by lap position (YawNorth), so the wind
 * turns around the car as it laps.
 *
 * Each session: the track warms for the first ~20 min and then cools (the trend arrow goes up,
 * steady, down), the wind wanders a little around a south-westerly, and a shower comes through
 * from SHOWER_AT_S: the sky closes in, the rain builds to 40 %, the track gets wet up to
 * "moderately wet" and is declared wet, then it dries out again before the end. Later sessions
 * of a series start a little warmer. Deterministic, no state: MockRace writes it on every step.
 */
import { frac } from '@shared/num'
import { smooth01 } from './math'

/** The variables this module writes (MockVars extends it). */
export interface MockWeatherVars {
  TrackTempCrew: number[]
  AirTemp: number[]
  WindVel: number[]
  WindDir: number[]
  YawNorth: number[]
  TrackWetness: number[]
  Precipitation: number[]
  WeatherDeclaredWet: boolean[]
  Skies: number[]
}

/** Before the first step: nothing known yet (TrackWetness 0 is "unknown"). */
export function initialWeatherVars(): MockWeatherVars {
  return {
    TrackTempCrew: [0],
    AirTemp: [0],
    WindVel: [0],
    WindDir: [0],
    YawNorth: [0],
    TrackWetness: [0],
    Precipitation: [0],
    WeatherDeclaredWet: [false],
    Skies: [0]
  }
}

/** Seconds into the session when the shower starts (the session lasts 40 min). */
export const SHOWER_AT_S = 1260
/** The rain builds over this, holds, then eases off over this again (s). */
const RAIN_RAMP_S = 120
const RAIN_HOLD_S = 240
/** Precipitation at the peak, 0..1 (the SDK's '%' as a fraction). */
const RAIN_PEAK = 0.4

/** irsdk_TrackWetness from these seconds after SHOWER_AT_S on (the water lags the rain). */
const WETNESS_STEPS: readonly (readonly [afterS: number, level: number])[] = [
  [-Infinity, 1],
  [60, 3],
  [150, 4],
  [300, 5],
  [540, 4],
  [660, 3],
  [840, 2],
  [1080, 1]
]
/** Declared wet over this stretch after SHOWER_AT_S (s). */
const DECLARED_WET_FROM_S = 200
const DECLARED_WET_TO_S = 840
/** Skies from these seconds after SHOWER_AT_S on: partly cloudy, closing in, overcast. */
const SKIES_STEPS: readonly (readonly [afterS: number, skies: number])[] = [
  [-Infinity, 1],
  [-240, 2],
  [-60, 3],
  [600, 2],
  [960, 1]
]

/** Track temperature: warming to its peak at TEMP_PEAK_S, cooling after (°C). */
const TRACK_BASE_C = 29
const TRACK_SWING_C = 4
const TEMP_PEAK_S = 1200
/** Air temperature follows the same day, flatter. */
const AIR_BASE_C = 21
const AIR_SWING_C = 1.5
/** The shower cools the track and the air this much at most (°C)... */
const RAIN_COOL_TRACK_C = 4
const RAIN_COOL_AIR_C = 2
/** ...from these seconds after SHOWER_AT_S, over these, and back as the track dries. */
const COOL_IN_FROM_S = 30
const COOL_IN_S = 400
const COOL_OUT_FROM_S = 600
const COOL_OUT_S = 600
/** Later sessions of a series start warmer (°C per session, three steps). */
const SESSION_WARM_C = 0.7

/** Wind from the south-west (where it blows FROM, clockwise from north), wandering a little. */
const WIND_FROM_RAD = (225 * Math.PI) / 180
const WIND_WANDER_RAD = (15 * Math.PI) / 180
const WIND_WANDER_S = 600
const WIND_BASE_MS = 3.2
const WIND_GUST_MS = 0.8
const WIND_GUST_S = 420
/** The shower brings this much more wind (m/s). */
const WIND_RAIN_MS = 1.2

/** The S/F straight's heading (clockwise from north) and how far the corners swing it. */
const START_HEADING_RAD = (100 * Math.PI) / 180
const HEADING_SWING_RAD = 0.5

/** Precipitation (0..1) at `t` seconds into the session. */
export function rainAt(t: number): number {
  const s = t - SHOWER_AT_S
  if (s <= 0 || s >= 2 * RAIN_RAMP_S + RAIN_HOLD_S) return 0
  if (s < RAIN_RAMP_S) return RAIN_PEAK * smooth01(s / RAIN_RAMP_S)
  if (s < RAIN_RAMP_S + RAIN_HOLD_S) return RAIN_PEAK
  return RAIN_PEAK * smooth01((2 * RAIN_RAMP_S + RAIN_HOLD_S - s) / RAIN_RAMP_S)
}

/** The value of the last step at or before `s`. */
function stepAt(steps: readonly (readonly [number, number])[], s: number): number {
  let v = steps[0]?.[1] ?? 0
  for (const [from, value] of steps) if (s >= from) v = value
  return v
}

export function wetnessAt(t: number): number {
  return stepAt(WETNESS_STEPS, t - SHOWER_AT_S)
}

export function declaredWetAt(t: number): boolean {
  const s = t - SHOWER_AT_S
  return s >= DECLARED_WET_FROM_S && s < DECLARED_WET_TO_S
}

export function skiesAt(t: number): number {
  return stepAt(SKIES_STEPS, t - SHOWER_AT_S)
}

/**
 * How much the shower has cooled things, 0..1, smoothly (a real track never drops a degree in a
 * second): in over the first minutes of rain, out again as the track dries.
 */
export function coolingAt(t: number): number {
  const s = t - SHOWER_AT_S
  if (s <= COOL_IN_FROM_S) return 0
  if (s < COOL_OUT_FROM_S) return smooth01((s - COOL_IN_FROM_S) / COOL_IN_S)
  return smooth01(1 - (s - COOL_OUT_FROM_S) / COOL_OUT_S)
}

/** TrackTempCrew at `t` seconds into session `sessionIndex` (°C). */
export function trackTempAt(t: number, sessionIndex = 0): number {
  const day = Math.sin((Math.PI / 2) * (t / TEMP_PEAK_S))
  const warm = SESSION_WARM_C * (sessionIndex % 3)
  return TRACK_BASE_C + warm + TRACK_SWING_C * day - RAIN_COOL_TRACK_C * coolingAt(t)
}

export function airTempAt(t: number, sessionIndex = 0): number {
  const day = Math.sin((Math.PI / 2) * (t / TEMP_PEAK_S))
  const warm = SESSION_WARM_C * (sessionIndex % 3)
  return AIR_BASE_C + warm + AIR_SWING_C * day - RAIN_COOL_AIR_C * coolingAt(t)
}

/** The player's heading at lap fraction `pct`: one full turn per lap, swung by the corners. */
export function headingAt(pct: number): number {
  const p = frac(pct)
  const rad = START_HEADING_RAD + 2 * Math.PI * p + HEADING_SWING_RAD * Math.sin(4 * Math.PI * p)
  return frac(rad / (2 * Math.PI)) * 2 * Math.PI
}

/** Writes every weather variable and YawNorth for `t` seconds into the session. */
export function writeWeather(
  v: MockWeatherVars,
  t: number,
  sessionIndex: number,
  playerPct: number
): void {
  const rain = rainAt(t)
  v.TrackTempCrew[0] = trackTempAt(t, sessionIndex)
  v.AirTemp[0] = airTempAt(t, sessionIndex)
  v.WindVel[0] =
    WIND_BASE_MS +
    WIND_GUST_MS * Math.sin((2 * Math.PI * t) / WIND_GUST_S) +
    WIND_RAIN_MS * (rain / RAIN_PEAK)
  v.WindDir[0] = WIND_FROM_RAD + WIND_WANDER_RAD * Math.sin((2 * Math.PI * t) / WIND_WANDER_S)
  v.YawNorth[0] = headingAt(playerPct)
  v.TrackWetness[0] = wetnessAt(t)
  v.Precipitation[0] = rain
  v.WeatherDeclaredWet[0] = declaredWetAt(t)
  v.Skies[0] = skiesAt(t)
}

/** SessionTrackRubberState of each session of a series, as iRacing writes it. */
const RUBBER_STATES = ['moderate usage', 'moderately high usage', 'high usage'] as const

export function mockRubberState(sessionIndex: number): string {
  return RUBBER_STATES[Math.abs(Math.trunc(sessionIndex)) % RUBBER_STATES.length] ?? ''
}
