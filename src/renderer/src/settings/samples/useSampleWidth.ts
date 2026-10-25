import { computed, type ComputedRef } from 'vue'
import { useOverlayState } from '../../composables/useOverlay'
import type { WidgetId } from '@shared/widgets'
import { WIDGET_DEFS } from '@shared/widgets'

/**
 * Width (px) of the widget's window, for drawing its preview at the real width. A number, so
 * dragging the widget's position (a settings broadcast per frame) re-renders nothing.
 */
export function useSampleWidth(id: WidgetId): ComputedRef<number> {
  const { settings } = useOverlayState()
  return computed(
    () => settings.value?.widgets[id].bounds.width ?? WIDGET_DEFS[id].defaultBounds.width
  )
}

/** Height (px) of the widget's window: the sample's height when the content does not set it. */
export function useSampleHeight(id: WidgetId): ComputedRef<number> {
  const { settings } = useOverlayState()
  return computed(
    () => settings.value?.widgets[id].bounds.height ?? WIDGET_DEFS[id].defaultBounds.height
  )
}

/** '460 × 252': the widget window's size, as a string so equal sizes do not re-render. */
export function useWidgetSizeText(id: WidgetId): ComputedRef<string> {
  const { settings } = useOverlayState()
  return computed(() => {
    const b = settings.value?.widgets[id].bounds ?? WIDGET_DEFS[id].defaultBounds
    return `${Math.round(b.width)} × ${Math.round(b.height)}`
  })
}
