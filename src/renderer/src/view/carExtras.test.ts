import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { TYRE_UNKNOWN, stintCell, tyreCell } from './carExtras'

const ES = messagesFor('es')
const EN = messagesFor('en')

describe('stintCell', () => {
  it('gives the whole laps and the lap unit of the language', () => {
    expect(stintCell(7, ES)).toEqual({ text: '7', unit: 'v' })
    expect(stintCell(0, EN)).toEqual({ text: '0', unit: 'L' })
    expect(stintCell(12.9, ES).text).toBe('12')
  })

  it('is empty when unknown or broken', () => {
    for (const v of [null, Number.NaN, -1, Infinity]) {
      expect(stintCell(v, ES)).toEqual({ text: '', unit: '' })
    }
  })
})

describe('tyreCell', () => {
  it('is the letter, a dash for a compound nobody can name', () => {
    expect(tyreCell('Hard')).toBe('H')
    expect(tyreCell('Wet')).toBe('W')
    expect(tyreCell(null)).toBe(TYRE_UNKNOWN)
    expect(tyreCell('')).toBe(TYRE_UNKNOWN)
  })
})
