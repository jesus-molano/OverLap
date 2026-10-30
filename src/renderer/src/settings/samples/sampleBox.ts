/**
 * Geometry of a live sample: the widget is laid out at its real window size (so it drops the
 * same columns and wraps the same way as over the game) and scaled down as a whole when the
 * settings page is narrower. In a wide (maximised, ultrawide) window it is drawn larger, up to
 * SAMPLE_ZOOM.max (sampleZoom); at the normal window size it stays 1:1. Never below
 * SAMPLE_CROP_BELOW (R53): a page that would draw it smaller shows it at its real size instead,
 * its left part, and the rest a sideways scroll away, rather than shrinking its smallest text to
 * 6 px. Pure.
 */

/**
 * Below this factor (the page width and the stage height together: SampleStage) a preview is
 * drawn at its real size and cropped (R53): the first rows and columns, legible and clickable.
 */
export const SAMPLE_CROP_BELOW = 0.75

/**
 * Zoom of a sample in a wide page: none up to `fromPx` of room, then growing with the room (so
 * there is no jump at the threshold), at most `max`. The stage still shrinks a sample taller
 * than it may be (stageFit).
 */
export const SAMPLE_ZOOM = { fromPx: 1000, max: 2 } as const

/** How much larger than 1:1 a sample may be drawn with `available` px of page width. */
export function sampleZoom(available: number): number {
  if (!(Number.isFinite(available) && available > SAMPLE_ZOOM.fromPx)) return 1
  return Math.min(SAMPLE_ZOOM.max, available / SAMPLE_ZOOM.fromPx)
}

/** Tallest sample (px): a longer auto-height widget trims rows, as a short window would. */
export const SAMPLE_MAX_HEIGHT_PX = 640

export interface SampleBox {
  /** The widget's own layout size (px). */
  readonly width: number
  readonly height: number
  /** Drawn at this factor (< 1 on a narrow page, > 1 on a wide one: sampleZoom). */
  readonly scale: number
  /** The space it takes on the page (px). */
  readonly outerWidth: number
  readonly outerHeight: number
  /** At its real size, wider than the page (SAMPLE_CROP_BELOW): its right part is scrolled to. */
  readonly cropped: boolean
}

const positive = (v: number, fallback: number): number =>
  Number.isFinite(v) && v > 0 ? Math.round(v) : fallback

/**
 * `width` x `height` (the content's height for auto-height widgets, else the window's), shrunk
 * to fit `available` px of page width (1:1 and `cropped` where that would be below
 * SAMPLE_CROP_BELOW), or zoomed in a wide page (sampleZoom); 0 or unknown `available` draws it at
 * full size.
 */
export function sampleBox(width: number, height: number, available: number): SampleBox {
  const w = positive(width, 1)
  const h = Math.min(SAMPLE_MAX_HEIGHT_PX, positive(height, 1))
  const fits =
    Number.isFinite(available) && available > 0 ? Math.min(sampleZoom(available), available / w) : 1
  const cropped = fits < SAMPLE_CROP_BELOW
  const scale = cropped ? 1 : fits
  return {
    width: w,
    height: h,
    scale,
    outerWidth: Math.floor(w * scale),
    outerHeight: Math.ceil(h * scale),
    cropped
  }
}

/** How the stage's own height fit stops (stageFit): below `below`, it draws at `scale`. */
export interface StageCrop {
  readonly below: number
  readonly scale: number
}

/**
 * The stage's crop for a sample already drawn at `sampleScale` by the page width (R53): the two
 * together never go below SAMPLE_CROP_BELOW; there, the sample is drawn at its real size (or as
 * close as the stage can without enlarging it) and shows its first rows.
 */
export function stageCrop(sampleScale: number): StageCrop {
  const s = Number.isFinite(sampleScale) && sampleScale > 0 ? sampleScale : 1
  return { below: Math.min(1, SAMPLE_CROP_BELOW / s), scale: Math.min(1, 1 / s) }
}
