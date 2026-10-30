/**
 * The settings window's zoom (R29: appearance.settingsZoom, in %): the keys that change it and
 * the next value, the same in main (which applies it) and in the window (which asks for it).
 * Pure.
 */
import { OPTION_SCHEMA, clampOption } from './settingsSchema'

const SPEC = OPTION_SCHEMA.appearance.settingsZoom

/** One step in, one out, or back to 100 %. */
export type ZoomStep = 'in' | 'out' | 'reset'

/** The parts of a keydown the zoom keys need (a KeyboardEvent has them all). */
export interface ZoomKeyEvent {
  readonly key: string
  readonly code: string
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly altKey: boolean
}

/**
 * The zoom step of a key: Ctrl with + (or =, the same key on a US layout) or the keypad +, with
 * − or the keypad −, with 0 or the keypad 0, as in a browser. Alt never (AltGr is Ctrl+Alt on
 * Windows: it types characters). Null for any other key.
 */
export function zoomStepOf(e: ZoomKeyEvent): ZoomStep | null {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null
  if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') return 'in'
  if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') return 'out'
  if (e.key === '0' || e.code === 'Numpad0' || e.code === 'Digit0') return 'reset'
  return null
}

/** What one Ctrl and + or − changes, as in a browser (the slider goes by 5). */
export const ZOOM_KEY_STEP = 10

/** The zoom (%) after `step` from `current`, on the 10 % grid, within 80..150. */
export function nextZoom(current: number, step: ZoomStep): number {
  if (step === 'reset') return SPEC.default
  const now = clampOption(SPEC, current)
  const unit = ZOOM_KEY_STEP
  // Off the grid (a hand-edited file): the first step lands on it.
  const grid =
    step === 'in' ? Math.floor(now / unit) * unit + unit : Math.ceil(now / unit) * unit - unit
  return clampOption(SPEC, grid)
}

/** The webContents zoom factor of a stored zoom (anything invalid reads as 100 %). */
export function zoomFactor(pct: unknown): number {
  return clampOption(SPEC, pct) / 100
}
