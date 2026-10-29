import { describe, expect, it } from 'vitest'
import { SAMPLE_MAX_HEIGHT_PX, SAMPLE_ZOOM, sampleBox, sampleZoom } from './sampleBox'

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
