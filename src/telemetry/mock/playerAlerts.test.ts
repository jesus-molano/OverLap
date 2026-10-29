/**
 * The player's alerts of the mock: the scripted variables themselves, then a whole session through
 * the real RaceModel, AlertsProvider and LightsProvider sharing one EngineMonitor (default
 * options, the limiters on), so every case of the alerts widget and of the warning lights is
 * known to show up in mock mode, and none in the stretches the other mock tests read.
 */
import { describe, expect, it } from 'vitest'
import { AlertsProvider } from '@shared/alerts'
import { EngineWarning, SessionFlag } from '@shared/flags'
import { wrapPctDelta } from '@shared/lapDist'
import { LightsProvider } from '@shared/lights'
import { EngineMonitor } from '@shared/notices/engine'
import { RaceModel } from '@shared/race/raceModel'
import { parseSessionMeta } from '@shared/session'
import { defaultOptions } from '@shared/settings'
import type { AlertsData, LightsData, NoticeKind } from '@shared/types'
import { MockFrameBuffer } from './frameBuffer'
import {
  MOCK_ALERTS_TIMELINE,
  MOCK_IDLE_RPM,
  MOCK_OPT_REPAIR_S,
  MOCK_REPAIR_S,
  MOCK_WATER_C,
  MockPlayerAlerts
} from './playerAlerts'
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
    // Damage: optional repairs first, mandatory ones a second later.
    const [dmgAt, dmgFor] = TL.damage
    const repairs = EngineWarning.OptionalRepairs | EngineWarning.MandatoryRepairs
    expect(bits(dmgAt - 0.1) & repairs).toBe(0)
    expect(bits(dmgAt + 0.5) & repairs).toBe(EngineWarning.OptionalRepairs)
    expect(bits(dmgAt + 1.5) & repairs).toBe(repairs)
    expect(bits(dmgAt + dmgFor) & repairs).toBe(0)
    // With the time each takes, while they are on.
    const times = (t: number): number[] => {
      const v = varsAt(a, t)
      return [at(v.PitRepairLeft, 0), at(v.PitOptRepairLeft, 0)]
    }
    expect(times(dmgAt - 0.1)).toEqual([0, 0])
    expect(times(dmgAt + 0.5)).toEqual([0, MOCK_OPT_REPAIR_S])
    expect(times(dmgAt + 1.5)).toEqual([MOCK_REPAIR_S, MOCK_OPT_REPAIR_S])
    expect(times(dmgAt + dmgFor)).toEqual([0, 0])
  })

  it('revs: the idle stopped, more with speed, none while stalled', () => {
    const a = new MockPlayerAlerts()
    const rpm = (t: number, speedMs: number): number => {
      const v = new MockFrameBuffer().vars
      v.CarIdxLapDistPct[P] = 0.5
      v.Speed[0] = speedMs
      a.apply(v, t, P)
      return at(v.RPM, 0)
    }
    expect(rpm(100, 0)).toBe(MOCK_IDLE_RPM)
    expect(rpm(100, 40)).toBeGreaterThan(MOCK_IDLE_RPM)
    expect(rpm(TL.stall[0] + 1, 40)).toBe(0)
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
  readonly payloads: { t: number; d: AlertsData; l: LightsData }[]
}

let cache: Seen | null = null

/** The first session at 10 Hz (the widget's rate) through the RaceModel and the provider. */
function session(): Seen {
  if (cache) return cache
  const series = new MockSeries()
  const start = series.sessionTime
  const meta = parseSessionMeta(series.sessionInfo())
  const model = new RaceModel()
  const engine = new EngineMonitor()
  const alerts = new AlertsProvider(engine)
  const lights = new LightsProvider(engine)
  const opts = defaultOptions('alerts')
  // Every light, the limiters too.
  const lightOpts = {
    ...defaultOptions('lights'),
    icons: defaultOptions('lights').icons.map((e) => ({ ...e, visible: true }))
  }
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
    engine.observe(f)
    alerts.observe(f, meta, model.view)
    const d = alerts.compute(f, meta, model.view, opts)
    const l = lights.compute(f, meta, model.view, lightOpts)
    const t = series.sessionTime - start
    seen.payloads.push({ t, d, l })
    for (const n of d.notices) {
      mark(n.kind, t)
      if (n.kind === 'lapsToGo') mark(`lapsToGo${n.laps}`, t)
    }
    for (const light of l.lights) {
      if (light.level === 'off') continue
      mark(`light:${light.kind}:${light.level}`, t)
      if (light.seconds !== null) mark(`light:${light.kind}:${light.seconds}s`, t)
      if (light.draft) mark('draft', t)
    }
    for (const flag of d.flags) mark(flag, t)
    if (d.pitLimiter) mark(`limiter:${d.pitLimiter}`, t)
  }
  cache = seen
  return seen
}

