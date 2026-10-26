import { describe, expect, it } from 'vitest'
import { makeFrame, makeSession, type MutableFrame } from '../race/testing/raceSim'
import type { RaceView } from '../race/raceView'
import { createDefaultSettings } from '../settings'
import type { FuelOptions, PitSpec, TyreReading } from '../types'
import { computeFuel, consumption, fuelAlertInput, fuelEqual } from './provider'
import type { FuelSamples, FuelTracker } from './tracker'

const OPTS: FuelOptions = createDefaultSettings().fuel
const SPEC: PitSpec = { fuelMaxL: 100, maxFuelFrac: 0.85, fastRepairsLimit: 1, tyreSetLimit: 4 }

function tracker(
  laps: readonly number[],
  o: { carried?: boolean; last?: number | null; tyres?: TyreReading | null } = {}
): FuelTracker {
  const samples: FuelSamples = { laps, carried: o.carried ?? false }
  return { samples, lastLapL: o.last ?? null, tyres: o.tyres ?? null } as unknown as FuelTracker
}

/** You at `distance` with `left` laps to go (RaceView.lapsRemaining). */
function race(distance: number, left: number | null, racing = true): RaceView {
  return {
    playerCarIdx: 0,
    racing,
    car: (i: number) => (i === 0 ? { distance, laps: [] } : undefined),
    lapsRemaining: () => left
  } as unknown as RaceView
}

function frame(o: Partial<Record<keyof MutableFrame, number | boolean>> = {}): MutableFrame {
  const f = makeFrame()
  f.FuelLevel[0] = 30
  f.FuelLevelPct[0] = 0.3
  f.PitSvFuel[0] = 20
  f.PitSvFlags[0] = 0x1f
  f.FastRepairAvailable[0] = 255
  f.TireSetsAvailable[0] = 255
  for (const [k, v] of Object.entries(o)) {
    ;(f[k as keyof MutableFrame] as (number | boolean)[])[0] = v as number | boolean
  }
  return f
}

const session = makeSession(1, { pitSpec: SPEC })

describe('consumption', () => {
  it('averages the last avgLaps clean laps, with the most of them', () => {
    const c = consumption({ laps: [3, 2, 4, 1, 1, 1], carried: false }, 3)
    expect(c).toEqual({ avgL: 3, maxL: 4, samples: 3, carried: false })
    expect(consumption({ laps: [3], carried: true }, 5)).toEqual({
      avgL: 3,
      maxL: 3,
      samples: 1,
      carried: true
    })
    expect(consumption({ laps: [], carried: false }, 5).avgL).toBeNull()
    // The option is clamped like everywhere else (2..10).
    expect(consumption({ laps: [1, 2, 3], carried: false }, 0).samples).toBe(2)
  })
})

