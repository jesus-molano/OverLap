/**
 * The incident line of the alerts banner: the tracker's last incident while it is shown. It
 * keeps the alerts' minimum time on screen (holdS), and never less than INCIDENT_ALERT.minS
 * after its last point: it is read while driving. Pure.
 */
import type { IncidentAlert } from '../types'
import type { IncidentEvent } from './tracker'

export const INCIDENT_ALERT = {
  /** Shown at least this long (s) after the incident's last point, whatever holdS says. */
  minS: 6
} as const

/** The alert of `ev` at SessionTime `now`, null once its time is up (or before it, a replay). */
export function incidentAlert(
  ev: IncidentEvent | null,
  now: number,
  holdS: number
): IncidentAlert | null {
  if (ev === null || !Number.isFinite(now) || now < ev.startT) return null
  const showS = Math.max(Number.isFinite(holdS) ? holdS : 0, INCIDENT_ALERT.minS)
  if (now - ev.lastT >= showS) return null
  return { points: ev.points, kind: ev.kind, lap: ev.lap, sector: ev.sector, surface: ev.surface }
}

/** Structural equality (for the alerts' SKIP_EMIT). */
export function incidentAlertEqual(a: IncidentAlert | null, b: IncidentAlert | null): boolean {
  if (a === null || b === null) return a === b
  return (
    a.points === b.points &&
    a.kind === b.kind &&
    a.lap === b.lap &&
    a.sector === b.sector &&
    a.surface === b.surface
  )
}
