import { describe, expect, it } from 'vitest'
import { makeFrame, makeSession, type MutableFrame } from '../race/testing/raceSim'
import type { RaceView } from '../race/raceView'
import { createDefaultSettings } from '../settings'
import type { FuelOptions, PitSpec, TyreReading } from '../types'
import { computeFuel, consumption, fuelAlertInput, fuelEqual } from './provider'
import type { FuelSamples, FuelTracker, LapStart } from './tracker'

const OPTS: FuelOptions = createDefaultSettings().fuel
const SPEC: PitSpec = { fuelMaxL: 100, maxFuelFrac: 0.85, fastRepairsLimit: 1, tyreSetLimit: 4 }

function tracker(
  laps: readonly number[],
  o: {
    carried?: boolean
    last?: number | null
    tyres?: TyreReading | null
    start?: LapStart | null
  } = {}
): FuelTracker {
  const samples: FuelSamples = { laps, carried: o.carried ?? false }
  return {
    samples,
    lastLapL: o.last ?? null,
    tyres: o.tyres ?? null,
    lapStart: o.start ?? null
  } as unknown as FuelTracker
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

describe('the plan through a lap', () => {
  // Lap 20 of a race to 35 (distance 19.5, 16 laps to go) at 3 L a lap. It started at the line
  // with 6.06 L: to distance 21.02, so the end of lap 21 is the last stop. Half a lap later the
  // first half burnt 1.61 L instead of 1.5 (full throttle first, braking later): 4.45 L now.
  const start: LapStart = { lap: 19, fuelL: 6.06 }
  const now = frame({ FuelLevel: 4.45 })

  it('plans from the fuel the lap started with, so the window holds still', () => {
    const d = computeFuel(now, session, race(19.5, 16), tracker([3], { start }), OPTS)
    expect(d.finish?.window).toEqual({ from: 20, to: 21 })
    // The fuel of the moment is still what the hero line reads.
    expect(d).toMatchObject({ fuelL: 4.5, lapsOfFuel: 1.5 })
    // The fuel of the moment alone would reach only 20.98 and close the window on this lap.
    const live = computeFuel(now, session, race(19.5, 16), tracker([3]), OPTS)
    expect(live.finish?.window).toEqual({ from: 20, to: 20 })
  })

  it('does not call you in a lap early on an uneven half lap', () => {
    const steady = fuelAlertInput(now, session, race(19.5, 16), tracker([3], { start }), OPTS)
    expect(steady).toMatchObject({ short: true, closesThisLap: false })
    const live = fuelAlertInput(now, session, race(19.5, 16), tracker([3]), OPTS)
    expect(live).toMatchObject({ closesThisLap: true })
  })

  it('uses the fuel of the moment when the start is another lap', () => {
    const stale = tracker([3], { start: { lap: 18, fuelL: 9.06 } })
    expect(computeFuel(now, session, race(19.5, 16), stale, OPTS).finish?.window?.to).toBe(20)
  })
})

describe('in a replay', () => {
  it('shows nothing: the car on camera is not the fuel you have', () => {
    const replay = frame({ IsReplayPlaying: true })
    expect(computeFuel(replay, session, race(10.5, 15), tracker([3]), OPTS).visible).toBe(false)
    expect(fuelAlertInput(replay, session, race(10.5, 15), tracker([3]), OPTS)).toBeNull()
  })
})

describe('fuelAlertInput', () => {
  it('says when the window closes on the lap in progress', () => {
    // 30 L at 3 L from distance 19.5 reach the end of lap 29... in a race to 35 + margin.
    const open = fuelAlertInput(frame(), session, race(19.5, 16), tracker([3]), OPTS)
    expect(open).toEqual({ lapsOfFuel: 10, short: true, closesThisLap: false })
    const closing = fuelAlertInput(
      frame({ FuelLevel: 4 }),
      session,
      race(19.5, 16),
      tracker([3]),
      OPTS
    )
    expect(closing).toMatchObject({ short: true, closesThisLap: true })
    expect(closing?.lapsOfFuel).toBeCloseTo(4 / 3)
    // A practice to the end of its clock: nobody has to stop for that.
    const practice = fuelAlertInput(
      frame({ FuelLevel: 4 }),
      session,
      race(19.5, 16, false),
      tracker([3]),
      OPTS
    )
    expect(practice).toMatchObject({ short: true, closesThisLap: false })
  })

  it('never closes the window on the last lap, nor sounds short when the flag is in reach', () => {
    // Lap 20 of 20 with 3.6 L at 3 L from distance 19.2: the flag (2.4 L) but not the margin.
    const last = fuelAlertInput(
      frame({ FuelLevel: 3.6 }),
      session,
      race(19.2, 1),
      tracker([3]),
      OPTS
    )
    expect(last).toMatchObject({ short: false, closesThisLap: false })
    // Lap 19 of 20 with 6.3 L: the margin's window closes now, but the flag is in reach.
    const before = fuelAlertInput(
      frame({ FuelLevel: 6.3 }),
      session,
      race(18.2, 2),
      tracker([3]),
      OPTS
    )
    expect(before).toMatchObject({ short: false, closesThisLap: true })
  })

  it('knows nothing of the flag without an end, and is not short once you took it', () => {
    expect(fuelAlertInput(frame(), session, race(1, null), tracker([3]), OPTS)?.short).toBeNull()
    expect(fuelAlertInput(frame(), session, race(1, 0), tracker([3]), OPTS)?.short).toBe(false)
    expect(fuelAlertInput(frame(), session, race(1, 5), tracker([]), OPTS)?.lapsOfFuel).toBeNull()
    const none = frame()
    none.FuelLevel.length = 0
    expect(fuelAlertInput(none, session, race(1, 5), tracker([3]), OPTS)).toBeNull()
  })
})
