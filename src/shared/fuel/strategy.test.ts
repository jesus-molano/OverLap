import { describe, expect, it } from 'vitest'
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

describe('fuelStrategy', () => {
  it('needs no stop when the fuel reaches the flag with the margin', () => {
    // Flag at distance 10 + 15 = 25: 14.5 laps and 0.5 of margin at 3 L.
    expect(plan({ fuelL: 60 })).toEqual({
      lap: 11,
      lapsLeft: 14.5,
      needL: 45,
      deficitL: -15,
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

  it('plans one stop: what is missing, from now to the last lap the fuel reaches', () => {
    // 30 L last 10 laps: to distance 20.5, so the end of lap 20 at the latest.
    expect(plan({ fuelL: 30 })).toEqual({
      lap: 11,
      lapsLeft: 14.5,
      needL: 45,
      deficitL: 15,
      stops: 1,
      addL: 15,
      fill: false,
      window: { from: 11, to: 20 },
      saveL: null
    })
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

  it('never opens the window after it closes: one more stop instead', () => {
    // 9 L at 3 L last to distance 3.5 (end of lap 3); a 20 L stop there leaves 7 laps for 6.67.
    expect(
      plan({ fuelL: 9, tankL: 20, distance: 0.5, lapsRemaining: 10, marginLaps: 0 })
    ).toMatchObject({ stops: 2, window: { from: 1, to: 3 }, fill: true })
  })

  it('fills the tank at the next stop when more than one is needed', () => {
    // 80 L short with a 40 L tank: two stops would need one at distance 3.33, so three.
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

  it('offers the saving that skips a stop when it is within 10 %', () => {
    // 40 L over 14.5 laps: 2.758 L a lap instead of 3 (8 % less) and no stop.
    const p = plan({ fuelL: 40, distance: 0.5, lapsRemaining: 15, marginLaps: 0 })
    expect(p).toMatchObject({ stops: 1, saveL: 2.75 })
    // Two stops to one: 20 L + one full 55 L tank over 40 laps is 1.875 L a lap (6 % less).
    const two = plan({ fuelL: 20, avgL: 2, tankL: 55, distance: 5.5, lapsRemaining: 40 })
    expect(two).toMatchObject({ stops: 2, saveL: 1.87 })
    // A third less is not a saving anyone drives.
    expect(plan({ fuelL: 30 })?.saveL).toBeNull()
  })

  it('without a known tank, plans a single stop that holds what is missing', () => {
    expect(plan({ fuelL: 30, tankL: null })).toMatchObject({
      stops: 1,
      addL: 15,
      fill: false,
      window: { from: 11, to: 20 }
    })
  })

  it('needs nothing once you took the flag', () => {
    expect(plan({ fuelL: 6.04, lapsRemaining: 0 })).toEqual({
      lap: 11,
      lapsLeft: 0,
      needL: 0,
      deficitL: -6,
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
