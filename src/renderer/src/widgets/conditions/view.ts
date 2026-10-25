/**
 * ConditionsData to what the conditions widget ('Condiciones') draws: four short lines and a band.
 * Pure.
 *
 *   PISTA   34 °C ▲                 AIRE  22 °C
 *   VIENTO  (dial) 12 km/h  de cara
 *   ASFALTO ▰▰▰▱▱▱▱ Poco mojado      LLUVIA  40 %
 *   CIELO   Muy nuboso               GOMA  Media-alta (heredada)
 *   [DECLARADA MOJADA] neumáticos de lluvia permitidos
 *
 * Every part is an option; a line goes when both its parts are off or unknown. Words come from
 * the dictionary `m` (messagesFor(lang)); temperatures and speeds follow appearance.units.
 */
import { WETNESS_MAX, WETNESS_MIN, wrapDeg } from '@shared/conditions'
import { formatSpeed, speedUnit, tempIn, tempUnit } from '@shared/format'
import type { Messages } from '@shared/i18n'
import type {
  AppearanceSettings,
  ConditionsData,
  ConditionsOptions,
  TempTrend
} from '@shared/types'
import type { IconName } from '@renderer/ui/icons'
import { shallowEqual } from '@renderer/view/reuse'

export type Units = AppearanceSettings['units']

const DASH = '—'

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

/** Where the wind comes from, in four words: the 90° around the nose is a headwind. */
export type WindSide = 'head' | 'tail' | 'left' | 'right'

