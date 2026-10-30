import { describe, expect, it } from 'vitest'
import { parseAccelerator, formatAccelerator } from './accelerator'
import { NUDGE_BIG, NUDGE_KEYS, nudgeRect } from './nudge'

const AREA = { x: 0, y: 0, width: 1920, height: 1080 }
const MIN = { width: 120, height: 60 }
const R = { x: 100, y: 200, width: 400, height: 300 }

describe('edit mode keys (R38)', () => {
  it('moves by 1 px, 10 with Shift; resizes with Ctrl', () => {
    expect(NUDGE_KEYS.Left).toEqual({ dx: -1, dy: 0, dw: 0, dh: 0 })
    expect(NUDGE_KEYS['Shift+Down']).toEqual({ dx: 0, dy: NUDGE_BIG, dw: 0, dh: 0 })
    expect(NUDGE_KEYS['Ctrl+Right']).toEqual({ dx: 0, dy: 0, dw: 1, dh: 0 })
    expect(NUDGE_KEYS['Ctrl+Shift+Up']).toEqual({ dx: 0, dy: 0, dw: 0, dh: -NUDGE_BIG })
    expect(Object.keys(NUDGE_KEYS)).toHaveLength(16)
  })

  it('spells every combination as the shortcuts do, so one of yours wins over it', () => {
    for (const key of Object.keys(NUDGE_KEYS)) {
      const parsed = parseAccelerator(key)
      expect(parsed.ok, key).toBe(true)
      if (parsed.ok) expect(formatAccelerator(parsed.value)).toBe(key)
    }
  })

  it('moves and resizes the rect, inside its display, never below the minimum', () => {
    expect(nudgeRect(R, NUDGE_KEYS.Left!, MIN, AREA, false)).toEqual({ ...R, x: 99 })
    expect(nudgeRect(R, NUDGE_KEYS['Shift+Up']!, MIN, AREA, false)).toEqual({ ...R, y: 190 })
    expect(nudgeRect(R, NUDGE_KEYS['Ctrl+Right']!, MIN, AREA, false)).toEqual({ ...R, width: 401 })
    expect(nudgeRect(R, NUDGE_KEYS['Ctrl+Down']!, MIN, AREA, false)).toEqual({ ...R, height: 301 })
    // The display's edge stops it.
    const edge = { ...R, x: 0 }
    expect(nudgeRect(edge, NUDGE_KEYS['Shift+Left']!, MIN, AREA, false)).toEqual(edge)
    const right = { ...R, x: 1520 }
    expect(nudgeRect(right, NUDGE_KEYS['Ctrl+Right']!, MIN, AREA, false)).toEqual(right)
    // The minimum size stops it.
    const small = { ...R, width: 120 }
    expect(nudgeRect(small, NUDGE_KEYS['Ctrl+Left']!, MIN, AREA, false)).toEqual(small)
  })

  it('never changes the height of a widget that fits its content', () => {
    expect(nudgeRect(R, NUDGE_KEYS['Ctrl+Down']!, MIN, AREA, true)).toEqual(R)
    expect(nudgeRect(R, NUDGE_KEYS.Down!, MIN, AREA, true)).toEqual({ ...R, y: 201 })
  })
})
