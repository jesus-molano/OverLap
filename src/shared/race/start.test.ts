import { describe, expect, it } from 'vitest'
import { SessionState } from '../telemetry'
import { LAP_S, Sim, V, car, makeDriver, makeSession } from './testing/raceSim'
import type { Cars } from './testing/raceSim'

describe('RaceModel standing start', () => {
  // Lime Rock: the grid sits behind the line (pct 0.955-0.989); iRacing timed lap 1 at 1:17.4
  // from the green, the model at 1:10.4 from the line, for good in Battle's last laps.
  it('times the first lap from the green, as iRacing does (B18)', () => {
    const sim = new Sim(makeSession(2), { state: SessionState.GetInCar })
    const grid: Cars = { 0: { d: -0.011 }, 1: { d: -0.045 } }
    sim.run(3, 60, () => grid)
    sim.state = SessionState.Racing
    const green = sim.t
    const cars = (t: number): Cars => ({
      0: { d: -0.011 + V * (t - green) },
      1: { d: -0.045 + V * (t - green) }
    })
    sim.run(LAP_S + 2, 60, cars) // both crossed 0.0 and then 1.0
    // From the green: the grid slot to the line plus the whole lap.
    expect(car(sim.view, 0).laps[0]?.lap).toBe(1)
    expect(car(sim.view, 0).laps[0]?.time).toBeCloseTo(1.011 / V, 1)
    expect(car(sim.view, 1).laps[0]?.time).toBeCloseTo(1.045 / V, 1)
    expect(car(sim.view, 1).laps[0]?.clean).toBe(false)
    // iRacing's own value for that lap replaces it (it agrees now).
    sim.frame.CarIdxLastLapTime[1] = Math.round((1.045 / V) * 1000) / 1000 + 0.01
    sim.run(0.1, 60, cars)
    expect(car(sim.view, 1).laps[0]?.time).toBe(sim.frame.CarIdxLastLapTime[1])
    // The next lap runs from the line again.
    sim.run(LAP_S, 60, cars)
    expect(car(sim.view, 0).laps[0]).toMatchObject({ lap: 2, clean: true })
    expect(car(sim.view, 0).laps[0]?.time).toBeCloseTo(LAP_S, 2)
  })

  it('counts no stint lap for the run from the grid to the line', () => {
    const sim = new Sim(makeSession(1), { state: SessionState.GetInCar })
    sim.run(1, 60, () => ({ 0: { d: -0.04 } }))
    sim.state = SessionState.Racing
    const green = sim.t
    const cars = (t: number): Cars => ({ 0: { d: -0.04 + V * (t - green) } })
    sim.run(2, 60, cars) // past the line: lap 0
    expect(car(sim.view, 0).stintLaps).toBe(0)
    sim.run(LAP_S, 60, cars) // past 1.0
    expect(car(sim.view, 0).stintLaps).toBe(1)
  })
})

describe('RaceModel grid before the green (B09)', () => {
  it('puts every loaded car at its grid slot, counting the entries still loading', () => {
    // 4 entries; only the ones on slots 2 and 4 are in the world yet, plus one without a slot.
    const drivers = [0, 1, 2, 3, 4].map((i) => makeDriver(i))
    const grid = new Map([
      [0, { position: 1, classPosition: 1, bestLap: null }],
      [1, { position: 2, classPosition: 2, bestLap: null }],
      [2, { position: 3, classPosition: 3, bestLap: null }],
      [3, { position: 4, classPosition: 4, bestLap: null }]
    ])
    const sim = new Sim(makeSession(5, { grid }, drivers), { state: SessionState.GetInCar })
    sim.run(1, 60, () => ({ 1: { d: -0.02 }, 3: { d: -0.04 }, 4: { d: -0.05 } }))
    expect([1, 3, 4].map((i) => car(sim.view, i).classPosition)).toEqual([2, 4, 5])
    expect([1, 3, 4].map((i) => car(sim.view, i).overallPosition)).toEqual([2, 4, 5])
    // At the green the order is the running one.
    sim.state = SessionState.Racing
    sim.run(1, 60, () => ({ 1: { d: -0.02 }, 3: { d: -0.04 }, 4: { d: -0.05 } }))
    expect([1, 3, 4].map((i) => car(sim.view, i).classPosition)).toEqual([1, 2, 3])
  })
})
