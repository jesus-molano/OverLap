import { onScopeDispose, shallowRef, watch, type ShallowRef } from 'vue'
import { waitForWindowResize } from './useContentSize'

export interface RevealOptions {
  /** Whether main fits the window to the content (auto height on). */
  fit: () => boolean
  /** Longest wait for the window to follow (ms). */
  timeoutMs?: number
}

/**
 * Fade-in gate of an auto-height widget (ux §3.2 step 4). A hidden widget keeps its window
 * height; when it fades in with another layout (`layoutKey`: lane count, arrangement, rows),
 * the new height is reported first, and the panel waits for the window's resize (or the
 * timeout) before showing, so it never fades in clipped or over an empty band. Hiding is
 * immediate. Nothing is pending once the scope is disposed.
 */
export function useReveal(
  want: () => boolean,
  layoutKey: () => string,
  o: RevealOptions
): Readonly<ShallowRef<boolean>> {
  const shown = shallowRef(false)
  /** Layout of the last time the panel was shown (null: never shown in this window). */
  let shownKey: string | null = null
  /** Bumped by every change: a wait that finds another value was overtaken. */
  let generation = 0

  // 'post': the new lanes are in the DOM, so their height is already on its way to main.
  const stop = watch(
    [want, layoutKey],
    async ([on, key]) => {
      const gen = ++generation
      if (!on) {
        shown.value = false
        return
      }
      if (shown.value) {
        shownKey = key
        return
      }
      if (o.fit() && key !== shownKey) await waitForWindowResize(o.timeoutMs ?? 50)
      if (gen !== generation) return
      shownKey = key
      shown.value = true
    },
    { immediate: true, flush: 'post' }
  )

  onScopeDispose(() => {
    stop()
    generation++
  })
  return shown
}
