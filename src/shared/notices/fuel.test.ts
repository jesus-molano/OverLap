import { describe, expect, it } from 'vitest'
import { AlertsProvider } from '../alerts'
import { EMPTY_RACE_VIEW } from '../race/emptyRaceView'
import { makeFrame, makeSession } from '../race/testing/raceSim'
import { defaultOptions } from '../settings'
import type { AlertsData, AlertsOptions } from '../types'
import { FUEL_ALERT, fuelNotices, type FuelAlertInput } from './fuel'

const input = (o: Partial<FuelAlertInput> = {}): FuelAlertInput => ({
  lapsOfFuel: 5,
  short: true,
  closesThisLap: false,
  ...o
})

describe('fuelNotices', () => {
  it('says nothing with fuel for a while', () => {
    expect(fuelNotices(input(), false, true)).toEqual([])
    expect(fuelNotices(null, false, true)).toEqual([])
  })

  it('warns under two laps of fuel when that does not reach the flag', () => {
    expect(FUEL_ALERT.lowLaps).toBe(2)
    expect(fuelNotices(input({ lapsOfFuel: 1.96 }), false, true)).toEqual([
      { kind: 'fuelLow', laps: 1.9 }
    ])
    // Enough to finish (with or without the margin): nothing to do.
    expect(fuelNotices(input({ lapsOfFuel: 1.2, short: false }), false, true)).toEqual([])
    // A session without an end (practice): it still runs dry.
    expect(fuelNotices(input({ lapsOfFuel: 1.2, short: null }), false, true)).toEqual([
      { kind: 'fuelLow', laps: 1.2 }
    ])
    expect(fuelNotices(input({ lapsOfFuel: 2 }), false, true)).toEqual([])
    expect(fuelNotices(input({ lapsOfFuel: null }), false, true)).toEqual([])
  })

  it('says to stop this lap while the window closes, with the low fuel beside it', () => {
    expect(fuelNotices(input({ closesThisLap: true }), false, true)).toEqual([
      { kind: 'boxThisLap' }
    ])
    expect(fuelNotices(input({ closesThisLap: true, lapsOfFuel: 0.8 }), false, true)).toEqual([
      { kind: 'boxThisLap' },
      { kind: 'fuelLow', laps: 0.8 }
    ])
  })

  it('does not call you in for a stop the margin alone asks for', () => {
    // The window of a margin splash closes, but the fuel reaches the flag at your average.
    const margin = input({ closesThisLap: true, lapsOfFuel: 1.9, short: false })
    expect(fuelNotices(margin, false, true)).toEqual([])
    // Without an end there is no window to close.
    expect(fuelNotices(input({ closesThisLap: true, short: null }), false, true)).toEqual([])
  })

  it('stays quiet on pit road and out of the car', () => {
    const low = input({ closesThisLap: true, lapsOfFuel: 0.5 })
    expect(fuelNotices(low, true, true)).toEqual([])
    expect(fuelNotices(low, false, false)).toEqual([])
  })
})

describe('the alerts band with the fuel plan', () => {
  const OPTS: AlertsOptions = { ...defaultOptions('alerts'), holdS: 0 }
  const session = makeSession(1)
  const low = input({ closesThisLap: true, lapsOfFuel: 0.8 })

  function run(
    o: Partial<AlertsOptions>,
    fuel: FuelAlertInput | null
  ): { f: ReturnType<typeof makeFrame>; data: () => AlertsData } {
    const f = makeFrame()
    f.SessionTime[0] = 100
    const p = new AlertsProvider()
    return { f, data: () => p.compute(f, session, EMPTY_RACE_VIEW, { ...OPTS, ...o }, fuel) }
  }

  it('shows the stop and the low fuel, each with its option', () => {
    expect(run({}, low).data().notices).toEqual([
      { kind: 'boxThisLap' },
      { kind: 'fuelLow', laps: 0.8 }
    ])
    expect(run({ showBoxThisLap: false }, low).data().notices).toEqual([
      { kind: 'fuelLow', laps: 0.8 }
    ])
    expect(run({ showFuelLow: false, showBoxThisLap: false }, low).data()).toMatchObject({
      visible: false,
      notices: []
    })
  })

  it('says nothing without a plan, on pit road or while being towed', () => {
    expect(run({}, null).data().notices).toEqual([])
    const pit = run({}, low)
    pit.f.OnPitRoad[0] = true
    expect(pit.data().notices).toEqual([])
    const tow = run({}, low)
    tow.f.PlayerCarTowTime[0] = 20
    expect(tow.data().notices).toEqual([{ kind: 'tow', seconds: 20 }])
  })
})
