import { describe, it, expect } from 'vitest'
import { parseTrackLength } from './trackLength'

describe('parseTrackLength', () => {
  it('parses km strings in the iRacing format and variants', () => {
    expect(parseTrackLength('5.79 km')).toBe(5790)
    expect(parseTrackLength('5.79km')).toBe(5790)
    expect(parseTrackLength(' 3.20 KM ')).toBe(3200)
    expect(parseTrackLength('5,79 km')).toBe(5790)
    expect(parseTrackLength('7 km')).toBe(7000)
  })

  it('parses miles and metres', () => {
    expect(parseTrackLength('2.1 mi')).toBeCloseTo(2.1 * 1609.344, 3)
    expect(parseTrackLength('2.50 MI')).toBeCloseTo(4023.36, 3)
    expect(parseTrackLength('4200 m')).toBe(4200)
    expect(parseTrackLength('4200m')).toBe(4200)
  })

  it('applies the km/m heuristic to bare number strings', () => {
    expect(parseTrackLength('5.79')).toBe(5790)
    expect(parseTrackLength('5,79')).toBe(5790)
    expect(parseTrackLength('4200')).toBe(4200)
  })

  it('applies the km/m heuristic to numbers', () => {
    expect(parseTrackLength(5.79)).toBe(5790)
    expect(parseTrackLength(4200)).toBe(4200)
    expect(parseTrackLength(100)).toBe(100)
    expect(parseTrackLength(0.5)).toBe(500)
  })

  it('rejects malformed strings', () => {
    for (const s of ['', '   ', 'abc', 'km', '-1 km', '0 km', 'NaN km', '1.2.3 km', '5.79 kmh']) {
      expect(parseTrackLength(s), s).toBeNull()
    }
    expect(parseTrackLength('5.79 ft')).toBeNull()
    expect(parseTrackLength('1e3 m')).toBeNull()
  })

  it('rejects bad numbers', () => {
    expect(parseTrackLength(0)).toBeNull()
    expect(parseTrackLength(-5)).toBeNull()
    expect(parseTrackLength(Number.NaN)).toBeNull()
    expect(parseTrackLength(Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('rejects values outside 100 m .. 50 000 m', () => {
    expect(parseTrackLength('0.05 km')).toBeNull()
    expect(parseTrackLength('99 m')).toBeNull()
    expect(parseTrackLength('50.001 km')).toBeNull()
    expect(parseTrackLength('50 km')).toBe(50_000)
    expect(parseTrackLength('40 mi')).toBeNull()
    expect(parseTrackLength(99.9)).toBeNull() // 99.9 km
    expect(parseTrackLength(60_000)).toBeNull()
    expect(parseTrackLength(0.05)).toBeNull() // 50 m
  })

  it('rejects non string/number inputs', () => {
    expect(parseTrackLength(undefined)).toBeNull()
    expect(parseTrackLength(null)).toBeNull()
    expect(parseTrackLength(true)).toBeNull()
    expect(parseTrackLength({})).toBeNull()
    expect(parseTrackLength({ value: 5.79 })).toBeNull()
    expect(parseTrackLength([])).toBeNull()
    expect(parseTrackLength(['5.79 km'])).toBeNull()
  })
})
