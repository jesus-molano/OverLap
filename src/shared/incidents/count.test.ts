import { describe, expect, it } from 'vitest'
import { makeDriver, makeFrame, makeSession } from '../race/testing/raceSim'
import type { IncidentCount } from '../types'
import { countOf, incidentCount, incidentCountEqual } from './count'

const LIMITS = { dq: 25, penalty: 17, penaltyEvery: 8 }

describe('incidentCount', () => {
  it('your count and the next limit, in any session', () => {
    const f = makeFrame()
    f.PlayerCarMyIncidentCount[0] = 11
    expect(incidentCount(f, makeSession(3))).toEqual({ mine: 11, team: null, limit: null })
    expect(incidentCount(f, makeSession(3, { incidentLimits: LIMITS }))).toEqual({
      mine: 11,
      team: null,
      limit: { kind: 'penalty', at: 17 }
    })
  })

  it("adds the team's count in team races, and the limits count it", () => {
    const f = makeFrame()
    f.PlayerCarMyIncidentCount[0] = 3
    f.PlayerCarTeamIncidentCount[0] = 18
    const team = makeSession(3, { teamRacing: true, incidentLimits: LIMITS })
    expect(incidentCount(f, team)).toEqual({ mine: 3, team: 18, limit: { kind: 'dq', at: 25 } })
    // Outside team races the variable is ignored.
    expect(incidentCount(f, makeSession(3, { incidentLimits: LIMITS }))?.team).toBeNull()
    // A team count the car does not have: yours counts.
    f.PlayerCarTeamIncidentCount.length = 0
    expect(incidentCount(f, team)).toEqual({
      mine: 3,
      team: null,
      limit: { kind: 'penalty', at: 17 }
    })
  })

  it('is null without a player car, as a spectator or without the variable', () => {
    const f = makeFrame()
    f.PlayerCarMyIncidentCount[0] = 2
    f.PlayerCarIdx[0] = -1
    expect(incidentCount(f, makeSession(3, { playerCarIdx: -1 }))).toBeNull()
    f.PlayerCarIdx[0] = 0
    const spectator = makeSession(1, {}, [makeDriver(0, { isSpectator: true })])
    expect(incidentCount(f, spectator)).toBeNull()
    f.PlayerCarMyIncidentCount.length = 0
    expect(incidentCount(f, makeSession(3))).toBeNull()
  })

  it('reads counts as whole numbers >= 0', () => {
    expect(countOf(3)).toBe(3)
    expect(countOf(2.6)).toBe(3)
    expect(countOf(-1)).toBeNull()
    expect(countOf(Number.NaN)).toBeNull()
    expect(countOf(undefined)).toBeNull()
  })
})

describe('incidentCountEqual', () => {
  const base: IncidentCount = { mine: 3, team: 7, limit: { kind: 'penalty', at: 17 } }

  it('is structural and sees every field', () => {
    expect(incidentCountEqual(base, structuredClone(base))).toBe(true)
    expect(incidentCountEqual(null, null)).toBe(true)
    const changed: IncidentCount[] = [
      { ...base, mine: 4 },
      { ...base, team: null },
      { ...base, limit: null },
      { ...base, limit: { kind: 'dq', at: 17 } },
      { ...base, limit: { kind: 'penalty', at: 25 } }
    ]
    for (const c of changed) expect(incidentCountEqual(base, c), JSON.stringify(c)).toBe(false)
    expect(incidentCountEqual(base, null)).toBe(false)
    expect(incidentCountEqual(null, base)).toBe(false)
  })
})
