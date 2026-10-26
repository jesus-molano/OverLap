import { describe, expect, it } from 'vitest'
import type { FuelFinish } from '../types'
import { fuelStrategy, type StrategyInput } from './strategy'

const plan = (o: Partial<StrategyInput>): ReturnType<typeof fuelStrategy> =>
  fuelStrategy({
    fuelL: 30,
    avgL: 3,
    tankL: 85,
    distance: 10.5,
    lapsRemaining: 15,
    marginLaps: 0.5,
    ...o
  })

/**
 * Hand-worked plans. F is the flag (floor(distance) + lapsRemaining), the window's last lap the
 * last lap end the fuel reaches (F - 1 at most) and its first ceil(F + margin - T/avg - (s - 1)
 * floor(T/avg)) for s stops of a T litre tank.
 */
const CASES: readonly {
  readonly name: string
  readonly input: Partial<StrategyInput>
  readonly want: Partial<FuelFinish>
}[] = [
  {
    // F 25: 14.5 laps and 0.5 of margin at 3 L is 45 L, 15 short; 30 L reach distance 20.5.
    name: 'lap race, one stop: what is missing, from now to the last lap the fuel reaches',
    input: {},
    want: {
      lap: 11,
      lapsLeft: 14.5,
      needL: 45,
      deficitL: 15,
      short: true,
      stops: 1,
      addL: 15,
      fill: false,
      window: { from: 11, to: 20 },
      saveL: null
    }
  },
  {
    // 44 L reach the flag (43.5) but not its margin: a 1 L splash, no later than the end of lap
    // 24 (a stop at the end of lap 25 is after the flag); 44 / 15 = 2.933 L a lap skips it.
    name: 'lap race, a stop for the margin alone: not short, the window ends before the last lap',
    input: { fuelL: 44 },
    want: {
      needL: 45,
      deficitL: 1,
      short: false,
      stops: 1,
      addL: 1,
      window: { from: 11, to: 24 },
      saveL: 2.93
    }
  },
  {
    // F 20, on lap 20: 0.8 laps to go at 3 L is 2.4 L; no stop is left, so no margin either.
    name: 'the last lap, fuel enough for the flag but not the margin: nothing to do',
    input: { fuelL: 3.6, distance: 19.2, lapsRemaining: 1 },
    want: {
      lap: 20,
      lapsLeft: 0.8,
      needL: 2.4,
      deficitL: -1.2,
      short: false,
      stops: 0,
      addL: 0,
      window: null,
      saveL: null
    }
  },
  {
    name: 'the last lap, short of the flag: no stop left to make, it says how short',
    input: { fuelL: 1.8, distance: 19.2, lapsRemaining: 1 },
    want: { needL: 2.4, deficitL: 0.6, short: true, stops: 0, addL: 0, window: null }
  },
  {
    // F 20 from 18.2: 1.8 laps + 0.5 is 6.9 L. 6.3 L reach distance 20.3: the flag, not the
    // margin. The end of lap 19 is the last stop; 6.3 / 2.3 = 2.739 L a lap skips it.
    name: 'the lap before the last: the margin stop closes the window now',
    input: { fuelL: 6.3, distance: 18.2, lapsRemaining: 2 },
    want: {
      lap: 19,
      needL: 6.9,
      deficitL: 0.6,
      short: false,
      stops: 1,
      addL: 0.6,
      window: { from: 19, to: 19 },
      saveL: 2.73
    }
  },
  {
    // Timed race: the leader's pace leaves 23 laps from distance 30.75, F 53. 22.25 + 1 laps at
    // 2.5 L is 58.125 L; 40 L reach 46.75; a 100 L tank lasts 40 laps, from 53 + 1 - 40 = 14.
    name: 'timed race: the laps the leader leaves you',
    input: { fuelL: 40, avgL: 2.5, tankL: 100, distance: 30.75, lapsRemaining: 23, marginLaps: 1 },
    want: {
      lap: 31,
      lapsLeft: 22.3,
      needL: 58.1,
      deficitL: 18.1,
      short: true,
      stops: 1,
      addL: 18.2,
      fill: false,
      window: { from: 31, to: 46 },
      saveL: null
    }
  },
  {
    // 100 laps at 3 L on an 85 L BoP tank (28.33 laps, 28-lap stints): 215 L short, three
    // stops. From x the last stop is at x + 56 at the latest and lasts 28.33: x >= 15.67. A
    // stop at the end of lap 15 would need a fourth. Stopping at 16 with 37 L: room for 48 L.
    name: 'BoP-capped tank, three stops: whole-lap stints open the window on lap 16',
    input: { fuelL: 85, avgL: 3, tankL: 85, distance: 0, lapsRemaining: 100, marginLaps: 0 },
    want: {
      lap: 1,
      needL: 300,
      deficitL: 215,
      short: true,
      stops: 3,
      fill: true,
      addL: 48,
      window: { from: 16, to: 28 },
      saveL: null
    }
  },
  {
    // A 20 L tank at 3 L lasts 6.67 laps, 6-lap stints; 70 L short over 30 laps: four stops,
    // the first at x >= 30 - 6.67 - 18 = 5.33, and the fuel reaches the end of lap 6.
    name: 'small tank, four stops: the window is one lap',
    input: { fuelL: 20, avgL: 3, tankL: 20, distance: 0, lapsRemaining: 30, marginLaps: 0 },
    want: { stops: 4, fill: true, addL: 18, window: { from: 6, to: 6 }, saveL: null }
  },
  {
    // 9 L at 3 L last to distance 3.5 (end of lap 3); a 20 L stop there leaves 7 laps for 6.67.
    name: 'small tank: never a window after the fuel runs out, one more stop instead',
    input: { fuelL: 9, tankL: 20, distance: 0.5, lapsRemaining: 10, marginLaps: 0 },
    want: { stops: 2, window: { from: 1, to: 3 }, fill: true }
  },
  {
    // F 45 + 0.5 from 5.5 at 2 L: 60 L short of a 55 L tank, two stops. One stop does it when
    // the first stint reaches the end of lap 16 and a full tank the 29.5 laps after it:
    // 55 / 29.5 = 1.864 L a lap (1.87 leaves the margin 0.09 laps short).
    name: 'two stops to one: whole-lap stints decide the saving',
    input: { fuelL: 20, avgL: 2, tankL: 55, distance: 5.5, lapsRemaining: 40 },
    want: { stops: 2, fill: true, addL: 36, window: { from: 6, to: 15 }, saveL: 1.86 }
  },
  {
    name: 'without a known tank, a single stop holds what is missing',
    input: { tankL: null },
    want: { stops: 1, addL: 15, fill: false, window: { from: 11, to: 20 } }
  }
]

