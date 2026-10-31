/**
 * The spotter's drawing, pure: the fill's colour step and the transform of each covered stretch.
 * One string per quantised value, so a 60 Hz pass builds none.
 */
import { SPOTTER } from '@shared/spotter'
import type { SpotterSegment } from '@shared/types'

/** The radar's proximity ramp (theme.css --ov-prox-N) the fill starts at: a warm grey-red. */
export const FIRST_BUCKET = 4
/** Its last step, the alert red: a car completely beside you. */
export const LAST_BUCKET = 11

/** The ramp step of a pillar covered `cover` (0..1): warmer the more of your car is covered. */
export function coverBucket(cover: number): number {
  const c = Number.isFinite(cover) ? Math.min(1, Math.max(0, cover)) : 0
  return FIRST_BUCKET + Math.round(c * (LAST_BUCKET - FIRST_BUCKET))
}

const STEPS = SPOTTER.steps
const transforms = new Map<number, string>()

/**
 * The transform of a full-height block (origin at its top) that covers `s` of the pillar:
 * moved down to `from`, scaled to its length. Cached per quantised stretch.
 */
export function segmentTransform(s: SpotterSegment): string {
  const from = Math.round(Math.min(1, Math.max(0, s.from)) * STEPS)
  const to = Math.round(Math.min(1, Math.max(0, s.to)) * STEPS)
  const len = Math.max(0, to - from)
  const key = from * (STEPS + 1) + len
  let t = transforms.get(key)
  if (t === undefined) {
    t = `translateY(${(from * 100) / STEPS}%) scaleY(${len / STEPS})`
    transforms.set(key, t)
  }
  return t
}
