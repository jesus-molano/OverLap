/**
 * Fit of a live preview in its stage. The sample scales itself down to the stage width
 * (samples/sampleBox.ts); the stage then shrinks it further, as a whole, when it is taller than
 * the stage may be (a share of the window height), so the options below always keep room.
 * Pure.
 */

export interface Size {
  readonly w: number
  readonly h: number
}

export interface StageFit {
  /** Drawn at this factor (<= 1). */
  readonly scale: number
  /** The space it takes once scaled (px; 0 for an unknown side), never more than the box. */
  readonly width: number
  readonly height: number
  /** Too small to read at the fitted size: drawn larger, only its top part shows (R53). */
  readonly cropped: boolean
}

const usable = (v: number): boolean => Number.isFinite(v) && v > 0

/** Float noise must not round a fitted side 1 px past the box. */
const EPSILON = 1e-6

/**
 * Largest factor (<= 1) at which `content` fits inside `box`, keeping its proportions. A side
 * that is unknown (0, negative, NaN) on either does not limit it.
 */
export function fitScale(content: Size, box: Size): number {
  let scale = 1
  if (usable(content.w) && usable(box.w)) scale = Math.min(scale, box.w / content.w)
  if (usable(content.h) && usable(box.h)) scale = Math.min(scale, box.h / content.h)
  return scale
}

/** Below `below`, the content is drawn at `scale` instead and cropped (sampleBox stageCrop). */
export interface Crop {
  readonly below: number
  readonly scale: number
}

/**
 * `content` scaled to fit `box`, with the space it then takes (rounded up: nothing is cut); where
 * that would be below `crop.below` (R53: the text would be too small to read) it is drawn at
 * `crop.scale` instead, takes the box's height and `cropped` says that its foot is left out.
 */
export function stageFit(content: Size, box: Size, crop: Crop | null = null): StageFit {
  const fits = fitScale(content, box)
  const cropped = crop !== null && fits < crop.below - EPSILON && crop.scale > fits
  const scale = cropped ? Math.min(1, crop.scale) : fits
  const side = (v: number, max: number): number => {
    if (!usable(v)) return 0
    const px = Math.ceil(v * scale - EPSILON)
    return cropped && usable(max) ? Math.min(px, Math.floor(max)) : px
  }
  return { scale, width: side(content.w, box.w), height: side(content.h, box.h), cropped }
}

/**
 * The height the sample may take while you edit in it (`rest`: the height it took before the
 * ghosts appeared, 0 before one is known): no more than at rest, so ghosts that add lines (the
 * battle's lap rows) draw the sample a little smaller instead of growing the stage, and nothing
 * under the stage moves under the pointer. `limit` (0: unknown) still caps it.
 */
export function editingLimit(limit: number, rest: number): number {
  if (!usable(rest)) return limit
  return usable(limit) ? Math.min(limit, rest) : rest
}
