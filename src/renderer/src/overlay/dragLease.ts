/**
 * The drag lease of an overlay window: while a drag runs, main keeps the mouse on the window
 * even when the cursor leaves the panel. The window says so at once when a drag starts, repeats
 * it every DRAG_HEARTBEAT_MS while it runs (main drops the lease when a repeat is DRAG_LEASE_MS
 * late: a hung renderer) and says when it ends. Nothing is sent while no drag runs.
 */
import { DRAG_HEARTBEAT_MS } from '@shared/ipc'

/** Interval timers (injected in tests). */
export interface LeaseTimers {
  setInterval(cb: () => void, ms: number): unknown
  clearInterval(handle: unknown): void
}

const GLOBAL_TIMERS: LeaseTimers = {
  setInterval: (cb, ms) => setInterval(cb, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>)
}

export interface DragLeaseOptions {
  /** Tells main whether a drag runs (`DragStateMessage.dragging`). */
  send(dragging: boolean): void
  timers?: LeaseTimers
}

export interface DragLease {
  readonly dragging: boolean
  /** Starts (sends true, then the heartbeat) or ends (sends false) the lease; repeats are no-ops. */
  setDragging(on: boolean): void
  /** Ends the lease if it runs and stops for good. */
  dispose(): void
}

export function createDragLease({ send, timers = GLOBAL_TIMERS }: DragLeaseOptions): DragLease {
  let dragging = false
  let disposed = false
  let heartbeat: unknown = null

  function stopHeartbeat(): void {
    if (heartbeat === null) return
    timers.clearInterval(heartbeat)
    heartbeat = null
  }

  function setDragging(on: boolean): void {
    if (disposed || on === dragging) return
    dragging = on
    stopHeartbeat()
    send(on)
    if (on) heartbeat = timers.setInterval(() => send(true), DRAG_HEARTBEAT_MS)
  }

  return {
    get dragging(): boolean {
      return dragging
    },
    setDragging,
    dispose(): void {
      setDragging(false)
      disposed = true
    }
  }
}
