import { describe, expect, it } from 'vitest'
import { TrackLocation } from '../telemetry'
import type { SessionMeta } from '../types'
import { STOP_FRACTION } from './motion'
import { LAP_S, PRACTICE, Sim, V, car, makeDriver, makeSession } from './testing/raceSim'
import type { Cars } from './testing/raceSim'

/** Distance at SessionTime t of a car starting at 0 whose lap j (j..j+1) takes lapTimes[j]. */
function byLapTimes(lapTimes: readonly number[]): (t: number) => number {
  return (t) => {
    let d = 0
    let rest = t
    for (const lt of lapTimes) {
      if (rest < lt) return d + rest / lt
      rest -= lt
      d++
    }
    return d + rest / (lapTimes[lapTimes.length - 1] ?? LAP_S)
  }
}

describe('RaceModel pace', () => {
  it('averages the last 3 clean laps, skipping unclean ones', () => {
    const sim = new Sim(makeSession(1), { sessionNum: PRACTICE })
    const d = byLapTimes([30, 40, 41, 42, 43, 44, 44])
    // Lap 5 (4.0 -> 5.0) goes through pit road: unclean.
    const cars = (t: number): Cars => ({ 0: { d: d(t), pit: d(t) > 4.3 && d(t) < 4.4 } })
    const paceAfter = (lap: number): number | null => {
      sim.runUntil(() => sim.view.car(0)?.laps[0]?.lap === lap, cars)
      return car(sim.view, 0).pace
    }
    // Class estimate until the first clean lap (lap 1 started at first sight).
    sim.run(5, 60, cars)
    expect(car(sim.view, 0).pace).toBe(LAP_S)
    expect(paceAfter(2)).toBeCloseTo(40, 1)
    expect(paceAfter(3)).toBeCloseTo(40.5, 1)
    expect(paceAfter(4)).toBeCloseTo(41, 1)
    expect(paceAfter(5)).toBeCloseTo(41, 1)
    expect(car(sim.view, 0).laps[0]?.clean).toBe(false)
    expect(paceAfter(6)).toBeCloseTo((44 + 42 + 41) / 3, 1)
    expect(paceAfter(7)).toBeCloseTo((44 + 44 + 42) / 3, 1)
  })

  it('leaves a lap with a stop on track out of the pace', () => {
    const sim = new Sim(makeSession(1, {}, [makeDriver(0, { classEstLapTime: 25 })]), {
      sessionNum: PRACTICE
    })
    // Laps in 30 s; stopped 20 s at 2.5, and a slow but moving lap 4 (37.5 s).
    const d = (t: number): number => {
      const atStop = 2.5 / V
      if (t < atStop) return V * t
      if (t < atStop + 20) return 2.5
      const t3 = 3 / V + 20
      return t < t3 ? 2.5 + V * (t - atStop - 20) : 3 + Math.min(1, ((t - t3) * V) / 1.25)
    }
    const cars = (t: number): Cars => ({ 0: { d: d(t) } })
    sim.runUntil(() => sim.view.car(0)?.laps[0]?.lap === 3, cars)
    expect(car(sim.view, 0).laps.map((l) => [l.lap, Math.round(l.time), l.clean])).toEqual([
      [3, 50, false],
      [2, 30, true]
    ])
    expect(car(sim.view, 0).pace).toBeCloseTo(30, 1)
    sim.runUntil(() => sim.view.car(0)?.laps[0]?.lap === 4, cars)
    expect(car(sim.view, 0).laps[0]?.clean).toBe(true)
    expect(car(sim.view, 0).pace).toBeCloseTo((30 + 37.5) / 2, 1)
  })

  it('falls back to the best lap, the qualifying bests, then the class estimate, else null', () => {
    const noEst = makeSession(1, {}, [makeDriver(0, { classEstLapTime: 0 })])
    const sim = new Sim(noEst, { sessionNum: PRACTICE })
    const cars = (t: number): Cars => ({ 0: { d: 0.5 + V * t } })
    sim.run(2, 60, cars)
    expect(car(sim.view, 0).pace).toBeNull()

    // A new SessionMeta applies also while the car is out of the world. CarClassEstLapTime is
    // only the last resort: often seconds faster than anyone laps (Lime Rock MX-5: 56.8 s for
    // 61-64 s laps).
    sim.run(1, 60, () => ({}))
    sim.session = makeSession(1, {}, [makeDriver(0, { classEstLapTime: 28 })])
    sim.run(1, 60, () => ({}))
    expect(car(sim.view, 0).inWorld).toBe(false)
    expect(car(sim.view, 0).pace).toBe(28)

    // Its class's fastest qualifying time, then its own one (QualifyResultsInfo FastestTime).
    const drivers = [0, 1].map((i) => makeDriver(i, { classEstLapTime: 28 }))
    const grid = (own: number | null): SessionMeta['grid'] =>
      new Map([
        [0, { position: 2, classPosition: 2, bestLap: own }],
        [1, { position: 1, classPosition: 1, bestLap: 31.2 }]
      ])
    sim.session = makeSession(2, { grid: grid(null) }, drivers)
    sim.run(1, 60, cars)
    expect(car(sim.view, 0).pace).toBe(31.2)
    sim.session = makeSession(2, { grid: grid(31.9) }, drivers)
    sim.run(1, 60, cars)
    expect(car(sim.view, 0).pace).toBe(31.9)

    // This session's best lap first.
    sim.frame.CarIdxBestLapTime[0] = 33
    sim.run(1, 60, cars)
    expect(car(sim.view, 0).pace).toBe(33)
  })
})

