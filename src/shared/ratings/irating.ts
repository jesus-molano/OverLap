/**
 * Projected iRating change with the community formula (unofficial: iRacing
 * does not publish it).
 *
 * Ported from irDashies, src/frontend/utils/iratingGain.ts (MIT,
 * https://github.com/tariknz/irdashies), itself a port of Turbo87/irating-rs
 * (https://github.com/Turbo87/irating-rs), which implements Kenny Powell's
 * 2019 iRating spreadsheet. The arithmetic is kept in the same order as the
 * reference so its spec vectors reproduce exactly.
 *
 * Computed per class (Sporting Code 13.2.3): pass one class at a time.
 */
import type { PlayerRatingProjection } from '../types'

export interface IRatingEntry {
  carIdx: number
  /** Pre-race iRating (> 0). */
  iRating: number
  /** 1-based finishing/current position within the class. */
  position: number
  started: boolean
}

const BR1 = 1600 / Math.LN2

/** iRating one position is worth for a starter: the fudge factor eats 1% of the 200/N slope. */
const PER_POSITION_NUMERATOR = 198

interface Field {
  /** Entries with a valid iRating, in input order. */
  entries: IRatingEntry[]
  /** 1-based class rank per entry: starters first, then by position. */
  ranks: Int32Array
  /** Expected score per entry (shared cache, do not mutate). */
  expected: Float64Array
  numStarters: number
  numNonStarters: number
}

// Expected scores depend only on the iRating list, so they are cached across
// calls (standings and battle ask for the same class several times per tick).
// Keyed by the ratings in input order: pass entries in a stable order (e.g. by
// carIdx) so overtakes do not miss the cache.
const CACHE_SIZE = 4
const cacheKeys: Float64Array[] = []
const cacheValues: Float64Array[] = []
let cacheNext = 0

function validRating(ir: number): boolean {
  return Number.isFinite(ir) && ir > 0
}

function sameRatings(a: Float64Array, b: readonly IRatingEntry[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]?.iRating) return false
  }
  return true
}

/** Chance of a beating b, from the precomputed e^(-iR/B) of each. */
function chance(expA: number, expB: number): number {
  return ((1 - expA) * expB) / ((1 - expB) * expA + (1 - expA) * expB)
}

function expectedScores(entries: readonly IRatingEntry[]): Float64Array {
  for (let c = 0; c < cacheKeys.length; c++) {
    const key = cacheKeys[c]
    const value = cacheValues[c]
    if (key !== undefined && value !== undefined && sameRatings(key, entries)) return value
  }
  const n = entries.length
  const ratings = new Float64Array(n)
  const exps = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const ir = entries[i]?.iRating ?? 0
    ratings[i] = ir
    exps[i] = Math.exp(-ir / BR1)
  }
  const expected = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const expA = exps[i] ?? 0
    let sum = 0
    for (let j = 0; j < n; j++) sum += chance(expA, exps[j] ?? 0)
    expected[i] = sum - 0.5
  }
  cacheKeys[cacheNext] = ratings
  cacheValues[cacheNext] = expected
  cacheNext = (cacheNext + 1) % CACHE_SIZE
  return expected
}

function buildField(all: readonly IRatingEntry[]): Field {
  const entries = all.filter((e) => validRating(e.iRating))
  const n = entries.length
  // Non-starters are classified behind every starter, as in iRacing results.
  const order = entries.map((_, i) => i)
  order.sort((a, b) => {
    const ea = entries[a]
    const eb = entries[b]
    if (ea === undefined || eb === undefined) return 0
    if (ea.started !== eb.started) return ea.started ? -1 : 1
    const pa = Number.isFinite(ea.position) ? ea.position : Infinity
    const pb = Number.isFinite(eb.position) ? eb.position : Infinity
    return pa === pb ? a - b : pa - pb
  })
  const ranks = new Int32Array(n)
  for (let r = 0; r < n; r++) ranks[order[r] ?? 0] = r + 1
  let numStarters = 0
  for (const e of entries) if (e.started) numStarters++
  return {
    entries,
    ranks,
    expected: expectedScores(entries),
    numStarters,
    numNonStarters: n - numStarters
  }
}

