/**
 * Saved layouts: named sets of every widget's place, size, scale, visibility and lock
 * (settings.savedLayouts), so a layout for the Mazda and another for a GT3 are one click (or a
 * shortcut, or getting in the car) apart. A 'full' layout ("Posición y opciones") also carries
 * every widget's options (LAYOUT_SECTIONS and WIDGET_OPTION_FIELDS in settingsSchema.ts); a
 * 'position' one ("Solo posición") uses the shared options (LayoutLibrary.shared). The look,
 * the units, the visibility rules and the shortcuts are global, never part of one.
 *
 * The active layout always equals the widgets (settings/layouts.ts syncActiveLayout): moving a
 * widget or changing an option changes the layout in use (or the shared options), and applying
 * another copies its places and options into the widgets, in one change.
 * The commands below mutate a settings draft (main runs them inside SettingsStore.update, which
 * normalises the result) and say whether they changed anything. Pure, but for the clock: a
 * layout that becomes the one in use is stamped (SavedLayout.usedAt) with `now`, Date.now() unless
 * given.
 */
import { copyData } from './copy'
import { deepEqual } from './equal'
import { SETTINGS_VERSION, defaultOptions } from './settings/defaults'
import { applySettingsPatch } from './settings/patch'
import {
  MAX_CAR_LINKS,
  MAX_LAYOUTS,
  MAX_SEEN_CARS,
  copyWidgetOptions,
  isLayoutId,
  layoutName,
  layoutWidgetOf,
  nextLayoutId,
  normalizeLayoutWidgets,
  normalizeOptionSet,
  optionSetOf,
  settingsDraft,
  snapshotWidgets,
  syncActiveLayout,
  uniqueLayoutName,
  withoutControls,
  writeOptionSet
} from './settings/layouts'
import type {
  CarRef,
  LayoutLibrary,
  LayoutMode,
  LayoutOptionSet,
  LayoutSort,
  LayoutWidget,
  OverlaySettings,
  SavedLayout
} from './types'
import { WIDGET_IDS, type WidgetId } from './widgets'

