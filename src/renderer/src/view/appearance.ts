/**
 * Global appearance (settings.appearance) as CSS: custom properties and data attributes on the
 * document root, which theme.css turns into the accent, palette, density and stripes of every
 * widget. Plus the font maths of auto-height widgets. Pure.
 */
import { contrastText } from '@shared/colors'
import { DEFAULT_LANGUAGE, isLanguage } from '@shared/i18n'
import { clamp, isFiniteNumber, roundTo } from '@shared/num'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import type { AppearanceSettings } from '@shared/types'
import { patchInline, type StyleTarget } from '../directives/inlineStyle'
import { hexOr } from './color'
import type { InlineStyle } from './styles'

export const ACCENT_FALLBACK = OPTION_SCHEMA.appearance.accent.default

/** Base font of auto-height widgets at 100 % scale, and the clamp of the scaled result. */
export const BASE_FONT_PX = 13
export const FONT_MIN_PX = 9
export const FONT_MAX_PX = 24
/** Apariencia › Accesibilidad › «Texto mínimo de 10 px» (R15): the floor it raises FONT_MIN_PX to. */
export const LARGE_MIN_PX = 10

/** The overlay's text floor (theme.css --ov-min-text) for these appearance settings. */
export function minTextPx(a: Pick<AppearanceSettings, 'largeLabels'>): number {
  return a.largeLabels === true ? LARGE_MIN_PX : FONT_MIN_PX
}

/** Row and class-line heights (em of the widget font) per density. */
export const DENSITY_EM = {
  compact: { row: 1.5, classLine: 1.25 },
  comfortable: { row: 1.8, classLine: 1.45 }
} as const satisfies Record<AppearanceSettings['density'], { row: number; classLine: number }>

export type Density = AppearanceSettings['density']

/** The document root as `applyAppearance` uses it (a fake in tests). */
export interface AppearanceRoot extends StyleTarget {
  setAttribute(name: string, value: string): void
}

const percent = (v: unknown): number => (isFiniteNumber(v) && v > 0 ? v : 100)

/**
 * Custom properties on the root: the accent with its text colour. (The global text scale reaches
 * auto-height widgets through `widgetFontPx`; free-size widgets fit their text to the window.)
 */
export function appearanceVars(a: AppearanceSettings): InlineStyle {
  const accent = hexOr(a.accent, ACCENT_FALLBACK)
  return {
    '--ov-accent': accent,
    '--ov-accent-fg': contrastText(accent)
  }
}

/**
 * Attributes on the root: the data attributes theme.css matches, and `lang` (the interface
 * language, for CSS upper-casing and screen readers; index.html starts as 'es'). The two of
 * Accesibilidad (R15, R27) are off unless chosen: the minimum text (`data-min-text`) and the
 * blinking (`data-flash`).
 */
export function appearanceAttrs(a: AppearanceSettings): InlineStyle {
  return {
    'data-cvd': a.colorBlind ? 'on' : 'off',
    'data-density': a.density === 'comfortable' ? 'comfortable' : 'compact',
    'data-stripes': a.stripes === false ? 'off' : 'on',
    'data-min-text': String(minTextPx(a)),
    'data-flash': a.noFlashing === true ? 'off' : 'on',
    lang: isLanguage(a.language) ? a.language : DEFAULT_LANGUAGE
  }
}

/** Writes what differs from `prev` (everything when null). */
export function applyAppearance(
  root: AppearanceRoot,
  next: AppearanceSettings,
  prev: AppearanceSettings | null
): void {
  if (next === prev) return
  patchInline(root, prev ? appearanceVars(prev) : null, appearanceVars(next))
  const before = prev ? appearanceAttrs(prev) : null
  const after = appearanceAttrs(next)
  for (const k in after) {
    const v = after[k]
    if (v !== undefined && v !== before?.[k]) root.setAttribute(k, v)
  }
}

/**
 * Font (px) of an auto-height widget: base x widget scale x global text scale, clamped to a
 * legible range (its floor `minPx`: minTextPx). Depends on settings only, never on the window
 * size (no resize feedback).
 */
export function widgetFontPx(scalePct: number, fontScalePct: number, minPx = FONT_MIN_PX): number {
  const px = (BASE_FONT_PX * percent(scalePct) * percent(fontScalePct)) / 10_000
  return clamp(roundTo(px, 2), minPx, FONT_MAX_PX)
}

/** A widget's own option, or the global one when it says 'inherit' (or is missing). */
export function inherit<T extends string>(own: T | 'inherit' | undefined, global: T): T {
  return own === undefined || own === 'inherit' ? global : own
}
