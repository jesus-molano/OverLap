import { describe, expect, it } from 'vitest'
import { SAMPLE_MAX_HEIGHT_PX, sampleBox } from './sampleBox'

describe('sampleBox', () => {
  it('draws the widget at its real size when the page has room', () => {
    expect(sampleBox(460, 296, 600)).toEqual({
      width: 460,
      height: 296,
      scale: 1,
      outerWidth: 460,
      outerHeight: 296
    })
  })

  it('keeps the real layout size and scales the whole widget down to the page width', () => {
    const box = sampleBox(540, 300, 450)
    expect(box.width).toBe(540)
    expect(box.height).toBe(300)
    expect(box.scale).toBeCloseTo(450 / 540, 6)
    expect(box.outerWidth).toBe(450)
    expect(box.outerHeight).toBe(250)
  })

  it('caps the height, like a short window would', () => {
    expect(sampleBox(460, 2000, 600).height).toBe(SAMPLE_MAX_HEIGHT_PX)
  })

  it('survives unusable numbers', () => {
    expect(sampleBox(Number.NaN, -5, 0)).toMatchObject({ width: 1, height: 1, scale: 1 })
    expect(sampleBox(300, 100, Number.NaN).scale).toBe(1)
  })
})
