import { describe, expect, it } from 'vitest'
import { parseSessionMeta } from '../session'
import { NO_PIT_SPEC, fuelFraction, parsePitSpec, tankLitres } from './spec'

const driverInfo = (
  o: Record<string, unknown> = {},
  me: Record<string, unknown> = {}
): unknown => ({
  DriverCarIdx: 3,
  DriverCarFuelMaxLtr: 110,
  DriverCarMaxFuelPct: 1,
  Drivers: [
    { CarIdx: 1, CarClassMaxFuelPct: '0.500 %', CarClassDryTireSetLimit: '2 %' },
    { CarIdx: 3, CarClassMaxFuelPct: '0.920 %', CarClassDryTireSetLimit: '0 %', ...me }
  ],
  ...o
})

describe('fuelFraction', () => {
  it('reads fractions, the YAML\'s "0.850 %" and percentages', () => {
    expect(fuelFraction(0.85)).toBe(0.85)
    expect(fuelFraction('0.850 %')).toBe(0.85)
    expect(fuelFraction('1.000 %')).toBe(1)
    expect(fuelFraction(92)).toBeCloseTo(0.92)
    expect(fuelFraction('0,9')).toBe(0.9)
  })

  it('rejects anything that is not a share of the tank', () => {
    for (const v of [0, -0.5, 250, 'unlimited', '', null, undefined, {}, Number.NaN]) {
      expect(fuelFraction(v), String(v)).toBeNull()
    }
  })
})

describe('parsePitSpec', () => {
  it('takes the tank, the smaller cap and the limits of your entry', () => {
    expect(parsePitSpec(driverInfo(), { FastRepairsLimit: 1 })).toEqual({
      fuelMaxL: 110,
      maxFuelFrac: 0.92,
      fastRepairsLimit: 1,
      tyreSetLimit: null
    })
    expect(
      parsePitSpec(driverInfo({ DriverCarMaxFuelPct: 0.8 }, { CarClassDryTireSetLimit: '4 %' }), {
        FastRepairsLimit: 'unlimited'
      })
    ).toEqual({ fuelMaxL: 110, maxFuelFrac: 0.8, fastRepairsLimit: null, tyreSetLimit: 4 })
  })

  it('reads no fast repairs allowed as a limit of 0', () => {
    expect(parsePitSpec(driverInfo(), { FastRepairsLimit: 0 }).fastRepairsLimit).toBe(0)
    expect(parsePitSpec(driverInfo(), { FastRepairsLimit: '2' }).fastRepairsLimit).toBe(2)
  })

  it('knows nothing of a missing or broken YAML', () => {
    for (const raw of [null, undefined, 42, 'x', [], {}]) {
      expect(parsePitSpec(raw, raw)).toEqual(NO_PIT_SPEC)
    }
    expect(
      parsePitSpec(
        driverInfo({ DriverCarFuelMaxLtr: -1, DriverCarMaxFuelPct: 'x', DriverCarIdx: 9 }),
        {}
      )
    ).toEqual(NO_PIT_SPEC)
  })

  it('is part of the session meta', () => {
    const meta = parseSessionMeta({
      DriverInfo: driverInfo(),
      WeekendInfo: { WeekendOptions: { FastRepairsLimit: 1 } }
    })
    expect(meta.pitSpec).toMatchObject({ fuelMaxL: 110, maxFuelFrac: 0.92, fastRepairsLimit: 1 })
    expect(parseSessionMeta(null).pitSpec).toEqual(NO_PIT_SPEC)
  })
})

describe('tankLitres', () => {
  it('is the tank times its cap', () => {
    expect(tankLitres(parsePitSpec(driverInfo(), {}), 50, 0.5)).toBeCloseTo(101.2)
  })

  it('works the tank out of FuelLevelPct without the YAML', () => {
    expect(tankLitres(undefined, 30, 0.25)).toBe(120)
    expect(tankLitres({ ...NO_PIT_SPEC, maxFuelFrac: 0.5 }, 30, 0.25)).toBe(60)
  })

  it('is unknown when neither says', () => {
    expect(tankLitres(undefined, 30, 0.01)).toBeNull()
    expect(tankLitres(undefined, null, 0.5)).toBeNull()
    expect(tankLitres(NO_PIT_SPEC, 30, undefined)).toBeNull()
  })
})
