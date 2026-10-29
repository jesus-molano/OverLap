import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import {
  NBSP,
  SIZE_PRESETS,
  clampInt,
  decimalsOf,
  formatNumber,
  formatPercent,
  formatPx,
  formatSeconds,
  fromPercent,
  hexDigits,
  parseIntInRange,
  rangeFill,
  snapToStep,
  stepValues,
  toPercent
} from './values'

describe('opacity percent', () => {
  it('maps 0..1 to whole percentages and back', () => {
    expect(toPercent(0.78)).toBe(78)
    expect(toPercent(0)).toBe(0)
    expect(toPercent(1)).toBe(100)
    expect(fromPercent(78)).toBe(0.78)
    expect(fromPercent(0)).toBe(0)
  })

  it('clamps out-of-range and invalid values', () => {
    expect(toPercent(1.4)).toBe(100)
    expect(toPercent(-0.2)).toBe(0)
    expect(toPercent(Number.NaN)).toBe(0)
    expect(fromPercent(150)).toBe(1)
    expect(fromPercent(-5)).toBe(0)
  })
})

describe('formatting', () => {
  it('keeps the unit on the same line', () => {
    expect(NBSP).toBe(' ')
    expect(formatPercent(messagesFor('es'), 80)).toBe(`80${NBSP}%`)
    expect(formatPercent(messagesFor('en'), 80)).toBe('80%')
    expect(formatSeconds(messagesFor('es'), 5)).toBe('5 s')
  })

  it('formats every number one way: no trailing zeros, the language’s decimal separator', () => {
    const es = messagesFor('es')
    const en = messagesFor('en')
    // The same quantity reads the same on every page: never '1.0 s' beside '1 s'.
    expect(formatSeconds(es, 1)).toBe('1 s')
    expect(formatSeconds(es, 1.5)).toBe('1,5 s')
    expect(formatSeconds(en, 1.5)).toBe('1.5 s')
    expect(formatSeconds(es, 0)).toBe('0 s')
    expect(formatSeconds(es, 0.30000000000000004)).toBe('0,3 s')
    expect(formatSeconds(es, Number.NaN)).toBe('0 s')
    expect(formatNumber(es, 1.25)).toBe('1,25')
    expect(formatNumber(es, 0.55, 1)).toBe('0,6')
  })

  it('formats pixels without trailing zeros', () => {
    const es = messagesFor('es')
    expect(formatPx(es, 2)).toBe('2 px')
    expect(formatPx(es, 1.5)).toBe('1,5 px')
    expect(formatPx(messagesFor('en'), 2.5000000000000004)).toBe('2.5 px')
  })

  it('uses one ladder of quick buttons for every size', () => {
    expect(SIZE_PRESETS).toEqual([80, 100, 125, 150])
  })

  it('shows hex colours without the hash', () => {
    expect(hexDigits('#FFC400')).toBe('ffc400')
    expect(hexDigits('3ddc84')).toBe('3ddc84')
  })
})

describe('step snapping', () => {
  it('counts the decimals of a step', () => {
    expect(decimalsOf(1)).toBe(0)
    expect(decimalsOf(5)).toBe(0)
    expect(decimalsOf(0.1)).toBe(1)
    expect(decimalsOf(0.25)).toBe(2)
    expect(decimalsOf(Number.NaN)).toBe(0)
  })

  it('snaps to the step grid without float noise', () => {
    expect(snapToStep(0.30000000000000004, 0.1, 0.3)).toBe(0.3)
    expect(snapToStep(1.5000000000000002, 0.1, 0.3)).toBe(1.5)
    expect(snapToStep(1.53, 0.1, 0.3)).toBe(1.5)
    expect(snapToStep(103, 5, 60)).toBe(105)
    expect(snapToStep(2.2, 0.5, 1)).toBe(2)
  })

  it('handles degenerate input', () => {
    expect(snapToStep(Number.NaN, 0.1, 0.3)).toBe(0.3)
    expect(snapToStep(7.3, 0, 0)).toBe(7.3)
  })

  it('lists the values of a step grid', () => {
    expect(stepValues(1, 3, 0.5)).toEqual([1, 1.5, 2, 2.5, 3])
    expect(stepValues(0.3, 0.6, 0.1)).toEqual([0.3, 0.4, 0.5, 0.6])
    expect(stepValues(0, 1000, 1)).toHaveLength(50)
    expect(stepValues(3, 1, 1)).toEqual([])
    expect(stepValues(0, 1, 0)).toEqual([])
  })
})

describe('rangeFill', () => {
  it('places the value on the track as a CSS percentage', () => {
    expect(rangeFill(50, 0, 100)).toBe('50%')
    expect(rangeFill(0, 0, 100)).toBe('0%')
    expect(rangeFill(100, 0, 100)).toBe('100%')
    expect(rangeFill(80, 50, 150)).toBe('30%')
    expect(rangeFill(1, 0, 3)).toBe('33.33%')
  })

  it('clamps values outside the range', () => {
    expect(rangeFill(-5, 0, 100)).toBe('0%')
    expect(rangeFill(130, 0, 100)).toBe('100%')
  })

  it('draws an empty track for degenerate input', () => {
    expect(rangeFill(5, 5, 5)).toBe('0%')
    expect(rangeFill(5, 10, 0)).toBe('0%')
    expect(rangeFill(Number.NaN, 0, 100)).toBe('0%')
    expect(rangeFill(50, Number.NaN, 100)).toBe('0%')
  })
})

describe('parseIntInRange', () => {
  it('rounds and clamps typed numbers', () => {
    expect(parseIntInRange(' 4 ', 0, 10)).toBe(4)
    expect(parseIntInRange('15', 0, 10)).toBe(10)
    expect(parseIntInRange('-3', 0, 10)).toBe(0)
    expect(parseIntInRange('2,6', 0, 10)).toBe(3)
  })

  it('rejects empty or non-numeric text', () => {
    expect(parseIntInRange('', 0, 10)).toBeNull()
    expect(parseIntInRange('abc', 0, 10)).toBeNull()
  })

  it('clampInt rounds to whole numbers', () => {
    expect(clampInt(2.4, 0, 10)).toBe(2)
    expect(clampInt(11, 0, 10)).toBe(10)
  })
})
