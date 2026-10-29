/**
 * Shift lights of the pedals widget: the car's shift points from the session YAML (DriverInfo
 * DriverCarSLFirstRPM, SLShiftRPM, SLLastRPM, SLBlinkRPM) and what a strip of LEDs shows at a
 * given RPM. Pure, and allocation-free on the 60 Hz path (`shiftLit`, `shiftPhase`).
 *
 * The strip fills from the first light (SLFirst) to the last one (SLLast), green, then yellow,
 * then red by position; from the shift point (SLShift) every LED is on and the strip turns to
 * its shift colour; from SLBlink it blinks. Cars that leave the lights out (0s) get them from
 * DriverCarRedLine instead (REDLINE_SHARES), so every car has some.
 */
import type { ShiftRpm } from './types'

/** LEDs in the strip. */
export const SHIFT_LEDS = 10
/** Of the strip, left to right: green up to here, yellow up to YELLOW_UNTIL, red after. */
export const GREEN_UNTIL = 0.4
export const YELLOW_UNTIL = 0.7

/** The lights from the redline when the car gives none (rough, like most dashes). */
export const REDLINE_SHARES: Readonly<ShiftRpm> = Object.freeze({
  first: 0.78,
  shift: 0.94,
  last: 0.92,
  blink: 0.97
})

type Obj = Readonly<Record<string, unknown>>

function rpmOr0(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 100000 ? v : 0
}

/**
 * The car's lights from DriverInfo, null when it gives neither the lights nor the redline. The
 * first light is always under the last one; a missing shift point is the last light, a missing
 * blink none (0).
 */
export function parseShiftRpm(driverInfo: Obj | null): ShiftRpm | null {
  let first = rpmOr0(driverInfo?.DriverCarSLFirstRPM)
  let last = rpmOr0(driverInfo?.DriverCarSLLastRPM)
  let shift = rpmOr0(driverInfo?.DriverCarSLShiftRPM)
  let blink = rpmOr0(driverInfo?.DriverCarSLBlinkRPM)
  if (!(first > 0 && last > first)) {
    const red = rpmOr0(driverInfo?.DriverCarRedLine)
    if (red <= 0) return null
    first = Math.round(red * REDLINE_SHARES.first)
    last = Math.round(red * REDLINE_SHARES.last)
    shift = Math.round(red * REDLINE_SHARES.shift)
    blink = Math.round(red * REDLINE_SHARES.blink)
  }
  if (shift <= 0) shift = last
  return { first, shift, last, blink }
}

/** LEDs lit at `rpm` (0..SHIFT_LEDS): one at the first light, all of them at the last. */
export function shiftLit(rpm: number, first: number, last: number): number {
  if (!(first > 0 && last > first) || !(rpm >= first)) return 0
  if (rpm >= last) return SHIFT_LEDS
  return 1 + Math.floor(((rpm - first) / (last - first)) * (SHIFT_LEDS - 1))
}

/** What the strip says beyond the fill: nothing yet, shift now, or over the shift (blinking). */
export type ShiftPhase = 'fill' | 'shift' | 'blink'

export function shiftPhase(rpm: number, first: number, shift: number, blink: number): ShiftPhase {
  if (!(first > 0) || !(rpm >= first)) return 'fill'
  if (blink > 0 && rpm >= blink) return 'blink'
  if (shift > 0 && rpm >= shift) return 'shift'
  return 'fill'
}

/** The colour band of LED `i` (0 = leftmost). */
export function ledBand(i: number, n: number = SHIFT_LEDS): 'green' | 'yellow' | 'red' {
  const x = (i + 0.5) / n
  return x < GREEN_UNTIL ? 'green' : x < YELLOW_UNTIL ? 'yellow' : 'red'
}
