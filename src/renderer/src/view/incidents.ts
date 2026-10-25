/**
 * Your incident count as the relative and standings headers draw it: '3x', the team's
 * ('eq. 7x') and the session's next limit ('pen. a 17x', 'DQ a 25x'), each its own piece so a
 * narrow header can drop the extras first. Pure. Words from the dictionary `m`.
 */
import type { Messages } from '@shared/i18n'
import type { IncidentCount } from '@shared/types'
import type { Tone } from '@renderer/ui/tones'

/** The next limit this close (incidents left, one car contact) turns the count to a warning. */
export const INCIDENT_WARN_MARGIN = 4

/** The count of the edit-mode samples (relative and standings): an official race's penalty. */
export const PREVIEW_INCIDENTS: Readonly<IncidentCount> = Object.freeze({
  mine: 3,
  team: null,
  limit: Object.freeze({ kind: 'penalty', at: 17 } as const)
})

export interface IncidentCountView {
  /** '3x'. */
  readonly count: string
  /** 'eq. 7x' in team races, else ''. */
  readonly team: string
  /** 'pen. a 17x', 'DQ a 25x'; '' without limits. */
  readonly limit: string
  /**
   * neutral; warn: the next limit is INCIDENT_WARN_MARGIN or less away; bad: the DQ is
   * reached. The words say it too (the colour is never alone).
   */
  readonly tone: Extract<Tone, 'neutral' | 'warn' | 'bad'>
}

function whole(n: number): number | null {
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
}

/** The header pieces, null when there is no count to show (no player car). */
export function toIncidentCountView(
  c: IncidentCount | null,
  m: Messages
): IncidentCountView | null {
  const mine = c !== null ? whole(c.mine) : null
  if (c === null || mine === null) return null
  const t = m.widgets.incidents
  const team = c.team !== null ? whole(c.team) : null
  const counted = team ?? mine
  const at = c.limit !== null ? whole(c.limit.at) : null
  let limit = ''
  let tone: IncidentCountView['tone'] = 'neutral'
  if (c.limit !== null && at !== null && at > 0) {
    limit = c.limit.kind === 'dq' ? t.dqAt(at) : t.penaltyAt(at)
    const left = at - counted
    if (left <= 0) tone = 'bad'
    else if (left <= INCIDENT_WARN_MARGIN) tone = 'warn'
  }
  return { count: t.count(mine), team: team !== null ? t.team(team) : '', limit, tone }
}
