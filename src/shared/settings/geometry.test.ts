import { describe, expect, it } from 'vitest'
import type { Rect } from '../types'
import {
  applyDrag,
  clampRectToDisplay,
  clampRectToDisplays,
  defaultBoundsIn,
  defaultLayoutOffsetX,
  isRectVisible,
  pickDisplay,
  restoreBounds
} from '.'

const PRIMARY: Rect = { x: 0, y: 0, width: 1920, height: 1080 }
const PRIMARY_WORK: Rect = { x: 0, y: 0, width: 1920, height: 1032 }
const LEFT: Rect = { x: -1920, y: 0, width: 1920, height: 1080 }
const DISPLAYS = [PRIMARY, LEFT]

describe('isRectVisible', () => {
  it('accepts a rect fully on a display, including the negative-x one', () => {
    expect(isRectVisible({ x: 100, y: 100, width: 200, height: 200 }, DISPLAYS)).toBe(true)
    expect(isRectVisible({ x: -1800, y: 100, width: 200, height: 200 }, DISPLAYS)).toBe(true)
  })

  it('rejects rects that only touch an edge or lie outside every display', () => {
    expect(isRectVisible({ x: 1920, y: 100, width: 200, height: 200 }, DISPLAYS)).toBe(false)
    expect(isRectVisible({ x: 100, y: 1080, width: 200, height: 200 }, DISPLAYS)).toBe(false)
    expect(isRectVisible({ x: -5000, y: 100, width: 200, height: 200 }, DISPLAYS)).toBe(false)
    expect(isRectVisible({ x: 100, y: 100, width: 200, height: 200 }, [])).toBe(false)
  })

  it('needs 48 x 32 px on one display', () => {
    // 48 px wide strip on the right edge of the primary display.
    expect(isRectVisible({ x: 1872, y: 100, width: 300, height: 200 }, [PRIMARY])).toBe(true)
    expect(isRectVisible({ x: 1873, y: 100, width: 300, height: 200 }, [PRIMARY])).toBe(false)
    // 32 px tall strip at the bottom.
    expect(isRectVisible({ x: 100, y: 1048, width: 300, height: 200 }, [PRIMARY])).toBe(true)
    expect(isRectVisible({ x: 100, y: 1049, width: 300, height: 200 }, [PRIMARY])).toBe(false)
  })

  it('needs the overlap on a single display, not split across two', () => {
    // Straddling the seam between LEFT and PRIMARY: 40 px wide on each, below 48.
    expect(isRectVisible({ x: -40, y: 100, width: 80, height: 200 }, DISPLAYS)).toBe(false)
    expect(isRectVisible({ x: -40, y: 100, width: 100, height: 200 }, DISPLAYS)).toBe(true)
  })

  it('lowers the requirement for rects smaller than 48 x 32', () => {
    expect(isRectVisible({ x: 1890, y: 10, width: 30, height: 20 }, [PRIMARY])).toBe(true)
    expect(isRectVisible({ x: 1891, y: 10, width: 30, height: 20 }, [PRIMARY])).toBe(false)
  })
})

describe('pickDisplay / clamping', () => {
  it('picks the display with the largest overlap, else the closest one', () => {
    expect(pickDisplay({ x: -100, y: 0, width: 300, height: 100 }, DISPLAYS)).toBe(PRIMARY)
    expect(pickDisplay({ x: -250, y: 0, width: 300, height: 100 }, DISPLAYS)).toBe(LEFT)
    expect(pickDisplay({ x: -4000, y: 0, width: 300, height: 100 }, DISPLAYS)).toBe(LEFT)
    expect(pickDisplay({ x: 0, y: 0, width: 1, height: 1 }, [])).toBeUndefined()
  })

  it('moves a rect inside the display', () => {
    expect(clampRectToDisplay({ x: 1800, y: -50, width: 300, height: 200 }, PRIMARY)).toEqual({
      x: 1620,
      y: 0,
      width: 300,
      height: 200
    })
    expect(clampRectToDisplay({ x: -2000, y: 1000, width: 300, height: 200 }, LEFT)).toEqual({
      x: -1920,
      y: 880,
      width: 300,
      height: 200
    })
  })

  it('shrinks an oversized rect to the display', () => {
    expect(clampRectToDisplay({ x: -10, y: -10, width: 4000, height: 3000 }, PRIMARY)).toEqual(
      PRIMARY
    )
  })

  it('clamps across a seam into the display it mostly sits on', () => {
    expect(clampRectToDisplays({ x: -100, y: 10, width: 300, height: 100 }, DISPLAYS)).toEqual({
      x: 0,
      y: 10,
      width: 300,
      height: 100
    })
  })
})