describe('RaceModel speed', () => {
  it('reads 1 / lap time at constant speed from the first sample, at any tick rate', () => {
    const lapS = 40
    for (const hz of [60, 7, 2]) {
      const sim = new Sim(makeSession(1), { sessionNum: PRACTICE })
      const speeds: number[] = []
      sim.run(
        100,
        hz,
        (t) => ({ 0: { d: 0.5 + t / lapS } }),
        () => speeds.push(car(sim.view, 0).speed)
      )
      // First tick: no previous position; then known within 0.1 s (no ramp-up from 0).
      expect(speeds[0]).toBe(0)
      const known = speeds.slice(Math.max(2, Math.ceil(0.1 * hz) + 1))
      for (const v of known) expect(Math.abs(v * lapS - 1)).toBeLessThan(1e-4)
      // Pace from the model-timed clean lap, not the 30 s class estimate.
      expect(car(sim.view, 0).pace).toBeCloseTo(lapS, 2)
      expect(car(sim.view, 0).stoppedForS).toBe(0)
    }
  })

  it('has no spikes across teleports, world exits or the lap counter wrapping apart', () => {
    const sim = new Sim(makeSession(4), { sessionNum: PRACTICE })
    const shift = (3 / 60) * V
    const late = 0.05
    let jump = 0
    let away = false
    const cars = (t: number): Cars => {
      const d = 0.2 + V * t
      return {
        // Lap counter 3 ticks late / early at the line (fixed up by the model).
        0: { d, lap: Math.floor(d - shift) },
        1: { d, lap: Math.floor(d + shift) },
        // Lap counter 1.5 s late: two 1-lap jumps per lap.
        2: { d, lap: Math.floor(d - late) },
        // Teleports and a world exit.
        3: away ? null : { d: d + jump }
      }
    }
    const speeds: number[][] = [[], [], [], []]
    const sample = (): void => {
      for (let i = 0; i < 4; i++) speeds[i]?.push(car(sim.view, i).speed)
    }
    sim.run(1, 60, cars)
    const at = (d: number) => (): boolean => (sim.view.car(3)?.distance ?? 0) >= d
    sim.runUntil(at(1.8), cars, sample)
    jump += 0.3 // tow forward across the S/F line
    sim.runUntil(at(2.4), cars, sample)
    jump += 0.05 // warp under the 0.1-lap teleport threshold
    sim.runUntil(at(2.7), cars, sample)
    jump -= 0.2 // backward
    sim.runUntil(at(3.1), cars, sample)
    sim.run(40, 60, cars, sample)
    for (let i = 0; i < 3; i++) {
      for (const v of speeds[i] ?? []) expect(Math.abs(v / V - 1)).toBeLessThan(1e-3)
    }
    for (const v of speeds[3] ?? []) expect(Math.abs(v / V - 1)).toBeLessThan(1e-3)

    // Out of the world: 0, and known again within 0.1 s of coming back.
    away = true
    sim.run(1, 60, cars)
    expect(car(sim.view, 3).speed).toBe(0)
    expect(car(sim.view, 3).stoppedForS).toBe(0)
    away = false
    sim.run(6 / 60, 60, cars)
    expect(car(sim.view, 3).speed).toBe(0)
    sim.run(1 / 60, 60, cars)
    expect(car(sim.view, 3).speed / V).toBeCloseTo(1, 3)
  })

  it('measures afresh after a tow instead of decaying from the old speed', () => {
    const sim = new Sim(makeSession(1))
    let towed = false
    const cars = (t: number): Cars => ({
      0: towed ? { d: 0.1, pit: true, surface: TrackLocation.InPitStall } : { d: 0.5 + V * t }
    })
    sim.run(5, 60, cars)
    towed = true
    sim.run(6 / 60, 60, cars)
    // The last speed until the first sample after the jump, then the new one.
    expect(car(sim.view, 0).speed / V).toBeCloseTo(1, 3)
    sim.run(1 / 60, 60, cars)
    expect(car(sim.view, 0).speed).toBe(0)
    expect(car(sim.view, 0).stoppedForS).toBe(0)
  })

  it('trusts a lasting speed above the jump limit (a wrong class estimate)', () => {
    // Laps in 30 s against a 120 s estimate: 4x the reference speed.
    const slowEst = makeSession(1, {}, [makeDriver(0, { classEstLapTime: 120 })])
    const sim = new Sim(slowEst, { sessionNum: PRACTICE })
    sim.run(2, 60, (t) => ({ 0: { d: 0.2 + V * t } }))
    expect(car(sim.view, 0).speed / V).toBeCloseTo(1, 3)
  })

  it('starts over after a telemetry gap', () => {
    const sim = new Sim(makeSession(1))
    const cars = (t: number): Cars => ({ 0: { d: 0.5 + V * Math.min(t, 5) } })
    sim.run(8, 60, cars)
    expect(car(sim.view, 0).stoppedForS).toBeGreaterThan(1)
    sim.model.reset()
    expect(car(sim.view, 0).speed).toBe(0)
    expect(car(sim.view, 0).stoppedForS).toBe(0)
    sim.t += 2
    sim.run(1, 60, cars)
    expect(car(sim.view, 0).speed).toBe(0)
    // Counts again from the first sample after the gap, not from before it.
    expect(car(sim.view, 0).stoppedForS).toBeGreaterThan(0.8)
    expect(car(sim.view, 0).stoppedForS).toBeLessThan(0.95)
  })
})

