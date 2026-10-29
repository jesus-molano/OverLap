/**
 * Country flags for CountryFlag.vue: the 3x2 SVGs of country-flag-icons (MIT, by catamphetamine;
 * recorded in THIRD_PARTY_NOTICES.md), one lazily loaded chunk per flag, so a window only reads
 * the flags of the drivers it shows, once each. The SVG text becomes a data URI drawn as an
 * <img> (no markup of the package goes into the page). Its accessible name is the country's
 * name in the interface language (Intl.DisplayNames; the home nations and the like from the
 * dictionary).
 */
import { isCountryCode } from '@shared/countries'
import type { Language, Messages } from '@shared/i18n'

/** Flag code -> the module's loader ('ES', 'GB-SCT'...). */
const LOADERS: ReadonlyMap<string, () => Promise<string>> = (() => {
  const found = import.meta.glob<string>(
    [
      '../../../../node_modules/country-flag-icons/string/3x2/*.js',
      '!../../../../node_modules/country-flag-icons/string/3x2/index*.js'
    ],
    { import: 'default' }
  )
  const out = new Map<string, () => Promise<string>>()
  for (const [path, load] of Object.entries(found)) {
    const code = /([A-Z]{2}(?:-[A-Z]{2,3})?)\.js$/.exec(path)?.[1]
    if (code !== undefined) out.set(code, load)
  }
  return out
})()

/** Loaded flags as data URIs; a pending load; null when there is none (unknown code). */
const cache = new Map<string, string | null | Promise<string | null>>()

/** A flag exists for `code` (it is one countries.ts gives and the package has it). */
export function hasFlag(code: string): boolean {
  return isCountryCode(code) && LOADERS.has(code)
}

/** The SVG text as a data URI (no base64: SVG is text). */
export function svgUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** The flag's data URI if it is loaded already (no wait), else null. */
export function flagUriNow(code: string): string | null {
  const hit = cache.get(code)
  return typeof hit === 'string' ? hit : null
}

/** The flag's data URI, loaded once per code and window; null for a code without a flag. */
export function loadFlag(code: string): Promise<string | null> {
  const hit = cache.get(code)
  if (hit !== undefined) return Promise.resolve(hit)
  const load = hasFlag(code) ? LOADERS.get(code) : undefined
  if (load === undefined) {
    cache.set(code, null)
    return Promise.resolve(null)
  }
  const pending = load().then(
    (svg) => {
      const uri = typeof svg === 'string' && svg.startsWith('<svg') ? svgUri(svg) : null
      cache.set(code, uri)
      return uri
    },
    (err: unknown) => {
      console.warn(`[flags] could not load ${code}:`, err)
      cache.set(code, null)
      return null
    }
  )
  cache.set(code, pending)
  return pending
}

const NAMES = new Map<Language, Intl.DisplayNames | null>()

function displayNames(lang: Language): Intl.DisplayNames | null {
  let names = NAMES.get(lang)
  if (names === undefined) {
    try {
      names = new Intl.DisplayNames([lang], { type: 'region' })
    } catch {
      names = null
    }
    NAMES.set(lang, names)
  }
  return names
}

/** The country's name in `lang` ('España', 'Escocia'); the code itself when nothing names it. */
export function countryLabel(code: string, lang: Language, m: Messages): string {
  const own = (m.widgets.countries as Readonly<Record<string, string>>)[code]
  if (own !== undefined) return own
  if (/^[A-Z]{2}$/.test(code)) {
    try {
      const name = displayNames(lang)?.of(code)
      if (name !== undefined && name !== code) return name
    } catch {
      // An unknown region: the code below.
    }
  }
  return code
}
