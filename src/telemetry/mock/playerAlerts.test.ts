/**
 * The player's alerts of the mock: the scripted variables themselves, then a whole session through
 * the real RaceModel and AlertsProvider (default options), so every case of the alerts widget is
 * known to show up in mock mode, and none in the stretches the other mock tests read.
 */
import { describe, expect, it } from 'vitest'
import { AlertsProvider } from '@shared/alerts'
import { EngineWarning, SessionFlag } from '@shared/flags'
import { wrapPctDelta } from '@shared/lapDist'
import { RaceModel } from '@shared/race/raceModel'
import { parseSessionMeta } from '@shared/session'
import { defaultOptions } from '@shared/settings'
import type { AlertsData, NoticeKind } from '@shared/types'
import { MockFrameBuffer } from './frameBuffer'
import { MOCK_ALERTS_TIMELINE, MOCK_WATER_C, MockPlayerAlerts } from './playerAlerts'
import { MockSeries } from './series'
import { at } from './testUtils'
import { TRACK_LENGTH_M } from './track'

const TL = MOCK_ALERTS_TIMELINE
const P = 7

/** The player's variables at session second `t`, the race having written its own already. */
function varsAt(alerts: MockPlayerAlerts, t: number, pct = 0.5): MockFrameBuffer['vars'] {
  const v = new MockFrameBuffer().vars
  v.CarIdxLapDistPct[P] = pct
  v.EngineWarnings[0] = EngineWarning.PitSpeedLimiter
  alerts.apply(v, t, P)
  return v
}

describe('MockPlayerAlerts', () => {
  it('lights each warning in its span, keeping the bits the race wrote', () => {
    const a = new MockPlayerAlerts()
    const bits = (t: number): number => at(varsAt(a, t).EngineWarnings, 0)
    const spans: [readonly [number, number], number][] = [
      [TL.waterLight, EngineWarning.WaterTemp],
      [TL.oilTempLight, EngineWarning.OilTemp],
      [TL.oilPressureLight, EngineWarning.OilPressure],
      [TL.fuelPressureLight, EngineWarning.FuelPressure],
      [TL.stall, EngineWarning.Stalled]
    ]
    for (const [[from, len], bit] of spans) {
      expect(bits(from - 0.1) & bit).toBe(0)
      expect(bits(from + len / 2) & bit).toBe(bit)
      expect(bits(from + len) & bit).toBe(0)
    }
    expect(bits(0)).toBe(EngineWarning.PitSpeedLimiter)
  })

  it('reads the temperatures of the lights, and a slow rise for the trend', () => {
    const a = new MockPlayerAlerts()
    const water = (t: number): number => at(varsAt(a, t).WaterTemp, 0)
    expect(water(100)).toBeCloseTo(MOCK_WATER_C, 0)
    const top = TL.waterTrend.atS + TL.waterTrend.rampS + TL.waterTrend.holdS / 2
    expect(water(top) - MOCK_WATER_C).toBeCloseTo(TL.waterTrend.riseC, 0)
    expect(water(TL.waterLight[0] + 1)).toBeGreaterThan(110)
    expect(at(varsAt(a, TL.oilTempLight[0] + 1).OilTemp, 0)).toBeGreaterThan(120)
  })

  it('flies the furled flag on the player only, and counts the tow down', () => {
    const a = new MockPlayerAlerts()
    const v = varsAt(a, TL.furled[0] + 1)
    expect(at(v.CarIdxSessionFlags, P)).toBe(SessionFlag.Furled)
    expect(v.CarIdxSessionFlags.filter((f) => f !== 0)).toHaveLength(1)
    expect(at(varsAt(a, TL.furled[0] - 1).CarIdxSessionFlags, P)).toBe(0)
    const [towAt, towFor] = TL.tow
    expect(at(varsAt(a, towAt + 2).PlayerCarTowTime, 0)).toBeCloseTo(towFor - 2, 6)
    expect(at(varsAt(a, towAt + towFor).PlayerCarTowTime, 0)).toBe(0)
  })

  it('runs LapDistPct backwards once, mid-lap, then follows the car again', () => {
    const a = new MockPlayerAlerts()
    const w = TL.wrongWay
    // Near the S/F line it waits for the middle of the lap.
    expect(at(varsAt(a, w.atS, 0.1).LapDistPct, 0)).toBe(0.1)
    expect(at(varsAt(a, w.atS + 1, 0.4).LapDistPct, 0)).toBe(0.4)
    const back = at(varsAt(a, w.atS + 3, 0.45).LapDistPct, 0)
    expect(wrapPctDelta(back, 0.4) * TRACK_LENGTH_M).toBeCloseTo(-2 * w.speedMs, 6)
    expect(at(varsAt(a, w.atS + 1 + w.forS, 0.6).LapDistPct, 0)).toBe(0.6)
    // Once a session.
    expect(at(varsAt(a, w.atS + 100, 0.5).LapDistPct, 0)).toBe(0.5)
  })
})

