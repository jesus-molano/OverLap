/**
 * Migration of pre-v4 fields. v1/v2 files only lack newer widgets, fields and
 * sections (they get their defaults); v3 standings had one show* flag per
 * column and one toggle for the whole ratings header, which map onto the v4
 * column list and the two header toggles. v4 files written before v2.1 (v2.2)
 * only lack the traffic and alerts (delta) widgets and sections, and older v4
 * files the shortcuts or visibility section: no version bump, they get their
 * defaults like any missing section. A file from before the fuel widget gets it
 * hidden, in a free spot (`placeNewWidget`); one from before the warning lights
 * gets them in a free spot, shown if the alerts band showed what they took over
 * (`shownWhenAdded`), and the band's old engine options moved to where those
 * lights went (`migrateSection`). The conditions widget became the
 * footer of the relative and the standings: what a file saved for it
 * (REMOVED_WIDGETS) is dropped like any unknown key, the rest of the file
 * untouched, and the footers start with their own defaults. A visibility section
 * from before "when to show the overlay" gets replays hidden (`migrateVisibility`).
 * Files from before the customisable widgets (v2.6) had one boolean or choice per element
 * where the lists are now (the headers and the conditions footers became info bars): each list
 * and scalar is read from them (`LIST_MIGRATIONS`, `VALUE_MIGRATIONS`), so an upgrade draws the
 * same; the old fields are dropped on the next save (one-way). The traffic's `header` list (its
 * title band and group captions, up to 2.1.1) is read the same way into its header bar's size
 * and the `captions` switch. Version 5 marks the files
 * written since: older ones get the new defaults that replaced a saved old one (the 'outline'
 * licence, the pedals' auto height) once.
 */
import { OPTION_SCHEMA, type ElementsSpec, type OptionSection } from '../settingsSchema'
import type {
  ElementEntry,
  OverlaySettings,
  Point,
  Rect,
  Size,
  StandingsColumn,
  StandingsColumnId
} from '../types'
import { ALERTS_DEFAULT_ROOM, WIDGET_DEFS, WIDGET_IDS, type WidgetId } from '../widgets'
import { isRecord, normalizeElements } from './fields'

/**
 * Widgets added after settings files already existed that such a file gets hidden: the user
 * has moved the others, and the newcomer's default place may sit on one of them (the old
 * conditions widget's default covered a standings moved to the top left, report Q5; the fuel
 * default a relative moved to the bottom right). The user turns it on from the tray or the
 * settings, or with its ghost's eye in edit mode.
 */
export const HIDDEN_WHEN_ADDED: readonly WidgetId[] = Object.freeze(['fuel'])

/**
 * Widgets that existed and are gone: their `widgets` entry and option section in an old file
 * are dropped on load (normalizeSettings only reads WIDGET_IDS and OPTION_SECTIONS) and are not
 * written back. 'conditions' (v2.3) is now the footer of the relative and the standings
 * (ConditionsFooterOptions), with its own defaults: the old options chose readings for a panel
 * that no longer exists.
 */
export const REMOVED_WIDGETS: readonly string[] = Object.freeze(['conditions'])

/**
 * Widgets added after settings files existed that such a file gets shown, in the free spot
 * nearest their default (hidden like the others when there is none): the warning lights took the
 * temperature lights and the trend from the alerts band, so hiding them would drop what the band
 * showed until then. Not when the band showed none of it (`shownWhenAdded`).
 */
export const SHOWN_WHEN_ADDED: readonly WidgetId[] = Object.freeze(['lights'])

/** Where `freeSpot` looks: the default layout's display (1920 x 1080 without the taskbar). */
export const DEFAULT_AREA: Rect = Object.freeze({ x: 0, y: 0, width: 1920, height: 1040 })
/** Room kept around the other widgets, and the grid the search walks (px). */
const SPOT_GAP = 10

