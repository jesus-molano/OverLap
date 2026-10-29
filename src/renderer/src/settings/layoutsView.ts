/**
 * The settings window's side of the saved layouts: the car you are in now and the last
 * export / import result (pushed by main), the rows of the layouts page and the commands.
 */
import { shallowRef, type ShallowRef } from 'vue'
import type { Messages } from '@shared/i18n'
import type { LayoutNotice } from '@shared/ipc'
import { canDeleteLayout, linkableCars, sortLayouts } from '@shared/layouts'
import type { CarRef, LayoutLibrary, LayoutMode, LayoutSort, SavedLayout } from '@shared/types'
import type { WidgetId } from '@shared/widgets'
import { sendCommand } from './editor'
import { foldText } from './personalBests'

/**
 * Rows the list shows before it scrolls in a box of its own; past this many layouts the page
 * also offers a search (as the personal bests do).
 */
export const LAYOUT_LIST_ROWS = 8

export interface LayoutRow {
  id: string
  name: string
  active: boolean
  canDelete: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  mode: LayoutMode
  /** 'Coches: Mazda MX-5 Cup, BMW M2' ('' without links). */
  cars: string
}

/** How the page shows the layouts (layoutList). */
export interface LayoutListView {
  /**
   * The one in use, apart above the others: always there, whatever the order or the search
   * (null: it keeps its place among `rows`, a short list in your order).
   */
  pinned: LayoutRow | null
  /** False while the search leaves the pinned one out (it is still shown, set apart). */
  pinnedMatches: boolean
  /** The others (all of them with no pinned one), in the chosen order, those matching. */
  rows: LayoutRow[]
  /** Layouts matching the search (every one without a search) and how many there are. */
  shown: number
  total: number
  /** Past LAYOUT_LIST_ROWS: the search field shows and the list scrolls in its own box. */
  many: boolean
  /** The search in effect ('' when none, or with too few layouts to search). */
  query: string
  /**
   * The order chevrons are offered: your order, no search. With a pinned row they move a layout
   * past its neighbours in `rows` (the one in use keeps its place: moveLayout aroundActive).
   */
  reorder: boolean
  /** What a row's chevrons send: true while the one in use is pinned (layoutCommands.move). */
  aroundActive: boolean
}

export interface LayoutListOptions {
  sort: LayoutSort
  /** As typed. */
  query: string
  /** The interface locale (LOCALES), for the A to Z order. */
  locale: string
}

export interface CarRow {
  car: CarRef
  label: string
  /** The layout it is linked to ('' for none). */
  layoutId: string
  current: boolean
}

export function carLabel(m: Messages, car: CarRef): string {
  return car.carName || m.settings.layouts.unknownCar(car.carId)
}

/** The names of the cars linked to layout `id`. */
function linkedCarLabels(m: Messages, lib: LayoutLibrary, id: string): string[] {
  return lib.links.filter((k) => k.layoutId === id).map((k) => carLabel(m, k))
}

/**
 * Every word of `query` appears in the layout's name or in the name of a car linked to it,
 * whatever the case and the accents ('porsche' finds 'Pórsche 911 Cup'); an empty query matches.
 */
