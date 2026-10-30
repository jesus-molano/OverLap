import { describe, expect, it } from 'vitest'
import { editingLimit, fitScale, stageFit } from './stageFit'

describe('fitScale', () => {
  it('never enlarges what already fits', () => {
    expect(fitScale({ w: 460, h: 200 }, { w: 600, h: 300 })).toBe(1)
    expect(fitScale({ w: 600, h: 300 }, { w: 600, h: 300 })).toBe(1)
  })

  it('shrinks to the tighter side, keeping the proportions', () => {
    // Taller than the stage allows: the height decides.
    expect(fitScale({ w: 600, h: 640 }, { w: 600, h: 256 })).toBeCloseTo(256 / 640, 9)
    // Wider than the stage: the width decides.
    expect(fitScale({ w: 800, h: 100 }, { w: 400, h: 300 })).toBeCloseTo(0.5, 9)
    // Both too big: the smaller factor wins.
    expect(fitScale({ w: 800, h: 600 }, { w: 400, h: 150 })).toBeCloseTo(0.25, 9)
  })

  it('ignores a side that is not known yet', () => {
    expect(fitScale({ w: 600, h: 640 }, { w: 0, h: 320 })).toBeCloseTo(0.5, 9)
    expect(fitScale({ w: 600, h: 640 }, { w: 300, h: Number.NaN })).toBeCloseTo(0.5, 9)
    expect(fitScale({ w: 0, h: 0 }, { w: 300, h: 200 })).toBe(1)
    expect(fitScale({ w: -5, h: Number.POSITIVE_INFINITY }, { w: 300, h: 200 })).toBe(1)
  })
})

describe('stageFit', () => {
  it('takes the content size when it fits', () => {
    expect(stageFit({ w: 600, h: 180 }, { w: 600, h: 250 })).toEqual({
      scale: 1,
      width: 600,
      height: 180,
      cropped: false
    })
  })

  it('takes exactly the box height when the height decides (no 1 px of float noise)', () => {
    for (const [h, max] of [
      [640, 250],
      [613, 251],
      [999, 333],
      [517, 206]
    ] as const) {
      const fit = stageFit({ w: 597, h }, { w: 597, h: max })
      expect(fit.scale).toBeCloseTo(max / h, 9)
      expect(fit.height).toBe(max)
      expect(fit.width).toBeLessThanOrEqual(597)
    }
  })

  it('rounds a fractional side up, so the scaled content is never cut', () => {
    const fit = stageFit({ w: 301, h: 401 }, { w: 1000, h: 200 })
    expect(fit.height).toBe(200)
    expect(fit.width).toBe(Math.ceil(301 * (200 / 401)))
    expect(fit.width).toBeGreaterThanOrEqual(301 * fit.scale)
  })

  it('reports 0 for an unknown side and does not scale', () => {
    expect(stageFit({ w: 0, h: 0 }, { w: 600, h: 250 })).toEqual({
      scale: 1,
      width: 0,
      height: 0,
      cropped: false
    })
  })

  it('below the crop size shows the first rows at the real size (R53)', () => {
    const crop = { below: 0.75, scale: 1 }
    // A 640 px sample in a 250 px stage would be drawn at 39 %.
    const fit = stageFit({ w: 600, h: 640 }, { w: 600, h: 250 }, crop)
    expect(fit.scale).toBe(1)
    expect(fit.height).toBe(250)
    expect(fit.width).toBe(600)
    expect(fit.cropped).toBe(true)
    // At 75 % and above nothing changes.
    expect(stageFit({ w: 600, h: 300 }, { w: 600, h: 250 }, crop)).toMatchObject({
      scale: 250 / 300,
      height: 250,
      cropped: false
    })
  })
})

describe('editingLimit', () => {
  it('keeps the sample at its resting height while ghosts add lines', () => {
    expect(editingLimit(300, 253)).toBe(253)
    expect(editingLimit(200, 253)).toBe(200)
    expect(editingLimit(0, 253)).toBe(253)
    expect(editingLimit(300, 0)).toBe(300)
    // 36 px of ghost rows on a 253 px sample: drawn smaller, the same height.
    const fit = stageFit({ w: 400, h: 289 }, { w: 400, h: editingLimit(300, 253) })
    expect(fit.height).toBe(253)
    expect(fit.scale).toBeCloseTo(253 / 289)
  })
})
