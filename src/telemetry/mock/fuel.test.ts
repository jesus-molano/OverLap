import { describe, expect, it } from 'vitest'
import { createMemoryStore } from '@shared/delta/references'
import { createProviders, type ProviderContext } from '@shared/providers'
import { RaceModel } from '@shared/race/raceModel'
import { parseSessionMeta } from '@shared/session'
import { createDefaultSettings, toTelemetryConfig } from '@shared/settings'
import type { AlertNotice, FuelData } from '@shared/types'
import { MOCK_FUEL, MOCK_WEAR, MockFuel, burnPerLap, startFuelL } from './fuel'
import { PIT_IN_PCT } from './pitLane'
import { MockRace } from './race'
import { MOCK_TIMELINE } from './scenarios'

describe('mock fuel', () => {
  it('burns about 2.95 L a lap, a little more or less from lap to lap', () => {
    for (let lap = 0; lap < 40; lap++) {
      const b = burnPerLap(lap)
      expect(Math.abs(b / MOCK_FUEL.perLapL - 1)).toBeLessThanOrEqual(MOCK_FUEL.lapSpread)
    }
    expect(burnPerLap(3.2)).toBe(burnPerLap(3.9))
  })

  it('starts with what reaches the pit entry of the stop and a little more', () => {
    // Armed at 12.5 laps in, mid-lap: the entry of that same lap.
    const l = startFuelL(14.93, 138.69, 1740)
    const toEntry = 27 + PIT_IN_PCT - 14.93
    expect(l / MOCK_FUEL.perLapL).toBeGreaterThan(toEntry + 0.4)
    expect(l / MOCK_FUEL.perLapL).toBeLessThan(toEntry + 0.7)
  })

  it('refuels the pit menu in the stall, never past the cap', () => {
    const f = new MockFuel(84)
    for (let k = 0; k < 300; k++)
      f.step(0.1, { fromDist: 1, toDist: 1, caution: false, onPitRoad: true, stallS: k / 10 })
    expect(f.litres).toBeCloseTo(MOCK_FUEL.tankL * MOCK_FUEL.maxFuelFrac)
    const g = new MockFuel(10)
    for (let k = 0; k < 300; k++)
      g.step(0.1, { fromDist: 1, toDist: 1, caution: false, onPitRoad: true, stallS: k / 10 })
    expect(g.litres).toBeCloseTo(10 + MOCK_FUEL.boxL)
  })

  it('burns less under the caution and in the pit lane', () => {
    const lap = (o: { caution?: boolean; onPitRoad?: boolean }): number => {
      const f = new MockFuel(50)
      f.step(1, { fromDist: 4, toDist: 5, caution: false, onPitRoad: false, stallS: -1, ...o })
      return 50 - f.litres
    }
    expect(lap({})).toBeCloseTo(burnPerLap(4))
    expect(lap({ caution: true })).toBeCloseTo(burnPerLap(4) * MOCK_FUEL.cautionBurn)
    expect(lap({ onPitRoad: true })).toBeCloseTo(burnPerLap(4) * MOCK_FUEL.pitLaneBurn)
  })

  it('describes the tank and the limits in the session YAML', () => {
    expect(parseSessionMeta(new MockRace().sessionInfo()).pitSpec).toEqual({
      fuelMaxL: 100,
      maxFuelFrac: 0.85,
      fastRepairsLimit: 1,
      tyreSetLimit: 4
    })
  })
})

