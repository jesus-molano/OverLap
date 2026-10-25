import { onScopeDispose, shallowRef, watch, type ShallowRef } from 'vue'
import { injectPanelHost } from './widgetContext'

export interface RevealOptions {
  /** Whether the panel fits its height to the content (auto height on). */
  fit: () => boolean
  /** Longest wait for the panel to follow (ms). */
  timeoutMs?: number
}

/** Resolves after `ms`: a settings sample's box follows a reported height on the next frame. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Fade-in gate of an auto-height widget (ux §3.2 step 4). A hidden widget keeps its panel
 * height; when it fades in with another layout (`layoutKey`: lane count, arrangement, rows),
 * the new height is reported first, and the widget waits for its panel to be fitted (or the
 * timeout) before showing, so it never fades in clipped or over an empty band. Hiding is
 * immediate. Nothing is pending once the scope is disposed.
 */
export function useReveal(
  want: () => boolean,
  layoutKey: () => string,
  o: RevealOptions
): Readonly<ShallowRef<boolean>> {
  // An overlay panel says when its fitted height is drawn; a settings sample just waits.
  const panel = injectPanelHost()
  const waitForFit = panel !== null ? (ms: number): Promise<void> => panel.waitForFit(ms) : delay
  const shown = shallowRef(false)
  /** Layout of the last time the panel was shown (null: never shown in this window). */
  let shownKey: string | null = null
  /** Bumped by every change: a wait that finds another value was overtaken. */
  let generation = 0

  // 'post': the new lanes are in the DOM, so their height is already reported.
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
      if (o.fit() && key !== shownKey) await waitForFit(o.timeoutMs ?? 50)
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
