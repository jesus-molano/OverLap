/** Colour helpers of the renderer kit. Pure. */
import { relativeLuminance } from '@shared/colors'

const HEX_RE = /^#[0-9a-f]{6}$/i

/** A valid '#rrggbb' in lower case, else `fallback`. */
export function hexOr(color: string | null | undefined, fallback: string): string {
  return typeof color === 'string' && HEX_RE.test(color) ? color.toLowerCase() : fallback
}

/**
 * Lightness an ink must reach (WCAG relative luminance) to be text on the panel glass: at the
 * default opacity that is >= 3.7:1 over a white sky (the glass composites to #414346) and
 * >= 6.9:1 over dark asphalt (#13151a), and still >= 3:1 where the glass is lightest over the
 * sky: your row's lift on an alternate stripe.
 */
export const INK_MIN_LUMINANCE = 0.35
/** Mixing step towards white: small, so a colour keeps as much of its hue as it can. */
const INK_STEP = 0.05

function mixToWhite(hex: string, t: number): string {
  let out = '#'
  for (let i = 1; i < 7; i += 2) {
    const c = parseInt(hex.slice(i, i + 2), 16)
    out += Math.round(c + (255 - c) * t)
      .toString(16)
      .padStart(2, '0')
  }
  return out
}

/**
 * A colour as text ink on the dark panel: mixed towards white in sRGB, by the smallest step of
 * 5 % that reaches INK_MIN_LUMINANCE. Bright colours come back as they are ('#feec04'); dark
 * ones lighten until they read ('#0153db' -> '#80a9ed', black -> '#a6a6a6'). Licence letters and
 * class names use it (`--lic-ink`, `--cls-ink`); fills keep the real colour. Anything but
 * '#rrggbb' comes back unchanged.
 */
export function inkOnDark(hex: string): string {
  if (!HEX_RE.test(hex)) return hex
  const base = hex.toLowerCase()
  for (let step = 0; step * INK_STEP < 1; step++) {
    const ink = step === 0 ? base : mixToWhite(base, step * INK_STEP)
    if ((relativeLuminance(ink) ?? 1) >= INK_MIN_LUMINANCE) return ink
  }
  return '#ffffff'
}