export {
  DEFAULT_LAYOUT_NAMES,
  LAYOUT_MODES,
  MAX_LAYOUTS,
  MAX_LAYOUT_NAME,
  isLayoutId,
  layoutName,
  nextLayoutId,
  normalizeCarRef,
  optionSetOf,
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

/**
 * The shared options as they are now: the ones in effect while a 'position' layout is in use
 * (they are its options), else LayoutLibrary.shared. A copy.
 */
export function sharedOptions(s: OverlaySettings): LayoutOptionSet {
  const lib = s.savedLayouts
  const shared = lib.shared
  if (shared === undefined || activeLayout(lib)?.mode === 'position') return optionSetOf(s)
  return copyData(shared)
}

function addLayout(
  s: OverlaySettings,
  name: unknown,
  widgets: Record<WidgetId, LayoutWidget>,
  options: LayoutOptionSet | null,
  after?: string
): string | null {
  const lib = s.savedLayouts
  const clean = layoutName(name)
  if (clean === null || !canAddLayout(lib)) return null
  const layout: SavedLayout = {
    id: nextLayoutId(lib.list),
    name: uniqueLayoutName(clean, lib.list),
    mode: options === null ? 'position' : 'full',
    widgets,
    ...(options === null ? {} : { options })
  }
  const at = after === undefined ? -1 : lib.list.findIndex((l) => l.id === after)
  if (at < 0) lib.list.push(layout)
  else lib.list.splice(at + 1, 0, layout)
  return layout.id
}

/**
 * "Guardar como": a new layout equal to the widgets now, which becomes the one in use (what you
 * move or change next changes it, not the one you started from). A 'full' one keeps the options
 * in effect: nothing changes. A 'position' one uses the shared options, which take effect (they
 * differ from those in effect when a 'full' layout was in use). Null: no name, or no room.
 */
export function saveLayoutAs(
  s: OverlaySettings,
  name: unknown,
  now = Date.now(),
  mode: LayoutMode = 'full'
): string | null {
  // What is in effect belongs to the layout being left (main's drafts already are in line).
  syncActiveLayout(s)
  const shared = sharedOptions(s)
  const id = addLayout(s, name, snapshotWidgets(s.widgets), mode === 'full' ? optionSetOf(s) : null)
  if (id === null) return null
  s.savedLayouts.activeId = id
  if (mode === 'position') writeOptionSet(s, shared)
  stampUsed(s.savedLayouts, id, now)
  return id
}

/** Layout `id` became the one in use at `now`. */
function stampUsed(lib: LayoutLibrary, id: string, now: number): void {
  const layout = findLayout(lib, id)
  if (layout && Number.isFinite(now) && now >= 0) layout.usedAt = Math.floor(now)
}

/** A copy of layout `id` named `name`, right after it, not applied: same mode, same options. */
export function duplicateLayout(s: OverlaySettings, id: string, name: unknown): string | null {
  syncActiveLayout(s)
  const source = findLayout(s.savedLayouts, id)
  if (!source) return null
  const widgets = {} as Record<WidgetId, LayoutWidget>
  for (const w of WIDGET_IDS) widgets[w] = layoutWidgetOf(source.widgets[w])
  const options = source.mode === 'full' ? optionsOf(s, source) : null
  return addLayout(s, name, widgets, options, id)
}

/** A 'full' layout's options, a copy (the ones in effect when it is a copy of nothing yet). */
function optionsOf(s: OverlaySettings, layout: SavedLayout): LayoutOptionSet {
  return layout.options ? copyData(layout.options) : optionSetOf(s)
}

/**
 * Changes what layout `id` restores. To 'full' it takes a copy of the shared options (nothing
 * changes now); to 'position' its own options are dropped and, for the one in use, the shared
 * ones take effect. False when it is unknown or already in that mode.
 */
export function setLayoutMode(s: OverlaySettings, id: string, mode: LayoutMode): boolean {
  syncActiveLayout(s)
  const layout = findLayout(s.savedLayouts, id)
  if (!layout || layout.mode === mode) return false
  const shared = sharedOptions(s)
  const active = id === s.savedLayouts.activeId
  layout.mode = mode
  if (mode === 'full') {
    layout.options = shared
    // In use, 'position' until now: the shared options are kept apart from its own from now on.
    if (active) s.savedLayouts.shared = copyData(shared)
  } else {
    delete layout.options
    if (active) writeOptionSet(s, shared)
  }
  return true
}

/**
 * "Copiar estas opciones a todas": widget `id`'s options in effect (its section and its
 * fields) copied into every 'full' layout and the shared options. False when they all had them.
 */
export function applyWidgetOptionsToAll(s: OverlaySettings, id: WidgetId): boolean {
  syncActiveLayout(s)
  const lib = s.savedLayouts
  const now = optionSetOf(s)
  let changed = false
  // A stored set may be sealed (frozen, settings/layouts.ts): a changed one is replaced.
  const withThese = (set: LayoutOptionSet): LayoutOptionSet => {
    const next = copyData(set)
    copyWidgetOptions(next, now, id)
    if (deepEqual(next, set)) return set
    changed = true
    return next
  }
  for (const l of lib.list) if (l.mode === 'full' && l.options) l.options = withThese(l.options)
  lib.shared = withThese(lib.shared ?? now)
  return changed
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
 * order). `aroundActive`: the settings window shows the one in use pinned above the others, so
 * `id` swaps with its neighbour among those and the one in use keeps its place (it cannot be
 * moved itself then).
 */
export function moveLayout(
  s: OverlaySettings,
  id: string,
  step: -1 | 1,
  aroundActive = false
): boolean {
  const lib = s.savedLayouts
  const activeAt = lib.list.findIndex((l) => l.id === lib.activeId)
  const pinned = aroundActive ? lib.list[activeAt] : undefined
  if (pinned?.id === id) return false
  const list = pinned ? lib.list.filter((l) => l !== pinned) : lib.list
  const at = list.findIndex((l) => l.id === id)
  const to = at + step
  if (at < 0 || to < 0 || to >= list.length) return false
  const [layout] = list.splice(at, 1)
  if (layout) list.splice(to, 0, layout)
  if (pinned) {
    list.splice(activeAt, 0, pinned)
    lib.list = list
  }
  return true
}

/**
 * Makes layout `id` the one in use: every widget takes its bounds, scale, visibility and lock,
 * and its options (a 'full' one) or the shared ones (a 'position' one), all in this one change;
 * the layout is stamped used at `now`. What was in effect stays with the layout left (or with
 * the shared options). False when it is unknown or already in use.
 */
export function applyLayout(s: OverlaySettings, id: string, now = Date.now()): boolean {
  const lib = s.savedLayouts
  const layout = findLayout(lib, id)
  if (!layout || id === lib.activeId) return false
  syncActiveLayout(s)
  const options = layout.mode === 'full' ? optionsOf(s, layout) : sharedOptions(s)
  for (const w of WIDGET_IDS) Object.assign(s.widgets[w], layoutWidgetOf(layout.widgets[w]))
  writeOptionSet(s, options)
  lib.activeId = id
  stampUsed(lib, id, now)
  return true
}

/**
 * A settings-window patch made while layout `forLayout` was in use (sent with it). Still in use,
 * or none said: applySettingsPatch. Another one in use now (the tray, the shortcut or the car
 * switched while a slider's last value or a list was on its way): what the patch changes in a
 * layout (the options, and the widgets' scale, visibility and lock) goes to `forLayout` (its own
 * options, or the shared ones for a 'position' one), never to the layout now in use; the global
 * sections apply as usual. Done by applying `forLayout`, patching and applying the one in use
 * again, with the use stamps kept. Never mutates `current`.
 */
export function applySettingsPatchFor(
  current: OverlaySettings,
  patch: unknown,
  forLayout: unknown
): OverlaySettings {
  const lib = current.savedLayouts
  if (!hasLayout(lib, forLayout) || forLayout === lib.activeId) {
    return applySettingsPatch(current, patch)
  }
  const inUse = lib.activeId
  const stamps = new Map(lib.list.map((l) => [l.id, l.usedAt]))
  const draft = settingsDraft(current)
  applyLayout(draft, forLayout)
  const out = applySettingsPatch(draft, patch)
  applyLayout(out, inUse)
  for (const l of out.savedLayouts.list) {
    const at = stamps.get(l.id)
    if (at === undefined) delete l.usedAt
    else l.usedAt = at
  }
  return out
}

/** SavedLayout.usedAt, 0 for one never used. */
export function usedAtOf(layout: Pick<SavedLayout, 'usedAt'>): number {
  return layout.usedAt ?? 0
}

/**
 * At most `max` layouts for a short list (the tray), in this order: the one in use, then `also`
 * (the current car's, null: none; one click back to it after a manual switch), then the latest
 * used first (never used ones in the list's order). A list that fits is returned whole, as stored.
 */
export function recentLayouts(
  lib: LayoutLibrary,
  max: number,
  also: string | null = null
): SavedLayout[] {
  if (lib.list.length <= max) return [...lib.list]
  const picked = new Map<string, SavedLayout>()
  for (const id of [lib.activeId, also]) {
    const l = id === null ? undefined : findLayout(lib, id)
    if (l && picked.size < max) picked.set(l.id, l)
  }
  for (const l of sortLayouts(lib.list, 'recent')) {
    if (picked.size >= max) break
    if (!picked.has(l.id)) picked.set(l.id, l)
  }
  return [...picked.values()]
}

/**
 * The layouts in `sort` order, a new array: 'custom' as stored, 'name' A to Z in `locale`
 * (case, accents and numbers as people read them: 'GT3 (2)' before 'GT3 (10)'), 'recent' the
 * latest used first. Ties keep the stored order.
 */
export function sortLayouts(
  list: readonly SavedLayout[],
  sort: LayoutSort,
  locale?: string
): SavedLayout[] {
  const out = [...list]
  if (sort === 'name') {
    const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true })
    out.sort((a, b) => collator.compare(a.name, b.name))
  } else if (sort === 'recent') {
    out.sort((a, b) => usedAtOf(b) - usedAtOf(a))
  }
  return out
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
/**
 * The file version written; a newer one is refused (it may mean something else). 1: the places
 * only; 2 (layouts carrying options): also the options of a 'full' layout.
 */
