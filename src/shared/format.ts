/**
 * Display formatting of widget and settings values. Pure: no DOM.
 *
 * Conventions, the same in every widget:
 * - Decimal separator: a dot, as on every timing screen and in iRacing itself
 *   (gaps, lap times, SR, distances). Thousands are never grouped; iRating uses 'k'.
 * - A unit is joined to its number with a no-break space ('0.8 s', '12 m', '3 v'),
 *   so it never wraps onto its own line.
 * - Negative values take the typographic minus (MINUS, U+2212), as wide as '+' in the UI
 *   faces, so a sign flip never shifts a figure and every widget shows the same sign.
 * - Unknown values are '—' where a cell must show something, '' where the cell
 *   is better left empty (documented per function).
 * - Functions that produce words take the dictionary (`m`, messagesFor(lang)); the examples
 *   are the Spanish ones. Pure numeric formatters take none.
 */
import type { Messages } from './i18n'
import type { AppearanceSettings, GapValue, NameFormat } from './types'

const DASH = '—'
/** No-break space between a number and its unit. */
export const NBSP = ' '

/** Typographic minus of every signed value: as wide as '+', unlike the short hyphen-minus. */
export const MINUS = '−'

/** Whole seconds as 'm:ss' (65 -> '1:05'). */
function mss(totalSeconds: number): string {
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}

/**
 * Sign of a value as shown with `decimals` decimals: 0.004 at 2 decimals is 0,
 * like its '0.00'. Null for null or non-finite values.
 */
export function signAt(v: number | null, decimals: number): 1 | 0 | -1 | null {
  if (v === null || !Number.isFinite(v)) return null
  const r = Math.round(v * 10 ** decimals)
  return r > 0 ? 1 : r < 0 ? -1 : 0
}

/**
 * Gap to the player, irDashies convention: car ahead positive shown without
 * '+', behind with '−'. One decimal below a minute, 'm:ss' from 60 s on.
 * Rounds before choosing the sign, so -0.04 is '0.0' and 59.96 is '1:00'.
 */
export function formatGap(gapS: number | null): string {
  if (gapS === null || !Number.isFinite(gapS)) return DASH
  const abs = Math.abs(gapS)
  const tenths = Math.round(abs * 10)
  if (tenths === 0) return '0.0'
  const sign = gapS < 0 ? MINUS : ''
  if (tenths < 600) return sign + (tenths / 10).toFixed(1)
  return sign + mss(Math.round(abs))
}

/** '980', '2.3k', '10.4k'; '' when unknown (null or <= 0). */
export function formatIRating(ir: number | null): string {
  if (ir === null || !Number.isFinite(ir)) return ''
  const r = Math.round(ir)
  if (r <= 0) return ''
  if (r < 1000) return String(r)
  return `${(Math.round(r / 100) / 10).toFixed(1)}k`
}

/** Normalised license string ('A 4.99'); '' when unknown. */
export function formatLicense(licString: string | null): string {
  return licString === null ? '' : licString.trim().replace(/\s+/g, ' ')
}

const LICENSE_RE = /^([a-z]+)\s*(\d+)(?:[.,](\d))?/i

/**
 * Compact license for chips: 'A 4.99' -> 'A 4.9'. The safety rating is
 * truncated, not rounded (4.99 must not read as 5.0).
 */
export function formatLicenseShort(licString: string | null): string {
  const lic = formatLicense(licString)
  const m = LICENSE_RE.exec(lic)
  if (!m || m[1] === undefined || m[2] === undefined) return lic
  return `${m[1].toUpperCase()} ${m[2]}.${m[3] ?? '0'}`
}

/** 'P3'; '' when the class position is unknown. */
export function formatClassPosition(pos: number | null): string {
  if (pos === null || !Number.isFinite(pos)) return ''
  const p = Math.round(pos)
  return p > 0 ? `P${p}` : ''
}

