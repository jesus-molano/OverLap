import { describe, it, expect } from 'vitest'
import { iRatingDeltas, playerProjection, strengthOfField } from './irating'
import type { IRatingEntry } from './irating'

/** All starters, positions 1..n in array order, carIdx = index. */
function field(ratings: number[]): IRatingEntry[] {
  return ratings.map((iRating, i) => ({ carIdx: i, iRating, position: i + 1, started: true }))
}

function sum(map: Map<number, number>): number {
  let s = 0
  for (const v of map.values()) s += v
  return s
}

// Sample data and expected changes from the irDashies spec (iratingGain.spec.ts).
const SAMPLE: IRatingEntry[] = [
  { carIdx: 0, position: 1, iRating: 2502, started: true },
  { carIdx: 1, position: 2, iRating: 1202, started: true },
  { carIdx: 2, position: 3, iRating: 1585, started: true },
  { carIdx: 3, position: 4, iRating: 1409, started: true },
  { carIdx: 4, position: 5, iRating: 1531, started: true },
  { carIdx: 5, position: 6, iRating: 967, started: true },
  { carIdx: 6, position: 7, iRating: 1016, started: true },
  { carIdx: 7, position: 8, iRating: 459, started: true },
  { carIdx: 8, position: 9, iRating: 770, started: true },
  { carIdx: 9, position: 10, iRating: 926, started: true },
  { carIdx: 10, position: 11, iRating: 815, started: false },
  { carIdx: 11, position: 12, iRating: 1518, started: false }
]
const SAMPLE_EXPECTED = [
  51.526181519664114, 85.93706251432899, 45.76839250350699, 34.726798295045704, 8.75717685896802,
  22.00892280681238, -1.1847185527524153, 26.417252365382087, -22.43830479379796,
  -54.257888044345336, -78.76773919166914, -118.49313628114338
]

describe('iRatingDeltas: reference vectors', () => {
  it('matches the irDashies / irating-rs sample exactly', () => {
    const deltas = iRatingDeltas(SAMPLE)
    expect(deltas.size).toBe(12)
    SAMPLE_EXPECTED.forEach((expected, carIdx) => {
      expect(deltas.get(carIdx)).toBe(expected)
    })
  })

  it('returns nothing for an empty field', () => {
    expect(iRatingDeltas([]).size).toBe(0)
  })

  it('reports the raw loss of a favourite finishing last (no floor at the rating)', () => {
    const entries: IRatingEntry[] = [{ carIdx: 99, iRating: 100, position: 20, started: true }]
    for (let i = 0; i < 19; i++) {
      entries.push({ carIdx: i, iRating: 1, position: i + 1, started: true })
    }
    expect(iRatingDeltas(entries).get(99)).toBeLessThan(-100)
  })

  it('handles a field where nobody started', () => {
    const deltas = iRatingDeltas([
      { carIdx: 0, iRating: 2000, position: 1, started: false },
      { carIdx: 1, iRating: 2000, position: 2, started: false }
    ])
    expect([...deltas.values()]).toEqual([0, 0])
  })

  it('never gives a non-starter a gain', () => {
    const deltas = iRatingDeltas([
      { carIdx: 0, iRating: 3000, position: 1, started: true },
      { carIdx: 1, iRating: 2000, position: 2, started: true },
      { carIdx: 2, iRating: 1000, position: 3, started: false }
    ])
    expect(deltas.get(2)).toBeLessThanOrEqual(0)
  })
})

