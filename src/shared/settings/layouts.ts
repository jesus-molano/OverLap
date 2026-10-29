/**
 * Defensive load of the saved layouts (settings.savedLayouts) and the one rule that ties them to
 * the widgets: the active layout always equals the widgets' own bounds, scale, visibility and
 * lock, and the options in effect (the top-level sections) are the active layout's own ('full')
 * or the shared ones (a 'position' layout in use). The commands that change them are in
 * ../layouts.ts.
 */
import { copyData } from '../copy'
import type { Language } from '../i18n/language'
import {
  LAYOUT_SECTIONS,
  OPTION_SCHEMA,
  WIDGET_FIELD_SCHEMA,
  WIDGET_OPTION_FIELDS,
  isLayoutSection,
  type LayoutSection
} from '../settingsSchema'
import type {
  CarLayoutLink,
  CarRef,
  LayoutLibrary,
  LayoutMode,
  LayoutOptionSet,
  LayoutWidget,
  OverlaySettings,
  SavedLayout,
  WidgetOptionFields,
  WidgetSettings
} from '../types'
import { deepEqual } from '../equal'
import { WIDGET_DEFS, WIDGET_IDS, type WidgetId } from '../widgets'
import {
  clampNumber,
  isRecord,
  mergeSection,
  mergeWidgetFields,
  normalizeBounds,
  pickBoolean,
  pickEnum
} from './fields'
import { migrateSection } from './migrate'

/**
 * Most layouts kept. Each is every widget's place and options (about 10 kB): main keeps them all,
 * the renderers get them without the options (rendererSettings in ../layouts.ts).
 */
export const MAX_LAYOUTS = 30
/** Longest layout name (characters, after trimming). */
export const MAX_LAYOUT_NAME = 40
/** Car models remembered for linking (the latest first). */
export const MAX_SEEN_CARS = 40
/** Car links kept (one per car model). */
export const MAX_CAR_LINKS = 200
/** Longest car name kept (CarScreenName is far shorter). */
export const MAX_CAR_NAME = 100
/** The first layout's id (a fresh install, or a file from before layouts). */
export const FIRST_LAYOUT_ID = 'layout-1'

/** Name of the layout every existing user starts with, in the interface language. */
export const DEFAULT_LAYOUT_NAMES: Readonly<Record<Language, string>> = {
  es: 'Principal',
  en: 'Main'
}

const LAYOUT_ID = /^[A-Za-z0-9_-]{1,40}$/

export function isLayoutId(v: unknown): v is string {
  return typeof v === 'string' && LAYOUT_ID.test(v)
}

/** `text` with every control character (C0, DEL, C1) replaced by `by`. */
export function withoutControls(text: string, by: string): string {
  let out = ''
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0
    out += c < 0x20 || (c >= 0x7f && c <= 0x9f) ? by : ch
  }
  return out
}

/**
 * A name as typed: control characters dropped, white space collapsed and trimmed, at most
 * `max` characters. Null when nothing is left (or it is not a string).
 */
export function cleanText(raw: unknown, max: number): string | null {
  if (typeof raw !== 'string') return null
  const text = withoutControls(raw, ' ').replace(/\s+/g, ' ').trim()
  if (text === '') return null
  const chars = Array.from(text)
  return chars.length > max ? chars.slice(0, max).join('').trimEnd() : text
}

/** A layout name as typed, or null when it is empty. */
export function layoutName(raw: unknown): string | null {
  return cleanText(raw, MAX_LAYOUT_NAME)
}

