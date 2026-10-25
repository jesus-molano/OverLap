import { describe, expect, it } from 'vitest'
import { SessionState, TrackLocation } from '../telemetry'
import type { DriverEntry } from '../types'
import { entryKey } from './entry'
import { PRACTICE, Sim, V, car, makeDriver, makeSession, sortedOverall } from './testing/raceSim'
import type { Cars } from './testing/raceSim'

describe('RaceModel session lifecycle', () => {
  it('starts over when the SubSessionID or SessionNum changes', () => {
    const sim = new Sim(makeSession(1))
    const cars = (t: number): Cars => ({ 0: { d: 0.5 + V * t, pit: t > 2 && t < 3 } })
    sim.run(5, 60, cars)
    expect(car(sim.view, 0).pitStops).toBe(1)
    const key1 = sim.view.sessionKey
    expect(key1).toContain('1000:0')

    sim.session = makeSession(1, { subSessionId: 2000 })
    sim.run(1, 60, cars)
    const key2 = sim.view.sessionKey
    expect(key2).not.toBe(key1)
    expect(key2).toContain('2000:0')
    expect(car(sim.view, 0).pitStops).toBe(0)

    sim.frame.SessionNum[0] = PRACTICE
    sim.run(1, 60, cars)
    expect(sim.view.sessionKey).not.toBe(key2)
    expect(sim.view.racing).toBe(false)
  })

  it('restarts when SessionTime goes back', () => {
    const sim = new Sim(makeSession(1))
    sim.run(5, 60, (t) => ({ 0: { d: 0.5 + V * t, pit: t > 2 && t < 3 } }))
    const key = sim.view.sessionKey
    sim.t = 0
    sim.run(1, 60, (t) => ({ 0: { d: 0.5 + V * t } }))
    expect(sim.view.sessionKey).not.toBe(key)
    expect(car(sim.view, 0).pitStops).toBe(0)
  })

  it('resumes the same session after a reconnect without losing counts', () => {
    const sim = new Sim(makeSession(2))
    // Car 0 stops at t 2..3, laps in 30 s; it is on pit road again across the telemetry gap.
    const pit = (t: number): boolean => (t > 2 && t < 3) || (t > 68 && t < 80)
    const cars = (t: number): Cars => ({ 0: { d: 0.5 + V * t, pit: pit(t) }, 1: { d: V * t } })
    sim.run(70, 60, cars)
    const key = sim.view.sessionKey
    const driven = sim.view.playerDistanceDriven
    expect(car(sim.view, 0).pitStops).toBe(2)
    expect(car(sim.view, 0).laps.map((l) => l.lap)).toEqual([2])

    sim.model.reset()
    expect(sim.view.sessionKey).toBe('')
    expect(car(sim.view, 0).pitStops).toBe(2)
    sim.t += 2 // 2 s without telemetry, mid-lap
    sim.run(70, 60, cars) // 3.0 at 75, 4.0 at 105, 5.0 at 135
    expect(sim.view.sessionKey).not.toBe('')
    expect(sim.view.sessionKey).not.toBe(key)
    // The stop in progress across the gap is not counted twice; history and SR distance carry on.
    expect(car(sim.view, 0).pitStops).toBe(2)
    expect(car(sim.view, 0).laps.map((l) => [l.lap, l.clean])).toEqual([
      [5, true],
      [4, false],
      [3, false],
      [2, true]
    ])
    expect(sim.view.playerDistanceDriven).toBeCloseTo(driven + (70 - 1 / 60) * V, 2)
    expect(sim.view.timeGap(1, 0)).toBeCloseTo(15, 1)
    expect(sortedOverall(sim.view)).toEqual([1, 2])
  })

  it('starts over when the reconnect lands in another session', () => {
    const sim = new Sim(makeSession(1))
    const cars = (t: number): Cars => ({ 0: { d: 0.5 + V * t, pit: t > 2 && t < 3 } })
    sim.run(5, 60, cars)
    sim.model.reset()
    sim.session = makeSession(1, { subSessionId: 3000 })
    sim.run(1, 60, cars)
    expect(sim.view.sessionKey).toContain('3000:0')
    expect(car(sim.view, 0).pitStops).toBe(0)
  })

  it('resumes an offline session (SubSessionID 0) only after a short gap', () => {
    const sim = new Sim(makeSession(1, { subSessionId: 0 }))
    const cars = (t: number): Cars => ({ 0: { d: 0.5 + V * t, pit: t > 2 && t < 3 } })
    sim.run(5, 60, cars)
    sim.model.reset()
    sim.t += 10
    sim.run(1, 60, cars)
    expect(car(sim.view, 0).pitStops).toBe(1)
    sim.model.reset()
    sim.t += 120
    sim.run(1, 60, cars)
    expect(car(sim.view, 0).pitStops).toBe(0)
  })

  it('forgets everything on hardReset()', () => {
    const sim = new Sim(makeSession(1))
    const cars = (t: number): Cars => ({ 0: { d: 0.5 + V * t, pit: t > 2 && t < 3 } })
    sim.run(5, 60, cars)
    sim.model.hardReset()
    expect(sim.view.sessionKey).toBe('')
    expect(sim.view.car(0)).toBeUndefined()
    expect(sim.view.cars()).toHaveLength(0)
    sim.run(1, 60, cars)
    expect(sim.view.sessionKey).not.toBe('')
    expect(car(sim.view, 0).pitStops).toBe(0)
  })
})

