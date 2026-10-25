import { describe, expect, it } from 'vitest'
import { crossingsUntil, lapLimitedLapsLeft, timedRaceEndS } from './lapsRemaining'

describe('laps remaining arithmetic', () => {
  it('counts S/F crossings up to the first one at or after a deadline', () => {
    // T = 600 s, pace 90 s, pct 0.25: crossings at 67.5, 157.5, ..., 607.5 -> 7.
    expect(crossingsUntil(600, 0.25, 90)).toBe(7)
    expect(timedRaceEndS(600, 0.25, 90)).toBeCloseTo(607.5, 9)
    // Exactly on a crossing counts as "at".
    expect(crossingsUntil(607.5, 0.25, 90)).toBe(7)
    expect(crossingsUntil(157.5, 0.25, 90)).toBe(2)
    // Time already up: the lap in progress is the last one.
    expect(crossingsUntil(0, 0.5, 90)).toBe(1)
    expect(crossingsUntil(-5, 0.5, 90)).toBe(1)
    // Pace 92, pct 0.6: 36.8, 128.8, ..., 588.8, 680.8 -> 8 crossings until 607.5.
    expect(crossingsUntil(607.5, 0.6, 92)).toBe(8)
    // Pace 100, pct 0.1: 90, 190, ..., 590, 690 -> 7.
    expect(crossingsUntil(607.5, 0.1, 100)).toBe(7)
  })

  it('subtracts whole laps down from the leader finishing lap', () => {
    // Leader at 3.5 with 5 laps left: it takes the flag at lap 8.
    expect(lapLimitedLapsLeft(8, 3.5, 3.5)).toBe(5)
    expect(lapLimitedLapsLeft(8, 3.5, 3.2)).toBe(5)
    // Just behind on the previous lap: still has to finish lap 3.
    expect(lapLimitedLapsLeft(8, 3.5, 2.99)).toBe(6)
    // A lap down: finishes at lap 7.
    expect(lapLimitedLapsLeft(8, 3.5, 2.4)).toBe(5)
  })
})