const first = (key: string): number => session().at.get(key)?.[0] ?? Number.NaN

describe('a mock session through the alerts and warning lights providers', () => {
  it('shows every alert the band has and every look of the lights, once each at least', () => {
    const notices: NoticeKind[] = [
      'wrongWay',
      'pitEntry',
      'stalled',
      'oilPressure',
      'tow',
      'damage',
      'lapsToGo'
    ]
    for (const k of notices) expect(session().at.has(k), k).toBe(true)
    for (const k of ['lapsToGo10', 'lapsToGo5', 'draft', 'furled']) {
      expect(session().at.has(k), k).toBe(true)
    }
    for (const k of [
      'oilPressure:alarm',
      'fuelPressure:alarm',
      'stalled:alarm',
      'repair:alarm',
      `repair:${MOCK_REPAIR_S}s`,
      'repairOptional:warn',
      `repairOptional:${MOCK_OPT_REPAIR_S}s`,
      'water:warn',
      'water:caution',
      'oilTemp:warn',
      'pitLimiter:info'
    ]) {
      expect(session().at.has(`light:${k}`), k).toBe(true)
    }
    for (const s of ['off', 'offSpeeding', 'speeding', 'on']) {
      expect(session().at.has(`limiter:${s}`), s).toBe(true)
    }
  }, 30_000)

  it('at the scripted times, between minute 15 and 22', () => {
    expect(first('furled')).toBeCloseTo(TL.furled[0], 0)
    expect(first('stalled')).toBeCloseTo(TL.stall[0], 0)
    expect(first('tow')).toBeCloseTo(TL.tow[0], 0)
    expect(first('light:water:warn')).toBeCloseTo(TL.waterLight[0], 0)
    expect(first('light:fuelPressure:alarm')).toBeCloseTo(TL.fuelPressureLight[0], 0)
    expect(first('light:stalled:alarm')).toBeCloseTo(TL.stall[0], 0)
    // Optional repairs first (the lights only), the mandatory ones a second later (the band too).
    expect(first('light:repairOptional:warn')).toBeCloseTo(TL.damage[0], 0)
    expect(first('light:repair:alarm')).toBeCloseTo(TL.damage[0] + 1, 0)
    expect(first('damage')).toBeCloseTo(TL.damage[0] + 1, 0)
    // The water rise: yellow once it held 20 s, well before its warning light.
    expect(first('light:water:caution')).toBeGreaterThan(TL.waterTrend.atS + 20)
    expect(first('light:water:caution')).toBeLessThan(TL.waterTrend.atS + 60)
    expect(first('wrongWay')).toBeGreaterThan(TL.wrongWay.atS)
    expect(first('wrongWay')).toBeLessThan(TL.wrongWay.atS + 160)
    // Nothing new in the first ten minutes (the end-to-end run reads them).
    for (const { t, d, l } of session().payloads) {
      if (t > 600) break
      expect(d.notices, `t=${t}`).toEqual([])
      const lit = l.lights.filter((x) => x.level !== 'off' && x.kind !== 'pitLimiter')
      expect(lit, `t=${t}`).toEqual([])
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
