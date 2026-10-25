/**
 * Conditions widget ('Pista'): track and air temperature, how the track temperature is moving,
 * the wind against your car, how wet the track is, the rain, the stewards' wet call, the sky and
 * the rubber laid down. iRacing has no forecast, so there is none here. Runs at 1 Hz; readings
 * are quantised to what the widget shows, so SKIP_EMIT drops the ticks where nothing shown
 * changed. The trend's history lives in one ConditionsProvider per telemetry loop.
 *
 * Two readings are unverified (report §2.6) and are decided in one place each:
 * - The wind: WindDir is read as where the wind blows FROM (the meteorological convention) and
 *   YawNorth as the car's heading, both in the same sense from north, so the wind relative to
 *   your nose is WindDir - YawNorth (WIND_CONVENTION). If a live session draws the arrow on the
 *   wrong side, flip `dirIsFrom`; if it turns the wrong way as the car turns, flip
 *   `yawClockwise`.
 * - Precipitation: the SDK's unit is '%', read as 0..1 like every other '%' variable (Throttle,
 *   FuelLevelPct); a value above 1 is taken as already in percent.
 */
import { finiteOr, isFiniteNumber } from './num'
import type { TelemetryFrame } from './telemetry'
import type { ConditionsData, SessionMeta, TempTrend } from './types'

export const CONDITIONS = {
  /** The trend keeps one track temperature sample this often at most (s of session time). */
  trendSampleS: 15,
  /** It compares with the temperature this long ago (s)... */
  trendWindowS: 300,
  /** ...and says nothing with less history than this (s). */
  trendMinSpanS: 120,
  /** Rising or falling from this rate on (°C per minute: 0.3 °C in 5 min)... */
  trendOnCPerMin: 0.06,
  /** ...and steady again below this one, so a rate at the threshold does not flicker. */
  trendOffCPerMin: 0.03,
  /** Below this the wind has no direction worth drawing (m/s, about 2 km/h). */
  calmMs: 0.5,
  /** The relative wind direction goes out in steps of this (degrees). */
  windStepDeg: 5
} as const

/** How WindDir and YawNorth are read (unverified: see the top of this file). */
export interface WindConvention {
  /** WindDir is where the wind blows FROM, not where it goes. */
  readonly dirIsFrom: boolean
  /** YawNorth turns the same way as WindDir (clockwise seen from above, like a compass). */
  readonly yawClockwise: boolean
}

export const WIND_CONVENTION: WindConvention = Object.freeze({
  dirIsFrom: true,
  yawClockwise: true
})

/** irsdk_TrackWetness: 1 = dry .. 7 = extremely wet; 0 is "unknown", never "dry". */
export const WETNESS_MIN = 1
export const WETNESS_MAX = 7
/** Skies: 0 clear .. 3 overcast. */
export const SKIES_MAX = 3

/** Temperatures outside this (°C) are a corrupt value, not weather. */
const TEMP_MIN_C = -60
const TEMP_MAX_C = 90
const MS_TO_KMH = 3.6
const DEG_PER_RAD = 180 / Math.PI

/** Degrees in (-180, 180]. */
export function wrapDeg(deg: number): number {
  const d = deg - 360 * Math.floor((deg + 180) / 360)
  return d === -180 ? 180 : d
}

/**
 * Where the wind blows FROM relative to the car's nose, degrees clockwise in (-180, 180]: 0 =
 * from straight ahead (a headwind), 90 = from the right, 180 = from behind. Null when either
 * angle is not a finite number.
 */
export function windFromRelDeg(
  windDirRad: unknown,
  yawNorthRad: unknown,
  convention: WindConvention = WIND_CONVENTION
): number | null {
  if (!isFiniteNumber(windDirRad) || !isFiniteNumber(yawNorthRad)) return null
  const from = convention.dirIsFrom ? windDirRad : windDirRad + Math.PI
  const heading = convention.yawClockwise ? yawNorthRad : -yawNorthRad
  return wrapDeg((from - heading) * DEG_PER_RAD)
}

/** `deg` in steps of `step`, wrapped again (so -178 in steps of 5 is 180, not -180). */
export function stepDeg(deg: number, step: number): number {
  return wrapDeg(Math.round(deg / step) * step) || 0
}

/** A plausible temperature in °C to 0.1, else null. */
function tempC(v: unknown): number | null {
  if (!isFiniteNumber(v) || v < TEMP_MIN_C || v > TEMP_MAX_C) return null
  return Math.round(v * 10) / 10 || 0
}

/** irsdk_TrackWetness 1..7, null for 0 (unknown) and anything else. */
export function wetnessLevel(v: unknown): number | null {
  return Number.isInteger(v) && (v as number) >= WETNESS_MIN && (v as number) <= WETNESS_MAX
    ? (v as number)
    : null
}

