import { describe, expect, it } from 'vitest'
import { SessionFlag } from '@shared/flags'
import type { SimCar } from './car'
import { MockRace } from './simulation'
import { at, run } from './testUtils'
import { MOCK_WARNING, warningEvents } from './warnings'

describe('warningEvents', () => {
  it('raises the furled bit, then clears only that bit, logging both', () => {
    const car = { idx: 4, flags: SessionFlag.Repair } as SimCar
    const log: string[] = []
    const [raise, clear] = warningEvents(car, (kind, idx) => log.push(`${kind}:${idx}`))
    expect(raise?.atS).toBe(MOCK_WARNING.atS)
    expect(clear?.atS).toBe(MOCK_WARNING.atS + MOCK_WARNING.forS)
    raise?.apply()
    expect(car.flags).toBe(SessionFlag.Repair | SessionFlag.Furled)
    clear?.apply()
    expect(car.flags).toBe(SessionFlag.Repair)
    expect(log).toEqual(['warning-flag:4', 'warning-end:4'])
  })

  it('has nothing to do without the car', () => {
    expect(warningEvents(undefined, () => {})).toEqual([])
  })
})

describe('the warning in a mock session', () => {
  it('flies on the battle car ahead from 150 s to 195 s, in the frame and the log', () => {
    const race = new MockRace()
    const ahead = race.cast.battleAhead
    const seen: number[] = []
    run(race, 220, 1 / 10, (f, t) => {
      if (at(f.CarIdxSessionFlags, ahead) & SessionFlag.Furled) seen.push(t)
    })
    expect(at(seen, 0)).toBeCloseTo(MOCK_WARNING.atS, 0)
    expect(at(seen, seen.length - 1)).toBeCloseTo(MOCK_WARNING.atS + MOCK_WARNING.forS, 0)
    const kinds = race.log.filter((e) => e.carIdx === ahead).map((e) => e.kind)
    expect(kinds).toEqual(expect.arrayContaining(['warning-flag', 'warning-end']))
  })
})
