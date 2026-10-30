/**
 * View model of the info bars (ui/InfoBar.vue): each item a bar draws, formatted from the
 * payload's InfoBarData in the interface language, flat so an unchanged item keeps its object
 * (`reuseInfoBar`), split into the bar's start and end (the `split` marker). An item with nothing
 * to say (no data yet, a dry track for `wet`) is left out: it takes no room. Pure.
 *
 *   CARRERA  SoF 2.1k  24 coches            3x · DQ a 17x   38:19  ≈19 v
 *   iR +13 ▲  P4 +31  neutro P6   VR #9 1:01.234      SR 3.98 → 4.02 ▲  margen 4x
 *   PISTA 34°C ▲  ▰▰▱ Poco mojado  (dial) 12 km/h  AIRE 22°C  GOMA Media-alta
 *
 * The standings header's own view (widgets/standings/headerView.ts) words the same figures; this
 * one is what every bar shares (packages P1 and P2 move their headers and footers onto it).
 */
import { deepEqual } from '@shared/equal'
import {
  formatIRating,
  formatIRatingDelta,
  formatLapTime,
  formatRemaining,
  formatSafetyRating,
  formatSessionType,
  signAt
} from '@shared/format'
import type { Messages } from '@shared/i18n'
import { isInfoItem } from '@shared/infoBar'
import { isRaceSession } from '@shared/sessionInfo'
import type {
  ElementEntry,
  InfoBarData,
  InfoBarEntryId,
  InfoItemId,
  PlayerRatingProjection,
  SafetyRatingProjection
} from '@shared/types'
import type { IconName } from '@renderer/ui/icons'
import type { Tone } from '@renderer/ui/tones'
import {
  NO_FOOTER,
  PREVIEW_CONDITIONS,
  footerView,
  type FooterReading,
  type FooterView,
  type TrackTempItem,
  type Units,
  type WetnessItem,
  type WindItem
} from './conditions'
import { formatCarNumber } from './driverCell'
import { PREVIEW_INCIDENTS, toIncidentCountView, type IncidentCountView } from './incidents'

export type Arrow = Extract<IconName, 'arrow-up' | 'arrow-down'> | ''

/** One drawn item: its id and what it shows (every string already worded). */
export type InfoItemView =
  | { readonly id: 'title'; readonly text: string }
  | { readonly id: 'session'; readonly text: string }
  /** `finished`: the chequered flag icon and 'Final' instead of the clock icon. */
  | {
      readonly id: 'remaining'
      readonly text: string
      readonly finished: boolean
      /** The same in full words ('≈19 vueltas'), drawn where they fit (R50); '' when none. */
      readonly textLong?: string
    }
  | { readonly id: 'clock'; readonly text: string }
  /** The sim's time of day ('14:32'), in the local clock's format, with its own icon. */
  | { readonly id: 'simClock'; readonly text: string }
  | { readonly id: 'sof'; readonly text: string }
  | { readonly id: 'carCount'; readonly text: string }
  | { readonly id: 'incidents'; readonly count: IncidentCountView }
  | {
      readonly id: 'iRating'
      /** 'iR'. */
      readonly key: string
      /** '+13'. */
      readonly value: string
      readonly tone: Tone
      readonly arrow: Arrow
      /** 'P4 +31' (or '±17/pos' without your position), '' when none. */
      readonly swingUp: string
      /** 'P6 −5', '' when none. */
      readonly swingDown: string
      /** 'neutro P6', '' when unknown. */
      readonly neutral: string
    }
  | {
      readonly id: 'safetyRating'
      /** 'SR'. */
      readonly key: string
      /** '3.98' ('B 3.98' when the projection changes the licence class). */
      readonly from: string
      readonly to: string
      readonly tone: Tone
      readonly arrow: Arrow
      /** 'margen 4x', 'sin margen', 'margen —'. */
      readonly budget: string
      readonly budgetTone: 'dim' | 'neutral' | 'warn' | 'bad'
    }
  | {
      readonly id: 'fastestLap'
      /** 'VR'. */
      readonly tag: string
      /** '#9 1:01.234'. */
      readonly text: string
      /** It is your lap. */
      readonly mine: boolean
    }
  | { readonly id: 'fuelLaps'; readonly label: string; readonly value: string }
  | { readonly id: 'trackTemp'; readonly reading: TrackTempItem }
  | { readonly id: 'airTemp'; readonly reading: FooterReading }
  | { readonly id: 'wind'; readonly reading: WindItem }
  | {
      readonly id: 'wet'
      /** The plate while declared wet ('DECLARADA MOJADA'). */
      readonly declared: string | null
      readonly wetness: WetnessItem | null
      readonly rain: FooterReading | null
    }
  | { readonly id: 'rubber'; readonly reading: FooterReading }

