import { describe, expect, it } from 'vitest'
import { NBSP } from '@shared/format'
import { messagesFor } from '@shared/i18n'
import type { IncidentCount } from '@shared/types'
import { INCIDENT_WARN_MARGIN, PREVIEW_INCIDENTS, toIncidentCountView } from './incidents'

const ES = messagesFor('es')
const EN = messagesFor('en')
const NB = NBSP

const count = (o: Partial<IncidentCount> = {}): IncidentCount => ({
  mine: 3,
  team: null,
  limit: null,
  ...o
})

describe('toIncidentCountView', () => {
  it('your count alone without limits (an unlimited session)', () => {
    expect(toIncidentCountView(count({ mine: 11 }), ES)).toEqual({
      count: '11x',
      team: '',
      limit: '',
      tone: 'neutral'
    })
  })

  it("the team's count and the next limit, in both languages", () => {
    const c = count({ team: 7, limit: { kind: 'penalty', at: 17 } })
    expect(toIncidentCountView(c, ES)).toEqual({
      count: '3x',
      team: `eq.${NB}7x`,
      limit: `pen.${NB}a${NB}17x`,
      tone: 'neutral'
    })
    expect(toIncidentCountView(c, EN)).toMatchObject({
      team: `team${NB}7x`,
      limit: `pen.${NB}at${NB}17x`
    })
    expect(toIncidentCountView(count({ limit: { kind: 'dq', at: 25 } }), ES)?.limit).toBe(
      `DQ${NB}a${NB}25x`
    )
  })

  it('warns close to the limit (the team counts in team races), bad once the DQ is reached', () => {
    const at = (mine: number, team: number | null, kind: 'penalty' | 'dq' = 'penalty'): string =>
      toIncidentCountView(count({ mine, team, limit: { kind, at: 17 } }), ES)?.tone ?? ''
    expect(at(17 - INCIDENT_WARN_MARGIN - 1, null)).toBe('neutral')
    expect(at(17 - INCIDENT_WARN_MARGIN, null)).toBe('warn')
    expect(at(16, null)).toBe('warn')
    expect(at(2, 14)).toBe('warn')
    expect(at(17, null, 'dq')).toBe('bad')
  })

  it('nothing to show without a count', () => {
    expect(toIncidentCountView(null, ES)).toBeNull()
    expect(toIncidentCountView(count({ mine: Number.NaN }), ES)).toBeNull()
    expect(toIncidentCountView(count({ mine: -1 }), ES)).toBeNull()
  })

  it('the samples show a penalty limit', () => {
    expect(toIncidentCountView(PREVIEW_INCIDENTS, ES)).toMatchObject({
      count: '3x',
      limit: `pen.${NB}a${NB}17x`
    })
  })
})
