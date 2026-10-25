/**
 * Pedal colours of the inputs widget, one source for the bars (CSS custom properties on the
 * widget root) and the canvas trace. Pure.
 */
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import type { InputsOptions } from '@shared/types'
import { hexOr } from '@renderer/view/color'
import type { InlineStyle } from '@renderer/view/styles'
import type { TraceColors } from './trace'

/** Brake while ABS is active (not user-set): orange, brighter than any brake preset. */
export const ABS_COLOR = '#ffae2b'
/** RGB of the panel (theme.css --ov-bg) that the trace's clutch is mixed towards. */
const PANEL_RGB = '#0c0e12'
/** How far the trace's clutch moves towards the panel: opaque, but behind the pedals. */
export const CLUTCH_TRACE_DIM = 0.35

export interface PedalPalette {
  /** `--ov-throttle` / `--ov-brake` / `--ov-clutch` / `--ov-abs` for the widget root. */
  readonly vars: InlineStyle
  readonly trace: TraceColors
}

/** Opaque mix of two '#rrggbb' colours: `t` = 0 is `a`, 1 is `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const x = parseInt(a.slice(1), 16)
  const y = parseInt(b.slice(1), 16)
  const k = t > 0 ? (t < 1 ? t : 1) : 0
  let out = '#'
  for (const shift of [16, 8, 0]) {
    const ca = (x >> shift) & 0xff
    const cb = (y >> shift) & 0xff
    out += Math.round(ca + (cb - ca) * k)
      .toString(16)
      .padStart(2, '0')
  }
  return out
}

/** The user's colours, each falling back to its default when malformed. */
export function pedalPalette(colors: Partial<InputsOptions['colors']> | undefined): PedalPalette {
  const d = OPTION_SCHEMA.inputs.colors.default
  const throttle = hexOr(colors?.throttle, d.throttle)
  const brake = hexOr(colors?.brake, d.brake)
  const clutch = hexOr(colors?.clutch, d.clutch)
  return {
    vars: Object.freeze({
      '--ov-throttle': throttle,
      '--ov-brake': brake,
      '--ov-clutch': clutch,
      '--ov-abs': ABS_COLOR
    }),
    trace: Object.freeze({
      throttle,
      brake,
      abs: ABS_COLOR,
      clutch: mixHex(clutch, PANEL_RGB, CLUTCH_TRACE_DIM)
    })
  }
}
