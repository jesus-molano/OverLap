/**
 * The clean-lap rule and your incidents (request 4: the session best must be a legal lap). The
 * model already drops laps that left the track on a tick it saw; an off-track iRacing scored (a
 * 1x rise of your incident count, maybe between two ticks) spoils your lap too, or the lap the
 * line just closed when it comes within INCIDENT_LINE_GRACE_S of it. Contact and spins do not.
 */
import { describe, expect, it } from 'vitest'
import { TrackLocation } from '../telemetry'
import { INCIDENT_LINE_GRACE_S } from './laps'
import { PRACTICE, RACE, Sim, makeSession } from './testing/raceSim'
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
    return d + rest / (lapTimes[lapTimes.length - 1] ?? 30)
  }
}

interface Rig {
  sim: Sim
  lap: (lap: number) => void
  to: (x: number) => void
  wait: (s: number) => void
  incident: (n?: number) => void
}

/** Your car (CarIdx 0) driving laps of these times; `offAt` its laps off track (a short cut). */
function rig(
  lapTimes: readonly number[],
  offAt: readonly number[] = [],
  sessionNum = PRACTICE
): Rig {
  const sim = new Sim(makeSession(1), { sessionNum })
  const d = byLapTimes(lapTimes)
  const cars = (t: number): Cars => {
    const x = d(t)
    const off = offAt.some((at) => x > at && x < at + 0.02)
    return { 0: { d: x, surface: off ? TrackLocation.OffTrack : TrackLocation.OnTrack } }
  }
  let incidents = 0
  const until = (done: () => boolean): void => sim.runUntil(done, cars)
  return {
    sim,
    /** Runs until your lap `lap` is closed (its record is the newest). */
    lap: (lap: number): void => until(() => sim.view.car(0)?.laps[0]?.lap === lap),
    /** Runs until your distance reaches `x` laps. */
    to: (x: number): void => until(() => (sim.view.car(0)?.distance ?? 0) >= x),
    /** Runs `s` more seconds. */
    wait: (s: number): void => sim.run(s, 60, cars),
    /** iRacing scores `n` more incidents for you (as of the next tick). */
    incident: (n = 1): void => {
      incidents += n
      sim.frame.PlayerCarMyIncidentCount[0] = incidents
    }
  }
}