describe('mock fuel through a session, with the real providers', () => {
  const race = new MockRace()
  const session = parseSessionMeta(race.sessionInfo())
  const model = new RaceModel()
  const providers = createProviders()
  const config = toTelemetryConfig(createDefaultSettings())
  const bests = createMemoryStore()
  const HZ = 10

  interface Sample {
    t: number
    d: number
    fuel: number
    stall: boolean
    pit: boolean
    wear: number
    sets: number
    payload: FuelData
    notices: readonly AlertNotice[]
  }
  const samples: Sample[] = []
  for (let k = 1; !race.done && k < 3000 * HZ; k++) {
    race.step(1 / HZ)
    const frame = race.frame()
    model.update(frame, session)
    providers.observe?.(frame, session, model.view)
    if (k % (HZ / 2) !== 0) continue
    const ctx: ProviderContext = { frame, session, config, race: model.view, bests }
    const me = model.view.car(model.view.playerCarIdx)
    samples.push({
      t: k / HZ,
      d: me?.distance ?? Number.NaN,
      fuel: frame.FuelLevel[0] ?? Number.NaN,
      stall: frame.PlayerCarInPitStall[0] === true,
      pit: frame.OnPitRoad[0] === true,
      wear: frame.LFwearR[0] ?? Number.NaN,
      sets: frame.TireSetsAvailable[0] ?? Number.NaN,
      payload: providers.run.fuel(ctx, null),
      notices: providers.run.alerts(ctx, null).notices
    })
  }
  const stallAt = samples.findIndex((s) => s.stall)
  let stallEnd = stallAt
  while (samples[stallEnd + 1]?.stall === true) stallEnd++
  const before = samples.slice(0, stallAt)
  const after = samples.slice(stallEnd + 1)
  /** The fuel alerts of the band (the others follow their own timelines). */
  const kinds = (s: Sample): string[] =>
    s.notices.map((n) => n.kind).filter((k) => k === 'fuelLow' || k === 'boxThisLap')

  it('stops once, at the scripted time, never running dry', () => {
    expect(stallAt).toBeGreaterThan(0)
    expect(samples[stallAt]?.t).toBeGreaterThan(MOCK_TIMELINE.playerPitS)
    for (const s of samples) expect(s.fuel).toBeGreaterThan(0.5)
    const lowest = Math.min(...before.map((s) => s.fuel))
    expect(lowest).toBeLessThan(MOCK_FUEL.perLapL)
    // The menu's 20 L went in.
    expect((after[0]?.fuel ?? 0) - lowest).toBeGreaterThan(MOCK_FUEL.boxL - 1)
  })

  it('measures about 2.95 L a lap and plans one stop before it, none after', () => {
    const planned = before.filter((s) => s.payload.finish !== null)
    expect(planned.length).toBeGreaterThan(before.length / 2)
    for (const s of planned) {
      expect(s.payload.avgL).toBeGreaterThan(2.85)
      expect(s.payload.avgL).toBeLessThan(3.05)
      expect(s.payload.finish?.stops).toBe(1)
      expect(s.payload.finish?.fill).toBe(false)
    }
    const add = planned.at(-1)?.payload.finish?.addL ?? 0
    expect(add).toBeGreaterThan(10)
    expect(add).toBeLessThan(MOCK_FUEL.boxL)
    for (const s of after.filter((x) => x.payload.finish !== null)) {
      expect(s.payload.finish?.stops).toBe(0)
    }
  })

  it('warns of the low fuel, then to stop this lap, until pit road', () => {
    const low = before.findIndex((s) => kinds(s).includes('fuelLow'))
    const box = before.findIndex((s) => kinds(s).includes('boxThisLap'))
    expect(low).toBeGreaterThan(0)
    expect(box).toBeGreaterThan(low)
    // The stop alert comes on with the in lap: the lap that ends in the pit lane.
    const pitAt = before.findIndex((s) => s.pit)
    expect(Math.floor(before[box]?.d ?? 0)).toBe(Math.floor(before[pitAt]?.d ?? -1))
    for (const s of before.slice(box, pitAt)) expect(kinds(s)).toContain('boxThisLap')
    for (const s of before.slice(pitAt)) expect(kinds(s)).toEqual([])
    // After the stop, until the flag, nothing.
    const racing = after.filter((s) => s.payload.finish !== null && s.payload.finish.lapsLeft > 0)
    for (const s of racing) expect(kinds(s)).not.toContain('fuelLow')
  })

  it('measures the tyres in the stall and counts the set fitted', () => {
    expect(before.every((s) => s.payload.tyres === null && s.wear === 1)).toBe(true)
    expect(before.at(-1)?.sets).toBe(MOCK_FUEL.tyreSets - 1)
    const reading = after[0]?.payload.tyres
    const worst = (c: keyof typeof MOCK_WEAR): number => Math.round(Math.min(...MOCK_WEAR[c]) * 100)
    expect(reading?.wearPct).toEqual([worst('LF'), worst('RF'), worst('LR'), worst('RR')])
    expect(reading?.lap).toBe(Math.floor(samples[stallAt]?.d ?? 0))
    expect(after[0]?.sets).toBe(MOCK_FUEL.tyreSets - 2)
    expect(after[0]?.payload).toMatchObject({ fastRepairs: 1, tyreSets: 2, boxL: 20, tankL: 85 })
  })
})
