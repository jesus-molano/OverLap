import { describe, expect, it } from 'vitest'
import { LAPS_REMAIN_UNLIMITED, SessionFlag } from '../flags'
import { SessionState, TrackLocation } from '../telemetry'
import { crossingsUntil, timedRaceEndS } from './lapsRemaining'
import {
  LAP_S,
  PRACTICE,
  Sim,
  V,
  car,
  makeDriver,
  makeSession,
  sortedOverall
} from './testing/raceSim'
import type { Cars } from './testing/raceSim'

// ---------------------------------------------------------------------------
// Timing lines
// ---------------------------------------------------------------------------

describe('RaceModel timing', () => {
  it('times the gap between two cars at the same speed within 20 ms', () => {
    for (const hz of [60, 7]) {
      const sim = new Sim(makeSession(2))
      const gaps: number[] = []
      sim.run(
        70,
        hz,
        (t) => ({ 0: { d: 0.5 + V * t }, 1: { d: 0.45 + V * t } }),
        (t) => {
          if (t < 5) return
          const g = sim.view.timeGap(1, 0)
          if (g !== null) gaps.push(g)
        }
      )
      expect(gaps.length).toBeGreaterThan(50)
      for (const g of gaps) expect(g).toBeCloseTo(0.05 * LAP_S, 1)
      expect(Math.max(...gaps.map((g) => Math.abs(g - 1.5)))).toBeLessThan(0.02)
      expect(sim.view.timeGap(0, 1)).toBeCloseTo(-1.5, 1)
      expect(sim.view.lapsBehind(1, 0)).toBe(0)
      expect(sim.view.lapsBehind(0, 1)).toBe(0)
    }
  })

  it('handles the lap counter changing ticks after or before the pct wraps', () => {
    const lagTicks = 3
    const shift = (lagTicks / 60) * V
    const sim = new Sim(makeSession(3), { sessionNum: PRACTICE })
    const distances: number[][] = [[], [], []]
    sim.run(
      100,
      60,
      (t) => {
        const d0 = 0.2 + V * t
        const d1 = 0.1 + V * t
        const d2 = 0.0 + V * t
        return {
          0: { d: d0 },
          // Counter lags: still the old lap for 3 ticks after the wrap.
          1: { d: d1, lap: Math.floor(d1 - shift) },
          // Counter leads: already the new lap 3 ticks before the wrap.
          2: { d: d2, lap: Math.floor(d2 + shift) }
        }
      },
      () => {
        for (let i = 0; i < 3; i++) distances[i]?.push(car(sim.view, i).distance)
      }
    )
    for (let i = 0; i < 3; i++) {
      const ds = distances[i] ?? []
      for (let k = 1; k < ds.length; k++) {
        expect((ds[k] ?? 0) - (ds[k - 1] ?? 0)).toBeGreaterThan(0)
        expect((ds[k] ?? 0) - (ds[k - 1] ?? 0)).toBeLessThan(0.01)
      }
      const laps = car(sim.view, i).laps
      expect(laps.length).toBe(2)
      for (const lap of laps) {
        expect(lap.clean).toBe(true)
        expect(lap.time).toBeCloseTo(LAP_S, 3)
      }
    }
    expect(sim.view.timeGap(1, 0)).toBeCloseTo(3, 2)
    expect(sim.view.timeGap(2, 1)).toBeCloseTo(3, 2)
  })

  it('reports laps behind and drops the time gap beyond the 5-lap history', () => {
    const sim = new Sim(makeSession(3))
    sim.run(200, 60, (t) => ({
      0: { d: 6.0 + V * t },
      1: { d: 4.7 + V * t },
      2: { d: 0.5 + V * t }
    }))
    expect(sim.view.lapsBehind(1, 0)).toBe(1)
    expect(sim.view.timeGap(1, 0)).toBeCloseTo(1.3 * LAP_S, 1)
    expect(sim.view.lapsBehind(2, 0)).toBe(5)
    expect(sim.view.timeGap(2, 0)).toBeNull()
    expect(sim.view.timeGap(2, 1)).toBeCloseTo(4.2 * LAP_S, 1)
  })

  it('records every line crossed when one tick covers several', () => {
    const lapS = 10
    const v = 1 / lapS
    const sim = new Sim(makeSession(2), { sessionNum: PRACTICE })
    // 2 Hz at 10 s laps: 5 lines per tick.
    sim.run(45, 2, (t) => ({ 0: { d: 0.3 + v * t }, 1: { d: 0.26 + v * t } }))
    expect(sim.view.timeGap(1, 0)).toBeCloseTo(0.4, 5)
    const hist = sim.view.gapHistory(1, 0, 1)
    expect(hist).toHaveLength(100)
    for (const s of hist) {
      expect(s.gap).toBeCloseTo(0.4, 5)
      expect(s.clean).toBe(true)
    }
    expect(hist[0]?.distance).toBeLessThan(hist[99]?.distance ?? 0)
    for (const lap of car(sim.view, 0).laps) expect(lap.time).toBeCloseTo(lapS, 5)
    expect(sim.view.gapHistory(1, 0, 2)).toHaveLength(200)
    expect(sim.view.gapHistory(1, 0, 0)).toEqual([])
  })

  it('lets the gap grow live when the car behind stops', () => {
    const sim = new Sim(makeSession(2))
    let stopAt = Infinity
    const d1 = (t: number): number => 0.45 + V * Math.min(t, stopAt)
    sim.run(20, 60, (t) => ({ 0: { d: 0.5 + V * t }, 1: { d: d1(t) } }))
    expect(sim.view.timeGap(1, 0)).toBeCloseTo(1.5, 1)
    stopAt = sim.t
    sim.run(3, 60, (t) => ({ 0: { d: 0.5 + V * t }, 1: { d: d1(t) } }))
    const gap = sim.view.timeGap(1, 0) ?? 0
    expect(gap).toBeGreaterThan(4)
    expect(gap).toBeLessThan(4.6)
  })

  it('does not keep the stop in the gap to a car that pitted after the last common line', () => {
    const sim = new Sim(makeSession(2))
    // Car 0 runs 15 s ahead and stops 10 s in its pit box at d = 2.0 (pit road 1.9..2.1).
    const d0 = (t: number): number => {
      const atBox = 1.5 / V
      return t < atBox ? 0.5 + V * t : t < atBox + 10 ? 2 : 2 + V * (t - atBox - 10)
    }
    const cars = (t: number): Cars => ({
      0: { d: d0(t), pit: d0(t) > 1.9 && d0(t) < 2.1 },
      1: { d: V * t }
    })
    const gaps = new Map<number, number | null>()
    sim.run(75, 60, cars, (t) => {
      for (const at of [40, 50, 56, 59, 70]) {
        if (Math.abs(t - at) < 1e-6) gaps.set(at, sim.view.timeGap(1, 0))
      }
    })
    expect(gaps.get(40)).toBeCloseTo(15, 1)
    // Stopped in the box: the time car 1 needs to get there, not the 15 s at its last line.
    expect(gaps.get(50)).toBeCloseTo(10, 1)
    // Back out, 5 s ahead: the same before and after car 1 reaches the pit box.
    expect(gaps.get(56)).toBeCloseTo(5, 1)
    expect(gaps.get(59)).toBeCloseTo(5, 1)
    expect(gaps.get(70)).toBeCloseTo(5, 1)
    expect(car(sim.view, 0).classPosition).toBe(1)
  })

  it('is not positive once the car behind passes a car stopped between two lines', () => {
    const sim = new Sim(makeSession(2))
    // Car 0, 6 s ahead, stops 10 s at d = 2.005 (between lines 200 and 201); car 1 drives by.
    const atBox = 1.505 / V
    const d0 = (t: number): number =>
      t < atBox ? 0.5 + V * t : t < atBox + 10 ? 2.005 : 2.005 + V * (t - atBox - 10)
    const cars = (t: number): Cars => ({
      0: { d: d0(t), pit: d0(t) > 1.95 && d0(t) < 2.05 },
      1: { d: 0.3 + V * t }
    })
    const gaps = new Map<number, number | null>()
    sim.run(atBox + 6.15, 60, cars, (t) => {
      for (const at of [atBox + 4, atBox + 6.1]) {
        if (Math.abs(t - at) < 0.5 / 60) gaps.set(at, sim.view.timeGap(1, 0))
      }
    })
    // Approaching the stopped car: the 0.066 lap left at car 1's pace, not the 6 s at line 193.
    expect(gaps.get(atBox + 4)).toBeCloseTo(1.98, 1)
    // Just past it, still before line 201: not 6 s behind.
    expect(gaps.get(atBox + 6.1)).toBeLessThanOrEqual(0)
  })

  it('records nothing across teleports and marks the lap unclean', () => {
    const sim = new Sim(makeSession(2), { sessionNum: PRACTICE })
    let jump = 0
    const cars = (t: number): Cars => ({ 0: { d: 0.5 + V * t + jump }, 1: { d: 0.4 + V * t } })
    const reaches = (i: number, d: number) => (): boolean =>
      (sim.view.car(i)?.distance ?? -Infinity) >= d
    sim.runUntil(reaches(0, 1.8), cars)
    expect(car(sim.view, 0).laps).toHaveLength(0)
    sim.runUntil(reaches(0, 2.8), cars) // crossed 2.0: lap 2 is the first full lap
    expect(car(sim.view, 0).laps.map((l) => [l.lap, l.clean])).toEqual([[2, true]])

    // Tow/reset forward by 0.3 laps in one tick (2.8 -> 3.1), skipping the S/F line.
    jump = 0.3
    sim.runUntil(reaches(1, 2.95), cars)
    // Car 1 is now on lines car 0 never crossed.
    expect(sim.view.timeGap(1, 0)).toBeNull()
    const hist = sim.view.gapHistory(1, 0, 5)
    expect(hist.some((s) => s.distance > 2.81 && s.distance < 3.09)).toBe(false)
    expect(hist.some((s) => s.distance < 2.8)).toBe(true)
    sim.runUntil(reaches(0, 4.05), cars) // 4.0 needs line 3.0, which was skipped
    expect(car(sim.view, 0).laps.map((l) => l.lap)).toEqual([2])
    sim.runUntil(reaches(0, 5.05), cars) // a full lap again
    expect(car(sim.view, 0).laps.map((l) => [l.lap, l.clean])).toEqual([
      [5, true],
      [2, true]
    ])

    // Teleport inside a lap (5.5 -> 5.75): the S/F lines survive, the lap is unclean.
    sim.runUntil(reaches(0, 5.5), cars)
    jump += 0.25
    sim.runUntil(reaches(0, 6.05), cars)
    expect(car(sim.view, 0).laps[0]).toMatchObject({ lap: 6, clean: false })

    // Backward jump of 0.2 laps (6.5 -> 6.3).
    sim.runUntil(reaches(0, 6.5), cars)
    jump -= 0.2
    sim.runUntil(reaches(0, 7.05), cars)
    expect(car(sim.view, 0).laps[0]).toMatchObject({ lap: 7, clean: false })
    sim.runUntil(reaches(0, 8.05), cars)
    expect(car(sim.view, 0).laps[0]).toMatchObject({ lap: 8, clean: true })
    expect(car(sim.view, 0).laps[0]?.time).toBeCloseTo(LAP_S, 3)
  })

  it('times nothing across frames it did not see (a replay), keeping its laps and key', () => {
    const laps = (sim: Sim): (number | boolean)[][] =>
      car(sim.view, 0).laps.map((l) => [l.lap, l.clean])
    const cars = (t: number): Cars => ({ 0: { d: 0.5 + V * t } })
    const run = (pause: boolean): Sim => {
      const sim = new Sim(makeSession(1), { sessionNum: PRACTICE })
      const reaches = (d: number) => (): boolean => (sim.view.car(0)?.distance ?? -Infinity) >= d
      sim.runUntil(reaches(2.98), cars)
      expect(laps(sim)).toEqual([[2, true]])
      const key = sim.view.sessionKey
      // 1.5 s of frames went elsewhere (0.05 laps: short of a teleport), across the S/F line.
      if (pause) sim.model.breakContinuity()
      sim.t += 1.5
      sim.runUntil(reaches(5.05), cars)
      expect(sim.view.sessionKey).toBe(key)
      return sim
    }
    // Bridged by interpolation, laps 3 and 4 would get line times nobody saw.
    expect(laps(run(false))).toEqual([
      [5, true],
      [4, true],
      [3, true],
      [2, true]
    ])
    expect(laps(run(true))).toEqual([
      [5, true],
      [2, true]
    ])
  })

  it('ignores backward jitter of a stopped car and dirties a lap when it leaves the world', () => {
    const sim = new Sim(makeSession(1), { sessionNum: PRACTICE })
    sim.run(40, 60, (t) => ({ 0: { d: 0.5 + V * t } })) // ~1.83
    const base = 0.5 + V * sim.t
    // Stopped with pct noise for 2 s, then on its way again (+2 s of stop in the lap).
    sim.run(2, 60, (t) => ({ 0: { d: base + (Math.round(t * 60) % 2 === 0 ? 0.001 : -0.001) } }))
    const resume = sim.t
    sim.run(29, 60, (t) => ({ 0: { d: base + V * (t - resume) } })) // ~2.8
    expect(car(sim.view, 0).laps).toHaveLength(1)
    const [lap2] = car(sim.view, 0).laps
    expect(lap2?.lap).toBe(2)
    // Timed through the jitter; a stop on track is not its pace (motion.ts).
    expect(lap2?.clean).toBe(false)
    expect(lap2?.time).toBeCloseTo(LAP_S + 2, 1)

    // Out of the world for 2 s mid-lap (~2.8): the lap that ends at 3.0 is unclean.
    const t1 = sim.t
    const d1 = base + V * (t1 - resume)
    sim.run(2, 60, () => ({ 0: null }))
    expect(car(sim.view, 0).inWorld).toBe(false)
    expect(Number.isNaN(car(sim.view, 0).distance)).toBe(true)
    expect(car(sim.view, 0).disconnected).toBe(false)
    const t2 = sim.t
    sim.run(40, 60, (t) => ({ 0: { d: d1 + V * (t - t2) } }))
    const lap3 = car(sim.view, 0).laps.find((l) => l.lap === 3)
    expect(lap3?.clean).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Lap records, sectors
// ---------------------------------------------------------------------------

describe('RaceModel laps', () => {
  it('flags the formation lap, the first racing lap, pit laps and caution laps as unclean', () => {
    // Rolling start: green at d = 1.97, just before the line, as in iRacing.
    const sim = new Sim(makeSession(1), { state: SessionState.ParadeLaps })
    let caution = false
    const cars = (t: number): Cars => {
      const d = 0.5 + V * t
      return { 0: { d, pit: d > 4.4 && d < 4.6 } }
    }
    const each = (): void => {
      sim.frame.SessionFlags[0] = caution ? SessionFlag.Caution : 0
    }
    sim.run(44.1, 60, cars, each) // 1.0 at t = 15, formation lap until the green at 1.97
    sim.state = SessionState.Racing
    sim.run(31, 60, cars, each) // 2.0 at 45 (green inside), 3.0 at 75 (first racing lap)
    sim.run(30, 60, cars, each) // 4.0 at 105
    sim.run(30, 60, cars, each) // 5.0 at 135: pit lap
    expect(car(sim.view, 0).pitStops).toBe(1)
    expect(car(sim.view, 0).lastPitLap).toBe(4)
    sim.run(30, 60, cars, each) // 6.0 at 165
    caution = true
    sim.run(5, 60, cars, each)
    caution = false
    sim.run(25, 60, cars, each) // 7.0 at 195: caution lap
    sim.run(30, 60, cars, each) // 8.0 at 225
    const laps = car(sim.view, 0).laps.map((l) => [l.lap, l.clean])
    expect(laps).toEqual([
      [8, true],
      [7, false],
      [6, true],
      [5, false],
      [4, true],
      [3, false],
      [2, false]
    ])
    for (const l of car(sim.view, 0).laps) expect(l.time).toBeCloseTo(LAP_S, 3)
    expect(car(sim.view, 0).lastLapTime).toBeCloseTo(LAP_S, 3)
    expect(car(sim.view, 0).bestLapTime).toBeCloseTo(LAP_S, 3)
    // The official best wins over the model.
    sim.frame.CarIdxBestLapTime[0] = 29.876
    sim.run(1, 60, cars)
    expect(car(sim.view, 0).bestLapTime).toBe(29.876)
  })

  it('does not count the first lap of a standing start as clean', () => {
    // On the grid at 0.98 under GetInCar, green, then laps of 30 s: 1.0 at 0.6 s past the green.
    const sim = new Sim(makeSession(1), { state: SessionState.GetInCar })
    sim.run(5, 60, () => ({ 0: { d: 0.98, lap: 0 } }))
    sim.state = SessionState.Racing
    const green = sim.t
    sim.run(62, 60, (t) => ({ 0: { d: 0.98 + V * (t - green) } })) // 1.0, 2.0 and 3.0
    expect(car(sim.view, 0).laps.map((l) => [l.lap, l.clean])).toEqual([
      [3, true],
      [2, false]
    ])
  })

  it('does not hold a lap that joined after the green against it', () => {
    // The model starts mid-race: only the partial lap it joined in is unclean.
    const sim = new Sim(makeSession(1))
    sim.run(65, 60, (t) => ({ 0: { d: 7.5 + V * t } })) // 8.0 at 15, 9.0 at 45
    expect(car(sim.view, 0).laps.map((l) => [l.lap, l.clean])).toEqual([[9, true]])
  })

  it('does not take a lap with an off-track excursion as clean', () => {
    const sim = new Sim(makeSession(1), { sessionNum: PRACTICE })
    const offAt = (d: number): boolean => d > 2.4 && d < 2.42
    const cars = (t: number): Cars => {
      const d = 0.5 + V * t
      return { 0: { d, surface: offAt(d) ? TrackLocation.OffTrack : TrackLocation.OnTrack } }
    }
    sim.run(106, 60, cars) // 1.0 at 15, 2.0 at 45, 3.0 at 75 (off track at 2.4), 4.0 at 105
    expect(car(sim.view, 0).laps.map((l) => [l.lap, l.clean])).toEqual([
      [4, true],
      [3, false],
      [2, true]
    ])
  })

  it('keeps the last 10 laps, most recent first', () => {
    const sim = new Sim(makeSession(1), { sessionNum: PRACTICE })
    sim.run(13 * LAP_S + 5, 60, (t) => ({ 0: { d: 0.5 + V * t } }))
    const laps = car(sim.view, 0).laps
    expect(laps).toHaveLength(10)
    expect(laps.map((l) => l.lap)).toEqual([13, 12, 11, 10, 9, 8, 7, 6, 5, 4])
  })

  it('takes the exact CarIdxLastLapTime once iRacing publishes the same lap', () => {
    const sim = new Sim(makeSession(1), { sessionNum: PRACTICE })
    const cars = (t: number): Cars => ({ 0: { d: 0.5 + V * t } })
    sim.frame.CarIdxLastLapTime[0] = 30.01 // the previous lap, close to the new one
    sim.run(76, 60, cars) // S/F at 15, 45, 75: laps 2 and 3 (model 30.000)
    // CarIdxLastLapTime has not changed since the line: it is still the previous lap.
    expect(car(sim.view, 0).lastLapTime).toBeCloseTo(30, 4)
    sim.frame.CarIdxLastLapTime[0] = 30.004
    sim.run(0.1, 60, cars)
    expect(car(sim.view, 0).lastLapTime).toBe(30.004)
    expect(car(sim.view, 0).laps[0]?.time).toBe(30.004)
    // A lap the model could not time falls back to CarIdxLastLapTime.
    const fresh = new Sim(makeSession(1), { sessionNum: PRACTICE })
    fresh.frame.CarIdxLastLapTime[0] = 31.5
    fresh.run(20, 60, cars)
    expect(car(fresh.view, 0).laps).toHaveLength(0)
    expect(car(fresh.view, 0).lastLapTime).toBe(31.5)
  })

  it('splits the last lap into sectors snapped to timing lines', () => {
    const sim = new Sim(makeSession(1, { sectorStarts: [0, 0.333, 0.667] }), {
      sessionNum: PRACTICE
    })
    sim.run(10, 60, (t) => ({ 0: { d: 0.5 + V * t } }))
    expect(sim.view.lastLapSectors(0)).toBeNull()
    sim.run(40, 60, (t) => ({ 0: { d: 0.5 + V * t } }))
    const sectors = sim.view.lastLapSectors(0)
    expect(sectors).not.toBeNull()
    const [s1, s2, s3] = sectors ?? []
    expect(s1).toBeCloseTo(0.33 * LAP_S, 3)
    expect(s2).toBeCloseTo(0.34 * LAP_S, 3)
    expect(s3).toBeCloseTo(0.33 * LAP_S, 3)
    expect(sim.view.lastLapSectors(5)).toBeNull()

    const noSectors = new Sim(makeSession(1), { sessionNum: PRACTICE })
    noSectors.run(50, 60, (t) => ({ 0: { d: 0.5 + V * t } }))
    expect(noSectors.view.lastLapSectors(0)).toBeNull()
  })

  it('gives the sectors of any completed lap still in the history', () => {
    const sim = new Sim(makeSession(1, { sectorStarts: [0, 0.5] }), { sessionNum: PRACTICE })
    // Lap 2 at 30 s per lap, lap 3 at 40 s (second half slower).
    const d = (t: number): number =>
      t <= 45 ? 0.5 + V * t : t <= 60 ? 2 + V * (t - 45) : 2.5 + (t - 60) / 50
    sim.run(85.5, 60, (t) => ({ 0: { d: d(t) } })) // 2.0 at 45, 3.0 at 85
    const [a1, a2] = sim.view.lapSectors(0, 2) ?? []
    expect(a1).toBeCloseTo(15, 3)
    expect(a2).toBeCloseTo(15, 3)
    const [b1, b2] = sim.view.lapSectors(0, 3) ?? []
    expect(b1).toBeCloseTo(15, 3)
    expect(b2).toBeCloseTo(25, 3)
    expect(sim.view.lastLapSectors(0)).toEqual(sim.view.lapSectors(0, 3))
    // Lap 1 started before the first sight; lap 4 is not done; lap 2.5 is no lap.
    expect(sim.view.lapSectors(0, 1)).toBeNull()
    expect(sim.view.lapSectors(0, 4)).toBeNull()
    expect(sim.view.lapSectors(0, 2.5)).toBeNull()
    expect(sim.view.lapSectors(9, 2)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Pits and status
// ---------------------------------------------------------------------------

describe('RaceModel pits and status', () => {
  it('counts pit entries during Racing only, not a pit-lane start, and tracks the out-lap', () => {
    const sim = new Sim(makeSession(2), { state: SessionState.ParadeLaps })
    const cars = (t: number): Cars => {
      const d0 = 0.5 + V * t
      const d1 = 0.2 + V * t
      return {
        // Car 0 drives through pit road during the formation lap and at ~2.4-2.6.
        0: { d: d0, pit: (d0 > 0.6 && d0 < 0.7) || (d0 > 2.4 && d0 < 2.6) },
        // Car 1 starts from pit lane and leaves it at 1.3.
        1: { d: d1, pit: d1 < 1.3 }
      }
    }
    sim.run(10, 60, cars) // car 0 enters/leaves pit road under ParadeLaps
    expect(car(sim.view, 0).pitStops).toBe(0)
    sim.state = SessionState.Racing
    sim.run(25, 60, cars) // car 1 leaves pit lane at t = 33
    const c1 = car(sim.view, 1)
    expect(c1.pitStops).toBe(0)
    expect(c1.lastPitLap).toBe(1)
    expect(c1.outLap).toBe(true)
    expect(c1.inPits).toBe(false)
    sim.run(20, 60, cars) // car 1 crosses 2.0 at t = 54
    expect(car(sim.view, 1).outLap).toBe(false)
    expect(car(sim.view, 1).stintLaps).toBe(1)

    sim.run(5, 60, cars) // car 0 at ~2.5: on pit road
    expect(car(sim.view, 0).pitStops).toBe(1)
    expect(car(sim.view, 0).inPits).toBe(true)
    expect(car(sim.view, 0).stintLaps).toBe(2)
    sim.run(5, 60, cars) // left at 2.6
    expect(car(sim.view, 0).lastPitLap).toBe(2)
    expect(car(sim.view, 0).outLap).toBe(true)
    expect(car(sim.view, 0).stintLaps).toBe(0)
    sim.run(15, 60, cars) // crossed 3.0
    expect(car(sim.view, 0).outLap).toBe(false)
    expect(car(sim.view, 0).stintLaps).toBe(1)
    expect(car(sim.view, 0).pitStops).toBe(1)
  })

  it('reports pit stall, off-track, session flags and disconnections', () => {
    const sim = new Sim(makeSession(3))
    let gone = false
    const cars = (t: number): Cars => ({
      0: { d: 0.5 + V * t, surface: TrackLocation.InPitStall },
      1: { d: 0.4 + V * t, surface: TrackLocation.OffTrack, flags: SessionFlag.Repair },
      2: gone ? null : { d: 0.3 + V * t }
    })
    sim.run(5, 60, cars)
    expect(car(sim.view, 0).inPits).toBe(true)
    expect(car(sim.view, 1).offTrack).toBe(true)
    expect(car(sim.view, 1).sessionFlags).toBe(SessionFlag.Repair)
    gone = true
    sim.run(9, 60, cars)
    expect(car(sim.view, 2).inWorld).toBe(false)
    expect(car(sim.view, 2).disconnected).toBe(false)
    sim.run(2, 60, cars)
    expect(car(sim.view, 2).disconnected).toBe(true)
    expect(car(sim.view, 2).finished).toBe(false)
    // Still classified, at the bottom.
    expect(car(sim.view, 2).overallPosition).toBe(3)
    expect(sim.view.timeGap(2, 1)).toBeNull()

    // Outside races nobody is "disconnected".
    const practice = new Sim(makeSession(1), { sessionNum: PRACTICE })
    practice.run(2, 60, (t) => ({ 0: { d: 0.5 + V * t } }))
    practice.run(12, 60, () => ({}))
    expect(car(practice.view, 0).disconnected).toBe(false)
  })

  it('excludes pace car, spectators and drivers without a DriverEntry', () => {
    const drivers = [
      makeDriver(0),
      makeDriver(1, { isPaceCar: true }),
      makeDriver(2, { isSpectator: true }),
      makeDriver(3)
    ]
    const sim = new Sim(makeSession(0, { paceCarIdx: 3 }, drivers))
    sim.run(1, 60, (t) => ({
      0: { d: 0.5 + V * t },
      1: { d: 0.6 + V * t },
      2: { d: 0.7 + V * t },
      3: { d: 0.8 + V * t },
      4: { d: 0.9 + V * t }
    }))
    expect(sim.view.cars().map((c) => c.carIdx)).toEqual([0])
    expect(sim.view.car(1)).toBeUndefined()
    expect(sim.view.car(4)).toBeUndefined()
    expect(sim.view.car(-1)).toBeUndefined()
    expect(sim.view.car(500)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

describe('RaceModel positions', () => {
  it('orders by distance per class and overall in races', () => {
    const drivers = [
      makeDriver(0, { classId: 1 }),
      makeDriver(1, { classId: 2 }),
      makeDriver(2, { classId: 1 }),
      makeDriver(3, { classId: 2 })
    ]
    const sim = new Sim(makeSession(0, {}, drivers))
    sim.run(1, 60, (t) => ({
      0: { d: 1.2 + V * t },
      1: { d: 1.5 + V * t },
      2: { d: 2.1 + V * t },
      3: { d: 0.9 + V * t }
    }))
    const pos = (i: number): [number, number] => [
      car(sim.view, i).overallPosition,
      car(sim.view, i).classPosition
    ]
    expect(pos(2)).toEqual([1, 1])
    expect(pos(1)).toEqual([2, 1])
    expect(pos(0)).toEqual([3, 2])
    expect(pos(3)).toEqual([4, 2])
    expect(sim.view.racing).toBe(true)
  })

  it('does not flicker when two cars swap back and forth within 0.5 s', () => {
    const sim = new Sim(makeSession(2))
    let side = 1
    const cars = (t: number): Cars => ({
      0: { d: 1.5 + V * t },
      1: { d: 1.5 + V * t + side * 0.001 * (Math.floor(t / 0.2) % 2 === 0 ? 1 : -1) }
    })
    side = -1 // car 0 ahead at first sight
    sim.run(0.1, 60, cars)
    expect(car(sim.view, 0).overallPosition).toBe(1)
    sim.run(4, 60, cars, () => {
      expect(car(sim.view, 0).overallPosition).toBe(1)
      expect(car(sim.view, 1).overallPosition).toBe(2)
      expect(sortedOverall(sim.view)).toEqual([1, 2])
    })
    sim.run(1 / 60, 60, (t) => ({ 0: { d: 1.501 + V * t }, 1: { d: 1.5 + V * t } }))
    // Car 1 ahead for good: shown after 0.5 s, not before.
    const passAt = sim.t
    const steady = (t: number): Cars => ({ 0: { d: 1.5 + V * t }, 1: { d: 1.501 + V * t } })
    sim.run(0.45, 60, steady)
    expect(car(sim.view, 0).overallPosition).toBe(1)
    sim.run(0.1, 60, steady)
    expect(sim.t - passAt).toBeLessThan(0.6)
    expect(car(sim.view, 1).overallPosition).toBe(1)
    expect(car(sim.view, 1).classPosition).toBe(1)
    expect(car(sim.view, 0).overallPosition).toBe(2)
  })

  it('forces an order that keeps changing but differs from the shown one for over 2 s', () => {
    const sim = new Sim(makeSession(3))
    let phase = 0
    const cars = (t: number): Cars => {
      const base = 1.5 + V * t
      if (phase === 0) return { 0: { d: base + 0.002 }, 1: { d: base + 0.001 }, 2: { d: base } }
      // Car 2 now leads while 0 and 1 swap every 0.3 s.
      const swap = Math.floor(t / 0.3) % 2 === 0 ? 1 : -1
      return {
        0: { d: base + 0.0005 * swap },
        1: { d: base - 0.0005 * swap },
        2: { d: base + 0.003 }
      }
    }
    sim.run(1, 60, cars)
    expect(car(sim.view, 2).overallPosition).toBe(3)
    phase = 1
    sim.run(1.9, 60, cars, () => expect(sortedOverall(sim.view)).toEqual([1, 2, 3]))
    expect(car(sim.view, 2).overallPosition).toBe(3)
    sim.run(0.25, 60, cars)
    expect(car(sim.view, 2).overallPosition).toBe(1)
    expect(sortedOverall(sim.view)).toEqual([1, 2, 3])
  })

  it('shows a clean pass on time while two other cars run side by side', () => {
    const sim = new Sim(makeSession(4))
    let passed = false
    const cars = (t: number): Cars => {
      const base = 1.5 + V * t
      // Cars 2 and 3 swap every 0.1 s, well behind cars 0 and 1.
      const swap = Math.floor(t / 0.1) % 2 === 0 ? 1 : -1
      return {
        0: { d: base + (passed ? 0.01 : 0.012) },
        1: { d: base + (passed ? 0.011 : 0.01) },
        2: { d: base + 0.0003 * swap },
        3: { d: base - 0.0003 * swap }
      }
    }
    sim.run(1, 60, cars)
    const pair = [car(sim.view, 2).overallPosition, car(sim.view, 3).overallPosition]
    expect(car(sim.view, 0).overallPosition).toBe(1)
    passed = true
    const passAt = sim.t
    let shownAfter = Infinity
    sim.run(3, 60, cars, (t) => {
      if (shownAfter === Infinity && car(sim.view, 1).overallPosition === 1) shownAfter = t - passAt
      // The side-by-side pair never shows flipped.
      expect([car(sim.view, 2).overallPosition, car(sim.view, 3).overallPosition]).toEqual(pair)
    })
    expect(shownAfter).toBeGreaterThanOrEqual(0.5)
    expect(shownAfter).toBeLessThan(0.6)
  })

  it('orders by best lap outside races (no time last, ties by CarIdx)', () => {
    const sim = new Sim(makeSession(4), { sessionNum: PRACTICE })
    sim.frame.CarIdxBestLapTime[1] = 91.5
    sim.frame.CarIdxBestLapTime[2] = 90.2
    sim.frame.CarIdxBestLapTime[3] = 90.2
    sim.run(1, 60, (t) => ({
      0: { d: 1.9 + V * t },
      1: { d: 1.8 + V * t },
      2: { d: 1.7 + V * t },
      3: { d: 1.6 + V * t }
    }))
    expect([0, 1, 2, 3].map((i) => car(sim.view, i).classPosition)).toEqual([4, 3, 1, 2])
    expect(sim.view.racing).toBe(false)
  })

  it('ranks official best laps first and keeps the last one when it drops to -1', () => {
    const sim = new Sim(makeSession(3), { sessionNum: PRACTICE })
    // Car 0: a valid 31.0 lap (official). Car 1: a quicker lap off track (no official time).
    // Car 2: official 30.5, then it disconnects (CarIdxBestLapTime -1).
    const d1 = (t: number): number => 0.5 + t / 29
    const cars = (t: number): Cars => ({
      0: { d: 0.5 + t / 31 },
      1: { d: d1(t), surface: d1(t) > 1.5 && d1(t) < 1.52 ? TrackLocation.OffTrack : undefined },
      2: { d: 0.3 + V * t }
    })
    sim.frame.CarIdxBestLapTime[2] = 30.5
    sim.run(50, 60, cars, (t) => {
      if (t > 47) sim.frame.CarIdxBestLapTime[0] = 31
    })
    expect(car(sim.view, 1).laps[0]).toMatchObject({ lap: 2, clean: false })
    expect(car(sim.view, 1).bestLapTime).toBeNull()
    expect([0, 1, 2].map((i) => car(sim.view, i).classPosition)).toEqual([2, 3, 1])
    sim.frame.CarIdxBestLapTime[2] = -1
    sim.run(1, 60, cars)
    expect(car(sim.view, 2).bestLapTime).toBe(30.5)
    expect(car(sim.view, 2).classPosition).toBe(1)
  })

  it('ranks a model-timed lap after every official time', () => {
    const sim = new Sim(makeSession(2), { sessionNum: PRACTICE })
    sim.frame.CarIdxBestLapTime[1] = 35
    // Car 0 laps in 30 s, but iRacing never confirms a best (e.g. invalidated another way).
    sim.run(50, 60, (t) => ({ 0: { d: 0.5 + V * t }, 1: { d: 0.4 + t / 35 } }))
    expect(car(sim.view, 0).bestLapTime).toBeCloseTo(30, 3)
    expect([0, 1].map((i) => car(sim.view, i).classPosition)).toEqual([2, 1])
  })

  it('orders by the grid in a race before the start', () => {
    const grid = new Map([
      [0, { position: 2, classPosition: 2 }],
      [1, { position: 1, classPosition: 1 }]
    ])
    const sim = new Sim(makeSession(3, { grid }), { state: SessionState.GetInCar })
    sim.run(1, 60, () => ({ 0: { d: 0.99 }, 1: { d: 0.98 }, 2: { d: 0.97 } }))
    expect([0, 1, 2].map((i) => car(sim.view, i).overallPosition)).toEqual([2, 1, 3])
  })
})

// ---------------------------------------------------------------------------
// Laps remaining
// ---------------------------------------------------------------------------

describe('RaceModel laps remaining', () => {
  it('uses SessionLapsRemainEx and laps down in lap-limited races', () => {
    const sim = new Sim(makeSession(4))
    sim.frame.SessionLapsRemainEx[0] = 5
    sim.run(1, 60, () => ({ 0: { d: 3.5 }, 1: { d: 3.2 }, 2: { d: 2.4 }, 3: { d: 2.99 } }))
    expect([0, 1, 2, 3].map((i) => sim.view.lapsRemaining(i))).toEqual([5, 5, 5, 6])
    expect(sim.view.timeRemainingS).toBeNull()
    expect(sim.view.lapsRemaining(9)).toBeNull()

    // At least one while racing.
    sim.frame.SessionLapsRemainEx[0] = 0
    sim.run(1, 60, () => ({ 0: { d: 3.5 }, 1: { d: 3.2 }, 2: { d: 2.4 }, 3: { d: 2.99 } }))
    expect(sim.view.lapsRemaining(0)).toBe(1)
  })

  it('does not jump when the lap counter and SessionLapsRemainEx change on different ticks', () => {
    const sim = new Sim(makeSession(1))
    sim.frame.SessionLapsRemainEx[0] = 5
    const seen = new Set<number | null>()
    let crossedAt = Infinity
    sim.run(
      20,
      60,
      (t) => ({ 0: { d: 3.8 + V * t } }),
      (t) => {
        const d = 3.8 + V * t
        if (d >= 4 && crossedAt === Infinity) crossedAt = t
        // iRacing decrements 5 ticks after the line.
        if (t >= crossedAt + 5 / 60) sim.frame.SessionLapsRemainEx[0] = 4
        seen.add(sim.view.lapsRemaining(0))
      }
    )
    expect(crossedAt).toBeLessThan(20)
    expect([...seen].sort()).toEqual([4, 5])
  })

  it('reports SessionLapsRemainEx before the start', () => {
    const sim = new Sim(makeSession(2), { state: SessionState.GetInCar })
    sim.frame.SessionLapsRemainEx[0] = 10
    sim.run(1, 60, () => ({ 0: { d: 0.99 }, 1: { d: 0.98 } }))
    expect(sim.view.lapsRemaining(1)).toBe(10)
    expect(sim.view.racing).toBe(false)
  })

  it('estimates timed races from the leader pace (hand-computed)', () => {
    const drivers = [
      makeDriver(0, { classId: 1, classEstLapTime: 90 }),
      makeDriver(1, { classId: 2, classEstLapTime: 92 }),
      makeDriver(2, { classId: 3, classEstLapTime: 100 })
    ]
    const sim = new Sim(makeSession(0, {}, drivers))
    sim.frame.SessionTimeRemain[0] = 600
    sim.frame.SessionLapsRemainEx[0] = LAPS_REMAIN_UNLIMITED
    // Static cars: no model laps, so the class est lap times are the pace.
    sim.run(1, 60, () => ({ 0: { d: 5.25 }, 1: { d: 4.6 }, 2: { d: 3.1 } }))
    expect(sim.view.timeRemainingS).toBe(600)
    // Leader: 7 crossings, flag at +607.5 s; car 1 (92 s, pct 0.6): 8; car 2 (100 s, pct 0.1): 7.
    expect(sim.view.lapsRemaining(0)).toBe(7)
    expect(sim.view.lapsRemaining(1)).toBe(8)
    expect(sim.view.lapsRemaining(2)).toBe(7)
  })

  it('uses model-timed clean laps as pace in timed races', () => {
    const sim = new Sim(makeSession(2, {}, [makeDriver(0, { classEstLapTime: 0 }), makeDriver(1)]))
    sim.frame.SessionLapsRemainEx[0] = LAPS_REMAIN_UNLIMITED
    sim.frame.SessionTimeRemain[0] = 1000
    // Car 0 laps in 30 s (est time unknown), car 1 in 40 s.
    sim.run(130, 60, (t) => ({ 0: { d: 0.5 + V * t }, 1: { d: 0.4 + t / 40 } }))
    expect(car(sim.view, 0).laps.filter((l) => l.clean).length).toBeGreaterThan(0)
    sim.frame.SessionTimeRemain[0] = 100
    sim.run(1 / 60, 60, (t) => ({ 0: { d: 0.5 + V * t }, 1: { d: 0.4 + t / 40 } }))
    // Leader (car 0) at ~4.83 with 30 s laps: 5 crossings, the flag at ~+125 s.
    const fL = (0.5 + V * sim.t) % 1
    const pL = 30
    const end = timedRaceEndS(100, fL, pL)
    expect(sim.view.lapsRemaining(0)).toBe(crossingsUntil(100, fL, pL))
    const f1 = (0.4 + sim.t / 40) % 1
    expect(sim.view.lapsRemaining(1)).toBe(crossingsUntil(end, f1, 40))
  })
})
