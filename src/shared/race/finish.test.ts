import { describe, expect, it } from 'vitest'
import { SessionState } from '../telemetry'
import { Sim, V, car, makeSession } from './testing/raceSim'
import type { Cars } from './testing/raceSim'

/** Runs `sim` at 60 Hz up to `untilS`; Checkered from tick `checkeredTick` (t = tick / 60). */
function runRace(sim: Sim, untilS: number, checkeredTick: number, cars: (t: number) => Cars): void {
  for (let k = Math.round(sim.t * 60) + 1; k <= untilS * 60; k++) {
    sim.t = k / 60
    if (k === checkeredTick) sim.state = SessionState.Checkered
    sim.tick(cars(sim.t))
  }
}

describe('RaceModel race finish', () => {
  it('freezes finishers after the chequered flag', () => {
    const sim = new Sim(makeSession(2))
    const cars = (t: number): Cars => ({
      0: { d: 4.5 + V * Math.min(t, 20) + (V / 10) * Math.max(0, t - 20) },
      1: { d: 4.4 + V * t }
    })
    sim.run(12, 60, cars) // 0 at ~4.9, 1 at ~4.8
    sim.state = SessionState.Checkered
    sim.run(10, 60, cars) // 0 finishes at t = 15, 1 at t = 18
    expect(sim.view.lapsRemaining(0)).toBe(0)
    expect(sim.view.lapsRemaining(1)).toBe(0)
    expect(car(sim.view, 0).finished).toBe(true)
    expect(car(sim.view, 1).finished).toBe(true)
    sim.run(30, 60, cars) // 1 drives past the slow cool-down of 0
    expect(car(sim.view, 1).distance).toBeGreaterThan(car(sim.view, 0).distance)
    expect(car(sim.view, 0).overallPosition).toBe(1)
    expect(car(sim.view, 1).overallPosition).toBe(2)
    expect(sim.view.timeGap(1, 0)).toBeCloseTo(3, 2)
  })

  it('finishes from the crossing times when Checkered arrives up to 5 ticks early or late', () => {
    // The leader crosses 5.0 at t = 11.9963 (tick 720), P2 1.5 s and P3 3 s later. Car 3 is
    // lapped and crosses its line 0.9 s before the leader: it finishes one lap later.
    const s = (t: number): number => V * (t + 0.0037)
    const cars = (t: number): Cars => ({
      0: { d: 4.6 + s(t) },
      1: { d: 4.55 + s(t) },
      2: { d: 4.5 + s(t) },
      3: { d: 2.63 + s(t) }
    })
    for (let offset = -5; offset <= 5; offset++) {
      const sim = new Sim(makeSession(4))
      sim.frame.SessionLapsRemainEx[0] = 1
      runRace(sim, 30, 720 + offset, cars)
      expect([0, 1, 2].map((i) => car(sim.view, i).finished)).toEqual([true, true, true])
      expect(car(sim.view, 3).finished).toBe(false)
      expect(sim.view.lapsRemaining(3)).toBe(1)
      runRace(sim, 60, 0, cars) // everyone past a cool-down crossing
      expect([0, 1, 2, 3].map((i) => sim.view.lapsRemaining(i))).toEqual([0, 0, 0, 0])
      expect(sim.view.lapsBehind(1, 0)).toBe(0)
      expect(sim.view.lapsBehind(2, 0)).toBe(0)
      expect(sim.view.lapsBehind(3, 0)).toBe(1)
      expect(sim.view.timeGap(1, 0)).toBeCloseTo(1.5, 2)
      expect(sim.view.timeGap(2, 0)).toBeCloseTo(3, 2)
      expect([0, 1, 2, 3].map((i) => car(sim.view, i).overallPosition)).toEqual([1, 2, 3, 4])
    }
  })

  it('keeps a photo finish in crossing order whichever car the tick processes first', () => {
    for (const [winner, second] of [
      [0, 1],
      [1, 0]
    ] as const) {
      const sim = new Sim(makeSession(2))
      // Both cross in tick 720 (11.99 and 11.995), Checkered on the next one; the winner then
      // cools down slowly and the second car passes it.
      const lead = (t: number): number =>
        t <= 12.5 ? 4.6 + V * (t + 0.01) : 4.6 + V * 12.51 + (V / 10) * (t - 12.5)
      const cars = (t: number): Cars => ({
        [winner]: { d: lead(t) },
        [second]: { d: 4.6 + V * (t + 0.005) }
      })
      runRace(sim, 60, 721, cars)
      expect(car(sim.view, second).distance).toBeGreaterThan(car(sim.view, winner).distance)
      expect(car(sim.view, winner).overallPosition).toBe(1)
      expect(car(sim.view, second).overallPosition).toBe(2)
      expect(sim.view.timeGap(second, winner)).toBeCloseTo(0.005, 3)
      expect(sim.view.lapsBehind(second, winner)).toBe(0)
    }
  })

  it('keeps the finishing gaps through the cool-down, a pit entry and the winner leaving', () => {
    // Winner at 146.998, P2 3 s later; then 1/90 and 1/60 lap/s. The winner pits at 165-185
    // and leaves the world. Car 2 is a lap down and still racing when the winner has gone.
    const sim = new Sim(makeSession(3))
    const d0 = (t: number): number => (t < 146.998 ? 0.1 + V * (t + 0.002) : 5 + (t - 146.998) / 90)
    const d1 = (t: number): number =>
      t < 149.998 ? 0.1 + V * (t - 3 + 0.002) : 5 + (t - 149.998) / 60
    const cars = (t: number): Cars => {
      if (t >= 147) sim.state = SessionState.Checkered
      return {
        0: t <= 185 ? { d: d0(t), pit: t > 165 } : null,
        1: { d: d1(t) },
        2: t >= 100 ? { d: 3.1 + (t - 147) / 45 } : null
      }
    }
    const gaps = new Map<number, number | null>()
    sim.run(200, 60, cars, (t) => {
      for (const at of [148, 150.5, 155, 160, 170, 185, 186.5, 190, 200]) {
        if (Math.abs(t - at) < 0.5 / 60) gaps.set(at, sim.view.timeGap(1, 0))
      }
      if (Math.abs(t - 186.5) < 0.5 / 60) {
        // The winner has left; car 2 is on its last lap: its gap to the winner stays known.
        expect(car(sim.view, 2).finished).toBe(false)
        expect(sim.view.timeGap(2, 0)).toBeGreaterThan(60)
        expect(sim.view.lapsBehind(2, 0)).toBe(1)
      }
    })
    for (const [at, gap] of gaps) {
      expect(gap, `t = ${at}`).not.toBeNull()
      expect(gap ?? 0, `t = ${at}`).toBeLessThanOrEqual(3.001)
      if (at > 150) expect(gap ?? 0, `t = ${at}`).toBeCloseTo(3, 2)
    }
    const winner = car(sim.view, 0)
    expect(winner.inWorld).toBe(false)
    expect(winner.finished).toBe(true)
    expect(winner.disconnected).toBe(false)
    expect(winner.overallPosition).toBe(1)
    expect(car(sim.view, 1).overallPosition).toBe(2)
    expect(car(sim.view, 2).finished).toBe(true)
    expect(sim.view.lapsBehind(2, 0)).toBe(1)
    expect(sim.view.lapsRemaining(0)).toBe(0)
  })

  it('freezes the last lap, laps and sectors at the finish line', () => {
    const sim = new Sim(makeSession(1, { sectorStarts: [0, 0.5] }))
    const d = (t: number): number => (t < 146.998 ? 0.1 + V * (t + 0.002) : 5 + (t - 146.998) / 90)
    sim.run(146.5, 60, (t) => ({ 0: { d: d(t) } }))
    sim.state = SessionState.Checkered
    sim.run(5, 60, (t) => ({ 0: { d: d(t) } }))
    sim.frame.CarIdxLastLapTime[0] = 30.002 // iRacing publishes the finishing lap
    sim.run(1, 60, (t) => ({ 0: { d: d(t) } }))
    const lap5 = car(sim.view, 0).laps[0]
    expect(lap5).toMatchObject({ lap: 5, time: 30.002 })
    const sectors = sim.view.lastLapSectors(0)
    expect(sectors).not.toBeNull()
    const stint = car(sim.view, 0).stintLaps
    // The 90 s cool-down lap is not a lap: nothing changes when it ends.
    sim.run(90, 60, (t) => ({ 0: { d: d(t) } }))
    sim.frame.CarIdxLastLapTime[0] = 90.1
    sim.run(10, 60, (t) => ({ 0: { d: d(t) } }))
    expect(car(sim.view, 0).distance).toBeGreaterThan(6)
    expect(car(sim.view, 0).lastLapTime).toBe(30.002)
    expect(car(sim.view, 0).laps[0]).toBe(lap5)
    expect(sim.view.lastLapSectors(0)).toEqual(sectors)
    expect(sim.view.lapSectors(0, 6)).toBeNull()
    expect(car(sim.view, 0).stintLaps).toBe(stint)
    expect(car(sim.view, 0).bestLapTime).toBeCloseTo(30, 2)
  })

  it('finishes a winner who parks out of the world right after the line', () => {
    const sim = new Sim(makeSession(2))
    const cars = (t: number): Cars => ({
      0: t < 12.5 ? { d: Math.min(4.6 + V * (t + 0.0037), 5.01) } : null,
      1: { d: 4.5 + V * t }
    })
    // Checkered 0.6 s late, after the winner already left the world.
    runRace(sim, 40, 756, cars)
    expect(car(sim.view, 0).finished).toBe(true)
    expect(car(sim.view, 0).disconnected).toBe(false)
    expect(sim.view.lapsRemaining(0)).toBe(0)
    expect(car(sim.view, 1).finished).toBe(true)
    expect(sim.view.lapsBehind(1, 0)).toBe(0)
    expect(sim.view.timeGap(1, 0)).toBeCloseTo(3.0037, 3)
  })

  it('does not finish anyone outside a race', () => {
    const sim = new Sim(makeSession(1), { sessionNum: 1, state: SessionState.Checkered })
    sim.run(80, 60, (t) => ({ 0: { d: 0.5 + V * t } })) // 1.0 at 15, 2.0 at 45, 3.0 at 75
    expect(car(sim.view, 0).finished).toBe(false)
    expect(car(sim.view, 0).laps.map((l) => l.lap)).toEqual([3, 2])
  })

  // Lime Rock: a car retired after 2 laps showed "+9L" behind a 12-lap winner; iRacing
  // classified it 10 laps down.
  it('counts a retired car down by the laps it completed once the winner finished (B19)', () => {
    const sim = new Sim(makeSession(4))
    const cars = (t: number): Cars => ({
      0: { d: 11.6 + V * t },
      // Out of the world for good at 2.017 laps.
      1: t < 1 ? { d: 2.017 } : null,
      // Parked in its box at 1.011 laps (it will not cross the line again).
      2: { d: 1.011, pit: true },
      // Still running, on its last lap: finishes on the lead lap.
      3: { d: 11.3 + V * t }
    })
    sim.run(5, 60, cars)
    expect(sim.view.lapsBehind(1, 0)).toBe(9)
    sim.state = SessionState.Checkered
    sim.run(10, 60, cars) // car 0 takes the flag at 12.0 (t = 12)
    expect(car(sim.view, 0).finished).toBe(true)
    expect(sim.view.lapsBehind(1, 0)).toBe(10)
    expect(sim.view.lapsBehind(3, 0)).toBe(0)
    // Parked but in the world: it could still leave until the race is over.
    expect(sim.view.lapsBehind(2, 0)).toBe(10)
    sim.state = SessionState.CoolDown
    sim.run(1, 60, cars)
    expect(sim.view.lapsBehind(2, 0)).toBe(11)
    expect(sim.view.lapsBehind(1, 0)).toBe(10)
  })
})
