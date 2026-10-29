/**
 * ConditionsData to the conditions footer of the relative and the standings: one line under the
 * table, its readings in this order (FOOTER_ITEMS). Pure.
 *
 *   PISTA 34°C ▲  [DECLARADA MOJADA]  ▰▰▰▱▱▱ Poco mojado  LLUVIA 40 %  (dial) 12 km/h  AIRE 22°C  GOMA Media-alta
 *
 * Every reading is an option (FooterReadings: the info bar items of the footer). The wet ones only show when relevant:
 * the plate while declared wet, the meter past dry, the rain from 1 %. A narrow table drops
 * readings from the end of the line (the rubber first, the track temperature last), so the
 * order is also the priority. Words come from the dictionary `m` (messagesFor(lang));
 * temperatures and speeds follow appearance.units.
 */
import { WETNESS_MAX, WETNESS_MIN, wrapDeg } from '@shared/conditions'
import { formatSpeed, speedUnit, tempIn, tempUnit } from '@shared/format'
import type { Messages } from '@shared/i18n'
import type {
  AppearanceSettings,
  ConditionsData,
  ElementEntry,
  InfoBarEntryId,
  InfoBarSize,
  TempTrend
} from '@shared/types'
import type { IconName } from '@renderer/ui/icons'
import { shallowEqual } from '@renderer/view/reuse'

export type Units = AppearanceSettings['units']

/**
 * Which readings a conditions line draws: the footer bar's weather items (an info bar), each a
 * flag, plus the trend arrow and the wind dial (the section's conditionsTrend and
 * conditionsWindDirection). `conditionsFooter`: the line is drawn at all.
 */
export interface FooterReadings {
  conditionsFooter: boolean
  conditionsTrackTemp: boolean
  conditionsTrend: boolean
  conditionsWet: boolean
  conditionsWind: boolean
  conditionsWindDirection: boolean
  conditionsAirTemp: boolean
  conditionsRubber: boolean
}

/** The parts of a table's options a conditions line reads. */
export interface FooterOptions {
  footerBar: readonly Readonly<ElementEntry<InfoBarEntryId>>[]
  footerBarSize: InfoBarSize
  conditionsTrend: boolean
  conditionsWindDirection: boolean
}

/** The readings of a table's footer bar (shown while its size is not 'off'). */
export function footerReadingsOf(o: FooterOptions): FooterReadings {
  const shown = (id: InfoBarEntryId): boolean => o.footerBar.some((e) => e.id === id && e.visible)
  return {
    conditionsFooter: o.footerBarSize !== 'off',
    conditionsTrackTemp: shown('trackTemp'),
    conditionsTrend: o.conditionsTrend,
    conditionsWet: shown('wet'),
    conditionsWind: shown('wind'),
    conditionsWindDirection: o.conditionsWindDirection,
    conditionsAirTemp: shown('airTemp'),
    conditionsRubber: shown('rubber')
  }
}

const DASH = '—'

/** Height of the footer line (em of the table's font): layout.ts and the relative's fit add it. */
export const FOOTER_EM = 1.6
/** Its rule on top (px), counted by the same maths. */
export const FOOTER_RULE_PX = 1

/**
 * '34' (°C) or '94' (°F), whole degrees; '—' when unknown. iRacing's track temperature moves in
 * steps of 1 °F, so a decimal would claim a precision there is not (report Q11).
 */
export function tempText(c: number | null, units: Units): string {
  if (c === null || !Number.isFinite(c)) return DASH
  return String(Math.round(tempIn(c, units)) || 0)
}

/** The trend as a shape (no colour: warmer is neither good nor bad); null while measuring. */
export function trendIcon(trend: TempTrend | null): IconName | null {
  if (trend === 'up') return 'arrow-up'
  if (trend === 'down') return 'arrow-down'
  return trend === 'steady' ? 'minus' : null
}

/**
 * The arrow's rotation for `next` (degrees, any turn), as the value next to `prev`: the arrow
 * then always turns the short way, even through 180 (179 -> -179 is +2, not -358).
 */
export function unwrapDeg(prev: number | null, next: number): number {
  if (prev === null || !Number.isFinite(prev)) return wrapDeg(next)
  return prev + wrapDeg(next - prev)
}

