/** Numeric helpers of the mock race (pure, no allocation); clamp and frac live in @shared/num. */
import { clamp, frac } from '@shared/num'

export function lerp(a: number, b: number, s: number): number {
  return a + (b - a) * s
}

/** Smoothstep of `s` clamped to [0, 1]. */
export function smooth01(s: number): number {
  const u = clamp(s, 0, 1)
  return u * u * (3 - 2 * u)
}

/** True when race distance went from `before` to `after` across lap fraction `pct`. */
export function crossedPct(before: number, after: number, pct: number): boolean {
  if (!(after > before)) return false
  const a = frac(before)
  const b = frac(after)
  return Math.floor(after) === Math.floor(before) ? a < pct && b >= pct : a < pct || b >= pct
}

/** `x` moved toward `target` by at most `maxStep` (>= 0), never past it. */
export function approach(x: number, target: number, maxStep: number): number {
  return x < target ? Math.min(target, x + maxStep) : Math.max(target, x - maxStep)
}

/**
 * Stable in-place sort for short arrays that are nearly sorted from one call
 * to the next (race order between ticks): ~O(n) then, and no allocation.
 */
export function insertionSort<T>(arr: T[], cmp: (a: T, b: T) => number): void {
  for (let i = 1; i < arr.length; i++) {
    const item = arr[i] as T
    let j = i - 1
    while (j >= 0 && cmp(arr[j] as T, item) > 0) {
      arr[j + 1] = arr[j] as T
      j--
    }
    arr[j + 1] = item
  }
}
