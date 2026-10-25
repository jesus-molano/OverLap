import { describe, expect, it } from 'vitest'
import {
  WHEEL_HUB_R,
  WHEEL_MARKER,
  WHEEL_MARKER_W,
  WHEEL_RIM_R,
  WHEEL_RIM_W,
  WHEEL_SPOKES,
  WHEEL_SPOKE_W
} from './wheel'

/** The numbers of a path, as [x, y] pairs. */
function points(d: string): [number, number][] {
  const n = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number)
  const out: [number, number][] = []
  for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i]!, n[i + 1]!])
  return out
}

describe('steering wheel geometry', () => {
  it('fits the -10..10 viewBox with its strokes', () => {
    expect(WHEEL_RIM_R + WHEEL_RIM_W / 2).toBeLessThanOrEqual(10)
    expect(WHEEL_HUB_R).toBeLessThan(WHEEL_RIM_R - WHEEL_RIM_W / 2)
    expect(WHEEL_SPOKE_W).toBeLessThan(WHEEL_HUB_R * 2)
  })

  it('three spokes from the hub edge to the inside of the rim: left, right, bottom', () => {
    const p = points(WHEEL_SPOKES)
    expect(p).toHaveLength(6)
    const inner = WHEEL_RIM_R - WHEEL_RIM_W / 2
    for (let i = 0; i < 6; i += 2) {
      expect(Math.hypot(...p[i]!)).toBeCloseTo(WHEEL_HUB_R, 1)
      expect(Math.hypot(...p[i + 1]!)).toBeCloseTo(inner, 1)
    }
    expect(p[1]![0]).toBeLessThan(0)
    expect(p[3]![0]).toBeGreaterThan(0)
    // SVG y points down: the third spoke goes to 6 o'clock.
    expect(p[5]![1]).toBeGreaterThan(0)
    expect(p[5]![0]).toBeCloseTo(0)
  })

  it("the straight-ahead marker crosses the rim at 12 o'clock", () => {
    const m = /^M0 (-?[\d.]+)V(-?[\d.]+)$/.exec(WHEEL_MARKER)
    expect(m).not.toBeNull()
    expect(Number(m![1])).toBeCloseTo(-(WHEEL_RIM_R + WHEEL_RIM_W / 2))
    expect(Number(m![2])).toBeCloseTo(-(WHEEL_RIM_R - WHEEL_RIM_W / 2))
    expect(WHEEL_MARKER_W).toBeGreaterThan(WHEEL_SPOKE_W)
  })
})