/**
 * The top-left nearest to `near` (on a SPOT_GAP grid, inside `area`) where `size`, with SPOT_GAP
 * all around, overlaps none of `taken`; null when there is none.
 */
export function freeSpot(
  size: Size,
  near: Point,
  taken: readonly Rect[],
  area: Rect
): Point | null {
  let best: Point | null = null
  let bestD = Infinity
  const g = SPOT_GAP
  for (let y = area.y + g; y + size.height + g <= area.y + area.height; y += g) {
    for (let x = area.x + g; x + size.width + g <= area.x + area.width; x += g) {
      const clear = taken.every(
        (r) =>
          x + size.width + g <= r.x ||
          r.x + r.width + g <= x ||
          y + size.height + g <= r.y ||
          r.y + r.height + g <= y
      )
      if (!clear) continue
      const d = (x - near.x) ** 2 + (y - near.y) ** 2
      if (d < bestD) {
        bestD = d
        best = { x, y }
      }
    }
  }
  return best
}

/** What a widget takes on screen at most: the alerts with their room to grow. */
function footprint(id: WidgetId, r: Rect): Rect {
  return id === 'alerts' ? { ...r, height: Math.max(r.height, ALERTS_DEFAULT_ROOM) } : r
}

/**
 * A widget the existing file `out` was read from had no entry for, moved to the free spot
 * nearest its default when there is one (so its edit-mode ghost and the first time it is shown
 * cover nothing). Its size stays the default. A HIDDEN_WHEN_ADDED one is hidden; with `shown`
 * (SHOWN_WHEN_ADDED) it keeps its default visibility, unless there is no free spot.
 */
export function placeNewWidget(out: OverlaySettings, id: WidgetId, shown = false): void {
  const w = out.widgets[id]
  const taken = WIDGET_IDS.filter((o) => o !== id).map((o) => footprint(o, out.widgets[o].bounds))
  const def = WIDGET_DEFS[id].defaultBounds
  const spot = freeSpot(w.bounds, def, taken, DEFAULT_AREA)
  if (spot !== null) w.bounds = { ...w.bounds, x: spot.x, y: spot.y }
  if (!shown || spot === null) w.visible = false
}

/** v3 flag -> v4 column (someone who hid the last lap does not want the best one either). */
const V3_COLUMN_FLAGS: readonly (readonly [flag: string, id: StandingsColumnId])[] = [
  ['showPositionsGained', 'gained'],
  ['showIRating', 'ir'],
  ['showLastLap', 'last'],
  ['showLastLap', 'best'],
  ['showPits', 'pit']
]

/**
 * The standings section with v3 fields translated, when it has no v4 column
 * list. v3's `showIRatingDelta` (on by default: a Δ in every row) is not
 * carried over: v4 shows your own Δ in the header and keeps the per-row
 * column off by default, which is the point of the redesign.
 */
export function migrateStandings(raw: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(raw.columns)) return raw
  const hasV3 =
    V3_COLUMN_FLAGS.some(([flag]) => typeof raw[flag] === 'boolean') ||
    typeof raw.showRatingsHeader === 'boolean'
  if (!hasV3) return raw

  const columns: StandingsColumn[] = OPTION_SCHEMA.standings.columns.default.map((c) => ({ ...c }))
  for (const [flag, id] of V3_COLUMN_FLAGS) {
    const v = raw[flag]
    const col = columns.find((c) => c.id === id)
    if (col && typeof v === 'boolean') col.visible = v
  }
  const out: Record<string, unknown> = { ...raw, columns }
  const header = raw.showRatingsHeader
  if (typeof header === 'boolean') {
    if (typeof raw.headerIRating !== 'boolean') out.headerIRating = header
    if (typeof raw.headerSafetyRating !== 'boolean') out.headerSafetyRating = header
  }
  return out
}

/**
 * The alerts band before the warning lights: `showEngineWarnings` (all four lights) becomes
 * `showOilPressure`, the one light the band keeps; `showEngineTrend` went to the lights
 * (migrateLights).
 */
