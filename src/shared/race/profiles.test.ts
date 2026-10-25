import { describe, expect, it } from 'vitest'
import { SessionFlag } from '../flags'
import { SessionState, TrackLocation } from '../telemetry'
import { RACE_TIMING_LINES } from './raceView'
import type { RaceView } from './raceView'
import { LAP_S, PRACTICE, Sim, V, makeSession } from './testing/raceSim'
import type { Cars } from './testing/raceSim'

const LINES = RACE_TIMING_LINES

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

type Profile = NonNullable<ReturnType<RaceView['lapProfile']>>

function profileOf(view: RaceView, carIdx: number, which: 'best' | 'last'): Profile {
  const p = view.lapProfile(carIdx, which)
  if (!p) throw new Error(`no ${which} profile for car ${carIdx}`)
  return p
}

function expectWellFormed(p: Profile): void {
  expect(p.profile).toHaveLength(LINES + 1)
  expect(p.profile[0]).toBe(0)
  expect(p.profile[LINES]).toBe(p.lapTime)
  for (let k = 1; k <= LINES; k++) {
    expect(p.profile[k] ?? NaN).toBeGreaterThanOrEqual(p.profile[k - 1] ?? NaN)
  }
}

describe('RaceModel lap profiles', () => {
  it('profiles a lap: cumulative seconds per timing line from its start, ending on the lap time', () => {
    // Each lap: the first half in 20 s, the second in 10 s. Lap 1 starts before the first sight.
    const shape = (u: number): number => (u < 20 ? (0.5 * u) / 20 : 0.5 + (0.5 * (u - 20)) / 10)
    const cars = (t: number): Cars => ({ 0: { d: Math.floor(t / 30) + shape(t % 30) } })
    for (const hz of [60, 7]) {
      const sim = new Sim(makeSession(1), { sessionNum: PRACTICE })
      sim.run(45, hz, cars)
      expect(sim.view.lapProfile(0, 'last')).toBeNull() // lap 1 joined mid-lap
      expect(sim.view.lapProfile(0, 'best')).toBeNull()
      sim.run(20, hz, cars) // 2.0 at 60
      const last = profileOf(sim.view, 0, 'last')
      expect(last.lap).toBe(2)
      expect(last.clean).toBe(true)
      expect(last.lapTime).toBeCloseTo(30, 3)
      expectWellFormed(last)
      expect(last.profile[25]).toBeCloseTo(10, 2)
      expect(last.profile[50]).toBeCloseTo(20, 2)
      expect(last.profile[75]).toBeCloseTo(25, 2)
      // Read-only snapshots, the same object while the lap is the same.
      expect(sim.view.lapProfile(0, 'last')).toBe(last)
      expect(Object.isFrozen(last)).toBe(true)
      expect(Object.isFrozen(last.profile)).toBe(true)
      const best = profileOf(sim.view, 0, 'best')
      expect(best).toEqual(last)
      expect(sim.view.lapProfile(0, 'best')).toBe(best)

      sim.run(30, hz, cars) // 3.0 at 90
      const next = profileOf(sim.view, 0, 'last')
      expect(next).not.toBe(last)
      expect(next.lap).toBe(3)
      // A snapshot already handed out never changes.
      expect(last.lap).toBe(2)
      expect(last.profile[50]).toBeCloseTo(20, 2)
    }
  })

  it('keeps the best clean lap after it leaves the 5-lap history', () => {
    const sim = new Sim(makeSession(1, { sectorStarts: [0, 0.5] }), { sessionNum: PRACTICE })
    // Lap 2 in 28 s, then slower and slower laps, then lap 10 in 27 s.
    const d = byLapTimes([30, 28, 31, 32, 33, 34, 35, 36, 37, 27, 40])
    const cars = (t: number): Cars => ({ 0: { d: d(t) } })
    sim.runUntil(() => sim.view.car(0)?.laps[0]?.lap === 9, cars)
    // Lap 2 is out of the line history.
    expect(sim.view.lapSectors(0, 6)).not.toBeNull()
    expect(sim.view.lapSectors(0, 2)).toBeNull()
    const best = profileOf(sim.view, 0, 'best')
    expect(best.lap).toBe(2)
    expect(best.lapTime).toBeCloseTo(28, 3)
    expect(best.profile[50]).toBeCloseTo(14, 2)
    expectWellFormed(best)
    expect(profileOf(sim.view, 0, 'last')).toMatchObject({ lap: 9, clean: true })
    expect(profileOf(sim.view, 0, 'last').lapTime).toBeCloseTo(37, 3)

    sim.runUntil(() => sim.view.car(0)?.laps[0]?.lap === 10, cars)
    const faster = profileOf(sim.view, 0, 'best')
    expect(faster).not.toBe(best)
    expect(faster.lap).toBe(10)
    expect(faster.lapTime).toBeCloseTo(27, 3)
    expect(faster.profile[50]).toBeCloseTo(13.5, 2)
    // A slower lap does not replace it.
    sim.runUntil(() => sim.view.car(0)?.laps[0]?.lap === 11, cars)
    expect(sim.view.lapProfile(0, 'best')).toBe(faster)
  })

  it('never takes an unclean lap as the best, however fast', () => {
    const sim = new Sim(makeSession(1), { sessionNum: PRACTICE })
    let jump = 0
    let caution = false
    // Lap 2 in 30 s (clean); laps 3..6 in 25 s with a cut, a pit pass, a caution and a tow.
    const d = byLapTimes([30, 30, 25, 25, 25, 25, 25, 30])
    const cars = (t: number): Cars => {
      const x = d(t) + jump
      return {
        0: {
          d: x,
          surface: x > 2.4 && x < 2.42 ? TrackLocation.OffTrack : TrackLocation.OnTrack,
          pit: x > 3.4 && x < 3.5
        }
      }
    }
    const each = (): void => {
      sim.frame.SessionFlags[0] = caution ? SessionFlag.Caution : 0
    }
    const until = (lap: number): void =>
      sim.runUntil(() => sim.view.car(0)?.laps[0]?.lap === lap, cars, each)
    until(2)
    const best = profileOf(sim.view, 0, 'best')
    expect(best).toMatchObject({ lap: 2, clean: true })

    until(3) // off track at 2.4
    expect(profileOf(sim.view, 0, 'last')).toMatchObject({ lap: 3, clean: false })
    until(4) // pit road at 3.4
    expect(profileOf(sim.view, 0, 'last')).toMatchObject({ lap: 4, clean: false })
    caution = true
    until(5) // under caution
    caution = false
    expect(profileOf(sim.view, 0, 'last')).toMatchObject({ lap: 5, clean: false })
    sim.runUntil(() => (sim.view.car(0)?.distance ?? 0) >= 5.5, cars, each)
    jump = 0.3 // towed forward inside lap 6: lines skipped, no profile at all
    until(6)
    expect(sim.view.car(0)?.laps[0]).toMatchObject({ lap: 6, clean: false })
    expect(sim.view.lapProfile(0, 'last')).toBeNull()
    expect(sim.view.lapProfile(0, 'best')).toBe(best)

    until(7) // clean again in 25 s: now it is the best
    const next = profileOf(sim.view, 0, 'best')
    expect(next).toMatchObject({ lap: 7, clean: true })
    expect(next.lapTime).toBeCloseTo(25, 3)
  })

  it('does not take the first racing lap or a lap started before the green as the best', () => {
    // Standing start on the grid at 0.98; 1.0 just after the green.
    const sim = new Sim(makeSession(1), { state: SessionState.GetInCar })
    sim.run(5, 60, () => ({ 0: { d: 0.98, lap: 0 } }))
    sim.state = SessionState.Racing
    const green = sim.t
    const cars = (t: number): Cars => ({ 0: { d: 0.98 + V * (t - green) } })
    sim.run(32, 60, cars) // 1.0 and 2.0 (lap 2: the first racing lap)
    // Timed from the green, as iRacing does: its lines only span the part from the line.
    expect(sim.view.lapProfile(0, 'last')).toBeNull()
    expect(sim.view.lapProfile(0, 'best')).toBeNull()
    sim.run(30, 60, cars) // 3.0
    expect(profileOf(sim.view, 0, 'best')).toMatchObject({ lap: 3, clean: true })
  })

  it('profiles the first racing lap of a rolling start, never as the best', () => {
    const sim = new Sim(makeSession(1), { state: SessionState.ParadeLaps })
    const cars = (t: number): Cars => ({ 0: { d: 0.85 + V * t } })
    sim.run(3, 60, cars)
    sim.state = SessionState.Racing
    sim.run(32, 60, cars) // 1.0 at t = 4.5, 2.0 at t = 34.5
    expect(profileOf(sim.view, 0, 'last')).toMatchObject({ lap: 2, clean: false })
    expect(profileOf(sim.view, 0, 'last').lapTime).toBeCloseTo(LAP_S, 2)
    expect(sim.view.lapProfile(0, 'best')).toBeNull()
  })

  it('ends the profile on the official lap time once iRacing confirms it', () => {
    const sim = new Sim(makeSession(1), { sessionNum: PRACTICE })
    // Lap 2 in 30 s, lap 3 in 30.02 s (model), which iRacing times at 29.99.
    const d = byLapTimes([30, 30, 30.02, 30])
    const cars = (t: number): Cars => ({ 0: { d: d(t) } })
    sim.runUntil(() => sim.view.car(0)?.laps[0]?.lap === 2, cars)
    sim.frame.CarIdxLastLapTime[0] = 30.001
    sim.run(0.5, 60, cars)
    const lap2 = profileOf(sim.view, 0, 'best')
    expect(lap2.lapTime).toBe(30.001)
    expect(lap2.profile[LINES]).toBe(30.001)

    sim.runUntil(() => sim.view.car(0)?.laps[0]?.lap === 3, cars)
    const model = profileOf(sim.view, 0, 'last')
    expect(model.lapTime).toBeCloseTo(30.02, 3)
    expect(sim.view.lapProfile(0, 'best')).toBe(lap2) // 30.02 is slower
    sim.frame.CarIdxLastLapTime[0] = 29.99
    sim.run(0.5, 60, cars)
    const official = profileOf(sim.view, 0, 'last')
    expect(official).not.toBe(model)
    expect(official.lapTime).toBe(29.99)
    expectWellFormed(official)
    // Rescaled: every line keeps its share of the lap.
    expect(official.profile[50]).toBeCloseTo((model.profile[50] ?? 0) * (29.99 / model.lapTime), 9)
    // The exact time makes it the best.
    const best = profileOf(sim.view, 0, 'best')
    expect(best).toMatchObject({ lap: 3, lapTime: 29.99, clean: true })
    expect(best.profile).toEqual(official.profile)
  })

  it('profiles every car, and only cars of the session', () => {
    const sim = new Sim(makeSession(2), { sessionNum: PRACTICE })
    const d1 = byLapTimes([20, 29, 29])
    sim.run(65, 60, (t) => ({ 0: { d: 0.5 + V * t }, 1: { d: d1(t) } }))
    expect(profileOf(sim.view, 0, 'best').lapTime).toBeCloseTo(30, 3)
    expect(profileOf(sim.view, 1, 'best').lapTime).toBeCloseTo(29, 3)
    expect(sim.view.lapProfile(5, 'best')).toBeNull()
    expect(sim.view.lapProfile(-1, 'last')).toBeNull()
    expect(sim.view.lapProfile(0, 'other' as never)).toBeNull()
  })
})

