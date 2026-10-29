/**
 * LightsData to what the warning lights strip draws. Pure.
 *
 * Every light keeps its place on the strip (lights.icons, the user's order; LIGHT_ORDER by
 * default) and its own pictogram (ui/engineIcons);
 * lit, it takes its severity's colour and its own shape (a solid tile, a ring, a key line, a
 * rail: LightsWidget.vue), so it reads without its colour, colour-blind or not. The options apply
 * here as well as in the provider, so an option shows at once and on the samples. Words come
 * from the dictionary `m` (messagesFor(lang)).
 */
import { visibleIds } from '@shared/elements'
import { LIGHT_ORDER } from '@shared/lights'
import { tempDeltaIn, tempIn } from '@shared/format'
import type { Messages } from '@shared/i18n'
import type {
  AppearanceSettings,
  LightKind,
  LightLevel,
  LightReading,
  LightsData,
  LightsOptions
} from '@shared/types'
import type { EngineIconName } from '@renderer/ui/engineIcons'
import { PREVIEW_LIGHTS, PREVIEW_LIGHTS_REAL } from './preview'

/** Each light's pictogram. */
export const LIGHT_ICONS: Readonly<Record<LightKind, EngineIconName>> = {
  oilPressure: 'oil-pressure',
  fuelPressure: 'fuel-pressure',
  stalled: 'engine',
  repair: 'repair',
  repairOptional: 'repair-optional',
  water: 'water-temp',
  oilTemp: 'oil-temp',
  pitLimiter: 'pit-limiter',
  revLimiter: 'rev-limiter'
}

/** The options the strip reads (the layout and the colours are the component's). */
export type LightsFilter = Readonly<
  Pick<
    LightsOptions,
    | 'onlyWhenLit'
    | 'showCaptions'
    | 'showTemps'
    | 'showRepairTime'
    | 'repairCrewTag'
    | 'icons'
    | 'showTrend'
  >
>

/** The toggles of `o` (a new object; see reuseView for a stable one). */
export function lightsFilter(o: LightsOptions): LightsFilter {
  return {
    onlyWhenLit: o.onlyWhenLit,
    showCaptions: o.showCaptions,
    showTemps: o.showTemps,
    showRepairTime: o.showRepairTime,
    repairCrewTag: o.repairCrewTag,
    // The options are stable objects (useOptions): the list keeps its identity while equal.
    icons: o.icons,
    showTrend: o.showTrend
  }
}

/**
 * Some light can show a text: a caption, a temperature (and its rise) or a repair time, with a
 * light shown that has one. Without any, the side of the texts in a column changes nothing.
 */
export function hasLightTexts(o: LightsFilter): boolean {
  const shown = new Set(visibleIds(o.icons))
  return (
    (o.showCaptions && shown.size > 0) ||
    (o.showTemps && (shown.has('water') || shown.has('oilTemp'))) ||
    (o.showRepairTime && (shown.has('repair') || shown.has('repairOptional')))
  )
}

export interface LightView {
  readonly kind: LightKind
  readonly icon: EngineIconName
  readonly level: LightLevel
  /** What follows the icon: 'REPARAR · 42 s (equipo)', '104° +6°'; '' for the icon alone. */
  readonly text: string
  /** The same in narrow windows ('REPARAR · 42 s eq.'); '' when it is the text itself. */
  readonly short: string
  /** Accessible name: 'Temperatura del agua: encendido'. */
  readonly label: string
}

const LEVELS: ReadonlySet<unknown> = new Set<LightLevel>([
  'off',
  'alarm',
  'warn',
  'caution',
  'info'
])
const KINDS: ReadonlySet<unknown> = new Set<LightKind>(LIGHT_ORDER)
const finiteOrNull = (v: unknown): v is number | null =>
  v === null || (typeof v === 'number' && Number.isFinite(v))

/** A light as sent, or null when it is not one this view knows (the payload crosses IPC). */
function validReading(raw: unknown): LightReading | null {
  if (typeof raw !== 'object' || raw === null) return null
  const v = raw as Record<string, unknown>
  if (!KINDS.has(v.kind) || !LEVELS.has(v.level)) return null
  if (!finiteOrNull(v.tempC) || !finiteOrNull(v.riseC) || !finiteOrNull(v.seconds)) return null
  // An older payload without it: the crew's time.
  if (v.realTime !== undefined && typeof v.realTime !== 'boolean') return null
  return raw as LightReading
}

/** '98°' / '208°': a temperature in whole degrees of the chosen units. */
export function formatDegrees(c: number, units: AppearanceSettings['units']): string {
  return `${Math.round(tempIn(c, units))}°`
}

/** '+6°' ('+11°' in °F): a rise above your own average. */
export function formatRise(c: number, units: AppearanceSettings['units']): string {
  return `+${Math.max(0, Math.round(tempDeltaIn(c, units)))}°`
}

/** Between the caption and each reading: 'REPARAR · 42 s'. */
const DOT = ' · '