/** Caption of a SessionType ("Race" -> 'CARRERA'); unknown types pass through. */
export function formatSessionType(sessionType: string | null, m: Messages): string {
  if (sessionType === null) return ''
  const t = m.widgets.session
  if (/qualify/i.test(sessionType)) return t.qualify
  if (/race/i.test(sessionType)) return t.race
  if (/practice/i.test(sessionType)) return t.practice
  if (/warm/i.test(sessionType)) return t.warmup
  if (/test/i.test(sessionType)) return t.testing
  return sessionType.trim()
}

/** Lap time 'm:ss.sss' ('1:38.452'), 'ss.sss' below a minute; '—' when unknown. */
export function formatLapTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return DASH
  const ms = Math.round(seconds * 1000)
  const m = Math.floor(ms / 60000)
  const rest = ((ms % 60000) / 1000).toFixed(3)
  return m > 0 ? `${m}:${rest.padStart(6, '0')}` : rest
}

/**
 * Standings gap: '+1.2' (one decimal), '+1:05' from a minute on, '+1L' / '+3L'
 * for whole laps; '' when null (leader or unknown).
 */
export function formatGapValue(gap: GapValue | null): string {
  if (gap === null) return ''
  if (gap.kind === 'laps') return gap.laps > 0 ? `+${gap.laps}L` : ''
  const s = gap.seconds
  if (!Number.isFinite(s)) return ''
  const tenths = Math.round(Math.abs(s) * 10)
  const sign = s < 0 ? MINUS : '+'
  if (tenths < 600) return sign + (tenths / 10).toFixed(1)
  return sign + mss(Math.round(Math.abs(s)))
}

/** A gap to a best lap, three decimals: '+0.412', '+1:02.345'; '' when unusable. */
export function formatBestLapGap(seconds: number): string {
  if (!Number.isFinite(seconds)) return ''
  const ms = Math.round(Math.abs(seconds) * 1000)
  const sign = seconds < 0 ? MINUS : '+'
  if (ms < 60_000) return sign + (ms / 1000).toFixed(3)
  const m = Math.floor(ms / 60_000)
  return `${sign}${m}:${((ms % 60_000) / 1000).toFixed(3).padStart(6, '0')}`
}

/** Trend in s/lap with explicit sign and two decimals ('+0.18', '−0.05'); '—' when unknown. */
export function formatTrend(sPerLap: number | null): string {
  const sign = signAt(sPerLap, 2)
  if (sign === null || sPerLap === null) return DASH
  if (sign === 0) return '0.00'
  return (sign > 0 ? '+' : MINUS) + (Math.abs(Math.round(sPerLap * 100)) / 100).toFixed(2)
}

/** Signed iRating change ('+23', '−7', '0'); '' when null. */
export function formatIRatingDelta(delta: number | null): string {
  if (delta === null || !Number.isFinite(delta)) return ''
  const r = Math.round(delta)
  if (r > 0) return `+${r}`
  return r < 0 ? `${MINUS}${-r}` : '0'
}

/**
 * Positions gained or lost since the start, as the count alone ('4'): the widget draws the
 * direction as a triangle beside it. '' for none (rounds to 0) or unknown: no placeholder glyph.
 */
export function formatGained(n: number | null): string {
  const sign = signAt(n, 0)
  if (sign === null || sign === 0 || n === null) return ''
  return String(Math.abs(Math.round(n)))
}

/** Safety rating with two decimals ('3.27'); '—' when unknown. */
export function formatSafetyRating(sr: number): string {
  return Number.isFinite(sr) ? (Math.round(sr * 100) / 100).toFixed(2) : DASH
}

/** SessionTimeRemain beyond a day is the "unlimited" sentinel, not a countdown. */
const MAX_COUNTDOWN_S = 24 * 3600