describe('iRatingDeltas: behaviour', () => {
  it('equal field of 12 starters: P1 about +90.8, P12 about -90.7', () => {
    const deltas = iRatingDeltas(field(Array<number>(12).fill(1500)))
    expect(deltas.get(0)).toBeCloseTo(90.83, 1)
    expect(deltas.get(11)).toBeCloseTo(-90.67, 1)
  })

  it('all-started fields sum to exactly +1 (the fudge factor), whatever the ratings', () => {
    expect(sum(iRatingDeltas(field(Array<number>(12).fill(1500))))).toBeCloseTo(1, 9)
    expect(sum(iRatingDeltas(field([4200, 900, 2500, 1350, 3100, 600, 1800])))).toBeCloseTo(1, 9)
  })

  it('non-starters absorb the starters net gain, by expected score', () => {
    const deltas = iRatingDeltas(SAMPLE)
    expect(sum(deltas)).toBeCloseTo(0, 9)
    // The higher-rated non-starter (1518) loses more than the lower one (815).
    expect(deltas.get(11)!).toBeLessThan(deltas.get(10)!)
  })

  it('classifies non-starters behind every starter regardless of their position', () => {
    const shuffled = SAMPLE.map((e) => (e.started ? e : { ...e, position: e.position - 10 }))
    const deltas = iRatingDeltas(shuffled)
    SAMPLE_EXPECTED.forEach((expected, carIdx) => {
      expect(deltas.get(carIdx)).toBeCloseTo(expected, 9)
    })
  })

  it('does not depend on the input order', () => {
    const reversed = [...SAMPLE].reverse()
    const deltas = iRatingDeltas(reversed)
    SAMPLE_EXPECTED.forEach((expected, carIdx) => {
      expect(deltas.get(carIdx)).toBeCloseTo(expected, 9)
    })
  })

  it('excludes cars without an iRating and ranks the rest without them', () => {
    const entries = field(Array<number>(12).fill(1500)).map((e) => ({
      ...e,
      position: e.position + 1
    }))
    entries.push({ carIdx: 50, iRating: 0, position: 1, started: true })
    entries.push({ carIdx: 51, iRating: Number.NaN, position: 14, started: true })
    const deltas = iRatingDeltas(entries)
    expect(deltas.has(50)).toBe(false)
    expect(deltas.has(51)).toBe(false)
    expect(deltas.get(0)).toBeCloseTo(90.83, 1)
    expect(deltas.get(11)).toBeCloseTo(-90.67, 1)
  })

  it('gives the same answer on repeated (cached) calls', () => {
    const entries = field([2100, 1700, 1500, 1350, 900])
    const first = iRatingDeltas(entries)
    // Different lists in between rotate the cache.
    for (let i = 0; i < 6; i++) iRatingDeltas(field([1000 + i, 2000]))
    expect(iRatingDeltas(entries)).toEqual(first)
    expect(iRatingDeltas(entries)).toEqual(first)
  })
})

describe('strengthOfField', () => {
  it('equals the rating of an identical field', () => {
    expect(strengthOfField([1500, 1500, 1500])).toBeCloseTo(1500, 6)
    expect(strengthOfField([3210])).toBeCloseTo(3210, 6)
  })

  it('leans towards the lower ratings (exponential mean)', () => {
    const sof = strengthOfField([1000, 3000])!
    expect(sof).toBeGreaterThan(1000)
    expect(sof).toBeLessThan(2000)
    expect(sof).toBeCloseTo(1790, -1)
  })

  it('ignores invalid ratings and returns null when none are valid', () => {
    expect(strengthOfField([2000, 0, -5, Number.NaN])).toBeCloseTo(2000, 6)
    expect(strengthOfField([])).toBeNull()
    expect(strengthOfField([0, 0])).toBeNull()
  })
})