/** Starter's change at a given rank (the reference expression, verbatim). */
function starterDelta(field: Field, expected: number, rank: number): number {
  const numRegistrations = field.entries.length
  const x = numRegistrations - field.numNonStarters / 2
  const fudge = (x / 2 - rank) / 100
  return ((numRegistrations - rank - expected - fudge) * 200) / field.numStarters
}

function computeDeltas(field: Field): Float64Array {
  const { entries, ranks, expected, numNonStarters } = field
  const n = entries.length
  const deltas = new Float64Array(n)
  let sumStarters = 0
  let sumExpectedNonStarters = 0
  for (let i = 0; i < n; i++) {
    const e = entries[i]
    const exp = expected[i] ?? 0
    if (e?.started) {
      const change = starterDelta(field, exp, ranks[i] ?? 0)
      deltas[i] = change
      sumStarters += change
    } else {
      sumExpectedNonStarters += exp
    }
  }
  if (numNonStarters === 0) return deltas
  const avgExpected = sumExpectedNonStarters / numNonStarters
  for (let i = 0; i < n; i++) {
    if (entries[i]?.started) continue
    const exp = expected[i] ?? 0
    // Non-starters share the starters' net gain as a loss, by expected score.
    const change = avgExpected === 0 ? 0 : (-sumStarters / numNonStarters) * (exp / avgExpected)
    deltas[i] = change === 0 ? 0 : change
  }
  return deltas
}

/** Projected iRating change per car (one class only), community formula. */
export function iRatingDeltas(entries: readonly IRatingEntry[]): Map<number, number> {
  const out = new Map<number, number>()
  const field = buildField(entries)
  if (field.entries.length === 0) return out
  const deltas = computeDeltas(field)
  for (let i = 0; i < field.entries.length; i++) {
    const e = field.entries[i]
    if (e !== undefined) out.set(e.carIdx, deltas[i] ?? 0)
  }
  return out
}

/** Strength of field of one class, null when no valid iRatings. */
export function strengthOfField(iRatings: readonly number[]): number | null {
  let n = 0
  let sum = 0
  for (const ir of iRatings) {
    if (!validRating(ir)) continue
    n++
    sum += 2 ** (-ir / 1600)
  }
  return n === 0 ? null : BR1 * Math.log(n / sum)
}

/**
 * The player's projection within their class, null when the player is not in
 * `entries` (or has no valid iRating).
 *
 * A starter's own change depends only on their rank (expected scores are fixed
 * by the ratings), so moving to another position is a closed form; positions
 * range over the starters, who are always classified ahead of non-starters.
 * `breakEvenPosition` is numStarters + 1 when no position loses iRating. A
 * non-starter's change does not depend on position: perPosition 0, no neighbours.
 */
export function playerProjection(
  entries: readonly IRatingEntry[],
  playerCarIdx: number
): PlayerRatingProjection | null {
  const field = buildField(entries)
  const index = field.entries.findIndex((e) => e.carIdx === playerCarIdx)
  const player = field.entries[index]
  if (player === undefined) return null

  if (!player.started) {
    const delta = computeDeltas(field)[index] ?? 0
    return {
      iRatingDelta: delta,
      perPosition: 0,
      breakEvenPosition: delta <= 0 ? 1 : field.entries.length + 1,
      ifGainOne: null,
      ifLoseOne: null
    }
  }

  const expected = field.expected[index] ?? 0
  const rank = field.ranks[index] ?? 1
  const starters = field.numStarters
  let breakEven = starters + 1
  for (let p = 1; p <= starters; p++) {
    if (starterDelta(field, expected, p) <= 0) {
      breakEven = p
      break
    }
  }
  return {
    iRatingDelta: starterDelta(field, expected, rank),
    perPosition: PER_POSITION_NUMERATOR / starters,
    breakEvenPosition: breakEven,
    ifGainOne: rank > 1 ? starterDelta(field, expected, rank - 1) : null,
    ifLoseOne: rank < starters ? starterDelta(field, expected, rank + 1) : null
  }
}