export function migrateAlerts(raw: Record<string, unknown>): Record<string, unknown> {
  const old = raw.showEngineWarnings
  if (typeof old !== 'boolean' || typeof raw.showOilPressure === 'boolean') return raw
  return { ...raw, showOilPressure: old }
}

/**
 * The alerts band's engine options before the warning lights, and the lights each one covered:
 * the four engine lights, the stall, the damage (mandatory and optional repairs), the trend.
 */
type Lights = readonly string[]
const BAND_TO_LIGHTS: readonly (readonly [band: string, lights: Lights])[] = [
  ['showEngineWarnings', ['showOilPressure', 'showFuelPressure', 'showWater', 'showOilTemp']],
  ['showStalled', ['showStalled']],
  ['showDamage', ['showRepair', 'showRepairOptional']],
  ['showEngineTrend', ['showTrend']]
]

/**
 * The band's options whose lights left it, wholly or in part, for the warning lights: the
 * temperature and fuel pressure lights, the optional repairs, the trend. (The stall stayed.)
 */
const BAND_MOVED: readonly string[] = ['showEngineWarnings', 'showDamage', 'showEngineTrend']

/**
 * The warning lights of a file from before them (no lights section): what the alerts band was
 * told not to say stays off in the lights, where it went (BAND_TO_LIGHTS); the rest takes the
 * defaults.
 */
export function migrateLights(raw: unknown, file: Record<string, unknown>): unknown {
  if (raw !== undefined) return raw
  const alerts = file.alerts
  if (!isRecord(alerts)) return raw
  // The lights' own fields of the time (LIGHTS_FLAGS turns them into the list).
  const off: Record<string, boolean> = {}
  for (const [band, lights] of BAND_TO_LIGHTS) {
    if (alerts[band] === false) for (const l of lights) off[l] = false
  }
  return Object.keys(off).length > 0 ? off : raw
}

/**
 * Warning lights saved before the crew-time tag: the tag stays off, so an upgrade reads what it
 * read ('REPARAR · 42 s'); a new install, or a file from before the lights, gets the default.
 */
export function migrateLightsCrewTag(raw: Record<string, unknown>): Record<string, unknown> {
  return 'repairCrewTag' in raw ? raw : { ...raw, repairCrewTag: false }
}

/**
 * Whether a file without the SHOWN_WHEN_ADDED widget `id` gets it shown. The warning lights only
 * when its alerts band showed something they took over: the band shown, with one of the options
 * that moved (BAND_MOVED, each on by default) on. A band hidden, or with all of them off, showed
 * none of it: a new strip on screen would be news to its driver, so it waits hidden.
 */
export function shownWhenAdded(id: WidgetId, file: Record<string, unknown>): boolean {
  if (id !== 'lights') return true
  const widgets = isRecord(file.widgets) ? file.widgets : {}
  const band = widgets.alerts
  if (isRecord(band) && band.visible === false) return false
  const alerts = isRecord(file.alerts) ? file.alerts : {}
  return BAND_MOVED.some((o) => alerts[o] !== false)
}

/**
 * A visibility section saved before `showWhen` existed: its `replays` is the old default
 * ('follow', "keep the standings"), saved whether or not anyone chose it, so it takes the new
 * one (replays hidden, as the overlay now only shows while you drive). Later files keep theirs.
 */
export function migrateVisibility(raw: Record<string, unknown>): Record<string, unknown> {
  if ('showWhen' in raw) return raw
  return { ...raw, replays: OPTION_SCHEMA.visibility.replays.default }
}

/**
 * The pedals before the wheel styles and the shift lights: the one wheel of before ('wheel') is
 * the realistic one now, and a section saved without the shift lights (every file of before, as
 * a saved section always has every field) gets them off, so an upgrade draws what it drew. The
 * new car block comes hidden too: a saved list missing it gets it hidden (normalizeElements), the
 * old layout choice hides it (readInputsSections), and a section with neither (older files) gets
 * the default blocks with it hidden.
 */
