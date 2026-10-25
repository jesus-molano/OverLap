/**
 * The incident count of the relative and standings headers, from one tick: yours, the team's
 * in team races and the next limit of the session. iRacing counts per session, so it starts
 * over by itself with every new one. Pure.
 */
import { resolvePlayerCarIdx } from '../sessionInfo'
import type { TelemetryFrame } from '../telemetry'
import type { IncidentCount, IncidentThreshold, SessionMeta } from '../types'
import { nextIncidentLimit } from './limits'

/** A count as a whole number >= 0, null when missing or not a number. */
export function countOf(v: number | undefined): number | null {
  return v !== undefined && Number.isFinite(v) && v >= 0 ? Math.round(v) : null
}

/** Your count this tick, null without a player car (spectating) or the variable. */
export function incidentCount(frame: TelemetryFrame, session: SessionMeta): IncidentCount | null {
  const player = resolvePlayerCarIdx(frame, session)
  if (player < 0 || session.drivers.get(player)?.isSpectator === true) return null
  const mine = countOf(frame.PlayerCarMyIncidentCount[0])
  if (mine === null) return null
  const team = session.teamRacing ? countOf(frame.PlayerCarTeamIncidentCount[0]) : null
  // A team race's limits are the car's: everyone's incidents count towards them.
  return { mine, team, limit: nextIncidentLimit(team ?? mine, session.incidentLimits) }
}

function thresholdEqual(a: IncidentThreshold | null, b: IncidentThreshold | null): boolean {
  if (a === null || b === null) return a === b
  return a.kind === b.kind && a.at === b.at
}

/** Structural equality (for the SKIP_EMIT rules of the widgets that carry it). */
export function incidentCountEqual(a: IncidentCount | null, b: IncidentCount | null): boolean {
  if (a === null || b === null) return a === b
  return a.mine === b.mine && a.team === b.team && thresholdEqual(a.limit, b.limit)
}