/** 'Poco mojado' for irsdk_TrackWetness 1..7; '—' when unknown (never 'Seco'). */
export function wetnessText(level: number | null, m: Messages): string {
  if (level === null || !Number.isInteger(level)) return DASH
  return m.widgets.conditions.wetness[level - 1] ?? DASH
}

export type RubberKey = keyof Messages['widgets']['conditions']['rubberStates']

/**
 * SessionTrackRubberState to one of the known states ('moderately high usage' ->
 * 'moderateHigh'); null for anything else. iRacing's wording varies ('moderate usage', 'carry
 * over'), so it is matched by its words, the longest first.
 */
export function rubberKey(raw: string): RubberKey | null {
  const s = raw.trim().toLowerCase()
  if (s === '') return null
  if (s.includes('carry')) return 'carryOver'
  if (s.includes('clean') || s.includes('no usage') || s === 'none') return 'clean'
  if (s.includes('moderately low')) return 'moderateLow'
  if (s.includes('moderately high')) return 'moderateHigh'
  if (s.includes('moderate') || s.includes('medium')) return 'moderate'
  if (/\b(low|light|slight)\b/.test(s)) return 'low'
  if (/\b(high|heavy|max|maximum)\b/.test(s)) return 'high'
  return null
}

/**
 * The rubber state in words; an unknown one as iRacing writes it (capitalised); '—' when none.
 * `carried`: an earlier session's state, carried over ('Media-alta (heredada)').
 */
export function rubberText(raw: string, m: Messages, carried = false): string {
  const key = rubberKey(raw)
  const s = raw.trim()
  const text =
    key !== null
      ? m.widgets.conditions.rubberStates[key]
      : s === ''
        ? DASH
        : s.charAt(0).toUpperCase() + s.slice(1)
  return carried && text !== DASH ? m.widgets.conditions.carried(text) : text
}

/** '40 %' / '40%' (the dictionary's percent); '—' when unknown. */
export function precipText(pct: number | null, m: Messages): string {
  return pct === null || !Number.isFinite(pct) ? DASH : m.core.percent(Math.round(pct))
}

/** A reading: caption, figures and unit ('' when it has none). */
export interface FooterReading {
  readonly label: string
  readonly value: string
  readonly unit: string
}

export interface TrackTempItem extends FooterReading {
  /** The trend's shape, null when off or still measuring. */
  readonly trend: IconName | null
}

export interface WindItem extends FooterReading {
  /**
   * Draw the dial (the direction option is on, and there is a direction to show): its arrow says
   * what the reading is, so the caption is left out then. Without a direction (calm, out of the
   * car) an empty ring would say nothing: the caption (`label`) instead.
   */
  readonly dial: boolean
  /** Relative direction it comes from (degrees, CONDITIONS), null without one (calm, no car). */
  readonly fromDeg: number | null
}

/**
 * Cells of the wetness meter: one per level past dry, so the meter only shows once there is
 * water (a dry track has no meter at all in the footer).
 */
export const WETNESS_CELLS = WETNESS_MAX - WETNESS_MIN

export interface WetnessItem {
  /** 'Agua': the meter's caption where a narrow table drops the word. */
  readonly label: string
  /** 'Poco mojado'. */
  readonly value: string
  /** Filled cells of the WETNESS_CELLS-cell meter, 1 or more. */
  readonly cells: number
}

export interface FooterView {
  readonly track: TrackTempItem | null
  /** The plate while the stewards declare the track wet ('DECLARADA MOJADA'). */
  readonly declaredWet: string | null
  /** Past dry only. */
  readonly wetness: WetnessItem | null
  /** From 1 % only. */
  readonly rain: FooterReading | null
  readonly wind: WindItem | null
  readonly air: FooterReading | null
  /** Only when iRacing names a state. */
  readonly rubber: FooterReading | null
}

export type FooterItem = keyof FooterView

/** The line's order, which is also what a narrow table keeps longest (the first ones). */
export const FOOTER_ITEMS: readonly FooterItem[] = Object.freeze([
  'track',
  'declaredWet',
  'wetness',
  'rain',
  'wind',
  'air',
  'rubber'
])

