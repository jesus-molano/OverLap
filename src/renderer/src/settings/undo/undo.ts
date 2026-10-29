/**
 * "Deshacer" after hiding or moving an element (a misclick in the live sample, an eye clicked by
 * mistake): the pure parts, tested without a DOM, and the window's one undo slot (UndoToast.vue
 * shows it). One action at a time: a newer one replaces the offer, and undo only ever reverts
 * the last one.
 *
 * The undo goes through the editor that made the change (its optimistic list, its patch, its
 * announcement), so it reads exactly as the opposite edit would. It never reverts anything else:
 * when the list has changed since (another edit, main's reply), only the inverse of that one
 * change is applied, and when there is none left to apply (the element is shown again, the list
 * reordered) the offer goes away.
 */
import { shallowRef, type ShallowRef } from 'vue'
import { setElementVisible } from '@shared/elements'
import type { ElementEntry } from '@shared/types'
import type { List } from '../elements/listOps'

/** What an offer undoes: `id` hidden (shown back), or moved (put back). */
export type UndoKind = 'hide' | 'move'

export interface UndoOffer {
  /** Whose offer it is (its editor): withdrawn with it. */
  readonly owner: object
  readonly kind: UndoKind
  readonly id: string
  /** The element's name ('SoF'). */
  readonly label: string
  /** The list before the change, and the one the change made. */
  readonly before: List<string>
  readonly after: List<string>
  /** The list as its editor shows it now (reactive). */
  current(): List<string>
  /** Sends the undone list through the editor's own path (its patch, its announcement). */
  apply(next: ElementEntry<string>[]): void
}

const copy = (list: List<string>): ElementEntry<string>[] =>
  list.map((e) => ({ id: e.id, visible: e.visible }))

/** Same ids in the same order, each as visible. */
export function sameList(a: List<string>, b: List<string>): boolean {
  return (
    a.length === b.length && a.every((e, i) => e.id === b[i]?.id && e.visible === b[i]?.visible)
  )
}

const sameOrder = (a: List<string>, b: List<string>): boolean =>
  a.length === b.length && a.every((e, i) => e.id === b[i]?.id)

/**
 * The list undoing `offer` makes from `current`, or null when there is nothing (left) to undo.
 * - `current` is still what the change made: the list before it, exactly (visibility and place).
 * - It changed since: the inverse of that one change only. A hide: the element shown again
 *   where it is now, while it is still hidden. A move: the order before it, while the order is
 *   still the one the move made (the eyes stay as they are now); any other order is a newer
 *   arrangement, which a put-back would undo too.
 */
export function undoneList(
  offer: Pick<UndoOffer, 'kind' | 'id' | 'before' | 'after'>,
  current: List<string>
): ElementEntry<string>[] | null {
  if (sameList(current, offer.after)) {
    return sameList(current, offer.before) ? null : copy(offer.before)
  }
  if (offer.kind === 'hide') {
    const entry = current.find((e) => e.id === offer.id)
    return entry !== undefined && !entry.visible ? setElementVisible(current, offer.id, true) : null
  }
  if (!sameOrder(current, offer.after)) return null
  const visible = new Map(current.map((e) => [e.id, e.visible]))
  const next = offer.before.map((e) => ({ id: e.id, visible: visible.get(e.id) ?? e.visible }))
  return sameOrder(next, current) ? null : next
}

// ---- The countdown ------------------------------------------------------------------------

/** How long an offer stays (ms) while nothing holds it. */
export const UNDO_MS = 6000

export interface Timers {
  now(): number
  set(fn: () => void, ms: number): unknown
  clear(handle: unknown): void
}

const realTimers: Timers = {
  now: () => Date.now(),
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>)
}

/** Why a countdown is held: the pointer is over the toast, the focus is in it. */
export type HoldReason = 'hover' | 'focus'

export interface Countdown {
  /** Held by `reason` (more than one may hold it at once). */
  hold(reason: HoldReason): void
  /** `reason` lets go: with nothing left holding it, it runs on for what it had left. */
  release(reason: HoldReason): void
  cancel(): void
  readonly held: boolean
  /** What it has left (ms). */
  remaining(): number
}

