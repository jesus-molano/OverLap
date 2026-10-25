import { describe, expect, it } from 'vitest'
import { TrackLocation } from '../telemetry'
import { PitEntryReminder } from './pitEntry'

const { OnTrack, ApproachingPits, InPitStall, OffTrack } = TrackLocation

describe('PitEntryReminder', () => {
  it('reminds from the step onto the lead-in, limiter off, until pit road', () => {
    const r = new PitEntryReminder()
    expect(r.update(OnTrack, false, false)).toBe(false)
    expect(r.update(ApproachingPits, false, false)).toBe(true)
    expect(r.update(ApproachingPits, false, false)).toBe(true)
    // The limiter goes on: quiet; off again before pit road: back.
    expect(r.update(ApproachingPits, false, true)).toBe(false)
    expect(r.update(ApproachingPits, false, false)).toBe(true)
    // Pit road: the limiter line takes over, and the stall and the exit stay quiet.
    expect(r.update(ApproachingPits, true, false)).toBe(false)
    expect(r.update(InPitStall, true, false)).toBe(false)
    expect(r.update(ApproachingPits, true, false)).toBe(false)
    expect(r.update(ApproachingPits, false, false)).toBe(false)
    expect(r.update(OnTrack, false, false)).toBe(false)
  })

  it('stops when you drive past the entry; only the track to lead-in step arms it', () => {
    const r = new PitEntryReminder()
    r.update(OnTrack, false, false)
    expect(r.update(ApproachingPits, false, false)).toBe(true)
    expect(r.update(OnTrack, false, false)).toBe(false)
    // From off track or from nothing known: no reminder.
    expect(r.update(OffTrack, false, false)).toBe(false)
    expect(r.update(ApproachingPits, false, false)).toBe(false)
    const late = new PitEntryReminder()
    expect(late.update(ApproachingPits, false, false)).toBe(false)
  })

  it('never reminds without the limiter bit, and forgets on resume()', () => {
    const r = new PitEntryReminder()
    r.update(OnTrack, false, null)
    expect(r.update(ApproachingPits, false, null)).toBe(false)
    expect(r.update(ApproachingPits, false, false)).toBe(true)
    r.resume()
    expect(r.update(ApproachingPits, false, false)).toBe(false)
    expect(r.update(undefined, false, false)).toBe(false)
  })
})
