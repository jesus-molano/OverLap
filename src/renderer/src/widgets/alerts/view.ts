/**
 * AlertsData to what the alerts banner shows. Pure.
 *
 * Every alert has its own words and its own mark (a pattern tile, the flag icon or another icon
 * of the kit), so it reads without its colour, colour-blind palette included. Flags take their
 * own colours, names of the widget's local flag palette (--al-* in AlertsWidget.vue); the other
 * alerts the overlay's: 'alarm' (a solid band, like the limiter alarm) for what needs acting on
 * now, 'warn' and 'info' (a quiet band with a rail in that tone) for the rest. Words come from
 * the dictionary `m` (messagesFor(lang)).
 */
import {
  ALERT_ORDER,
  FLAG_OPTION,
  FLAG_ORDER,
  NOTICE_OPTION,
  NOTICE_ORDER,
  type AlertKind,
  type AlertToggle
} from '@shared/alerts'
import { NBSP, formatClock, formatSpeed, speedUnit } from '@shared/format'
import type { Messages } from '@shared/i18n'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import type {
  AlertNotice,
  AlertsData,
  AlertsOptions,
  AppearanceSettings,
  FlagKind,
  NoticeKind
} from '@shared/types'
import type { IconName } from '@renderer/ui/icons'
import { perDictionary } from '@renderer/view/perDictionary'
import { shallowEqual } from '@renderer/view/reuse'

/** Band colour of a flag: the flag's own. */
export type FlagFill = 'black' | 'yellow' | 'red' | 'blue' | 'white' | 'green'
/** Band colour of any alert: a flag's, or the overlay's alarm / warn / info tone. */
export type AlertFill = FlagFill | 'alarm' | 'warn' | 'info'
/** Text on the fill ('alarm': the alarm's own ink, dark in the colour-blind palette). */
export type FlagInk = 'dark' | 'light' | 'alarm'
/**
 * What tells the alert apart besides its colour and words: an icon (the flag icon of the plain
 * flags, `icon` for the other alerts) or a tile drawn like the real flag (static CSS gradients).
 */
export type FlagMark =
  'flag' | 'icon' | 'cross' | 'disc' | 'hazard' | 'stripes' | 'halves' | 'diagonal' | 'checker'

export interface FlagView {
  readonly kind: AlertKind
  /** Main band text ('BANDERA NEGRA'). */
  readonly label: string
  /** The label in narrow windows ('A CUADROS'); '' when the label itself fits. */
  readonly short: string
  /** What to do, after the label ('déjale pasar'); '' when the label says it all. */
  readonly note: string
  /** Text of the small chip when the alert is not the main one. */
  readonly chip: string
  readonly fill: AlertFill
  readonly ink: FlagInk
  readonly mark: FlagMark
  /** The icon of mark 'icon', null for the others. */
  readonly icon: IconName | null
}

/** Labels longer than this get a short one for narrow windows (13 fit the narrowest window). */
const SHORT_FROM = 13

const INK: Readonly<Record<AlertFill, FlagInk>> = {
  black: 'light',
  red: 'light',
  blue: 'light',
  yellow: 'dark',
  white: 'dark',
  green: 'dark',
  alarm: 'alarm',
  // The quiet bands sit on the glass: the widget's own text colour.
  warn: 'light',
  info: 'light'
}

/** How each flag looks, whatever the language. */
const LOOKS: Readonly<Record<FlagKind, { readonly fill: FlagFill; readonly mark: FlagMark }>> = {
  disqualified: { fill: 'black', mark: 'cross' },
  black: { fill: 'black', mark: 'flag' },
  meatball: { fill: 'black', mark: 'disc' },
  red: { fill: 'red', mark: 'flag' },
  caution: { fill: 'yellow', mark: 'hazard' },
  yellow: { fill: 'yellow', mark: 'flag' },
  debris: { fill: 'yellow', mark: 'stripes' },
  // A black flag that is only a warning: black and white halves, like the warning flag.
  furled: { fill: 'black', mark: 'halves' },
  blue: { fill: 'blue', mark: 'diagonal' },
  white: { fill: 'white', mark: 'flag' },
  checkered: { fill: 'black', mark: 'checker' },
  green: { fill: 'green', mark: 'flag' }
}

/** How each other alert looks: what needs acting on now is an alarm. */
const NOTICE_LOOKS: Readonly<
  Record<NoticeKind, { readonly fill: 'alarm' | 'warn' | 'info'; readonly icon: IconName }>
