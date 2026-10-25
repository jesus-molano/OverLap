import { describe, it, expect } from 'vitest'
import { personalBestKey } from '@shared/delta/references'
import { parseSessionMeta } from '@shared/session'
import {
  MOCK_DRIVERS,
  MOCK_PACE_CAR_IDX,
  MOCK_SPECTATOR_CAR_IDX,
  isRaceDriver,
  licLevelOf,
  licSubLevelOf,
  rosterForSession
} from './drivers'
import { MOCK_RACE_LENGTH_S, MOCK_SUBSESSION_ID, MockRace } from './simulation'
import { MOCK_CORNERS } from './track'
import { at } from './testUtils'

describe('MockRace session info', () => {
  const race = new MockRace()
  const info = race.sessionInfo()
  const f = race.frame()
  const drivers = info.DriverInfo.Drivers
  const racers = drivers.filter((d) => !d.CarIsPaceCar && !d.IsSpectator)

  it('has ~20 race cars in 2 classes, a pace car and a spectator', () => {
    expect(racers.length).toBeGreaterThanOrEqual(18)
    expect(racers.length).toBeLessThanOrEqual(22)
    expect(new Set(racers.map((d) => d.CarClassID)).size).toBe(2)
    expect(drivers.find((d) => d.CarIdx === 0)?.CarIsPaceCar).toBe(1)
    expect(drivers.find((d) => d.CarIdx === 63)?.IsSpectator).toBe(1)
    expect(info.DriverInfo.PaceCarIdx).toBe(0)
    expect(new Set(drivers.map((d) => d.CarIdx)).size).toBe(drivers.length)
    expect(new Set(racers.map((d) => d.CarNumber)).size).toBe(racers.length)
  })

  it('describes the player, the track and the race session', () => {
    const me = drivers.find((d) => d.CarIdx === info.DriverInfo.DriverCarIdx)
    expect(me?.CarClassShortName).toBe('GT3')
    expect(me?.CarClassColor).toBe(0xffda59)
    expect(info.DriverInfo.DriverCarEstLapTime).toBe(me?.CarClassEstLapTime)
    expect(info.DriverInfo.DriverUserID).toBe(me?.UserID)
    expect(info.WeekendInfo.TrackLength).toBe('7.00 km')
    expect(info.WeekendInfo.TrackPitSpeedLimit).toBe('60.00 kph')
    expect(parseSessionMeta(info).pitSpeedLimitKmh).toBe(60)
    const session = info.SessionInfo.Sessions[0]
    expect(session?.SessionType).toBe('Race')
    expect(session?.SessionNum).toBe(0)
    expect(session?.SessionLaps).toBe('unlimited')
    expect(session?.SessionTime).toBe(`${MOCK_RACE_LENGTH_S}.0000 sec`)
  })

  it('gives every driver a UserID and TeamID, in a race without teams', () => {
    expect(info.WeekendInfo.TeamRacing).toBe(0)
    for (const d of drivers) expect(d.TeamID, d.UserName).toBe(0)
    expect(drivers.find((d) => d.CarIsPaceCar)?.UserID).toBe(-1)
    const people = drivers.filter((d) => !d.CarIsPaceCar).map((d) => d.UserID)
    expect(people.every((id) => Number.isInteger(id) && id > 0)).toBe(true)
    expect(new Set(people).size).toBe(people.length)
  })

  it('describes the event, the corners and the sectors', () => {
    const w = info.WeekendInfo
    expect(w.SubSessionID).toBe(MOCK_SUBSESSION_ID)
    expect(w.EventType).toBe('Race')
    expect(w.Official).toBe(1)
    expect(w.TrackNumTurns).toBe(MOCK_CORNERS.length)
    expect(info.SplitTimeInfo.Sectors).toEqual([
      { SectorNum: 0, SectorStartPct: 0 },
      { SectorNum: 1, SectorStartPct: 0.33 },
      { SectorNum: 2, SectorStartPct: 0.66 }
    ])
  })

  it('uses licence colours and levels matching the licence strings', () => {
    const colors: Record<string, number> = {
      R: 0xfc0706,
      D: 0xfc8a27,
      C: 0xfeec04,
      B: 0x00c702,
      A: 0x0153db
    }
    for (const d of drivers) {
      const expected = colors[d.LicString.charAt(0)]
      if (expected !== undefined) expect(d.LicColor, d.UserName).toBe(expected)
      expect(d.LicLevel, d.UserName).toBe(licLevelOf(d.LicString))
      expect(d.LicSubLevel, d.UserName).toBe(licSubLevelOf(d.LicString))
    }
  })

  it('gives every car its model (CarID, one per class) and the track its id and layout', () => {
    const carIdOf = (cls: string): number[] => [
      ...new Set(racers.filter((d) => d.CarClassShortName === cls).map((d) => d.CarID))
    ]
    expect(carIdOf('GT3')).toEqual([67])
    expect(carIdOf('LMP2')).toEqual([128])
    expect(drivers.find((d) => d.CarIsPaceCar)?.CarID).toBeGreaterThan(0)
    expect(drivers.find((d) => d.IsSpectator)?.CarID).toBe(0)
    expect(info.WeekendInfo.TrackID).toBe(9001)
    expect(info.WeekendInfo.TrackConfigName).toBe('Gran Premio')
    const meta = parseSessionMeta(info)
    expect(meta.trackId).toBe(9001)
    expect(meta.trackConfig).toBe('Gran Premio')
    expect(meta.drivers.get(meta.playerCarIdx)?.carId).toBe(67)
    expect(personalBestKey(meta, meta.playerCarIdx)).toBe('67@9001/Gran Premio')
  })

  it('gives faster classes a higher RelSpeed, the same within a class', () => {
    const rel = (cls: string): number =>
      racers.find((d) => d.CarClassShortName === cls)?.CarClassRelSpeed ?? 0
    expect(rel('LMP2')).toBeGreaterThan(rel('GT3'))
    expect(rel('GT3')).toBeGreaterThan(0)
    for (const d of racers) {
      const sameClass = racers.filter((o) => o.CarClassID === d.CarClassID)
      expect(new Set(sameClass.map((o) => o.CarClassRelSpeed)).size).toBe(1)
    }
  })

  it('has a 0-based starting grid, faster class first, that differs from the current order', () => {
    const grid = info.QualifyResultsInfo.Results
    expect(grid.map((g) => g.Position)).toEqual(racers.map((_, k) => k))
    expect(new Set(grid.map((g) => g.CarIdx))).toEqual(new Set(racers.map((d) => d.CarIdx)))
    const classOf = new Map(racers.map((d) => [d.CarIdx, d.CarClassShortName]))
    const lmp2 = grid.filter((g) => classOf.get(g.CarIdx) === 'LMP2')
    expect(lmp2.map((g) => g.Position)).toEqual(lmp2.map((_, k) => k))
    for (const cls of ['LMP2', 'GT3']) {
      const rows = grid.filter((g) => classOf.get(g.CarIdx) === cls)
      expect(rows.map((g) => g.ClassPosition)).toEqual(rows.map((_, k) => k))
      const times = rows.map((g) => g.FastestTime)
      expect(times).toEqual([...times].sort((a, b) => a - b))
    }
    // Places gained since the start (grid is 0-based, CarIdxClassPosition 1-based).
    const gained = (g: (typeof grid)[number]): number =>
      g.ClassPosition + 1 - at(f.CarIdxClassPosition, g.CarIdx)
    const gt3 = grid.filter((g) => classOf.get(g.CarIdx) === 'GT3')
    expect(gt3.some((g) => gained(g) > 0)).toBe(true)
    expect(gt3.some((g) => gained(g) < 0)).toBe(true)
    const mine = grid.find((g) => g.CarIdx === info.DriverInfo.DriverCarIdx)
    expect(mine && gained(mine)).toBeGreaterThan(0)
  })

  it('returns a fresh object every call', () => {
    const a = race.sessionInfo()
    a.QualifyResultsInfo.Results.length = 0
    expect(race.sessionInfo().QualifyResultsInfo.Results.length).toBe(racers.length)
  })

  it('parses into the SessionMeta the overlay uses', () => {
    const meta = parseSessionMeta(info)
    expect(meta.subSessionId).toBe(MOCK_SUBSESSION_ID)
    expect(meta.playerCarIdx).toBe(7)
    expect(meta.drivers.size).toBe(drivers.length)
    expect(meta.grid.size).toBe(racers.length)
    expect(meta.sectorStarts).toEqual([0, 0.33, 0.66])
  })
})

