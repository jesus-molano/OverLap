import { computed, watch, type ComputedRef, type WatchStopHandle } from 'vue'
import { DEFAULT_SETTINGS } from '@shared/settings'
import type { AppearanceSettings } from '@shared/types'
import { applyAppearance, type AppearanceRoot } from '../view/appearance'
import { shallowEqual } from '../view/reuse'
import { overlayState, useOverlayState } from './useOverlay'

/**
 * settings.appearance, keeping its previous object while the values are equal: settings are
 * replaced whole on every change (bounds too, while dragging), and nothing that reads the
 * appearance should run for those. Module-level: one per window, for its whole life.
 */
const appearance: ComputedRef<AppearanceSettings> = computed((prev) => {
  const next = overlayState.settings.value?.appearance ?? DEFAULT_SETTINGS.appearance
  return prev !== undefined && shallowEqual(prev, next) ? prev : next
})

/** The global appearance (defaults until the initial state arrives). */
export function useAppearance(): ComputedRef<AppearanceSettings> {
  useOverlayState()
  return appearance
}

/**
 * Applies the appearance to the document root now and whenever it changes (main.ts, once per
 * window). Writes only what changed. The watcher lives as long as the window.
 */
export function startAppearance(root: AppearanceRoot): WatchStopHandle {
  useOverlayState()
  let applied: AppearanceSettings | null = null
  return watch(
    appearance,
    (a) => {
      applyAppearance(root, a, applied)
      applied = a
    },
    { immediate: true }
  )
}
