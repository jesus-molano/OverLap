import { describe, expect, it } from 'vitest'
import type { Rect } from '@shared/types'
import {
  MAX_CONTENT_HEIGHT,
  sanitizeContentHeight,
  slotRect,
  slotStyle,
  type SlotRectInput
} from './slotGeometry'

const WORK: Rect = { x: 0, y: 0, width: 1920, height: 1040 }
const BASE: Rect = { x: 100, y: 200, width: 460, height: 300 }

function input(o: Partial<SlotRectInput> = {}): SlotRectInput {
  return {
    base: BASE,
    autoHeight: true,
    anchor: 'top',
    fitted: null,
    workArea: WORK,
    minHeight: 60,
    ...o
  }
}

describe('slotRect', () => {
  it('draws the base itself without auto height or before the first fit', () => {
    expect(slotRect(input({ autoHeight: false, fitted: 420 }))).toBe(BASE)
    expect(slotRect(input({ fitted: null }))).toBe(BASE)
    expect(slotRect(input({ fitted: 300 }))).toBe(BASE)
  })

  it('applies the fitted height, keeping the anchored edge', () => {
    expect(slotRect(input({ fitted: 420 }))).toEqual({ x: 100, y: 200, width: 460, height: 420 })
    expect(slotRect(input({ fitted: 250, anchor: 'bottom' }))).toEqual({
      x: 100,
      y: 250,
      width: 460,
      height: 250
    })
  })

  it('never grows past the work area on the growing side, nor below the minimum', () => {
    expect(slotRect(input({ fitted: 5_000 })).height).toBe(840)
    expect(slotRect(input({ fitted: 5_000, anchor: 'bottom' }))).toEqual({
      x: 100,
      y: 0,
      width: 460,
      height: 500
    })
    expect(slotRect(input({ fitted: 10 })).height).toBe(60)
  })

  it('works on window-local work areas that do not start at 0,0', () => {
    const work = { x: 0, y: 40, width: 1920, height: 1040 }
    expect(slotRect(input({ fitted: 900, anchor: 'bottom', workArea: work })).y).toBe(40)
  })
})

describe('slotStyle', () => {
  it('places both edges of each axis on device pixels', () => {
    expect(slotStyle(BASE, 1)).toEqual({
      left: '100px',
      top: '200px',
      width: '460px',
      height: '300px'
    })
    // x 3 -> 3.75 device px -> 4 -> 3.2 px; right 3 + 461 = 464 -> 580 device px -> 464 px.
    expect(slotStyle({ x: 3, y: 1, width: 461, height: 81 }, 1.25)).toEqual({
      left: '3.2px',
      top: '0.8px',
      width: '460.8px',
      height: '81.6px'
    })
  })

  it('takes an unusable scale factor as 1', () => {
    const r = { x: 3, y: 1, width: 461, height: 81 }
    const at1 = slotStyle(r, 1)
    expect(slotStyle(r, 0)).toEqual(at1)
    expect(slotStyle(r, Number.NaN)).toEqual(at1)
  })

  it('writes lengths without float noise', () => {
    const s = slotStyle({ x: 7, y: 11, width: 301, height: 99 }, 1.1)
    for (const v of Object.values(s)) expect(v).toMatch(/^\d+(\.\d{1,4})?px$/)
  })
})

describe('sanitizeContentHeight', () => {
  it('rounds up, ignoring float noise', () => {
    expect(sanitizeContentHeight(201.3)).toBe(202)
    expect(sanitizeContentHeight(200.005)).toBe(200)
    expect(sanitizeContentHeight(0.4)).toBe(1)
  })

  it('rejects heights no panel can have', () => {
    expect(sanitizeContentHeight(0)).toBeNull()
    expect(sanitizeContentHeight(-5)).toBeNull()
    expect(sanitizeContentHeight(Number.NaN)).toBeNull()
    expect(sanitizeContentHeight(Number.POSITIVE_INFINITY)).toBeNull()
    expect(sanitizeContentHeight(MAX_CONTENT_HEIGHT)).toBe(MAX_CONTENT_HEIGHT)
    expect(sanitizeContentHeight(MAX_CONTENT_HEIGHT + 1)).toBeNull()
  })
})
