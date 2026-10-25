import { describe, it, expect } from 'vitest'
import {
  CYCLE_S,
  ESCORT_PARK_M,
  ESCORT_PERIOD_S,
  ORBIT_CYCLES,
  SAME_SLOTS,
  SCRIPT_A,
  SCRIPT_B,
  sampleEscort,
  sampleScript
} from './scripts'
import { TRACK_LENGTH_M } from './track'

const DT = 1 / 60
/** The radar's longest range (RadarOptions.rangeM max). */
const RADAR_MAX_M = 100

describe('sampleEscort', () => {
  for (const [name, keys] of [
    ['A', SCRIPT_A],
    ['B', SCRIPT_B]
  ] as const) {
    it(`follows the orbit first, then waits beyond the radar's range (${name})`, () => {
      const orbitS = ORBIT_CYCLES * CYCLE_S
      for (let t = 0; t < orbitS; t += 0.5) {
        expect(sampleEscort(keys, t, 1)).toBe(sampleScript(keys, t, 1))
        expect(sampleEscort(keys, t, 2)).toBe(sampleScript(keys, t, 2))
      }
      // Away and back take 30 s each; in between it waits ahead, in its lane.
      const lane = sampleScript(keys, 0, 2)
      for (let t = orbitS + 30; t <= ESCORT_PERIOD_S - 30; t += 1) {
        expect(sampleEscort(keys, t, 1)).toBeCloseTo(ESCORT_PARK_M, 9)
        expect(sampleEscort(keys, t, 2)).toBe(lane)
      }
      expect(ESCORT_PARK_M).toBeGreaterThan(RADAR_MAX_M)
      // Back where the orbit starts, and round again.
      expect(sampleEscort(keys, ESCORT_PERIOD_S, 1)).toBeCloseTo(sampleScript(keys, 0, 1), 9)
      expect(sampleEscort(keys, ESCORT_PERIOD_S + 7, 1)).toBe(sampleScript(keys, 7, 1))
    })

    it(`moves smoothly relative to the player: under 15 m/s along the track, 6 m/s sideways (${name})`, () => {
      let prev = sampleEscort(keys, 0, 1)
      let prevLat = sampleEscort(keys, 0, 2)
      for (let t = DT; t < 2 * ESCORT_PERIOD_S; t += DT) {
        const gap = sampleEscort(keys, t, 1)
        const lat = sampleEscort(keys, t, 2)
        expect(Math.abs(gap - prev) / DT, `t=${t.toFixed(2)}`).toBeLessThan(15)
        expect(Math.abs(lat - prevLat) / DT, `t=${t.toFixed(2)}`).toBeLessThan(6)
        prev = gap
        prevLat = lat
      }
    })
  }

  it('changes the gap by under ~3 s of road over any lap (escort laps stay near the player)', () => {
    const lapS = 139
    for (const keys of [SCRIPT_A, SCRIPT_B]) {
      for (let t = 0; t < 2 * ESCORT_PERIOD_S; t += 1) {
        const change = sampleEscort(keys, t + lapS, 1) - sampleEscort(keys, t, 1)
        expect(Math.abs(change) / (TRACK_LENGTH_M / lapS), `t=${t}`).toBeLessThan(3.2)
      }
    }
  })
})

describe('SAME_SLOTS', () => {
  it('puts the slow lapped classmates ahead on the road, none within ~450 m of the player', () => {
    const lapped = SAME_SLOTS.filter(([, laps]) => laps < 0)
    expect(lapped.filter(([offset]) => offset > 0).length).toBeGreaterThanOrEqual(3)
    for (const [offset] of SAME_SLOTS) {
      expect(Math.abs(offset) * TRACK_LENGTH_M).toBeGreaterThanOrEqual(450)
    }
  })
})