describe('RaceModel entries', () => {
  const teamDriver = (carIdx: number, teamId: number, name: string, userId: number): DriverEntry =>
    makeDriver(carIdx, { teamId, userName: name, userId })

  it('keeps a team car history across driver changes in its pit stops', () => {
    const lineup = (second: string, secondId: number): DriverEntry[] => [
      teamDriver(0, 7, 'Lead A', 1),
      teamDriver(1, 8, second, secondId)
    ]
    const first = makeSession(0, { teamRacing: true }, lineup('Driver A', 11))
    const swapped = makeSession(0, { teamRacing: true }, lineup('Driver B', 12))
    const sim = new Sim(first)
    const pit = (t: number): boolean => (t > 100 && t < 110) || (t > 250 && t < 260)
    const cars = (t: number): Cars => ({
      0: { d: 0.5 + V * t },
      1: { d: 0.4 + V * t, pit: pit(t) }
    })
    sim.run(105, 60, cars)
    const lapsBefore = car(sim.view, 1).laps.length
    sim.session = swapped // DriverInfo shows the new driver while the car is on pit road
    sim.run(45, 60, cars) // t = 150
    expect(car(sim.view, 1).pitStops).toBe(1)
    expect(car(sim.view, 1).lastPitLap).toBe(4)
    expect(car(sim.view, 1).laps.length).toBeGreaterThan(lapsBefore)
    expect(car(sim.view, 1).bestLapTime).toBeCloseTo(30, 3)
    expect(sim.view.gapHistory(1, 0, 3).length).toBeGreaterThan(200)
    sim.run(105, 60, cars) // t = 255: back to the first driver on pit road
    sim.session = makeSession(0, { teamRacing: true }, lineup('Driver A', 11))
    sim.run(45, 60, cars) // t = 300
    expect(car(sim.view, 1).pitStops).toBe(2)
    expect(car(sim.view, 1).lastPitLap).toBe(9)
    expect(car(sim.view, 1).laps).toHaveLength(9)
    expect(sim.view.timeGap(1, 0)).toBeCloseTo(3, 1)
  })

  it('clears the slot when another driver takes the CarIdx in a solo session', () => {
    const sim = new Sim(makeSession(2))
    const cars = (t: number): Cars => ({
      0: { d: 0.5 + V * t, pit: t > 2 && t < 3 },
      1: { d: V * t }
    })
    sim.run(50, 60, cars)
    expect(car(sim.view, 0).pitStops).toBe(1)
    sim.session = makeSession(0, {}, [
      makeDriver(0, { userId: 999, userName: 'Otro' }),
      makeDriver(1)
    ])
    sim.run(1 / 60, 60, cars)
    expect(car(sim.view, 0).pitStops).toBe(0)
    expect(car(sim.view, 0).laps).toEqual([])
  })

  it('clears a team car when its TeamID changes', () => {
    const sim = new Sim(makeSession(0, { teamRacing: true }, [teamDriver(0, 7, 'A', 1)]))
    const cars = (t: number): Cars => ({ 0: { d: 0.5 + V * t, pit: t > 2 && t < 3 } })
    sim.run(5, 60, cars)
    expect(car(sim.view, 0).pitStops).toBe(1)
    sim.session = makeSession(0, { teamRacing: true }, [teamDriver(0, 9, 'A', 1)])
    sim.run(1 / 60, 60, cars)
    expect(car(sim.view, 0).pitStops).toBe(0)
  })

  it('keys entries by team in team races and by person otherwise', () => {
    const d = makeDriver(3, { teamId: 42, userId: 7, userName: 'Ana', carNumber: '23' })
    expect(entryKey(d, true)).toBe('t42')
    expect(entryKey(d, false)).toBe('u7')
    expect(entryKey({ ...d, teamId: 0 }, true)).toBe('c23')
    expect(entryKey({ ...d, userId: 0 }, false)).toBe('nAna')
  })
})

