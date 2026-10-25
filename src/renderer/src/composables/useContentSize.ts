/**
 * Auto-height widgets (ux §3.2) tell main the height their content wants; main fits the window
 * to it (growing at once, shrinking after a pause, clamped to the work area).
 *
 * Contract: the measured element must not depend on the window height (no `cqh`, no
 * `height: 100%`, no font from the viewport height). Its height then depends on the content
 * and the width only, so a granted height can never feed back into the next report.
 */
import { onScopeDispose, watch, type Ref, type WatchSource } from 'vue'
import { createContentSizeReporter } from '../view/contentSize'
import { useElementSize, type MaybeElement } from './useElementSize'
import { injectSampleHost } from './widgetContext'

export interface ContentSizeOptions {
  /**
   * Report only while true (auto-height on and the content shown): a hidden widget keeps its
   * last height. Turning it on re-sends the current height. Defaults to always.
   */
  enabled?: WatchSource<boolean>
  /** Added to every height (px), e.g. chrome outside the measured element. */
  extraPx?: number
}

/**
 * Shared by both helpers: report `height()` whenever it or `enabled` changes, to main or, for a
 * settings sample, to its box.
 */
function reportHeight(height: WatchSource<number | null>, o: ContentSizeOptions): void {
  const sample = injectSampleHost()
  const reporter = createContentSizeReporter((msg) =>
    sample !== null ? sample.reportHeight(msg.height) : window.overlay.contentSize(msg)
  )
  const extra = o.extraPx ?? 0
  const enabled = o.enabled ?? ((): boolean => true)
  const stop = watch(
    [height, enabled],
    ([h, on], prev) => {
      if (!on) return
      // Just enabled (or first run): main may have a different height by now.
      if (prev === undefined || !prev[1]) reporter.reset()
      if (h !== null) reporter.report(h + extra)
    },
    { immediate: true, flush: 'post' }
  )
  onScopeDispose(stop)
}

/** Measures an element (border box) and reports its height. */
export function useContentSize(
  target: Readonly<Ref<MaybeElement>>,
  o: ContentSizeOptions = {}
): void {
  const size = useElementSize(target, { box: 'border-box' })
  reportHeight(() => (size.value.h > 0 ? size.value.h : null), o)
}

/** Reports a height computed from a pure layout (e.g. lines x row height + chrome). */
export function useContentHeight(
  heightPx: WatchSource<number | null>,
  o: ContentSizeOptions = {}
): void {
  reportHeight(heightPx, o)
}

/**
 * Resolves on the next window resize or after `timeoutMs`, whichever comes first: lets a widget
 * report a new height and wait for the window before fading in (ux §3.2 step 4).
 */
export function waitForWindowResize(timeoutMs = 50): Promise<void> {
  return new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer)
      window.removeEventListener('resize', done)
      resolve()
    }
    const timer = setTimeout(done, timeoutMs)
    window.addEventListener('resize', done)
  })
}