describe('RaceModel current lap', () => {
  it('times the lap in progress from its interpolated S/F crossing', () => {
    for (const hz of [60, 7]) {
      const sim = new Sim(makeSession(1), { sessionNum: PRACTICE })
      const cars = (t: number): Cars => ({ 0: { d: 0.5 + V * t } })
      let seen = 0
      sim.run(100, hz, cars, (t) => {
        const cur = sim.view.currentLap(0)
        const d = 0.5 + V * t
        // Joined mid-lap: unknown until the first crossing (1.0 at t = 15).
        if (d < 1) {
          expect(cur).toBeNull()
          return
        }
        if (cur === null) throw new Error(`no current lap at t = ${t}`)
        // 1e-9 laps of slack for the float32 pct right at the line.
        const completed = Math.floor(d + 1e-9)
        expect(cur.lap).toBe(completed + 1)
        expect(cur.elapsedS).toBeCloseTo(t - (completed - 0.5) / V, 4)
        expect(sim.view.currentLap(0)).toBe(cur)
        seen++
      })
      expect(seen).toBeGreaterThan(80 * hz)
      expect(Object.isFrozen(sim.view.currentLap(0))).toBe(true)
    }
  })

  it('is unknown out of the world, after a tow and after the flag, until a new crossing', () => {
    const sim = new Sim(makeSession(1), { sessionNum: PRACTICE })
    let jump = 0
    let present = true
    const cars = (t: number): Cars => (present ? { 0: { d: 0.5 + V * t + jump } } : { 0: null })
    sim.run(20, 60, cars) // 1.0 at 15
    expect(sim.view.currentLap(0)?.lap).toBe(2)

    present = false
    sim.run(2, 60, cars)
    expect(sim.view.currentLap(0)).toBeNull()
    present = true
    sim.run(1, 60, cars) // back in the world mid-lap
    expect(sim.view.currentLap(0)).toBeNull()
    sim.runUntil(() => (sim.view.car(0)?.distance ?? 0) >= 2.01, cars)
    expect(sim.view.currentLap(0)?.lap).toBe(3)
    expect(sim.view.currentLap(0)?.elapsedS).toBeCloseTo(0.01 * LAP_S, 1)

    // Towed forward across the line: no crossing of 3.0 was seen.
    sim.runUntil(() => (sim.view.car(0)?.distance ?? 0) >= 2.95, cars)
    jump = 0.1
    sim.run(0.5, 60, cars)
    expect(sim.view.car(0)?.distance).toBeGreaterThan(3)
    expect(sim.view.currentLap(0)).toBeNull()
    sim.runUntil(() => (sim.view.car(0)?.distance ?? 0) >= 4.01, cars)
    expect(sim.view.currentLap(0)?.lap).toBe(5)

    // Reconnect mid-lap: the gap breaks the lap in progress.
    sim.model.reset()
    sim.t += 1
    sim.run(1, 60, cars)
    expect(sim.view.currentLap(0)).toBeNull()
    sim.runUntil(() => (sim.view.car(0)?.distance ?? 0) >= 5.01, cars)
    expect(sim.view.currentLap(0)?.lap).toBe(6)
  })

  it('stops timing at the chequered flag, keeping the finishing lap profile', () => {
    const sim = new Sim(makeSession(1))
    const cars = (t: number): Cars => ({ 0: { d: 2.5 + V * t } })
    sim.run(16, 60, cars) // 3.0 at 15
    expect(sim.view.currentLap(0)?.lap).toBe(4)
    sim.run(28, 60, cars) // t = 44
    sim.state = SessionState.Checkered
    sim.run(10, 60, cars) // 4.0 at 45: the finish
    expect(sim.view.car(0)?.finished).toBe(true)
    expect(sim.view.currentLap(0)).toBeNull()
    expect(profileOf(sim.view, 0, 'last')).toMatchObject({ lap: 4, clean: true })
    sim.run(40, 60, cars) // a cool-down crossing is no lap
    expect(sim.view.currentLap(0)).toBeNull()
    expect(profileOf(sim.view, 0, 'last').lap).toBe(4)
  })
})

