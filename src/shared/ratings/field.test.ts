import { describe, expect, it } from 'vitest'
import { makeDriver, makeSession } from '../race/testing/raceSim'
import type { RaceCarState, RaceView } from '../race/raceView'
import { classRatingField, fieldEntry } from './field'

/** Only `car()` matters to the field: class positions by carIdx (0 = not classified). */
function race(positions: Record<number, number>): Pick<RaceView, 'car'> {
  return {
    car: (i) =>
      positions[i] === undefined ? undefined : ({ classPosition: positions[i] } as RaceCarState)
  }
}

describe('classRatingField', () => {
  const session = makeSession(0, {}, [
    makeDriver(4, { iRating: 1400 }),
    makeDriver(1, { iRating: 2100 }),
    makeDriver(7, { iRating: 1800 }),
    makeDriver(2, { iRating: 1600 }),
    // Never seen in the world: registered, so a non-starter.
    makeDriver(9, { iRating: 1500 }),
    makeDriver(3, { iRating: 0 }),
    makeDriver(5, { iRating: 1700, classId: 2 }),
    makeDriver(6, { iRating: 1900, isSpectator: true }),
    makeDriver(8, { iRating: 1900, isPaceCar: true })
  ])
  const live = race({ 1: 2, 2: 3, 3: 1, 4: 4, 7: 0 })

  it('lists the registered class drivers with an iRating by carIdx, starters ranked first', () => {
    expect(classRatingField(session, live, 1).entries).toEqual([
      { carIdx: 1, iRating: 2100, position: 1, started: true },
      { carIdx: 2, iRating: 1600, position: 2, started: true },
      { carIdx: 4, iRating: 1400, position: 3, started: true },
      // In the world but not classified, and never seen: non-starters by carIdx.
      { carIdx: 7, iRating: 1800, position: 4, started: false },
      { carIdx: 9, iRating: 1500, position: 5, started: false }
    ])
  })

  it('leaves out other classes, spectators, the pace car and unknown iRatings', () => {
    const ids = classRatingField(session, live, 1).entries.map((e) => e.carIdx)
    expect(ids).not.toContain(3)
    expect(ids).not.toContain(5)
    expect(ids).not.toContain(6)
    expect(ids).not.toContain(8)
    expect(classRatingField(session, live, 2).entries.map((e) => e.carIdx)).toEqual([5])
    expect(classRatingField({ ...session, paceCarIdx: 9 }, live, 1).entries).toHaveLength(4)
  })

  it('has the same key for the same field and a new one on any change', () => {
    const a = classRatingField(session, live, 1)
    expect(classRatingField(session, race({ 1: 2, 2: 3, 3: 1, 4: 4, 7: 0 }), 1).key).toBe(a.key)
    // A swap, a start, a new iRating.
    expect(classRatingField(session, race({ 1: 3, 2: 2, 4: 4 }), 1).key).not.toBe(a.key)
    expect(classRatingField(session, race({ 1: 2, 2: 3, 4: 4, 7: 5 }), 1).key).not.toBe(a.key)
    const s2 = makeSession(
      0,
      {},
      [...session.drivers.values()].map((d) => (d.carIdx === 9 ? { ...d, iRating: 1501 } : d))
    )
    expect(classRatingField(s2, live, 1).key).not.toBe(a.key)
  })

  it('finds an entry by carIdx', () => {
    const f = classRatingField(session, live, 1)
    expect(fieldEntry(f, 4)?.position).toBe(3)
    expect(fieldEntry(f, 3)).toBeUndefined()
  })
})
