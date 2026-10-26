import { describe, expect, it } from 'vitest'
import { AlertsProvider } from './alerts'
import { EngineWarning } from './flags'
import { LIGHTS, LIGHT_OPTION, LIGHT_ORDER, LIT_LEVEL, LightsProvider, lightsEqual } from './lights'
import { ENGINE, EngineMonitor } from './notices/engine'
import { EMPTY_RACE_VIEW } from './race/emptyRaceView'
import { makeFrame, makeSession } from './race/testing/raceSim'
import type { MutableFrame } from './race/testing/raceSim'
import { createProviders } from './providers'
import { defaultOptions } from './settings'
import { OPTION_SCHEMA } from './settingsSchema'
import { TrackLocation } from './telemetry'
import type { LightKind, LightReading, LightsData, LightsOptions, SessionMeta } from './types'

const OPTS: LightsOptions = {
  ...defaultOptions('lights'),
  showPitLimiter: true,
  showRevLimiter: true
}

/** The player is CarIdx 0 of a 3-car session, driving at 30 m/s. */
class Tick {
  readonly frame: MutableFrame = makeFrame()
  session: SessionMeta = makeSession(3, { driverCarIdleRpm: 900 })
  readonly p = new LightsProvider()
  private n = 0

  constructor() {
    this.frame.Speed[0] = 30
  }

  /** The next 10 Hz tick, observed then computed, as the telemetry loop does. */
  run(o: Partial<LightsOptions> = {}, ticks = 1): LightsData {
    this.n += ticks
    this.frame.SessionTime[0] = (1000 + this.n) / 10
    this.p.observe(this.frame)
    return this.p.compute(this.frame, this.session, EMPTY_RACE_VIEW, { ...OPTS, ...o })
  }

  runFor(seconds: number, o: Partial<LightsOptions> = {}): LightsData {
    let last = this.run(o)
    for (let k = 1; k < Math.round(seconds * 10); k++) last = this.run(o)
    return last
  }

  bits(b: number): this {
    this.frame.EngineWarnings[0] = b
    return this
  }
}

/** kind:level of each light sent. */
const looks = (d: LightsData): string[] => d.lights.map((l) => `${l.kind}:${l.level}`)
const light = (d: LightsData, kind: LightKind): LightReading | undefined =>
  d.lights.find((l) => l.kind === kind)

describe('LIGHT_ORDER and the options', () => {
  it('has every light once, each with its option and its lit level', () => {
    expect(new Set(LIGHT_ORDER).size).toBe(LIGHT_ORDER.length)
    expect(Object.keys(LIGHT_OPTION).sort()).toEqual([...LIGHT_ORDER].sort())
    expect(Object.keys(LIT_LEVEL).sort()).toEqual([...LIGHT_ORDER].sort())
    for (const k of LIGHT_ORDER) expect(OPTION_SCHEMA.lights[LIGHT_OPTION[k]].kind, k).toBe('bool')
  })

  it('colours by severity: red to act now, orange to watch, blue for a state', () => {
    expect(LIT_LEVEL).toEqual({
      oilPressure: 'alarm',
      fuelPressure: 'alarm',
      stalled: 'alarm',
      repair: 'alarm',
      repairOptional: 'warn',
      water: 'warn',
      oilTemp: 'warn',
      pitLimiter: 'info',
      revLimiter: 'info'
    })
  })

  it('is small by default: every engine light, no limiters, no captions or temperatures', () => {
    const d = defaultOptions('lights')
    expect(d).toMatchObject({
      layout: 'row',
      onlyWhenLit: false,
      showCaptions: false,
      showTemps: false,
      showRepairTime: true,
      showTrend: true,
      showPitLimiter: false,
      showRevLimiter: false
    })
    for (const k of LIGHT_ORDER) {
      if (k !== 'pitLimiter' && k !== 'revLimiter') expect(d[LIGHT_OPTION[k]], k).toBe(true)
    }
  })
})