> = {
  wrongWay: { fill: 'alarm', icon: 'warning' },
  pitEntry: { fill: 'alarm', icon: 'pit' },
  stalled: { fill: 'alarm', icon: 'alert' },
  oilPressure: { fill: 'alarm', icon: 'alert' },
  water: { fill: 'alarm', icon: 'alert' },
  oilTemp: { fill: 'alarm', icon: 'alert' },
  fuelPressure: { fill: 'alarm', icon: 'alert' },
  tow: { fill: 'warn', icon: 'clock' },
  lapsToGo: { fill: 'info', icon: 'chequered' },
  engineTrend: { fill: 'warn', icon: 'arrow-up' }
}

/** The notices whose words never change (the others carry a value). */
type StaticNotice = Exclude<NoticeKind, 'tow' | 'lapsToGo' | 'engineTrend'>
const STATIC_NOTICES = [
  'wrongWay',
  'pitEntry',
  'stalled',
  'oilPressure',
  'water',
  'oilTemp',
  'fuelPressure'
] as const satisfies readonly StaticNotice[]

interface Words {
  readonly label: string
  readonly short: string
  readonly note: string
  readonly chip: string
}

function flagLike(
  kind: AlertKind,
  w: Words,
  fill: AlertFill,
  mark: FlagMark,
  icon: IconName | null
): FlagView {
  return Object.freeze({
    kind,
    label: w.label,
    short: w.short,
    note: w.note,
    chip: w.chip !== '' ? w.chip : w.label,
    fill,
    ink: INK[fill],
    mark,
    icon
  })
}

function noticeLike(kind: NoticeKind, w: Words): FlagView {
  const { fill, icon } = NOTICE_LOOKS[kind]
  return flagLike(kind, w, fill, 'icon', icon)
}

/**
 * One frozen view per flag and language: a flag keeps its object, so the band re-renders only
 * when the flag (or the language) changes.
 */
export const flagViews = perDictionary((m): Readonly<Record<FlagKind, FlagView>> => {
  const words = m.widgets.alerts.flags
  const out = {} as Record<FlagKind, FlagView>
  for (const kind of Object.keys(LOOKS) as FlagKind[]) {
    const { fill, mark } = LOOKS[kind]
    out[kind] = flagLike(kind, words[kind], fill, mark, mark === 'flag' ? 'flag' : null)
  }
  return Object.freeze(out)
})

/** The same for the alerts without a value. */
export const staticNoticeViews = perDictionary((m): Readonly<Record<StaticNotice, FlagView>> => {
  const words = m.widgets.alerts.notices
  const out = {} as Record<StaticNotice, FlagView>
  for (const kind of STATIC_NOTICES) out[kind] = noticeLike(kind, words[kind])
  return Object.freeze(out)
})

/** The options the banner reads (the provider applies them too; holdS is the provider's alone). */
export type AlertFilter = Readonly<Pick<AlertsOptions, AlertToggle>>

const TOGGLES = (Object.keys(OPTION_SCHEMA.alerts) as (keyof AlertsOptions)[]).filter(
  (k): k is AlertToggle => OPTION_SCHEMA.alerts[k].kind === 'bool'
)

/** The toggles of `o` (a new object; see reuseView for a stable one). */
export function alertFilter(o: AlertsOptions): AlertFilter {
  const out = {} as Record<AlertToggle, boolean>
  for (const k of TOGGLES) out[k] = o[k]
  return out
}

export const SHOW_ALL: AlertFilter = Object.freeze(
  Object.fromEntries(TOGGLES.map((k) => [k, true])) as Record<AlertToggle, boolean>
)

/** Secondary alerts drawn as chips over the game; more than this is noise (in priority order). */
export const MAX_CHIPS = 3

/**
 * The flags to draw, most important first (FLAG_ORDER, the provider's): the options applied,
 * unknown and repeated kinds dropped (the payload crosses IPC), whatever order they came in. The
 * provider filters too; doing it here as well applies an option at once and to the sample.
 */
export function shownFlags(flags: readonly FlagKind[], o: AlertFilter): FlagKind[] {
  if (!o.showFlags || flags.length === 0) return []
  return FLAG_ORDER.filter((k) => {
    const own = FLAG_OPTION[k]
    return (own === undefined || o[own]) && flags.includes(k)
  })
}

const FLUIDS: ReadonlySet<unknown> = new Set(['water', 'oil'])
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** A notice as sent, or null when it is not one this view knows (the payload crosses IPC). */
function validNotice(n: unknown): AlertNotice | null {
  if (typeof n !== 'object' || n === null) return null
  const v = n as Record<string, unknown>
  const kind = v.kind
  if (typeof kind !== 'string' || !Object.prototype.hasOwnProperty.call(NOTICE_LOOKS, kind)) {
    return null
  }
  if (kind === 'tow') return finite(v.seconds) && v.seconds > 0 ? (n as AlertNotice) : null
  if (kind === 'lapsToGo') return finite(v.laps) && v.laps >= 1 ? (n as AlertNotice) : null
  if (kind === 'engineTrend') {
    const ok = FLUIDS.has(v.fluid) && finite(v.tempC) && finite(v.deltaC)
    return ok ? (n as AlertNotice) : null
  }
  return n as AlertNotice
}