/** Calls `done` after `ms` of not being held. */
export function countdown(ms: number, done: () => void, timers: Timers = realTimers): Countdown {
  const holds = new Set<HoldReason>()
  let left = ms
  let since = timers.now()
  let handle: unknown = timers.set(fire, left)
  let over = false

  function fire(): void {
    handle = undefined
    over = true
    done()
  }
  function stop(): void {
    if (handle !== undefined) timers.clear(handle)
    handle = undefined
  }

  return {
    hold(reason) {
      if (over) return
      if (holds.size === 0) {
        stop()
        left = Math.max(0, left - (timers.now() - since))
      }
      holds.add(reason)
    },
    release(reason) {
      if (over || !holds.delete(reason) || holds.size > 0) return
      since = timers.now()
      handle = timers.set(fire, left)
    },
    cancel() {
      over = true
      stop()
    },
    get held() {
      return holds.size > 0
    },
    remaining() {
      if (over) return 0
      return holds.size > 0 ? left : Math.max(0, left - (timers.now() - since))
    }
  }
}

// ---- The slot -----------------------------------------------------------------------------

/** The offer on show, numbered (a new one is a new toast, even with the same words). */
export interface Shown {
  readonly offer: UndoOffer
  readonly seq: number
}

export interface UndoSlot {
  readonly shown: Readonly<ShallowRef<Shown | null>>
  /** Whether the countdown is held now (the toast's bar stops with it). */
  readonly held: Readonly<ShallowRef<boolean>>
  /**
   * Shows `offer` in place of any other. False when no toast is mounted to show it (the editor
   * then announces the change itself).
   */
  offer(offer: UndoOffer): boolean
  /** Undoes the offer on show (and closes it); false when there was nothing to undo. */
  undo(): boolean
  dismiss(): void
  /** Closes `owner`'s offer, if it is the one on show (its editor went away). */
  withdraw(owner: object): void
  hold(reason: HoldReason): void
  release(reason: HoldReason): void
  /** A toast mounted to show the offers: returns its unmount. */
  attach(): () => void
}

export function createUndoSlot(timers: Timers = realTimers, ms = UNDO_MS): UndoSlot {
  const shown = shallowRef<Shown | null>(null)
  const held = shallowRef(false)
  let timer: Countdown | null = null
  let seq = 0
  let hosts = 0

  function dismiss(): void {
    timer?.cancel()
    timer = null
    held.value = false
    shown.value = null
  }

  return {
    shown,
    held,
    offer(offer) {
      if (hosts === 0) return false
      timer?.cancel()
      held.value = false
      shown.value = { offer, seq: ++seq }
      timer = countdown(ms, dismiss, timers)
      return true
    },
    undo() {
      const s = shown.value
      if (s === null) return false
      const next = undoneList(s.offer, s.offer.current())
      dismiss()
      if (next === null) return false
      s.offer.apply(next)
      return true
    },
    dismiss,
    withdraw(owner) {
      if (shown.value?.offer.owner === owner) dismiss()
    },
    hold(reason) {
      timer?.hold(reason)
      held.value = timer?.held ?? false
    },
    release(reason) {
      timer?.release(reason)
      held.value = timer?.held ?? false
    },
    attach() {
      hosts++
      let attached = true
      return () => {
        if (!attached) return
        attached = false
        hosts--
        if (hosts === 0) dismiss()
      }
    }
  }
}

/** The settings window's one slot. */
export const undoSlot: UndoSlot = createUndoSlot()

/** Ctrl+Z (Cmd+Z), no other modifier: the toast's shortcut while it is shown. */
export function isUndoKey(
  e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>
): boolean {
  return (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z'
}

/** A target where Ctrl+Z is the text's own undo (a field), never the toast's. */
export function isTextTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true
  if (!(target instanceof HTMLInputElement)) return false
  return !['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'color'].includes(target.type)
}
