import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RatingField } from './field'
import { iRatingDeltas, strengthOfField } from './irating'
import type { IRatingEntry } from './irating'
import { ClassRatingsCache, iRatingAtStake, neutralPosition, projectField } from './projection'

// The real port, wrapped only to count calls.
vi.mock('./irating', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./irating')>()
  return { ...actual, iRatingDeltas: vi.fn(actual.iRatingDeltas) }
})

beforeEach(() => {
  vi.mocked(iRatingDeltas).mockClear()
})

/** Starters at positions 1..n in list order (carIdx = index), then the non-starters. */
function field(iRatings: readonly number[], nonStarters: readonly number[] = []): RatingField {
  const entries: IRatingEntry[] = [
    ...iRatings.map((iRating, i) => ({ carIdx: i, iRating, position: i + 1, started: true })),
    ...nonStarters.map((iRating, k) => ({
      carIdx: iRatings.length + k,
      iRating,
      position: iRatings.length + k + 1,
      started: false
    }))
  ]
  return { entries, key: entries.map((e) => `${e.carIdx}:${e.iRating}:${e.position}`).join('|') }
}

/** Exact change of `carIdx` if it finished at `p`, the other starters keeping their order. */
function deltaAt(f: RatingField, carIdx: number, p: number): number {
  const moved: IRatingEntry[] = []
  let next = 1
  for (const e of f.entries) {
    if (!e.started || e.carIdx === carIdx) continue
    if (next === p) next++
    moved.push({ ...e, position: next++ })
  }
  for (const e of f.entries) {
    if (e.carIdx === carIdx) moved.push({ ...e, position: p })
    else if (!e.started) moved.push(e)
  }
  return iRatingDeltas(moved).get(carIdx) ?? NaN
}

/** Brute force of the neutral position: the last p whose change is >= 0. */
function lastNotLosing(f: RatingField, carIdx: number): number {
  const starters = f.entries.filter((e) => e.started).length
  let last = 0
  for (let p = 1; p <= starters; p++) if (deltaAt(f, carIdx, p) >= 0) last = p
  return last
}

describe('neutralPosition', () => {
  it('is the last position that does not lose iRating', () => {
    // The player (1600) among twenty 1500s: P10 still gains a little, P11 loses.
    const f = field([...new Array<number>(14).fill(1500), 1600, ...new Array<number>(6).fill(1500)])
    expect(deltaAt(f, 14, 10)).toBeGreaterThan(0)
    expect(deltaAt(f, 14, 11)).toBeLessThan(0)
    expect(projectField(f, 14, true).player?.breakEvenPosition).toBe(10)
  })

  it('matches the brute force over varied fields, with non-starters', () => {
    const fields = [
      field([1500, 1500, 1500, 1500]),
      field([3000, 1200, 1800, 2500, 900, 1400, 2200]),
      field([900, 4000, 3500, 3000, 2500], [2000, 1000]),
      field([1350, ...new Array<number>(30).fill(2200)], [1800]),
      field([5000, 800, 900, 1000])
    ]
    for (const f of fields) {
      for (const e of f.entries.filter((x) => x.started)) {
        const p = projectField(f, e.carIdx, true).player
        expect(p?.breakEvenPosition, `car ${e.carIdx}`).toBe(lastNotLosing(f, e.carIdx))
      }
    }
  })

  it('is 0 when even P1 loses or the slope is unknown, and never beyond the starters', () => {
    expect(neutralPosition(-50, 1, 10, 20)).toBe(0)
    expect(neutralPosition(5, 1, 0, 20)).toBe(0)
    expect(neutralPosition(NaN, 1, 10, 20)).toBe(0)
    expect(neutralPosition(500, 20, 10, 20)).toBe(20)
    // Exactly 0 at a position: that one is neutral.
    expect(neutralPosition(20, 3, 10, 20)).toBe(5)
  })
})

