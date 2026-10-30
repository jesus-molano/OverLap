import { computed, type ComputedRef } from 'vue'
import { WIDGET_DEFS, type WidgetId } from '@shared/widgets'
import { useI18n } from '../../composables/useI18n'
import { useOverlayState } from '../../composables/useOverlay'
import type { PreviewNoteSpec } from '../controls/previewNote'
import { injectPreviewEdit } from './usePreviewEdit'

/** A note's words from the widget's window size (px). */
export type NoRoomWords = (w: number, h: number) => string

/**
 * The «No cabe» note of a list row or a choice (PreviewNote) when the page's sample reports no
 * room for its `data-el` ('standings.columns.tyre', 'battle.layout.side'), at the widget's window
 * width; undefined while it fits, or off a widget page. `detail` words what it means there (by
 * default «ensancha el widget u oculta otro dato»), `text` the note itself (by default «No cabe a
 * 540 px»).
 *
 *   const noRoom = useNoRoom()
 *   <ChoiceControl … :note="noRoom('battle.layout.side', t.settings.preview.noRoomSide)" />
 */
export function useNoRoom(): ComputedRef<
  (el: string | null, detail?: NoRoomWords, text?: NoRoomWords) => PreviewNoteSpec | undefined
> {
  const edit = injectPreviewEdit()
  const t = useI18n()
  const { settings } = useOverlayState()
  const id = edit !== null && edit.section in WIDGET_DEFS ? (edit.section as WidgetId) : null
  const size = computed(() => {
    if (id === null) return { w: 0, h: 0 }
    const b = settings.value?.widgets[id].bounds ?? WIDGET_DEFS[id].defaultBounds
    return { w: Math.round(b.width), h: Math.round(b.height) }
  })
  return computed(() => {
    const all = edit?.noRoom.value
    const p = t.value.settings.preview
    const { w, h } = size.value
    return (el, detail, text) =>
      all === undefined || el === null || !all.has(el)
        ? undefined
        : {
            kind: 'room',
            text: (text ?? p.noRoom)(w, h),
            detail: (detail ?? p.noRoomHelp)(w, h)
          }
  })
}
