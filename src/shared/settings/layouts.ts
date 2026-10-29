/**
 * Defensive load of the saved layouts (settings.savedLayouts) and the one rule that ties them to
 * the widgets: the active layout always equals the widgets' own bounds, scale, visibility and
 * lock. The commands that change them are in ../layouts.ts.
 */
import type { Language } from '../i18n/language'
import { WIDGET_FIELD_SCHEMA } from '../settingsSchema'
import type {
  CarLayoutLink,
  CarRef,
  LayoutLibrary,
  LayoutWidget,
  OverlaySettings,
  SavedLayout,
  WidgetSettings
} from '../types'
import { WIDGET_DEFS, WIDGET_IDS, type WidgetId } from '../widgets'
import { clampNumber, isRecord, normalizeBounds, pickBoolean } from './fields'

/** Most layouts kept: each is every widget's place, and every broadcast carries them all. */
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

/** A car model's id as the session gives it (DriverInfo CarID): a positive integer. */
export function isCarId(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 0x7fffffff
}

/** A car as told by the telemetry process or the settings window; null when malformed. */
export function normalizeCarRef(raw: unknown): CarRef | null {
  if (!isRecord(raw) || !isCarId(raw.carId)) return null
  return { carId: raw.carId, carName: cleanText(raw.carName, MAX_CAR_NAME) ?? '' }
}

/** The library a fresh install starts with: one layout, the widgets as they are. */
export function defaultLayoutLibrary(
  widgets: Readonly<Record<WidgetId, WidgetSettings>>,
  language: Language
): LayoutLibrary {
  return {
    activeId: FIRST_LAYOUT_ID,
    list: [
      {
        id: FIRST_LAYOUT_ID,
        name: DEFAULT_LAYOUT_NAMES[language],
        widgets: snapshotWidgets(widgets)
      }
    ],
    links: [],
    seenCars: []
  }
}

/**
 * The saved layouts read from disk, against the widgets already normalised. A file without
 * any (from before layouts) gets one, named after the interface language ('Principal'), equal
 * to its widgets: nothing moves. Malformed layouts, duplicate ids, links to a layout that is
 * gone and repeated cars are dropped; a repeated name (a file edited by hand) gets a number. An
 * active id naming no kept layout gets one that does (orphanActive). The active layout then
 * takes the widgets' fields (syncActiveLayout).
 */
export function normalizeLayoutLibrary(
  raw: unknown,
  widgets: Readonly<Record<WidgetId, WidgetSettings>>,
  language: Language
): LayoutLibrary {
  const live = snapshotWidgets(widgets)
  const r = isRecord(raw) ? raw : {}
  const list: SavedLayout[] = []
  const ids = new Set<string>()
  for (const entry of Array.isArray(r.list) ? (r.list as unknown[]) : []) {
    if (list.length >= MAX_LAYOUTS) break
    if (!isRecord(entry) || !isLayoutId(entry.id) || ids.has(entry.id)) continue
    ids.add(entry.id)
    const name = layoutName(entry.name) ?? `${DEFAULT_LAYOUT_NAMES[language]} ${list.length + 1}`
    list.push({
      id: entry.id,
      name: uniqueLayoutName(name, list),
      widgets: normalizeLayoutWidgets(entry.widgets, live)
    })
  }
  if (list.length === 0) return defaultLayoutLibrary(widgets, language)

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
  const activeId =
    typeof r.activeId === 'string' && ids.has(r.activeId)
      ? r.activeId
      : orphanActive(list, live, language)
  const lib: LayoutLibrary = { activeId, list, links, seenCars }
  copyIntoActive(lib, live)
  return lib
}

/**
 * The active layout of a file whose own one is gone (a damaged or hand-edited file), so that no
 * saved layout is overwritten by the widgets: one already equal to them, else the widgets kept
 * as a new layout; only a full list falls back to the first one. Mutates `list`.
 */
function orphanActive(
  list: SavedLayout[],
  live: Record<WidgetId, LayoutWidget>,
  language: Language
): string {
  const same = list.find((l) => sameLayoutWidgets(l.widgets, live))
  if (same) return same.id
  if (list.length >= MAX_LAYOUTS) return list[0]?.id ?? FIRST_LAYOUT_ID
  const id = nextLayoutId(list)
  list.push({ id, name: uniqueLayoutName(DEFAULT_LAYOUT_NAMES[language], list), widgets: live })
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

function copyIntoActive(lib: LayoutLibrary, live: Record<WidgetId, LayoutWidget>): void {
  const active = lib.list.find((l) => l.id === lib.activeId)
  if (active) active.widgets = live
}

/**
 * The rule: the active layout takes the widgets' bounds, scale, visibility and lock (moving a
 * widget changes the layout in use). Mutates `s`.
 */
export function syncActiveLayout(s: OverlaySettings): void {
  copyIntoActive(s.savedLayouts, snapshotWidgets(s.widgets))
}
