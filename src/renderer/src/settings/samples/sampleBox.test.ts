import { describe, expect, it } from 'vitest'
import {
  SAMPLE_MAX_HEIGHT_PX,
  SAMPLE_CROP_BELOW,
  SAMPLE_ZOOM,
  sampleBox,
  sampleZoom,
  stageCrop
} from './sampleBox'

describe('sampleBox', () => {
  it('draws the widget at its real size when the page has room', () => {
    expect(sampleBox(460, 296, 600)).toEqual({
      width: 460,
      height: 296,
      scale: 1,
      outerWidth: 460,
      outerHeight: 296,
      cropped: false
    })
  })

  it('below 75 % draws the real size and scrolls to the rest instead (R53)', () => {
    // The standings (680 px) on the 760 px window's stage (~455 px): 67 % would put its 9 px
    // captions at 6 px.
    const box = sampleBox(680, 400, 455)
    expect(box.scale).toBe(1)
    expect(box.outerWidth).toBe(680)
    expect(box.outerHeight).toBe(400)
    expect(box.cropped).toBe(true)
    // At 75 % and above it still fits the page.
    expect(sampleBox(540, 300, 450)).toMatchObject({ cropped: false })
    expect(sampleBox(600, 300, 600 * SAMPLE_CROP_BELOW)).toMatchObject({ scale: 0.75 })
  })

  it('gives the stage the crop that keeps the whole at 75 % or more', () => {
    expect(stageCrop(1)).toEqual({ below: SAMPLE_CROP_BELOW, scale: 1 })
    // Already at the floor from the width: any more and it crops, at its real size.
    expect(stageCrop(SAMPLE_CROP_BELOW)).toEqual({ below: 1, scale: 1 })
    expect(stageCrop(0.9).below).toBeCloseTo(0.75 / 0.9, 9)
    // Zoomed in a wide page: back to 1:1 before it crops.
    expect(stageCrop(1.5)).toEqual({ below: 0.5, scale: 1 / 1.5 })
    expect(stageCrop(Number.NaN)).toEqual({ below: SAMPLE_CROP_BELOW, scale: 1 })
  })

  it('keeps the real layout size and scales the whole widget down to the page width', () => {
    const box = sampleBox(540, 300, 450)
    expect(box.width).toBe(540)
    expect(box.height).toBe(300)
    expect(box.scale).toBeCloseTo(450 / 540, 6)
    expect(box.outerWidth).toBe(450)
    expect(box.outerHeight).toBe(250)
  })

  it('stays 1:1 at the normal window size and grows in a wide one (A11)', () => {
    // The 880 px window's stage (~800 px): the real size.
    expect(sampleBox(460, 296, 800).scale).toBe(1)
    expect(sampleZoom(SAMPLE_ZOOM.fromPx)).toBe(1)
    // A maximised 1920 px window (~1480 px of stage): about 1.5x, never cut by the width.
    const wide = sampleBox(460, 296, 1480)
    expect(wide.scale).toBeCloseTo(1.48, 6)
    expect(wide.outerWidth).toBe(680)
    // Ultrawide: capped, and never wider than the page.
    expect(sampleBox(460, 296, 3000).scale).toBe(SAMPLE_ZOOM.max)
    expect(sampleBox(1600, 296, 1700).scale).toBeCloseTo(1700 / 1600, 6)
  })

  it('caps the height, like a short window would', () => {
    expect(sampleBox(460, 2000, 600).height).toBe(SAMPLE_MAX_HEIGHT_PX)
  })

  it('survives unusable numbers', () => {
    expect(sampleBox(Number.NaN, -5, 0)).toMatchObject({ width: 1, height: 1, scale: 1 })
    expect(sampleBox(300, 100, Number.NaN).scale).toBe(1)
  })
})
