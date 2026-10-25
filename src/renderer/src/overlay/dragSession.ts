/**
 * One edit-mode drag (a move or a resize) of a panel, on pointer capture of the element that got
 * the pointerdown. Pointer moves are only stored; the panel is redrawn at most once per frame.
 * The drag ends on pointerup, pointercancel, lost capture, or any move with the primary button
 * already up (a pointerup that never arrived, e.g. released on another display), and is then
 * committed; a cancel puts the panel back and sends nothing.
 *
 * Order matters: on end the commit (or drop) goes out before the listeners are removed, the
 * capture is released and `onDone` runs (which ends the drag lease, so main hit-tests the new
 * rect); on cancel the listeners go first, so releasing the capture cannot commit it.
 */
import { rectsEqual } from '@shared/settings'
import type { Point, Rect } from '@shared/types'
import type { SlotHandle } from './contract'
import { dragRect, grabOffset, isOutside, type DragContext, type DragMode } from './dragMath'
import type { Frames } from './timers'

/** The fields of a pointer event a drag reads. */
export interface DragPointer {
  readonly type: string
  readonly pointerId: number
  readonly clientX: number
  readonly clientY: number
  readonly buttons: number
  readonly altKey: boolean
  readonly shiftKey: boolean
}

export type DragEventType = 'pointermove' | 'pointerup' | 'pointercancel' | 'lostpointercapture'

/** The element that got the pointerdown (an HTMLElement in the app). */
export interface DragElement {
  setPointerCapture(pointerId: number): void
  releasePointerCapture(pointerId: number): void
  hasPointerCapture(pointerId: number): boolean
  addEventListener(type: DragEventType, listener: (e: DragPointer) => void): void
  removeEventListener(type: DragEventType, listener: (e: DragPointer) => void): void
}

/** What a drag drives on its panel. */
export type DragSlot = Pick<SlotHandle, 'setDragRect' | 'commit' | 'dropOutside'>

export interface DragSessionOptions {
  readonly el: DragElement
  /** The pointerdown that starts it. */
  readonly down: DragPointer
  readonly mode: DragMode
  /** The panel as drawn at the pointerdown. */
  readonly start: Rect
  readonly ctx: DragContext
  readonly slot: DragSlot
  /** requestAnimationFrame (ANIMATION_FRAMES in the app). */
  readonly frames: Frames
  /** During a move the pointer left the display (true) or came back (false); false at the end. */
  onCrossing(crossing: boolean): void
  /** Runs once, last, when the drag ended or was cancelled. */
  onDone(): void
}

const EVENTS: readonly DragEventType[] = [
  'pointermove',
  'pointerup',
  'pointercancel',
  'lostpointercapture'
]

export class DragSession {
  private readonly o: DragSessionOptions
  private readonly pointerId: number
  private readonly p0: Point
  private x: number
  private y: number
  /** Alt (or Shift) held: no snapping. */
  private noSnap: boolean
  /** Last rect drawn; null while it is still `start`. */
  private rect: Rect | null = null
  private crossing = false
  private raf = 0
  private started = false
  private finished = false

  constructor(options: DragSessionOptions) {
    this.o = options
    const { down } = options
    this.pointerId = down.pointerId
    this.p0 = { x: down.clientX, y: down.clientY }
    this.x = down.clientX
    this.y = down.clientY
    // Shift as well: the window never has keyboard focus, and Windows can report Alt late to it.
    this.noSnap = down.altKey || down.shiftKey
  }

  /** The drag runs (started, not yet ended or cancelled). */
  get active(): boolean {
    return this.started && !this.finished
  }

  /** Takes the pointer. A pointer that cannot be captured (already up) cancels at once. */
  start(): void {
    if (this.started) return
    this.started = true
    try {
      this.o.el.setPointerCapture(this.pointerId)
    } catch {
      this.cancel()
      return
    }
    for (const type of EVENTS) this.o.el.addEventListener(type, this.onEvent)
  }

  /** Ends the drag and keeps the result (commit, drop on another display, or nothing moved). */
  end(): void {
    if (!this.active) return
    this.finished = true
    this.cancelFrame()
    this.step()
    const { slot, start } = this.o
    if (this.crossing) slot.dropOutside(grabOffset(this.p0, start))
    else if (rectsEqual(this.rect ?? start, start)) slot.setDragRect(null)
    else slot.commit('drag')
    this.removeListeners()
    this.releaseCapture()
    this.finish()
  }

  /** Puts the panel back where it was; nothing is sent to main. */
  cancel(): void {
    if (!this.active) return
    this.finished = true
    this.cancelFrame()
    this.removeListeners()
    this.o.slot.setDragRect(null)
    this.releaseCapture()
    this.finish()
  }

  private readonly onEvent = (e: DragPointer): void => {
    if (!this.active || e.pointerId !== this.pointerId) return
    if (e.type === 'pointermove') {
      // The primary button is up: its pointerup was lost. End where the pointer was last seen.
      if ((e.buttons & 1) === 0) {
        this.end()
        return
      }
      this.track(e)
      if (this.raf === 0) this.raf = this.o.frames.request(this.onFrame)
      return
    }
    if (e.type === 'pointerup') this.track(e)
    this.end()
  }

  private readonly onFrame = (): void => {
    this.raf = 0
    if (this.active) this.step()
  }

  private track(e: DragPointer): void {
    this.x = e.clientX
    this.y = e.clientY
    this.noSnap = e.altKey || e.shiftKey
  }

  /** Draws the panel for the last pointer position (only when that changes it). */
  private step(): void {
    const { start, mode, ctx, slot } = this.o
    const dx = Math.round(this.x - this.p0.x)
    const dy = Math.round(this.y - this.p0.y)
    const r = dragRect(start, mode, dx, dy, ctx, this.noSnap)
    if (!rectsEqual(r, this.rect ?? start)) {
      this.rect = r
      slot.setDragRect(r)
    }
    this.setCrossing(mode === 'move' && isOutside(this.x, this.y, ctx.display))
  }

  private setCrossing(on: boolean): void {
    if (on === this.crossing) return
    this.crossing = on
    this.o.onCrossing(on)
  }

  private cancelFrame(): void {
    if (this.raf === 0) return
    this.o.frames.cancel(this.raf)
    this.raf = 0
  }

  private removeListeners(): void {
    for (const type of EVENTS) this.o.el.removeEventListener(type, this.onEvent)
  }

  private releaseCapture(): void {
    try {
      if (this.o.el.hasPointerCapture(this.pointerId)) {
        this.o.el.releasePointerCapture(this.pointerId)
      }
    } catch {
      // Detached element or pointer gone: nothing is captured any more.
    }
  }

  private finish(): void {
    this.setCrossing(false)
    this.o.onDone()
  }
}