describe('computeFuel', () => {
  it('plans to the flag from the measured average', () => {
    const d = computeFuel(
      frame(),
      session,
      race(10.5, 15),
      tracker([3, 3, 3], { last: 3.04 }),
      OPTS
    )
    expect(d).toMatchObject({
      visible: true,
      fuelL: 30,
      tankL: 85,
      lapsOfFuel: 10,
      avgL: 3,
      lastL: 3.04,
      maxL: 3,
      samples: 3,
      carried: false,
      boxL: 20,
      fastRepairs: null,
      tyreSets: null,
      finish: { stops: 1, addL: 15, window: { from: 11, to: 20 } }
    })
  })

  it('has no plan while measuring or without laps left', () => {
    expect(computeFuel(frame(), session, race(10.5, 15), tracker([]), OPTS)).toMatchObject({
      lapsOfFuel: null,
      avgL: null,
      finish: null
    })
    expect(computeFuel(frame(), session, race(10.5, null), tracker([3]), OPTS).finish).toBeNull()
    expect(
      computeFuel(frame(), session, race(Number.NaN, 15), tracker([3]), OPTS).finish
    ).toBeNull()
  })

  it('uses the margin of the options', () => {
    const tight = computeFuel(frame({ FuelLevel: 44 }), session, race(10.5, 15), tracker([3]), {
      ...OPTS,
      marginLaps: 0
    })
    expect(tight.finish?.stops).toBe(0)
    const safe = computeFuel(frame({ FuelLevel: 44 }), session, race(10.5, 15), tracker([3]), OPTS)
    expect(safe.finish?.stops).toBe(1)
  })

  it('reads the pit menu only while its fuel box is ticked', () => {
    const t = tracker([3])
    expect(computeFuel(frame({ PitSvFlags: 0x0f }), session, race(1, 5), t, OPTS).boxL).toBe(0)
    // Bit fields arrive as signed Int32.
    expect(computeFuel(frame({ PitSvFlags: -1 }), session, race(1, 5), t, OPTS).boxL).toBe(20)
    const missing = frame()
    missing.PitSvFuel.length = 0
    expect(computeFuel(missing, session, race(1, 5), t, OPTS).boxL).toBeNull()
  })

  it('counts fast repairs and tyre sets only when the session limits them', () => {
    const t = tracker([3])
    const limited = frame({ FastRepairAvailable: 1, TireSetsAvailable: 3 })
    expect(computeFuel(limited, session, race(1, 5), t, OPTS)).toMatchObject({
      fastRepairs: 1,
      tyreSets: 3
    })
    // Without the variables, the YAML's limits less what was used.
    const yaml = frame({ FastRepairUsed: 1, TireSetsUsed: 1 })
    yaml.FastRepairAvailable.length = 0
    yaml.TireSetsAvailable.length = 0
    expect(computeFuel(yaml, session, race(1, 5), t, OPTS)).toMatchObject({
      fastRepairs: 0,
      tyreSets: 3
    })
    expect(computeFuel(yaml, makeSession(1), race(1, 5), t, OPTS)).toMatchObject({
      fastRepairs: null,
      tyreSets: null
    })
  })

  it('works out the tank from FuelLevelPct without the YAML', () => {
    const d = computeFuel(frame(), makeSession(1), race(1, 5), tracker([3]), OPTS)
    expect(d.tankL).toBe(100)
  })

  it('is hidden without a fuel reading, or out of the car with an empty one', () => {
    const none = frame()
    none.FuelLevel.length = 0
    expect(computeFuel(none, session, race(1, 5), tracker([3]), OPTS).visible).toBe(false)
    const out = frame({ FuelLevel: 0, IsOnTrack: false })
    expect(computeFuel(out, session, race(1, 5), tracker([3]), OPTS).visible).toBe(false)
    const garage = frame({ FuelLevel: 40, IsOnTrack: false })
    expect(computeFuel(garage, session, race(1, 5), tracker([3]), OPTS).visible).toBe(true)
  })

  it('quantises to what is drawn, so an unchanged reading is not re-sent', () => {
    const t = tracker([3])
    const a = computeFuel(frame({ FuelLevel: 30.01 }), session, race(10.5, 15), t, OPTS)
    const b = computeFuel(frame({ FuelLevel: 30.04 }), session, race(10.5, 15), t, OPTS)
    expect(a.fuelL).toBe(30)
    expect(fuelEqual(a, b)).toBe(true)
    const c = computeFuel(frame({ FuelLevel: 29.9 }), session, race(10.5, 15), t, OPTS)
    expect(fuelEqual(a, c)).toBe(false)
  })
})

describe('fuelAlertInput', () => {
  it('says when the window closes on the lap in progress', () => {
    // 30 L at 3 L from distance 19.5 reach the end of lap 29... in a race to 35 + margin.
    const open = fuelAlertInput(frame(), session, race(19.5, 16), tracker([3]), OPTS)
    expect(open).toEqual({ lapsOfFuel: 10, stops: 1, closesThisLap: false })
    const closing = fuelAlertInput(
      frame({ FuelLevel: 4 }),
      session,
      race(19.5, 16),
      tracker([3]),
      OPTS
    )
    expect(closing).toMatchObject({ stops: 1, closesThisLap: true })
    expect(closing?.lapsOfFuel).toBeCloseTo(4 / 3)
    // A practice to the end of its clock: nobody has to stop for that.
    const practice = fuelAlertInput(
      frame({ FuelLevel: 4 }),
      session,
      race(19.5, 16, false),
      tracker([3]),
      OPTS
    )
    expect(practice).toMatchObject({ stops: 1, closesThisLap: false })
  })

  it('has no stops to count without an end, and none once you took the flag', () => {
    expect(fuelAlertInput(frame(), session, race(1, null), tracker([3]), OPTS)?.stops).toBeNull()
    expect(fuelAlertInput(frame(), session, race(1, 0), tracker([3]), OPTS)?.stops).toBe(0)
    expect(fuelAlertInput(frame(), session, race(1, 5), tracker([]), OPTS)?.lapsOfFuel).toBeNull()
    const none = frame()
    none.FuelLevel.length = 0
    expect(fuelAlertInput(none, session, race(1, 5), tracker([3]), OPTS)).toBeNull()
  })
})