export function migrateInputs(raw: Record<string, unknown>): Record<string, unknown> {
  const wheel = raw.steeringStyle === 'wheel'
  const noLights = !('shiftLights' in raw)
  const noBlocks = !Array.isArray(raw.sections) && readInputsSections(raw) === null
  if (!wheel && !noLights && !noBlocks) return raw
  const blocks = OPTION_SCHEMA.inputs.sections.default.map((e) =>
    e.id === 'car' ? { ...e, visible: false } : { ...e }
  )
  return {
    ...raw,
    ...(wheel ? { steeringStyle: 'realistic' } : {}),
    ...(noLights ? { shiftLights: false } : {}),
    ...(noBlocks ? { sections: blocks } : {})
  }
}

// ---------------------------------------------------------------------------
// Element lists from the booleans and choices they replaced (customisation, v2.6)
// ---------------------------------------------------------------------------

/** What a file's old fields said about a list: each id's visibility, and an order if they gave one. */
export interface LegacyList {
  readonly visible: Readonly<Record<string, boolean>>
  /** Ids in the order the old fields put them (the rest follow in default order). */
  readonly order?: readonly string[]
}

/**
 * How a list is read from the fields it replaced: null when the file has none of them (the list
 * then takes its default, like any missing option).
 */
export type LegacyReader = (raw: Readonly<Record<string, unknown>>) => LegacyList | null

/** A boolean field per set of ids: the field gives their visibility. */
export type FlagMap = readonly (readonly [field: string, ids: readonly string[]])[]

/** The reader of a list that replaced one boolean per element (or per group of elements). */
export function fromFlags(flags: FlagMap): LegacyReader {
  return (raw) => {
    const visible: Record<string, boolean> = {}
    let any = false
    for (const [field, ids] of flags) {
      const v = raw[field]
      if (typeof v !== 'boolean') continue
      any = true
      for (const id of ids) visible[id] = v
    }
    return any ? { visible } : null
  }
}

/**
 * The list `spec` describes, from what the old fields said: the default with their visibility and
 * order applied (ids they did not cover keep the default), normalised.
 */
export function listFromLegacy<Id extends string>(
  spec: ElementsSpec<Id>,
  legacy: LegacyList
): ElementEntry<Id>[] {
  const byId = new Map<string, ElementEntry<Id>>(spec.default.map((e) => [e.id, { ...e }]))
  for (const [id, v] of Object.entries(legacy.visible)) {
    const e = byId.get(id)
    if (e !== undefined) e.visible = v
  }
  const ordered: ElementEntry<Id>[] = []
  for (const id of legacy.order ?? []) {
    const e = byId.get(id)
    if (e !== undefined && !ordered.includes(e)) ordered.push(e)
  }
  for (const e of byId.values()) if (!ordered.includes(e)) ordered.push(e)
  return normalizeElements(ordered, spec.default, spec)
}

/** The readings of a table's old conditions footer, now items of its footer bar. */
const FOOTER_READINGS: FlagMap = [
  ['conditionsTrackTemp', ['trackTemp']],
  ['conditionsWet', ['wet']],
  ['conditionsWind', ['wind']],
  ['conditionsAirTemp', ['airTemp']],
  ['conditionsRubber', ['rubber']]
]

/**
 * The pedals' old layout choice: the order of the blocks, the trace left out for 'bars'. The car
 * block did not exist then: hidden.
 */
export const readInputsSections: LegacyReader = (raw) => {
  switch (raw.layout) {
    case 'trace-bars-info':
      return { visible: { trace: true, car: false }, order: ['trace', 'bars', 'info'] }
    case 'info-bars-trace':
      return { visible: { trace: true, car: false }, order: ['info', 'bars', 'trace'] }
    case 'bars':
      return { visible: { trace: false, car: false }, order: ['trace', 'bars', 'info'] }
    default:
      return null
  }
}

