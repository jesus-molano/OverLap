/** Equality helpers for payloads and view models (SKIP_EMIT, computed reuse). Pure. */

/** === that also treats NaN as equal to NaN (and 0 as equal to -0). */
export function sameNumber(a: number, b: number): boolean {
  return a === b || (a !== a && b !== b)
}

/**
 * Structural equality of JSON-like data (plain objects, arrays, primitives),
 * independent of key order. Numbers compare with `sameNumber`. Not for Maps,
 * Sets, Dates or cyclic structures.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a === 'number' && typeof b === 'number') return a !== a && b !== b
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  const arrA = Array.isArray(a)
  if (arrA !== Array.isArray(b)) return false
  if (arrA) {
    const x = a as readonly unknown[]
    const y = b as readonly unknown[]
    if (x.length !== y.length) return false
    for (let i = 0; i < x.length; i++) if (!deepEqual(x[i], y[i])) return false
    return true
  }
  const ra = a as Record<string, unknown>
  const rb = b as Record<string, unknown>
  const keys = Object.keys(ra)
  if (keys.length !== Object.keys(rb).length) return false
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(rb, k) || !deepEqual(ra[k], rb[k])) return false
  }
  return true
}

/** Element-wise equality of two arrays (`eq` defaults to ===, NaN-safe for numbers). */
export function arrayEqual<T>(
  a: readonly T[] | null,
  b: readonly T[] | null,
  eq: (x: T, y: T) => boolean = (x, y) => x === y || (x !== x && y !== y)
): boolean {
  if (a === b) return true
  if (a === null || b === null || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (!eq(a[i] as T, b[i] as T)) return false
  return true
}
