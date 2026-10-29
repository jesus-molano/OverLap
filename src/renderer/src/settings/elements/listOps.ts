/**
 * The shared element editor's logic (ElementEditor.vue), kept pure so it is tested without a
 * DOM: moves and toggles that respect the list's spec (required ids, a fixed order, parents),
 * the drop slot of a drag, the keyboard on a row's handle, the reset and the screen-reader
 * announcements. Every function returns new lists of new entries.
 */
import { moveElement, sameElements, setElementVisible } from '@shared/elements'
import type { Messages } from '@shared/i18n'
import type { ElementsSpec } from '@shared/settingsSchema'
import type { ElementEntry } from '@shared/types'

export type List<Id extends string> = readonly Readonly<ElementEntry<Id>>[]

/** An element's words in the editor. */
export interface ElementText {
  readonly label: string
  readonly hint?: string
}

/** What one edit did, for the page's `apply` (coupled options: the standings' gap mode...). */
export type ElementChange<Id extends string> =
  | { readonly kind: 'visible'; readonly id: Id; readonly visible: boolean }
  | { readonly kind: 'move'; readonly id: Id; readonly to: number }
  | { readonly kind: 'reset' }

export type SpecRules<Id extends string> = Pick<
  ElementsSpec<Id>,
  'ids' | 'default' | 'required' | 'fixedOrder' | 'parents'
>

export function isRequired<Id extends string>(spec: SpecRules<Id>, id: Id): boolean {
  return spec.required.includes(id)
}

/**
 * A child whose parent is hidden (the radar's distances without the guides): its eye is greyed
 * out, its own visibility kept. The parent's id, or null.
 */
export function blockedBy<Id extends string>(
  spec: SpecRules<Id>,
  list: List<Id>,
  id: Id
): Id | null {
  const parent = spec.parents[id]
  if (parent === undefined) return null
  return list.some((e) => e.id === parent && e.visible) ? null : parent
}

/** The list with `id` shown or hidden; unchanged (a copy) for a required id. */
export function toggled<Id extends string>(
  spec: SpecRules<Id>,
  list: List<Id>,
  id: Id,
  visible: boolean
): ElementEntry<Id>[] {
  if (!visible && isRequired(spec, id)) return list.map((e) => ({ ...e }))
  return setElementVisible(list, id, visible)
}

/** The list with `id` moved by `delta` places (clamped); a copy unchanged for a fixed order. */
export function movedBy<Id extends string>(
  spec: SpecRules<Id>,
  list: List<Id>,
  id: Id,
  delta: number
): ElementEntry<Id>[] {
  const from = list.findIndex((e) => e.id === id)
  if (spec.fixedOrder || from < 0) return list.map((e) => ({ ...e }))
  return moveElement(list, from, from + delta)
}

/** The list with `id` moved to index `to` (clamped). */
export function movedTo<Id extends string>(
  spec: SpecRules<Id>,
  list: List<Id>,
  id: Id,
  to: number
): ElementEntry<Id>[] {
  const from = list.findIndex((e) => e.id === id)
  if (spec.fixedOrder || from < 0) return list.map((e) => ({ ...e }))
  return moveElement(list, from, to)
}

/** A copy of the spec's default (the reset). */
export function defaults<Id extends string>(spec: SpecRules<Id>): ElementEntry<Id>[] {
  return spec.default.map((e) => ({ id: e.id, visible: e.visible }))
}

/** The list reads as the default already (the reset has nothing to do). */
export function isDefault<Id extends string>(spec: SpecRules<Id>, list: List<Id>): boolean {
  return sameElements(list, spec.default)
}

/** Shown entries (required ones included). */
export function shownCount(list: List<string>): number {
  let n = 0
  for (const e of list) if (e.visible) n++
  return n
}

/**
 * Index the dragged row lands on: how many of the other rows have their vertical centre above
 * the pointer. `centres` are the row centres (px, any common origin) measured when the drag
 * started; rows have one height, so those slots stay valid while the list reorders.
 */
export function dropIndex(centres: readonly number[], from: number, pointerY: number): number {
  let n = 0
  for (let i = 0; i < centres.length; i++) {
    const c = centres[i]
    if (i !== from && c !== undefined && c < pointerY) n++
  }
  return n
}

// ---- Two sides (an info bar: what follows its `split` marker lines up at the far end) ----

export type Side = 'left' | 'right'

/** A row of the editor: an entry and its index in the whole list. */
export interface IndexedEntry<Id extends string> {
  readonly entry: Readonly<ElementEntry<Id>>
  readonly index: number
}