/** The battle's old detail choice: the sector chips, the lap chips, both or neither. */
export const readBattleRows: LegacyReader = (raw) => {
  const visible: Record<string, boolean> = {}
  const detail = raw.detail
  if (detail === 'none' || detail === 'sectors' || detail === 'laps' || detail === 'both') {
    visible.sectors = detail === 'sectors' || detail === 'both'
    visible.laps = detail === 'laps' || detail === 'both'
  }
  if (typeof raw.showPrediction === 'boolean') visible.prediction = raw.showPrediction
  return Object.keys(visible).length > 0 ? { visible } : null
}

/** One list of a section and the old fields it is read from. */
export interface ListMigration {
  readonly field: string
  readonly read: LegacyReader
}

/**
 * Every list that replaced older fields, by section. A file whose section already has the list
 * (an array) keeps it; the old fields are then unknown keys and ignored, like any other.
 */
export const LIST_MIGRATIONS: { readonly [S in OptionSection]?: readonly ListMigration[] } = {
  relative: [
    {
      field: 'columns',
      read: fromFlags([
        ['showClassPosition', ['pos']],
        ['showLicense', ['lic']],
        ['showIRating', ['ir']],
        ['showTyre', ['tyre']],
        ['showStint', ['stint']]
      ])
    },
    { field: 'headerBar', read: fromFlags([['showIncidents', ['incidents']]]) },
    { field: 'footerBar', read: fromFlags(FOOTER_READINGS) }
  ],
  radar: [{ field: 'parts', read: fromFlags([['showRangeLabels', ['rangeLabels']]]) }],
  standings: [
    {
      // The single-class header showed the class's SoF and cars with the class lines' options.
      field: 'headerBar',
      read: fromFlags([
        ['headerIncidents', ['incidents']],
        ['showSof', ['sof']],
        ['showCarCount', ['carCount']]
      ])
    },
    {
      field: 'subheaderBar',
      read: fromFlags([
        ['headerIRating', ['iRating']],
        ['headerSafetyRating', ['safetyRating']]
      ])
    },
    { field: 'footerBar', read: fromFlags(FOOTER_READINGS) },
    {
      field: 'classLine',
      read: fromFlags([
        ['showSof', ['sof']],
        ['showCarCount', ['carCount']]
      ])
    }
  ],
  battle: [
    {
      field: 'lanes',
      read: fromFlags([
        ['showAhead', ['ahead']],
        ['showBehind', ['behind']]
      ])
    },
    { field: 'rows', read: readBattleRows },
    { field: 'parts', read: fromFlags([['showIRatingAtStake', ['stake']]]) }
  ],
  inputs: [
    { field: 'sections', read: readInputsSections },
    { field: 'bars', read: fromFlags([['showClutch', ['clutch']]]) },
    {
      field: 'info',
      read: fromFlags([
        ['showGearSpeed', ['gear', 'speed']],
        ['showSteering', ['steering']]
      ])
    }
  ],
  traffic: [
    {
      field: 'groups',
      read: fromFlags([
        ['showHazards', ['hazard']],
        ['showSlower', ['slower']],
        ['showFaster', ['faster']]
      ])
    }
  ],
  delta: [
    { field: 'rows', read: fromFlags([['showSectors', ['sectors']]]) },
    {
      field: 'top',
      read: fromFlags([
        ['showTrend', ['state']],
        ['showPredicted', ['predicted']]
      ])
    }
  ],
  fuel: [
    {
      field: 'lines',
      read: fromFlags([
        ['showGauge', ['gauge']],
        ['showPerLap', ['perLap']],
        ['showFinish', ['finish']],
        ['showWindow', ['window']],
        ['showSave', ['save']],
        ['showTyres', ['tyres']],
        ['showLimits', ['limits']]
      ])
    }
  ],
  lights: [
    {
      field: 'icons',
      read: fromFlags([
        ['showOilPressure', ['oilPressure']],
        ['showFuelPressure', ['fuelPressure']],
        ['showStalled', ['stalled']],
        ['showRepair', ['repair']],
        ['showRepairOptional', ['repairOptional']],
        ['showWater', ['water']],
        ['showOilTemp', ['oilTemp']],
        ['showPitLimiter', ['pitLimiter']],
        ['showRevLimiter', ['revLimiter']]
      ])
    }
  ]
}

