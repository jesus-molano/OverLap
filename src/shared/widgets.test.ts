import { describe, expect, it } from 'vitest'
import type { Rect } from './types'
import {
  ALERTS_DEFAULT_ROOM,
  PAINT_ORDER,
  TOPMOST_WIDGET,
  WIDGET_DEFS,
  WIDGET_IDS,
  type WidgetId
} from './widgets'

/** What each widget takes on a fresh 1920 x 1080 layout: the alerts with their room to grow. */
function footprint(id: WidgetId): Rect {
  const b = WIDGET_DEFS[id].defaultBounds
  return id === 'alerts' ? { ...b, height: ALERTS_DEFAULT_ROOM } : b
}

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

describe('default layout', () => {
  it('places every widget on a 1920 x 1080 display, above the taskbar, none over another', () => {
    for (const id of WIDGET_IDS) {
      const r = footprint(id)
      // 1040: the work area of that display with the taskbar at the bottom.
      expect(r.x >= 0 && r.y >= 0 && r.x + r.width <= 1920 && r.y + r.height <= 1040, id).toBe(true)
    }
    for (const [i, a] of WIDGET_IDS.entries()) {
      for (const b of WIDGET_IDS.slice(i + 1)) {
        expect(overlaps(footprint(a), footprint(b)), `${a} / ${b}`).toBe(false)
      }
    }
  })

  it('leaves the alerts room above the delta for their tallest content at 100 %', () => {
    const alerts = WIDGET_DEFS.alerts.defaultBounds
    expect(WIDGET_DEFS.delta.defaultBounds.y - alerts.y).toBeGreaterThanOrEqual(ALERTS_DEFAULT_ROOM)
    // Measured in the overlay: the edit-mode sample 111 px, two flags + incident + limiter 120 px.
    expect(ALERTS_DEFAULT_ROOM).toBeGreaterThanOrEqual(120)
  })
})

describe('PAINT_ORDER', () => {
  it('paints every widget once, the radar last (above the alerts banner, B05)', () => {
    expect([...PAINT_ORDER].sort()).toEqual([...WIDGET_IDS].sort())
    expect(TOPMOST_WIDGET).toBe('radar')
    expect(PAINT_ORDER.at(-1)).toBe('radar')
    expect(PAINT_ORDER.indexOf('alerts')).toBeLessThan(PAINT_ORDER.indexOf('radar'))
    // The others keep their registry order.
    expect(PAINT_ORDER.slice(0, -1)).toEqual(WIDGET_IDS.filter((id) => id !== 'radar'))
  })
})
