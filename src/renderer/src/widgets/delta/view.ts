/**
 * DeltaData to what the delta bar shows. Pure.
 *
 * Negative = faster than the reference: green, ▼ and the bar to the left of zero (a number
 * line); positive = slower: red, ▲, to the right. Every tone comes with a shape or words (the
 * symbol, the side of the bar, 'ganando' / 'perdiendo'), so the colour-blind palette loses
 * nothing. Words come from the dictionary `m` (messagesFor(lang)).
 */
// The typographic minus of every widget (format.ts): as wide as '+', so the number does not
// shift when the sign flips.
import { MINUS, formatLapTime, signAt } from '@shared/format'
import type { Messages } from '@shared/i18n'
import { isFiniteNumber } from '@shared/num'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import type { DeltaData, DeltaReference } from '@shared/types'
import type { Tone } from '@renderer/ui/tones'
import { perDictionary } from '@renderer/view/perDictionary'
import type { InlineStyle } from '@renderer/view/styles'

const DASH = '—'

/** Sign of a delta as shown (two decimals): -1 faster, 1 slower, 0 even, null unknown. */
export type DeltaSign = -1 | 0 | 1 | null

export function deltaSign(v: number | null | undefined): DeltaSign {
  return signAt(v ?? null, 2)
}

/** Tone of a delta: faster good, slower bad, even neutral, unknown dim. */
export function deltaTone(v: number | null | undefined): Tone {
  const s = deltaSign(v)
  return s === null ? 'dim' : s < 0 ? 'good' : s > 0 ? 'bad' : 'neutral'
}

/**
 * Signed delta, at most five characters so the hero never changes width: '−0.24', '+0.31',
 * '0.00'; one decimal from 10 s ('+12.5'), 'm:ss' from a minute ('+1:05'); '—' when unknown.
 */
