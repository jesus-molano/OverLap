/**
 * Test doubles for the edit layer in the node environment: a pointer-capturing element, a
 * requestAnimationFrame queue and a panel slot that behaves like the overlay host's (draws the
 * drag rect, keeps a committed rect until acknowledged). Every call lands in one shared log, so
 * tests can check the order of what happens.
 */
import { computed, shallowRef, type ShallowRef } from 'vue'
import type { AutoHiddenState, OverlayDisplay } from '@shared/ipc'
import type { Point, Rect } from '@shared/types'
import type { WidgetId } from '@shared/widgets'
import type { SlotHandle, SlotRegistry } from '../contract'
import type { DragElement, DragEventType, DragPointer } from '../dragSession'
import type { PointerDownLike, WheelLike } from '../panelEdit'
import type { Frames } from '../timers'

export type LogEntry = readonly unknown[]

export class FakeDragElement implements DragElement {
  readonly listeners = new Map<DragEventType, Set<(e: DragPointer) => void>>()
  readonly captured = new Set<number>()
  /** setPointerCapture throws (the pointer is already up). */
  failCapture = false

  constructor(readonly log: LogEntry[] = []) {}

  setPointerCapture(pointerId: number): void {
    if (this.failCapture) throw new Error('NotFoundError')
    this.captured.add(pointerId)
    this.log.push(['capture', pointerId])
  }

  releasePointerCapture(pointerId: number): void {
    this.captured.delete(pointerId)
    // Releasing fires lostpointercapture at once, like a browser would when still listened to.
    this.log.push(['release', pointerId, this.listenerCount()])
    this.dispatch('lostpointercapture', pointer('lostpointercapture', 0, 0, { pointerId }))
  }

  hasPointerCapture(pointerId: number): boolean {
    return this.captured.has(pointerId)
  }

  addEventListener(type: DragEventType, listener: (e: DragPointer) => void): void {
    let set = this.listeners.get(type)
    if (!set) this.listeners.set(type, (set = new Set()))
    set.add(listener)
  }

  removeEventListener(type: DragEventType, listener: (e: DragPointer) => void): void {
    this.listeners.get(type)?.delete(listener)
  }

  listenerCount(): number {
    let n = 0
    for (const set of this.listeners.values()) n += set.size
    return n
  }

  dispatch(type: DragEventType, e: DragPointer): void {
    for (const cb of [...(this.listeners.get(type) ?? [])]) cb(e)
  }
}

export interface PointerInit {
  pointerId?: number
  buttons?: number
  altKey?: boolean
  shiftKey?: boolean
}

export function pointer(
  type: string,
  clientX: number,
  clientY: number,
  init: PointerInit = {}
): DragPointer {
  return {
    type,
    clientX,
    clientY,
    pointerId: init.pointerId ?? 1,
    buttons: init.buttons ?? (type === 'pointermove' || type === 'pointerdown' ? 1 : 0),
    altKey: init.altKey ?? false,
    shiftKey: init.shiftKey ?? false
  }
}

/** An event whose preventDefault() is recorded. */
export type Recorded<T> = T & { defaultPrevented: boolean }

/** A pointerdown as PanelEdit reads it, with its preventDefault recorded. */
export function pointerDown(
  clientX: number,
  clientY: number,
  init: PointerInit & { button?: number; isPrimary?: boolean } = {}
): Recorded<PointerDownLike> {
  const e: Recorded<PointerDownLike> = {
    ...pointer('pointerdown', clientX, clientY, init),
    button: init.button ?? 0,
    isPrimary: init.isPrimary ?? true,
    defaultPrevented: false,
    preventDefault(): void {
      e.defaultPrevented = true
    }
  }
  return e
}

export function wheelEvent(
  deltaY: number,
  timeStamp: number,
  ctrlKey = false
): Recorded<WheelLike> {
  const e: Recorded<WheelLike> = {
    deltaY,
    timeStamp,
    ctrlKey,
    defaultPrevented: false,
    preventDefault(): void {
      e.defaultPrevented = true
    }
  }
  return e
}

/** requestAnimationFrame that runs only when the test says a frame passed. */
export class FakeFrames implements Frames {
  private next = 1
  readonly pending = new Map<number, () => void>()

  request(cb: () => void): number {
    const id = this.next++
    this.pending.set(id, cb)
    return id
  }

  cancel(id: number): void {
    this.pending.delete(id)
  }

  /** One frame: runs every callback requested before it. */
  run(): void {
    const due = [...this.pending.values()]
    this.pending.clear()
    for (const cb of due) cb()
  }
}

export interface FakeSlot extends SlotHandle {
  readonly layoutRect: ShallowRef<Rect>
  readonly dragRect: ShallowRef<Rect | null>
  readonly pendingRect: ShallowRef<Rect | null>
  readonly autoHeight: ShallowRef<boolean>
  readonly locked: ShallowRef<boolean>
  readonly shown: ShallowRef<boolean>
  readonly autoHidden: ShallowRef<AutoHiddenState>
  readonly placement: ShallowRef<number>
}

/** A slot like the overlay host's: draws drag rect ?? pending rect ?? layout rect. */
export function createFakeSlot(id: WidgetId, rect: Rect, log: LogEntry[] = []): FakeSlot {
  const layoutRect = shallowRef(rect)
  const dragRect = shallowRef<Rect | null>(null)
  const pendingRect = shallowRef<Rect | null>(null)
  const drawn = computed(() => dragRect.value ?? pendingRect.value ?? layoutRect.value)
  return {
    id,
    layoutRect,
    dragRect,
    pendingRect,
    rect: drawn,
    autoHeight: shallowRef(false),
    locked: shallowRef(false),
    shown: shallowRef(true),
    autoHidden: shallowRef<AutoHiddenState>({ hidden: false, reason: null }),
    placement: shallowRef(1),
    setDragRect(r: Rect | null): void {
      log.push(['setDragRect', id, r])
      dragRect.value = r
    },
    commit(kind: 'drag' | 'wheel'): void {
      if (dragRect.value === null) return
      log.push(['commit', id, kind, drawn.value])
      pendingRect.value = dragRect.value
      dragRect.value = null
    },
    dropOutside(grab: Point): void {
      log.push(['dropOutside', id, grab])
      pendingRect.value = drawn.value
      dragRect.value = null
    }
  }
}

export const DISPLAY: OverlayDisplay = {
  id: 7,
  index: 1,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  workArea: { x: 0, y: 0, width: 1920, height: 1040 },
  scaleFactor: 1
}

export interface FakeRegistry extends SlotRegistry {
  readonly slots: ShallowRef<readonly SlotHandle[]>
  readonly display: ShallowRef<OverlayDisplay | null>
}

export function createFakeRegistry(slots: readonly SlotHandle[]): FakeRegistry {
  const list = shallowRef<readonly SlotHandle[]>(slots)
  return {
    slots: list,
    display: shallowRef<OverlayDisplay | null>(DISPLAY),
    slot: (id) => list.value.find((s) => s.id === id)
  }
}
