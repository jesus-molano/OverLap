/**
 * Conditions widget ('Condiciones'): track and air temperature, how the track temperature is
 * moving, the wind against your car, how wet the track is, the rain, the stewards' wet call, the
 * sky and the rubber laid down. iRacing has no forecast, so there is none here. Runs at 1 Hz;
 * readings are quantised to what the widget shows, so SKIP_EMIT drops the ticks where nothing
 * shown changed. The trend's and the wind's history live in one ConditionsProvider per telemetry
 * loop.
 *
 * What a live race confirmed (report Q11):
 * - The wind: WindDir is where the wind blows FROM (258° read as W, as iRacing's own panel) and
 *   YawNorth is the car's heading clockwise from north (YawNorth + Yaw = TrackNorthOffset), so
 *   the wind relative to your nose is WindDir - YawNorth (WIND_CONVENTION). The instant wind
 *   changes almost every second while iRacing's panel shows a steady value: this widget shows
 *   the mean of the last minute (WindAverager).
 * - TrackTempCrew moves in steps of 1 °F, and the first reading of a session can still be the
 *   last session's: the trend waits CONDITIONS.trendSettleS, and the widget shows whole degrees.
 * - SessionTrackRubberState 'carry over' is followed back to the last real state (rubberOf).
 *
 * Still unverified: Precipitation's unit is '%', read as 0..1 like every other '%' variable
 * (Throttle, FuelLevelPct); a value above 1 is taken as already in percent.
 */
import { finiteOr, isFiniteNumber } from './num'
import type { TelemetryFrame } from './telemetry'
import type { ConditionsData, SessionDetails, SessionMeta, TempTrend } from './types'

export const CONDITIONS = {
  /**
   * The trend ignores the first seconds after it (re)starts (s of session time): the race's
   * first TrackTempCrew was the previous session's, 1 °F off, and would have read as a fall.
   */
  trendSettleS: 10,
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
  windStepDeg: 5,
  /**
   * The wind shown is the mean of this much session time (s), steady like iRacing's own panel:
   * with the instant WindVel the shown km/h changed in 30 % of the race's seconds, with this
   * mean in 5 %.
   */
  windMeanS: 60
} as const

