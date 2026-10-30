/**
 * A text's width, estimated from Segoe UI Semibold's advance widths (the OSD's and the overlay's
 * face), in em: for tests that check a line fits its box (the OSD pill) in every language
 * without a browser. Generous rather than exact: real text is a little narrower. Pure.
 */
const LOWER: Readonly<Record<string, number>> = {
  a: 0.53,
  b: 0.58,
  c: 0.47,
  d: 0.58,
  e: 0.53,
  f: 0.34,
  g: 0.58,
  h: 0.57,
  i: 0.26,
  j: 0.26,
  k: 0.51,
  l: 0.26,
  m: 0.87,
  n: 0.57,
  o: 0.58,
  p: 0.58,
  q: 0.58,
  r: 0.37,
  s: 0.44,
  t: 0.35,
  u: 0.57,
  v: 0.5,
  w: 0.77,
  x: 0.5,
  y: 0.5,
  z: 0.45
}

const NARROW_UPPER: Readonly<Record<string, number>> = { I: 0.28, J: 0.38, M: 0.84, W: 0.94 }

/** One character's advance (em). */
function charEm(ch: string): number {
  const base = ch.normalize('NFD').charAt(0)
  const lower = LOWER[base]
  if (lower !== undefined) return lower
  if (/[A-Z]/.test(base)) return NARROW_UPPER[base] ?? 0.64
  if (/[0-9]/.test(base)) return 0.56
  if (ch === ' ') return 0.27
  if (/[.,:;'!|·]/.test(ch)) return 0.27
  if (/[()[\]«»"“”¿¡-]/.test(ch)) return 0.36
  return 0.6
}

/** `text`'s estimated width in px at `px` font size. */
export function textWidthPx(text: string, px: number): number {
  let em = 0
  for (const ch of text) em += charEm(ch)
  return em * px
}