describe('RaceModel: your incidents and the clean-lap rule', () => {
  it('a rise of your incident count spoils the lap in progress, and only that lap', () => {
    // Lap 2 clean in 30 s; lap 3 in 25 s with an incident halfway; lap 4 clean in 28 s.
    const r = rig([30, 30, 25, 28, 30])
    r.lap(2)
    const best = r.sim.view.lapProfile(0, 'best')
    expect(best).toMatchObject({ lap: 2, clean: true })
    expect(r.sim.view.car(0)?.lapInvalid).toBe(false)

    r.to(2.5)
    r.incident()
    r.wait(0.1)
    // The lap in progress already says it (the delta's badge reads this).
    expect(r.sim.view.car(0)?.lapInvalid).toBe(true)
    r.lap(3)
    expect(r.sim.view.car(0)?.laps[0]).toMatchObject({ lap: 3, clean: false })
    // Faster, but never the best: the session best and the order's best stay lap 2.
    expect(r.sim.view.lapProfile(0, 'best')).toBe(best)
    expect(r.sim.view.car(0)?.bestLapTime).toBeCloseTo(30, 3)
    // The next lap starts clean.
    r.wait(0.1)
    expect(r.sim.view.car(0)?.lapInvalid).toBe(false)
    r.lap(4)
    expect(r.sim.view.lapProfile(0, 'best')).toMatchObject({ lap: 4, clean: true })
    expect(r.sim.view.car(0)?.bestLapTime).toBeCloseTo(28, 3)
  })

  it('an incident just after the line takes back the lap it closed: the best before it returns', () => {
    const r = rig([30, 30, 25, 30, 30])
    r.lap(2)
    const before = r.sim.view.lapProfile(0, 'best')
    r.lap(3)
    // Clean at the line, and the new best for a moment.
    expect(r.sim.view.lapProfile(0, 'last')).toMatchObject({ lap: 3, clean: true })
    expect(r.sim.view.lapProfile(0, 'best')).toMatchObject({ lap: 3 })
    expect(r.sim.view.car(0)?.bestLapTime).toBeCloseTo(25, 3)

    r.incident()
    r.wait(INCIDENT_LINE_GRACE_S / 3)

    // The lap is not clean any more: a new snapshot says so (the personal best is offered from
    // it, the optimal laps read it again).
    expect(r.sim.view.car(0)?.laps[0]).toMatchObject({ lap: 3, clean: false })
    expect(r.sim.view.lapProfile(0, 'last')).toMatchObject({ lap: 3, clean: false })
    expect(r.sim.view.lapProfile(0, 'best')).toEqual(before)
    expect(r.sim.view.car(0)?.bestLapTime).toBeCloseTo(30, 3)
    // The off was the closed lap's: the lap in progress stays clean.
    expect(r.sim.view.car(0)?.lapInvalid).toBe(false)
    r.lap(4)
    expect(r.sim.view.car(0)?.laps[0]).toMatchObject({ lap: 4, clean: true })
  })

  it('an incident later in the next lap leaves the lap before it clean', () => {
    const r = rig([30, 30, 25, 30, 30])
    r.lap(3)
    r.wait(INCIDENT_LINE_GRACE_S + 0.5)
    r.incident()
    r.wait(0.1)
    expect(r.sim.view.car(0)?.laps[0]).toMatchObject({ lap: 3, clean: true })
    expect(r.sim.view.lapProfile(0, 'best')).toMatchObject({ lap: 3, clean: true })
    expect(r.sim.view.car(0)?.lapInvalid).toBe(true)
  })

  it('the first count seen is no rise; nor is one while you are not in the car', () => {
    const r = rig([30, 30, 30, 30])
    // Joined a session with incidents already on the counter.
    r.incident(6)
    r.lap(2)
    expect(r.sim.view.car(0)?.laps[0]).toMatchObject({ lap: 2, clean: true })
    // A teammate drives (or a replay plays): their incidents are not your lap's.
    r.to(2.5)
    r.sim.frame.IsOnTrack[0] = false
    r.incident()
    r.wait(0.1)
    r.sim.frame.IsOnTrack[0] = true
    r.lap(3)
    expect(r.sim.view.car(0)?.laps[0]).toMatchObject({ lap: 3, clean: true })
  })

  it('contact (4x, 0x) and a loss of control (2x) leave the lap clean, as iRacing counts it', () => {
    for (const sessionNum of [PRACTICE, RACE]) {
      const r = rig([30, 30, 25, 30, 30], [], sessionNum)
      r.lap(2)
      r.to(2.3)
      r.incident(4)
      r.wait(0.1)
      expect(r.sim.view.car(0)?.lapInvalid).toBe(false)
      r.to(2.6)
      r.incident(2)
      r.wait(0.1)
      expect(r.sim.view.car(0)?.lapInvalid).toBe(false)
      r.lap(3)
      expect(r.sim.view.car(0)?.laps[0]).toMatchObject({ lap: 3, clean: true })
      // A 2x just after the line does not take back the lap it closed either.
      r.incident(2)
      r.wait(INCIDENT_LINE_GRACE_S / 3)
      expect(r.sim.view.car(0)?.laps[0]).toMatchObject({ lap: 3, clean: true })
    }
  })

  it('Posiciones’ best is your best legal lap, not iRacing’s when that is an illegal one', () => {
    const r = rig([30, 30, 25, 30, 30], [2.4])
    r.lap(3)
    // iRacing counts the 25 s lap that left the track as your best.
    r.sim.frame.CarIdxBestLapTime[0] = 25
    r.wait(0.1)
    expect(r.sim.view.car(0)?.bestLapTime).toBeCloseTo(30, 3)
    expect(r.sim.view.lapProfile(0, 'best')).toMatchObject({ lap: 2, clean: true })
    // A legal lap iRacing reports as the best is its value, to the thousandth.
    r.sim.frame.CarIdxBestLapTime[0] = 29.987
    r.wait(0.1)
    expect(r.sim.view.car(0)?.bestLapTime).toBe(29.987)
  })

  it('an incident just after the line makes iRacing’s best of that lap not yours either', () => {
    const r = rig([30, 30, 25, 30, 30])
    r.lap(3)
    r.incident()
    r.wait(INCIDENT_LINE_GRACE_S / 3)
    r.sim.frame.CarIdxBestLapTime[0] = r.sim.view.car(0)?.laps[0]?.time ?? 25
    r.wait(0.1)
    expect(r.sim.view.car(0)?.bestLapTime).toBeCloseTo(30, 3)
  })

  it('an off-track tick still spoils the lap without any incident (the rule as before)', () => {
    const r = rig([30, 30, 25, 30], [2.4])
    r.lap(3)
    expect(r.sim.view.car(0)?.laps[0]).toMatchObject({ lap: 3, clean: false })
    expect(r.sim.view.lapProfile(0, 'best')).toMatchObject({ lap: 2 })
  })
})
