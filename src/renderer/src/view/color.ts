/** Colour fallback of the renderer kit. Pure. */

const HEX_RE = /^#[0-9a-f]{6}$/i

/** A valid '#rrggbb' in lower case, else `fallback`. */
export function hexOr(color: string | null | undefined, fallback: string): string {
  return typeof color === 'string' && HEX_RE.test(color) ? color.toLowerCase() : fallback
}
