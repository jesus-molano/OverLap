/**
 * AlertsData to what the alerts banner shows. Pure.
 *
 * Every flag has its own words and its own mark (a pattern tile or the flag icon), so it reads
 * without its colour, colour-blind palette included. Colours are names of the widget's local
 * flag palette (--al-* in AlertsWidget.vue): the theme has no flag colours. Words come from the
 * dictionary `m` (messagesFor(lang)).
 */
import { FLAG_ORDER } from '@shared/alerts'
import { NBSP, formatSpeed, speedUnit } from '@shared/format'
import type { Messages } from '@shared/i18n'
import type { AlertsData, AlertsOptions, AppearanceSettings, FlagKind } from '@shared/types'
import type { IconName } from '@renderer/ui/icons'
import { perDictionary } from '@renderer/view/perDictionary'

/** Band colour: the flag's own. */
export type FlagFill = 'black' | 'yellow' | 'red' | 'blue' | 'white' | 'green'
/** Text on the fill. */
export type FlagInk = 'dark' | 'light'
/**
 * What tells the flag apart besides its colour and words: the flag icon (plain flags) or a tile
 * drawn like the real flag (static CSS gradients).
 */
export type FlagMark = 'flag' | 'cross' | 'disc' | 'hazard' | 'stripes' | 'diagonal' | 'checker'

export interface FlagView {
  readonly kind: FlagKind
  /** Main band text ('BANDERA NEGRA'). */
  readonly label: string
  /** The label in narrow windows ('A CUADROS'); '' when the label itself fits. */
  readonly short: string
  /** What to do, after the label ('déjale pasar'); '' when the label says it all. */
  readonly note: string
  /** Text of the small chip when the flag is not the main one. */
  readonly chip: string
  readonly fill: FlagFill
  readonly ink: FlagInk
  readonly mark: FlagMark
}

const INK: Readonly<Record<FlagFill, FlagInk>> = {
  black: 'light',
  red: 'light',
  blue: 'light',
  yellow: 'dark',
  white: 'dark',
  green: 'dark'
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
  blue: { fill: 'blue', mark: 'diagonal' },
  white: { fill: 'white', mark: 'flag' },
  checkered: { fill: 'black', mark: 'checker' },
  green: { fill: 'green', mark: 'flag' }
}

/**
 * One frozen view per flag and language: a flag keeps its object, so the band re-renders only
 * when the flag (or the language) changes.
 */
export const flagViews = perDictionary((m): Readonly<Record<FlagKind, FlagView>> => {
  const words = m.widgets.alerts.flags
  const out = {} as Record<FlagKind, FlagView>
  for (const kind of Object.keys(LOOKS) as FlagKind[]) {
    const w = words[kind]
    const { fill, mark } = LOOKS[kind]
    out[kind] = Object.freeze({
      kind,
      label: w.label,
      short: w.short,
      note: w.note,
      chip: w.chip !== '' ? w.chip : w.label,
      fill,
      ink: INK[fill],
      mark
    })
  }
  return Object.freeze(out)
})

/** The options the banner reads (the provider applies them too; holdS is the provider's alone). */
export type AlertFilter = Pick<AlertsOptions, 'showFlags' | 'showBlue' | 'showPitLimiter'>

export const SHOW_ALL: AlertFilter = Object.freeze({
  showFlags: true,
  showBlue: true,
  showPitLimiter: true
})

/** Secondary flags drawn as chips; more than this is noise (they stay in priority order). */
export const MAX_CHIPS = 3

/**
 * The flags to draw, most important first (FLAG_ORDER, the provider's): the options applied,
 * unknown and repeated kinds dropped (the payload crosses IPC), whatever order they came in. The
 * provider filters too; doing it here as well applies an option at once and to the sample.
 */
export function shownFlags(flags: readonly FlagKind[], o: AlertFilter): FlagKind[] {
  if (!o.showFlags || flags.length === 0) return []
  return FLAG_ORDER.filter((k) => (k !== 'blue' || o.showBlue) && flags.includes(k))
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
}

const LIMITER_ICONS: Readonly<Record<LimiterState, IconName>> = {
  on: 'check',
  off: 'warning',
  speeding: 'alert'
}

const isLimiterState = (v: unknown): v is LimiterState =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(LIMITER_ICONS, v)

/** 'LIMITADOR', 'LIMITADOR OFF', 'EXCESO'. */
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
  const state = d.pitLimiter
  return {
    state,
    icon: LIMITER_ICONS[state],
    label: limiterLabel(state, m),
    ...speedView(d.speedKmh, d.pitLimitKmh, units, state === 'speeding')
  }
}

/** Whether a payload has anything to draw with these options. */
export function hasAlerts(d: AlertsData, o: AlertFilter): boolean {
  if (!d.visible) return false
  return shownFlags(d.flags, o).length > 0 || (o.showPitLimiter && isLimiterState(d.pitLimiter))
}

export interface FlagsView {
  /** The most important flag (the band), null when no flag is shown. */
  readonly primary: FlagView | null
  /** The next ones as chips, at most MAX_CHIPS. */
  readonly secondary: readonly FlagView[]
}

const NO_FLAGS: FlagsView = Object.freeze({ primary: null, secondary: Object.freeze([]) })

/**
 * Flags to band + chips. Keeps `prev` while the same flags are shown in the same language (one
 * identity check per flag).
 */
export function toFlagsView(
  flags: readonly FlagKind[],
  o: AlertFilter,
  m: Messages,
  prev?: FlagsView
): FlagsView {
  const kinds = shownFlags(flags, o)
  const first = kinds[0]
  if (first === undefined) return NO_FLAGS
  const views = flagViews(m)
  const primary = views[first]
  const secondary = kinds.slice(1, 1 + MAX_CHIPS).map((k) => views[k])
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
