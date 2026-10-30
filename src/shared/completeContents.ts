/**
 * «Completo» (Apariencia's fourth style): every widget of the layout in use with everything that
 * adds information turned on. Pure: from the settings as they are, the patch that does it (only
 * the fields it changes), so a second application changes nothing and the style can tell whether
 * it is still what you have.
 *
 * What it turns on, the same rule in the ten widgets:
 * - every column and element of every list (rows, parts, lines, lights, groups...), in your order;
 * - the info bars that were off, at «Normal», each with the items its widget shows by default
 *   (the tables' footers with every track condition, the air and the rubber too), plus the ones
 *   you had on: never the same datum in every bar;
 * - the switches that add something to read (column titles, captions, the trend arrows, every
 *   alert...); the «Piloto» block's own «No» back to «Global» (the style shows logos and flags);
 * - the standings' gap to the leader as its own column («Ambos») and the iRating at stake of all;
 * - the height following the content in the widgets that can, so what was added never falls off.
 *
 * What it never touches: how a widget behaves (the cars it shows, its references, its timers,
 * when it hides), how it is drawn (orientation, density, the wheel...), its place and size, and
 * whether it is shown at all.
 */
import { CONDITIONS_FOOTER_BEFORE, LAYOUT_SECTIONS, OPTION_SCHEMA } from './settingsSchema'
import type { LayoutSection, OptionSpec } from './settingsSchema'
import type { ElementEntry, OverlaySettings, SettingsPatch } from './types'
import { WIDGET_DEFS } from './widgets'

/** The switches that add something to read, and the value that does it. */
export const COMPLETE_SWITCHES: {
  readonly [S in LayoutSection]: Readonly<Record<string, boolean>>
} = {
  relative: { columnHeads: true },
  radar: {},
  standings: { columnHeads: true, otherClassLeaders: true, iRatingDeltaAll: true },
  battle: {},
  inputs: { clutchInTrace: true, steeringDegrees: true, shiftLights: true },
  traffic: { captions: true },
  alerts: {
    showFlags: true,
    showBlue: true,
    showFurled: true,
    showPitLimiter: true,
    showPitOverspeed: true,
    showPitEntry: true,
    showLapsToGo: true,
    showTow: true,
    showWrongWay: true,
    showIncidents: true,
    showStalled: true,
    showOilPressure: true,
    showDamage: true,
    showBoxThisLap: true,
    showFuelLow: true
  },
  delta: {},
  fuel: { showBox: true },
  // Every light, not only the lit ones; the captions, temperatures, repair time and trend.
  lights: {
    onlyWhenLit: false,
    showCaptions: true,
    showTemps: true,
    showRepairTime: true,
    repairCrewTag: true,
    showTrend: true
  }
}

/** The track temperature's arrow and the wind's dial: on wherever a widget has them. */
const CONDITIONS_SWITCHES = ['conditionsTrend', 'conditionsWindDirection'] as const

/** The «Piloto» block's own switches: their «No» goes back to «Global». */
const DRIVER_FLAGS = ['countryFlags', 'showFlags'] as const

/**
 * The fields «Completo» leaves as they are, on purpose: behaviour (what a widget looks for, its
 * references and timers, when it shows), drawing (orientation, density, sizes, colours) and the
 * numbers you chose. Every other field of a widget section is either set by the rules above or
 * listed here (completeContents.test.ts), so a new option is classified when it is added.
 */
export const COMPLETE_LEAVES: readonly string[] = [
  // Numbers: cars, seconds, ranges, laps.
  'carsAhead',
  'carsBehind',
  'rangeM',
  'topRows',
  'aroundRows',
  'thresholdS',
  'holdS',
  'traceSeconds',
  'traceWidth',
  'behindS',
  'aheadS',
  'hazardS',
  'maxEntries',
  'rangeS',
  'avgLaps',
  'marginLaps',
  // Behaviour.
  'mode',
  'onlyMulticlass',
  'referencePractice',
  'referenceQualify',
  'referenceRace',
  'fallback',
  'repairRealTime',
  // Drawing.
  'nameFormat',
  'density',
  'layout',
  'labelSide',
  'colors',
  'steeringStyle',
  'wheelSize',
  'wheelColor'
]

type Fields = Readonly<Record<string, unknown>>

/** The info bars of a section: each list field `x` with a size field `xSize`. */
function isBar(specs: Readonly<Record<string, OptionSpec>>, field: string): boolean {
  return specs[`${field}Size`] !== undefined
}

/** A bar's items: its default ones, the conditions in full where it has them, yours too. */
function barItems(spec: OptionSpec, list: readonly ElementEntry[]): ElementEntry[] {
  if (spec.kind !== 'elements') return [...list]
  const want = new Set<string>(spec.default.filter((e) => e.visible).map((e) => e.id))
  if (want.has('trackTemp')) for (const id of CONDITIONS_FOOTER_BEFORE) want.add(id)
  return list.map((e) => ({ id: e.id, visible: e.visible || want.has(e.id) }))
}

function sameList(a: readonly ElementEntry[], b: readonly ElementEntry[]): boolean {
  return (
    a.length === b.length && a.every((e, i) => e.id === b[i]?.id && e.visible === b[i]?.visible)
  )
}

/** The fields of `section` «Completo» changes, with their new values ({} when none). */
export function completeSection(section: LayoutSection, options: Fields): Record<string, unknown> {
  const specs = OPTION_SCHEMA[section] as Readonly<Record<string, OptionSpec>>
  const out: Record<string, unknown> = {}
  const set = (field: string, value: unknown): void => {
    if (options[field] !== value) out[field] = value
  }
  for (const [field, spec] of Object.entries(specs)) {
    const value = options[field]
    if (spec.kind === 'elements') {
      if (!Array.isArray(value)) continue
      const list = value as readonly ElementEntry[]
      const next = isBar(specs, field)
        ? barItems(spec, list)
        : list.map((e) => ({ id: e.id, visible: true }))
      if (!sameList(list, next)) out[field] = next
    } else if (field.endsWith('BarSize')) {
      if (value === 'off') out[field] = 'normal'
    } else if ((CONDITIONS_SWITCHES as readonly string[]).includes(field)) {
      set(field, true)
    } else if ((DRIVER_FLAGS as readonly string[]).includes(field)) {
      if (value === false) out[field] = 'inherit'
    } else if (field === 'brandMarks') {
      if (value === 'off') out[field] = 'inherit'
    } else if (section === 'standings' && field === 'gapMode') {
      set(field, 'both')
    } else if (field in COMPLETE_SWITCHES[section]) {
      set(field, COMPLETE_SWITCHES[section][field])
    }
  }
  return out
}

/**
 * The patch that makes every widget «Completo»: its sections' fields that change, and the auto
 * height on where a widget can follow its content. Empty ({}) when it already is.
 */
export function completePatch(s: Readonly<OverlaySettings>): SettingsPatch {
  const patch: Record<string, unknown> = {}
  const widgets: Record<string, { autoHeight: boolean }> = {}
  for (const section of LAYOUT_SECTIONS) {
    const fields = completeSection(section, s[section] as unknown as Fields)
    if (Object.keys(fields).length > 0) patch[section] = fields
    if (WIDGET_DEFS[section].sizeModel === 'auto-height' && !s.widgets[section].autoHeight) {
      widgets[section] = { autoHeight: true }
    }
  }
  if (Object.keys(widgets).length > 0) patch.widgets = widgets
  return patch as SettingsPatch
}

/** Whether every widget already shows all «Completo» turns on. */
export function isComplete(s: Readonly<OverlaySettings>): boolean {
  return Object.keys(completePatch(s)).length === 0
}