export function formatDelta(v: number | null | undefined): string {
  if (!isFiniteNumber(v)) return DASH
  const abs = Math.abs(v)
  const hundredths = Math.round(abs * 100)
  if (hundredths === 0) return '0.00'
  const sign = v < 0 ? MINUS : '+'
  if (hundredths < 1000) return sign + (hundredths / 100).toFixed(2)
  const tenths = Math.round(abs * 10)
  if (tenths < 600) return sign + (tenths / 10).toFixed(1)
  const s = Math.round(abs)
  return `${sign}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Bar
// ---------------------------------------------------------------------------

/** Steps per side of the bar: 0.5 % of the half bar, about a pixel at the default size. */
export const BAR_STEPS = 200

/** A usable bar scale (s), or null. */
const scaleOf = (rangeS: number): number | null =>
  isFiniteNumber(rangeS) && rangeS > 0 ? rangeS : null

/**
 * Where the bar ends, -1 (full left, faster) .. 1 (full right, slower), as a whole number of
 * BAR_STEPS: the delta over the scale, clamped. 0 when unknown.
 */
export function barStep(delta: number | null | undefined, rangeS: number): number {
  const range = scaleOf(rangeS)
  if (!isFiniteNumber(delta) || range === null) return 0
  const k = Math.max(-1, Math.min(1, Math.round(delta * 100) / 100 / range))
  return Math.round(k * BAR_STEPS) || 0
}

/**
 * Beyond the scale: the bar is full and its end gets a cap. -1 faster, 1 slower, 0 inside.
 * Compared at the shown precision, so a delta that reads as the scale is not "beyond" it.
 */
export function barOverflow(delta: number | null | undefined, rangeS: number): -1 | 0 | 1 {
  const range = scaleOf(rangeS)
  if (!isFiniteNumber(delta) || range === null) return 0
  const d = Math.round(delta * 100)
  const r = Math.round(range * 100)
  return d > r ? 1 : d < -r ? -1 : 0
}

/** Fill anchored at zero: scaleX of the half bar (negative grows to the left). */
export function fillTransform(step: number): string {
  return `scaleX(${step / BAR_STEPS || 0})`
}

/** The needle at the end of the fill: a track-wide layer moved by half the track per unit. */
export function tipTransform(step: number): string {
  return `translateX(${(step * 50) / BAR_STEPS || 0}%)`
}

export interface BarStyles {
  readonly fill: InlineStyle
  readonly tip: InlineStyle
}

/**
 * Frozen bar styles per step: the same position is the same object, so `v-inline-style`
 * writes nothing for an unchanged bar. Bounded by the step count (2 * BAR_STEPS + 1).
 */
export function createBarStyles(): (step: number) => BarStyles {
  const cache = new Map<number, BarStyles>()
  return (step) => {
    const s = Math.max(-BAR_STEPS, Math.min(BAR_STEPS, Math.round(step) || 0))
    let styles = cache.get(s)
    if (styles === undefined) {
      styles = Object.freeze({
        fill: Object.freeze({ transform: fillTransform(s) }),
        tip: Object.freeze({ transform: tipTransform(s) })
      })
      cache.set(s, styles)
    }
    return styles
  }
}

// ---------------------------------------------------------------------------
// Trend and lap state
// ---------------------------------------------------------------------------

export type TrendKind = 'gain' | 'loss' | 'steady'

/** |trend| (s per s) that starts a 'ganando' / 'perdiendo': 0.1 s over 5 s. */
export const TREND_ON = 0.02
/** Below this it is steady again: the hysteresis keeps the caption from flickering. */
export const TREND_OFF = 0.01

/** The trend's direction, with hysteresis against the previous one. */
export function trendKind(trend: number, prev: TrendKind = 'steady'): TrendKind {
  if (!isFiniteNumber(trend)) return 'steady'
  if (trend <= -TREND_ON) return 'gain'
  if (trend >= TREND_ON) return 'loss'
  if (prev === 'gain' && trend <= -TREND_OFF) return 'gain'
  if (prev === 'loss' && trend >= TREND_OFF) return 'loss'
  return 'steady'
}

/** What the small column after the hero says. */
export interface StateView {
  readonly kind: 'gain' | 'loss' | 'invalid' | 'none'
  /** 'ganando' / 'perdiendo' / 'vuelta inválida'; '' for none. */
  readonly text: string
  readonly tone: Tone
}

/** The state views in a language: frozen, one set per dictionary (the same object every time). */
export const stateViews = perDictionary((m): Readonly<Record<StateView['kind'], StateView>> => {
  const t = m.widgets.delta
  return Object.freeze({
    gain: Object.freeze({ kind: 'gain', text: t.gaining, tone: 'good' }),
    loss: Object.freeze({ kind: 'loss', text: t.losing, tone: 'bad' }),
    invalid: Object.freeze({ kind: 'invalid', text: t.invalid, tone: 'warn' }),
    none: Object.freeze({ kind: 'none', text: '', tone: 'dim' })
  })
})

/** An invalid lap says so first (it won't count); then the trend, when shown and not steady. */
export function stateView(
  lapValid: boolean,
  trend: TrendKind,
  showTrend: boolean,
  m: Messages
): StateView {
  const views = stateViews(m)
  if (!lapValid) return views.invalid
  if (!showTrend || trend === 'steady') return views.none
  return views[trend]
}

// ---------------------------------------------------------------------------
// Reference and predicted lap
// ---------------------------------------------------------------------------

const REFERENCES: readonly string[] = OPTION_SCHEMA.delta.reference.values

const isReference = (v: unknown): v is DeltaReference =>
  typeof v === 'string' && REFERENCES.includes(v)

export interface RefView {
  readonly kind: DeltaReference
  /**
   * 'Récord personal', 'Mejor vuelta', 'Vuelta óptima', 'Tú', '#44 J. Lindqvist', 'Mejor de la
   * clase' or 'Óptima de la clase'.
   */
  readonly label: string
  /** '2:16.089', '—' when unknown. */
  readonly time: string
}

/**
 * How the widget names a reference: your record, your session best, your optimal lap, the class
 * optimal (nobody's lap), and for the class best 'Tú' (your own lap), the provider's
 * '#44 J. Lindqvist' (someone else's) or the generic name (a driver no longer in the session
 * info).
 */
export function refLabel(
  kind: DeltaReference,
  driver: string | undefined,
  self: boolean | undefined,
  m: Messages
): string {
  const t = m.widgets.delta
  if (kind === 'pb') return t.pb
  if (kind === 'session') return t.session
  if (kind === 'optimal') return t.optimal
  if (kind === 'classOptimal') return t.classOptimal
  if (self === true) return t.self
  const name = typeof driver === 'string' ? driver.trim() : ''
  return name !== '' ? name : t.classBest
}

export function refView(
  d: Pick<DeltaData, 'reference' | 'refDriver' | 'refSelf' | 'refLapTime'>,
  m: Messages
): RefView {
  const kind = isReference(d.reference) ? d.reference : 'pb'
  return {
    kind,
    label: refLabel(kind, d.refDriver, d.refSelf, m),
    time: formatLapTime(d.refLapTime)
  }
}

/** Predicted lap '2:15.849', '—' when unknown. */
export function predictedText(predictedLap: number | null | undefined): string {
  return formatLapTime(isFiniteNumber(predictedLap) ? predictedLap : null)
}

// ---------------------------------------------------------------------------
// Sectors
// ---------------------------------------------------------------------------

export interface SectorChipView {
  /** 'S1'. */
  readonly label: string
  /** Completed: '−0.12' / '+0.05'; '' for the one in progress (live text) and those ahead. */
  readonly text: string
  readonly tone: Tone
  /** done: completed this lap; current: in progress (its value is live); ahead: not reached. */
  readonly state: 'done' | 'current' | 'ahead'
}

const NO_CHIPS: readonly SectorChipView[] = Object.freeze([])
/** No sector boundaries known: one placeholder keeps the row (and the font) in place. */
const unknownSectors = perDictionary((m): readonly SectorChipView[] =>
  Object.freeze([
    Object.freeze({
      label: m.widgets.common.sectors,
      text: DASH,
      tone: 'dim',
      state: 'ahead'
    } as const)
  ])
)

/**
 * The sector in progress: the one after the last completed sector, -1 when none is completed or
 * every one is, or while there is no delta (`deltaKnown`: the position on the lap is unknown).
 * With nothing completed the position is not certain either (the provider may have joined the
 * lap midway, leaving its first sectors unknown), and in S1 the live value would only repeat
 * the hero anyway.
 */
export function currentSector(sectors: readonly (number | null)[], deltaKnown: boolean): number {
  if (!deltaKnown) return -1
  let last = -1
  for (let i = 0; i < sectors.length; i++) if (isFiniteNumber(sectors[i])) last = i
  return last >= 0 && last + 1 < sectors.length ? last + 1 : -1
}

/**
 * Time gained (-) or lost (+) so far in the sector in progress: the running delta minus what
 * the completed sectors already account for (the provider's sector deltas add up to the delta
 * at the last sector line). Null unless every earlier sector is known.
 */
export function liveSectorDelta(
  sectors: readonly (number | null)[],
  delta: number | null | undefined,
  index: number
): number | null {
  if (!isFiniteNumber(delta) || index < 0 || index >= sectors.length) return null
  let done = 0
  for (let i = 0; i < index; i++) {
    const s = sectors[i]
    if (!isFiniteNumber(s)) return null
    done += s
  }
  return Math.round((delta - done) * 100) / 100 || 0
}

function sameChip(a: SectorChipView, b: SectorChipView): boolean {
  return a.label === b.label && a.text === b.text && a.tone === b.tone && a.state === b.state
}

/**
 * S1..Sn: completed ones with their value, the current one marked (its value comes apart, see
 * liveSectorDelta), the rest dim. Unchanged chips (and an unchanged row) keep their objects.
 * Depends on the sectors and on whether there is a delta, never on its value: the 30 Hz delta
 * does not rebuild the row.
 */
export function sectorChips(
  sectors: readonly (number | null)[] | null | undefined,
  deltaKnown: boolean,
  m: Messages,
  prev?: readonly SectorChipView[]
): readonly SectorChipView[] {
  const list = Array.isArray(sectors) ? sectors : []
  if (list.length === 0) return unknownSectors(m)
  const current = currentSector(list, deltaKnown)
  const sector = m.widgets.common.sector
  const next: SectorChipView[] = []
  for (let i = 0; i < list.length; i++) {
    const v = list[i]
    const label = sector(i + 1)
    const chip: SectorChipView = isFiniteNumber(v)
      ? { label, text: formatDelta(v), tone: deltaTone(v), state: 'done' }
      : { label, text: '', tone: 'dim', state: i === current ? 'current' : 'ahead' }
    const p = prev?.[i]
    next.push(p !== undefined && sameChip(p, chip) ? p : chip)
  }
  if (prev !== undefined && prev.length === next.length && next.every((c, i) => c === prev[i])) {
    return prev
  }
  return next.length > 0 ? next : NO_CHIPS
}

/** Chip density by count: labels go first when the row gets crowded. */
export function sectorDensity(count: number): 'normal' | 'compact' | 'tight' {
  return count <= 4 ? 'normal' : count <= 7 ? 'compact' : 'tight'
}
