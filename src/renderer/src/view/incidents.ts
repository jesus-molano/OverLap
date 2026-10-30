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

/**
 * The count of the edit-mode samples (relative and standings): an official race's limit, which
 * online is the DQ at 17x with no penalty limit before it.
 */
export const PREVIEW_INCIDENTS: Readonly<IncidentCount> = Object.freeze({
  mine: 3,
  team: null,
  limit: Object.freeze({ kind: 'dq', at: 17 } as const)
})

export interface IncidentCountView {
  /** '3x'. */
  readonly count: string
  /** 'eq. 7x' in team races, else ''. */
  readonly team: string
  /** 'pen. a 17x', 'DQ a 25x'; '' without limits. */
  readonly limit: string
  /** The same in full words ('equipo 7x', 'penalización a 17x'), drawn where they fit (R50). */
  readonly teamLong: string
  readonly limitLong: string
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
  let limitLong = ''
  let tone: IncidentCountView['tone'] = 'neutral'
  if (c.limit !== null && at !== null && at > 0) {
    limit = c.limit.kind === 'dq' ? t.dqAt(at) : t.penaltyAt(at)
    limitLong = c.limit.kind === 'dq' ? limit : t.penaltyAtLong(at)
    const left = at - counted
    if (left <= 0) tone = 'bad'
    else if (left <= INCIDENT_WARN_MARGIN) tone = 'warn'
  }
  return {
    count: t.count(mine),
    team: team !== null ? t.team(team) : '',
    limit,
    teamLong: team !== null ? t.teamLong(team) : '',
    limitLong,
    tone
  }
}

/**
 * Whether the header draws the count's extras in full words (R50): from the short words, only
 * when the bar's free room (`freePx`: its width less what its groups take) holds what the long
 * ones add (`addPx`); once drawn, while nothing overflows. Never a wider widget or a cut word.
 */
export function incidentsLong(freePx: number, addPx: number, drawnLong: boolean): boolean {
  if (!(addPx > 0)) return false
  return drawnLong ? freePx >= -0.5 : freePx >= addPx + 1
}
