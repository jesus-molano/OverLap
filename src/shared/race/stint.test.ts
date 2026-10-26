import { describe, expect, it } from 'vitest'
import { SessionState } from '../telemetry'
import { LAP_S, PRACTICE, Sim, V, car, makeSession, type Cars } from './testing/raceSim'

describe('RaceModel stints', () => {
  it('counts from the green flag when it saw it', () => {
    const sim = new Sim(makeSession(1), { state: SessionState.ParadeLaps })
    const cars = (t: number): Cars => ({ 0: { d: 0.9 + V * t } })
    sim.run(1, 60, cars)
    sim.state = SessionState.Racing
    sim.run(1.5, 60, cars)
    expect(car(sim.view, 0).stintLaps).toBe(0)
    sim.run(3, 60, cars) // crosses 1.0 at t = 3
    expect(car(sim.view, 0).stintLaps).toBe(1)
  })

  it('joined after the green, counts from the start until it sees a stop', () => {
    // Racing from the first tick: the model never saw the grid (an app or telemetry restart).
    const sim = new Sim(makeSession(2))
    const cars = (t: number): Cars => {
      const d0 = 12.3 + V * t
      return {
        // Car 0 drives through pit road at 13.4..13.6 (t = 33..39).
        0: { d: d0, pit: d0 > 13.4 && d0 < 13.6 },
        1: { d: 11.8 + V * t }
      }
    }
    sim.run(1, 60, cars)
    // As far as the model knows nobody has stopped: every stint is the race so far.
    expect(car(sim.view, 0).stintLaps).toBe(12)
    expect(car(sim.view, 1).stintLaps).toBe(11)
    expect(car(sim.view, 0).pitStops).toBe(0)
    sim.run(35, 60, cars) // t = 36: in the pits
    expect(car(sim.view, 0).stintLaps).toBe(13)
    sim.run(4, 60, cars) // t = 40: out of the pits
    expect(car(sim.view, 0)).toMatchObject({ stintLaps: 0, lastPitLap: 13, pitStops: 1 })
    sim.run(20, 60, cars) // crossed 14.0 at t = 51
    expect(car(sim.view, 0).stintLaps).toBe(1)
    expect(car(sim.view, 1).stintLaps).toBe(13)
  })

  it('keeps the laps driven across frames it did not see: a replay, a reconnect, a gap', () => {
    const cars = (t: number): Cars => ({ 0: { d: 3.6 + V * t }, 1: { d: 2.2 + V * t } })
    const stints = (gap: 'none' | 'replay' | 'reconnect' | 'frames', missedS: number): number[] => {
      const sim = new Sim(makeSession(2))
      sim.run(5, 60, cars)
      if (gap === 'replay') sim.model.breakContinuity()
      if (gap === 'reconnect') sim.model.reset()
      // Both cars cross a line meanwhile (car 0 at 4.0, car 1 at 3.0; LAP_S: a whole lap).
      sim.t += missedS
      sim.run(40 - missedS, 60, cars)
      return [car(sim.view, 0).stintLaps, car(sim.view, 1).stintLaps]
    }
    const plain = stints('none', 0)
    expect(plain).toEqual([5, 3])
    for (const gap of ['replay', 'reconnect', 'frames'] as const) {
      expect(stints(gap, 12)).toEqual(plain)
      // Back where it was a whole lap later: it drove that lap, it was not credited.
      expect(stints(gap, LAP_S)).toEqual(plain)
    }
  })

  it('outside races, counts from when it first saw the car', () => {
    const sim = new Sim(makeSession(1), { sessionNum: PRACTICE })
    const cars = (t: number): Cars => ({ 0: { d: 5.5 + V * t } })
    sim.run(1, 60, cars)
    expect(car(sim.view, 0).stintLaps).toBe(0)
    sim.run(15, 60, cars) // crosses 6.0 at t = 15
    expect(car(sim.view, 0).stintLaps).toBe(1)
  })
})
