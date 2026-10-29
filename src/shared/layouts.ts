/**
 * Saved layouts: named sets of every widget's place, size, scale, visibility and lock
 * (settings.savedLayouts), so a layout for the Mazda and another for a GT3 are one click (or a
 * shortcut, or getting in the car) apart. Per-widget options are never part of one.
 *
 * The active layout always equals the widgets (settings/layouts.ts syncActiveLayout): moving a
 * widget changes the layout in use, and applying another copies its fields into the widgets.
 * The commands below mutate a settings draft (main runs them inside SettingsStore.update, which
 * normalises the result) and say whether they changed anything. Pure.
 */
import {
  MAX_CAR_LINKS,
  MAX_LAYOUTS,
  MAX_SEEN_CARS,
  isLayoutId,
  layoutName,
  layoutWidgetOf,
  nextLayoutId,
  normalizeLayoutWidgets,
  snapshotWidgets,
  uniqueLayoutName,
  withoutControls
} from './settings/layouts'
import type { CarRef, LayoutLibrary, LayoutWidget, OverlaySettings, SavedLayout } from './types'
import { WIDGET_IDS, type WidgetId } from './widgets'

export {
  DEFAULT_LAYOUT_NAMES,
  MAX_LAYOUTS,
  MAX_LAYOUT_NAME,
  isLayoutId,
  layoutName,
  nextLayoutId,
  normalizeCarRef,
  snapshotWidgets,
  uniqueLayoutName
} from './settings/layouts'

export function findLayout(lib: LayoutLibrary, id: string): SavedLayout | undefined {
  return lib.list.find((l) => l.id === id)
}

export function activeLayout(lib: LayoutLibrary): SavedLayout | undefined {
  return findLayout(lib, lib.activeId)
}

/** Room for another layout. */
export function canAddLayout(lib: LayoutLibrary): boolean {
  return lib.list.length < MAX_LAYOUTS
}

function addLayout(
  s: OverlaySettings,
  name: unknown,
  widgets: Record<WidgetId, LayoutWidget>,
  after?: string
): string | null {
  const lib = s.savedLayouts
  const clean = layoutName(name)
  if (clean === null || !canAddLayout(lib)) return null
  const layout: SavedLayout = {
    id: nextLayoutId(lib.list),
    name: uniqueLayoutName(clean, lib.list),
    widgets
  }
  const at = after === undefined ? -1 : lib.list.findIndex((l) => l.id === after)
  if (at < 0) lib.list.push(layout)
  else lib.list.splice(at + 1, 0, layout)
  return layout.id
}

/**
 * "Guardar como": a new layout equal to the widgets now, which becomes the one in use (what you
 * move next changes it, not the one you started from). Null: no name, or no room.
 */
export function saveLayoutAs(s: OverlaySettings, name: unknown): string | null {
  const id = addLayout(s, name, snapshotWidgets(s.widgets))
  if (id !== null) s.savedLayouts.activeId = id
  return id
}

/** A copy of layout `id` named `name`, right after it, not applied. */
export function duplicateLayout(s: OverlaySettings, id: string, name: unknown): string | null {
  const source = findLayout(s.savedLayouts, id)
  if (!source) return null
  const widgets = {} as Record<WidgetId, LayoutWidget>
  for (const w of WIDGET_IDS) widgets[w] = layoutWidgetOf(source.widgets[w])
  return addLayout(s, name, widgets, id)
}

export function renameLayout(s: OverlaySettings, id: string, name: unknown): boolean {
  const layout = findLayout(s.savedLayouts, id)
  const clean = layoutName(name)
  if (!layout || clean === null) return false
  const next = uniqueLayoutName(clean, s.savedLayouts.list, id)
  if (next === layout.name) return false
  layout.name = next
  return true
}

/** Whether layout `id` can go: not the one in use (apply another first), never the last one. */
export function canDeleteLayout(lib: LayoutLibrary, id: string): boolean {
  return id !== lib.activeId && lib.list.length > 1 && findLayout(lib, id) !== undefined
}

