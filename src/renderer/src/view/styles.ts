/**
 * Shared, frozen inline-style objects for view models. The same colour is the same object on
 * every update, so `v-inline-style` and `v-memo` see "unchanged" with one identity check. Pure.
 */
import { contrastText, licenseChipColor } from '@shared/colors'
import { formatDriverName } from '@shared/format'
import type { NameFormat } from '@shared/types'
import { hexOr, inkOnDark } from './color'

export { hexOr, inkOnDark } from './color'

/** Inline style properties by CSS name ('--cls', 'background'). */
export type InlineStyle = Readonly<Record<string, string>>

export const CLASS_COLOR_FALLBACK = '#ffffff'
export const LICENSE_COLOR_FALLBACK = '#4b5160'
/** A session has a handful of class and licence colours; the bound only guards odd data. */
export const STYLE_CACHE_MAX = 64

export type StyleFactory = (color: string) => InlineStyle

/**
 * One frozen style per colour. `make` gets the colour and its contrasting text colour. Past
 * `max` entries the cache starts over (a session never gets there).
 */
export function styleCache(
  make: (color: string, fg: string) => InlineStyle,
  max = STYLE_CACHE_MAX
): StyleFactory {
  const cache = new Map<string, InlineStyle>()
  return (color) => {
    let style = cache.get(color)
    if (style === undefined) {
      if (cache.size >= max) cache.clear()
      style = Object.freeze({ ...make(color, contrastText(color)) })
      cache.set(color, style)
    }
    return style
  }
}

/**
 * `--cls` (class colour: number plates, stripes, class keys), `--cls-fg` (text on it) and
 * `--cls-ink` (the colour as text on the dark panel: class names, see inkOnDark).
 */
export const classVars = (c: string, fg: string): InlineStyle => ({
  '--cls': c,
  '--cls-fg': fg,
  '--cls-ink': inkOnDark(c)
})

/**
 * `--lic` (iRacing colour), `--lic-fg` (text on it), `--lic-soft` (the colour lifted to a
 * visible grey when it is near black) and `--lic-ink` (that colour as text on the dark panel,
 * for the text-only styles): see LicenseChip.
 */
export const licenseVars = (c: string, fg: string): InlineStyle => {
  const soft = licenseChipColor(c) ?? c
  return { '--lic': c, '--lic-fg': fg, '--lic-soft': soft, '--lic-ink': inkOnDark(soft) }
}

export type NameFormatter = (name: string, format: NameFormat) => string

/** Memoised `formatDriverName`: rows re-format the same few names at every update. */
export function nameCache(max = 256): NameFormatter {
  const cache = new Map<string, string>()
  return (name, format) => {
    const key = `${format}\n${name}`
    let out = cache.get(key)
    if (out === undefined) {
      if (cache.size >= max) cache.clear()
      out = formatDriverName(name, format)
      cache.set(key, out)
    }
    return out
  }
}

/** Style of a payload colour, which may be missing or malformed. */
export type ColorStyle = (color: string | null | undefined) => InlineStyle

/** Per-widget caches of the driver cell (create one per widget instance). */
export interface DriverStyles {
  /** The `--cls*` properties of a class colour (falls back to white). */
  cls: ColorStyle
  /** The `--lic*` properties of a licence colour (falls back to grey). */
  lic: ColorStyle
  name: NameFormatter
}

export function createDriverStyles(): DriverStyles {
  const cls = styleCache(classVars)
  const lic = styleCache(licenseVars)
  return {
    cls: (c) => cls(hexOr(c, CLASS_COLOR_FALLBACK)),
    lic: (c) => lic(hexOr(c, LICENSE_COLOR_FALLBACK)),
    name: nameCache()
  }
}
