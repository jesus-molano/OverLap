import { describe, expect, it } from 'vitest'
import { createDefaultSettings } from '@shared/settings'
import type { Rect } from '@shared/types'
import { WIDGET_IDS, type WidgetId } from '@shared/widgets'
import { gatherBounds, gatheredRect } from './gather'
import type { DisplayInfo } from './overlayLayout'

const LEFT: DisplayInfo = {
  id: 1,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  workArea: { x: 0, y: 0, width: 1920, height: 1040 },
  scaleFactor: 1
}
const RIGHT: DisplayInfo = {
  id: 2,
  bounds: { x: 1920, y: 0, width: 2560, height: 1440 },
  workArea: { x: 1920, y: 0, width: 2560, height: 1400 },
  scaleFactor: 1
}

describe('gatheredRect (R51)', () => {
  it('leaves a widget already on the target', () => {
    expect(
      gatheredRect({ x: 100, y: 100, width: 300, height: 200 }, [LEFT, RIGHT], LEFT)
    ).toBeNull()
  })

  it('brings one at the same relative place, with its size', () => {
    // Centred on the right display: centred on the left one.
    const r: Rect = { x: 1920 + 1280 - 150, y: 700 - 100, width: 300, height: 200 }
    expect(gatheredRect(r, [LEFT, RIGHT], LEFT)).toEqual({
      x: 810,
      y: 420,
      width: 300,
      height: 200
    })
  })

  it('keeps it inside the target work area, at an edge too', () => {
    // At the right display's bottom-right corner.
    const r: Rect = { x: 1920 + 2560 - 300, y: 1400 - 200, width: 300, height: 200 }
    expect(gatheredRect(r, [LEFT, RIGHT], LEFT)).toEqual({
      x: 1920 - 300,
      y: 1040 - 200,
      width: 300,
      height: 200
    })
  })

  it('brings back one left on a display that is gone', () => {
    // Saved on a third monitor at the far right, now unplugged.
    const r: Rect = { x: 6000, y: 300, width: 400, height: 250 }
    const out = gatheredRect(r, [LEFT, RIGHT], LEFT)
    expect(out).not.toBeNull()
    const o = out as Rect
    expect(o.x >= 0 && o.x + o.width <= 1920 && o.y >= 0 && o.y + o.height <= 1040).toBe(true)
    expect([o.width, o.height]).toEqual([400, 250])
  })

  it('keeps a widget wider than the target at its left edge', () => {
    const r: Rect = { x: 2000, y: 10, width: 2400, height: 100 }
    expect(gatheredRect(r, [LEFT, RIGHT], LEFT)?.x).toBe(0)
  })
})

describe('gatherBounds (R51)', () => {
  it('moves only the widgets that are not on the target', () => {
    const s = createDefaultSettings()
    const bounds = Object.fromEntries(WIDGET_IDS.map((id) => [id, s.widgets[id].bounds])) as Record<
      WidgetId,
      Rect
    >
    expect(gatherBounds(bounds, [LEFT, RIGHT], LEFT)).toEqual({})
    bounds.fuel = { x: 3000, y: 500, width: 320, height: 190 }
    const out = gatherBounds(bounds, [LEFT, RIGHT], LEFT)
    expect(Object.keys(out)).toEqual(['fuel'])
    // Everything to the right display instead: the nine others move.
    expect(Object.keys(gatherBounds(bounds, [LEFT, RIGHT], RIGHT))).toHaveLength(9)
  })
})