/** What a bar draws: its items before the `split` marker, and after it (at the far end). */
export interface InfoBarView {
  readonly start: readonly InfoItemView[]
  readonly end: readonly InfoItemView[]
}

export const NO_BAR: InfoBarView = Object.freeze({
  start: Object.freeze([]),
  end: Object.freeze([])
})

/** Something to draw: the bar exists (and takes its height). */
export function hasInfoBar(v: InfoBarView): boolean {
  return v.start.length > 0 || v.end.length > 0
}

/** What the items need besides the payload: the widget's own words and options. */
export interface InfoBarContext {
  /** The widget's name ('RELATIVO'): the `title` item. */
  readonly title: string
  /** Shown by `session` while the session type is unknown ('' for nothing). */
  readonly sessionFallback: string
  /** The local time ('21:07'), '' when the bar draws no clock. */
  readonly clock: string
  readonly units: Units
  /** The `trackTemp` item's trend arrow and the `wind` item's dial (the section's options). */
  readonly trend: boolean
  readonly windDirection: boolean
  readonly m: Messages
}

/** The entries a bar draws, in order (`split` included): none with its size 'off'. */
export function barEntries(
  list: readonly Readonly<ElementEntry<InfoBarEntryId>>[],
  size: string
): InfoBarEntryId[] {
  if (size === 'off') return []
  const out: InfoBarEntryId[] = []
  for (const e of list) if (e.visible && !out.includes(e.id)) out.push(e.id)
  return out
}

function valueTone(sign: 1 | 0 | -1 | null): Tone {
  return sign === 1 ? 'good' : sign === -1 ? 'bad' : 'neutral'
}

function arrowOf(sign: 1 | 0 | -1 | null): Arrow {
  return sign === 1 ? 'arrow-up' : sign === -1 ? 'arrow-down' : ''
}

/** The incident margin, red only when it is really gone (as the standings header has it). */
export function srBudgetText(
  sr: SafetyRatingProjection,
  m: Messages
): { text: string; tone: 'dim' | 'neutral' | 'warn' | 'bad' } {
  const t = m.widgets.standings
  const budget = Number.isFinite(sr.incidentBudget) ? Math.max(0, Math.floor(sr.incidentBudget)) : 0
  const incidents = Number.isFinite(sr.incidents) ? Math.max(0, Math.round(sr.incidents)) : 0
  const losing = signAt(sr.projected - sr.current, 2) === -1
  if (budget === 0 && (incidents > 0 || losing)) return { text: t.noBudget, tone: 'bad' }
  if (budget === 0) return { text: t.budgetUnknown, tone: 'dim' }
  return { text: t.budget(budget), tone: budget <= 2 ? 'warn' : 'neutral' }
}

function iRatingView(
  ir: PlayerRatingProjection,
  pos: number | null,
  m: Messages
): Extract<InfoItemView, { id: 'iRating' }> {
  const t = m.widgets.standings
  const sign = signAt(ir.iRatingDelta, 0)
  let up =
    pos !== null && pos > 1 && ir.ifGainOne !== null
      ? `P${pos - 1} ${formatIRatingDelta(ir.ifGainOne)}`
      : ''
  const down =
    pos !== null && ir.ifLoseOne !== null ? `P${pos + 1} ${formatIRatingDelta(ir.ifLoseOne)}` : ''
  if (up === '' && down === '' && Number.isFinite(ir.perPosition) && ir.perPosition > 0) {
    up = t.perPosition(Math.round(ir.perPosition))
  }
  const neutral =
    Number.isFinite(ir.breakEvenPosition) && ir.breakEvenPosition > 0
      ? t.breakEven(Math.round(ir.breakEvenPosition))
      : ''
  return {
    id: 'iRating',
    key: t.irKey,
    value: formatIRatingDelta(ir.iRatingDelta),
    tone: valueTone(sign),
    arrow: arrowOf(sign),
    swingUp: up,
    swingDown: down,
    neutral
  }
}

