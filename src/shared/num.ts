/** Small numeric helpers shared by the providers, the race model and the renderer. Pure. */

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** `v` when it is a finite number, else `fallback`. */
export function finiteOr(v: unknown, fallback: number): number {
  return isFiniteNumber(v) ? v : fallback
}

/** Clamps to [lo, hi]; NaN -> lo. */
export function clamp(n: number, lo: number, hi: number): number {
  return n >= hi ? hi : n > lo ? n : lo
}

/** Clamps to [0, 1]; NaN -> 0. */
export function clamp01(n: number): number {
  return n >= 1 ? 1 : n > 0 ? n : 0
}

/** Fractional part, always in [0, 1) (also for negative numbers). */
export function frac(n: number): number {
  return n - Math.floor(n)
}

/** Rounds to a multiple of 1/factor (quantise(1.234, 100) = 1.23); -0 and NaN become 0. */
export function quantise(n: number, factor: number): number {
  return Math.round(n * factor) / factor || 0
}

/** Rounds to `decimals` places; -0 and NaN become 0. */
export function roundTo(n: number, decimals: number): number {
  return quantise(n, 10 ** decimals)
}

/**
 * Integer from an untrusted value: rounded and clamped to [min, max].
 * Non-finite numbers and non-numbers give `fallback`.
 */
export function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  return isFiniteNumber(n) ? clamp(Math.round(n), min, max) : fallback
}