/** Precipitation in whole %: 0..1 (the SDK's '%' variables), or already 0..100 above 1. */
export function precipitationPct(v: unknown): number | null {
  if (!isFiniteNumber(v) || v < 0) return null
  const pct = v > 1 ? v : v * 100
  return Math.round(Math.min(pct, 100))
}

function skiesOf(v: unknown): number | null {
  return Number.isInteger(v) && (v as number) >= 0 && (v as number) <= SKIES_MAX
    ? (v as number)
    : null
}

/**
 * The track temperature's trend: the rate over the last CONDITIONS.trendWindowS of session time,
 * with hysteresis. Fed once per compute; the session clock going back (a replay, a new session)
 * starts it over.
 */
export class TempTrendTracker {
  private readonly samples: { t: number; c: number }[] = []
  private trend: TempTrend = 'steady'

  reset(): void {
    this.samples.length = 0
    this.trend = 'steady'
  }

  /** The trend at `t` (s) with the temperature `c` (°C); null while there is too little history. */
  update(t: number, c: number | null): TempTrend | null {
    if (!Number.isFinite(t) || c === null) return null
    const s = this.samples
    const last = s[s.length - 1]
    if (last !== undefined && t < last.t) this.reset()
    const newest = s[s.length - 1]
    if (newest === undefined || t - newest.t >= CONDITIONS.trendSampleS) s.push({ t, c })
    // Keep one sample at or before the start of the window: the comparison spans all of it.
    while (s.length > 1 && (s[1]?.t ?? t) <= t - CONDITIONS.trendWindowS) s.shift()
    const oldest = s[0]
    if (oldest === undefined || t - oldest.t < CONDITIONS.trendMinSpanS) return null
    const ratePerMin = ((c - oldest.c) / (t - oldest.t)) * 60
    const on = CONDITIONS.trendOnCPerMin
    const off = CONDITIONS.trendOffCPerMin
    if (this.trend === 'up' && ratePerMin < off) this.trend = 'steady'
    if (this.trend === 'down' && ratePerMin > -off) this.trend = 'steady'
    if (this.trend === 'steady') {
      if (ratePerMin >= on) this.trend = 'up'
      else if (ratePerMin <= -on) this.trend = 'down'
    }
    return this.trend
  }
}

/** One per telemetry loop. compute() runs at the widget rate; reset() on a reconnect or a new session. */
export class ConditionsProvider {
  private readonly trend = new TempTrendTracker()

  reset(): void {
    this.trend.reset()
  }

  compute(frame: TelemetryFrame, session: SessionMeta): ConditionsData {
    const trackTempC = tempC(frame.TrackTempCrew[0])
    const airTempC = tempC(frame.AirTemp[0])
    const windMs = frame.WindVel[0]
    const windKmh = isFiniteNumber(windMs) && windMs >= 0 ? Math.round(windMs * MS_TO_KMH) : null

    // Relative to the car only while you drive it (YawNorth is yours), and only with real wind.
    let windFromDeg: number | null = null
    if (frame.IsOnTrack[0] === true && isFiniteNumber(windMs) && windMs >= CONDITIONS.calmMs) {
      const rel = windFromRelDeg(frame.WindDir[0], frame.YawNorth[0])
      if (rel !== null) windFromDeg = stepDeg(rel, CONDITIONS.windStepDeg)
    }

    const wetness = wetnessLevel(frame.TrackWetness[0])
    const precipPct = precipitationPct(frame.Precipitation[0])
    const skies = skiesOf(frame.Skies[0])
    const num = frame.SessionNum[0]
    const rubberState = num === undefined ? '' : (session.sessions.get(num)?.rubberState ?? '')

    return {
      visible:
        trackTempC !== null ||
        airTempC !== null ||
        windKmh !== null ||
        wetness !== null ||
        precipPct !== null ||
        skies !== null,
      trackTempC,
      trackTempTrend: this.trend.update(finiteOr(frame.SessionTime[0], Number.NaN), trackTempC),
      airTempC,
      windKmh,
      windFromDeg,
      wetness,
      precipPct,
      declaredWet: frame.WeatherDeclaredWet[0] === true,
      skies,
      rubberState
    }
  }
}

/** Structural equality of two payloads (for SKIP_EMIT). */
export function conditionsEqual(a: ConditionsData, b: ConditionsData): boolean {
  return (
    a.visible === b.visible &&
    a.trackTempC === b.trackTempC &&
    a.trackTempTrend === b.trackTempTrend &&
    a.airTempC === b.airTempC &&
    a.windKmh === b.windKmh &&
    a.windFromDeg === b.windFromDeg &&
    a.wetness === b.wetness &&
    a.precipPct === b.precipPct &&
    a.declaredWet === b.declaredWet &&
    a.skies === b.skies &&
    a.rubberState === b.rubberState
  )
}