describe('fuelStrategy', () => {
  it.each(CASES)('$name', ({ input, want }) => {
    expect(plan(input)).toMatchObject(want)
  })

  it('needs no stop when the fuel reaches the flag with the margin', () => {
    // Flag at distance 10 + 15 = 25: 14.5 laps and 0.5 of margin at 3 L.
    expect(plan({ fuelL: 60 })).toEqual({
      lap: 11,
      lapsLeft: 14.5,
      needL: 45,
      deficitL: -15,
      short: false,
      stops: 0,
      addL: 0,
      fill: false,
      window: null,
      saveL: null
    })
  })

  it('counts the margin in what is needed', () => {
    expect(plan({ fuelL: 44, marginLaps: 0 })?.stops).toBe(0)
    expect(plan({ fuelL: 44, marginLaps: 0.5 })).toMatchObject({ stops: 1, addL: 1 })
  })

  it('opens the window when one tank from there reaches the flag', () => {
    // 85 L last 28.3 laps: a stop before distance 21.7 of a 50-lap race leaves too far to go.
    // 80 L last to distance 26.9: the end of lap 26 at the latest.
    const p = plan({ fuelL: 80, distance: 0.2, lapsRemaining: 50, marginLaps: 0 })
    expect(p).toMatchObject({ stops: 1, window: { from: 22, to: 26 }, fill: false })
    // At the end of lap 22 the tank has room for all of it.
    expect(p?.addL).toBe(69.4)
    // Five more laps: no single tank does it, two stops from the first lap.
    const longer = plan({ fuelL: 80, distance: 0.2, lapsRemaining: 55, marginLaps: 0 })
    expect(longer).toMatchObject({ stops: 2, window: { from: 1, to: 26 }, fill: true })
  })

  it('fills the tank at the next stop when more than one is needed', () => {
    // 80 L short with a 40 L tank: two stops would need one at distance 3.67, so three.
    const p = plan({ fuelL: 10, tankL: 40, distance: 0, lapsRemaining: 30, marginLaps: 0 })
    expect(p).toMatchObject({ stops: 3, fill: true, window: { from: 1, to: 3 } })
    // Stopping at the end of lap 1 with 7 L left: room for 33 L.
    expect(p?.addL).toBe(33)
  })

  it('says to stop this lap when the fuel does not reach the end of the next one', () => {
    // 1 L at 3 L per lap from distance 7.5: the end of lap 8 is out of reach already.
    expect(plan({ fuelL: 1, distance: 7.5, lapsRemaining: 5, tankL: 50 })).toMatchObject({
      lap: 8,
      stops: 1,
      window: { from: 8, to: 8 }
    })
  })

  it('offers the saving that skips a stop only within 10 %', () => {
    // 40 L over 14.5 laps: 2.758 L a lap instead of 3 (8 % less) and no stop.
    expect(plan({ fuelL: 40, distance: 0.5, lapsRemaining: 15, marginLaps: 0 })).toMatchObject({
      stops: 1,
      saveL: 2.75
    })
    // A third less is not a saving anyone drives.
    expect(plan({ fuelL: 30 })?.saveL).toBeNull()
  })

  it('needs nothing once you took the flag', () => {
    expect(plan({ fuelL: 6.04, lapsRemaining: 0 })).toEqual({
      lap: 11,
      lapsLeft: 0,
      needL: 0,
      deficitL: -6,
      short: false,
      stops: 0,
      addL: 0,
      fill: false,
      window: null,
      saveL: null
    })
  })

  it('says nothing without an average or a position', () => {
    expect(plan({ avgL: 0 })).toBeNull()
    expect(plan({ avgL: Number.NaN })).toBeNull()
    expect(plan({ distance: Number.NaN })).toBeNull()
    expect(plan({ fuelL: Number.POSITIVE_INFINITY })).toBeNull()
    expect(plan({ lapsRemaining: Number.NaN })).toBeNull()
  })

  it('rounds what to add up, so the menu never falls a little short', () => {
    expect(plan({ fuelL: 29.96 })?.addL).toBe(15.1)
    expect(plan({ fuelL: 30.04 })?.addL).toBe(15)
  })
})