describe('RaceModel player distance (SR corners)', () => {
  it('integrates the distance the player drives, skipping tows and jitter', () => {
    const sim = new Sim(makeSession(2))
    sim.frame.PlayerCarIdx[0] = 1
    let offset = 0
    const cars = (t: number): Cars => ({ 0: { d: 0.2 + V * t }, 1: { d: 0.1 + V * t + offset } })
    sim.run(45, 60, cars)
    expect(sim.view.playerCarIdx).toBe(1)
    expect(sim.view.playerDistanceDriven).toBeCloseTo(1.5, 2)
    // Tow: out of the world for a second, then back 0.5 laps further on.
    sim.frame.PlayerTrackSurface[0] = TrackLocation.NotInWorld
    sim.run(1, 60, (t) => ({ 0: { d: 0.2 + V * t } }))
    sim.frame.PlayerTrackSurface[0] = TrackLocation.OnTrack
    offset = 0.5
    sim.run(15, 60, cars)
    expect(sim.view.playerDistanceDriven).toBeCloseTo(2.0, 2)
    // Stopped with pct noise: nothing accumulates.
    const stopped = 0.1 + V * sim.t + offset
    sim.run(5, 60, (t) => ({ 1: { d: stopped + (Math.round(t * 60) % 2 ? 0.001 : -0.001) } }))
    expect(sim.view.playerDistanceDriven).toBeLessThan(2.0 + 0.002 + 0.01)
    sim.frame.PlayerCarMyIncidentCount[0] = 4
    sim.run(1 / 60, 60, () => ({ 1: { d: stopped } }))
    expect(sim.view.playerIncidents).toBe(4)
  })

  it('counts only while the player is in the car (not a teammate stint or a replay)', () => {
    const sim = new Sim(makeSession(1))
    const cars = (t: number): Cars => ({ 0: { d: 0.1 + V * t } })
    sim.run(15, 60, cars)
    expect(sim.view.playerDistanceDriven).toBeCloseTo(0.5, 2)
    sim.frame.IsOnTrack[0] = false
    sim.run(30, 60, cars)
    expect(sim.view.playerDistanceDriven).toBeCloseTo(0.5, 2)
    sim.frame.IsOnTrack[0] = true
    sim.run(15, 60, cars)
    expect(sim.view.playerDistanceDriven).toBeCloseTo(1.0, 2)
  })

  it('covers the whole session like the incident count when it starts mid-session', () => {
    const sim = new Sim(makeSession(1), { sessionNum: PRACTICE })
    sim.t = 1800
    sim.frame.PlayerCarMyIncidentCount[0] = 4
    const cars = (t: number): Cars => ({ 0: { d: 20.25 + V * (t - 1800) } })
    sim.run(1 / 60, 60, cars)
    expect(sim.view.playerIncidents).toBe(4)
    expect(sim.view.playerDistanceDriven).toBeCloseTo(20.25, 2)
    sim.run(30, 60, cars)
    expect(sim.view.playerDistanceDriven).toBeCloseTo(21.25, 2)
  })

  it('does not seed from the grid or from a team car', () => {
    const grid = new Sim(makeSession(1), { state: SessionState.GetInCar })
    grid.run(1, 60, () => ({ 0: { d: 0.98, lap: 0 } }))
    expect(grid.view.playerDistanceDriven).toBe(0)

    const team = new Sim(makeSession(1, { teamRacing: true }))
    team.run(1, 60, (t) => ({ 0: { d: 30.5 + V * t } }))
    expect(team.view.playerDistanceDriven).toBeCloseTo(V * (1 - 1 / 60), 4)
  })

  it('falls back to DriverCarIdx when PlayerCarIdx is not a known driver', () => {
    const sim = new Sim(makeSession(2, { playerCarIdx: 1 }))
    sim.frame.PlayerCarIdx[0] = 40
    sim.run(1, 60, (t) => ({ 0: { d: 0.5 + V * t } }))
    expect(sim.view.playerCarIdx).toBe(1)
  })
})

describe('RaceModel steady state', () => {
  it('keeps one view, one cars() array and one state object per car', () => {
    const n = 40
    const sim = new Sim(makeSession(n))
    const cars: Cars = {}
    const fill = (t: number): Cars => {
      for (let i = 0; i < n; i++) cars[i] = { d: 0.5 + i * 0.013 + (V + i * 0.0001) * t }
      return cars
    }
    const view = sim.model.view
    sim.run(1, 60, fill)
    const list = view.cars()
    const state7 = view.car(7)
    expect(list).toHaveLength(n)
    let lapsChanges = 0
    let prevLaps = view.car(7)?.laps
    sim.run(10_000 / 60, 60, fill, () => {
      expect(view.cars()).toBe(list)
      const laps = view.car(7)?.laps
      if (laps !== prevLaps) lapsChanges++
      prevLaps = laps
    })
    expect(sim.model.view).toBe(view)
    expect(view.car(7)).toBe(state7)
    // The laps array only changes when a lap completes (~5.5 laps in 167 s).
    expect(lapsChanges).toBeGreaterThan(3)
    expect(lapsChanges).toBeLessThan(8)
    expect(sortedOverall(view)).toEqual(list.map((_, k) => k + 1))
  })
})