describe('RaceModel lap profiles across sessions', () => {
  it('keeps them across a reconnect to the same session and forgets them with a new one', () => {
    const sim = new Sim(makeSession(1), { sessionNum: PRACTICE })
    const cars = (t: number): Cars => ({ 0: { d: 0.5 + V * t } })
    sim.run(50, 60, cars) // 1.0 at 15, 2.0 at 45
    const best = profileOf(sim.view, 0, 'best')
    const last = profileOf(sim.view, 0, 'last')

    sim.model.reset()
    sim.t += 1
    sim.run(1, 60, cars)
    expect(sim.view.lapProfile(0, 'best')).toBe(best)
    expect(sim.view.lapProfile(0, 'last')).toBe(last)

    sim.session = makeSession(1, { subSessionId: 2000 })
    sim.run(1, 60, cars)
    expect(sim.view.lapProfile(0, 'best')).toBeNull()
    expect(sim.view.lapProfile(0, 'last')).toBeNull()
    expect(sim.view.currentLap(0)).toBeNull()
    // Joined the new session mid-lap: lap 3 has no start line, lap 4 is the first full one.
    sim.runUntil(() => (sim.view.car(0)?.distance ?? 0) >= 3.01, cars)
    expect(sim.view.lapProfile(0, 'best')).toBeNull()
    expect(sim.view.lapProfile(0, 'last')).toBeNull()
    expect(sim.view.currentLap(0)?.lap).toBe(4)
    sim.runUntil(() => sim.view.car(0)?.laps[0]?.lap === 4, cars)
    expect(profileOf(sim.view, 0, 'best')).toMatchObject({ lap: 4, clean: true })

    sim.model.hardReset()
    expect(sim.view.lapProfile(0, 'best')).toBeNull()
    expect(sim.view.currentLap(0)).toBeNull()
  })
})