export const LAYOUT_FILE_VERSION = 2
/** Larger files are refused unread (a layout with its options is a few tens of kB). */
export const MAX_LAYOUT_FILE_BYTES = 256 * 1024
/** The extension offered by the dialogs. */
export const LAYOUT_FILE_EXTENSION = 'json'

/**
 * What an exported file holds: the layout's places and, for a 'full' one, every widget's options
 * (only the per-widget ones: nothing of the look, the shortcuts or the visibility rules), with
 * the settings version they were written in (to migrate them on import, as a settings file).
 */
export interface LayoutFile {
  format: typeof LAYOUT_FILE_FORMAT
  version: typeof LAYOUT_FILE_VERSION
  name: string
  widgets: Record<WidgetId, LayoutWidget>
  settingsVersion?: number
  options?: LayoutOptionSet
}

export function layoutFileOf(layout: SavedLayout): LayoutFile {
  const widgets = {} as Record<WidgetId, LayoutWidget>
  for (const id of WIDGET_IDS) widgets[id] = layoutWidgetOf(layout.widgets[id])
  const options = layout.mode === 'full' ? layout.options : undefined
  return {
    format: LAYOUT_FILE_FORMAT,
    version: LAYOUT_FILE_VERSION,
    name: layout.name,
    widgets,
    ...(options ? { settingsVersion: SETTINGS_VERSION, options: copyData(options) } : {})
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
  | {
      ok: true
      name: string | null
      widgets: Record<WidgetId, LayoutWidget>
      /** The file's options, normalised; null for a file without them (version 1, 'position'). */
      options: LayoutOptionSet | null
    }
  | { ok: false; error: LayoutFileError }

/** What an import falls back on for what the file lacks or gets wrong. */
export interface LayoutImportFallback {
  /** The widgets' places as they are now. */
  widgets: Readonly<Record<WidgetId, LayoutWidget>>
  /** The shared options (sharedOptions). */
  options: Readonly<LayoutOptionSet>
}

/**
 * Validates an untrusted file. Only the layout fields of known widgets and the per-widget option
 * sections are read, through the schema (unknown keys, sections and widgets are ignored, values
 * are clamped like on load, older options migrated); a widget the file lacks keeps `fallback`'s
 * places, an option it lacks the fallback's. `name` is null when the file's is unusable.
 */
export function parseLayoutFile(text: string, fallback: LayoutImportFallback): LayoutImport {
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
  const hasOptions = r.version >= 2 && typeof r.options === 'object' && r.options !== null
  return {
    ok: true,
    name: layoutName(r.name),
    widgets: normalizeLayoutWidgets(w, fallback.widgets),
    options: hasOptions ? normalizeOptionSet(r.options, fallback.options, r.settingsVersion) : null
  }
}

/**
 * Adds an imported layout (not applied), named as in the file or `fallbackName`, made unique.
 * 'full': with the file's options, or a copy of the shared ones for a file without any (version
 * 1); 'position': without options. Null when there is no room.
 */
export function importLayout(
  s: OverlaySettings,
  imported: Extract<LayoutImport, { ok: true }>,
  fallbackName: string,
  mode: LayoutMode = 'full'
): string | null {
  const options = mode === 'full' ? (imported.options ?? sharedOptions(s)) : null
  return addLayout(s, imported.name ?? fallbackName, imported.widgets, options)
}

// ---------------------------------------------------------------------------
// What the renderers receive
// ---------------------------------------------------------------------------

/** What the overlays get as the settings window's options (see rendererSettings). */
const OVERLAY_SETTINGS_WINDOW = defaultOptions('settingsWindow')

/**
 * The settings without what a renderer never reads, so that a broadcast stays small however
 * many 'full' layouts there are (each is about 10 kB of options): the options in effect are the
 * top-level ones. 'settings' (the settings window): every layout, without its options, and no
 * shared ones. 'overlay': only the layout in use, likewise, no cars, and the settings window's
 * own options at their defaults.
 */
export function rendererSettings(
  s: OverlaySettings,
  view: 'settings' | 'overlay'
): OverlaySettings {
  const lib = s.savedLayouts
  const slim = (l: SavedLayout): SavedLayout => {
    const rest = { ...l }
    delete rest.options
    return rest
  }
  const list = view === 'overlay' ? lib.list.filter((l) => l.id === lib.activeId) : lib.list
  const out: LayoutLibrary = {
    activeId: lib.activeId,
    list: list.map(slim),
    links: view === 'overlay' ? [] : lib.links,
    seenCars: view === 'overlay' ? [] : lib.seenCars
  }
  // The settings window's own options are no overlay's: the defaults there, so folding a panel
  // of "Personalizar" changes nothing the overlays are sent (main skips an unchanged copy).
  const settingsWindow = view === 'overlay' ? OVERLAY_SETTINGS_WINDOW : s.settingsWindow
  return { ...s, savedLayouts: out, settingsWindow }
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
