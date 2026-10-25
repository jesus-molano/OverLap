import { describe, it, expect } from 'vitest'
import { approach, crossedPct, insertionSort, lerp, smooth01 } from './math'
import { mulberry32 } from './rng'

describe('mock math', () => {
  it('approach moves toward the target without passing it', () => {
    expect(approach(0, 1, 0.25)).toBe(0.25)
    expect(approach(0.9, 1, 0.25)).toBe(1)
    expect(approach(1, 0, 0.4)).toBe(0.6)
    expect(approach(0.2, 0, 0.4)).toBe(0)
    expect(approach(1, 1, 0)).toBe(1)
  })

  it('crossedPct detects a lap fraction crossed forward, across the S/F line too', () => {
    expect(crossedPct(14.95, 14.97, 0.96)).toBe(true)
    expect(crossedPct(14.96, 14.97, 0.96)).toBe(false)
    expect(crossedPct(14.97, 14.98, 0.96)).toBe(false)
    expect(crossedPct(14.95, 15.01, 0.96)).toBe(true)
    expect(crossedPct(14.97, 15.01, 0.96)).toBe(false)
    expect(crossedPct(14.99, 15.02, 0.01)).toBe(true)
    expect(crossedPct(14.97, 14.95, 0.96)).toBe(false)
  })

  it('lerp and smooth01', () => {
    expect(lerp(2, 4, 0.5)).toBe(3)
    expect(smooth01(-1)).toBe(0)
    expect(smooth01(0.5)).toBe(0.5)
    expect(smooth01(2)).toBe(1)
  })

  it('insertionSort sorts in place like Array.prototype.sort with a total order', () => {
    const rng = mulberry32(5)
    for (let n = 0; n < 30; n++) {
      const arr = Array.from({ length: n }, () => Math.floor(rng() * 10))
      const ref = [...arr].sort((a, b) => a - b)
      const same = arr
      insertionSort(arr, (a, b) => a - b)
      expect(arr).toBe(same)
      expect(arr).toEqual(ref)
    }
    // Stable: equal keys keep their order.
    const items = [3, 1, 2, 1, 3].map((key, i) => ({ key, i }))
    insertionSort(items, (a, b) => a.key - b.key)
    expect(items.map((x) => x.i)).toEqual([1, 3, 2, 0, 4])
  })
})

describe('mulberry32', () => {
  it('is deterministic and uniform in [0, 1)', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    let sum = 0
    for (let k = 0; k < 10_000; k++) {
      const x = a()
      expect(x).toBe(b())
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
      sum += x
    }
    expect(sum / 10_000).toBeCloseTo(0.5, 1)
    expect(mulberry32(1)()).not.toBe(mulberry32(2)())
  })
})