describe('restoreBounds', () => {
  const def: Rect = { x: 60, y: 260, width: 460, height: 252 }

  it('keeps visible saved bounds', () => {
    const saved = { x: 300, y: 400, width: 500, height: 260 }
    expect(restoreBounds(saved, def, DISPLAYS, PRIMARY_WORK)).toEqual(saved)
  })

  it('keeps saved bounds on the second display at negative x', () => {
    const saved = { x: -1700, y: 300, width: 460, height: 252 }
    expect(restoreBounds(saved, def, DISPLAYS, PRIMARY_WORK)).toEqual(saved)
  })

  it('falls back to the default when the saved display is gone', () => {
    const saved = { x: -1700, y: 300, width: 460, height: 252 }
    expect(restoreBounds(saved, def, [PRIMARY], PRIMARY_WORK)).toEqual(def)
  })

  it('falls back to the default for off-screen, missing or invalid bounds', () => {
    expect(
      restoreBounds({ x: 5000, y: 5000, width: 200, height: 200 }, def, DISPLAYS, PRIMARY_WORK)
    ).toEqual(def)
    expect(restoreBounds(undefined, def, DISPLAYS, PRIMARY_WORK)).toEqual(def)
    expect(
      restoreBounds({ x: 10, y: 10, width: 0, height: 200 }, def, DISPLAYS, PRIMARY_WORK)
    ).toEqual(def)
    expect(
      restoreBounds({ x: Number.NaN, y: 10, width: 100, height: 200 }, def, DISPLAYS, PRIMARY_WORK)
    ).toEqual(def)
  })

  it('offsets the default into the primary work area and clamps it', () => {
    const work: Rect = { x: 0, y: 40, width: 1920, height: 1040 }
    expect(restoreBounds(undefined, def, DISPLAYS, work)).toEqual({ ...def, y: 300 })
    const small: Rect = { x: 0, y: 0, width: 400, height: 300 }
    expect(restoreBounds(undefined, def, [small], small)).toEqual({
      x: 0,
      y: 48,
      width: 400,
      height: 252
    })
  })

  it('clamps partly off-screen and oversized saved bounds, rounding them', () => {
    expect(
      restoreBounds({ x: 1800.4, y: 100, width: 400, height: 200 }, def, DISPLAYS, PRIMARY_WORK)
    ).toEqual({ x: 1520, y: 100, width: 400, height: 200 })
    expect(
      restoreBounds({ x: -100, y: -100, width: 5000, height: 5000 }, def, DISPLAYS, PRIMARY_WORK)
    ).toEqual(PRIMARY)
  })

  it('uses display bounds, not the work area, for saved bounds', () => {
    // Over the taskbar area (y 1032..1080): fine, the game covers the whole monitor.
    const saved = { x: 100, y: 880, width: 300, height: 200 }
    expect(restoreBounds(saved, def, DISPLAYS, PRIMARY_WORK)).toEqual(saved)
  })

  it('treats an empty display list as the primary work area', () => {
    expect(restoreBounds({ x: 10, y: 10, width: 300, height: 200 }, def, [], PRIMARY_WORK)).toEqual(
      { x: 10, y: 10, width: 300, height: 200 }
    )
  })
})

describe('applyDrag', () => {
  const start: Rect = { x: 100, y: 100, width: 300, height: 200 }
  const min = { width: 120, height: 140 }

  it('translates on move, rounding', () => {
    expect(applyDrag(start, 'move', -250.6, 10.2, min)).toEqual({
      x: -151,
      y: 110,
      width: 300,
      height: 200
    })
  })

  it('grows and shrinks from the east and south edges', () => {
    expect(applyDrag(start, 'e', 50, 999, min)).toEqual({ ...start, width: 350 })
    expect(applyDrag(start, 's', 999, -30, min)).toEqual({ ...start, height: 170 })
    expect(applyDrag(start, 'se', 20, 30, min)).toEqual({ ...start, width: 320, height: 230 })
  })

  it('moves the origin for west and north edges', () => {
    expect(applyDrag(start, 'w', -40, 0, min)).toEqual({ ...start, x: 60, width: 340 })
    expect(applyDrag(start, 'n', 0, 30, min)).toEqual({ ...start, y: 130, height: 170 })
    expect(applyDrag(start, 'nw', 10, 10, min)).toEqual({ x: 110, y: 110, width: 290, height: 190 })
    expect(applyDrag(start, 'ne', 10, -10, min)).toEqual({
      x: 100,
      y: 90,
      width: 310,
      height: 210
    })
    expect(applyDrag(start, 'sw', 10, 10, min)).toEqual({ x: 110, y: 100, width: 290, height: 210 })
  })

  it('respects the minimum size keeping the opposite edge fixed', () => {
    expect(applyDrag(start, 'e', -1000, 0, min)).toEqual({ ...start, width: 120 })
    expect(applyDrag(start, 'w', 1000, 0, min)).toEqual({ ...start, x: 280, width: 120 })
    expect(applyDrag(start, 'n', 0, 1000, min)).toEqual({ ...start, y: 160, height: 140 })
    expect(applyDrag(start, 's', 0, -1000, min)).toEqual({ ...start, height: 140 })
  })
})

describe('the default layout on an ultrawide screen', () => {
  it('stays where it is up to 16:9, and moves to the middle of a wider work area', () => {
    expect(defaultLayoutOffsetX({ width: 1920, height: 1040 })).toBe(0)
    expect(defaultLayoutOffsetX({ width: 2560, height: 1400 })).toBe(0)
    expect(defaultLayoutOffsetX({ width: 3440, height: 1400 })).toBe(760)
    expect(defaultLayoutOffsetX({ width: 5120, height: 1400 })).toBe(1600)
    // Three 1080p screens as one (NVIDIA Surround): the middle one.
    expect(defaultLayoutOffsetX({ width: 5760, height: 1040 })).toBe(1920)
    expect(defaultLayoutOffsetX({ width: 0, height: 0 })).toBe(0)
  })

  it('places a default rect in the work area, its origin included', () => {
    const def = { x: 60, y: 260, width: 460, height: 252 }
    expect(defaultBoundsIn(def, PRIMARY_WORK)).toEqual(def)
    expect(defaultBoundsIn(def, { x: -3440, y: 0, width: 3440, height: 1400 })).toEqual({
      ...def,
      x: -3440 + 760 + 60
    })
    // restoreBounds falls back to the same place.
    const wide = { x: 0, y: 0, width: 3440, height: 1400 }
    expect(restoreBounds(undefined, def, [wide], wide)).toEqual({ ...def, x: 820 })
  })
})