/** `fromDeg`: CONDITIONS' relative direction (0 = from ahead, + = from the right). */
export function windSide(fromDeg: number): WindSide {
  const d = wrapDeg(fromDeg)
  if (Math.abs(d) <= 45) return 'head'
  if (Math.abs(d) >= 135) return 'tail'
  return d > 0 ? 'right' : 'left'
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

export function skiesText(skies: number | null, m: Messages): string {
  if (skies === null || !Number.isInteger(skies)) return DASH
  return m.widgets.conditions.skies[skies] ?? DASH
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
export interface ReadingView {
  readonly label: string
  readonly value: string
  readonly unit: string
}

export interface TrackTempView extends ReadingView {
  /** The trend's shape, null when off or still measuring. */
  readonly trend: IconName | null
}

export interface WindView extends ReadingView {
  /** Draw the dial (the direction option is on). */
  readonly dial: boolean
  /** Relative direction it comes from (degrees, CONDITIONS), null without one. */
  readonly fromDeg: number | null
  /** 'de cara', 'en calma'; '' when unknown or the direction is off. */
  readonly side: string
}

/**
 * Cells of the wetness meter: one per level past dry, so a dry track is an empty meter (a lit
 * cell reads as water, and in narrow windows the meter is all there is).
 */
export const WETNESS_CELLS = WETNESS_MAX - WETNESS_MIN

export interface WetnessView extends ReadingView {
  /** Filled cells of the WETNESS_CELLS-cell meter, 0 when dry; null when unknown (no meter). */
  readonly cells: number | null
}

export interface DeclaredWetView {
  readonly label: string
  readonly note: string
}

export interface ConditionsView {
  readonly track: TrackTempView | null
  readonly air: ReadingView | null
  readonly wind: WindView | null
  readonly wetness: WetnessView | null
  readonly rain: ReadingView | null
  readonly sky: ReadingView | null
  readonly rubber: ReadingView | null
  /** Only while declared wet. */
  readonly declaredWet: DeclaredWetView | null
}

/** The drawing options of the view (the header is the widget's). */
export type ConditionsViewOptions = Omit<ConditionsOptions, 'showHeader'>

export const EMPTY_VIEW: ConditionsView = Object.freeze({
  track: null,
  air: null,
  wind: null,
  wetness: null,
  rain: null,
  sky: null,
  rubber: null,
  declaredWet: null
})

/** Below this the wind reads as calm, whatever its (meaningless) direction (km/h). */
const CALM_KMH = 2

/**
 * What to draw. A reading the sim does not send at all is left out (an unknown one inside a
 * line that has others would show '—'); the wetness and the rubber state always show, '—'
 * included, since "unknown" is an answer there (it is never "dry").
 */
export function conditionsView(
  d: ConditionsData,
  o: ConditionsViewOptions,
  units: Units,
  m: Messages
): ConditionsView {
  if (!d.visible) return EMPTY_VIEW
  const w = m.widgets.conditions
  const tUnit = tempUnit(units)

  const track: TrackTempView | null =
    o.showTrackTemp && d.trackTempC !== null
      ? {
          label: w.track,
          value: tempText(d.trackTempC, units),
          unit: tUnit,
          trend: o.showTrend ? trendIcon(d.trackTempTrend) : null
        }
      : null
  const air: ReadingView | null =
    o.showAirTemp && d.airTempC !== null
      ? { label: w.air, value: tempText(d.airTempC, units), unit: tUnit }
      : null

  let wind: WindView | null = null
  if (o.showWind && d.windKmh !== null) {
    const calm = d.windKmh < CALM_KMH
    const fromDeg = o.showWindDirection && !calm ? d.windFromDeg : null
    wind = {
      label: w.wind,
      value: formatSpeed(d.windKmh, units),
      unit: speedUnit(units),
      dial: o.showWindDirection,
      fromDeg,
      side: !o.showWindDirection
        ? ''
        : calm
          ? w.calm
          : fromDeg === null
            ? ''
            : w.windFrom[windSide(fromDeg)]
    }
  }

  const level = d.wetness !== null && d.wetness >= 1 && d.wetness <= WETNESS_MAX ? d.wetness : null
  return {
    track,
    air,
    wind,
    wetness: o.showWetness
      ? {
          label: w.surface,
          value: wetnessText(level, m),
          unit: '',
          cells: level === null ? null : level - WETNESS_MIN
        }
      : null,
    rain:
      o.showPrecipitation && d.precipPct !== null
        ? { label: w.rain, value: precipText(d.precipPct, m), unit: '' }
        : null,
    sky:
      o.showSkies && d.skies !== null
        ? { label: w.sky, value: skiesText(d.skies, m), unit: '' }
        : null,
    rubber: o.showRubber
      ? { label: w.rubber, value: rubberText(d.rubberState, m, d.rubberCarried), unit: '' }
      : null,
    declaredWet:
      o.showDeclaredWet && d.declaredWet ? { label: w.declaredWet, note: w.declaredWetNote } : null
  }
}

/**
 * `next` with every part equal to the one of `prev` replaced by that previous object, so a
 * v-memo on a part skips it while it is unchanged; `prev` itself when nothing changed at all.
 */
export function reuseParts(prev: ConditionsView | undefined, next: ConditionsView): ConditionsView {
  if (prev === undefined) return next
  const out: Record<string, unknown> = {}
  let same = true
  for (const key of Object.keys(next) as (keyof ConditionsView)[]) {
    const p = prev[key]
    const n = next[key]
    const keep = p === n || (p !== null && n !== null && shallowEqual(p, n))
    out[key] = keep ? p : n
    if (!keep) same = false
  }
  return same ? prev : (out as unknown as ConditionsView)
}

/** The view's lines, top to bottom (an empty list: nothing to draw). */
export type LineId = 'temps' | 'wind' | 'surface' | 'sky' | 'wet'

export function linesOf(v: ConditionsView): LineId[] {
  const out: LineId[] = []
  if (v.track !== null || v.air !== null) out.push('temps')
  if (v.wind !== null) out.push('wind')
  if (v.wetness !== null || v.rain !== null) out.push('surface')
  if (v.sky !== null || v.rubber !== null) out.push('sky')
  if (v.declaredWet !== null) out.push('wet')
  return out
}

/** Changes whenever the panel's height can (useReveal): which lines are drawn. */
export function layoutKey(v: ConditionsView, header: boolean): string {
  return `${header ? 'h' : ''}${linesOf(v).join(',')}`
}
