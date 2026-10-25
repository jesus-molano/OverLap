import {
  inject,
  onScopeDispose,
  provide,
  shallowRef,
  watch,
  type InjectionKey,
  type Ref
} from 'vue'
import type { DragStateMessage } from '@shared/ipc'
import { useOverlayState } from '../composables/useOverlay'
import type { SlotRegistry } from './contract'
import { createDragLease, type LeaseTimers } from './dragLease'

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
}

export interface EditSessionDeps {
  readonly registry: SlotRegistry
  readonly editing: Readonly<Ref<boolean>>
  session(): number
  sendDragState(msg: DragStateMessage): void
  readonly timers?: LeaseTimers
}

export interface EditSessionHandle extends EditSession {
  /** Cancels the drag in progress, ends the lease and stops watching. */
  dispose(): void
}

/**
 * The session of one overlay window: one drag at a time and the drag lease that keeps main's
 * mouse on the window while it runs. Turning edit mode off, or losing the display, cancels the
 * drag (approved behaviour: Escape, the edit-mode and show / hide shortcuts and the tray
 * cancel a drag in progress).
 */
export function createEditSession(deps: EditSessionDeps): EditSessionHandle {
  const lease = createDragLease({
    send: (dragging) => deps.sendDragState({ session: deps.session(), dragging }),
    timers: deps.timers
  })
  const dragging = shallowRef(false)
  let owner: DragOwner | null = null
  let disposed = false

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
    dispose(): void {
      if (disposed) return
      cancelDrag()
      disposed = true
      for (const stop of stops) stop()
      lease.dispose()
    }
  }
}

const EDIT_SESSION: InjectionKey<EditSession> = Symbol('overlay-edit-session')

/**
 * Edit-mode session of an overlay window: one drag at a time, the drag lease sent to main
 * and the state the panels' interactions share. Called once from OverlayApp's setup;
 * everything it installs is removed with that scope.
 */
export function useEditSession(registry: SlotRegistry): void {
  const state = useOverlayState()
  const session = createEditSession({
    registry,
    editing: state.editMode,
    session: () => state.layout.value?.session ?? 0,
    sendDragState: (msg) => window.overlay.dragState(msg)
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