/** Deletes layout `id` and the car links to it (see canDeleteLayout). */
export function deleteLayout(s: OverlaySettings, id: string): boolean {
  const lib = s.savedLayouts
  if (!canDeleteLayout(lib, id)) return false
  lib.list = lib.list.filter((l) => l.id !== id)
  lib.links = lib.links.filter((l) => l.layoutId !== id)
  return true
}

/**
 * Moves layout `id` one place up (-1) or down (1) in the list (the tray's and the shortcut's
 * order).
 */
export function moveLayout(s: OverlaySettings, id: string, step: -1 | 1): boolean {
  const list = s.savedLayouts.list
  const at = list.findIndex((l) => l.id === id)
  const to = at + step
  if (at < 0 || to < 0 || to >= list.length) return false
  const [layout] = list.splice(at, 1)
  if (layout) list.splice(to, 0, layout)
  return true
}

/**
 * Makes layout `id` the one in use: every widget takes its bounds, scale, visibility and lock;
 * nothing else changes. False when it is unknown or already in use.
 */
export function applyLayout(s: OverlaySettings, id: string): boolean {
  const lib = s.savedLayouts
  const layout = findLayout(lib, id)
  if (!layout || id === lib.activeId) return false
  for (const w of WIDGET_IDS) Object.assign(s.widgets[w], layoutWidgetOf(layout.widgets[w]))
  lib.activeId = id
  return true
}

/** The layout after the one in use, wrapping around; null with a single layout. */
export function nextLayoutAfterActive(lib: LayoutLibrary): string | null {
  if (lib.list.length < 2) return null
  const at = lib.list.findIndex((l) => l.id === lib.activeId)
  return lib.list[(at + 1) % lib.list.length]?.id ?? null
}

/** The layout car model `carId` is linked to (null: none, or the layout is gone). */
export function linkedLayoutId(lib: LayoutLibrary, carId: number): string | null {
  const link = lib.links.find((l) => l.carId === carId)
  return link && findLayout(lib, link.layoutId) ? link.layoutId : null
}

/**
 * Links `car` to layout `layoutId` (null: unlinks it). A car has one layout at most; a layout
 * can have many cars.
 */
export function linkCar(s: OverlaySettings, car: CarRef, layoutId: string | null): boolean {
  const lib = s.savedLayouts
  const at = lib.links.findIndex((l) => l.carId === car.carId)
  if (layoutId === null) {
    if (at < 0) return false
    lib.links.splice(at, 1)
    return true
  }
  if (!findLayout(lib, layoutId)) return false
  const link = { carId: car.carId, carName: car.carName, layoutId }
  if (at >= 0) {
    const cur = lib.links[at]
    if (cur && cur.layoutId === layoutId && cur.carName === car.carName) return false
    lib.links[at] = link
    return true
  }
  if (lib.links.length >= MAX_CAR_LINKS) return false
  lib.links.push(link)
  return true
}

/**
 * Remembers `car` as the latest one you got in (first in seenCars, the oldest dropped past
 * MAX_SEEN_CARS); a linked car's name follows the session's. False when nothing changed.
 */
export function noteSeenCar(s: OverlaySettings, car: CarRef): boolean {
  const lib = s.savedLayouts
  const first = lib.seenCars[0]
  const links = lib.links.filter((l) => l.carId === car.carId && l.carName !== car.carName)
  if (first && first.carId === car.carId && first.carName === car.carName && links.length === 0) {
    return false
  }
  lib.seenCars = [
    { carId: car.carId, carName: car.carName },
    ...lib.seenCars.filter((c) => c.carId !== car.carId)
  ].slice(0, MAX_SEEN_CARS)
  for (const l of links) l.carName = car.carName
  return true
}

/**
 * The cars a layout can be linked to, for the settings window: the one you are in now first,
 * then the ones seen, then any linked car no longer in that list. Each car once.
 */
export function linkableCars(lib: LayoutLibrary, current: CarRef | null): CarRef[] {
  const out: CarRef[] = []
  const seen = new Set<number>()
  const add = (c: CarRef): void => {
    if (seen.has(c.carId)) return
    seen.add(c.carId)
    out.push({ carId: c.carId, carName: c.carName })
  }
  if (current) add(current)
  for (const c of lib.seenCars) add(c)
  for (const l of lib.links) add(l)
  return out
}

