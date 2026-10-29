import { describe, expect, it } from 'vitest'
import { SessionState, TrackLocation } from '../telemetry'
import { LAP_S, Sim, V, car, makeSession } from './testing/raceSim'
import type { Cars, CarSpec } from './testing/raceSim'

/** Parked in its pit box at race distance `d` (pit road, pit stall). */
function inBox(d: number, lap?: number): CarSpec {
  return { d, lap, pit: true, surface: TrackLocation.InPitStall }
}

describe('RaceModel tows and resets', () => {
  // From a race at Lime Rock: towed from 3.735 laps to its box at 3.002 (just past the line)
  // with a car that was behind it in between: the gap to it read "+0.0" for a minute.
  it('times the gap of a towed car from where it landed, not +0.0 (B01)', () => {
    const sim = new Sim(makeSession(2))
    const towAt = 40
    // Car 1 runs 1.5 s ahead of car 0 until its tow; one tick out of the world, then its box.
    const cars = (t: number): Cars => ({
      0: { d: 0.45 + V * t },
      1: t < towAt ? { d: 0.5 + V * t } : t < towAt + 0.02 ? null : inBox(1.002)
    })
    sim.run(towAt + 1, 60, cars)
    // Car 0 (1.817) is ahead of car 1 now; it was at 1.002 at t = 16.56.
    const passedBox = (1.002 - 0.45) / V
    expect(car(sim.view, 1).distance).toBeCloseTo(1.002, 3)
    expect(sim.view.timeGap(1, 0)).toBeCloseTo(sim.t - passedBox, 1)
    expect(sim.view.timeGap(0, 1)).toBeLessThanOrEqual(0)
    // It keeps growing while the car waits in its box.
    sim.run(20, 60, cars)
    expect(sim.view.timeGap(1, 0)).toBeCloseTo(sim.t - passedBox, 1)
    expect(sim.view.lapsBehind(1, 0)).toBe(1)
  })

  it('reads a jump from mid-lap to just past the line as a tow, not a lap (B01)', () => {
    // Without the world exit in between (a low telemetry rate): same lap, not one more.
    const sim = new Sim(makeSession(2))
    const cars = (t: number): Cars => ({
      0: { d: 0.45 + V * t },
      1: t < 40 ? { d: 0.5 + V * t } : inBox(1.002)
    })
    sim.run(41, 60, cars)
    expect(car(sim.view, 1).distance).toBeCloseTo(1.002, 3)
    expect(sim.view.timeGap(1, 0)).toBeGreaterThan(20)
    // In its box it keeps its place (iRacing does, by laps completed) until car 0 gets to where
    // it was towed from (1.833; car 0 is at 1.817).
    expect(car(sim.view, 1).overallPosition).toBe(1)
    sim.run(2, 60, cars)
    expect(car(sim.view, 1).overallPosition).toBe(2)
  })

  it('measures from where a towed car is, ahead of a car or behind it (B01)', () => {
    const sim = new Sim(makeSession(2))
    // Car 1 is towed back from 1.833 to 1.002; car 0 runs 0.05 laps behind its new spot.
    const cars = (t: number): Cars => ({
      0: { d: 0.952 + V * (t - 40) },
      1: t < 40 ? { d: 0.5 + V * t } : t < 40.02 ? null : inBox(1.002)
    })
    sim.run(30, 60, (t) => ({ 1: cars(t)[1] }))
    sim.run(11, 60, cars) // t = 41: car 0 at 0.985, just behind car 1 in its box
    // The time car 0 needs to get there, not its old 25 s deficit at the lines before.
    expect(sim.view.timeGap(0, 1)).toBeCloseTo((1.002 - 0.985) * LAP_S, 1)
    sim.run(2, 60, cars) // t = 43: car 0 at 1.052, past it
    // Car 1 trails car 0 by the time since car 0 passed its box (t = 41.56).
    expect(sim.view.timeGap(1, 0)).toBeCloseTo(sim.t - (40 + 0.05 * LAP_S), 1)
    expect(sim.view.timeGap(0, 1)).toBeLessThanOrEqual(0)
  })
})

