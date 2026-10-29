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
  /** The space it takes once scaled (px; 0 for an unknown side). */
  readonly width: number
  readonly height: number
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

/** `content` scaled to fit `box`, with the space it then takes (rounded up: nothing is cut). */
export function stageFit(content: Size, box: Size): StageFit {
  const scale = fitScale(content, box)
  const side = (v: number): number => (usable(v) ? Math.ceil(v * scale - EPSILON) : 0)
  return { scale, width: side(content.w), height: side(content.h) }
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
