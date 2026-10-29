import {
  computed,
  inject,
  provide,
  shallowRef,
  type ComputedRef,
  type InjectionKey,
  type ShallowRef
} from 'vue'
import type { SettingsWindowOptions } from '@shared/types'

export type PreviewFold = SettingsWindowOptions['previewFold']

/** Options scrolled past this (px): the preview folds into a strip (settingsWindow 'auto'). */
export const FOLD_AT_PX = 48
/** Back to the top this close (px): it unfolds again. */
export const UNFOLD_AT_PX = 8
/** Only folded while the options would still scroll this much more (share of the window). */
export const FOLD_ROOM_SHARE = 0.4

/**
 * Whether the preview of a page is folded into a strip now (R14), from its scroller: past
 * FOLD_AT_PX folded, back under UNFOLD_AT_PX unfolded, in between as it was (no flicker). It
 * folds only while the options would still scroll FOLD_ROOM_SHARE of the window after the strip
 * gives its room back, so folding never brings the options back to the top (which would unfold
 * it again). Pure.
 */
export function scrolledFold(
  was: boolean,
  scroll: { top: number; height: number; client: number },
  windowHeight: number
): boolean {
  if (scroll.top < UNFOLD_AT_PX) return false
  if (was) return true
  const room = scroll.height - scroll.client
  return scroll.top > FOLD_AT_PX && room > FOLD_ROOM_SHARE * windowHeight
}

/** The preview's fold for the mode chosen (settingsWindow.previewFold) and the scroll. Pure. */
export function foldedFor(mode: PreviewFold, scrolled: boolean): boolean {
  if (mode === 'pinned') return false
  return mode === 'small' || scrolled
}

export interface PreviewFoldState {
  /** The preview is a strip now. */
  readonly folded: ComputedRef<boolean>
  /** Back to the whole preview: the options scrolled to the top (and 'small' to 'auto'). */
  unfold(): void
}

const FOLD: InjectionKey<PreviewFoldState> = Symbol('preview-fold')

/** PageFrame: the fold of its page's preview, from its scroller and the chosen mode. */
export function providePreviewFold(
  mode: () => PreviewFold,
  setMode: (m: PreviewFold) => void,
  scrollToTop: () => void
): { scrolled: ShallowRef<boolean> } {
  const scrolled = shallowRef(false)
  const folded = computed(() => foldedFor(mode(), scrolled.value))
  provide(FOLD, {
    folded,
    unfold() {
      if (mode() === 'small') setMode('auto')
      scrolled.value = false
      scrollToTop()
    }
  })
  return { scrolled }
}

/** The fold of the page's preview; outside a PageFrame never folded. */
export function injectPreviewFold(): PreviewFoldState {
  return inject(FOLD, {
    folded: computed(() => false),
    unfold: () => undefined
  })
}