function safetyView(
  sr: SafetyRatingProjection,
  m: Messages
): Extract<InfoItemView, { id: 'safetyRating' }> {
  const letters = sr.licClass !== sr.projectedLicClass
  // Compared as shown (hundredths), so the arrow never contradicts the numbers.
  const sign = signAt(sr.projected - sr.current, 2)
  const budget = srBudgetText(sr, m)
  return {
    id: 'safetyRating',
    key: m.widgets.standings.srKey,
    from: (letters ? `${sr.licClass} ` : '') + formatSafetyRating(sr.current),
    to: (letters ? `${sr.projectedLicClass} ` : '') + formatSafetyRating(sr.projected),
    tone: valueTone(sign),
    arrow: arrowOf(sign),
    budget: budget.text,
    budgetTone: budget.tone
  }
}

/** What is left: 'Última vuelta' on a race's last lap without a clock, else clock and/or laps. */
function remainingView(d: InfoBarData, m: Messages): InfoItemView | null {
  if (d.finished) return { id: 'remaining', text: m.widgets.standings.finished, finished: true }
  const race = isRaceSession(d.sessionType)
  if (race && d.lapsRemaining === 1 && d.timeRemainingS === null) {
    return { id: 'remaining', text: m.widgets.standings.lastLap, finished: false }
  }
  const text = formatRemaining(d.lapsRemaining, d.timeRemainingS, m)
  const textLong = formatRemaining(d.lapsRemaining, d.timeRemainingS, m, true)
  return text !== '' ? { id: 'remaining', text, finished: false, textLong } : null
}

/** One item's view, null when it has nothing to show. */
function itemView(
  id: InfoItemId,
  d: InfoBarData,
  weather: FooterView,
  c: InfoBarContext
): InfoItemView | null {
  const m = c.m
  switch (id) {
    case 'title':
      return c.title !== '' ? { id, text: c.title } : null
    case 'session': {
      const text = formatSessionType(d.sessionType, m) || c.sessionFallback
      return text !== '' ? { id, text } : null
    }
    case 'remaining':
      return remainingView(d, m)
    case 'clock':
      return c.clock !== '' ? { id, text: c.clock } : null
    case 'simClock':
      return d.simMinutes !== null ? { id, text: simClockText(d.simMinutes) } : null
    case 'sof': {
      const sof = formatIRating(d.sof)
      return sof !== '' ? { id, text: m.widgets.standings.sof(sof) } : null
    }
    case 'carCount':
      return d.carCount !== null && d.carCount > 0
        ? { id, text: m.widgets.standings.cars(d.carCount) }
        : null
    case 'incidents': {
      const count = toIncidentCountView(d.incidents, m)
      return count !== null ? { id, count } : null
    }
    case 'iRating':
      return d.iRating !== null ? iRatingView(d.iRating, d.classPosition, m) : null
    case 'safetyRating':
      return d.safetyRating !== null ? safetyView(d.safetyRating, m) : null
    case 'fastestLap': {
      const f = d.fastestLap
      const time = f !== null ? formatLapTime(f.lapTime) : '—'
      if (f === null || time === '—') return null
      return {
        id,
        tag: m.widgets.info.fastestTag,
        text: m.widgets.info.fastestLap(formatCarNumber(f.carNumber), time),
        mine: f.isPlayer
      }
    }
    case 'fuelLaps':
      return d.fuelLaps !== null && Number.isFinite(d.fuelLaps)
        ? {
            id,
            label: m.widgets.info.fuel,
            value: m.widgets.info.fuelLaps(d.fuelLaps.toFixed(1))
          }
        : null
    case 'trackTemp':
      return weather.track !== null ? { id, reading: weather.track } : null
    case 'airTemp':
      return weather.air !== null ? { id, reading: weather.air } : null
    case 'wind':
      return weather.wind !== null ? { id, reading: weather.wind } : null
    case 'wet':
      return weather.declaredWet !== null || weather.wetness !== null || weather.rain !== null
        ? { id, declared: weather.declaredWet, wetness: weather.wetness, rain: weather.rain }
        : null
    case 'rubber':
      return weather.rubber !== null ? { id, reading: weather.rubber } : null
  }
}