/**
 * How a scalar option is read from the fields it replaced: undefined when the file has none of
 * them (the option takes its default). The value is still validated like any other.
 */
export type ValueReader = (raw: Readonly<Record<string, unknown>>) => unknown

/** An info bar's size from the switch it replaced: shown at the normal size, or off. */
function sizeFromSwitch(field: string): ValueReader {
  return (raw) => {
    const v = raw[field]
    return typeof v === 'boolean' ? (v ? 'normal' : 'off') : undefined
  }
}

/**
 * The delta's one reference of before, for every kind of session. Every file had the old single
 * default ('pb') unless its driver chose another: those take the new per-session defaults
 * (record in practice, optimal in qualifying and races), the others keep their choice everywhere.
 */
function deltaReference(raw: Readonly<Record<string, unknown>>): unknown {
  // A file with any of the new fields was written since: the old one is a leftover.
  if ('referencePractice' in raw || 'referenceQualify' in raw || 'referenceRace' in raw) {
    return undefined
  }
  const ref = raw.reference
  return typeof ref === 'string' && ref !== 'pb' ? ref : undefined
}

/** The traffic's old `header` list (v2.6 to 2.1.1): its title band and its group captions. */
const TRAFFIC_HEADER_IDS = ['title', 'captions'] as const
const TRAFFIC_HEADER_DEFAULT = TRAFFIC_HEADER_IDS.map((id) => ({ id, visible: true }))

/**
 * Whether the traffic's old `header` list showed `id`, read as that version normalised it
 * (unknown entries dropped, a missing id hidden, a list without one valid entry the default);
 * undefined when the file has no such list.
 */
function trafficHeaderShows(
  raw: Readonly<Record<string, unknown>>,
  id: (typeof TRAFFIC_HEADER_IDS)[number]
): boolean | undefined {
  if (!Array.isArray(raw.header)) return undefined
  const list = normalizeElements(raw.header, TRAFFIC_HEADER_DEFAULT, {
    ids: TRAFFIC_HEADER_IDS,
    required: [],
    fixedOrder: true
  })
  return list.find((e) => e.id === id)?.visible === true
}

/**
 * The traffic's title band became its header bar (the widget's name and the SIM tag, as the
 * band drew them): shown at the normal size, or off, as the old list's `title` said.
 */
function trafficHeaderSize(raw: Readonly<Record<string, unknown>>): unknown {
  const v = trafficHeaderShows(raw, 'title')
  return v === undefined ? undefined : v ? 'normal' : 'off'
}

/** The old list's `captions`: now a switch of its own (the groups' captions). */
function trafficCaptions(raw: Readonly<Record<string, unknown>>): unknown {
  return trafficHeaderShows(raw, 'captions')
}

/** One scalar option of a section and how it is read from the fields it replaced. */
export interface ValueMigration {
  readonly field: string
  readonly read: ValueReader
}

/** Every scalar that replaced older fields, by section (only while the file lacks it). */
export const VALUE_MIGRATIONS: { readonly [S in OptionSection]?: readonly ValueMigration[] } = {
  relative: [{ field: 'footerBarSize', read: sizeFromSwitch('conditionsFooter') }],
  standings: [{ field: 'footerBarSize', read: sizeFromSwitch('conditionsFooter') }],
  fuel: [{ field: 'headerBarSize', read: sizeFromSwitch('showHeader') }],
  traffic: [
    { field: 'headerBarSize', read: trafficHeaderSize },
    { field: 'captions', read: trafficCaptions }
  ],
  delta: [
    { field: 'referencePractice', read: deltaReference },
    { field: 'referenceQualify', read: deltaReference },
    { field: 'referenceRace', read: deltaReference }
  ]
}

