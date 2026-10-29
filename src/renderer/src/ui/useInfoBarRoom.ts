import { computed, shallowRef, watch, type ComputedRef, type Ref, type ShallowRef } from 'vue'
import type { InfoBarSize, InfoItemId } from '@shared/types'
import { useElementSize } from '../composables/useElementSize'

export interface InfoBarRoom {
  /** Room for the items, in em of the bar's own text (0 until measured). */
  readonly widthEm: ComputedRef<number>
  /** Items dropped beyond the estimates because the drawn bar overflowed (InfoBar adds them). */
  readonly extra: ShallowRef<number>
}

/**
 * An info bar's room for its items, in em of its own text. The font is read again after every
 * drawing that can change it: a new size choice (Pequeña / Normal / Grande, drawn as
 * `--ib-scale`), and a resize of the bar, which also catches a new widget or text scale (the
 * bar's height is in em of its font). Read after the DOM is patched, so never the old size's
 * font. `extra` starts again at 0 whenever the items, the room or the size change.
 */
export function useInfoBarRoom(
  root: Readonly<Ref<HTMLElement | null>>,
  size: () => Exclude<InfoBarSize, 'off'>,
  ids: Readonly<Ref<readonly InfoItemId[]>>
): InfoBarRoom {
  const box = useElementSize(root)

  const fontPx = shallowRef(0)
  watch(
    [root, () => box.value.w, () => box.value.h, size],
    () => {
      const el = root.value
      fontPx.value =
        el === null || typeof getComputedStyle !== 'function'
          ? 0
          : parseFloat(getComputedStyle(el).fontSize) || 0
    },
    { immediate: true, flush: 'post' }
  )

  const widthEm = computed(() => (fontPx.value > 0 ? box.value.w / fontPx.value : 0))

  const extra = shallowRef(0)
  watch([ids, widthEm, size], () => {
    extra.value = 0
  })

  return { widthEm, extra }
}
