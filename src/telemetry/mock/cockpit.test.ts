import { describe, expect, it } from 'vitest'
import { computeInputs } from '@shared/inputs'
import { parseSessionMeta } from '@shared/session'
import { shiftLit, shiftPhase, SHIFT_LEDS } from '@shared/shiftLights'
import {
  MOCK_REDLINE_RPM,
  MOCK_SHIFT_RPM,
  MOCK_UPSHIFT_RPM,
  mockBrakeBias,
  mockFfbTorque,
  mockRpm,
  mockTractionControl
} from './cockpit'
import { PlayerInputs } from './inputs'
import { PlayerPitStop } from './pitLane'
import { MockRace } from './race'
import { gearFor } from './track'

describe('mock cockpit', () => {
  it('revs climb through each gear to the upshift, past the blink, and drop after it', () => {
    const before = mockRpm(3, 147.9 / 3.6, 900, false)
    const after = mockRpm(4, 148 / 3.6, 900, false)
    expect(before).toBeGreaterThan(MOCK_SHIFT_RPM.blink)
    expect(before).toBeLessThanOrEqual(MOCK_UPSHIFT_RPM)
    expect(after).toBeLessThan(MOCK_SHIFT_RPM.shift)
    expect(after).toBeGreaterThan(MOCK_SHIFT_RPM.first)
    expect(mockRpm(0, 30, 900, false)).toBe(900)
    expect(mockRpm(3, 0, 900, false)).toBe(900)
    expect(mockRpm(3, 30, 900, true)).toBe(0)
    expect(mockRpm(6, 100, 900, false)).toBeLessThanOrEqual(MOCK_REDLINE_RPM)
  })

  it('top speed in 6th sits in the shift band, lit but not blinking', () => {
    const rpm = mockRpm(gearFor(72), 72, 900, false)
    const sl = MOCK_SHIFT_RPM
    expect(shiftPhase(rpm, sl.first, sl.shift, sl.blink)).toBe('shift')
    expect(shiftLit(rpm, sl.first, sl.last)).toBe(SHIFT_LEDS)
  })

  it('the driver dials the bias back and the TC down during the race', () => {
    expect(mockBrakeBias(0)).toBe(54.5)
    expect(mockBrakeBias(200)).toBe(54)
    expect(mockBrakeBias(1000)).toBe(53.5)
    expect(mockTractionControl(0)).toBe(4)
    expect(mockTractionControl(300)).toBe(3)
  })

  it('force feedback clips in the fastest corners only, for moments', () => {
    const inputs = new PlayerInputs()
    const pit = new PlayerPitStop()
    let clipped = 0
    let samples = 0
    let runs = 0
    let was = false
    for (let i = 0; i < 7000; i++) {
      inputs.update(i / 7000, i * 0.03, pit, 1)
      const clip = mockFfbTorque(inputs.steer, inputs.speed) >= 0.995
      if (clip) clipped++
      if (clip && !was) runs++
      was = clip
      samples++
    }
    expect(runs).toBeGreaterThanOrEqual(2)
    expect(clipped / samples).toBeGreaterThan(0.01)
    expect(clipped / samples).toBeLessThan(0.1)
    // Slow corners and straights stay well under it.
    expect(mockFfbTorque(0, 70)).toBeLessThan(0.2)
    expect(mockFfbTorque(3, 21)).toBeLessThan(0.995)
  })

  it('feeds the pedals a plausible car block from the YAML and the frame', () => {
    const race = new MockRace()
    for (let i = 0; i < 600; i++) race.step(1 / 60)
    const session = parseSessionMeta(race.sessionInfo())
    expect(session.shiftRpm).toEqual(MOCK_SHIFT_RPM)
    const d = computeInputs(race.frame(), session)
    expect(d.slFirst).toBe(MOCK_SHIFT_RPM.first)
    expect(d.rpm).toBeGreaterThan(0)
    expect(d.brakeBias).toBe(54.5)
    expect(d.tc).toBe(4)
    expect(d.ffb).not.toBeNull()
  })
})