/** Countdown 'm:ss' / 'h:mm:ss', rounded down; '' when unknown. */
export function formatClock(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0 || seconds > MAX_COUNTDOWN_S) {
    return ''
  }
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  if (h === 0) return mss(s)
  const m = Math.floor((s % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/**
 * What is left of the session: '38:19  ≈19 v' (timed, with the estimated laps after an en
 * space), '38:19', 'Quedan 12 v' / 'Queda 1 v'; '' when unknown.
 */
export function formatRemaining(
  lapsRemaining: number | null,
  timeRemainingS: number | null,
  m: Messages,
  /** In full words ('≈19 vueltas'), for where they fit (R50). */
  long = false
): string {
  const clock = formatClock(timeRemainingS)
  const laps =
    lapsRemaining !== null && Number.isFinite(lapsRemaining)
      ? Math.max(0, Math.round(lapsRemaining))
      : null
  const t = m.widgets.laps
  if (clock !== '') return laps !== null ? (long ? t.timedLong : t.timed)(clock, laps) : clock
  if (laps === null) return ''
  return long ? t.leftLong(laps) : t.left(laps)
}

/** Laps until something happens: '~6 v', '< 1 v'; '—' when unknown. */
export function formatLaps(laps: number | null, m: Messages): string {
  if (laps === null || !Number.isFinite(laps)) return DASH
  const n = Math.round(laps)
  return n < 1 ? m.widgets.laps.underOne : m.widgets.laps.about(n)
}

/** Metres with at most one decimal ('12.5 m', '20 m'); `unit` false drops the ' m'. */
export function formatMetres(m: number, unit = true): string {
  if (!Number.isFinite(m)) return DASH
  const text = String(Math.round(m * 10) / 10 || 0)
  return unit ? `${text}${NBSP}m` : text
}

const KMH_PER_MPH = 1.609344

/** Speed as a whole number in the chosen units ('166'); '0' when unknown or negative. */
export function formatSpeed(kmh: number, units: AppearanceSettings['units']): string {
  if (!Number.isFinite(kmh) || kmh <= 0) return '0'
  return String(Math.round(units === 'imperial' ? kmh / KMH_PER_MPH : kmh))
}

export function speedUnit(units: AppearanceSettings['units']): 'km/h' | 'mph' {
  return units === 'imperial' ? 'mph' : 'km/h'
}

/** A temperature (°C, as the SDK sends it) in the chosen units, unrounded. */
export function tempIn(c: number, units: AppearanceSettings['units']): number {
  return units === 'imperial' ? (c * 9) / 5 + 32 : c
}

/** A temperature difference (°C) in the chosen units: no offset. */
export function tempDeltaIn(c: number, units: AppearanceSettings['units']): number {
  return units === 'imperial' ? (c * 9) / 5 : c
}

export function tempUnit(units: AppearanceSettings['units']): '°C' | '°F' {
  return units === 'imperial' ? '°F' : '°C'
}

/** Litres in a US gallon. */
const LITRES_PER_GALLON = 3.785411784

/** A volume (litres, as the SDK sends it) in the chosen units (R54): US gallons in imperial. */
export function volumeIn(litres: number, units: AppearanceSettings['units']): number {
  return units === 'imperial' ? litres / LITRES_PER_GALLON : litres
}

export function volumeUnit(units: AppearanceSettings['units']): 'L' | 'gal' {
  return units === 'imperial' ? 'gal' : 'L'
}

const METRES_PER_FOOT = 0.3048

/**
 * A distance (metres) in the chosen units (R54): metres with at most one decimal ('12.5 m'), or
 * whole feet in imperial ('66 ft'); `unit` false drops the unit.
 */
export function formatDistance(m: number, units: AppearanceSettings['units'], unit = true): string {
  if (units !== 'imperial') return formatMetres(m, unit)
  if (!Number.isFinite(m)) return DASH
  const text = String(Math.round(m / METRES_PER_FOOT) || 0)
  return unit ? `${text}${NBSP}ft` : text
}

// ---------------------------------------------------------------------------
// Driver names
// ---------------------------------------------------------------------------
// Names are data, not interface text: they read the same in every language (the telemetry
// process formats some and does not know it), so upper-casing is locale-independent.

const NAME_SUFFIX_RE = /^(?:jr|sr|ii|iii|iv)\.?$/i
/** Lowercase surname particles ('van der Berg'); capitalised ones are names. */
const NAME_PARTICLES: ReadonlySet<string> = new Set([
  'de',
  'da',
  'del',
  'della',
  'der',
  'den',
  'van',
  'von',
  'di',
  'du',
  'la',
  'le',
  'dos',
  'das'
])

interface NameParts {
  given: string
  /** With particles: 'van der Berg'. */
  surname: string
  /** Without particles: 'Berg' (the TV code is taken from it). */
  core: string
  /** 'Jr', 'III', ... or ''. */
  suffix: string
}

/** Null when the name has no separate given name and surname. */
function splitName(tokens: readonly string[]): NameParts | null {
  let end = tokens.length
  let suffix = ''
  const last = tokens[end - 1]
  if (last !== undefined && NAME_SUFFIX_RE.test(last)) {
    suffix = last
    end--
  }
  if (end < 2) return null
  const given = tokens[0]
  const core = tokens[end - 1]
  if (given === undefined || core === undefined) return null
  // Particles before the surname join it; the first token always stays the given name.
  let start = end - 1
  while (start > 1 && NAME_PARTICLES.has(tokens[start - 1] ?? '')) start--
  return { given, surname: tokens.slice(start, end).join(' '), core, suffix }
}

/** First letter of the token, upper-cased (the first character when it has none). */
function initialOf(token: string): string {
  const letter = /\p{L}/u.exec(token)?.[0] ?? Array.from(token)[0] ?? ''
  return letter.toUpperCase()
}

/** First three letters, without diacritics, upper-cased: 'Échevarría' -> 'ECH'. */
function tvCode(text: string): string {
  const letters = text.normalize('NFD').replace(/[^\p{L}]/gu, '')
  const source = letters !== '' ? letters : text
  return Array.from(source.toUpperCase()).slice(0, 3).join('')
}

/**
 * A driver name in the chosen style:
 *
 * | style     | 'Pierre-Étienne Duvalier' | 'Zoë van der Berg' | 'John Smith Jr' |
 * | full      | Pierre-Étienne Duvalier   | Zoë van der Berg   | John Smith Jr   |
 * | abbr      | P. Duvalier               | Z. van der Berg    | J. Smith Jr     |
 * | surname   | Duvalier                  | van der Berg       | Smith Jr        |
 * | tv        | DUV                       | BER                | SMI             |
 *
 * Whitespace is collapsed. Names without a separate surname (one word, or a
 * word plus a suffix) are returned as they are; empty names give ''.
 */
export function formatDriverName(name: string, style: NameFormat): string {
  const tokens = name
    .trim()
    .split(/\s+/)
    .filter((t) => t !== '')
  const full = tokens.join(' ')
  if (style === 'full') return full
  const parts = splitName(tokens)
  if (parts === null) return full
  const suffix = parts.suffix !== '' ? ` ${parts.suffix}` : ''
  switch (style) {
    case 'abbr':
      return `${initialOf(parts.given)}. ${parts.surname}${suffix}`
    case 'surname':
      return parts.surname + suffix
    case 'tv':
      return tvCode(parts.core)
  }
}

/**
 * False for a name with no letter or digit. iRacing writes the session info in Windows-1252 and
 * puts '?' for every character outside it (Cyrillic, Greek, CJK, Polish 'ł'...): 'Иван Петров'
 * arrives as '???? ??????', which says nothing about the driver.
 */
export function isKnownName(name: string): boolean {
  return /[\p{L}\p{N}]/u.test(name)
}

export interface ShownName {
  text: string
  /** Neither name is known: `text` is the 'Piloto #7' placeholder (drawn dim). */
  unknown: boolean
}

/**
 * What a widget shows for a driver: `formatted` (the driver's own name in the widget's style)
 * when it says something, else the team's name as it is (not a person's name to restyle), else
 * 'Piloto #7' by the car number.
 */
export function shownDriverName(
  formatted: string,
  teamName: string | undefined,
  carNumber: string,
  m: Messages
): ShownName {
  if (isKnownName(formatted)) return { text: formatted, unknown: false }
  const team = formatDriverName(teamName ?? '', 'full')
  if (isKnownName(team)) return { text: team, unknown: false }
  return { text: m.widgets.common.unknownDriver(carNumber.trim()), unknown: true }
}
