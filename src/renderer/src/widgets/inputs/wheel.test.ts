import { describe, expect, it } from 'vitest'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import {
  FORMULA,
  MINIMAL,
  REALISTIC,
  WHEEL_HALF,
  WHEEL_SIZE_EM,
  WHEEL_VIEWBOX,
  type WheelRect
} from './wheel'

/** The numbers of a path, as [x, y] pairs (arcs' radii and flags included: only for bounds). */
function points(d: string): [number, number][] {
  const n = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number)
  const out: [number, number][] = []
  for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i]!, n[i + 1]!])
  return out
}

/** The farthest corner of a rounded rectangle from the centre (its rounding pulls it in). */
function reach(r: WheelRect): number {
  const x = Math.max(Math.abs(r.x), Math.abs(r.x + r.w)) - r.r * (1 - Math.SQRT1_2)
  const y = Math.max(Math.abs(r.y), Math.abs(r.y + r.h)) - r.r * (1 - Math.SQRT1_2)
  return Math.hypot(x, y)
}

describe('steering wheel geometry', () => {
  it('every wheel turns inside its box: within a circle of the viewBox half', () => {
    expect(WHEEL_VIEWBOX).toBe('-12 -12 24 24')
    expect(MINIMAL.ringR + MINIMAL.markW / 2).toBeLessThanOrEqual(WHEEL_HALF)
    expect(REALISTIC.rimR + REALISTIC.gripW / 2).toBeLessThanOrEqual(WHEEL_HALF)
    for (const g of FORMULA.grips) expect(reach(g)).toBeLessThanOrEqual(WHEEL_HALF)
    for (const [x, y] of points(FORMULA.body)) expect(Math.hypot(x, y)).toBeLessThan(WHEEL_HALF)
    expect(reach(FORMULA.mark)).toBeLessThan(WHEEL_HALF)
  })

  it('the minimal mark sits on the ring at 12 o’clock', () => {
    const m = /^M(-?[\d.]+) (-?[\d.]+)A[\d.]+ [\d.]+ 0 0 1 (-?[\d.]+) (-?[\d.]+)$/.exec(
      MINIMAL.mark
    )
    expect(m).not.toBeNull()
    const [x0, y0, x1, y1] = m!.slice(1).map(Number) as [number, number, number, number]
    expect(Math.hypot(x0, y0)).toBeCloseTo(MINIMAL.ringR, 1)
    expect(Math.hypot(x1, y1)).toBeCloseTo(MINIMAL.ringR, 1)
    expect(y0).toBeLessThan(0)
    expect(x0).toBeCloseTo(-x1, 2)
  })

  it('the realistic wheel: three spokes from the hub to the rim, left, right and down', () => {
    const spokes = REALISTIC.spokes.split('Z').filter((s) => s !== '')
    expect(spokes).toHaveLength(3)
    const inner = REALISTIC.rimR - REALISTIC.rimW / 2
    const centres = spokes.map((d) => {
      const p = points(d)
      const far = Math.max(...p.map((q) => Math.hypot(...q)))
      expect(far).toBeGreaterThan(inner)
      expect(far).toBeLessThan(REALISTIC.rimR + REALISTIC.rimW / 2)
      const mean = (k: 0 | 1): number => p.reduce((s, q) => s + q[k], 0) / p.length
      return [mean(0), mean(1)] as const
    })
    expect(centres[0]![0]).toBeLessThan(0)
    expect(centres[1]![0]).toBeGreaterThan(0)
    expect(centres[2]![1]).toBeGreaterThan(0)
    expect(Math.abs(centres[2]![0])).toBeLessThan(0.01)
    expect(REALISTIC.padR).toBeLessThan(REALISTIC.hubR)
    // The stripe crosses the rim at 12 o'clock.
    const m = /^M0 (-?[\d.]+)V(-?[\d.]+)$/.exec(REALISTIC.mark)
    expect(Number(m![1])).toBeCloseTo(-(REALISTIC.rimR + REALISTIC.rimW / 2))
    expect(Number(m![2])).toBeCloseTo(-inner)
  })

  it('the formula wheel: one outline flaring into handles, grips inside, the mark on top', () => {
    // One closed outline: the handles are part of the body, not shapes standing off it.
    expect(FORMULA.body.match(/M/g)).toHaveLength(1)
    const p = points(FORMULA.body)
    const xs = p.map((q) => q[0])
    const ys = p.map((q) => q[1])
    expect(Math.max(...xs)).toBeCloseTo(FORMULA.bodyHalfW)
    expect(Math.min(...xs)).toBeCloseTo(-FORMULA.bodyHalfW)
    // The handles hang below the body between them: an open bottom, a flat top.
    expect(Math.max(...ys)).toBeGreaterThan(FORMULA.bodyBottom + 2)
    expect(Math.min(...ys)).toBeCloseTo(FORMULA.bodyTop)
    const [left, right] = FORMULA.grips
    for (const g of [left!, right!]) {
      expect(Math.abs(g.x + g.w / 2)).toBeGreaterThan(FORMULA.handleIn)
      expect(Math.max(Math.abs(g.x), Math.abs(g.x + g.w))).toBeLessThan(FORMULA.bodyHalfW)
      expect(g.y).toBeGreaterThan(FORMULA.bodyTop)
      expect(g.y + g.h).toBeLessThan(Math.max(...ys))
    }
    expect(right!.x).toBeCloseTo(-(left!.x + left!.w))
    expect(FORMULA.screen.x).toBeCloseTo(-(FORMULA.screen.x + FORMULA.screen.w))
    // Few buttons, none in the handles: four at most, between the display and the handles.
    expect(FORMULA.buttons.length).toBeLessThanOrEqual(4)
    for (const [x, , r] of FORMULA.buttons) {
      expect(Math.abs(x) + r).toBeLessThan(FORMULA.handleIn)
      expect(Math.abs(x) - r).toBeGreaterThan(FORMULA.screen.x + FORMULA.screen.w)
    }
    // The mark is centred and stands above the top edge.
    expect(FORMULA.mark.x).toBeCloseTo(-(FORMULA.mark.x + FORMULA.mark.w))
    expect(FORMULA.mark.y).toBeLessThan(FORMULA.bodyTop)
    expect(FORMULA.mark.w).toBeGreaterThanOrEqual(3)
  })

  it('a size per option, medium about the wheel of before, all within the info column', () => {
    expect(Object.keys(WHEEL_SIZE_EM)).toEqual(OPTION_SCHEMA.inputs.wheelSize.values)
    expect(WHEEL_SIZE_EM.small).toBeLessThan(WHEEL_SIZE_EM.medium)
    expect(WHEEL_SIZE_EM.medium).toBeLessThan(WHEEL_SIZE_EM.large)
    // The info column is 3.4 em wide.
    expect(WHEEL_SIZE_EM.large).toBeLessThanOrEqual(3.4)
  })
})
