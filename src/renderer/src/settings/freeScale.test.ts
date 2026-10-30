import { describe, expect, it } from 'vitest'
import { WIDGET_DEFS } from '@shared/widgets'
import { freeScaleBounds, freeScalePercent } from './freeScale'

const REL = WIDGET_DEFS.relative

describe('free-size «Escala» (R09)', () => {
  it('reads the window as a share of its factory width', () => {
    expect(freeScalePercent(REL.defaultBounds, REL.defaultBounds)).toBe(100)
    expect(freeScalePercent({ ...REL.defaultBounds, width: 575 }, REL.defaultBounds)).toBe(125)
    expect(freeScalePercent({ ...REL.defaultBounds, width: 345 }, REL.defaultBounds)).toBe(75)
  })

  it('resizes about the centre, keeping the shape given to it', () => {
    const now = { x: 100, y: 200, width: 460, height: 300 }
    const out = freeScaleBounds(now, REL.defaultBounds, 150, REL.minSize)
    expect(out.width).toBe(690)
    expect(out.height).toBe(450)
    expect(out.x + out.width / 2).toBe(now.x + now.width / 2)
    expect(out.y + out.height / 2).toBe(now.y + now.height / 2)
    expect(freeScalePercent(out, REL.defaultBounds)).toBe(150)
  })

  it('never goes under the minimum size', () => {
    const out = freeScaleBounds(REL.defaultBounds, REL.defaultBounds, 10, REL.minSize)
    expect(out.width).toBe(REL.minSize.width)
    expect(out.height).toBeGreaterThanOrEqual(REL.minSize.height)
  })
})

describe('free-size «Escala» times the text size (R09)', () => {
  it('reads 100 % at the factory width times the text size', () => {
    const at150 = { ...REL.defaultBounds, width: REL.defaultBounds.width * 1.5 }
    expect(freeScalePercent(at150, REL.defaultBounds, 150)).toBe(100)
    const out = freeScaleBounds(at150, REL.defaultBounds, 80, REL.minSize, 150)
    expect(out.width).toBe(Math.round(REL.defaultBounds.width * 1.2))
    expect(freeScalePercent(out, REL.defaultBounds, 150)).toBe(80)
  })
})
