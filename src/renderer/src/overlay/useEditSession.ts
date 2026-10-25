import {
  inject,
  onScopeDispose,
  provide,
  shallowRef,
  watch,
  type InjectionKey,
  type Ref
} from 'vue'
import type { DragStateMessage, EditChip, EditChipsMessage } from '@shared/ipc'
import { rectsEqual } from '@shared/settings'
import type { Rect } from '@shared/types'
import { PAINT_ORDER, type WidgetId } from '@shared/widgets'
import { useOverlayState } from '../composables/useOverlay'
import type { SlotRegistry } from './contract'
import { createDragLease, type LeaseTimers } from './dragLease'
import { ANIMATION_FRAMES, type Frames } from './timers'

/** A drag in progress, as the session sees it. */
export interface DragOwner {
  /** Puts the panel back and ends the drag (calling `EditSession.endDrag`). */
  cancel(): void
}

/** The edit-mode state the panels of one overlay window share. */
export interface EditSession {
  readonly registry: SlotRegistry
  /** Edit mode is on. */
  readonly editing: Readonly<Ref<boolean>>
  /** A drag runs in this window (one at a time, whichever panel). */
  readonly dragging: Readonly<Ref<boolean>>
  /** This document's `OverlayLayout.session`, echoed by every message to main (0: none yet). */
  session(): number
  /** Starts `owner`'s drag and the drag lease; false while editing is off or another drag runs. */
  beginDrag(owner: DragOwner): boolean
  /** Ends `owner`'s drag and the lease (after its commit was sent); ignored for any other owner. */
  endDrag(owner: DragOwner): void
  /** Cancels the drag in progress, if any. */
  cancelDrag(): void
  /**
   * Where a panel's edit chip is, relative to the panel's top-left (px), or null once it has
   * none. Main takes the mouse over the chips (their buttons work on locked panels and ghosts);
   * the window sends them all, once per frame at most, whenever one changes.
   */
  reportChip(id: WidgetId, rect: Rect | null): void
}

export interface EditSessionDeps {
  readonly registry: SlotRegistry
  readonly editing: Readonly<Ref<boolean>>
  session(): number
  sendDragState(msg: DragStateMessage): void
  /** IPC.editChips; chips are not reported without it. */
  sendChips?(msg: EditChipsMessage): void
  /** When the chips go out (ANIMATION_FRAMES by default). */
  readonly frames?: Frames
  readonly timers?: LeaseTimers
}

export interface EditSessionHandle extends EditSession {
  /** Cancels the drag in progress, ends the lease and stops watching. */
  dispose(): void
}

/**
 * The session of one overlay window: one drag at a time, the drag lease that keeps main's
 * mouse on the window while it runs, and the edit chips main takes the mouse over. Turning edit
 * mode off, or losing the display, cancels the drag (approved behaviour: Escape, the edit-mode
 * and show / hide shortcuts and the tray cancel a drag in progress).
 */
export function createEditSession(deps: EditSessionDeps): EditSessionHandle {
  const lease = createDragLease({
    send: (dragging) => deps.sendDragState({ session: deps.session(), dragging }),
    timers: deps.timers
  })
  const frames = deps.frames ?? ANIMATION_FRAMES
  const dragging = shallowRef(false)
  let owner: DragOwner | null = null
  let disposed = false

  // ---- Edit chips --------------------------------------------------------

  const chips = new Map<WidgetId, Rect>()
  let chipFrame = 0

  function sendChips(): void {
    chipFrame = 0
    if (disposed || !deps.editing.value || deps.sendChips === undefined) return
    const session = deps.session()
    // No layout yet: main would drop the message; try again on the next frame.
    if (session === 0) {
      chipFrame = frames.request(sendChips)
      return
    }
    const list: EditChip[] = []
    for (const id of PAINT_ORDER) {
      const rect = chips.get(id)
      if (rect !== undefined) list.push({ widget: id, rect: { ...rect } })
    }
    deps.sendChips({ session, chips: list })
  }

  function reportChip(id: WidgetId, rect: Rect | null): void {
    if (disposed) return
    const prev = chips.get(id)
    if (rect === null ? prev === undefined : prev !== undefined && rectsEqual(prev, rect)) return
    if (rect === null) chips.delete(id)
    else chips.set(id, { x: rect.x, y: rect.y, width: rect.width, height: rect.height })
    if (chipFrame === 0 && deps.sendChips !== undefined) chipFrame = frames.request(sendChips)
  }

  function cancelChipFrame(): void {
    if (chipFrame !== 0) frames.cancel(chipFrame)
    chipFrame = 0
  }

  // ---- Drags -------------------------------------------------------------

  function endDrag(o: DragOwner): void {
    if (owner !== o) return
    owner = null
    dragging.value = false
    lease.setDragging(false)
  }

  function cancelDrag(): void {
    const o = owner
    if (o === null) return
    o.cancel()
    // An owner that did not end itself: end it here, so the lease never outlives the drag.
    endDrag(o)
  }

  const stops = [
    watch(deps.editing, (on) => {
      if (!on) cancelDrag()
    }),
    watch(deps.registry.display, (display) => {
      if (display === null) cancelDrag()
    })
  ]

  return {
    registry: deps.registry,
    editing: deps.editing,
    dragging,
    session: deps.session,
    beginDrag(o: DragOwner): boolean {
      if (disposed || !deps.editing.value || owner !== null) return false
      owner = o
      dragging.value = true
      lease.setDragging(true)
      return true
    },
    endDrag,
    cancelDrag,
    reportChip,
    dispose(): void {
      if (disposed) return
      cancelDrag()
      disposed = true
      for (const stop of stops) stop()
      lease.dispose()
      cancelChipFrame()
      chips.clear()
    }
  }
}

const EDIT_SESSION: InjectionKey<EditSession> = Symbol('overlay-edit-session')

/**
 * Edit-mode session of an overlay window: one drag at a time, the drag lease and the edit chips
 * sent to main, and the state the panels' interactions share. Called once from OverlayApp's
 * setup; everything it installs is removed with that scope.
 */
export function useEditSession(registry: SlotRegistry): void {
  const state = useOverlayState()
  const session = createEditSession({
    registry,
    editing: state.editMode,
    session: () => state.layout.value?.session ?? 0,
    sendDragState: (msg) => window.overlay.dragState(msg),
    sendChips: (msg) => window.overlay.editChips(msg)
  })
  provide(EDIT_SESSION, session)
  onScopeDispose(() => session.dispose())
}

/** The session of this window, for the panels' edit frames (setup only). Throws outside one. */
export function injectEditSession(): EditSession {
  const session = inject(EDIT_SESSION, null)
  if (session === null) throw new Error('injectEditSession(): no useEditSession() above')
  return session
}
