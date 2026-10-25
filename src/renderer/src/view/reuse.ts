/**
 * Identity reuse for view models: an unchanged view keeps its previous object, so `v-memo`
 * and downstream computeds see "no change" with one identity check. Pure.
 */

export type Equality<T> = (a: T, b: T) => boolean

/** Same own keys with identical (===) values: for flat views of strings, flags and shared styles. */
export function shallowEqual(a: object, b: object): boolean {
  if (a === b) return true
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  const ra = a as Record<string, unknown>
  const rb = b as Record<string, unknown>
  for (const k of ka) {
    if (ra[k] !== rb[k] || !Object.prototype.hasOwnProperty.call(rb, k)) return false
  }
  return true
}

/** `prev` when equal to `next`, else `next`. Use as `computed((prev) => reuseView(prev, make()))`. */
export function reuseView<T extends object | null>(
  prev: T | undefined,
  next: T,
  eq: Equality<NonNullable<T>> = shallowEqual
): T {
  if (prev === undefined || prev === null || next === null) return next
  return eq(prev, next) ? prev : next
}

/**
 * `next` with every view equal to the one at the same index of `prev` replaced by that previous
 * object (mutates `next`); `prev` itself when nothing changed at all.
 */
export function reuseViews<T extends object>(
  prev: readonly T[] | undefined,
  next: T[],
  eq: Equality<T> = shallowEqual
): readonly T[] {
  if (prev === undefined) return next
  let same = prev.length === next.length
  for (let i = 0; i < next.length; i++) {
    const p = prev[i]
    const n = next[i]
    if (p !== undefined && n !== undefined && eq(p, n)) next[i] = p
    else same = false
  }
  return same ? prev : next
}
