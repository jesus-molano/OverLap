/**
 * The edit-mode interactions of one panel (EditFrame's logic, kept out of the SFC so it can be
 * tested): drags on pointerdown, the mouse wheel, and cancelling a drag when the panel gets
 * locked, main moves it on its own (`placement`) or the frame goes away.
 */
import { computed, shallowRef, watch, type ComputedRef, type Ref } from 'vue'
import type { ScaleStepMessage } from '@shared/ipc'
import { scaleAroundCentre } from '@shared/panelGeometry'
import { rectsEqual } from '@shared/settings'
import type { Rect, Size } from '@shared/types'
import type { SlotHandle } from './contract'
import { canStart, type DragMode } from './dragMath'
import { DragSession, type DragElement, type DragPointer } from './dragSession'
import type { Frames } from './timers'
import type { DragOwner, EditSession } from './useEditSession'
import { createWheelGate, wheelDirection } from './wheelStep'

/** The pointerdown fields read here (a PointerEvent in the app). */
export interface PointerDownLike extends DragPointer {
  readonly button: number
  readonly isPrimary: boolean
  preventDefault(): void
}

/** The wheel event fields read here (a WheelEvent in the app). */
export interface WheelLike {
  readonly deltaY: number
  readonly timeStamp: number
  readonly ctrlKey: boolean
  preventDefault(): void
}

export interface PanelEditDeps {
  readonly slot: SlotHandle
  readonly session: EditSession
  readonly minSize: Size
  /** WIDGET_DEFS[id].sizeModel: the wheel scales auto-height widgets and resizes free ones. */
  readonly sizeModel: 'auto-height' | 'free'
  sendScaleStep(msg: ScaleStepMessage): void
  /** requestAnimationFrame (ANIMATION_FRAMES in the app). */
  readonly frames: Frames
}

export interface PanelEdit {
  /** Edit mode is on and the panel is not locked. */
  readonly editable: ComputedRef<boolean>
  /** A drag of this panel runs. */
  readonly dragging: Readonly<Ref<boolean>>
  /** During a move of this panel the pointer is off the display: releasing drops it there. */
  readonly crossing: Readonly<Ref<boolean>>
  /** Starts a drag in `mode` on `el` (the element the listener is on). True when it started. */
  pointerDown(e: PointerDownLike, el: DragElement, mode: DragMode): boolean
  wheel(e: WheelLike): void
  /** Cancels this panel's drag, if any. */
  cancel(): void
  /** Cancels the drag and stops watching. */
  dispose(): void
}

export function createPanelEdit(deps: PanelEditDeps): PanelEdit {
  const { slot, session } = deps
  const editable = computed(() => session.editing.value && !slot.locked.value)
  const dragging = shallowRef(false)
  const crossing = shallowRef(false)
  const gate = createWheelGate()
  let drag: DragSession | null = null
  let disposed = false
  const owner: DragOwner = { cancel: () => drag?.cancel() }

  /** The other shown panels, as drawn now (snap targets, read once per drag). */
  function targets(): Rect[] {
    const out: Rect[] = []
    for (const s of session.registry.slots.value) {
      if (s.id !== slot.id && s.shown.value) out.push(s.rect.value)
    }
    return out
  }

  function pointerDown(e: PointerDownLike, el: DragElement, mode: DragMode): boolean {
    if (disposed || drag !== null || !editable.value || e.button !== 0 || !e.isPrimary) {
      return false
    }
    const display = session.registry.display.value
    if (display === null || !canStart(mode, slot.autoHeight.value)) return false
    if (!session.beginDrag(owner)) return false
    e.preventDefault()
    const d: DragSession = new DragSession({
      el,
      down: e,
      mode,
      start: slot.rect.value,
      ctx: {
        minSize: deps.minSize,
        display: display.bounds,
        workArea: display.workArea,
        targets: targets()
      },
      slot,
      frames: deps.frames,
      onCrossing: (on) => (crossing.value = on),
      onDone: () => {
        if (drag !== d) return
        drag = null
        dragging.value = false
        session.endDrag(owner)
      }
    })
    drag = d
    dragging.value = true
    d.start()
    return d.active
  }

  function wheel(e: WheelLike): void {
    // Never zoom: one CSS px must stay one DIP (drags and main's hit test rely on it).
    if (e.ctrlKey) e.preventDefault()
    if (disposed || !editable.value || session.dragging.value) return
    const step = wheelDirection(e.deltaY)
    if (step === null) return
    e.preventDefault()
    if (!gate.accept(e.timeStamp)) return
    if (deps.sizeModel === 'auto-height') {
      deps.sendScaleStep({ session: session.session(), widget: slot.id, step })
      return
    }
    const display = session.registry.display.value
    if (display === null) return
    const now = slot.rect.value
    const next = scaleAroundCentre(now, step, deps.minSize, display.bounds)
    if (rectsEqual(next, now)) return
    slot.setDragRect(next)
    slot.commit('wheel')
  }

  function cancel(): void {
    drag?.cancel()
  }

  const stops = [
    watch(slot.locked, (locked) => {
      if (locked) cancel()
    }),
    watch(slot.placement, () => cancel())
  ]

  return {
    editable,
    dragging,
    crossing,
    pointerDown,
    wheel,
    cancel,
    dispose(): void {
      if (disposed) return
      cancel()
      disposed = true
      for (const stop of stops) stop()
    }
  }
}
