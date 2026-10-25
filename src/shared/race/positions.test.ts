import { describe, expect, it } from 'vitest'
import { OrderGroup } from './positions'

const HOLD = 0.5
const FORCE = 2
const DT = 1 / 60

/** Group of cars 0..n-1 shown in that order; `rank[c]` is the sort key of car c. */
function group(n: number): { g: OrderGroup; rank: Float64Array; step: (now: number) => void } {
  const g = new OrderGroup(16)
  for (let c = 0; c < n; c++) g.add(c)
  const rank = new Float64Array(16)
  for (let c = 0; c < n; c++) rank[c] = c
  g.sort((a, b) => (rank[a] ?? 0) - (rank[b] ?? 0))
  g.showNow()
  const step = (now: number): void => {
    g.sort((a, b) => (rank[a] ?? 0) - (rank[b] ?? 0) || a - b)
    g.settle(now, HOLD, FORCE)
  }
  return { g, rank, step }
}

const shown = (g: OrderGroup): number[] => Array.from(g.shown.subarray(0, g.size))

describe('OrderGroup', () => {
  it('sorts in place and reports whether the order changed', () => {
    const g = new OrderGroup(8)
    for (const i of [3, 1, 2]) g.add(i)
    expect(g.sort((a, b) => a - b)).toBe(true)
    expect(Array.from(g.order.subarray(0, 3))).toEqual([1, 2, 3])
    expect(g.sort((a, b) => a - b)).toBe(false)
  })

  it('shows a pass once it has held, not before', () => {
    const { g, rank, step } = group(3)
    rank[2] = -1 // car 2 passes both
    let t = 0
    for (; t < HOLD - DT; t += DT) {
      step(t)
      expect(shown(g)).toEqual([0, 1, 2])
    }
    step(HOLD + DT)
    expect(shown(g)).toEqual([2, 0, 1])
  })

  it('debounces per segment: a side-by-side pair does not delay an unrelated pass', () => {
    // The pair (swapping every 0.1 s for the whole run) behind or ahead of the pass at t = 1.
    for (const [pair, pass] of [
      [3, 0],
      [0, 3]
    ] as const) {
      const { g, rank, step } = group(6)
      let t = 0
      for (let k = 0; t < 3; k++, t = k * DT) {
        const swap = Math.floor(t / 0.1) % 2 === 0
        rank[pair] = swap ? pair + 1.5 : pair
        if (t >= 1) rank[pass + 1] = pass - 0.5
        step(t)
        const s = shown(g)
        // The pair never shows in any order but the first one.
        expect(s.slice(pair, pair + 2)).toEqual([pair, pair + 1])
        const passed = s.slice(pass, pass + 2)
        if (t >= 1 + HOLD + 2 * DT) expect(passed).toEqual([pass + 1, pass])
        if (t < 1 + HOLD - DT) expect(passed).toEqual([pass, pass + 1])
        expect([...s].sort()).toEqual([0, 1, 2, 3, 4, 5])
      }
    }
  })

  it('forces a segment that keeps changing after it differed for more than forceS', () => {
    const { g, rank, step } = group(3)
    let t = 0
    // Car 2 leads from t = 0 while 0 and 1 keep swapping every 0.3 s.
    for (let k = 0; t <= FORCE + 0.1; k++, t = k * DT) {
      rank[2] = -1
      const swap = Math.floor(t / 0.3) % 2 === 0
      rank[0] = swap ? 1 : 0
      rank[1] = swap ? 0 : 1
      step(t)
      if (t < FORCE - DT) expect(shown(g)[0]).toBe(0)
    }
    expect(shown(g)[0]).toBe(2)
  })

  it('shows the candidate order right away on showNow()', () => {
    const { g, rank } = group(3)
    rank[0] = 9
    g.sort((a, b) => (rank[a] ?? 0) - (rank[b] ?? 0))
    g.showNow()
    expect(shown(g)).toEqual([1, 2, 0])
  })
})
