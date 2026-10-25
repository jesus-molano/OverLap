import { computed, type ComputedRef } from 'vue'
import { DEFAULT_SETTINGS } from '@shared/settings'
import type { ShortcutSettings } from '@shared/shortcuts'
import { shallowEqual } from '../view/reuse'
import { overlayState, useOverlayState } from './useOverlay'

/**
 * settings.shortcuts, keeping its previous object while the combinations are equal (settings
 * are replaced whole on every change, bounds too). Module-level: one per window.
 */
const shortcuts: ComputedRef<ShortcutSettings> = computed((prev) => {
  const next = overlayState.settings.value?.shortcuts ?? DEFAULT_SETTINGS.shortcuts
  return prev !== undefined && shallowEqual(prev, next) ? prev : next
})

/** The configured global shortcuts (defaults until the initial state arrives). */
export function useShortcuts(): ComputedRef<ShortcutSettings> {
  useOverlayState()
  return shortcuts
}
