import { describe, it, expect } from 'vitest'
import { CarLeftRight } from '@shared/telemetry'
import { spotterState, trackGapM } from './traffic'
import { MOCK_TRACK_LENGTH_M } from './simulation'

describe('spotterState', () => {
  it('maps counts like the real spotter', () => {
    expect(spotterState(0, 0)).toBe(CarLeftRight.Clear)
    expect(spotterState(1, 0)).toBe(CarLeftRight.CarLeft)
    expect(spotterState(0, 1)).toBe(CarLeftRight.CarRight)
    expect(spotterState(1, 1)).toBe(CarLeftRight.CarLeftRight)
    expect(spotterState(2, 1)).toBe(CarLeftRight.CarLeftRight)
    expect(spotterState(2, 0)).toBe(CarLeftRight.Cars2Left)
    expect(spotterState(0, 3)).toBe(CarLeftRight.Cars2Right)
  })
})

describe('trackGapM', () => {
  it('measures along the track, wrapped at the S/F line, whatever the lap', () => {
    expect(trackGapM(14.5, 14.4)).toBeCloseTo(0.1 * MOCK_TRACK_LENGTH_M, 6)
    expect(trackGapM(15.01, 13.99)).toBeCloseTo(0.02 * MOCK_TRACK_LENGTH_M, 6)
    expect(trackGapM(3.25, 7.25)).toBe(0)
  })
})