/** How WindDir and YawNorth are read (confirmed live: see the top of this file). */
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
  /** Session time of the first reading since the (re)start; null before it. */
  private startT: number | null = null
  private lastT = -Infinity

  reset(): void {
    this.samples.length = 0
    this.trend = 'steady'
    this.startT = null
    this.lastT = -Infinity
  }

  /**
   * The trend at `t` (s) with the temperature `c` (°C); null while there is too little history,
   * which starts CONDITIONS.trendSettleS after the first reading.
   */
  update(t: number, c: number | null): TempTrend | null {
    if (!Number.isFinite(t) || c === null) return null
    if (t < this.lastT) this.reset()
    this.lastT = t
    this.startT ??= t
    if (t - this.startT < CONDITIONS.trendSettleS) return null
    const s = this.samples
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

/** The wind over the last CONDITIONS.windMeanS. */
export interface MeanWind {
  /** Mean speed, m/s. */
  speedMs: number
  /** Where it blows from on average (radians, WindDir's frame); null without a direction. */
  fromRad: number | null
}

/**
 * The wind as iRacing's panel shows it: the mean speed of the last CONDITIONS.windMeanS of
 * session time, and the mean direction (each reading weighted by its speed, so a lull does not
 * swing it). Fed once per compute; the session clock going back starts it over.
 */
export class WindAverager {
  /** Readings of the window: speed (m/s) and the wind as a vector (x east, y north, m/s). */
  private readonly samples: { t: number; v: number; x: number; y: number }[] = []

  reset(): void {
    this.samples.length = 0
  }

  /** The mean at `t` (s) with this reading; null when the speed is unusable (none, negative). */
  update(t: number, speedMs: unknown, fromRad: unknown): MeanWind | null {
    if (!isFiniteNumber(speedMs) || speedMs < 0) return null
    const dir = isFiniteNumber(fromRad)
    // Without a clock nothing can be averaged: this reading alone.
    if (!Number.isFinite(t)) {
      this.reset()
      return { speedMs, fromRad: dir ? fromRad : null }
    }
    const s = this.samples
    const last = s[s.length - 1]
    if (last !== undefined && t < last.t) this.reset()
    s.push({
      t,
      v: speedMs,
      x: dir ? speedMs * Math.sin(fromRad) : 0,
      y: dir ? speedMs * Math.cos(fromRad) : 0
    })
    while (s.length > 1 && (s[0]?.t ?? t) <= t - CONDITIONS.windMeanS) s.shift()
    let v = 0
    let x = 0
    let y = 0
    for (const r of s) {
      v += r.v
      x += r.x
      y += r.y
    }
    return { speedMs: v / s.length, fromRad: x !== 0 || y !== 0 ? Math.atan2(x, y) : null }
  }
}

function isCarryOver(state: string): boolean {
  return state.trim().toLowerCase().includes('carry')
}

/**
 * The rubber state of session `num`: its own, or for a 'carry over' the last real state of an
 * earlier session (`carried`), as iRacing carries the rubber from one session to the next. A
 * 'carry over' with no real state before it stays as it is.
 */
export function rubberOf(
  sessions: ReadonlyMap<number, SessionDetails>,
  num: number | undefined
): { state: string; carried: boolean } {
  const own = num === undefined ? '' : (sessions.get(num)?.rubberState ?? '')
  if (num === undefined || !isCarryOver(own)) return { state: own, carried: false }
  for (let k = num - 1; k >= 0; k--) {
    const state = sessions.get(k)?.rubberState ?? ''
    if (state.trim() !== '' && !isCarryOver(state)) return { state, carried: true }
  }
  return { state: own, carried: false }
}

/** One per telemetry loop. compute() runs at the widget rate; reset() on a reconnect or a new session. */
export class ConditionsProvider {
  private readonly trend = new TempTrendTracker()
  private readonly wind = new WindAverager()

  reset(): void {
    this.trend.reset()
    this.wind.reset()
  }

  compute(frame: TelemetryFrame, session: SessionMeta): ConditionsData {
    const t = finiteOr(frame.SessionTime[0], Number.NaN)
    const trackTempC = tempC(frame.TrackTempCrew[0])
    const airTempC = tempC(frame.AirTemp[0])
    const wind = this.wind.update(t, frame.WindVel[0], frame.WindDir[0])
    const windKmh = wind === null ? null : Math.round(wind.speedMs * MS_TO_KMH)

    // Relative to the car only while you drive it (YawNorth is yours), and only with real wind:
    // the mean direction against the heading now.
    let windFromDeg: number | null = null
    if (frame.IsOnTrack[0] === true && wind !== null && wind.speedMs >= CONDITIONS.calmMs) {
      const rel = windFromRelDeg(wind.fromRad, frame.YawNorth[0])
      if (rel !== null) windFromDeg = stepDeg(rel, CONDITIONS.windStepDeg)
    }

    const wetness = wetnessLevel(frame.TrackWetness[0])
    const precipPct = precipitationPct(frame.Precipitation[0])
    const skies = skiesOf(frame.Skies[0])
    const rubber = rubberOf(session.sessions, frame.SessionNum[0])

    return {
      visible:
        trackTempC !== null ||
        airTempC !== null ||
        windKmh !== null ||
        wetness !== null ||
        precipPct !== null ||
        skies !== null,
      trackTempC,
      trackTempTrend: this.trend.update(t, trackTempC),
      airTempC,
      windKmh,
      windFromDeg,
      wetness,
      precipPct,
      declaredWet: frame.WeatherDeclaredWet[0] === true,
      skies,
      rubberState: rubber.state,
      rubberCarried: rubber.carried
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
    a.rubberState === b.rubberState &&
    a.rubberCarried === b.rubberCarried
  )
}
