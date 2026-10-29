/**
 * Structural equality of your rating projections (for the SKIP_EMIT rules of the standings and
 * the info bars). Pure.
 */
import { sameNumber } from '../equal'
import type { PlayerRatingProjection, SafetyRatingProjection } from '../types'

/** sameNumber for nullable numbers. */
function same(a: number | null, b: number | null): boolean {
  return a === null || b === null ? a === b : sameNumber(a, b)
}

export function projectionEqual(
  a: PlayerRatingProjection | null,
  b: PlayerRatingProjection | null
): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  return (
    sameNumber(a.iRatingDelta, b.iRatingDelta) &&
    sameNumber(a.perPosition, b.perPosition) &&
    sameNumber(a.breakEvenPosition, b.breakEvenPosition) &&
    same(a.ifGainOne, b.ifGainOne) &&
    same(a.ifLoseOne, b.ifLoseOne)
  )
}

export function safetyEqual(
  a: SafetyRatingProjection | null,
  b: SafetyRatingProjection | null
): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  return (
    sameNumber(a.current, b.current) &&
    sameNumber(a.projected, b.projected) &&
    a.licClass === b.licClass &&
    a.projectedLicClass === b.projectedLicClass &&
    sameNumber(a.incidents, b.incidents) &&
    sameNumber(a.corners, b.corners) &&
    sameNumber(a.incidentBudget, b.incidentBudget)
  )
}