/** The notices to draw, in NOTICE_ORDER, one per kind, with the options applied. */
export function shownNotices(notices: readonly AlertNotice[], o: AlertFilter): AlertNotice[] {
  if (notices.length === 0) return []
  const byKind = new Map<NoticeKind, AlertNotice>()
  for (const raw of notices) {
    const n = validNotice(raw)
    if (n && !byKind.has(n.kind) && o[NOTICE_OPTION[n.kind]]) byKind.set(n.kind, n)
  }
  const out: AlertNotice[] = []
  for (const kind of NOTICE_ORDER) {
    const n = byKind.get(kind)
    if (n) out.push(n)
  }
  return out
}

/** '98 °C' / '208 °F'. */
export function formatTemp(c: number, units: AppearanceSettings['units']): string {
  return units === 'imperial'
    ? `${Math.round((c * 9) / 5 + 32)}${NBSP}°F`
    : `${Math.round(c)}${NBSP}°C`
}

/** A rise of `c` °C: '+6' ('+11' in °F). */
export function formatRise(c: number, units: AppearanceSettings['units']): string {
  const v = Math.max(0, Math.round(units === 'imperial' ? (c * 9) / 5 : c))
  return `+${v}`
}

/** The words of one notice. */
export function noticeView(
  n: AlertNotice,
  units: AppearanceSettings['units'],
  m: Messages
): FlagView {
  const t = m.widgets.alerts
  switch (n.kind) {
    case 'tow':
      return noticeLike(n.kind, {
        label: t.tow(formatClock(n.seconds)),
        short: '',
        note: t.towNote,
        chip: ''
      })
    case 'lapsToGo':
      return noticeLike(n.kind, {
        label: t.lapsToGo(Math.round(n.laps)),
        short: '',
        note: t.lapsToGoNote,
        chip: ''
      })
    case 'engineTrend': {
      const temp = formatTemp(n.tempC, units)
      const rise = formatRise(n.deltaC, units)
      const label = t.trend.label[n.fluid](temp)
      const note = t.trend.note(rise)
      return noticeLike(n.kind, {
        label,
        short: label.length > SHORT_FROM ? t.trend.short[n.fluid](temp) : '',
        note: n.draft ? `${note} ${t.trend.draft}` : note,
        chip: t.trend.chip[n.fluid](`${rise}${NBSP}°${units === 'imperial' ? 'F' : 'C'}`)
      })
    }
    default:
      return staticNoticeViews(m)[n.kind]
  }
}

export type LimiterState = NonNullable<AlertsData['pitLimiter']>

export interface SpeedView {
  /** '58 / 60', or '58' while the limit is unknown. */
  readonly speed: string
  /** 'km/h' / 'mph' (dropped first in narrow windows). */
  readonly unit: string
}

export interface LimiterView extends SpeedView {
  readonly state: LimiterState
  readonly icon: IconName
  /** 'LIMITADOR' / 'LIMITADOR OFF' / 'EXCESO'. */
  readonly label: string
  /** After the label: 'LIMITADOR OFF' when over the limit without it; '' otherwise. */
  readonly note: string
}

const LIMITER_ICONS: Readonly<Record<LimiterState, IconName>> = {
  on: 'check',
  off: 'warning',
  offSpeeding: 'warning',
  speeding: 'alert'
}

const isLimiterState = (v: unknown): v is LimiterState =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(LIMITER_ICONS, v)

/** 'LIMITADOR', 'LIMITADOR OFF', 'EXCESO' (over the limit, with or without the limiter). */
export function limiterLabel(state: LimiterState, m: Messages): string {
  const t = m.widgets.alerts
  return state === 'on' ? t.limiterOn : state === 'off' ? t.limiterOff : t.speeding
}

/**
 * Speed against the limit in the chosen units: '58 / 60' + 'km/h'; '58' without a known limit.
 * `over` (the provider says you are over the limit) rounds up against the limit, so 60.3 against
 * 60 reads '61 / 60', never a contradictory '60 / 60'.
 */
export function speedView(
  speedKmh: number,
  limitKmh: number | null,
  units: AppearanceSettings['units'],
  over = false
): SpeedView {
  const unit = speedUnit(units)
  let speed = formatSpeed(speedKmh, units)
  if (limitKmh === null || !Number.isFinite(limitKmh) || limitKmh <= 0) return { speed, unit }
  const limit = formatSpeed(limitKmh, units)
  if (over && Number(speed) <= Number(limit)) speed = String(Number(limit) + 1)
  return { speed: `${speed}${NBSP}/${NBSP}${limit}`, unit }
}

