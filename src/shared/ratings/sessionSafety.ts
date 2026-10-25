/**
 * The SR header of a session, on top of the literal port in safetyRating.ts:
 * the projection "if the session ended now", with the incident budget taken
 * over the whole session when its length is known. Pure.
 */
import type { SafetyRatingProjection } from '../types'
import { projectSafetyRating } from './safetyRating'
import type { SafetyRatingInput } from './safetyRating'

export interface SessionSafetyInput extends SafetyRatingInput {
  /** Corners of the whole session (driven + still to drive), null when unknown. */
  totalCorners: number | null
}

/**
 * Projected SR if the session ended now. `incidentBudget` answers "how many
 * more can I have by the end without losing SR": measured over totalCorners
 * when known (a clean start of a 15-lap race already has a margin), else over
 * the corners driven so far (0 until about one CPI's worth of corners).
 */
export function projectSessionSafetyRating(
  input: SessionSafetyInput
): SafetyRatingProjection | null {
  const { totalCorners, ...now } = input
  const result = projectSafetyRating(now)
  if (result === null || totalCorners === null || !(totalCorners > now.corners)) return result
  const whole = projectSafetyRating({ ...now, corners: totalCorners })
  return whole === null ? result : { ...result, incidentBudget: whole.incidentBudget }
}
