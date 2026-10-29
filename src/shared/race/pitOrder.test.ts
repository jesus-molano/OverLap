import { describe, expect, it } from 'vitest'
import { TrackLocation } from '../telemetry'
import { Sim, V, car, makeDriver, makeSession } from './testing/raceSim'
import type { Cars, CarSpec } from './testing/raceSim'

/** Pit-lane speed limit: a sixth of the racing speed (laps/s). */
const PIT_V = V / 6

/** On pit road at race distance `d`, with CarIdxLapCompleted `lap` (default floor(d)). */
function pitLane(d: number, lap?: number): CarSpec {
  return { d, lap, pit: true, surface: TrackLocation.ApproachingPits }
}

/** Parked in its box at race distance `d` (pct of `d`), with CarIdxLapCompleted `lap`. */
function inBox(d: number, lap?: number): CarSpec {
  return { d, lap, pit: true, surface: TrackLocation.InPitStall }
}

/** Overall positions of car `idx` at every tick of `sim.run(seconds, 60, cars)`. */
function positions(sim: Sim, idx: number, seconds: number, cars: (t: number) => Cars): number[] {
  const out: number[] = []
  sim.run(seconds, 60, cars, () => out.push(car(sim.view, idx).overallPosition))
  return out
}

describe('RaceModel order of cars in the pits', () => {
  // Car 1 enters pit road just ahead of the player (car 0), who passes it in the pit lane.
  // At pit-lane speed the lap counter of a car crossing the line there can disagree with its
  // pct for longer than the wrap hold (here it goes up 0.01 laps, 1.8 s, before the pct
  // wraps): its distance jumped a lap ahead and it showed ahead of the player again, then
  // behind once the pct wrapped as well.
  it('keeps a car in the pit lane behind the car that passed it while its lap counter runs ahead', () => {
    const sim = new Sim(makeSession(2))
    const enter = 2.4 // car 1 turns into pit road at 3.93
    const leave = enter + (4.05 - 3.93) / PIT_V // and rejoins at 4.05
    const cars = (t: number): Cars => {
      const d1 = 3.93 + PIT_V * (t - enter)
      return {
        0: { d: 3.8 + V * t },
        1:
          t < enter
            ? { d: 3.85 + V * t }
            : t < leave
              ? pitLane(d1, Math.floor(d1 + 0.01))
              : { d: 4.05 + V * (t - leave) }
      }
    }
    sim.run(4, 60, cars)
    expect(car(sim.view, 1).overallPosition).toBe(1) // not passed yet (3.933 vs 3.938)
    // Passed at t = 4.2 (3.94), before the line; the player stays ahead from then on.
    const after = positions(sim, 0, leave + 5 - 4, cars).slice(60)
    expect(after.every((p) => p === 1)).toBe(true)
    expect(car(sim.view, 1).distance).toBeCloseTo(4.05 + V * (sim.t - leave), 2)
  })

  // The other way round: the counter of car 1 goes up 0.02 laps (3.6 s) after its pct wraps.
  // Its distance fell a lap behind once the hold ran out, and the player, still behind it,
  // showed ahead until the counter caught up.
  it('keeps a car in the pit lane ahead of the car behind it while its lap counter lags', () => {
    const sim = new Sim(makeSession(2))
    const cars = (t: number): Cars => {
      const d1 = 3.97 + PIT_V * t
      const late = d1 >= 4 && d1 - Math.floor(d1) < 0.02
      return {
        0: { d: 3.7 + V * t },
        1: pitLane(d1, Math.floor(d1) - (late ? 1 : 0))
      }
    }
    // The player gets to car 1 at t = 9.72 (4.024).
    const before = positions(sim, 0, 9.5, cars)
    expect(before.every((p) => p === 2)).toBe(true)
    sim.run(1.5, 60, cars)
    expect(car(sim.view, 0).overallPosition).toBe(1)
  })

  // From a race at Lime Rock (boxes just past the line): a car towed from 8.808 to its box at
  // 8.029 (CarIdxLapCompleted still 8) and credited lap 9 when the tow ended. The player, the
  // next place behind it (at 7.335), passed the box right after crossing the line, showed
  // ahead of it for 24 s and behind it again after the credit. iRacing kept the player
  // behind it all along (CarIdxPosition).
  it('keeps a car towed to its box past the line ahead of the cars it was ahead of', () => {
    const sim = new Sim(makeSession(2))
    const tow = 6 // car 1 at 1.8: towed to its box at 1.029
    const credit = 30
    const leave = 35
    const cars = (t: number): Cars => ({
      0: { d: 0.3 + V * t },
      1:
        t < tow
          ? { d: 1.6 + V * t }
          : t < tow + 0.02
            ? null
            : t < credit
              ? inBox(1.029, 1)
              : t < leave
                ? inBox(1.029, 2)
                : t < leave + 3
                  ? pitLane(2.029 + PIT_V * (t - leave))
                  : { d: 2.029 + PIT_V * 3 + V * (t - leave - 3) }
    })
    sim.run(tow + 0.5, 60, cars)
    // The player crosses the line at t = 21 and passes the box at t = 21.87.
    const during = positions(sim, 0, 50 - sim.t, cars)
    expect(during.every((p) => p === 2)).toBe(true)
    // Gaps and laps still go by where the car is.
    expect(car(sim.view, 1).distance).toBeGreaterThan(2)
  })

  it('still lets the cars on track pass a car stopped in its box, which rejoins behind them', () => {
    const sim = new Sim(makeSession(3))
    const enter = 0.9 // car 1 at 1.93
    const stopAt = enter + (2.02 - 1.93) / PIT_V
    const go = stopAt + 20
    const cars = (t: number): Cars => ({
      0: { d: 1.88 + V * t },
      1:
        t < enter
          ? { d: 1.9 + V * t }
          : t < stopAt
            ? pitLane(1.93 + PIT_V * (t - enter))
            : t < go
              ? inBox(2.02)
              : t < go + 7.2
                ? pitLane(2.02 + PIT_V * (t - go))
                : { d: 2.06 + V * (t - go - 7.2) },
      2: { d: 1.5 + V * t }
    })
    sim.run(enter, 60, cars)
    expect(car(sim.view, 1).overallPosition).toBe(1)
    sim.run(12 - enter, 60, cars) // passed by car 0 at t = 1.62
    expect(car(sim.view, 0).overallPosition).toBe(1)
    expect(car(sim.view, 1).overallPosition).toBe(2)
    // Car 2 (0.4 laps behind) passes the box at t = 15.6, while car 1 stands in it.
    sim.run(go - sim.t, 60, cars)
    expect(car(sim.view, 2).overallPosition).toBe(2)
    expect(car(sim.view, 1).overallPosition).toBe(3)
    sim.run(20, 60, cars)
    expect(car(sim.view, 1).overallPosition).toBe(3)
  })

  it('lets a car in the pit lane pass a car stopped on track alongside it, also by class', () => {
    const session = makeSession(3, {}, [
      makeDriver(0),
      makeDriver(1),
      makeDriver(2, { classId: 2, classShortName: 'GT4' })
    ])
    const sim = new Sim(session)
    // Car 0 stopped on the straight at 2.01; car 1 drives the pit lane past it.
    const cars = (t: number): Cars => ({
      0: { d: 2.01 },
      1: pitLane(1.98 + PIT_V * t),
      2: { d: 1.5 + V * t * 0.1 }
    })
    sim.run(2, 60, cars)
    expect(car(sim.view, 0).overallPosition).toBe(1)
    sim.run(6, 60, cars) // car 1 at 2.024
    expect(car(sim.view, 1).overallPosition).toBe(1)
    expect(car(sim.view, 1).classPosition).toBe(1)
    expect(car(sim.view, 0).classPosition).toBe(2)
    expect(car(sim.view, 2).classPosition).toBe(1)
  })
})