/** A free id: 'layout-' and one more than the highest number in use. */
export function nextLayoutId(list: readonly SavedLayout[]): string {
  let max = 0
  for (const l of list) {
    const m = /^layout-(\d+)$/.exec(l.id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `layout-${max + 1}`
}

/**
 * `name`, or 'name (2)', 'name (3)'... when another layout (not `exceptId`) already has it
 * (case does not matter). The name is shortened so that the number fits in MAX_LAYOUT_NAME: a
 * longer one would be cut back on the next load, into the very name it had to differ from.
 */
export function uniqueLayoutName(
  name: string,
  list: readonly SavedLayout[],
  exceptId?: string
): string {
  const taken = new Set(list.filter((l) => l.id !== exceptId).map((l) => l.name.toLowerCase()))
  if (!taken.has(name.toLowerCase())) return name
  const chars = Array.from(name)
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`
    const base = chars
      .slice(0, MAX_LAYOUT_NAME - suffix.length)
      .join('')
      .trimEnd()
    const candidate = `${base}${suffix}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
}

/** What a layout keeps of a widget, copied. */
export function layoutWidgetOf(w: Readonly<LayoutWidget>): LayoutWidget {
  return { bounds: { ...w.bounds }, scale: w.scale, visible: w.visible, locked: w.locked }
}

/** Every widget's layout fields, copied (what a new layout saves). */
export function snapshotWidgets(
  widgets: Readonly<Record<WidgetId, WidgetSettings>>
): Record<WidgetId, LayoutWidget> {
  const out = {} as Record<WidgetId, LayoutWidget>
  for (const id of WIDGET_IDS) out[id] = layoutWidgetOf(widgets[id])
  return out
}

/** One widget of a layout read from disk or a file: an invalid field keeps the fallback's. */
export function normalizeLayoutWidget(
  id: WidgetId,
  raw: unknown,
  fallback: Readonly<LayoutWidget>
): LayoutWidget {
  if (!isRecord(raw)) return layoutWidgetOf(fallback)
  const s = WIDGET_FIELD_SCHEMA.scale
  return {
    bounds: normalizeBounds(raw.bounds, fallback.bounds, WIDGET_DEFS[id].minSize),
    scale: clampNumber(raw.scale, s.min, s.max, fallback.scale, 0),
    visible: pickBoolean(raw.visible, fallback.visible),
    locked: pickBoolean(raw.locked, fallback.locked)
  }
}

/**
 * Every widget of a layout; unknown ids are dropped, a widget missing (a file from before it
 * existed) or malformed gets the fallback's fields.
 */
export function normalizeLayoutWidgets(
  raw: unknown,
  fallback: Readonly<Record<WidgetId, LayoutWidget>>
): Record<WidgetId, LayoutWidget> {
  const r = isRecord(raw) ? raw : {}
  const out = {} as Record<WidgetId, LayoutWidget>
  for (const id of WIDGET_IDS) out[id] = normalizeLayoutWidget(id, r[id], fallback[id])
  return out
}

/**
 * A layout's SavedLayout.usedAt read from disk: whole epoch ms, or undefined (absent, not a
 * finite number, negative), which counts as never used.
 */
export function normalizeUsedAt(raw: unknown): number | undefined {
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : undefined
}

/** A car model's id as the session gives it (DriverInfo CarID): a positive integer. */
export function isCarId(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 0x7fffffff
}

/** A car as told by the telemetry process or the settings window; null when malformed. */
export function normalizeCarRef(raw: unknown): CarRef | null {
  if (!isRecord(raw) || !isCarId(raw.carId)) return null
  return { carId: raw.carId, carName: cleanText(raw.carName, MAX_CAR_NAME) ?? '' }
}

// ---------------------------------------------------------------------------
// Options: what a 'full' layout and the shared options keep of every widget
// ---------------------------------------------------------------------------

/** Every widget and option, in effect: what a library is normalised against. */
export type LiveSettings = Omit<OverlaySettings, 'savedLayouts'>

/** SavedLayout.mode; the first one is a new layout's. */
export const LAYOUT_MODES = ['full', 'position'] as const satisfies readonly LayoutMode[]

/** A widget's option fields (WIDGET_OPTION_FIELDS), copied. */
export function widgetOptionFieldsOf(w: Readonly<WidgetOptionFields>): WidgetOptionFields {
  const out: Record<string, unknown> = {}
  for (const f of WIDGET_OPTION_FIELDS) out[f] = copyData(w[f])
  return out as unknown as WidgetOptionFields
}

/** The options in effect (the top-level sections and the widgets' option fields), copied. */
export function optionSetOf(s: Readonly<LiveSettings>): LayoutOptionSet {
  const sections: Record<string, unknown> = {}
  for (const section of LAYOUT_SECTIONS) sections[section] = copyData(s[section])
  const widgets = {} as Record<WidgetId, WidgetOptionFields>
  for (const id of WIDGET_IDS) widgets[id] = widgetOptionFieldsOf(s.widgets[id])
  return { sections: sections as unknown as LayoutOptionSet['sections'], widgets }
}

/** Puts `set` in effect: copied into the top-level sections and the widgets. Mutates `s`. */
export function writeOptionSet(s: LiveSettings, set: Readonly<LayoutOptionSet>): void {
  for (const section of LAYOUT_SECTIONS) setSection(s, section, set.sections[section])
  for (const id of WIDGET_IDS) Object.assign(s.widgets[id], widgetOptionFieldsOf(set.widgets[id]))
}

/** Copies widget `id`'s options (its section, when it has one, and its fields) from `from`. */
export function copyWidgetOptions(
  to: LayoutOptionSet,
  from: Readonly<LayoutOptionSet>,
  id: WidgetId
): void {
  to.widgets[id] = widgetOptionFieldsOf(from.widgets[id])
  const section = widgetSection(id)
  if (section !== null) setSection(to.sections, section, from.sections[section])
}

/** The option section of widget `id` (named after it), null for a widget without one. */
export function widgetSection(id: WidgetId): LayoutSection | null {
  return isLayoutSection(id) ? id : null
}

function setSection<S extends LayoutSection>(
  target: Pick<OverlaySettings, LayoutSection>,
  section: S,
  value: Readonly<OverlaySettings[S]>
): void {
  target[section] = copyData(value) as OverlaySettings[S]
}

/**
 * Option sets known to be normalised, frozen so that they stay so: 30 layouts' options are not
 * copied and validated again on every settings change (settingsDraft keeps them, and
 * normalizeOptionSet takes them as they are). A command that changes one replaces it.
 */
const SEALED = new WeakSet<object>()

/** `set`, frozen and known to be normalised (it must be: the options in effect, or validated). */
export function sealOptionSet(set: LayoutOptionSet): LayoutOptionSet {
  if (!SEALED.has(set)) SEALED.add(deepFreeze(set))
  return set
}

/** Whether `v` is a sealed option set (sealOptionSet). */
export function isSealedOptionSet(v: unknown): v is LayoutOptionSet {
  return typeof v === 'object' && v !== null && SEALED.has(v)
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    for (const v of Object.values(value)) deepFreeze(v)
    Object.freeze(value)
  }
  return value
}

/**
 * A copy of `s` to change (SettingsStore.update): everything copied but the sealed option sets of
 * the layouts and the shared ones, which are kept (frozen: a command replaces them).
 */
export function settingsDraft(s: Readonly<OverlaySettings>): OverlaySettings {
  const { savedLayouts: lib, ...live } = s
  const keep = (o: LayoutOptionSet): LayoutOptionSet => (isSealedOptionSet(o) ? o : copyData(o))
  const list = lib.list.map((l): SavedLayout => {
    const { options, ...rest } = l
    return { ...copyData(rest), ...(options ? { options: keep(options) } : {}) }
  })
  const out: LayoutLibrary = {
    activeId: lib.activeId,
    list,
    links: copyData(lib.links),
    seenCars: copyData(lib.seenCars),
    ...(lib.shared ? { shared: keep(lib.shared) } : {})
  }
  return { ...copyData(live), savedLayouts: out }
}

/**
 * Options read from disk or a file, against `fallback` (the options in effect): every section is
 * migrated as a file's own would be (migrate.ts, with the file's `version`) and validated by the
 * schema; unknown sections, fields and widgets are dropped, and anything missing or invalid keeps
 * the fallback's. The result is sealed (sealOptionSet) and shares nothing with its inputs; a
 * sealed `raw` is the result itself.
 */
export function normalizeOptionSet(
  raw: unknown,
  fallback: Readonly<LayoutOptionSet>,
  version?: unknown
): LayoutOptionSet {
  if (isSealedOptionSet(raw)) return raw
  const out = copyData(fallback) as LayoutOptionSet
  if (!isRecord(raw)) return sealOptionSet(out)
  const sections = isRecord(raw.sections) ? raw.sections : {}
  // The layout's own sections stand for the file's (an option moved between two of them).
  const file = { ...sections, version }
  for (const section of LAYOUT_SECTIONS) {
    if (!isRecord(sections[section])) continue
    const r = migrateSection(section, sections[section], file)
    if (isRecord(r)) mergeSection(out.sections[section], r, OPTION_SCHEMA[section])
  }
  const widgets = isRecord(raw.widgets) ? raw.widgets : {}
  for (const id of WIDGET_IDS) {
    const w = widgets[id]
    if (!isRecord(w)) continue
    // The places' fields are not read: they are only there for the merge.
    const target: WidgetSettings = { ...out.widgets[id], ...PLACE_STUB }
    mergeWidgetFields(id, target, w)
    out.widgets[id] = widgetOptionFieldsOf(target)
  }
  return sealOptionSet(out)
}

const PLACE_STUB: LayoutWidget = {
  bounds: { x: 0, y: 0, width: 1, height: 1 },
  scale: WIDGET_FIELD_SCHEMA.scale.default,
  visible: false,
  locked: false
}

// ---------------------------------------------------------------------------
// The library
// ---------------------------------------------------------------------------

/** The library a fresh install starts with: one layout with the places and options as they are. */
export function defaultLayoutLibrary(
  live: Readonly<LiveSettings>,
  language: Language
): LayoutLibrary {
  return {
    activeId: FIRST_LAYOUT_ID,
    list: [
      {
        id: FIRST_LAYOUT_ID,
        name: DEFAULT_LAYOUT_NAMES[language],
        mode: 'full',
        widgets: snapshotWidgets(live.widgets),
        options: sealOptionSet(optionSetOf(live))
      }
    ],
    links: [],
    seenCars: [],
    shared: sealOptionSet(optionSetOf(live))
  }
}

/**
 * The saved layouts read from disk, against the widgets and options already normalised (`live`).
 * A file without any (from before layouts) gets one, named after the interface language
 * ('Principal'), equal to its widgets: nothing moves. A layout without a mode or options (from
 * before layouts carried them) is a 'full' one with a copy of the options in effect, as are the
 * shared options of a file without them: nothing changes either. Malformed layouts, duplicate
 * ids, links to a layout that is gone and repeated cars are dropped; a repeated name (a file
 * edited by hand) gets a number. An active id naming no kept layout gets one that does
 * (orphanActive). The active layout then takes the widgets' fields and the options in effect
 * (syncActiveLayout). `version`: the file's (migrate.ts).
 */
export function normalizeLayoutLibrary(
  raw: unknown,
  live: Readonly<LiveSettings>,
  language: Language,
  version?: unknown
): LayoutLibrary {
  const places = snapshotWidgets(live.widgets)
  const options = sealOptionSet(optionSetOf(live))
  const r = isRecord(raw) ? raw : {}
  const list: SavedLayout[] = []
  const ids = new Set<string>()
  for (const entry of Array.isArray(r.list) ? (r.list as unknown[]) : []) {
    if (list.length >= MAX_LAYOUTS) break
    if (!isRecord(entry) || !isLayoutId(entry.id) || ids.has(entry.id)) continue
    ids.add(entry.id)
    const name = layoutName(entry.name) ?? `${DEFAULT_LAYOUT_NAMES[language]} ${list.length + 1}`
    const mode = pickEnum(entry.mode, LAYOUT_MODES, 'full')
    const usedAt = normalizeUsedAt(entry.usedAt)
    list.push({
      id: entry.id,
      name: uniqueLayoutName(name, list),
      mode,
      widgets: normalizeLayoutWidgets(entry.widgets, places),
      ...(mode === 'full' ? { options: normalizeOptionSet(entry.options, options, version) } : {}),
      ...(usedAt === undefined ? {} : { usedAt })
    })
  }
  if (list.length === 0) return defaultLayoutLibrary(live, language)

  const links: CarLayoutLink[] = []
  const linked = new Set<number>()
  for (const entry of Array.isArray(r.links) ? (r.links as unknown[]) : []) {
    if (links.length >= MAX_CAR_LINKS) break
    const car = normalizeCarRef(entry)
    if (!car || !isRecord(entry) || linked.has(car.carId)) continue
    if (typeof entry.layoutId !== 'string' || !ids.has(entry.layoutId)) continue
    linked.add(car.carId)
    links.push({ ...car, layoutId: entry.layoutId })
  }
  const seenCars: CarRef[] = []
  const seen = new Set<number>()
  for (const entry of Array.isArray(r.seenCars) ? (r.seenCars as unknown[]) : []) {
    if (seenCars.length >= MAX_SEEN_CARS) break
    const car = normalizeCarRef(entry)
    if (!car || seen.has(car.carId)) continue
    seen.add(car.carId)
    seenCars.push(car)
  }
  const shared = normalizeOptionSet(r.shared, options, version)
  const activeId =
    typeof r.activeId === 'string' && ids.has(r.activeId)
      ? r.activeId
      : orphanActive(list, shared, places, options, language)
  const lib: LayoutLibrary = { activeId, list, links, seenCars, shared }
  copyIntoActive(lib, places, options)
  return lib
}

/**
 * The active layout of a file whose own one is gone (a damaged or hand-edited file), so that no
 * saved layout (nor the shared options) is overwritten by what is in effect: one already equal to
 * it, else what is in effect kept as a new layout; only a full list falls back to the first one.
 * Mutates `list`.
 */
function orphanActive(
  list: SavedLayout[],
  shared: Readonly<LayoutOptionSet>,
  places: Record<WidgetId, LayoutWidget>,
  options: LayoutOptionSet,
  language: Language
): string {
  const same = list.find(
    (l) =>
      sameLayoutWidgets(l.widgets, places) &&
      deepEqual(l.mode === 'full' ? l.options : shared, options)
  )
  if (same) return same.id
  if (list.length >= MAX_LAYOUTS) return list[0]?.id ?? FIRST_LAYOUT_ID
  const id = nextLayoutId(list)
  const name = uniqueLayoutName(DEFAULT_LAYOUT_NAMES[language], list)
  list.push({ id, name, mode: 'full', widgets: places, options })
  return id
}

/** Whether two layouts hold the same fields for every widget. */
function sameLayoutWidgets(
  a: Readonly<Record<WidgetId, LayoutWidget>>,
  b: Readonly<Record<WidgetId, LayoutWidget>>
): boolean {
  return WIDGET_IDS.every((id) => {
    const x = a[id]
    const y = b[id]
    return (
      x.bounds.x === y.bounds.x &&
      x.bounds.y === y.bounds.y &&
      x.bounds.width === y.bounds.width &&
      x.bounds.height === y.bounds.height &&
      x.scale === y.scale &&
      x.visible === y.visible &&
      x.locked === y.locked
    )
  })
}

function copyIntoActive(
  lib: LayoutLibrary,
  places: Record<WidgetId, LayoutWidget>,
  options: LayoutOptionSet
): void {
  const active = lib.list.find((l) => l.id === lib.activeId)
  if (!active) return
  active.widgets = places
  if (active.mode === 'full') active.options = options
  else lib.shared = options
}

/**
 * The rule: the active layout takes the widgets' bounds, scale, visibility and lock (moving a
 * widget changes the layout in use), and the options in effect go into it (a 'full' one) or into
 * the shared ones (a 'position' one): changing an option changes only where it is kept. Mutates
 * `s`.
 */
export function syncActiveLayout(s: OverlaySettings): void {
  copyIntoActive(s.savedLayouts, snapshotWidgets(s.widgets), sealOptionSet(optionSetOf(s)))
}
