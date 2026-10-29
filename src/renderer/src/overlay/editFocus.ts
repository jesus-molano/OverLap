import { shallowRef, type ShallowRef } from 'vue'
import type { WidgetId } from '@shared/widgets'

/** The widget edit mode was entered for, and a count that makes each request a new one. */
export interface EditFocus {
  widget: WidgetId
  n: number
}

const focus = shallowRef<EditFocus | null>(null)
let started = false
let count = 0

/**
 * «Editar posición» on a widget's page (R25): main enters edit mode and names the widget; its
 * panel is pointed out for a moment (EditFrame). Listened to once per window.
 */
export function useEditFocus(): Readonly<ShallowRef<EditFocus | null>> {
  if (!started) {
    started = true
    window.overlay.onEditFocus((widget) => {
      count++
      focus.value = { widget, n: count }
    })
  }
  return focus
}