export const NO_FOOTER: FooterView = Object.freeze({
  track: null,
  declaredWet: null,
  wetness: null,
  rain: null,
  wind: null,
  air: null,
  rubber: null
})

/** Below this the wind reads as calm, whatever its (meaningless) direction (km/h). */
const CALM_KMH = 2

/**
 * What the footer draws: NO_FOOTER with the footer off, no readings yet or no weather at all. A
 * reading the sim does not send is left out, never shown as '—'.
 */
export function footerView(
  d: ConditionsData | null,
  o: FooterReadings,
  units: Units,
  m: Messages
): FooterView {
  if (!o.conditionsFooter || d === null || !d.visible) return NO_FOOTER
  const w = m.widgets.conditions
  const tUnit = tempUnit(units)

  let wind: WindItem | null = null
  if (o.conditionsWind && d.windKmh !== null) {
    const calm = d.windKmh < CALM_KMH
    const fromDeg = o.conditionsWindDirection && !calm ? d.windFromDeg : null
    wind = {
      label: w.wind,
      value: formatSpeed(d.windKmh, units),
      unit: speedUnit(units),
      dial: fromDeg !== null,
      fromDeg
    }
  }

  const wet = o.conditionsWet
  const level =
    d.wetness !== null && d.wetness > WETNESS_MIN && d.wetness <= WETNESS_MAX ? d.wetness : null
  const rain = d.precipPct !== null && Math.round(d.precipPct) >= 1 ? d.precipPct : null
  return {
    track:
      o.conditionsTrackTemp && d.trackTempC !== null
        ? {
            label: w.track,
            value: tempText(d.trackTempC, units),
            unit: tUnit,
            trend: o.conditionsTrend ? trendIcon(d.trackTempTrend) : null
          }
        : null,
    declaredWet: wet && d.declaredWet ? w.declaredWet : null,
    wetness:
      wet && level !== null
        ? { label: w.water, value: wetnessText(level, m), cells: level - WETNESS_MIN }
        : null,
    rain: wet && rain !== null ? { label: w.rain, value: precipText(rain, m), unit: '' } : null,
    wind,
    air:
      o.conditionsAirTemp && d.airTempC !== null
        ? { label: w.air, value: tempText(d.airTempC, units), unit: tUnit }
        : null,
    rubber:
      o.conditionsRubber && d.rubberState.trim() !== ''
        ? { label: w.rubber, value: rubberText(d.rubberState, m, d.rubberCarried), unit: '' }
        : null
  }
}

/** Something to draw: the footer line exists (and takes its FOOTER_EM). */
export function hasFooter(v: FooterView): boolean {
  return FOOTER_ITEMS.some((k) => v[k] !== null)
}

function isObject(v: unknown): v is object {
  return typeof v === 'object' && v !== null
}

/**
 * `next` with every reading equal to the one of `prev` replaced by that previous object, so a
 * v-memo on a reading skips it while it is unchanged; `prev` itself when nothing changed at all
 * (then the footer is not rendered again).
 */
export function reuseFooter(prev: FooterView | undefined, next: FooterView): FooterView {
  if (prev === undefined) return next
  const out: Record<string, unknown> = {}
  let same = true
  for (const key of FOOTER_ITEMS) {
    const p = prev[key]
    const n = next[key]
    // A reading is an object or the plate's string (compared by value with ===).
    const keep = p === n || (isObject(p) && isObject(n) && shallowEqual(p, n))
    out[key] = keep ? p : n
    if (!keep) same = false
  }
  return same ? prev : (out as unknown as FooterView)
}

/**
 * The readings of the edit-mode samples of both tables: a drying track (the meter, no rain), so
 * every default reading shows on a table of the default width; the options still apply.
 */
export const PREVIEW_CONDITIONS: ConditionsData = Object.freeze({
  visible: true,
  trackTempC: 24.4,
  trackTempTrend: 'down',
  airTempC: 17.2,
  windKmh: 14,
  // From the left, a little ahead of you.
  windFromDeg: -60,
  wetness: 3,
  precipPct: 0,
  declaredWet: false,
  skies: 2,
  rubberState: 'moderate usage',
  rubberCarried: false
})
