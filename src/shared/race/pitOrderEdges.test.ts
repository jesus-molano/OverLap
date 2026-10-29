import { describe, expect, it } from 'vitest'
import { SessionState, TrackLocation } from '../telemetry'
import { PRACTICE, Sim, V, car, makeDriver, makeSession } from './testing/raceSim'
import type { Cars, CarSpec } from './testing/raceSim'

/** Pit-lane speed limit: a sixth of the racing speed (laps/s). */
const PIT_V = V / 6
/**
 * Where the lap counter of a car in the pit lane goes up, in laps from where its pct wraps:
 * at the wrap, a little (and a lot, outside the wrap window) before it, or after it.
 */
const SHIFTS = [0, 0.01, 0.05, -0.01, -0.05]

/** On pit road at race distance `d`, its lap counter going up `shift` laps before the pct wraps. */
function pitLane(d: number, shift = 0): CarSpec {
  return { d, lap: Math.floor(d + shift), pit: true, surface: TrackLocation.ApproachingPits }
}

function inBox(d: number, lap = Math.floor(d)): CarSpec {
  return { d, lap, pit: true, surface: TrackLocation.InPitStall }
}

/** True race distances of the cars at SessionTime t (the order a viewer should see). */
type Truth = (t: number) => Record<number, number>

/**
 * Runs `sim` and returns the longest stretch (s) during which some car's shown position (or
 * class position, by `classOf`) differs from its rank by true distance.
 */
function longestWrong(
  sim: Sim,
  seconds: number,
  cars: (t: number) => Cars,
  truth: Truth,
  classOf: (idx: number) => number = () => 0,
  pos: 'overallPosition' | 'classPosition' = 'overallPosition'
): number {
  let since = NaN
  let worst = 0
  sim.run(seconds, 60, cars, (t) => {
    const d = truth(t)
    const ids = Object.keys(d).map(Number)
    let wrong = false
    for (const i of ids) {
      const di = d[i] ?? 0
      const rank =
        1 + ids.filter((j) => j !== i && classOf(j) === classOf(i) && (d[j] ?? 0) > di).length
      if (car(sim.view, i)[pos] !== rank) wrong = true
    }
    if (wrong) {
      if (Number.isNaN(since)) since = t
      worst = Math.max(worst, t - since)
    } else {
      since = NaN
    }
  })
  return worst
}

/** Debounce of a position change (order.ts POSITION_FORCE_S) plus a tick. */
const LAG_S = 2.05

