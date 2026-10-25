/**
 * The incident line of the alerts banner: '+2x', what it was and where it happened
 * ('Pérdida de control', '· V5 · S3 · grava'). The words come from the dictionary `m`; the
 * shape (the rail, the warning mark, the points in the tone) says "incident" without them and
 * without its colour, the colour-blind palette included. Pure.
 */
import type { Messages } from '@shared/i18n'
import type { IncidentAlert, IncidentKind, IncidentSurface } from '@shared/types'

/** Points from which an incident reads as a serious one (a car contact is 4x). */
export const SERIOUS_POINTS = 4

export interface IncidentLineView {
  /** '+2x'. */
  readonly points: string
  /** 'Pérdida de control'; '' when PlayerIncidents reported nothing (just '+2x'). */
  readonly label: string
  /** '· V5 · S3 · grava' after the label ('V5 · S3' alone without one); '' when unknown. */
  readonly detail: string
  /** warn; bad from SERIOUS_POINTS (the number says it too). */
  readonly tone: 'warn' | 'bad'
}

const SEP = ' · '

function positiveInt(n: number | null): number | null {
  return n !== null && Number.isFinite(n) && n >= 1 ? Math.round(n) : null
}

/** The payload carries an incident to show (it crosses IPC: anything else is none). */
export function hasIncident(a: IncidentAlert | null | undefined): a is IncidentAlert {
  return a !== null && a !== undefined && positiveInt(a.points) !== null
}

/** The line for `a`, null when there is none to show (or the option is off). */
export function incidentLineView(
  a: IncidentAlert | null | undefined,
  showIncidents: boolean,
  m: Messages
): IncidentLineView | null {
  if (!showIncidents || !hasIncident(a)) return null
  const points = positiveInt(a.points) ?? 1
  const t = m.widgets.incidents
  // Records, so a kind or surface the dictionary lacks fails the build.
  const kinds: Readonly<Record<IncidentKind, string>> = t.kinds
  const surfaces: Readonly<Record<IncidentSurface, string>> = t.surfaces
  const label = a.kind !== null ? (kinds[a.kind] ?? '') : ''
  const lap = positiveInt(a.lap)
  const sector = positiveInt(a.sector)
  const where: string[] = []
  if (lap !== null) where.push(t.lap(lap))
  if (sector !== null) where.push(m.widgets.common.sector(sector))
  const surface = a.surface !== null ? (surfaces[a.surface] ?? '') : ''
  if (surface !== '') where.push(surface)
  const detail = where.length === 0 ? '' : (label !== '' ? SEP.trimStart() : '') + where.join(SEP)
  return {
    points: t.added(points),
    label,
    detail,
    tone: points >= SERIOUS_POINTS ? 'bad' : 'warn'
  }
}