describe('rosterForSession', () => {
  const byUser = (roster: readonly (typeof MOCK_DRIVERS)[number][]): Map<number, number> =>
    new Map(roster.map((d) => [d.userId, d.carIdx]))

  it('is the static roster in the first session', () => {
    expect(rosterForSession(0)).toBe(MOCK_DRIVERS)
  })

  it('seats the same drivers in other CarIdx later, keeping pace car and spectator', () => {
    const first = byUser(MOCK_DRIVERS)
    for (const n of [1, 2, 3, 7]) {
      const roster = rosterForSession(n)
      expect(roster.map((d) => d.carIdx)).toEqual(MOCK_DRIVERS.map((d) => d.carIdx))
      expect(new Set(roster.map((d) => d.userId))).toEqual(new Set(first.keys()))
      const seats = byUser(roster)
      for (const d of MOCK_DRIVERS) {
        if (isRaceDriver(d)) expect(seats.get(d.userId), d.userName).not.toBe(d.carIdx)
        else expect(seats.get(d.userId)).toBe(d.carIdx)
      }
      expect(roster.find((d) => d.carIdx === MOCK_PACE_CAR_IDX)?.isPaceCar).toBe(true)
      expect(roster.find((d) => d.carIdx === MOCK_SPECTATOR_CAR_IDX)?.isSpectator).toBe(true)
    }
  })
})

describe('licence helpers', () => {
  it('derives LicLevel and LicSubLevel like the SDK', () => {
    expect(licLevelOf('A 4.99')).toBe(20)
    expect(licLevelOf('B 1.00')).toBe(13)
    expect(licLevelOf('C 2.33')).toBe(10)
    expect(licLevelOf('R 0.01')).toBe(1)
    expect(licLevelOf('P 4.99')).toBe(24)
    expect(licLevelOf('')).toBe(0)
    expect(licSubLevelOf('B 3.27')).toBe(327)
    expect(licSubLevelOf('A 4.99')).toBe(499)
  })
})