describe('playerProjection', () => {
  /** 19 cars at 1500 plus the player (carIdx 99, 1800) at `position`: a 20-car field. */
  function strongPlayer(position: number): IRatingEntry[] {
    const entries: IRatingEntry[] = []
    let p = 1
    for (let i = 0; i < 19; i++) {
      if (p === position) p++
      entries.push({ carIdx: i, iRating: 1500, position: p++, started: true })
    }
    entries.push({ carIdx: 99, iRating: 1800, position, started: true })
    return entries
  }

  it('1800 in a field of 1500s: P5 about +42.5, P10 about -7.0', () => {
    expect(playerProjection(strongPlayer(5), 99)!.iRatingDelta).toBeCloseTo(42.5, 0)
    expect(Math.abs(playerProjection(strongPlayer(5), 99)!.iRatingDelta - 42.5)).toBeLessThan(0.5)
    expect(Math.abs(playerProjection(strongPlayer(10), 99)!.iRatingDelta + 7.0)).toBeLessThan(0.5)
  })

  it('agrees with iRatingDeltas at the current position', () => {
    const entries = strongPlayer(7)
    expect(playerProjection(entries, 99)!.iRatingDelta).toBe(iRatingDeltas(entries).get(99))
  })

  it('break-even is the first position that does not gain', () => {
    const proj = playerProjection(strongPlayer(3), 99)!
    expect(proj.breakEvenPosition).toBe(10)
    expect(playerProjection(strongPlayer(9), 99)!.iRatingDelta).toBeGreaterThan(0)
    expect(playerProjection(strongPlayer(10), 99)!.iRatingDelta).toBeLessThanOrEqual(0)

    // Equal field of 12: zero crossing at about P6.5.
    const equal = field(Array<number>(12).fill(1500))
    expect(playerProjection(equal, 0)!.breakEvenPosition).toBe(7)
    expect(iRatingDeltas(equal).get(5)).toBeGreaterThan(0)
    expect(iRatingDeltas(equal).get(6)).toBeLessThanOrEqual(0)
  })

  it('break-even does not depend on the current position', () => {
    const positions = [1, 4, 10, 20].map((p) => playerProjection(strongPlayer(p), 99)!)
    for (const proj of positions) expect(proj.breakEvenPosition).toBe(10)
  })

  it('values a position at 198 / starters and swaps with the neighbours', () => {
    const proj = playerProjection(strongPlayer(5), 99)!
    expect(proj.perPosition).toBeCloseTo(198 / 20, 9)
    expect(proj.ifGainOne! - proj.iRatingDelta).toBeCloseTo(proj.perPosition, 9)
    expect(proj.iRatingDelta - proj.ifLoseOne!).toBeCloseTo(proj.perPosition, 9)
    expect(proj.ifGainOne).toBeCloseTo(playerProjection(strongPlayer(4), 99)!.iRatingDelta, 9)
    expect(proj.ifLoseOne).toBeCloseTo(playerProjection(strongPlayer(6), 99)!.iRatingDelta, 9)
  })

  it('has no neighbour ahead in P1 and none behind in last place', () => {
    expect(playerProjection(strongPlayer(1), 99)!.ifGainOne).toBeNull()
    expect(playerProjection(strongPlayer(1), 99)!.ifLoseOne).not.toBeNull()
    expect(playerProjection(strongPlayer(20), 99)!.ifLoseOne).toBeNull()
    expect(playerProjection(strongPlayer(20), 99)!.ifGainOne).not.toBeNull()
  })

  it('reports numStarters + 1 when no position loses iRating', () => {
    // A lone starter gains by finishing.
    const proj = playerProjection([{ carIdx: 3, iRating: 2000, position: 1, started: true }], 3)!
    expect(proj.iRatingDelta).toBeGreaterThan(0)
    expect(proj.breakEvenPosition).toBe(2)
    expect(proj.ifGainOne).toBeNull()
    expect(proj.ifLoseOne).toBeNull()
  })

  it('a non-starter has a position-independent loss', () => {
    const proj = playerProjection(SAMPLE, 11)!
    expect(proj.iRatingDelta).toBe(SAMPLE_EXPECTED[11])
    expect(proj.perPosition).toBe(0)
    expect(proj.breakEvenPosition).toBe(1)
    expect(proj.ifGainOne).toBeNull()
    expect(proj.ifLoseOne).toBeNull()
  })

  it('is null when the player is missing or has no iRating', () => {
    expect(playerProjection(SAMPLE, 42)).toBeNull()
    expect(playerProjection([{ carIdx: 1, iRating: 0, position: 1, started: true }], 1)).toBeNull()
  })
})