/**
 * The bar's view for its entries (barEntries: the visible ones in order, `split` included):
 * NO_BAR when it has none, or nothing to show.
 */
export function infoBarView(
  entries: readonly InfoBarEntryId[],
  data: InfoBarData | null,
  c: InfoBarContext
): InfoBarView {
  if (entries.length === 0) return NO_BAR
  const d = data ?? NO_DATA
  const weather =
    d.conditions !== null
      ? footerView(
          d.conditions,
          {
            conditionsFooter: true,
            conditionsTrackTemp: entries.includes('trackTemp'),
            conditionsTrend: c.trend,
            conditionsWet: entries.includes('wet'),
            conditionsWind: entries.includes('wind'),
            conditionsWindDirection: c.windDirection,
            conditionsAirTemp: entries.includes('airTemp'),
            conditionsRubber: entries.includes('rubber')
          },
          c.units,
          c.m
        )
      : NO_FOOTER
  const start: InfoItemView[] = []
  const end: InfoItemView[] = []
  let side = start
  for (const id of entries) {
    if (!isInfoItem(id)) {
      side = end
      continue
    }
    const v = itemView(id, d, weather, c)
    if (v !== null) side.push(v)
  }
  return start.length === 0 && end.length === 0 ? NO_BAR : { start, end }
}

/** 'HH:MM' of whole minutes since midnight, 24 h as the local clock (useClock's clockText). */
export function simClockText(minutes: number): string {
  const m = ((Math.floor(minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

const NO_DATA: InfoBarData = Object.freeze({
  sessionType: null,
  lapsRemaining: null,
  timeRemainingS: null,
  finished: false,
  sof: null,
  carCount: null,
  incidents: null,
  iRating: null,
  classPosition: null,
  safetyRating: null,
  fastestLap: null,
  conditions: null,
  fuelLaps: null,
  simMinutes: null
})

/**
 * `next` with every item equal to the one of `prev` kept as that object (a v-memo on it skips
 * it); `prev` itself when nothing changed at all.
 */
export function reuseInfoBar(prev: InfoBarView | undefined, next: InfoBarView): InfoBarView {
  if (prev === undefined || next === NO_BAR) return next
  const pool = [...prev.start, ...prev.end]
  const keep = (items: readonly InfoItemView[]): InfoItemView[] =>
    items.map((v) => pool.find((p) => p.id === v.id && deepEqual(p, v)) ?? v)
  const start = keep(next.start)
  const end = keep(next.end)
  const same = (a: readonly InfoItemView[], b: readonly InfoItemView[]): boolean =>
    a.length === b.length && a.every((v, i) => v === b[i])
  return same(start, prev.start) && same(end, prev.end) ? prev : { start, end }
}

/**
 * The edit-mode samples' data: a rated race in its second half, your class's figures and fastest
 * lap, the conditions of the footers' sample and the fuel's (every item has something to show).
 */
export const PREVIEW_INFO: Readonly<InfoBarData> = Object.freeze({
  sessionType: 'Race',
  lapsRemaining: 19,
  timeRemainingS: 2299,
  finished: false,
  sof: 2140,
  carCount: 24,
  incidents: PREVIEW_INCIDENTS,
  iRating: Object.freeze({
    iRatingDelta: 13,
    perPosition: 18,
    breakEvenPosition: 6,
    ifGainOne: 31,
    ifLoseOne: -5
  }),
  classPosition: 5,
  safetyRating: Object.freeze({
    current: 3.98,
    projected: 4.02,
    licClass: 'B',
    projectedLicClass: 'B',
    incidents: 3,
    corners: 112,
    incidentBudget: 4
  }),
  fastestLap: Object.freeze({
    lapTime: 128.734,
    carIdx: 9,
    carNumber: '9',
    driverName: 'Lars Eriksen',
    isPlayer: false
  }),
  conditions: PREVIEW_CONDITIONS,
  fuelLaps: 6.4,
  // 14:32 on track (the local clock is the computer's).
  simMinutes: 14 * 60 + 32
})