describe('projectField', () => {
  const f = field([2100, 2000, 1900, 1800, 1700], [1600])

  it('only computes the strength of field without deltas', () => {
    const p = projectField(f, 0, false)
    expect(p.sof).toBe(Math.round(strengthOfField(f.entries.map((e) => e.iRating)) ?? 0))
    expect(p).toMatchObject({ deltas: null, player: null, perPosition: 0 })
    expect(iRatingDeltas).not.toHaveBeenCalled()
  })

  it('rounds every change to whole points, without -0', () => {
    const p = projectField(f, 2, true)
    for (const [carIdx, d] of iRatingDeltas(f.entries)) {
      expect(p.deltas?.get(carIdx)).toBe(Math.round(d) || 0)
      expect(Object.is(p.deltas?.get(carIdx), -0)).toBe(false)
    }
    // The header projection agrees with the player's row.
    expect(p.player?.iRatingDelta).toBe(p.deltas?.get(2))
    expect(p.perPosition).toBeCloseTo(198 / 5, 10)
    expect(p.player?.perPosition).toBe(39.6)
  })

  it('has no neutral position for a player who did not start', () => {
    const p = projectField(f, 5, true)
    expect(p.player).toMatchObject({ perPosition: 0, breakEvenPosition: 0, ifGainOne: null })
    expect(p.perPosition).toBe(0)
  })

  it('has no player projection for a player outside the field', () => {
    const p = projectField(f, 42, true)
    expect(p.player).toBeNull()
    expect(p.deltas?.size).toBe(6)
  })
})

describe('iRatingAtStake', () => {
  const f = field([2100, 2000, 1900, 1800, 1700], [1600])

  /** Swap the two cars' positions, as the old battle code did. */
  function swapStake(player: number, opp: number): number {
    const me = f.entries.find((e) => e.carIdx === player)
    const o = f.entries.find((e) => e.carIdx === opp)
    if (!me || !o) throw new Error('missing car')
    const swapped = f.entries.map((e) =>
      e === me ? { ...e, position: o.position } : e === o ? { ...e, position: me.position } : e
    )
    const now = iRatingDeltas(f.entries).get(player) ?? NaN
    const other = iRatingDeltas(swapped).get(player) ?? NaN
    return me.position < o.position ? now - other : other - now
  }

  it('is your change finishing ahead minus behind the opponent', () => {
    const r = projectField(f, 2, true)
    expect(iRatingAtStake(f, r, 2, 1)).toBe(Math.round(swapStake(2, 1)))
    expect(iRatingAtStake(f, r, 2, 3)).toBe(Math.round(swapStake(2, 3)))
    expect(iRatingAtStake(f, r, 2, 0)).toBe(Math.round(swapStake(2, 0)))
    expect(iRatingAtStake(f, r, 2, 1)).toBe(40)
  })

  it('is null for a non-starter, a car outside the field or without a projection', () => {
    const r = projectField(f, 2, true)
    expect(iRatingAtStake(f, r, 2, 5)).toBeNull()
    expect(iRatingAtStake(f, r, 2, 42)).toBeNull()
    expect(iRatingAtStake(f, projectField(f, 2, false), 2, 1)).toBeNull()
  })
})

describe('ClassRatingsCache', () => {
  it('recomputes only when the field, the player or the mode change, and sweeps old classes', () => {
    const cache = new ClassRatingsCache()
    const a = field([2000, 1900, 1800])
    cache.begin()
    const first = cache.get(1, a, 0, true)
    cache.get(2, field([1500]), 0, false)
    cache.sweep()
    expect(cache.size).toBe(2)
    cache.begin()
    expect(cache.get(1, { ...a }, 0, true)).toBe(first)
    cache.sweep()
    // Class 2 was not asked for in this run.
    expect(cache.size).toBe(1)
    expect(iRatingDeltas).toHaveBeenCalledTimes(1)
    cache.begin()
    expect(cache.get(1, a, 1, true)).not.toBe(first)
    expect(cache.get(1, field([2000, 1900, 1801]), 1, true)).not.toBe(first)
    expect(cache.get(1, field([2000, 1900, 1801]), 1, false).deltas).toBeNull()
    expect(iRatingDeltas).toHaveBeenCalledTimes(3)
    cache.clear()
    expect(cache.size).toBe(0)
  })
})
