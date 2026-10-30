import { describe, expect, it } from 'vitest'
import { NO_GUIDES, SNAP_THRESHOLD, centresOf, snapRect, snapRectGuided } from './snap'
import type { Rect } from './types'

const WORK: Rect = { x: 0, y: 0, width: 1920, height: 1040 }
/** Another widget. */
const OTHER: Rect = { x: 600, y: 300, width: 300, height: 200 }

const rect = (x: number, y: number, width = 200, height = 100): Rect => ({ x, y, width, height })

describe('snapRect: move', () => {
  it('uses an 8 DIP threshold', () => {
    expect(SNAP_THRESHOLD).toBe(8)
    // Left edge 8 px right of the work area edge: snaps; 9 px: does not.
    expect(snapRect(rect(8, 500), 'move', [], [WORK])).toEqual(rect(0, 500))
    expect(snapRect(rect(9, 500), 'move', [], [WORK])).toEqual(rect(9, 500))
  })

  it('snaps to the display work area on every side, keeping the size', () => {
    expect(snapRect(rect(1715, 935), 'move', [], [WORK])).toEqual(rect(1720, 940))
    expect(snapRect(rect(-6, -3), 'move', [], [WORK])).toEqual(rect(0, 0))
  })

  it('touches another widget with no gap, or aligns with it', () => {
    // Our right edge (395 + 200) next to OTHER's left edge (600): touching.
    expect(snapRect(rect(395, 340), 'move', [OTHER], [])).toEqual(rect(400, 340))
    // Our left edge next to OTHER's left edge: aligned.
    expect(snapRect(rect(605, 520), 'move', [OTHER], [])).toEqual(rect(600, 520))
    // Our top edge next to OTHER's bottom edge (500).
    expect(snapRect(rect(1000, 504), 'move', [OTHER], [])).toEqual(rect(1000, 500))
  })

  it('takes the nearest line when both edges are in range', () => {
    // Left edge 6 px from 600, right edge 3 px from 900 (OTHER's right): the right edge wins.
    expect(snapRect(rect(594, 0, 303), 'move', [OTHER], [])).toEqual(rect(597, 0, 303))
  })

  it('does nothing with a threshold of 0 or less, but rounds', () => {
    expect(snapRect(rect(3.4, 2.6), 'move', [OTHER], [WORK], 0)).toEqual(rect(3, 3))
    expect(snapRect(rect(3, 3), 'move', [OTHER], [WORK], -1)).toEqual(rect(3, 3))
  })
})

describe('snapRect: resize', () => {
  it('only snaps the edges the handle moves', () => {
    // East handle: the right edge snaps to OTHER's left; the left edge (5 px from 0) stays.
    expect(snapRect(rect(5, 300, 590), 'e', [OTHER], [WORK])).toEqual(rect(5, 300, 595))
    // West handle: the left edge snaps to the work area, the right edge stays at 595.
    expect(snapRect(rect(5, 300, 590), 'w', [OTHER], [WORK])).toEqual(rect(0, 300, 595))
  })

  it('snaps both edges of a corner handle', () => {
    const r = snapRect({ x: 100, y: 100, width: 496, height: 396 }, 'se', [OTHER], [])
    expect(r).toEqual({ x: 100, y: 100, width: 500, height: 400 })
    const nw = snapRect({ x: 604, y: 504, width: 100, height: 100 }, 'nw', [OTHER], [])
    expect(nw).toEqual({ x: 600, y: 500, width: 104, height: 104 })
  })

  it('never shrinks below the minimum size', () => {
    // Snapping the right edge to 600 would make it 95 wide, below the 100 minimum.
    expect(snapRect(rect(505, 0, 102), 'e', [OTHER], [], 8, { width: 100, height: 60 })).toEqual(
      rect(505, 0, 102)
    )
    // Growing is always fine.
    expect(snapRect(rect(500, 0, 96), 'e', [OTHER], [], 8, { width: 100, height: 60 })).toEqual(
      rect(500, 0, 100)
    )
  })
})

describe('snap guides and the display centre (R38)', () => {
  const DISPLAY: Rect = { x: 0, y: 0, width: 1920, height: 1080 }

  it('says which line each axis snapped to', () => {
    const other: Rect = { x: 500, y: 100, width: 300, height: 200 }
    const r = snapRectGuided(
      { x: 803, y: 304, width: 200, height: 100 },
      'move',
      [other],
      [DISPLAY]
    )
    expect(r.rect).toEqual({ x: 800, y: 300, width: 200, height: 100 })
    expect(r.guides).toEqual({ xs: [800], ys: [300] })
  })

  it('centres a moved rect on the display, and draws that line', () => {
    const r = snapRectGuided(
      { x: 863, y: 20, width: 200, height: 100 },
      'move',
      [],
      [DISPLAY],
      SNAP_THRESHOLD,
      { width: 0, height: 0 },
      centresOf([DISPLAY])
    )
    expect(r.rect.x).toBe(860)
    expect(r.guides.xs).toEqual([960])
    // Without centres (snapRect, a resize) nothing changes.
    expect(snapRect({ x: 863, y: 20, width: 200, height: 100 }, 'move', [], [DISPLAY]).x).toBe(863)
  })

  it('has no guides when nothing snapped', () => {
    expect(
      snapRectGuided({ x: 400, y: 400, width: 10, height: 10 }, 'move', [], [DISPLAY]).guides
    ).toBe(NO_GUIDES)
  })
})
