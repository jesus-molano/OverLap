import { describe, expect, it } from 'vitest'
import type { ElementSize } from './useElementSize'
import { longFits } from './useLongFits'

const size = (w: number, h = 12): ElementSize => ({ w, h, dpr: 1 })

describe('longFits (R50)', () => {
  it('takes the long words only where they fit the room the line has', () => {
    expect(longFits(size(200), size(260))).toBe(true)
    expect(longFits(size(260), size(260))).toBe(true)
    expect(longFits(size(260.4), size(260))).toBe(true)
    expect(longFits(size(270), size(260))).toBe(false)
  })

  it('keeps the short words until both are measured', () => {
    expect(longFits(size(0, 0), size(260))).toBe(false)
    expect(longFits(size(100), size(0, 0))).toBe(false)
  })
})
