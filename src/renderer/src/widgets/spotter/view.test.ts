import { describe, expect, it } from 'vitest'
import { coverBucket, FIRST_BUCKET, LAST_BUCKET, segmentTransform } from './view'
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
  it('shows every mark: a car on the left with one about to come alongside, two on the right', () => {
    const p = previewSpotter()
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