/**
 * The section with every list and scalar it lacks read from the fields they replaced
 * (LIST_MIGRATIONS, VALUE_MIGRATIONS): nothing visible changes on upgrade. Only when the new
 * field is not in the file yet and some old field is; `raw` itself when there is nothing to do.
 */
export function migrateLists(
  section: string,
  raw: Record<string, unknown>
): Record<string, unknown> {
  const lists = LIST_MIGRATIONS[section as OptionSection] ?? []
  const values = VALUE_MIGRATIONS[section as OptionSection] ?? []
  if (lists.length === 0 && values.length === 0) return raw
  const specs = OPTION_SCHEMA[section as OptionSection] as Readonly<Record<string, unknown>>
  let out: Record<string, unknown> | null = null
  for (const { field, read } of lists) {
    if (Array.isArray(raw[field])) continue
    const spec = specs[field] as ElementsSpec | undefined
    const legacy = read(raw)
    if (spec?.kind !== 'elements' || legacy === null) continue
    out ??= { ...raw }
    out[field] = listFromLegacy(spec, legacy)
  }
  for (const { field, read } of values) {
    if (field in raw) continue
    const v = read(raw)
    if (v === undefined) continue
    out ??= { ...raw }
    out[field] = v
  }
  return out ?? raw
}

// ---------------------------------------------------------------------------
// Version 5 (v2.6): changes of default applied once to older files
// ---------------------------------------------------------------------------

/**
 * A file written before version 5: its `version` is the only mark that tells "the old default,
 * saved" from "chosen since" (a missing or non-numeric version reads as old).
 */
export function isBeforeV5(file: Readonly<Record<string, unknown>>): boolean {
  return !(typeof file.version === 'number' && file.version >= 5)
}

/** Licences: the old default ('soft') becomes the new one ('outline'); a choice stays. */
export function migrateAppearanceV5(raw: Record<string, unknown>): Record<string, unknown> {
  return raw.licenseStyle === 'soft' ? { ...raw, licenseStyle: 'outline' } : raw
}

/**
 * The pedals became an auto-height widget: a file from before saved `autoHeight: false` for
 * them (no free-size widget could have it), so they fit their content from now on.
 */
export function migrateWidgetsV5(
  out: OverlaySettings,
  file: Readonly<Record<string, unknown>>
): void {
  if (!isBeforeV5(file)) return
  const widgets = isRecord(file.widgets) ? file.widgets : {}
  if (isRecord(widgets.inputs)) out.widgets.inputs.autoHeight = true
}

/**
 * Section-level migrations, keyed by section; untouched sections pass through. `file` is the
 * whole file, for an option that moved from one section to another and for its version. The
 * lists come last, from the fields the earlier steps leave (the v3 standings header, the lights
 * the band gave up).
 */
export function migrateSection(
  section: string,
  raw: unknown,
  file: Record<string, unknown> = {}
): unknown {
  const r = section === 'lights' ? migrateLights(raw, file) : raw
  if (!isRecord(r)) return r
  let out = r
  if (section === 'standings') out = migrateStandings(out)
  else if (section === 'alerts') out = migrateAlerts(out)
  else if (section === 'visibility') out = migrateVisibility(out)
  else if (section === 'inputs') out = migrateInputs(out)
  // Only a lights section the file saved (not the one migrateLights makes from the band).
  else if (section === 'lights' && isRecord(raw)) out = migrateLightsCrewTag(out)
  else if (section === 'appearance' && isBeforeV5(file)) out = migrateAppearanceV5(out)
  return migrateLists(section, out)
}
