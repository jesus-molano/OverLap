/** Copies of JSON-like data. Pure (no structuredClone: the shared code has no DOM or Node lib). */

/**
 * A deep copy of JSON-like data (plain objects, arrays, primitives) that shares no object with
 * `value`; frozen parts come out unfrozen. Not for Maps, Sets, Dates or cyclic structures.
 */
export function copyData<T>(value: T): T {
  if (typeof value !== 'object' || value === null) return value
  if (Array.isArray(value)) return value.map((v: unknown) => copyData(v)) as T
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) out[k] = copyData(v)
  return out as T
}