describe('RaceModel laps credited in the box', () => {
  // A towed car parked at 0.011 got its lap from iRacing at t 250: kept a lap short for good.
  it('takes a lap iRacing credits to a car parked past the line, without a stint lap (B17, Q9)', () => {
    const sim = new Sim(makeSession(2))
    let lap = 1
    const cars = (t: number): Cars => ({
      0: { d: 2.9 + V * t },
      1: t < 10 ? { d: 0.7 + V * t } : t < 10.02 ? null : inBox(1 + 0.011, lap)
    })
    sim.run(20, 60, cars)
    expect(car(sim.view, 1).distance).toBeCloseTo(1.011, 3)
    const stint = car(sim.view, 1).stintLaps
    expect(sim.view.lapsBehind(1, 0)).toBe(2)
    lap = 2 // credited: the counter goes up, the pct stays
    sim.run(0.5, 60, cars)
    // Held as a lap counter running ahead of the pct for a moment...
    expect(car(sim.view, 1).distance).toBeCloseTo(1.011, 3)
    sim.run(1, 60, cars)
    // ...but not for good.
    expect(car(sim.view, 1).distance).toBeCloseTo(2.011, 3)
    expect(sim.view.lapsBehind(1, 0)).toBe(1)
    expect(car(sim.view, 1).stintLaps).toBe(stint)
  })

  it('still follows the counter a few ticks off the pct wrap while driving', () => {
    const sim = new Sim(makeSession(1))
    const lag = 0.1
    const cars = (t: number): Cars => {
      const d = 0.9 + V * t
      return { 0: { d, lap: Math.floor(d - lag * V) } }
    }
    const ds: number[] = []
    sim.run(10, 60, cars, () => ds.push(car(sim.view, 0).distance))
    for (let k = 1; k < ds.length; k++) {
      expect((ds[k] ?? 0) - (ds[k - 1] ?? 0)).toBeGreaterThan(0)
      expect((ds[k] ?? 0) - (ds[k - 1] ?? 0)).toBeLessThan(0.01)
    }
  })
})

describe('RaceModel tow stops', () => {
  it('counts a tow to the box apart from the pit stops, and no stop lap (Q9)', () => {
    const sim = new Sim(makeSession(2))
    let leaveAt = Infinity
    const cars = (t: number): Cars => ({
      // Car 0 drives through pit road at 1.4..1.5: a stop.
      0: { d: 0.5 + V * t, pit: 0.5 + V * t > 1.4 && 0.5 + V * t < 1.5 },
      // Car 1 is towed to its box at 10 s and drives out of it at leaveAt.
      1:
        t < 10
          ? { d: 0.6 + V * t }
          : t < 10.02
            ? null
            : t < leaveAt
              ? inBox(1.002)
              : { d: 1.002 + V * (t - leaveAt), pit: t - leaveAt < 3 }
    })
    sim.run(20, 60, cars)
    expect(car(sim.view, 1)).toMatchObject({ pitStops: 0, towStops: 1, towed: true, inPits: true })
    // When it landed in its box (the tick after its one out of the world).
    expect(car(sim.view, 1).towedAt).toBeCloseTo(10.03, 1)
    leaveAt = sim.t
    sim.run(5, 60, cars)
    expect(car(sim.view, 1)).toMatchObject({
      pitStops: 0,
      towStops: 1,
      towed: false,
      towedAt: NaN,
      outLap: true,
      lastPitLap: null
    })
    sim.run(15, 60, cars)
    expect(car(sim.view, 0)).toMatchObject({ pitStops: 1, towStops: 0, towed: false })
  })

  it('counts nothing outside Racing, but still marks the tow', () => {
    const sim = new Sim(makeSession(1), { state: SessionState.Checkered })
    const cars = (t: number): Cars => ({
      0: t < 2 ? { d: 0.6 + V * t } : t < 2.02 ? null : inBox(1.002)
    })
    sim.run(4, 60, cars)
    expect(car(sim.view, 0)).toMatchObject({ pitStops: 0, towStops: 0, towed: true })
  })
})
