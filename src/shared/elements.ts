/**
 * Reading and changing element lists (ElementList: a widget zone's ids in order, each shown or
 * hidden), the same in the providers, the widgets and the settings window. Pure: nothing here
 * mutates its input, every change returns a new list of new entries.
 *
 * Lists out of normalisation always hold every id exactly once; these functions still accept
 * anything (a hand-built option object in a test, a list from an older file), so a malformed
 * list reads as "everything shown" like a missing option reads as its default.
 */
import type { ElementEntry } from './types'

type List<Id extends string> = readonly Readonly<ElementEntry<Id>>[]

function isList<Id extends string>(list: unknown): list is List<Id> {
  return Array.isArray(list)
}

/**
 * Whether `id` is drawn: its entry's `visible`. A list that is not an array counts every id as
 * shown (like the standings' columnShown always did); an id missing from a list is hidden.
 */
export function isElementVisible<Id extends string>(
  list: List<Id> | null | undefined,
  id: Id
): boolean {
  if (!isList<Id>(list)) return true
  for (const e of list) if (e.id === id) return e.visible === true
  return false
}

/** The shown ids in order (each once); `fallback` in its order for a malformed list. */
export function visibleIds<Id extends string>(
  list: List<Id> | null | undefined,
  fallback: readonly Id[] = []
): Id[] {
  if (!isList<Id>(list)) return [...fallback]
  const out: Id[] = []
  for (const e of list) if (e.visible === true && !out.includes(e.id)) out.push(e.id)
  return out
}

/** Every id in order, shown or not (each once). */
export function elementOrder<Id extends string>(list: List<Id>): Id[] {
  const out: Id[] = []
  for (const e of list) if (!out.includes(e.id)) out.push(e.id)
  return out
}

/** How many entries are shown. */
export function visibleCount(list: List<string>): number {
  let n = 0
  for (const e of list) if (e.visible) n++
  return n
}

/** A copy with `id` shown or hidden (the other entries copied as they are). */
export function setElementVisible<Id extends string>(
  list: List<Id>,
  id: Id,
  visible: boolean
): ElementEntry<Id>[] {
  return list.map((e) => (e.id === id ? { id: e.id, visible } : { id: e.id, visible: e.visible }))
}

/**
 * A copy with the entry at `from` moved to `to` (both truncated and clamped to the list); a copy
 * even when nothing moves.
 */
export function moveElement<Id extends string>(
  list: List<Id>,
  from: number,
  to: number
): ElementEntry<Id>[] {
  const out = list.map((e) => ({ id: e.id, visible: e.visible }))
  if (out.length === 0 || !Number.isFinite(from) || !Number.isFinite(to)) return out
  const last = out.length - 1
  const f = Math.min(last, Math.max(0, Math.trunc(from)))
  const t = Math.min(last, Math.max(0, Math.trunc(to)))
  if (f === t) return out
  const [item] = out.splice(f, 1)
  if (item !== undefined) out.splice(t, 0, item)
  return out
}

/** Same ids in the same order (visibility ignored). */
export function sameOrder(a: List<string>, b: List<string>): boolean {
  return a.length === b.length && a.every((e, i) => e.id === b[i]?.id)
}

/** Same ids, same order, same visibility. */
export function sameElements(a: List<string>, b: List<string>): boolean {
  return (
    a.length === b.length && a.every((e, i) => e.id === b[i]?.id && e.visible === b[i]?.visible)
  )
}

/** A plain copy (every entry a new object). */
export function copyElements<Id extends string>(list: List<Id>): ElementEntry<Id>[] {
  return list.map((e) => ({ id: e.id, visible: e.visible }))
}
