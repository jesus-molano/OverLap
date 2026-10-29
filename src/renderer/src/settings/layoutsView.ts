/**
 * The settings window's side of the saved layouts: the car you are in now and the last
 * export / import result (pushed by main), the rows of the layouts page and the commands.
 */
import { shallowRef, type ShallowRef } from 'vue'
import type { Messages } from '@shared/i18n'
import type { LayoutNotice } from '@shared/ipc'
import { canDeleteLayout, linkableCars } from '@shared/layouts'
import type { CarRef, LayoutLibrary } from '@shared/types'
import { sendCommand } from './editor'

export interface LayoutRow {
  id: string
  name: string
  active: boolean
  canDelete: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  /** 'Coches: Mazda MX-5 Cup, BMW M2' ('' without links). */
  cars: string
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

/** One row per layout, in the library's order. */
export function layoutRows(m: Messages, lib: LayoutLibrary): LayoutRow[] {
  const last = lib.list.length - 1
  return lib.list.map((l, i) => {
    const cars = lib.links.filter((k) => k.layoutId === l.id).map((k) => carLabel(m, k))
    return {
      id: l.id,
      name: l.name,
      active: l.id === lib.activeId,
      canDelete: canDeleteLayout(lib, l.id),
      canMoveUp: i > 0,
      canMoveDown: i < last,
      cars: cars.length > 0 ? m.settings.layouts.cars(cars.join(', ')) : ''
    }
  })
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
  save: (name: string) => sendCommand({ type: 'layout-save', name }),
  apply: (id: string) => sendCommand({ type: 'layout-apply', id }),
  duplicate: (id: string, name: string) => sendCommand({ type: 'layout-duplicate', id, name }),
  rename: (id: string, name: string) => sendCommand({ type: 'layout-rename', id, name }),
  remove: (id: string) => sendCommand({ type: 'layout-delete', id }),
  move: (id: string, step: -1 | 1) => sendCommand({ type: 'layout-move', id, step }),
  exportOne: (id: string) => {
    layoutNotice.value = null
    sendCommand({ type: 'layout-export', id })
  },
  importOne: () => {
    layoutNotice.value = null
    sendCommand({ type: 'layout-import' })
  },
  link: (car: CarRef, layoutId: string | null) =>
    sendCommand({ type: 'layout-link-car', car: { ...car }, layoutId })
}
