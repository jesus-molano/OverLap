import { describe, expect, it } from 'vitest'
import { NO_GUIDES } from '@shared/snap'
import type { Rect } from '@shared/types'
import {
  canStart,
  confineResize,
  dragRect,
  dragSnap,
  grabOffset,
  handlesFor,
  isOutside,
  type DragContext
} from './dragMath'

const rect = (x: number, y: number, width: number, height: number): Rect => ({
  x,
  y,
  width,
  height
})

/** A display that does not start at 0,0 (the renderer never assumes it does). */
const DISPLAY = rect(100, 50, 1000, 800)
/** Its work area: a 40 px taskbar at the bottom. */
const WORK = rect(100, 50, 1000, 760)
const MIN = { width: 120, height: 60 }

function ctx(targets: Rect[] = []): DragContext {
  return { minSize: MIN, display: DISPLAY, workArea: WORK, targets }
}

describe('handlesFor / canStart', () => {
  it('offers the sides only when the height follows the content', () => {
    expect(handlesFor(true)).toEqual(['e', 'w'])
    expect(handlesFor(false)).toEqual(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'])
  })

  it('never lets an auto-height drag move the top or bottom edge', () => {
    expect(canStart('move', true)).toBe(true)
    expect(canStart('e', true)).toBe(true)
    expect(canStart('w', true)).toBe(true)
    for (const h of ['n', 's', 'ne', 'nw', 'se', 'sw'] as const)
      expect(canStart(h, true)).toBe(false)
    for (const h of handlesFor(false)) expect(canStart(h, false)).toBe(true)
  })
})

describe('dragRect: move', () => {
  const start = rect(400, 300, 200, 100)

  it('follows the pointer, keeping the size', () => {
    expect(dragRect(start, 'move', 37, -21, ctx(), false)).toEqual(rect(437, 279, 200, 100))
  })

  it('snaps to another panel and to the display edges unless noSnap', () => {
    const other = rect(700, 100, 100, 100)
    // Right edge 600 + 95 = 695, 5 px from the other panel's left edge (700): touches it.
    expect(dragRect(start, 'move', 95, 0, ctx([other]), false)).toEqual(rect(500, 300, 200, 100))
    expect(dragRect(start, 'move', 95, 0, ctx([other]), true)).toEqual(rect(495, 300, 200, 100))
    // Left edge 6 px right of the display's left edge (100): snaps to it.
    expect(dragRect(start, 'move', -294, 0, ctx(), false)).toEqual(rect(100, 300, 200, 100))
  })

  it('snaps the bottom edge to the work area (above the taskbar)', () => {
    // Bottom edge 400 + 406 = 806, 4 px above the work-area bottom (810).
    expect(dragRect(start, 'move', 0, 406, ctx(), false)).toEqual(rect(400, 710, 200, 100))
  })

  it('stays inside the display, whose origin is not 0,0', () => {
    expect(dragRect(start, 'move', -2000, -2000, ctx(), true)).toEqual(rect(100, 50, 200, 100))
    expect(dragRect(start, 'move', 5000, 5000, ctx(), true)).toEqual(rect(900, 750, 200, 100))
  })
})

describe('dragRect: resize', () => {
  const start = rect(400, 300, 200, 100)

  it('moves only the named edges, never below the minimum size', () => {
    expect(dragRect(start, 'e', 50, 999, ctx(), true)).toEqual(rect(400, 300, 250, 100))
    expect(dragRect(start, 'w', 30, 0, ctx(), true)).toEqual(rect(430, 300, 170, 100))
    expect(dragRect(start, 'nw', 500, 500, ctx(), true)).toEqual(rect(480, 340, 120, 60))
    expect(dragRect(start, 'se', -500, -500, ctx(), true)).toEqual(rect(400, 300, 120, 60))
  })

  it('stops each moving edge at the display edge; the opposite edges stay', () => {
    expect(dragRect(start, 'w', -1000, 0, ctx(), true)).toEqual(rect(100, 300, 500, 100))
    expect(dragRect(start, 'se', 5000, 5000, ctx(), true)).toEqual(rect(400, 300, 700, 550))
    expect(dragRect(start, 'n', 0, -5000, ctx(), true)).toEqual(rect(400, 50, 200, 350))
  })

  it('never snaps a resize below the minimum size', () => {
    // The right edge would snap 5 px left onto x = 515, leaving 115 < 120: skipped.
    const target = rect(515, 0, 50, 50)
    const small = rect(400, 300, 121, 100)
    expect(dragRect(small, 'e', -1, 0, ctx([target]), false)).toEqual(rect(400, 300, 120, 100))
  })
})

describe('confineResize', () => {
  it('lets the minimum size win over the area', () => {
    // Right edge at 150 with a 120 minimum: the left edge cannot reach the display's left edge.
    expect(confineResize(rect(30, 300, 120, 100), 'w', DISPLAY, MIN)).toEqual(
      rect(30, 300, 120, 100)
    )
    // Left edge off the display, right edge at 160: confining it would leave 60 px, so it stops
    // at the minimum width.
    expect(confineResize(rect(0, 300, 160, 100), 'w', DISPLAY, MIN)).toEqual(
      rect(40, 300, 120, 100)
    )
  })

  it('keeps a rect that is already inside', () => {
    const r = rect(200, 200, 300, 300)
    for (const h of handlesFor(false)) expect(confineResize(r, h, DISPLAY, MIN)).toEqual(r)
  })
})

describe('isOutside', () => {
  it('is false on the display and true past any edge (right and bottom exclusive)', () => {
    expect(isOutside(100, 50, DISPLAY)).toBe(false)
    expect(isOutside(1099.5, 849.5, DISPLAY)).toBe(false)
    expect(isOutside(99.5, 400, DISPLAY)).toBe(true)
    expect(isOutside(400, 49, DISPLAY)).toBe(true)
    expect(isOutside(1100, 400, DISPLAY)).toBe(true)
    expect(isOutside(400, 850, DISPLAY)).toBe(true)
  })
})

describe('grabOffset', () => {
  it('is the pointer relative to the panel, within its size', () => {
    const start = rect(400, 300, 200, 100)
    expect(grabOffset({ x: 450.4, y: 310.6 }, start)).toEqual({ x: 50, y: 11 })
    expect(grabOffset({ x: 390, y: 290 }, start)).toEqual({ x: 0, y: 0 })
    expect(grabOffset({ x: 900, y: 900 }, start)).toEqual({ x: 200, y: 100 })
  })
})

describe('dragSnap (R38)', () => {
  const display = rect(0, 0, 1920, 1080)
  const c: DragContext = {
    minSize: { width: 120, height: 60 },
    display,
    workArea: rect(0, 0, 1920, 1040),
    targets: [rect(1000, 200, 300, 200)]
  }

  it('gives the lines a move snapped to, the display middle included', () => {
    const start = rect(700, 500, 200, 100)
    const toEdge = dragSnap(start, 'move', 97, 0, c, false)
    expect(toEdge.rect.x).toBe(800)
    expect(toEdge.guides.xs).toEqual([1000])
    const toMiddle = dragSnap(start, 'move', 157, 0, c, false)
    expect(toMiddle.rect.x).toBe(860)
    expect(toMiddle.guides.xs).toEqual([960])
    // Alt (or Shift): no snapping, no guides.
    expect(dragSnap(start, 'move', 157, 0, c, true).guides).toBe(NO_GUIDES)
    expect(dragRect(start, 'move', 157, 0, c, false)).toEqual(toMiddle.rect)
  })

  it('draws the display edge it snapped to, and none when the edge only stopped it', () => {
    const atEdge = dragSnap(rect(10, 10, 200, 100), 'move', -5, 0, c, false)
    expect(atEdge.rect.x).toBe(0)
    expect(atEdge.guides.xs).toEqual([0])
    const stopped = dragSnap(rect(10, 650, 200, 100), 'move', -40, 0, c, false)
    expect(stopped.rect.x).toBe(0)
    expect(stopped.guides).toBe(NO_GUIDES)
  })
})
