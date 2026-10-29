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

/** What a key on a row's handle does: a move by places, to an end, or nothing. */
export type KeyAction =
  | { readonly kind: 'by'; readonly delta: number }
  | { readonly kind: 'to'; readonly index: number }
  | null

export function keyAction(key: string, index: number, total: number): KeyAction {
  switch (key) {
    case 'ArrowUp':
      return index > 0 ? { kind: 'by', delta: -1 } : null
    case 'ArrowDown':
      return index < total - 1 ? { kind: 'by', delta: 1 } : null
    case 'Home':
      return index > 0 ? { kind: 'to', index: 0 } : null
    case 'End':
      return index < total - 1 ? { kind: 'to', index: total - 1 } : null
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
