import { describe, expect, it } from 'vitest'
import { parseSessionMeta } from '@shared/session'
import { MockSource } from '../sources/MockSource'
import {
  DEFAULT_MOCK_CAR_STEPS,
  MOCK_CAR_A,
  MOCK_CAR_B,
  MockCarCycle,
  parseMockCarCycle
} from './carCycle'
import { MockSeries } from './series'

function playerCarOf(info: unknown): { carId: number; carName: string } | undefined {
  const meta = parseSessionMeta(info)
  const d = meta.drivers.get(meta.playerCarIdx)
  return d && { carId: d.carId, carName: d.carName }
}

describe('parseMockCarCycle', () => {
  it('reads a period alone as the default script', () => {
    expect(parseMockCarCycle('3000')).toEqual({ periodMs: 3000, steps: DEFAULT_MOCK_CAR_STEPS })
  })

  it('reads a script', () => {
    expect(parseMockCarCycle(' 500;car:67:Mazda MX-5 Cup, yaml,session,fresh,drop:900')).toEqual({
      periodMs: 500,
      steps: [
        { kind: 'car', carId: 67, carName: 'Mazda MX-5 Cup' },
        { kind: 'yaml' },
        { kind: 'session' },
        { kind: 'fresh' },
        { kind: 'drop', ms: 900 }
      ]
    })
  })

  it('is null when missing or not valid', () => {
    for (const raw of [
      undefined,
      '',
      'x',
      '10',
      '3000;',
      '3000;car:0',
      '3000;drop:-1',
      '3000;fly'
    ]) {
      expect(parseMockCarCycle(raw)).toBeNull()
    }
  })
})

describe('MockCarCycle', () => {
  const info = new MockSeries({ seed: 1 }).sessionInfo()

  it('changes the car, the YAML and the subsession on schedule, one step per period', () => {
    const cycle = new MockCarCycle({ periodMs: 1000, steps: DEFAULT_MOCK_CAR_STEPS }, 0)
    expect(cycle.apply(info)).toBe(info)
    const v0 = cycle.version(1)
    cycle.update(999)
    expect(cycle.version(1)).toBe(v0)
    cycle.update(1000)
    expect(playerCarOf(cycle.apply(info))).toEqual(MOCK_CAR_A)
    const v1 = cycle.version(1)
    expect(v1).not.toBe(v0)
    // The YAML again: a new version, the same car.
    cycle.update(2000)
    expect(cycle.version(1)).not.toBe(v1)
    expect(playerCarOf(cycle.apply(info))).toEqual(MOCK_CAR_A)
    // Late: no step skipped.
    cycle.update(4500)
    expect(cycle.steps).toBe(4)
    const patched = cycle.apply(info)
    expect(playerCarOf(patched)).toEqual(MOCK_CAR_B)
    expect(patched.WeekendInfo.SubSessionID).toBe(info.WeekendInfo.SubSessionID + 1000)
    // The other drivers keep their cars.
    const others = patched.DriverInfo.Drivers.filter(
      (d) => d.CarIdx !== info.DriverInfo.DriverCarIdx
    )
    expect(others).toEqual(
      info.DriverInfo.Drivers.filter((d) => others.some((o) => o.CarIdx === d.CarIdx))
    )
  })

  it('closes iRacing for a drop, with nothing changed in the YAML', () => {
    const cycle = new MockCarCycle({ periodMs: 1000, steps: [{ kind: 'drop', ms: 400 }] }, 0)
    const v = cycle.version(1)
    cycle.update(1000)
    expect(cycle.dropped(1000)).toBe(true)
    expect(cycle.dropped(1399)).toBe(true)
    expect(cycle.dropped(1400)).toBe(false)
    expect(cycle.version(1)).toBe(v)
  })

  it('a new series session is a new version too', () => {
    const cycle = new MockCarCycle({ periodMs: 1000, steps: [{ kind: 'yaml' }] }, 0)
    const v = cycle.version(1)
    expect(cycle.version(2)).not.toBe(v)
  })

  it('goes through more fresh cars than seenCars keeps, then round again', () => {
    const cycle = new MockCarCycle({ periodMs: 10, steps: [{ kind: 'fresh' }] }, 0)
    const ids = new Set<number>()
    for (let t = 10; t <= 1200; t += 10) {
      cycle.update(t)
      ids.add(cycle.currentCar?.carId ?? 0)
    }
    expect(ids.size).toBe(60)
  })
})

describe('MockSource with a car cycle', () => {
  it('is closed during a drop and back with the same car after it', async () => {
    let t = 0
    const source = new MockSource({
      seed: 1,
      now: () => t,
      carCycle: {
        periodMs: 1000,
        steps: [
          { kind: 'car', ...MOCK_CAR_B },
          { kind: 'drop', ms: 500 }
        ]
      }
    })
    expect(await source.connect()).toBe(true)
    t = 1000
    expect(source.waitForTick(16)).toBe(true)
    expect(playerCarOf(source.readSessionInfo())).toEqual(MOCK_CAR_B)
    const version = source.sessionInfoVersion()
    t = 2000
    expect(source.waitForTick(16)).toBe(false)
    expect(source.isConnected()).toBe(false)
    t = 2200
    expect(await source.connect()).toBe(false)
    t = 2500
    expect(await source.connect()).toBe(true)
    t = 2517
    expect(source.waitForTick(16)).toBe(true)
    expect(source.sessionInfoVersion()).toBe(version)
    expect(playerCarOf(source.readSessionInfo())).toEqual(MOCK_CAR_B)
  })

  it('has no cycle unless asked', () => {
    expect(new MockSource({ seed: 1 }).carCycle).toBeNull()
  })
})