/** The pit limiter line, null when it is not shown (off pit road or turned off). */
export function limiterView(
  d: Pick<AlertsData, 'pitLimiter' | 'speedKmh' | 'pitLimitKmh'>,
  o: AlertFilter,
  units: AppearanceSettings['units'],
  m: Messages
): LimiterView | null {
  if (!o.showPitLimiter || !isLimiterState(d.pitLimiter)) return null
  // Without its option, over the limit with the limiter off is just "off".
  const state = d.pitLimiter === 'offSpeeding' && !o.showPitOverspeed ? 'off' : d.pitLimiter
  const over = state === 'speeding' || state === 'offSpeeding'
  return {
    state,
    icon: LIMITER_ICONS[state],
    label: limiterLabel(state, m),
    note: state === 'offSpeeding' ? m.widgets.alerts.limiterOff : '',
    ...speedView(d.speedKmh, d.pitLimitKmh, units, over)
  }
}

/** Whether a payload has anything to draw with these options. */
export function hasAlerts(d: AlertsData, o: AlertFilter): boolean {
  if (!d.visible) return false
  return (
    shownFlags(d.flags, o).length > 0 ||
    shownNotices(Array.isArray(d.notices) ? d.notices : [], o).length > 0 ||
    (o.showPitLimiter && isLimiterState(d.pitLimiter))
  )
}

export interface FlagsView {
  /** The most important alert (the band), null when none is shown. */
  readonly primary: FlagView | null
  /** The next ones as chips, at most `maxChips`. */
  readonly secondary: readonly FlagView[]
}

const NO_FLAGS: FlagsView = Object.freeze({ primary: null, secondary: Object.freeze([]) })

const RANK: ReadonlyMap<AlertKind, number> = new Map(ALERT_ORDER.map((k, i) => [k, i]))
const rankOf = (v: FlagView): number => RANK.get(v.kind) ?? ALERT_ORDER.length

/** A view equal to one of `prev` (same words and looks) becomes that object. */
function reused(v: FlagView, prev: FlagsView | undefined): FlagView {
  if (prev === undefined) return v
  if (prev.primary !== null && shallowEqual(prev.primary, v)) return prev.primary
  return prev.secondary.find((p) => shallowEqual(p, v)) ?? v
}

/**
 * Flags and notices to band + chips, in ALERT_ORDER. Keeps `prev` while the same alerts are
 * shown with the same words (one shallow check per alert).
 */
export function toFlagsView(
  d: Pick<AlertsData, 'flags'> & { readonly notices?: readonly AlertNotice[] },
  o: AlertFilter,
  units: AppearanceSettings['units'],
  m: Messages,
  prev?: FlagsView,
  maxChips: number = MAX_CHIPS
): FlagsView {
  const flags = flagViews(m)
  const notices = Array.isArray(d.notices) ? d.notices : []
  const views = [
    ...shownFlags(d.flags, o).map((k) => flags[k]),
    ...shownNotices(notices, o).map((n) => reused(noticeView(n, units, m), prev))
  ].sort((a, b) => rankOf(a) - rankOf(b))
  const primary = views[0]
  if (primary === undefined) return NO_FLAGS
  const secondary = views.slice(1, 1 + Math.max(0, maxChips))
  if (
    prev !== undefined &&
    prev.primary === primary &&
    prev.secondary.length === secondary.length &&
    prev.secondary.every((f, i) => f === secondary[i])
  ) {
    return prev
  }
  return { primary, secondary }
}

/**
 * The limiter line is drawn as large as the flag band when it is the only content, and always when
 * it is an alarm (off or over the limit): on pit road it matters more than any flag.
 */
export function limiterHero(flags: FlagsView, limiter: LimiterView | null): boolean {
  return limiter !== null && (flags.primary === null || limiter.state !== 'on')
}

/**
 * The options to draw the edit-mode sample with: the user's, unless they hide everything (then
 * the whole sample, so the window can still be placed and sized).
 */
export function previewFilter(sample: AlertsData, o: AlertFilter): AlertFilter {
  return hasAlerts(sample, o) ? o : SHOW_ALL
}

/**
 * Everything the panel height depends on besides the width and the font: whether there is a
 * band, how many chips, and the limiter line (none, normal or hero).
 */
export function layoutKey(flags: FlagsView, limiter: LimiterView | null): string {
  const line = limiter === null ? 0 : limiterHero(flags, limiter) ? 2 : 1
  return `${flags.primary !== null ? 1 : 0}|${flags.secondary.length}|${line}`
}
