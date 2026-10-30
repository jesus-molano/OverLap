const WHITE = '#ffffff'
const BLACK = '#000000'

// '0x' takes 1..6 digits like a number literal; '#' and bare need all six.
const HEX_STRING_RE = /^(?:0x([0-9a-f]{1,6})|#?([0-9a-f]{6}))$/i

const LICENSE_COLORS: Readonly<Record<string, string>> = {
  R: '#fc0706',
  D: '#fc8a27',
  C: '#feec04',
  B: '#00c702',
  A: '#0153db',
  P: '#1f1f1f'
}

function colorValue(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw >= 0 && raw <= 0xffffff ? raw : null
  }
  if (typeof raw !== 'string') return null
  const m = HEX_STRING_RE.exec(raw.trim())
  if (!m) return null
  const hex = m[1] ?? m[2]
  return hex === undefined ? null : parseInt(hex, 16)
}

function toCss(value: number): string {
  return '#' + value.toString(16).padStart(6, '0')
}

/**
 * iRacing colour (0xRRGGBB as a number, as js-yaml parses it, or a hex
 * string) to a lowercase '#rrggbb'. Anything else returns `fallback`.
 */
export function irColorToCss(raw: unknown, fallback = WHITE): string {
  const value = colorValue(raw)
  return value === null ? fallback : toCss(value)
}

/** Like irColorToCss, but 0 (the pace car class) is white too. */
export function classColorToCss(raw: unknown): string {
  const value = colorValue(raw)
  return value === null || value === 0 ? WHITE : toCss(value)
}

/**
 * License colour: a valid non-zero LicColor wins, else the colour of the
 * license letter ("A 4.60" -> A). null when neither is known.
 */
export function licenseColor(licString: string, licColorRaw: unknown): string | null {
  const value = colorValue(licColorRaw)
  if (value !== null && value !== 0) return toCss(value)
  const letter = licString.trim().charAt(0).toUpperCase()
  return LICENSE_COLORS[letter] ?? null
}

function linear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function luminanceOf(value: number): number {
  return (
    0.2126 * linear((value >> 16) & 0xff) +
    0.7152 * linear((value >> 8) & 0xff) +
    0.0722 * linear(value & 0xff)
  )
}

/** WCAG relative luminance (0 black .. 1 white), null when unparseable. */
export function relativeLuminance(cssHex: string): number | null {
  const value = colorValue(cssHex)
  return value === null ? null : luminanceOf(value)
}

/**
 * Black or white text, whichever contrasts more with the background
 * (WCAG relative luminance; the crossover is at L ~= 0.179).
 * Unparseable backgrounds are treated as white.
 */
export function contrastText(cssHex: string): '#000000' | '#ffffff' {
  const value = colorValue(cssHex)
  if (value === null) return BLACK
  return luminanceOf(value) > 0.179 ? BLACK : WHITE
}

/**
 * A colour setting that follows Apariencia's accent instead of a colour of its own (R46: the
 * wheel's centre mark), as a name format's «Global» follows Apariencia's.
 */
export const FOLLOW_ACCENT = 'accent'

/** A colour setting's colour: its own '#rrggbb', or the accent when it follows it. */
export function colorOrAccent(value: string, accent: string): string {
  return value === FOLLOW_ACCENT ? accent : value
}

/** Settings colours: '#rrggbb' or '#rgb' (the '#' is optional), any case. */
const SETTINGS_HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** A user-entered colour as lowercase '#rrggbb', null when it is not a hex colour. */
export function normalizeHexColor(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const hex = SETTINGS_HEX_RE.exec(raw.trim())?.[1]
  if (hex === undefined) return null
  const full = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex
  return '#' + full.toLowerCase()
}

/** Below this luminance a licence colour (Pro is #1f1f1f) vanishes on the dark panel. */
const DARK_LICENSE_LUMINANCE = 0.05
const DARK_LICENSE_SUBSTITUTE = '#8a909c'

/** Licence colour for a chip on the dark panel: near-black colours become a visible grey. */
export function licenseChipColor(color: string | null): string | null {
  if (color === null) return null
  const l = relativeLuminance(color)
  return l !== null && l < DARK_LICENSE_LUMINANCE ? DARK_LICENSE_SUBSTITUTE : color
}
