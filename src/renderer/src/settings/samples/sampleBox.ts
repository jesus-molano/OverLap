/**
 * Geometry of a live sample: the widget is laid out at its real window size (so it drops the
 * same columns and wraps the same way as over the game) and scaled down as a whole when the
 * settings page is narrower. Pure.
 */

/** Tallest sample (px): a longer auto-height widget trims rows, as a short window would. */
export const SAMPLE_MAX_HEIGHT_PX = 640

export interface SampleBox {
  /** The widget's own layout size (px). */
  readonly width: number
  readonly height: number
  /** Drawn at this factor (<= 1). */
  readonly scale: number
  /** The space it takes on the page (px). */
  readonly outerWidth: number
  readonly outerHeight: number
}

const positive = (v: number, fallback: number): number =>
  Number.isFinite(v) && v > 0 ? Math.round(v) : fallback

/**
 * `width` x `height` (the content's height for auto-height widgets, else the window's), shrunk
 * to fit `available` px of page width; 0 or unknown `available` draws it at full size.
 */
export function sampleBox(width: number, height: number, available: number): SampleBox {
  const w = positive(width, 1)
  const h = Math.min(SAMPLE_MAX_HEIGHT_PX, positive(height, 1))
  const scale = Number.isFinite(available) && available > 0 ? Math.min(1, available / w) : 1
  return {
    width: w,
    height: h,
    scale,
    outerWidth: Math.floor(w * scale),
    outerHeight: Math.ceil(h * scale)
  }
}