describe('RaceModel order of cars in the pits: adversarial cases', () => {
  // The report: a car a lap down drives the pit lane alongside the player at the line.
  it.each(SHIFTS)(
    'keeps a lapped car in the pit lane behind the player at the line (counter shift %f)',
    (shift) => {
      const sim = new Sim(makeSession(2))
      const p1 = (t: number): number => 2.92 + PIT_V * t
      const exitT = (3.1 - 2.92) / PIT_V
      const d1 = (t: number): number => (t < exitT ? p1(t) : 3.1 + V * (t - exitT))
      const cars = (t: number): Cars => ({
        0: { d: 3.9 + V * t },
        1: t < exitT ? pitLane(d1(t), shift) : { d: d1(t) }
      })
      const out: number[] = []
      sim.run(exitT + 5, 60, cars, () => out.push(car(sim.view, 0).overallPosition))
      expect(out.every((p) => p === 1)).toBe(true)
    }
  )

  // Same lap: the player, behind, catches the pit-lane car around the line and passes it once.
  it.each(SHIFTS)(
    'changes places once when the player passes a pit-lane car (shift %f)',
    (shift) => {
      const sim = new Sim(makeSession(2))
      const exitT = (3.1 - 2.93) / PIT_V
      const d1 = (t: number): number => (t < exitT ? 2.93 + PIT_V * t : 3.1 + V * (t - exitT))
      const cars = (t: number): Cars => ({
        0: { d: 2.9 + V * t },
        1: t < exitT ? pitLane(d1(t), shift) : { d: d1(t) }
      })
      const truth: Truth = (t) => ({ 0: 2.9 + V * t, 1: d1(t) })
      expect(longestWrong(sim, exitT + 5, cars, truth)).toBeLessThanOrEqual(LAG_S)
    }
  )

  // A full stop, past the line or before it, passed by four cars, then the race goes on.
  it.each([
    [3.02, 0.01],
    [3.02, 0.05],
    [3.02, -0.05],
    [2.97, 0.05],
    [2.97, -0.01]
  ])('a stop in a box at %f costs places one by one (shift %f)', (box, shift) => {
    const sim = new Sim(makeSession(6))
    const enter = 0.5
    const entryD = 2.92 + V * enter
    const stopT = enter + (box - entryD) / PIT_V
    const goT = stopT + 25
    const exitT = goT + (box + 0.08 - box) / PIT_V
    const d1 = (t: number): number =>
      t < enter
        ? 2.92 + V * t
        : t < stopT
          ? entryD + PIT_V * (t - enter)
          : t < goT
            ? box
            : t < exitT
              ? box + PIT_V * (t - goT)
              : box + 0.08 + V * (t - exitT)
    const others = [2.9, 2.85, 2.6, 2.3, 1.95]
    const truth: Truth = (t) => {
      const r: Record<number, number> = { 1: d1(t) }
      others.forEach((s, k) => (r[k === 0 ? 0 : k + 1] = s + V * t))
      return r
    }
    const cars = (t: number): Cars => {
      const tr = truth(t)
      const r: Cars = {}
      for (const [i, d] of Object.entries(tr)) r[Number(i)] = { d }
      const d = d1(t)
      r[1] =
        t >= enter && t < exitT
          ? t >= stopT && t < goT
            ? inBox(box, Math.floor(box + shift))
            : pitLane(d, shift)
          : { d }
      return r
    }
    expect(longestWrong(sim, exitT + 10, cars, truth)).toBeLessThanOrEqual(LAG_S)
  })

  // Undercut: car 1 pits a lap before car 2, which it was chasing; it comes out ahead of car 2
  // once car 2 has made its own stop.
  it.each([0.01, 0.05, -0.05])('shows an undercut as it happens (shift %f)', (shift) => {
    const sim = new Sim(makeSession(3))
    const STOP_S = 8
    // One pit stop: enters at `at`, 0.1 laps of pit lane with a stop in the middle.
    const stint = (d0: number, at: number, fast: number) => {
      const half = 0.05 / PIT_V
      return (t: number): number => {
        if (t < at) return d0 + V * t
        const base = d0 + V * at
        const s = t - at
        if (s < half) return base + PIT_V * s
        if (s < half + STOP_S) return base + 0.05
        if (s < 2 * half + STOP_S) return base + 0.05 + PIT_V * (s - half - STOP_S)
        return base + 0.1 + V * fast * (s - 2 * half - STOP_S)
      }
    }
    const inPit = (at: number) => (t: number) => t >= at && t < at + 2 * (0.05 / PIT_V) + STOP_S
    // Car 2 leads car 1 by 0.02 laps; car 1 pits at 2.95, car 2 a lap later.
    const at1 = (2.95 - 2.9) / V
    const at2 = (3.95 - 2.92) / V
    const d1 = stint(2.9, at1, 1.15)
    const d2 = stint(2.92, at2, 1)
    const p1 = inPit(at1)
    const p2 = inPit(at2)
    const cars = (t: number): Cars => ({
      0: { d: 3.5 + V * t },
      1: p1(t) ? pitLane(d1(t), shift) : { d: d1(t) },
      2: p2(t) ? pitLane(d2(t), shift) : { d: d2(t) }
    })
    const truth: Truth = (t) => ({ 0: 3.5 + V * t, 1: d1(t), 2: d2(t) })
    const end = at2 + 2 * (0.05 / PIT_V) + STOP_S + 5
    expect(longestWrong(sim, end, cars, truth)).toBeLessThanOrEqual(LAG_S)
    expect(car(sim.view, 1).overallPosition).toBeLessThan(car(sim.view, 2).overallPosition)
  })

  // Parked in its box for 7 laps (a repair): lapped again and again, never flickering.
  it('keeps a car parked in its box for laps behind everyone who passes it', () => {
    const sim = new Sim(makeSession(3))
    const cars = (t: number): Cars => ({
      0: { d: 2.5 + V * t },
      1: t < 210 ? inBox(3.02) : { d: 3.02 + V * (t - 210) },
      2: { d: 2.0 + V * t * 0.9 }
    })
    const truth: Truth = (t) => ({
      0: 2.5 + V * t,
      1: t < 210 ? 3.02 : 3.02 + V * (t - 210),
      2: 2.0 + V * t * 0.9
    })
    expect(longestWrong(sim, 230, cars, truth)).toBeLessThanOrEqual(LAG_S)
    expect(sim.view.lapsBehind(1, 0)).toBe(6)
  })

  it('keeps a car that drops out of the world in its box where it was', () => {
    const sim = new Sim(makeSession(3))
    const cars = (t: number): Cars => ({
      0: { d: 2.5 + V * t },
      1: t > 5 && t < 25 ? null : t < 40 ? inBox(3.02) : { d: 3.02 + V * (t - 40) },
      2: { d: 2.9 + V * t }
    })
    const truth: Truth = (t) => ({
      0: 2.5 + V * t,
      1: t < 40 ? 3.02 : 3.02 + V * (t - 40),
      2: 2.9 + V * t
    })
    expect(longestWrong(sim, 60, cars, truth)).toBeLessThanOrEqual(LAG_S)
  })

  // The player himself in the pits, with others crossing the line around him.
  it.each(SHIFTS)('orders the player in the pit lane like anyone else (shift %f)', (shift) => {
    const sim = new Sim(makeSession(3, { playerCarIdx: 1 }))
    const exitT = (3.1 - 2.94) / PIT_V
    const d1 = (t: number): number => (t < exitT ? 2.94 + PIT_V * t : 3.1 + V * (t - exitT))
    const cars = (t: number): Cars => ({
      0: { d: 2.9 + V * t },
      1: t < exitT ? pitLane(d1(t), shift) : { d: d1(t) },
      2: { d: 1.97 + V * t }
    })
    const truth: Truth = (t) => ({ 0: 2.9 + V * t, 1: d1(t), 2: 1.97 + V * t })
    expect(longestWrong(sim, exitT + 5, cars, truth)).toBeLessThanOrEqual(LAG_S)
  })

  it.each([0.01, 0.05, -0.05])(
    'keeps class positions right in the pit lane (shift %f)',
    (shift) => {
      const session = makeSession(4, {}, [
        makeDriver(0),
        makeDriver(1, { classId: 2, classShortName: 'GT4' }),
        makeDriver(2, { classId: 2, classShortName: 'GT4' }),
        makeDriver(3)
      ])
      const sim = new Sim(session)
      const exitT = (3.1 - 2.93) / PIT_V
      const d1 = (t: number): number => (t < exitT ? 2.93 + PIT_V * t : 3.1 + V * (t - exitT))
      const cars = (t: number): Cars => ({
        0: { d: 2.9 + V * t },
        1: t < exitT ? pitLane(d1(t), shift) : { d: d1(t) },
        2: { d: 2.88 + V * t * 0.95 },
        3: { d: 1.99 + V * t }
      })
      const truth: Truth = (t) => ({
        0: 2.9 + V * t,
        1: d1(t),
        2: 2.88 + V * t * 0.95,
        3: 1.99 + V * t
      })
      const cls = (i: number): number => (i === 1 || i === 2 ? 2 : 1)
      expect(longestWrong(sim, exitT + 5, cars, truth, cls, 'classPosition')).toBeLessThanOrEqual(
        LAG_S
      )
    }
  )

  // Last lap: the leader takes the flag, then a car in the pit lane crosses the line ahead of a
  // car on track that was behind it.
  it.each([0, 0.01, -0.01])(
    'finishes a car crossing the line in the pit lane in order (shift %f)',
    (shift) => {
      const sim = new Sim(makeSession(3))
      sim.frame.SessionLapsRemainEx[0] = 1
      const exitT = (5.08 - 4.93) / PIT_V
      const d1 = (t: number): number => (t < exitT ? 4.93 + PIT_V * t : 5.08 + V * (t - exitT))
      const cars = (t: number): Cars => ({
        0: { d: 4.62 + V * t },
        1: t < exitT ? pitLane(d1(t), shift) : { d: d1(t) },
        2: { d: 4.5 + V * t }
      })
      sim.run(11.5, 60, cars) // the leader gets to the line at t = 11.4
      sim.state = SessionState.Checkered
      sim.run(30, 60, cars) // car 1 crosses at t = 12.6, car 2 at t = 15
      expect([0, 1, 2].map((i) => car(sim.view, i).finished)).toEqual([true, true, true])
      expect([0, 1, 2].map((i) => car(sim.view, i).overallPosition)).toEqual([1, 2, 3])
    }
  )

  // Practice: a car in the pit lane with a counter off the pct does not move the best-lap order.
  it('leaves the practice order alone while a car drives the pit lane', () => {
    const sim = new Sim(makeSession(2), { sessionNum: PRACTICE })
    sim.frame.CarIdxBestLapTime[0] = 31
    sim.frame.CarIdxBestLapTime[1] = 30
    const cars = (t: number): Cars => ({
      0: { d: 2.9 + V * t },
      1: pitLane(2.97 + PIT_V * t, 0.05)
    })
    const out: number[] = []
    sim.run(20, 60, cars, () => out.push(car(sim.view, 1).overallPosition))
    expect(new Set(out.slice(60)).size).toBe(1)
  })

  // A towed car is credited its lap in its box (just past the line), then waits there. A car
  // that gets to where the tow started only after the credit is behind it, as in iRacing (the
  // towed car has its lap): it may not show ahead until it passes the box.
  it('keeps a credited towed car ahead of a car that reaches the tow spot after the credit', () => {
    const sim = new Sim(makeSession(2))
    const tow = 2 // car 1 at 1.917: towed to its box at 2.029 (counter still 1)
    const credit = 30
    const leave = 50
    const cars = (t: number): Cars => ({
      // Car 0 gets to the tow spot (1.917) at t = 31, 1 s after the credit.
      0: { d: 1.85 + V * tow - V * (credit + 1) + V * t },
      1:
        t < tow
          ? { d: 1.85 + V * t }
          : t < tow + 0.02
            ? null
            : t < credit
              ? inBox(2.029, 1)
              : t < leave
                ? inBox(2.029, 2)
                : t < leave + 4
                  ? pitLane(2.029 + PIT_V * (t - leave))
                  : { d: 2.029 + PIT_V * 4 + V * (t - leave - 4) }
    })
    sim.run(credit + 2, 60, cars)
    const out: number[] = []
    // Car 0 passes the box (2.029) at t = 34.37; until then it is behind.
    sim.run(34 - sim.t, 60, cars, () => out.push(car(sim.view, 0).overallPosition))
    expect(out.every((p) => p === 2)).toBe(true)
    // And after passing the box it stays ahead, also when car 1 drives out.
    sim.run(3, 60, cars)
    const after: number[] = []
    sim.run(leave + 10 - sim.t, 60, cars, () => after.push(car(sim.view, 0).overallPosition))
    expect(after.every((p) => p === 1)).toBe(true)
  })
})
