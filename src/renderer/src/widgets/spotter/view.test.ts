import { describe, expect, it } from 'vitest'
import {
  CLOSE_RAMP_N,
  closeBucket,
  closeTransform,
  coverBucket,
  FIRST_BUCKET,
  LAST_BUCKET,
  segmentTransform
} from './view'
import { previewSpotter } from './preview'

describe('coverBucket', () => {
  it('warms with the share of your car covered, the alert red only when completely beside you', () => {
    expect(coverBucket(0.08)).toBe(FIRST_BUCKET + 1)
    expect(coverBucket(0.5)).toBeGreaterThan(coverBucket(0.2))
    expect(coverBucket(0.98)).toBe(LAST_BUCKET)
    expect(coverBucket(1)).toBe(LAST_BUCKET)
    expect(coverBucket(0)).toBe(FIRST_BUCKET)
    expect(coverBucket(Number.NaN)).toBe(FIRST_BUCKET)
    expect(coverBucket(3)).toBe(LAST_BUCKET)
  })
})

describe('segmentTransform', () => {
  it('moves a full-height block to the stretch and scales it to its length', () => {
    expect(segmentTransform({ from: 0, to: 1 })).toBe('translateY(0%) scaleY(1)')
    expect(segmentTransform({ from: 0.5, to: 1 })).toBe('translateY(50%) scaleY(0.5)')
    expect(segmentTransform({ from: 0, to: 0.3 })).toBe('translateY(0%) scaleY(0.3)')
  })

  it('builds one string per stretch: the same one on every pass', () => {
    const a = segmentTransform({ from: 0.2, to: 0.6 })
    expect(segmentTransform({ from: 0.2, to: 0.6 })).toBe(a)
    expect(segmentTransform({ from: -1, to: 2 })).toBe('translateY(0%) scaleY(1)')
    expect(segmentTransform({ from: 0.7, to: 0.4 })).toBe('translateY(70%) scaleY(0)')
  })
})

describe('previewSpotter', () => {
  it('«Dónde te cubre»: a car on the left with one about to come alongside, two on the right', () => {
    const p = previewSpotter('cover')
    expect(p.active && p.visible).toBe(true)
    expect(p.left.count).toBe(1)
    expect(p.left.nearRear).toBeGreaterThan(0)
    expect(p.right.count).toBe(2)
    expect(p.right.segs).toHaveLength(2)
    for (const side of [p.left, p.right]) {
      const sum = side.segs.reduce((a, s) => a + s.to - s.from, 0)
      expect(side.cover).toBeCloseTo(sum, 9)
    }
  })
})

describe('«Cercanía» (5c)', () => {
  it('ramps amber to the alert red with closeness, red only alongside', () => {
    expect(closeBucket(0)).toBe(0)
    expect(closeBucket(0.5)).toBeGreaterThan(closeBucket(0.2))
    expect(closeBucket(0.95)).toBe(CLOSE_RAMP_N)
    expect(closeBucket(1)).toBe(CLOSE_RAMP_N)
    expect(closeBucket(Number.NaN)).toBe(0)
    expect(closeBucket(-2)).toBe(0)
  })

  it('scales a full-height block from the bottom, one cached string per step', () => {
    expect(closeTransform(1)).toBe('scaleY(1)')
    expect(closeTransform(0)).toBe('scaleY(0)')
    expect(closeTransform(0.5)).toBe('scaleY(0.5)')
    expect(closeTransform(0.501)).toBe(closeTransform(0.5))
    expect(closeTransform(7)).toBe('scaleY(1)')
  })

  it('is the preview by default: a car closing in on the left, two alongside on the right', () => {
    const p = previewSpotter()
    expect(p).toEqual(previewSpotter('closeness'))
    expect(p.left.count).toBe(0)
    expect(p.left.close).toBeGreaterThan(0.3)
    expect(p.left.close).toBeLessThan(1)
    expect(p.right).toMatchObject({ count: 2, close: 1 })
  })
})
