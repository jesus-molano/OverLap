import { describe, expect, it } from 'vitest'
import { LAPS_REMAIN_UNLIMITED } from '../flags'
import { SessionState } from '../telemetry'
import type { SessionMeta } from '../types'
import { RACE, Sim, V, car, makeDriver, makeSession } from './testing/raceSim'
import type { Cars } from './testing/raceSim'

const QUALIFY = 1

/** A 720 s race (laps unlimited), as the Lime Rock MX-5 race. */
function timedRace(o: Partial<SessionMeta> = {}, n = 2): SessionMeta {
  return makeSession(n, {
    sessions: new Map([
      [RACE, { type: 'Race', name: 'RACE', laps: null, timeS: 720, rubberState: '' }]
    ]),
    ...o
  })
}

describe('RaceModel clock before the green (B02)', () => {
  it('shows the scheduled length, not the grid countdown, and estimates the laps from it', () => {
    const sim = new Sim(timedRace(), { state: SessionState.GetInCar })
    sim.frame.SessionLapsRemainEx[0] = LAPS_REMAIN_UNLIMITED
    // On the grid, behind the line (lap -1). SessionTimeRemain counts down the grid.
    sim.frame.SessionTimeRemain[0] = 95
    sim.run(1, 60, () => ({ 0: { d: -0.011 }, 1: { d: -0.045 } }))
    expect(sim.view.timeRemainingS).toBe(720)
    // 30 s laps: 720 s are 24 laps; the run from the grid to the line is not one.
    expect(sim.view.lapsRemaining(0)).toBe(24)
    expect(sim.view.lapsRemaining(1)).toBe(24)
    sim.state = SessionState.Racing
    sim.frame.SessionTimeRemain[0] = 718
    sim.run(1, 60, () => ({ 0: { d: -0.011 }, 1: { d: -0.045 } }))
    expect(sim.view.timeRemainingS).toBe(718)
  })

  it('has no clock before the green of a race without a time limit', () => {
    const sim = new Sim(makeSession(1), { state: SessionState.Warmup })
    sim.frame.SessionTimeRemain[0] = 60
    sim.frame.SessionLapsRemainEx[0] = 10
    sim.run(1, 60, () => ({ 0: { d: -0.02 } }))
    expect(sim.view.timeRemainingS).toBeNull()
    expect(sim.view.lapsRemaining(0)).toBe(10)
  })
})

describe('RaceModel pace before the first clean lap (B12)', () => {
  it('takes the qualifying times, not CarClassEstLapTime', () => {
    // The class estimate says 26 s; everybody qualified around 30 s (Lime Rock: 56.8 vs 61.6).
    const drivers = [0, 1, 2].map((i) => makeDriver(i, { classEstLapTime: 26 }))
    const grid = new Map([
      [0, { position: 1, classPosition: 1, bestLap: 30.4 }],
      [1, { position: 2, classPosition: 2, bestLap: 30.0 }],
      [2, { position: 3, classPosition: 3, bestLap: null }]
    ])
    const sim = new Sim(timedRace({ grid }, 3))
    sim.frame.SessionLapsRemainEx[0] = LAPS_REMAIN_UNLIMITED
    sim.session = { ...sim.session, drivers: new Map(drivers.map((d) => [d.carIdx, d])) }
    sim.frame.SessionTimeRemain[0] = 600
    sim.run(1, 60, () => ({ 0: { d: 0.5 }, 1: { d: 0.45 }, 2: { d: 0.4 } }))
    expect(car(sim.view, 0).pace).toBe(30.4)
    // No time of its own: its class's best qualifying time.
    expect(car(sim.view, 2).pace).toBe(30)
    // Leader at 30.4 s: 21 crossings, the flag at +623.2 s; car 2 at 30 s: 22 (24 at 26 s).
    expect(sim.view.lapsRemaining(2)).toBe(22)
  })
})

describe('RaceModel laps left in qualifying (B13)', () => {
  function qualifying(): Sim {
    const session = makeSession(1, {
      sessionTypes: new Map([[QUALIFY, 'Lone Qualify']]),
      sessions: new Map([
        [QUALIFY, { type: 'Lone Qualify', name: 'QUALIFY', laps: 2, timeS: 480, rubberState: '' }]
      ])
    })
    return new Sim(session, { sessionNum: QUALIFY })
  }

  it('does not go back up when you leave the car', () => {
    const sim = qualifying()
    const cars = (t: number): Cars => ({ 0: { d: 0.5 + V * t } })
    sim.frame.SessionLapsRemainEx[0] = 0
    sim.frame.SessionTimeRemain[0] = 200
    sim.run(1, 60, cars)
    expect(sim.view.lapsRemaining(0)).toBe(0)
    // Out of the car iRacing resets it to the session's laps.
    sim.frame.IsOnTrack[0] = false
    sim.frame.SessionLapsRemainEx[0] = 2
    sim.run(1, 60, cars)
    expect(sim.view.lapsRemaining(0)).toBe(0)
    // Back in the car (another run): taken again.
    sim.frame.IsOnTrack[0] = true
    sim.run(1, 60, cars)
    expect(sim.view.lapsRemaining(0)).toBe(2)
    // Over once the session cools down.
    sim.state = SessionState.CoolDown
    sim.run(1, 60, cars)
    expect(sim.view.lapsRemaining(0)).toBe(0)
  })

  it('shows the clock as well when the session also has a time limit (B23)', () => {
    const sim = qualifying()
    sim.frame.SessionLapsRemainEx[0] = 2
    sim.frame.SessionTimeRemain[0] = 447
    sim.run(1, 60, () => ({ 0: { d: 0.5 } }))
    expect(sim.view.timeRemainingS).toBe(447)
    expect(sim.view.lapsRemaining(0)).toBe(2)
    // The flag is out: no clock (SessionTimeRemain then counts down something else).
    sim.state = SessionState.Checkered
    sim.run(1, 60, () => ({ 0: { d: 0.5 } }))
    expect(sim.view.timeRemainingS).toBeNull()
  })
})

describe('RaceModel clock after the chequered flag (B03)', () => {
  it('has none once the flag is out, while the last lap is still being run', () => {
    const sim = new Sim(timedRace())
    sim.frame.SessionLapsRemainEx[0] = LAPS_REMAIN_UNLIMITED
    sim.frame.SessionTimeRemain[0] = 5
    const cars = (t: number): Cars => ({ 0: { d: 3.9 + V * t }, 1: { d: 3.5 + V * t } })
    sim.run(1, 60, cars)
    expect(sim.view.timeRemainingS).toBe(5)
    sim.state = SessionState.Checkered
    sim.frame.SessionTimeRemain[0] = 99
    sim.run(3, 60, cars) // car 0 takes the flag at 4.0, car 1 is on its last lap
    expect(car(sim.view, 0).finished).toBe(true)
    expect(sim.view.timeRemainingS).toBeNull()
    expect(sim.view.lapsRemaining(1)).toBe(1)
  })
})