describe('RaceModel stopped cars', () => {
  it('counts the time a car crawls on track and resets as soon as it moves', () => {
    const sim = new Sim(makeSession(1))
    let stopAt = Infinity
    let resumeAt = Infinity
    const d = (t: number): number =>
      0.5 + V * (Math.min(t, stopAt) + Math.max(0, t - Math.max(resumeAt, stopAt)))
    const cars = (t: number): Cars => ({ 0: { d: d(t) } })
    const stopped: number[] = []
    sim.run(10, 60, cars, () => stopped.push(car(sim.view, 0).stoppedForS))
    expect(stopped.every((s) => s === 0)).toBe(true)

    stopAt = sim.t
    stopped.length = 0
    sim.run(5, 60, cars, () => stopped.push(car(sim.view, 0).stoppedForS))
    const st = car(sim.view, 0)
    expect(st.speed).toBeLessThan(0.01 * V)
    // The 0.5 s smoothing takes ~1 s to fall under 15 % of the pace speed.
    expect(st.stoppedForS).toBeGreaterThan(3.8)
    expect(st.stoppedForS).toBeLessThan(4.1)
    for (let k = 1; k < stopped.length; k++) {
      const step = (stopped[k] ?? 0) - (stopped[k - 1] ?? 0)
      if (step !== 0) expect(step).toBeCloseTo(1 / 60, 6)
      else expect(stopped[k]).toBe(0)
    }

    resumeAt = sim.t
    sim.run(0.2, 60, cars)
    expect(car(sim.view, 0).stoppedForS).toBe(0)
    sim.run(5, 60, cars)
    expect(car(sim.view, 0).speed / V).toBeCloseTo(1, 3)
  })

  it('counts a crawl below 15 % of the pace but not a slow car above it', () => {
    const sim = new Sim(makeSession(2))
    const cars = (t: number): Cars => ({
      0: { d: 0.5 + (STOP_FRACTION - 0.03) * V * t },
      1: { d: 0.4 + (STOP_FRACTION + 0.03) * V * t }
    })
    sim.run(5, 60, cars)
    expect(car(sim.view, 0).stoppedForS).toBeGreaterThan(4.8)
    expect(car(sim.view, 1).stoppedForS).toBe(0)
    expect(car(sim.view, 1).speed / V).toBeCloseTo(STOP_FRACTION + 0.03, 4)
  })

  it('excludes the pits and resets on pit road and on leaving the world', () => {
    const sim = new Sim(makeSession(3))
    let pit = false
    let gone = false
    const cars = (): Cars => ({
      // Stopped in the pit stall, on pit road, and on track (off-track counts).
      0: { d: 0.5, pit: true, surface: TrackLocation.InPitStall },
      1: { d: 0.4, pit: true },
      2: gone ? null : { d: 0.3, pit, surface: TrackLocation.OffTrack }
    })
    sim.run(5, 60, cars)
    expect(car(sim.view, 0).stoppedForS).toBe(0)
    expect(car(sim.view, 0).speed).toBe(0)
    expect(car(sim.view, 1).stoppedForS).toBe(0)
    expect(car(sim.view, 2).stoppedForS).toBeGreaterThan(4.8)

    pit = true
    sim.run(1 / 60, 60, cars)
    expect(car(sim.view, 2).stoppedForS).toBe(0)
    pit = false
    sim.run(2, 60, cars)
    expect(car(sim.view, 2).stoppedForS).toBeGreaterThan(1.8)

    gone = true
    sim.run(1 / 60, 60, cars)
    expect(car(sim.view, 2).stoppedForS).toBe(0)
    expect(car(sim.view, 2).speed).toBe(0)
    gone = false
    sim.run(1, 60, cars)
    // Again from its first speed sample in the world.
    expect(car(sim.view, 2).stoppedForS).toBeGreaterThan(0.8)
    expect(car(sim.view, 2).stoppedForS).toBeLessThan(0.95)
  })

  it('still detects a stop without any pace', () => {
    const noEst = makeSession(1, {}, [makeDriver(0, { classEstLapTime: 0 })])
    const sim = new Sim(noEst)
    sim.run(5, 60, (t) => ({ 0: { d: 0.5 + V * Math.min(t, 1) } }))
    expect(car(sim.view, 0).pace).toBeNull()
    expect(car(sim.view, 0).stoppedForS).toBeGreaterThan(1.5)
  })
})
