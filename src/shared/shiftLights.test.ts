import { describe, expect, it } from 'vitest'
import { parseSessionMeta } from './session'
import {
  REDLINE_SHARES,
  SHIFT_LEDS,
  ledBand,
  parseShiftRpm,
  shiftLit,
  shiftPhase
} from './shiftLights'

const GT3 = {
  DriverCarSLFirstRPM: 5800,
  DriverCarSLShiftRPM: 7400,
  DriverCarSLLastRPM: 7600,
  DriverCarSLBlinkRPM: 7800,
  DriverCarRedLine: 8000
}

describe('parseShiftRpm', () => {
  it("reads the car's lights from DriverInfo", () => {
    expect(parseShiftRpm(GT3)).toEqual({ first: 5800, shift: 7400, last: 7600, blink: 7800 })
    expect(parseSessionMeta({ DriverInfo: GT3 }).shiftRpm).toEqual(parseShiftRpm(GT3))
  })

  it('falls back to the redline, else none', () => {
    const red = parseShiftRpm({ DriverCarRedLine: 9000 })
    expect(red).toEqual({
      first: Math.round(9000 * REDLINE_SHARES.first),
      shift: Math.round(9000 * REDLINE_SHARES.shift),
      last: Math.round(9000 * REDLINE_SHARES.last),
      blink: Math.round(9000 * REDLINE_SHARES.blink)
    })
    expect(red!.first).toBeLessThan(red!.last)
    // Lights in the wrong order or broken: the redline's.
    expect(parseShiftRpm({ ...GT3, DriverCarSLFirstRPM: 7700 })!.first).toBe(
      Math.round(8000 * REDLINE_SHARES.first)
    )
    expect(parseShiftRpm({ DriverCarSLFirstRPM: '5800', DriverCarSLLastRPM: 7600 })).toBeNull()
    expect(parseShiftRpm({})).toBeNull()
    expect(parseShiftRpm(null)).toBeNull()
    expect(parseSessionMeta({}).shiftRpm).toBeNull()
  })

  it('a missing shift point is the last light, a missing blink none', () => {
    expect(
      parseShiftRpm({
        DriverCarSLFirstRPM: 5000,
        DriverCarSLLastRPM: 6000,
        DriverCarSLBlinkRPM: -1
      })
    ).toEqual({ first: 5000, shift: 6000, last: 6000, blink: 0 })
  })
})

describe('the strip at a given RPM', () => {
  const { first, shift, last, blink } = parseShiftRpm(GT3)!

  it('fills from the first light to the last', () => {
    expect(shiftLit(5000, first, last)).toBe(0)
    expect(shiftLit(first, first, last)).toBe(1)
    expect(shiftLit(6700, first, last)).toBe(5)
    expect(shiftLit(last - 1, first, last)).toBe(SHIFT_LEDS - 1)
    expect(shiftLit(last, first, last)).toBe(SHIFT_LEDS)
    expect(shiftLit(9000, first, last)).toBe(SHIFT_LEDS)
    // Unknown lights or revs: nothing lit.
    expect(shiftLit(7000, 0, 0)).toBe(0)
    expect(shiftLit(NaN, first, last)).toBe(0)
  })

  it('says shift from the shift point and blink from the blink RPM', () => {
    expect(shiftPhase(7000, first, shift, blink)).toBe('fill')
    expect(shiftPhase(7400, first, shift, blink)).toBe('shift')
    expect(shiftPhase(7799, first, shift, blink)).toBe('shift')
    expect(shiftPhase(7800, first, shift, blink)).toBe('blink')
    expect(shiftPhase(7900, first, shift, 0)).toBe('shift')
    expect(shiftPhase(7900, 0, 0, 0)).toBe('fill')
  })

  it('green, then yellow, then red, left to right', () => {
    const bands = Array.from({ length: SHIFT_LEDS }, (_, i) => ledBand(i))
    expect(bands).toEqual([
      'green',
      'green',
      'green',
      'green',
      'yellow',
      'yellow',
      'yellow',
      'red',
      'red',
      'red'
    ])
  })
})
