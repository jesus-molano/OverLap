/**
 * Value conversions and formatting for the settings controls. Pure. One number format for every
 * readout, preset and hint: no trailing zeros ('1 s', '1,5 s', never '1.0 s'), the language's
 * decimal separator (core.decimal: a comma in Spanish), a no-break space before the unit. The
 * widgets keep the sim's dot (lap times, gaps).
 */
import { NBSP } from '@shared/format'
import type { Messages } from '@shared/i18n'

export { NBSP }

/**
 * The quick buttons of every size in percent (a widget's «Escala», Apariencia's «Tamaño del
 * texto»): one ladder, so 125 % is one click on both.
 */
export const SIZE_PRESETS = [80, 100, 125, 150] as const

/** 0..1 opacity to a whole 0..100 percentage for the slider. */
export function toPercent(opacity: number): number {
  return Number.isFinite(opacity) ? clampInt(opacity * 100, 0, 100) : 0
}

/** Slider percentage back to 0..1. */
export function fromPercent(percent: number): number {
  return clampInt(percent, 0, 100) / 100
}

/** '80 %' in Spanish, '80%' in English (core.percent). */
export function formatPercent(m: Messages, percent: number): string {
  return m.core.percent(percent)
}

/** Number of decimals of a step (0.1 -> 1, 0.25 -> 2, 5 -> 0). */
export function decimalsOf(step: number): number {
  if (!Number.isFinite(step)) return 0
  const text = String(step)
  const dot = text.indexOf('.')
  return dot < 0 ? 0 : text.length - dot - 1
}

/**
 * A number without trailing zeros or float noise, in the language's decimals: 2.5 -> '2,5'
 * (Spanish), 2 -> '2', 0.30000000000000004 -> '0,3' (at most `maxDecimals`).
 */
export function formatNumber(m: Messages, v: number, maxDecimals = 3): string {
  const text = String(Number.isFinite(v) ? Number(v.toFixed(maxDecimals)) || 0 : 0)
  return text.replace('.', m.core.decimal)
}

/** Seconds: formatSeconds(es, 1.5) -> '1,5 s', formatSeconds(es, 1) -> '1 s'. */
export function formatSeconds(m: Messages, s: number): string {
  return `${formatNumber(m, s)}${NBSP}s`
}

/** Pixels: 2 -> '2 px', 1.5 -> '1,5 px' (Spanish). */
export function formatPx(m: Messages, px: number): string {
  return `${formatNumber(m, px)}${NBSP}px`
}

/**
 * A slider value snapped to its step grid (min + k * step) and rounded to the step's
 * decimals, so 0.1 steps never report 0.30000000000000004.
 */
export function snapToStep(value: number, step: number, min: number): number {
  if (!Number.isFinite(value)) return min
  if (!(step > 0)) return value
  const k = Math.round((value - min) / step)
  return Number((min + k * step).toFixed(decimalsOf(step) + decimalsOf(min)))
}

/**
 * How far `value` sits from `min` to `max`, as the CSS percentage a slider's track is filled
 * to (its --pct): rangeFill(80, 50, 150) -> '30%'. Clamped to 0..100 %, at most 2 decimals;
 * '0%' for an empty range or a value that is not a number.
 */
export function rangeFill(value: number, min: number, max: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !(max > min)) return '0%'
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
  return `${Number(pct.toFixed(2))}%`
}

/** Every value of a step grid from min to max (at most 50): stepValues(1, 3, 0.5) -> 1..3. */
export function stepValues(min: number, max: number, step: number): number[] {
  if (!(step > 0) || !Number.isFinite(min) || !Number.isFinite(max) || max < min) return []
  const out: number[] = []
  for (let k = 0; out.length < 50; k++) {
    const v = snapToStep(min + k * step, step, min)
    if (v > max) break
    out.push(v)
  }
  return out
}

export function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

/** Typed number field: whole number clamped to the range, or null when it is not a number. */
export function parseIntInRange(raw: string, min: number, max: number): number | null {
  const text = raw.trim().replace(',', '.')
  if (text === '') return null
  const n = Number(text)
  return Number.isFinite(n) ? clampInt(n, min, max) : null
}

/** What the hex field shows for a colour: lowercase without the '#' ('ffc400'). */
export function hexDigits(color: string): string {
  return color.replace(/^#/, '').toLowerCase()
}
