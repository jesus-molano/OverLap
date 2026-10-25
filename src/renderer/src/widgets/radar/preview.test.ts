import { describe, expect, it } from 'vitest'
import { RADAR } from '@shared/radar'
import { toCarMarks } from './geometry'
import { previewRadar } from './preview'

describe('previewRadar', () => {
  it('a car alongside on the left, with its alert, plus cars ahead and behind', () => {
    const d = previewRadar(20)
    expect(d.visible).toBe(true)
    expect(d.rangeM).toBe(20)
    expect(d.leftCount).toBe(1)
    expect(d.rightCount).toBe(0)
    const alongside = d.cars.filter((c) => c.overlapping)
    expect(alongside).toHaveLength(1)
    expect(alongside[0]?.lane).toBe(-1)
    expect(d.cars.some((c) => c.lane === 0 && c.distM < 0)).toBe(true)
    expect(d.cars.some((c) => c.lane === 0 && c.distM > 0)).toBe(true)
  })

  it('stays inside the range and clear of the player at any range', () => {
    for (const r of [RADAR.minRangeM, 10, 20, 50, RADAR.maxRangeM]) {
      const d = previewRadar(r)
      for (const c of d.cars) {
        expect(Math.abs(c.distM)).toBeLessThan(r)
        if (!c.overlapping) expect(Math.abs(c.distM)).toBeGreaterThan(RADAR.carLengthM)
        expect(c.proximity).toBeGreaterThanOrEqual(0)
        expect(c.proximity).toBeLessThanOrEqual(1)
      }
      // Every sample car is drawn (none fully faded at the edge).
      expect(toCarMarks(d.cars, d.rangeM).length).toBeGreaterThanOrEqual(1)
    }
    expect(previewRadar(30).cars).toHaveLength(3)
  })
})