// ---------------------------------------------------------------------------
// Files: one layout, exported and imported
// ---------------------------------------------------------------------------

/** `format` of a layout file: anything else is not one. */
export const LAYOUT_FILE_FORMAT = 'overlap-layout'
/** The file version written; a newer one is refused (it may mean something else). */
export const LAYOUT_FILE_VERSION = 1
/** Larger files are refused unread (a layout is a few kB). */
export const MAX_LAYOUT_FILE_BYTES = 256 * 1024
/** The extension offered by the dialogs. */
export const LAYOUT_FILE_EXTENSION = 'json'

/** What an exported file holds: the layout's fields only, no option of any widget. */
export interface LayoutFile {
  format: typeof LAYOUT_FILE_FORMAT
  version: typeof LAYOUT_FILE_VERSION
  name: string
  widgets: Record<WidgetId, LayoutWidget>
}

export function layoutFileOf(layout: SavedLayout): LayoutFile {
  const widgets = {} as Record<WidgetId, LayoutWidget>
  for (const id of WIDGET_IDS) widgets[id] = layoutWidgetOf(layout.widgets[id])
  return {
    format: LAYOUT_FILE_FORMAT,
    version: LAYOUT_FILE_VERSION,
    name: layout.name,
    widgets
  }
}

export function layoutFileText(layout: SavedLayout): string {
  return JSON.stringify(layoutFileOf(layout), null, 2) + '\n'
}

/**
 * Why a file was refused: not JSON, not a layout file, from a newer version of the app, with no
 * widget this version knows, or too large.
 */
export type LayoutFileError = 'json' | 'format' | 'version' | 'empty' | 'too-big'

export type LayoutImport =
  | { ok: true; name: string | null; widgets: Record<WidgetId, LayoutWidget> }
  | { ok: false; error: LayoutFileError }

/**
 * Validates an untrusted file. Only the layout fields of known widgets are read (unknown keys
 * and widgets are ignored, values are clamped like on load); a widget the file lacks keeps
 * `fallback`'s fields (the widgets as they are now). `name` is null when the file's is unusable.
 */
export function parseLayoutFile(
  text: string,
  fallback: Readonly<Record<WidgetId, LayoutWidget>>
): LayoutImport {
  if (text.length > MAX_LAYOUT_FILE_BYTES) return { ok: false, error: 'too-big' }
  let raw: unknown
  try {
    raw = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
  } catch {
    return { ok: false, error: 'json' }
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'format' }
  }
  const r = raw as Record<string, unknown>
  if (r.format !== LAYOUT_FILE_FORMAT) return { ok: false, error: 'format' }
  if (typeof r.version !== 'number' || !Number.isInteger(r.version) || r.version < 1) {
    return { ok: false, error: 'format' }
  }
  if (r.version > LAYOUT_FILE_VERSION) return { ok: false, error: 'version' }
  const widgets = r.widgets
  if (typeof widgets !== 'object' || widgets === null || Array.isArray(widgets)) {
    return { ok: false, error: 'format' }
  }
  const w = widgets as Record<string, unknown>
  if (!WIDGET_IDS.some((id) => typeof w[id] === 'object' && w[id] !== null)) {
    return { ok: false, error: 'empty' }
  }
  return { ok: true, name: layoutName(r.name), widgets: normalizeLayoutWidgets(w, fallback) }
}

/**
 * Adds an imported layout (not applied), named as in the file or `fallbackName`, made unique.
 * Null when there is no room.
 */
export function importLayout(
  s: OverlaySettings,
  imported: Extract<LayoutImport, { ok: true }>,
  fallbackName: string
): string | null {
  return addLayout(s, imported.name ?? fallbackName, imported.widgets)
}

/** A file name for an exported layout: the name without characters Windows refuses. */
export function layoutFileName(name: string): string {
  const base = withoutControls(name, '')
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/[. ]+$/, '')
    .trim()
  return `${base === '' ? 'layout' : base}.overlap-layout.${LAYOUT_FILE_EXTENSION}`
}

/** Whether `id` is a layout of the library (an id from IPC). */
export function hasLayout(lib: LayoutLibrary, id: unknown): id is string {
  return isLayoutId(id) && findLayout(lib, id) !== undefined
}
