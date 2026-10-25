/**
 * Incident limits of the session (WeekendInfo.WeekendOptions) and the next one ahead of a
 * count. The values are text in the YAML ('unlimited' or a number; js-yaml makes a bare number
 * a number) and the warning ones are not in the SDK's types: anything else reads as no limit.
 * What exactly happens at each one (and its format online) is only confirmed in an official
 * race: IncidentLimit is read as the DQ, the warnings as penalties. Pure.
 */
import type { IncidentLimits, IncidentThreshold } from '../types'

export const NO_INCIDENT_LIMITS: IncidentLimits = Object.freeze({
  dq: null,
  penalty: null,
  penaltyEvery: null
})

/** No session limit is higher than this: anything above is a corrupt value. */
const MAX_LIMIT = 9999

/** 17 or '17' -> 17; 'unlimited', 0, negatives, fractions and anything else -> null. */
export function parseLimit(v: unknown): number | null {
  const n = typeof v === 'string' && /^\s*\d+\s*$/.test(v) ? Number(v) : v
  return typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= MAX_LIMIT ? n : null
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** WeekendInfo.WeekendOptions to the session's limits (all null without any). */
export function parseIncidentLimits(weekendOptions: unknown): IncidentLimits {
  if (!isObj(weekendOptions)) return NO_INCIDENT_LIMITS
  const dq = parseLimit(weekendOptions.IncidentLimit)
  const penalty = parseLimit(weekendOptions.IncidentWarningInitialLimit)
  // Every N more only means something after a first one.
  const penaltyEvery =
    penalty !== null ? parseLimit(weekendOptions.IncidentWarningSubsequentLimit) : null
  if (dq === null && penalty === null) return NO_INCIDENT_LIMITS
  return { dq, penalty, penaltyEvery }
}

/** The next penalty ahead of `count`: the first one, then every penaltyEvery; null when none. */
function nextPenalty(count: number, l: IncidentLimits): number | null {
  if (l.penalty === null) return null
  if (count < l.penalty) return l.penalty
  if (l.penaltyEvery === null) return null
  return l.penalty + l.penaltyEvery * (Math.floor((count - l.penalty) / l.penaltyEvery) + 1)
}

/**
 * The limit that comes next for `count` incidents: the nearer of the next penalty and the DQ
 * (the DQ once it is reached: there is nothing after it); null without limits.
 */
export function nextIncidentLimit(count: number, l: IncidentLimits): IncidentThreshold | null {
  if (!Number.isFinite(count)) return null
  const pen = nextPenalty(count, l)
  if (l.dq !== null && (pen === null || l.dq <= pen || count >= l.dq)) {
    return { kind: 'dq', at: l.dq }
  }
  return pen !== null ? { kind: 'penalty', at: pen } : null
}
