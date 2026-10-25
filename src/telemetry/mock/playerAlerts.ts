/**
 * The player's own alerts in every mock session, so each case of the alerts widget shows up at
 * least once: the furled black flag, the water slowly running hot (the trend against your own
 * average), the water and oil temperature lights, the oil and fuel pressure lights, a stall, a
 * stretch the wrong way and a tow. The pit limiter reminder and the laps to go come from the race
 * itself (race.ts: the pit lead-in surface; the RaceModel: the laps left).
 *
 * All of it happens between minute 15 and minute 22 (MOCK_ALERTS_TIMELINE): after the stretches
 * the other mock tests read (the first ten minutes end to end, 15 minutes of MockRace) and before
 * the late join of the end-to-end run. Only the player's own variables change (its
 * CarIdxSessionFlags and EngineWarnings bits, the tow, the temperatures and LapDistPct), never its
 * motion: the wrong way is LapDistPct alone running backwards, so the timing, the scripted cars
 * and the other widgets see the same race as without it. Deterministic: the race's state only.
 */
import { EngineWarning, SessionFlag } from '@shared/flags'
import { isValidPct } from '@shared/lapDist'
import { frac } from '@shared/num'
import type { MockVars } from './frameBuffer'
import { smooth01 } from './math'
import { TRACK_LENGTH_M } from './track'

type Span = readonly [atS: number, forS: number]

export interface MockAlertsTimeline {
  /** The furled black flag on the player (seconds since the session started, how long). */
  readonly furled: Span
  /** The water rises by riseC over rampS, stays there holdS, then cools down as fast. */
  readonly waterTrend: {
    readonly atS: number
    readonly rampS: number
    readonly holdS: number
    readonly riseC: number
  }
  /** Warning lights, with their temperature for the two temperature lights. */
  readonly waterLight: Span
  readonly oilTempLight: Span
  readonly oilPressureLight: Span
  readonly fuelPressureLight: Span
  readonly stall: Span
  /** From atS, the first moment mid-lap: LapDistPct runs back at speedMs for forS. */
  readonly wrongWay: { readonly atS: number; readonly forS: number; readonly speedMs: number }
  /** A tow of forS seconds. */
  readonly tow: Span
}

export const MOCK_ALERTS_TIMELINE: MockAlertsTimeline = {
  furled: [905, 10],
  waterTrend: { atS: 940, rampS: 20, holdS: 60, riseC: 8 },
  waterLight: [1060, 12],
  oilTempLight: [1066, 12],
  oilPressureLight: [1084, 6],
  fuelPressureLight: [1094, 6],
  stall: [1130, 6],
  wrongWay: { atS: 1170, forS: 6, speedMs: 12 },
  tow: [1220, 40]
}

/** Normal readings (°C), each with a slow wobble of a few tenths. */
export const MOCK_WATER_C = 88
export const MOCK_OIL_C = 102
/** With the warning light on. */
const WATER_LIGHT_C = 116
const OIL_LIGHT_C = 128
/** The wrong way starts this far from the S/F line at least (lap fraction): never across it. */
const WRONG_WAY_MID = 0.25

const inSpan = (t: number, [atS, forS]: Span): boolean => t >= atS && t < atS + forS

/** 0 -> 1 over rampS, 1 for holdS, back to 0 over rampS (smoothly). */
function bump(t: number, atS: number, rampS: number, holdS: number): number {
  const s = t - atS
  if (s <= 0 || s >= 2 * rampS + holdS) return 0
  if (s < rampS) return smooth01(s / rampS)
  if (s <= rampS + holdS) return 1
  return smooth01((2 * rampS + holdS - s) / rampS)
}

/** One per MockRace: writes the player's alert variables after each step. */
export class MockPlayerAlerts {
  private readonly tl: MockAlertsTimeline
  /** Seconds since the start when the wrong way began (NaN: not yet), and the fraction then. */
  private wrongFromS = Number.NaN
  private wrongPct = Number.NaN

  constructor(timeline: MockAlertsTimeline = MOCK_ALERTS_TIMELINE) {
    this.tl = timeline
  }

  /** `elapsedS`: seconds since the session started; the race wrote everything else already. */
  apply(v: MockVars, elapsedS: number, playerIdx: number): void {
    const tl = this.tl
    const t = elapsedS
    const pct = v.CarIdxLapDistPct[playerIdx] ?? -1
    v.LapDistPct[0] = this.lapDistPct(pct, t)

    const trend = tl.waterTrend
    const waterLight = inSpan(t, tl.waterLight)
    const oilLight = inSpan(t, tl.oilTempLight)
    v.WaterTemp[0] = waterLight
      ? WATER_LIGHT_C
      : MOCK_WATER_C +
        0.4 * Math.sin(t / 15.4) +
        trend.riseC * bump(t, trend.atS, trend.rampS, trend.holdS)
    v.OilTemp[0] = oilLight ? OIL_LIGHT_C : MOCK_OIL_C + 0.5 * Math.sin(t / 20.9)

    let bits = 0
    if (waterLight) bits |= EngineWarning.WaterTemp
    if (oilLight) bits |= EngineWarning.OilTemp
    if (inSpan(t, tl.oilPressureLight)) bits |= EngineWarning.OilPressure
    if (inSpan(t, tl.fuelPressureLight)) bits |= EngineWarning.FuelPressure
    if (inSpan(t, tl.stall)) bits |= EngineWarning.Stalled
    v.EngineWarnings[0] = (v.EngineWarnings[0] ?? 0) | bits

    if (inSpan(t, tl.furled)) {
      v.CarIdxSessionFlags[playerIdx] = (v.CarIdxSessionFlags[playerIdx] ?? 0) | SessionFlag.Furled
    }
    const [towAt, towFor] = tl.tow
    v.PlayerCarTowTime[0] = inSpan(t, tl.tow) ? towAt + towFor - t : 0
  }

  /** The player's lap fraction, running backwards during the wrong-way stretch. */
  private lapDistPct(pct: number, t: number): number {
    const w = this.tl.wrongWay
    if (Number.isNaN(this.wrongFromS) && t >= w.atS && isValidPct(pct)) {
      if (pct > WRONG_WAY_MID && pct < 1 - WRONG_WAY_MID) {
        this.wrongFromS = t
        this.wrongPct = pct
      }
    }
    const s = t - this.wrongFromS
    if (!(s >= 0 && s < w.forS)) return pct
    return frac(this.wrongPct - (w.speedMs * s) / TRACK_LENGTH_M)
  }
}
