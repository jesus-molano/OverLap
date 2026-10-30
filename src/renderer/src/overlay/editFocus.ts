import { shallowRef, type ShallowRef } from 'vue'
import type { WidgetId } from '@shared/widgets'

/** The widget edit mode was entered for, and a count that makes each request a new one. */
export interface EditFocus {
  widget: WidgetId
  n: number
}

/** How long a widget stays pointed out: the ring's three pulses (EditFrame, 3 × 700 ms). */
export const EDIT_FOCUS_MS = 2_100

/**
 * The widget pointed out by «Editar posición» (R25), for a moment only: it goes after
 * EDIT_FOCUS_MS (with reduced motion too, where the ring does not pulse) and as soon as edit
 * mode ends, so entering edit mode again later (the shortcut, the tray) points nothing out.
 */
export class EditFocusState {
  readonly focus: ShallowRef<EditFocus | null> = shallowRef(null)
  private count = 0
  private timer: ReturnType<typeof setTimeout> | undefined

  point(widget: WidgetId): void {
    this.count++
    this.focus.value = { widget, n: this.count }
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.clear(), EDIT_FOCUS_MS)
  }

  clear(): void {
    clearTimeout(this.timer)
    this.timer = undefined
    if (this.focus.value !== null) this.focus.value = null
  }
}

const state = new EditFocusState()
let started = false

/**
 * «Editar posición» on a widget's page (R25): main enters edit mode and names the widget; its
 * panel is pointed out for a moment (EditFrame). Listened to once per window.
 */
export function useEditFocus(): Readonly<ShallowRef<EditFocus | null>> {
  if (!started) {
    started = true
    window.overlay.onEditFocus((widget) => state.point(widget))
  }
  return state.focus
}

/** Edit mode ended: nothing stays pointed out for the next time. */
export function clearEditFocus(): void {
  state.clear()
}