export function layoutMatches(
  m: Messages,
  lib: LayoutLibrary,
  layout: SavedLayout,
  query: string
): boolean {
  const words = foldText(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const hay = foldText([layout.name, ...linkedCarLabels(m, lib, layout.id)].join('\n'))
  return words.every((w) => hay.includes(w))
}

/**
 * The list as the page shows it: the one in use pinned apart once the list is long or not in
 * your order (so it never scrolls or sorts out of sight), the rest sorted (sortLayouts) and
 * filtered by the search; a short list in your order stays as stored, the one in use in its
 * place. The stored order never changes here.
 */
export function layoutList(
  m: Messages,
  lib: LayoutLibrary,
  opts: LayoutListOptions
): LayoutListView {
  const total = lib.list.length
  const many = total > LAYOUT_LIST_ROWS
  const query = many ? opts.query.trim() : ''
  const active = lib.list.find((l) => l.id === lib.activeId)
  const pin = active !== undefined && (many || opts.sort !== 'custom')
  const reorder = opts.sort === 'custom' && query === ''
  const matches = (l: SavedLayout): boolean => layoutMatches(m, lib, l, query)
  const others = sortLayouts(
    lib.list.filter((l) => !pin || l !== active),
    opts.sort,
    opts.locale
  ).filter(matches)
  const last = others.length - 1
  const row = (l: SavedLayout, i: number | null): LayoutRow => {
    const cars = linkedCarLabels(m, lib, l.id)
    return {
      id: l.id,
      name: l.name,
      active: l.id === lib.activeId,
      canDelete: canDeleteLayout(lib, l.id),
      canMoveUp: reorder && i !== null && i > 0,
      canMoveDown: reorder && i !== null && i < last,
      mode: l.mode,
      cars: cars.length > 0 ? m.settings.layouts.cars(cars.join(', ')) : ''
    }
  }
  const pinnedMatches = pin && matches(active)
  return {
    pinned: pin ? row(active, null) : null,
    pinnedMatches,
    rows: others.map((l, i) => row(l, i)),
    shown: others.length + (pinnedMatches ? 1 : 0),
    total,
    many,
    query,
    reorder,
    aroundActive: pin
  }
}

/**
 * The row to bring into view after the library changed from `prev` to `next`: a layout that
 * was not there before (saved, duplicated, imported), else the one in use when it changed; null
 * for anything else (a rename, a move, a link), which leaves the list where you scrolled it.
 */
export function rowToReveal(
  prev: { ids: readonly string[]; activeId: string },
  next: { ids: readonly string[]; activeId: string }
): string | null {
  const before = new Set(prev.ids)
  const added = next.ids.find((id) => !before.has(id))
  if (added !== undefined) return added
  return next.activeId !== prev.activeId ? next.activeId : null
}

/** How far a box must scroll (px, signed) for `row` to be whole inside it; 0 when it is. */
export function revealOffset(
  box: { top: number; bottom: number },
  row: { top: number; bottom: number }
): number {
  if (row.top < box.top) return row.top - box.top
  if (row.bottom > box.bottom) return Math.min(row.bottom - box.bottom, row.top - box.top)
  return 0
}

/** Where a widget page's changes go (the banner at its top, OptionsTarget.vue). */
export interface OptionsTarget {
  /** The layout in use ('Mazda MX-5'). */
  name: string
  /** True: a 'position' layout is in use, so the changes go to the shared options. */
  shared: boolean
  /** "Aplicar a todas las disposiciones" changes something only with another layout. */
  canApplyToAll: boolean
}

export function optionsTarget(lib: LayoutLibrary): OptionsTarget {
  const active = lib.list.find((l) => l.id === lib.activeId)
  return {
    name: active?.name ?? '',
    shared: active?.mode === 'position',
    canApplyToAll: lib.list.length > 1
  }
}

/** The layouts a car can be linked to, A to Z (a native select of up to 30 stays findable). */
export function linkOptions(lib: LayoutLibrary, locale: string): { id: string; name: string }[] {
  return sortLayouts(lib.list, 'name', locale).map((l) => ({ id: l.id, name: l.name }))
}

/** The car you are in first (`current`), then the cars seen and linked, each once. */
export function carRows(m: Messages, lib: LayoutLibrary, current: CarRef | null): CarRow[] {
  return linkableCars(lib, current).map((car) => ({
    car,
    label: carLabel(m, car),
    layoutId: lib.links.find((l) => l.carId === car.carId)?.layoutId ?? '',
    current: current?.carId === car.carId
  }))
}

/** What the last export or import did, in words; `error` true for a failure. */
export function noticeText(m: Messages, n: LayoutNotice): { text: string; error: boolean } {
  const t = m.settings.layouts.notices
  switch (n.kind) {
    case 'exported':
      return { text: t.exported(n.name), error: false }
    case 'export-failed':
      return { text: t.exportFailed(n.name), error: true }
    case 'imported':
      return { text: t.imported(n.name), error: false }
    case 'import-failed': {
      const f = t.importFailed
      return { text: n.error === 'too-big' ? f.tooBig : f[n.error], error: true }
    }
  }
}

/** Pushed by main; null until the first one. */
export const currentCar: ShallowRef<CarRef | null> = shallowRef(null)
export const layoutNotice: ShallowRef<LayoutNotice | null> = shallowRef(null)

let started = false

/** The car you are in and the last notice, listened to once per window. */
export function useLayoutState(): {
  currentCar: ShallowRef<CarRef | null>
  layoutNotice: ShallowRef<LayoutNotice | null>
} {
  if (!started) {
    started = true
    let carSeen = false
    window.overlay.onCurrentCar((car) => {
      carSeen = true
      currentCar.value = car
    })
    window.overlay.onLayoutNotice((n) => (layoutNotice.value = n))
    void window.overlay.getInitialState().then((init) => {
      if (!carSeen) currentCar.value = init.currentCar
    })
  }
  return { currentCar, layoutNotice }
}

export const layoutCommands = {
  save: (name: string, mode: LayoutMode) => sendCommand({ type: 'layout-save', name, mode }),
  apply: (id: string) => sendCommand({ type: 'layout-apply', id }),
  duplicate: (id: string, name: string) => sendCommand({ type: 'layout-duplicate', id, name }),
  rename: (id: string, name: string) => sendCommand({ type: 'layout-rename', id, name }),
  remove: (id: string) => sendCommand({ type: 'layout-delete', id }),
  /** `aroundActive`: the one in use is pinned apart, so the move skips it (layoutList). */
  move: (id: string, step: -1 | 1, aroundActive: boolean) =>
    sendCommand({ type: 'layout-move', id, step, aroundActive }),
  exportOne: (id: string) => {
    layoutNotice.value = null
    sendCommand({ type: 'layout-export', id })
  },
  importOne: (mode: LayoutMode) => {
    layoutNotice.value = null
    sendCommand({ type: 'layout-import', mode })
  },
  setMode: (id: string, mode: LayoutMode) => sendCommand({ type: 'layout-set-mode', id, mode }),
  /** Widget `widgetId`'s options in effect into every 'full' layout and the shared options. */
  optionsToAll: (widgetId: WidgetId) => sendCommand({ type: 'layout-options-to-all', widgetId }),
  link: (car: CarRef, layoutId: string | null) =>
    sendCommand({ type: 'layout-link-car', car: { ...car }, layoutId })
}
