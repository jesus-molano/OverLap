import { computed, type ComputedRef } from 'vue'
import { DEFAULT_SETTINGS } from '@shared/settings'
import {
  SHORTCUT_ACTIONS,
  sameList,
  shortcutBindings,
  type ShortcutBindings
} from '@shared/shortcuts'
import { shallowEqual } from '../view/reuse'
import { overlayState, useOverlayState } from './useOverlay'

/**
 * Every binding of each action (settings.shortcuts and settings.shortcutsMore), keeping its
 * previous object while they are equal (settings are replaced whole on every change, bounds
 * too). Module-level: one per window.
 */
const shortcuts: ComputedRef<ShortcutBindings> = computed((prev) => {
  const s = overlayState.settings.value ?? DEFAULT_SETTINGS
  const next = shortcutBindings(s.shortcuts, s.shortcutsMore)
  const same = prev !== undefined && SHORTCUT_ACTIONS.every((a) => sameList(prev[a], next[a]))
  return same ? prev : next
})

/**
 * The configured global shortcuts: each action's bindings, the first one first (defaults until
 * the initial state arrives).
 */
export function useShortcuts(): ComputedRef<ShortcutBindings> {
  useOverlayState()
  return shortcuts
}

const NO_NAMES: Readonly<Record<string, string>> = Object.freeze({})

/** settings.buttonDeviceNames, kept while equal: the names of the controllers shortcuts use. */
const deviceNames: ComputedRef<Readonly<Record<string, string>>> = computed((prev) => {
  const next = overlayState.settings.value?.buttonDeviceNames ?? NO_NAMES
  return prev !== undefined && shallowEqual(prev, next) ? prev : next
})

/** The names of the controllers whose buttons are shortcuts (id -> name). */
export function useDeviceNames(): ComputedRef<Readonly<Record<string, string>>> {
  useOverlayState()
  return deviceNames
}