/**
 * A repair time as written, wide and narrow: the real seconds estimated in the stall always
 * with their '≈' ('≈ 30 s (real)'), the crew's with their tag when lights.repairCrewTag is on
 * ('42 s (equipo)'), bare without it ('42 s').
 */
function repairTimeTexts(
  s: number,
  realTime: boolean,
  tagged: boolean,
  t: Messages['widgets']['lights']
): readonly [wide: string, narrow: string] {
  if (realTime) return [tagged ? t.realSeconds(s) : t.realSecondsShort(s), t.realSecondsShort(s)]
  return tagged ? [t.crewSeconds(s), t.crewSecondsShort(s)] : [t.seconds(s), t.seconds(s)]
}

/**
 * A repair light of the sample as the strip writes it, caption and time ('REPARAR · 42 s
 * (equipo)'), for the legend: with the crew's tag or without it, and the real seconds with
 * lights.repairRealTime, as the sample shows them.
 */
export function repairSampleText(
  kind: 'repair' | 'repairOptional',
  o: Pick<LightsOptions, 'repairCrewTag' | 'repairRealTime'>,
  m: Messages
): string {
  const t = m.widgets.lights
  const sample = o.repairRealTime ? PREVIEW_LIGHTS_REAL : PREVIEW_LIGHTS
  const r = sample.lights.find((l) => l.kind === kind)
  const s = Math.ceil(r?.seconds ?? 0)
  const [time] = repairTimeTexts(s, r?.realTime === true, o.repairCrewTag, t)
  return `${t.captions[kind]}${DOT}${time}`
}

/** One light's view; null when the options leave it out. */
function lightView(
  r: LightReading,
  o: LightsFilter,
  units: AppearanceSettings['units'],
  m: Messages
): LightView | null {
  const t = m.widgets.lights
  const trend = o.showTrend && r.riseC !== null
  // Without the trend, a yellow light is off (the sample shows the option at once).
  const level: LightLevel = r.level === 'caution' && !trend ? 'off' : r.level
  if (level === 'off' && o.onlyWhenLit) return null
  const readings: string[] = []
  // The rise is a value too: it follows the values toggle (the yellow light stays without it).
  if (o.showTemps && r.tempC !== null) readings.push(formatDegrees(r.tempC, units))
  if (o.showTemps && trend && r.riseC !== null) readings.push(formatRise(r.riseC, units))
  const [seconds, secondsShort] =
    o.showRepairTime && level !== 'off' && r.seconds !== null && r.seconds > 0
      ? repairTimeTexts(Math.ceil(r.seconds), r.realTime === true, o.repairCrewTag, t)
      : ['', '']
  const join = (time: string): string =>
    [
      o.showCaptions ? t.captions[r.kind] : '',
      readings.join(' '),
      time,
      o.showCaptions && trend && r.draft ? t.draft : ''
    ]
      .filter((p) => p !== '')
      .join(DOT)
  const text = join(seconds)
  const short = join(secondsShort)
  const state = level === 'off' ? t.states.off : level === 'caution' ? t.states.trend : t.states.on
  return {
    kind: r.kind,
    icon: LIGHT_ICONS[r.kind],
    level,
    text,
    short: short === text ? '' : short,
    label: `${t.names[r.kind]}: ${state}`
  }
}

/** The lights to draw, in the user's order (lights.icons), each once, with the options applied. */
export function lightsView(
  d: Pick<LightsData, 'lights'>,
  o: LightsFilter,
  units: AppearanceSettings['units'],
  m: Messages
): LightView[] {
  const sent = Array.isArray(d.lights) ? d.lights : []
  const byKind = new Map<LightKind, LightReading>()
  for (const raw of sent) {
    const r = validReading(raw)
    if (r && !byKind.has(r.kind)) byKind.set(r.kind, r)
  }
  const out: LightView[] = []
  for (const kind of visibleIds(o.icons)) {
    const r = byKind.get(kind)
    if (r === undefined) continue
    const v = lightView(r, o, units, m)
    if (v !== null) out.push(v)
  }
  return out
}

/** Whether a payload has anything to draw with these options. */
export function hasLights(d: LightsData, o: LightsFilter, m: Messages): boolean {
  return d.visible && lightsView(d, o, 'metric', m).length > 0
}

/**
 * The options to draw the edit-mode sample with: the user's, unless they leave nothing to draw
 * (every light off, or only the lit ones with none lit): then every light, so the window can
 * still be placed and sized.
 */
export function previewFilter(sample: LightsData, o: LightsFilter, m: Messages): LightsFilter {
  if (lightsView(sample, o, 'metric', m).length > 0) return o
  // Every light, in the user's order.
  return { ...o, onlyWhenLit: false, icons: o.icons.map((e) => ({ id: e.id, visible: true })) }
}

/** Everything the strip's height depends on besides the width and the font. */
export function layoutKey(views: readonly LightView[], layout: LightsOptions['layout']): string {
  return `${layout}|${views.map((v) => `${v.kind}:${v.text.length}:${v.short.length}`).join(',')}`
}
