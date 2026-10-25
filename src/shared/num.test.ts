import { describe, expect, it } from 'vitest'
import { clamp, clamp01, clampInt, finiteOr, frac, isFiniteNumber, quantise, roundTo } from './num'

describe('num', () => {
  it('isFiniteNumber / finiteOr', () => {
    expect(isFiniteNumber(1.5)).toBe(true)
    for (const v of [Number.NaN, Infinity, '1', null, undefined])
      expect(isFiniteNumber(v)).toBe(false)
    expect(finiteOr(2, 9)).toBe(2)
    expect(finiteOr(Number.NaN, 9)).toBe(9)
    expect(finiteOr('2', 9)).toBe(9)
  })

  it('clamp and clamp01 send NaN to the low end', () => {
    expect(clamp(5, 0, 3)).toBe(3)
    expect(clamp(-1, 0, 3)).toBe(0)
    expect(clamp(2, 0, 3)).toBe(2)
    expect(clamp(Number.NaN, 1, 3)).toBe(1)
    expect(clamp01(1.2)).toBe(1)
    expect(clamp01(-0.1)).toBe(0)
    expect(clamp01(0.25)).toBe(0.25)
    expect(clamp01(Number.NaN)).toBe(0)
  })

  it('frac is always in [0, 1)', () => {
    expect(frac(3.25)).toBeCloseTo(0.25)
    expect(frac(-0.25)).toBeCloseTo(0.75)
    expect(frac(2)).toBe(0)
  })

  it('quantise / roundTo never return -0 or NaN', () => {
    expect(quantise(1.234, 100)).toBe(1.23)
    expect(Object.is(quantise(-0.001, 10), 0)).toBe(true)
    expect(quantise(Number.NaN, 10)).toBe(0)
    expect(roundTo(2.345, 1)).toBe(2.3)
    expect(roundTo(7.5, 0)).toBe(8)
  })

  it('clampInt rounds and clamps, invalid values give the fallback', () => {
    expect(clampInt(2.6, 0, 10, 3)).toBe(3)
    expect(clampInt(99, 0, 10, 3)).toBe(10)
    expect(clampInt(-4, 0, 10, 3)).toBe(0)
    for (const v of [Number.NaN, Infinity, -Infinity, '5', null])
      expect(clampInt(v, 0, 10, 3)).toBe(3)
  })
})