interface Seen {
  /** Session seconds of each notice and flag shown, and of each limiter state. */
  readonly at: Map<string, number[]>
  readonly payloads: { t: number; d: AlertsData }[]
}

let cache: Seen | null = null

/** The first session at 10 Hz (the widget's rate) through the RaceModel and the provider. */
function session(): Seen {
  if (cache) return cache
  const series = new MockSeries()
  const start = series.sessionTime
  const meta = parseSessionMeta(series.sessionInfo())
  const model = new RaceModel()
  const alerts = new AlertsProvider()
  const opts = defaultOptions('alerts')
  const seen: Seen = { at: new Map(), payloads: [] }
  const mark = (key: string, t: number): void => {
    const list = seen.at.get(key) ?? []
    list.push(t)
    seen.at.set(key, list)
  }
  while (series.sessionIndex === 0) {
    series.step(0.1)
    if (series.sessionIndex !== 0) break
    const f = series.frame()
    model.update(f, meta)
    const d = alerts.compute(f, meta, model.view, opts)
    const t = series.sessionTime - start
    seen.payloads.push({ t, d })
    for (const n of d.notices) {
      mark(n.kind, t)
      if (n.kind === 'lapsToGo') mark(`lapsToGo${n.laps}`, t)
      if (n.kind === 'engineTrend' && n.draft) mark('draft', t)
    }
    for (const flag of d.flags) mark(flag, t)
    if (d.pitLimiter) mark(`limiter:${d.pitLimiter}`, t)
  }
  cache = seen
  return seen
}

const first = (key: string): number => session().at.get(key)?.[0] ?? Number.NaN

describe('a mock session through the alerts provider', () => {
  it('shows every alert the widget has, once each at least', () => {
    const notices: NoticeKind[] = [
      'wrongWay',
      'pitEntry',
      'stalled',
      'oilPressure',
      'water',
      'oilTemp',
      'fuelPressure',
      'tow',
      'lapsToGo',
      'engineTrend'
    ]
    for (const k of notices) expect(session().at.has(k), k).toBe(true)
    for (const k of ['lapsToGo10', 'lapsToGo5', 'draft', 'furled']) {
      expect(session().at.has(k), k).toBe(true)
    }
    for (const s of ['off', 'offSpeeding', 'speeding', 'on']) {
      expect(session().at.has(`limiter:${s}`), s).toBe(true)
    }
  }, 30_000)

  it('at the scripted times, between minute 15 and 22', () => {
    expect(first('furled')).toBeCloseTo(TL.furled[0], 0)
    expect(first('stalled')).toBeCloseTo(TL.stall[0], 0)
    expect(first('tow')).toBeCloseTo(TL.tow[0], 0)
    expect(first('water')).toBeCloseTo(TL.waterLight[0], 0)
    expect(first('fuelPressure')).toBeCloseTo(TL.fuelPressureLight[0], 0)
    // The water rise: the notice once it held 20 s, well before its warning light.
    expect(first('engineTrend')).toBeGreaterThan(TL.waterTrend.atS + 20)
    expect(first('engineTrend')).toBeLessThan(TL.waterTrend.atS + 60)
    expect(first('wrongWay')).toBeGreaterThan(TL.wrongWay.atS)
    expect(first('wrongWay')).toBeLessThan(TL.wrongWay.atS + 160)
    // Nothing new in the first ten minutes (the end-to-end run reads them).
    for (const { t, d } of session().payloads) {
      if (t > 600) break
      expect(d.notices, `t=${t}`).toEqual([])
    }
  })

  it('reminds of the limiter before the pit entry only, then the limiter line takes over', () => {
    const remind = session().at.get('pitEntry') ?? []
    const offAt = first('limiter:off')
    expect(remind.length).toBeGreaterThan(5)
    // Up to the entry line, and never again after it (the exit has the same surface).
    expect(remind.at(-1) ?? Infinity).toBeLessThan(offAt)
    expect(offAt - (remind.at(-1) ?? 0)).toBeLessThan(0.3)
    // On pit road: OFF, over the limit without it, on but still over, on.
    const states: string[] = []
    for (const { d } of session().payloads) {
      if (d.pitLimiter && d.pitLimiter !== states.at(-1)) states.push(d.pitLimiter)
    }
    expect(states).toEqual(['off', 'offSpeeding', 'speeding', 'on'])
  })

  it('counts 10 and then 5 laps to go, each shown a few seconds once', () => {
    const ten = session().at.get('lapsToGo10') ?? []
    const five = session().at.get('lapsToGo5') ?? []
    expect(ten.length).toBeGreaterThan(30)
    expect(ten.length).toBeLessThan(80)
    expect((ten.at(-1) ?? 0) - (ten[0] ?? 0)).toBeLessThan(7)
    expect(five[0] ?? 0).toBeGreaterThan(ten.at(-1) ?? Infinity)
  })
})
