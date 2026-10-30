import { describe, expect, it } from 'vitest'
import {
  CAR_AXLES,
  CAR_BODY,
  CAR_COCKPIT,
  CAR_VIEWBOX,
  TYRE_BANDS,
  TYRE_GROOVES,
  TYRE_OUTLINES
} from './carShape'

/** The absolute x of a path's every command start (M and h/H steps), enough for these shapes. */
function xs(d: string): number[] {
  const out: number[] = []
  let x = 0
  for (const m of d.matchAll(/([MLHhvVaz])([^MLHhvVaz]*)/g)) {
    const n = (m[2] ?? '')
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number)
    if (m[1] === 'M' || m[1] === 'L') x = n[0] ?? x
    else if (m[1] === 'H') x = n[0] ?? x
    else if (m[1] === 'h') x += n[0] ?? 0
    else if (m[1] === 'a') x += n[5] ?? 0
    out.push(x)
  }
  return out
}

describe('the car from above', () => {
  const [, , w, h] = CAR_VIEWBOX.split(' ').map(Number)

  it('has four tyres of three bands each, each a closed shape', () => {
    expect(TYRE_BANDS).toHaveLength(4)
    expect(TYRE_OUTLINES).toHaveLength(4)
    for (const tyre of TYRE_BANDS) {
      expect(tyre).toHaveLength(3)
      for (const d of tyre) expect(d).toMatch(/^M.*z$/)
    }
  })

  it('lays the bands left to right, side by side, inside the box', () => {
    for (const tyre of TYRE_BANDS) {
      const spans = tyre.map((d) => [Math.min(...xs(d)), Math.max(...xs(d))] as const)
      for (const [lo, hi] of spans) {
        expect(lo).toBeGreaterThanOrEqual(0)
        expect(hi).toBeLessThanOrEqual(w ?? 0)
      }
      // Each band starts where the one before ends.
      expect(spans[1]?.[0]).toBeCloseTo(spans[0]?.[1] ?? NaN, 1)
      expect(spans[2]?.[0]).toBeCloseTo(spans[1]?.[1] ?? NaN, 1)
    }
    // The left tyres on the left, the right ones on the right.
    const left = Math.max(...xs(TYRE_OUTLINES[0] ?? ''))
    const right = Math.min(...xs(TYRE_OUTLINES[1] ?? ''))
    expect(left).toBeLessThan(right)
  })

  it('draws the body, cockpit, axles and grooves as single static paths', () => {
    for (const d of [CAR_BODY, CAR_COCKPIT, CAR_AXLES, TYRE_GROOVES]) {
      expect(d.startsWith('M')).toBe(true)
      expect(d).not.toMatch(/NaN|undefined/)
    }
    expect(h).toBe(60)
  })
})
