/**
 * Pedal colours of the inputs widget, one source for the bars (CSS custom properties on the
 * widget root) and the canvas trace. Pure.
 */
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import type { InputsOptions } from '@shared/types'
import { hexOr } from '@renderer/view/color'
import type { InlineStyle } from '@renderer/view/styles'
import type { TraceColors } from './trace'

/**
 * Brake while ABS is active (not user-set): theme.css --ov-abs, an orange away from the yellow
 * accent and brighter than any brake preset. It equals the default warn but does not follow it
 * into the colour-blind palette.
 */
export const ABS_COLOR = '#ff9e40'
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

/**
 * The pedals' default colours under the colour-blind palette (R36: theme.css data-cvd): the
 * throttle in its blue "good", the brake in its orange "bad", the clutch a neutral grey (the blue
 * is the throttle's now), and ABS white, apart from the orange brake by lightness.
 */
export const CVD_PEDALS = Object.freeze({
  throttle: '#3fa7ff',
  brake: '#ff9f1a',
  clutch: '#aeb7c4'
})
export const CVD_ABS_COLOR = '#f3f5f8'

/**
 * The user's colours, each falling back to its default when malformed. With the colour-blind
 * palette (`colorBlind`) a pedal still on its default colour takes CVD_PEDALS' (a colour you chose
 * stays yours), and ABS turns white.
 */
export function pedalPalette(
  colors: Partial<InputsOptions['colors']> | undefined,
  colorBlind = false
): PedalPalette {
  const d = OPTION_SCHEMA.inputs.colors.default
  const pick = (id: keyof typeof d): string => {
    const own = hexOr(colors?.[id], d[id])
    return colorBlind && own === d[id] ? CVD_PEDALS[id] : own
  }
  const throttle = pick('throttle')
  const brake = pick('brake')
  const clutch = pick('clutch')
  const abs = colorBlind ? CVD_ABS_COLOR : ABS_COLOR
  return {
    vars: Object.freeze({
      '--ov-throttle': throttle,
      '--ov-brake': brake,
      '--ov-clutch': clutch,
      '--ov-abs': abs
    }),
    trace: Object.freeze({
      throttle,
      brake,
      abs,
      clutch: mixHex(clutch, PANEL_RGB, CLUTCH_TRACE_DIM)
    })
  }
}
