import { describe, expect, it } from 'vitest'
import type { IncidentLimits } from '../types'
import { NO_INCIDENT_LIMITS, nextIncidentLimit, parseIncidentLimits, parseLimit } from './limits'

describe('parseLimit', () => {
  it('takes whole positive numbers, bare or as text', () => {
    expect(parseLimit(17)).toBe(17)
    expect(parseLimit('17')).toBe(17)
    expect(parseLimit(' 25 ')).toBe(25)
  })

  it("is null for 'unlimited' and anything that is not a sane limit", () => {
    for (const v of [
      'unlimited',
      '',
      '17x',
      '1.5',
      1.5,
      0,
      -1,
      10_000,
      null,
      undefined,
      {},
      true
    ]) {
      expect(parseLimit(v), String(v)).toBeNull()
    }
  })
})

describe('parseIncidentLimits', () => {
  it('reads the DQ and the penalties', () => {
    expect(
      parseIncidentLimits({
        IncidentLimit: 25,
        IncidentWarningInitialLimit: 17,
        IncidentWarningSubsequentLimit: 8
      })
    ).toEqual({ dq: 25, penalty: 17, penaltyEvery: 8 })
  })

  it('ignores a subsequent limit without a first one', () => {
    expect(parseIncidentLimits({ IncidentWarningSubsequentLimit: 8 })).toBe(NO_INCIDENT_LIMITS)
    expect(parseIncidentLimits({ IncidentLimit: 40, IncidentWarningSubsequentLimit: 8 })).toEqual({
      dq: 40,
      penalty: null,
      penaltyEvery: null
    })
  })

  it('shares one frozen value without limits', () => {
    expect(parseIncidentLimits({ IncidentLimit: 'unlimited' })).toBe(NO_INCIDENT_LIMITS)
    expect(parseIncidentLimits(null)).toBe(NO_INCIDENT_LIMITS)
    expect(parseIncidentLimits([25])).toBe(NO_INCIDENT_LIMITS)
    expect(Object.isFrozen(NO_INCIDENT_LIMITS)).toBe(true)
  })
})

describe('nextIncidentLimit', () => {
  const L = (o: Partial<IncidentLimits>): IncidentLimits => ({ ...NO_INCIDENT_LIMITS, ...o })

  it('is null without limits', () => {
    expect(nextIncidentLimit(11, NO_INCIDENT_LIMITS)).toBeNull()
    expect(nextIncidentLimit(Number.NaN, L({ dq: 25 }))).toBeNull()
  })

  it('the first penalty, then every subsequent one', () => {
    const l = L({ penalty: 17, penaltyEvery: 8 })
    expect(nextIncidentLimit(0, l)).toEqual({ kind: 'penalty', at: 17 })
    expect(nextIncidentLimit(16, l)).toEqual({ kind: 'penalty', at: 17 })
    expect(nextIncidentLimit(17, l)).toEqual({ kind: 'penalty', at: 25 })
    expect(nextIncidentLimit(24, l)).toEqual({ kind: 'penalty', at: 25 })
    expect(nextIncidentLimit(25, l)).toEqual({ kind: 'penalty', at: 33 })
    // Only one penalty: nothing after it.
    expect(nextIncidentLimit(17, L({ penalty: 17 }))).toBeNull()
  })

  it('the DQ when it comes first, and once it is reached', () => {
    const l = L({ dq: 25, penalty: 17, penaltyEvery: 8 })
    expect(nextIncidentLimit(11, l)).toEqual({ kind: 'penalty', at: 17 })
    // The next penalty would be at 25 too: the DQ.
    expect(nextIncidentLimit(17, l)).toEqual({ kind: 'dq', at: 25 })
    expect(nextIncidentLimit(30, l)).toEqual({ kind: 'dq', at: 25 })
    expect(nextIncidentLimit(3, L({ dq: 25 }))).toEqual({ kind: 'dq', at: 25 })
  })
})
