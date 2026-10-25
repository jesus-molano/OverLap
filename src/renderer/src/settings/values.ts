/**
 * Value conversions and formatting for the settings controls. Pure. Same conventions as
 * @shared/format: a dot as decimal separator, a no-break space before the unit.
 */
import { NBSP } from '@shared/format'
import type { Messages } from '@shared/i18n'

export { NBSP }

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

/** Trims float noise: 2.5 -> '2.5', 2 -> '2', 0.30000000000000004 -> '0.3' (at most 3 decimals). */
function plain(v: number, maxDecimals = 3): string {
  return String(Number(v.toFixed(maxDecimals)) || 0)
}

/** Seconds with a fixed number of decimals: formatSeconds(1.5, 1) -> '1.5 s'. */
export function formatSeconds(s: number, decimals = 0): string {
  return `${Number.isFinite(s) ? s.toFixed(decimals) : '0'}${NBSP}s`
}

/** Pixels without trailing zeros: 2 -> '2 px', 1.5 -> '1.5 px'. */
export function formatPx(px: number): string {
  return `${plain(px)}${NBSP}px`
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