/**
 * The entries before the marker (left) and after it (right), each with its index in `list`; the
 * marker itself in neither. Without the marker in the list, everything is on the left.
 */
export function sides<Id extends string>(
  list: List<Id>,
  split: Id
): { readonly left: IndexedEntry<Id>[]; readonly right: IndexedEntry<Id>[] } {
  const at = list.findIndex((e) => e.id === split)
  const left: IndexedEntry<Id>[] = []
  const right: IndexedEntry<Id>[] = []
  list.forEach((entry, index) => {
    if (entry.id === split) return
    if (at < 0 || index < at) left.push({ entry, index })
    else right.push({ entry, index })
  })
  return { left, right }
}

/** Which side of the marker `id` is on (left without a marker). */
export function sideOf<Id extends string>(list: List<Id>, id: Id, split: Id): Side {
  const at = list.findIndex((e) => e.id === split)
  const i = list.findIndex((e) => e.id === id)
  return at >= 0 && i > at ? 'right' : 'left'
}

/**
 * The list with `id` on the other side of the marker, the side nearest it: the end of the left
 * one or the start of the right one (a single step over the marker, so the order the bar draws
 * the others in never changes). A copy unchanged for the marker itself or a list without it.
 */
export function movedAcross<Id extends string>(
  spec: SpecRules<Id>,
  list: List<Id>,
  id: Id,
  split: Id
): ElementEntry<Id>[] {
  const at = list.findIndex((e) => e.id === split)
  const from = list.findIndex((e) => e.id === id)
  if (at < 0 || from < 0 || id === split) return list.map((e) => ({ ...e }))
  // Taken out, then put back where the marker was: just after it from the left, just before
  // it from the right.
  return movedTo(spec, list, id, at)
}

/**
 * The indexes in `list` of the box `index` is in: the side of the marker it is on (the left one
 * ends just before it, the right one starts just after it), or the whole list without one.
 */
export function boxBounds<Id extends string>(list: List<Id>, index: number, split?: Id): Bounds {
  const at = split === undefined ? -1 : list.findIndex((e) => e.id === split)
  if (at < 0) return { first: 0, last: list.length - 1 }
  return index < at ? { first: 0, last: at - 1 } : { first: at + 1, last: list.length - 1 }
}

/**
 * Where `id` is as its box numbers it (from 0) and how many rows that box has: the side of the
 * marker it is on, or the whole list without one.
 */
export function boxPosition<Id extends string>(
  list: List<Id>,
  id: Id,
  split?: Id
): { readonly index: number; readonly total: number } {
  if (split === undefined) return { index: list.findIndex((e) => e.id === id), total: list.length }
  const rows = sides(list, split)[sideOf(list, id, split)]
  return { index: rows.findIndex((r) => r.entry.id === id), total: rows.length }
}

/** 'Incidentes: a la derecha.' */
export function sideMessage(m: Messages, label: string, side: Side): string {
  const e = m.settings.elements
  return side === 'right' ? e.movedRight(label) : e.movedLeft(label)
}

/** What a key on a row's handle does: a move by places, to an end, or nothing. */
export type KeyAction =
  | { readonly kind: 'by'; readonly delta: number }
  | { readonly kind: 'to'; readonly index: number }
  | null

/** The first and last index of a row's box in the whole list (see boxBounds). */
export interface Bounds {
  readonly first: number
  readonly last: number
}

/**
 * The arrows move by one through the whole list (over the marker too); Home and End go to the
 * ends of the row's own box (`bounds`, the whole list by default), never to the other side.
 */
export function keyAction(
  key: string,
  index: number,
  total: number,
  bounds: Bounds = { first: 0, last: total - 1 }
): KeyAction {
  switch (key) {
    case 'ArrowUp':
      return index > 0 ? { kind: 'by', delta: -1 } : null
    case 'ArrowDown':
      return index < total - 1 ? { kind: 'by', delta: 1 } : null
    case 'Home':
      return index > bounds.first ? { kind: 'to', index: bounds.first } : null
    case 'End':
      return index < bounds.last ? { kind: 'to', index: bounds.last } : null
    default:
      return null
  }
}

/** 'iRating: posición 3 de 8.' */
export function movedMessage(m: Messages, label: string, index: number, total: number): string {
  return m.settings.elements.moved(label, index + 1, total)
}

/** 'Boxes visible.', 'Última vuelta oculto.' */
export function visibilityMessage(m: Messages, label: string, visible: boolean): string {
  const e = m.settings.elements
  return visible ? e.shown(label) : e.hidden(label)
}