/**
 * Drives a plan: the first stop at the end of lap `first`, the others as late as the tank
 * allows (whole laps), each filling the tank. The distance the fuel reaches after the last.
 */
function driven(i: StrategyInput, tank: number, first: number, stops: number): number {
  if (i.fuelL - (first - i.distance) * i.avgL < -1e-5) return Number.NEGATIVE_INFINITY
  const stint = Math.floor(tank / i.avgL + 1e-9)
  return first + (stops - 1) * stint + tank / i.avgL
}

describe('fuelStrategy over a grid of races', () => {
  const inputs: StrategyInput[] = []
  for (const avgL of [2.2, 3, 3.7])
    for (const tankL of [18, 55, 85, 110])
      for (const fuelL of [5, 20, 47, 85])
        for (const distance of [0.3, 7.9, 25.5])
          for (const lapsRemaining of [3, 12, 40, 75])
            for (const marginLaps of [0, 0.5, 1.5]) {
              // A full tank at most, and enough to finish the lap in progress.
              if (fuelL > tankL || distance + fuelL / avgL < Math.floor(distance) + 1) continue
              inputs.push({ fuelL, avgL, tankL, distance, lapsRemaining, marginLaps })
            }

  it('plans stops whose whole window can be driven, and no fewer', () => {
    expect(inputs.length).toBeGreaterThan(500)
    for (const i of inputs) {
      const p = fuelStrategy(i)
      const tank = i.tankL ?? Infinity
      const finish = Math.floor(i.distance) + i.lapsRemaining
      const lastLap = finish - Math.floor(i.distance) <= 1
      const goal = finish + (lastLap ? 0 : i.marginLaps)
      const at = JSON.stringify(i)
      expect(p, at).not.toBeNull()
      if (p === null) continue
      expect(p.short, at).toBe(i.distance + i.fuelL / i.avgL < finish - 1e-9)
      if (p.window === null) {
        expect(p.stops, at).toBe(0)
        if (!lastLap) expect(i.distance + i.fuelL / i.avgL, at).toBeGreaterThanOrEqual(goal - 1e-6)
        continue
      }
      const { from, to } = p.window
      expect(from, at).toBeGreaterThanOrEqual(p.lap)
      expect(from, at).toBeLessThanOrEqual(to)
      expect(to, at).toBeLessThanOrEqual(finish - 1)
      // Every lap of the window finishes with the stops planned...
      for (let x = from; x <= to; x++) {
        expect(driven(i, tank, x, p.stops), `${at} at ${x}`).toBeGreaterThanOrEqual(goal - 1e-6)
      }
      // ...the lap before it does not, nor the last lap of the window with one stop less.
      if (from > p.lap) expect(driven(i, tank, from - 1, p.stops), at).toBeLessThan(goal)
      if (p.stops > 1) expect(driven(i, tank, to, p.stops - 1), at).toBeLessThan(goal)
      else expect(i.distance + i.fuelL / i.avgL, at).toBeLessThan(goal)
      // The fuel does not reach the lap end after the window's last (unless that is the flag).
      if (to < finish - 1) expect(i.distance + i.fuelL / i.avgL, at).toBeLessThan(to + 1)
    }
  })

  it('offers savings that do skip a stop', () => {
    let offered = 0
    for (const i of inputs) {
      const p = fuelStrategy(i)
      if (p === null || p.saveL === null) continue
      offered++
      const at = JSON.stringify(i)
      expect(p.saveL, at).toBeLessThan(i.avgL)
      expect(p.saveL, at).toBeGreaterThanOrEqual(i.avgL * 0.9 - 0.01)
      expect(fuelStrategy({ ...i, avgL: p.saveL })?.stops, at).toBeLessThan(p.stops)
      // A hundredth more per lap does not.
      const more = fuelStrategy({ ...i, avgL: p.saveL + 0.01 })?.stops ?? 0
      expect(more, at).toBeGreaterThanOrEqual(p.stops)
    }
    expect(offered).toBeGreaterThan(10)
  })
})
