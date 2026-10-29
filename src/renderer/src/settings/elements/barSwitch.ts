/**
 * An info bar's switch ("Mostrar cabecera") over its size: the settings keep one field, the
 * size, 'off' for a hidden bar (files load as they always did). Switched off, the bar's size
 * becomes 'off'; switched on, it gets back the last size it had while shown (remembered per
 * bar in this window, and kept in the window's local storage when it can be), else 'normal'.
 * Pure apart from that memory.
 */
import { INFO_BAR_SIZES } from '@shared/infoBar'
import type { InfoBarSize } from '@shared/types'

export type ShownSize = Exclude<InfoBarSize, 'off'>

/** The sizes of a shown bar, in UI order (the switch replaces 'off'). */
export const SHOWN_SIZES: readonly ShownSize[] = INFO_BAR_SIZES.filter(
  (s): s is ShownSize => s !== 'off'
)

export const DEFAULT_SHOWN_SIZE: ShownSize = 'normal'

export function isShownSize(v: unknown): v is ShownSize {
  return (SHOWN_SIZES as readonly unknown[]).includes(v)
}

/** The size the switch gives back: `last` when it is a shown size, else 'normal'. */
export function sizeWhenShown(last: unknown): ShownSize {
  return isShownSize(last) ? last : DEFAULT_SHOWN_SIZE
}

/** The size a switch change stores: 'off', or the size to come back to. */
export function sizeForSwitch(on: boolean, last: unknown): InfoBarSize {
  return on ? sizeWhenShown(last) : 'off'
}

const STORAGE_KEY = 'overlap.settings.barSizes'
const remembered = new Map<string, ShownSize>()
let loaded = false

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function load(): void {
  if (loaded) return
  loaded = true
  try {
    const raw: unknown = JSON.parse(storage()?.getItem(STORAGE_KEY) ?? '{}')
    if (typeof raw !== 'object' || raw === null) return
    for (const [key, size] of Object.entries(raw)) {
      if (isShownSize(size)) remembered.set(key, size)
    }
  } catch {
    // Nothing remembered: 'normal'.
  }
}

/** The last shown size of the bar `key` ('section.field'), if any. */
export function lastShownSize(key: string): ShownSize | undefined {
  load()
  return remembered.get(key)
}

/** Remembers `size` for the bar `key` when it is a shown size. */
export function rememberShownSize(key: string, size: InfoBarSize): void {
  if (!isShownSize(size)) return
  load()
  if (remembered.get(key) === size) return
  remembered.set(key, size)
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(remembered)))
  } catch {
    // Remembered in this window only.
  }
}
