import { describe, expect, it } from 'vitest'
import { isRatedEvent } from './rated'
import { projectSafetyRating } from './safetyRating'
import { projectSessionSafetyRating } from './sessionSafety'

/** B 3.00 on band 3 (LicLevel 15) in a race. */
const B300 = { licLevel: 15, licSubLevel: 300, sessionType: 'Race' }

describe('projectSessionSafetyRating', () => {
  it('a clean start of a 15-lap race on a 14-turn track already has a margin of 6x', () => {
    const sr = projectSessionSafetyRating({ ...B300, incidents: 0, corners: 0, totalCorners: 210 })
    expect(sr).toMatchObject({ current: 3, projected: 3, incidents: 0, corners: 0 })
    expect(sr?.incidentBudget).toBe(6)
    // The "ended now" budget would be 0 (red "sin margen" for a clean driver).
    expect(projectSafetyRating({ ...B300, incidents: 0, corners: 0 })?.incidentBudget).toBe(0)
  })

  it('takes the incidents so far out of the whole-session margin', () => {
    const sr = projectSessionSafetyRating({ ...B300, incidents: 2, corners: 70, totalCorners: 210 })
    expect(sr?.incidentBudget).toBe(4)
    // The projection itself is still "if the race ended now".
    expect(sr?.projected).toBe(
      projectSafetyRating({ ...B300, incidents: 2, corners: 70 })?.projected
    )
    expect(sr?.corners).toBe(70)
  })

  it('is 0 once the whole session cannot be held', () => {
    const sr = projectSessionSafetyRating({
      ...B300,
      incidents: 9,
      corners: 100,
      totalCorners: 210
    })
    expect(sr?.incidentBudget).toBe(0)
  })

  it('keeps the "ended now" budget when the length is unknown or already driven', () => {
    const input = { ...B300, incidents: 1, corners: 140 }
    const now = projectSafetyRating(input)
    expect(projectSessionSafetyRating({ ...input, totalCorners: null })).toEqual(now)
    expect(projectSessionSafetyRating({ ...input, totalCorners: 140 })).toEqual(now)
    expect(projectSessionSafetyRating({ ...input, totalCorners: 100 })).toEqual(now)
  })

  it('is null when the port has no projection (unknown licence, session that does not count)', () => {
    expect(
      projectSessionSafetyRating({
        ...B300,
        licLevel: 0,
        incidents: 0,
        corners: 0,
        totalCorners: 1
      })
    ).toBeNull()
    expect(
      projectSessionSafetyRating({
        ...B300,
        sessionType: 'Lone Spectate',
        incidents: 0,
        corners: 0,
        totalCorners: 1
      })
    ).toBeNull()
  })
})

describe('isRatedEvent', () => {
  it('is only true for official race events', () => {
    expect(isRatedEvent({ official: true, eventType: 'Race' })).toBe(true)
    expect(isRatedEvent({ official: true, eventType: ' race ' })).toBe(true)
    // Test drive, hosted / league / AI (never official), unknown.
    expect(isRatedEvent({ official: false, eventType: 'Test' })).toBe(false)
    expect(isRatedEvent({ official: false, eventType: 'Race' })).toBe(false)
    expect(isRatedEvent({ official: true, eventType: 'Test' })).toBe(false)
    expect(isRatedEvent({ official: true, eventType: '' })).toBe(false)
  })
})