describe('LightsProvider', () => {
  it('a dim dashboard in the car, every light in its place; nothing out of it', () => {
    const k = new Tick()
    const d = k.run()
    expect(d.visible).toBe(true)
    expect(d.lights.map((l) => l.kind)).toEqual([...LIGHT_ORDER])
    expect(d.lights.every((l) => l.level === 'off')).toBe(true)
    k.frame.IsOnTrack[0] = false
    expect(k.run()).toEqual({ visible: false, lights: [] })
  })

  it('lights each one by its severity', () => {
    const k = new Tick()
    const all =
      EngineWarning.OilPressure |
      EngineWarning.FuelPressure |
      EngineWarning.MandatoryRepairs |
      EngineWarning.OptionalRepairs |
      EngineWarning.WaterTemp |
      EngineWarning.OilTemp |
      EngineWarning.PitSpeedLimiter |
      EngineWarning.RevLimiter
    expect(looks(k.bits(all).run())).toEqual([
      'oilPressure:alarm',
      'fuelPressure:alarm',
      'stalled:off',
      'repair:alarm',
      'repairOptional:warn',
      'water:warn',
      'oilTemp:warn',
      'pitLimiter:info',
      'revLimiter:info'
    ])
    // Stalled: the stall lights, the pressures go with the engine.
    const s = new Tick().bits(all | EngineWarning.Stalled)
    expect(looks(s.run()).slice(0, 3)).toEqual([
      'oilPressure:off',
      'fuelPressure:off',
      'stalled:alarm'
    ])
  })

  it('leaves out the lights turned off; only the lit ones, or nothing, with onlyWhenLit', () => {
    const k = new Tick().bits(EngineWarning.WaterTemp)
    expect(k.run({ showWater: false }).lights.map((l) => l.kind)).not.toContain('water')
    const lit = k.run({ onlyWhenLit: true })
    expect(lit).toMatchObject({ visible: true, lights: [{ kind: 'water', level: 'warn' }] })
    // Held a moment (holdS), then gone.
    expect(k.bits(0).run({ onlyWhenLit: true }).visible).toBe(true)
    expect(k.runFor(LIGHTS.holdS, { onlyWhenLit: true })).toEqual({ visible: false, lights: [] })
    const none = Object.fromEntries(LIGHT_ORDER.map((l) => [LIGHT_OPTION[l], false]))
    expect(k.run(none)).toEqual({ visible: false, lights: [] })
  })

  it('the repair time while lit, in whole seconds rounded up, with its option', () => {
    const k = new Tick().bits(EngineWarning.MandatoryRepairs | EngineWarning.OptionalRepairs)
    k.frame.PitRepairLeft[0] = 41.2
    k.frame.PitOptRepairLeft[0] = 38
    const d = k.run()
    expect(light(d, 'repair')).toMatchObject({ level: 'alarm', seconds: 42 })
    expect(light(d, 'repairOptional')).toMatchObject({ level: 'warn', seconds: 38 })
    expect(light(k.run({ showRepairTime: false }), 'repair')?.seconds).toBeNull()
    // iRacing saying 0, or the light off: no time.
    k.frame.PitRepairLeft[0] = 0
    expect(light(k.run(), 'repair')?.seconds).toBeNull()
    k.frame.PitOptRepairLeft[0] = 20
    expect(light(k.bits(0).run(), 'repairOptional')).toMatchObject({ level: 'off', seconds: null })
  })

  it('the temperatures next to their lights, in whole degrees, with showTemps', () => {
    const k = new Tick()
    k.frame.WaterTemp[0] = 88.6
    k.frame.OilTemp[0] = 101.4
    expect(light(k.run(), 'water')?.tempC).toBeNull()
    const d = k.run({ showTemps: true })
    expect([light(d, 'water')?.tempC, light(d, 'oilTemp')?.tempC]).toEqual([89, 101])
    expect(light(d, 'oilPressure')?.tempC).toBeNull()
  })

  it('holds a flickering engine light holdS; not the repairs or the limiters', () => {
    const k = new Tick().bits(EngineWarning.OilPressure | EngineWarning.PitSpeedLimiter)
    k.run()
    k.bits(0)
    expect(looks(k.runFor(LIGHTS.holdS - 0.2))).toContain('oilPressure:alarm')
    expect(looks(k.run())).toContain('pitLimiter:off')
    expect(looks(k.runFor(0.3))).toContain('oilPressure:off')
    // A light held from before the tow says nothing about the engine now.
    k.bits(EngineWarning.OilPressure).run()
    k.bits(0)
    k.frame.PlayerCarTowTime[0] = 20
    expect(looks(k.run())).toContain('oilPressure:off')
    k.frame.PlayerCarTowTime[0] = 0
    k.frame.PlayerTrackSurface[0] = TrackLocation.OnTrack
    expect(looks(k.run())).toContain('oilPressure:off')
  })

  it('quiet like the band: towed, in the box, as you get in the car (the rules are shared)', () => {
    const k = new Tick().bits(EngineWarning.Stalled | EngineWarning.WaterTemp)
    k.frame.IsOnTrack[0] = false
    k.run()
    k.frame.IsOnTrack[0] = true
    expect(looks(k.runFor(ENGINE.inCarSettleS - 0.2))).not.toContain('stalled:alarm')
    expect(looks(k.runFor(0.4))).toContain('stalled:alarm')
    k.frame.PlayerTrackSurface[0] = TrackLocation.InPitStall
    expect(k.run().lights.every((l) => l.level === 'off')).toBe(true)
  })

  it('a gap in the computes drops what was held', () => {
    const k = new Tick().bits(EngineWarning.FuelPressure)
    k.run()
    k.bits(0)
    expect(looks(k.run({}, 20))).toContain('fuelPressure:off')
  })

  it('shares the engine state with the band through createProviders', () => {
    const set = createProviders()
    const f = makeFrame()
    const session = makeSession(3, { driverCarIdleRpm: 900 })
    f.Speed[0] = 30
    f.EngineWarnings[0] = EngineWarning.OilPressure | EngineWarning.WaterTemp
    const config = {
      alerts: defaultOptions('alerts'),
      lights: OPTS,
      fuel: defaultOptions('fuel')
    }
    const ctx = { frame: f, session, race: EMPTY_RACE_VIEW, config, bests: null }
    f.SessionTime[0] = 100
    set.observe?.(f, session, EMPTY_RACE_VIEW)
    const run = set.run as unknown as Record<string, (c: unknown, p: unknown) => unknown>
    const band = run.alerts?.(ctx, null) as { notices: { kind: string }[] }
    const strip = run.lights?.(ctx, null) as LightsData
    expect(band.notices.map((n) => n.kind)).toEqual(['oilPressure'])
    expect(looks(strip).filter((l) => !l.endsWith(':off'))).toEqual([
      'oilPressure:alarm',
      'water:warn'
    ])
  })

  it('reads a shared monitor without feeding it', () => {
    const engine = new EngineMonitor()
    const p = new LightsProvider(engine)
    const a = new AlertsProvider(engine)
    const f = makeFrame()
    const session = makeSession(3)
    f.SessionTime[0] = 100
    f.IsOnTrack[0] = false
    engine.observe(f)
    // In the car: neither provider tells the monitor, so it saw no edge and nothing settles.
    f.IsOnTrack[0] = true
    f.SessionTime[0] = 100.1
    f.EngineWarnings[0] = EngineWarning.Stalled
    p.observe(f)
    a.observe(f, session, EMPTY_RACE_VIEW)
    expect(looks(p.compute(f, session, EMPTY_RACE_VIEW, OPTS))).toContain('stalled:alarm')
  })
})

describe('lightsEqual', () => {
  const base: LightsData = {
    visible: true,
    lights: [
      { kind: 'repair', level: 'alarm', tempC: null, riseC: null, draft: false, seconds: 42 },
      { kind: 'water', level: 'caution', tempC: 98, riseC: 6, draft: true, seconds: null }
    ]
  }

  it('is structural and sees every field', () => {
    expect(lightsEqual(base, structuredClone(base))).toBe(true)
    const water = base.lights[1] as LightReading
    const changed: LightsData[] = [
      { ...base, visible: false },
      { ...base, lights: base.lights.slice(1) },
      ...(
        [
          { level: 'warn' },
          { tempC: 99 },
          { riseC: 7 },
          { draft: false },
          { seconds: 1 },
          { kind: 'oilTemp' }
        ] satisfies Partial<LightReading>[]
      ).map((c) => ({ ...base, lights: [base.lights[0] as LightReading, { ...water, ...c }] }))
    ]
    for (const c of changed) expect(lightsEqual(base, c), JSON.stringify(c)).toBe(false)
  })
})
