import { describe, it, expect } from 'vitest'
import { EMPTY_SESSION, parseSessionMeta } from './session'
import { MAX_CARS } from './telemetry'
import type { DriverEntry, GridEntry, SessionDetails } from './types'

function sampleSession(): Record<string, unknown> {
  return {
    WeekendInfo: {
      TrackName: 'spa 2022 up',
      TrackDisplayName: 'Circuit de Spa-Francorchamps',
      TrackLength: '6.93 km',
      TrackLengthOfficial: '7.00 km',
      TrackNumTurns: 20,
      TrackPitSpeedLimit: '60.00 kph',
      TrackID: 163,
      TrackConfigName: 'Grand Prix Pits',
      SubSessionID: 81234567,
      EventType: 'Race',
      Official: 1
    },
    SessionInfo: {
      Sessions: [
        {
          SessionNum: 0,
          SessionType: 'Practice',
          SessionName: 'PRACTICE',
          SessionLaps: 'unlimited',
          SessionTime: '1800.0000 sec',
          SessionTrackRubberState: 'moderate usage'
        },
        {
          SessionNum: 1,
          SessionType: 'Lone Qualify',
          SessionName: 'QUALIFY',
          SessionLaps: 2,
          SessionTime: '480.0000 sec',
          SessionTrackRubberState: ' carry over '
        },
        {
          SessionNum: 2,
          SessionType: 'Race',
          SessionName: 'RACE',
          SessionLaps: 14,
          SessionTime: 'unlimited'
        }
      ]
    },
    SplitTimeInfo: {
      Sectors: [
        { SectorNum: 0, SectorStartPct: 0 },
        { SectorNum: 1, SectorStartPct: 0.304582 },
        { SectorNum: 2, SectorStartPct: 0.681345 }
      ]
    },
    QualifyResultsInfo: {
      Results: [
        { Position: 0, ClassPosition: 0, CarIdx: 1, FastestLap: 2, FastestTime: 137.1 },
        { Position: 1, ClassPosition: 0, CarIdx: 2, FastestLap: 3, FastestTime: 150.8 }
      ]
    },
    DriverInfo: {
      DriverCarIdx: 1,
      PaceCarIdx: 0,
      DriverCarEstLapTime: 137.6425,
      Drivers: [
        {
          CarIdx: 0,
          UserName: 'Pace Car',
          CarNumber: '0',
          CarClassID: 11,
          CarIsPaceCar: 1,
          CarScreenNameShort: 'safety pc',
          CarClassShortName: null,
          CarClassColor: 0,
          CarClassEstLapTime: 160,
          CarClassRelSpeed: 0,
          IRating: 0,
          LicLevel: 1,
          LicSubLevel: 1,
          LicString: 'R 0.01',
          LicColor: '0xundefined',
          IsSpectator: 0
        },
        {
          CarIdx: 1,
          UserName: 'Andrés Lucena',
          CarNumber: '7',
          CarClassID: 4029,
          CarIsPaceCar: 0,
          CarScreenNameShort: 'Porsche 911 GT3 R',
          CarClassShortName: 'GT3',
          CarClassColor: 0xffda59,
          CarClassEstLapTime: 137.6425,
          CarClassRelSpeed: 90,
          IRating: 2345,
          LicLevel: 20,
          LicSubLevel: 460,
          LicString: 'A 4.60',
          LicColor: 0x0153db,
          IsSpectator: 0,
          UserID: 123456,
          TeamID: 0,
          CarID: 169
        },
        {
          CarIdx: 2,
          UserName: 12345,
          CarNumber: 42,
          CarClassID: 4083,
          CarIsPaceCar: 0,
          CarScreenNameShort: 'Mazda MX-5',
          CarClassShortName: 'MX5',
          CarClassColor: 0x33ceff,
          CarClassEstLapTime: 151.2,
          CarClassRelSpeed: 40,
          IRating: 1350,
          LicLevel: 8,
          LicSubLevel: 210,
          LicString: 'D 2.10',
          LicColor: 0,
          IsSpectator: 0
        },
        {
          CarIdx: 63,
          UserName: 'Spectator Sam',
          CarNumber: '',
          CarClassID: 0,
          CarIsPaceCar: 0,
          CarClassShortName: '',
          CarScreenNameShort: '',
          CarClassColor: 0xffffff,
          IRating: 1,
          LicString: 'B 3.00',
          LicColor: 0x00c702,
          IsSpectator: 1
        }
      ]
    }
  }
}

function withSessions(sessions: unknown): Map<number, SessionDetails> {
  return new Map(parseSessionMeta({ SessionInfo: { Sessions: sessions } }).sessions)
}

function sectors(raw: unknown): readonly number[] {
  return parseSessionMeta({ SplitTimeInfo: raw }).sectorStarts
}

function gridOf(raw: Record<string, unknown>): [number, GridEntry][] {
  return [...parseSessionMeta(raw).grid]
}

describe('parseSessionMeta', () => {
  it('parses a realistic two-class session', () => {
    const meta = parseSessionMeta(sampleSession())
    expect(meta.playerCarIdx).toBe(1)
    expect(meta.paceCarIdx).toBe(0)
    expect(meta.driverCarEstLapTime).toBe(137.6425)
    expect(meta.trackLengthM).toBe(6930)
    expect(meta.trackName).toBe('Circuit de Spa-Francorchamps')
    expect(meta.subSessionId).toBe(81234567)
    expect(meta.eventType).toBe('Race')
    expect(meta.official).toBe(true)
    expect(meta.trackNumTurns).toBe(20)
    expect(meta.teamRacing).toBe(false)
    expect(meta.pitSpeedLimitKmh).toBe(60)
    expect(meta.trackId).toBe(163)
    expect(meta.trackConfig).toBe('Grand Prix Pits')
    expect(meta.sectorStarts).toEqual([0, 0.304582, 0.681345])
    expect([...meta.sessionTypes]).toEqual([
      [0, 'Practice'],
      [1, 'Lone Qualify'],
      [2, 'Race']
    ])
    expect([...meta.sessions]).toEqual<[number, SessionDetails][]>([
      [
        0,
        {
          type: 'Practice',
          name: 'PRACTICE',
          laps: null,
          timeS: 1800,
          rubberState: 'moderate usage'
        }
      ],
      [
        1,
        { type: 'Lone Qualify', name: 'QUALIFY', laps: 2, timeS: 480, rubberState: 'carry over' }
      ],
      [2, { type: 'Race', name: 'RACE', laps: 14, timeS: null, rubberState: '' }]
    ])
    expect([...meta.grid]).toEqual<[number, GridEntry][]>([
      [1, { position: 1, classPosition: 1, bestLap: 137.1 }],
      [2, { position: 2, classPosition: 1, bestLap: 150.8 }]
    ])
    expect([...meta.drivers.keys()]).toEqual([0, 1, 2, 63])

    expect(meta.drivers.get(0)).toEqual<DriverEntry>({
      carIdx: 0,
      userName: 'Pace Car',
      teamName: '',
      carNumber: '0',
      // iRacing's placeholder ratings (iRating 0, R 0.01): unknown.
      iRating: 0,
      licString: '',
      licColor: null,
      classId: 11,
      classShortName: 'safety pc',
      classColor: '#ffffff',
      classEstLapTime: 160,
      isPaceCar: true,
      isSpectator: false,
      licLevel: 0,
      licSubLevel: 0,
      classRelSpeed: 0,
      userId: 0,
      teamId: 0,
      carId: 0,
      carName: 'safety pc',
      isAI: false
    })
    expect(meta.drivers.get(1)).toEqual<DriverEntry>({
      carIdx: 1,
      userName: 'Andrés Lucena',
      teamName: '',
      carNumber: '7',
      iRating: 2345,
      licString: 'A 4.60',
      licColor: '#0153db',
      classId: 4029,
      classShortName: 'GT3',
      classColor: '#ffda59',
      classEstLapTime: 137.6425,
      isPaceCar: false,
      isSpectator: false,
      licLevel: 20,
      licSubLevel: 460,
      classRelSpeed: 90,
      userId: 123456,
      teamId: 0,
      carId: 169,
      carName: 'Porsche 911 GT3 R',
      isAI: false
    })
    const weird = meta.drivers.get(2)
    expect(weird?.userName).toBe('12345')
    expect(weird?.carNumber).toBe('42')
    expect(weird?.licColor).toBe('#fc8a27')
    expect(weird?.classColor).toBe('#33ceff')
    expect(weird?.classRelSpeed).toBe(40)

    const spec = meta.drivers.get(63)
    expect(spec?.isSpectator).toBe(true)
    expect(spec?.isPaceCar).toBe(false)
    expect(spec?.classShortName).toBe('')
    expect(spec?.classEstLapTime).toBe(0)
    expect(spec?.licColor).toBe('#00c702')
    expect(spec?.licLevel).toBe(0)
    expect(spec?.licSubLevel).toBe(0)
    expect(spec?.classRelSpeed).toBe(0)
  })

  it('falls back to TrackName and tolerates odd scalar types', () => {
    const raw = sampleSession()
    raw.WeekendInfo = { TrackName: 'lime rock', TrackLength: 'nope' }
    const drivers = (raw.DriverInfo as { Drivers: Record<string, unknown>[] }).Drivers
    Object.assign(drivers[1] ?? {}, {
      UserName: true,
      IRating: '2345',
      LicString: 4.6,
      CarClassEstLapTime: -1,
      CarClassID: 'x',
      CarClassShortName: 911,
      CarIsPaceCar: true
    })
    Object.assign(drivers[2] ?? {}, { UserName: null, CarNumber: undefined })
    const meta = parseSessionMeta(raw)
    expect(meta.trackName).toBe('lime rock')
    expect(meta.trackLengthM).toBeNull()
    const d1 = meta.drivers.get(1)
    expect(d1?.userName).toBe('true')
    expect(d1?.iRating).toBe(0)
    expect(d1?.licString).toBe('')
    expect(d1?.licColor).toBe('#0153db')
    expect(d1?.classEstLapTime).toBe(0)
    expect(d1?.classId).toBe(-1)
    expect(d1?.classShortName).toBe('911')
    expect(d1?.isPaceCar).toBe(true)
    expect(meta.drivers.get(2)?.userName).toBe('')
    expect(meta.drivers.get(2)?.carNumber).toBe('')
  })

  it('keeps the date text of a name js-yaml turned into a Date', () => {
    const raw = sampleSession()
    const drivers = (raw.DriverInfo as { Drivers: Record<string, unknown>[] }).Drivers
    Object.assign(drivers[1] ?? {}, { UserName: new Date('2024-01-02T00:00:00Z') })
    expect(parseSessionMeta(raw).drivers.get(1)?.userName).toBe('2024-01-02')
  })

  it('skips drivers without a valid CarIdx and sessions without a valid SessionNum', () => {
    const meta = parseSessionMeta({
      DriverInfo: {
        Drivers: [
          null,
          'driver',
          [],
          { UserName: 'no idx' },
          { CarIdx: -1, UserName: 'neg' },
          { CarIdx: MAX_CARS, UserName: 'too big' },
          { CarIdx: 1.5, UserName: 'fraction' },
          { CarIdx: '3', UserName: 'string' },
          { CarIdx: 5, UserName: 'ok' }
        ]
      },
      SessionInfo: {
        Sessions: [
          { SessionNum: 'a', SessionType: 'Race' },
          { SessionNum: -1, SessionType: 'Race' },
          { SessionNum: 3 },
          { SessionNum: 4, SessionType: 'Race' },
          7
        ]
      }
    })
    expect([...meta.drivers.keys()]).toEqual([5])
    expect(meta.drivers.get(5)?.userName).toBe('ok')
    expect(meta.drivers.get(5)?.classColor).toBe('#ffffff')
    expect(meta.drivers.get(5)?.licColor).toBeNull()
    expect([...meta.sessionTypes]).toEqual([[4, 'Race']])
    // A session without a type still has its (empty) details.
    expect([...meta.sessions]).toEqual<[number, SessionDetails][]>([
      [3, { type: '', name: '', laps: null, timeS: null, rubberState: '' }],
      [4, { type: 'Race', name: '', laps: null, timeS: null, rubberState: '' }]
    ])
  })

  it('reads licence levels and class speed only when they are sane numbers', () => {
    const meta = parseSessionMeta({
      DriverInfo: {
        Drivers: [
          { CarIdx: 1, LicLevel: '12', LicSubLevel: '300', CarClassRelSpeed: '90' },
          { CarIdx: 2, LicLevel: null, LicSubLevel: {}, CarClassRelSpeed: [] },
          { CarIdx: 3, LicLevel: 1.5, LicSubLevel: -20, CarClassRelSpeed: -1 },
          { CarIdx: 4, LicLevel: Number.NaN, LicSubLevel: Infinity, CarClassRelSpeed: Infinity },
          { CarIdx: 5, LicLevel: 24, LicSubLevel: 0, CarClassRelSpeed: 12.5 }
        ]
      }
    })
    const pick = (i: number): unknown => {
      const d = meta.drivers.get(i)
      return d && [d.licLevel, d.licSubLevel, d.classRelSpeed]
    }
    expect(pick(1)).toEqual([0, 0, 0])
    expect(pick(2)).toEqual([0, 0, 0])
    expect(pick(3)).toEqual([0, 0, 0])
    expect(pick(4)).toEqual([0, 0, 0])
    expect(pick(5)).toEqual([24, 0, 12.5])
  })

  it('returns defaults for missing sections', () => {
    const meta = parseSessionMeta({})
    expect(meta).toEqual(EMPTY_SESSION)
    expect(
      parseSessionMeta({
        WeekendInfo: 5,
        DriverInfo: [],
        SessionInfo: 'x',
        SplitTimeInfo: [],
        QualifyResultsInfo: 'x'
      })
    ).toEqual(EMPTY_SESSION)
    expect(
      parseSessionMeta({
        DriverInfo: {
          DriverCarIdx: MAX_CARS + 1,
          PaceCarIdx: -1,
          DriverCarEstLapTime: 'x',
          Drivers: {}
        },
        SessionInfo: { Sessions: null },
        SplitTimeInfo: { Sectors: null },
        QualifyResultsInfo: { Results: {} }
      })
    ).toEqual(EMPTY_SESSION)
  })

  it('returns an EMPTY_SESSION equivalent for non-object input', () => {
    for (const v of [undefined, null, 0, 'yaml', true, [], [{ DriverInfo: {} }]]) {
      const meta = parseSessionMeta(v)
      expect(meta).toEqual(EMPTY_SESSION)
      expect(meta.drivers).not.toBe(EMPTY_SESSION.drivers)
      expect(meta.grid).not.toBe(EMPTY_SESSION.grid)
    }
  })

  it("reads your car's idle revs (DriverCarIdleRPM), 0 when missing or broken", () => {
    expect(parseSessionMeta({ DriverInfo: { DriverCarIdleRPM: 875 } }).driverCarIdleRpm).toBe(875)
    expect(parseSessionMeta({ DriverInfo: {} }).driverCarIdleRpm).toBe(0)
    expect(parseSessionMeta({ DriverInfo: { DriverCarIdleRPM: '875' } }).driverCarIdleRpm).toBe(0)
    expect(parseSessionMeta({ DriverInfo: { DriverCarIdleRPM: -1 } }).driverCarIdleRpm).toBe(0)
    expect(EMPTY_SESSION.driverCarIdleRpm).toBe(0)
  })

  it('has the documented EMPTY_SESSION', () => {
    expect(EMPTY_SESSION.playerCarIdx).toBe(-1)
    expect(EMPTY_SESSION.paceCarIdx).toBe(-1)
    expect(EMPTY_SESSION.driverCarEstLapTime).toBe(0)
    expect(EMPTY_SESSION.trackLengthM).toBeNull()
    expect(EMPTY_SESSION.trackName).toBe('')
    expect(EMPTY_SESSION.drivers.size).toBe(0)
    expect(EMPTY_SESSION.sessionTypes.size).toBe(0)
    expect(EMPTY_SESSION.sessions.size).toBe(0)
    expect(EMPTY_SESSION.subSessionId).toBe(0)
    expect(EMPTY_SESSION.eventType).toBe('')
    expect(EMPTY_SESSION.official).toBe(false)
    expect(EMPTY_SESSION.trackNumTurns).toBe(0)
    expect(EMPTY_SESSION.sectorStarts).toEqual([])
    expect(Object.isFrozen(EMPTY_SESSION.sectorStarts)).toBe(true)
    expect(EMPTY_SESSION.grid.size).toBe(0)
    expect(EMPTY_SESSION.teamRacing).toBe(false)
    expect(EMPTY_SESSION.pitSpeedLimitKmh).toBeNull()
    expect(EMPTY_SESSION.trackId).toBe(0)
    expect(EMPTY_SESSION.trackConfig).toBe('')
    expect(EMPTY_SESSION.incidentLimits).toEqual({ dq: null, penalty: null, penaltyEvery: null })
  })
})

describe('parseSessionMeta: incident limits', () => {
  const limits = (WeekendOptions: unknown): unknown =>
    parseSessionMeta({ WeekendInfo: { WeekendOptions } }).incidentLimits

  it('reads WeekendOptions, numbers or text, the untyped warning limits included', () => {
    expect(limits({ IncidentLimit: 25 })).toEqual({ dq: 25, penalty: null, penaltyEvery: null })
    expect(
      limits({
        IncidentLimit: '25',
        IncidentWarningInitialLimit: 17,
        IncidentWarningSubsequentLimit: '8'
      })
    ).toEqual({ dq: 25, penalty: 17, penaltyEvery: 8 })
  })

  it("has none for 'unlimited', a missing section or nonsense", () => {
    const none = { dq: null, penalty: null, penaltyEvery: null }
    expect(limits({ IncidentLimit: 'unlimited' })).toEqual(none)
    expect(limits(undefined)).toEqual(none)
    expect(limits({ IncidentLimit: 0, IncidentWarningInitialLimit: -3 })).toEqual(none)
    expect(parseSessionMeta({}).incidentLimits).toEqual(none)
  })
})

describe('parseSessionMeta: WeekendInfo extras', () => {
  it('ignores mistyped ids, turns and flags', () => {
    for (const [SubSessionID, TrackNumTurns] of [
      ['81234567', '20'],
      [-1, -3],
      [1.5, 7.5],
      [null, null],
      [{}, []],
      [Number.NaN, Infinity]
    ]) {
      const meta = parseSessionMeta({ WeekendInfo: { SubSessionID, TrackNumTurns } })
      expect(meta.subSessionId).toBe(0)
      expect(meta.trackNumTurns).toBe(0)
    }
  })

  it('reads Official as an irsdk 0/1 flag', () => {
    const official = (Official: unknown): boolean =>
      parseSessionMeta({ WeekendInfo: { Official } }).official
    expect(official(1)).toBe(true)
    expect(official('1')).toBe(true)
    expect(official(true)).toBe(true)
    for (const v of [0, 2, '0', 'yes', null, undefined, {}]) expect(official(v)).toBe(false)
  })

  it('reads TeamRacing as an irsdk 0/1 flag', () => {
    const team = (TeamRacing: unknown): boolean =>
      parseSessionMeta({ WeekendInfo: { TeamRacing } }).teamRacing
    expect(team(1)).toBe(true)
    expect(team('1')).toBe(true)
    for (const v of [0, 2, '0', null, undefined]) expect(team(v)).toBe(false)
  })

  it('reads TrackID and the layout name (empty for a track without layouts)', () => {
    const weekend = (WeekendInfo: Record<string, unknown>): [number, string] => {
      const meta = parseSessionMeta({ WeekendInfo })
      return [meta.trackId, meta.trackConfig]
    }
    expect(weekend({ TrackID: 219, TrackConfigName: 'Grand Prix' })).toEqual([219, 'Grand Prix'])
    expect(weekend({ TrackID: 219, TrackConfigName: '  Oval  ' })).toEqual([219, 'Oval'])
    expect(weekend({ TrackID: 18, TrackConfigName: null })).toEqual([18, ''])
    expect(weekend({ TrackID: 18, TrackConfigName: 2011 })).toEqual([18, '2011'])
    expect(weekend({ TrackID: 18, TrackConfigName: { x: 1 } })).toEqual([18, ''])
    expect(weekend({})).toEqual([0, ''])
    for (const TrackID of ['219', -1, 1.5, null, {}, Number.NaN, Infinity])
      expect(weekend({ TrackID })[0], String(TrackID)).toBe(0)
  })

  it('reads CarID per driver only when it is a sane integer', () => {
    const meta = parseSessionMeta({
      DriverInfo: {
        Drivers: [
          { CarIdx: 1, CarID: 67 },
          { CarIdx: 2, CarID: '67' },
          { CarIdx: 3, CarID: -4 },
          { CarIdx: 4, CarID: 1.5 },
          { CarIdx: 5 }
        ]
      }
    })
    expect([1, 2, 3, 4, 5].map((i) => meta.drivers.get(i)?.carId)).toEqual([67, 0, 0, 0, 0])
  })

  it('keeps EventType as text', () => {
    const eventType = (EventType: unknown): string =>
      parseSessionMeta({ WeekendInfo: { EventType } }).eventType
    expect(eventType('Test')).toBe('Test')
    expect(eventType(5)).toBe('5')
    expect(eventType(null)).toBe('')
    expect(eventType({ x: 1 })).toBe('')
  })
})

describe('parseSessionMeta: pit speed limit', () => {
  const limit = (TrackPitSpeedLimit: unknown): number | null =>
    parseSessionMeta({ WeekendInfo: { TrackPitSpeedLimit } }).pitSpeedLimitKmh

  it('reads km/h as written by iRacing and its variants', () => {
    expect(limit('72.00 kph')).toBe(72)
    expect(limit('60.00 kph')).toBe(60)
    expect(limit(' 80 KPH ')).toBe(80)
    expect(limit('55.5kph')).toBe(55.5)
    expect(limit('60 km/h')).toBe(60)
    expect(limit('60 kmh')).toBe(60)
    expect(limit('72,50 kph')).toBe(72.5)
  })

  it('converts mph to km/h, rounded to 0.01', () => {
    expect(limit('45.00 mph')).toBe(72.42)
    expect(limit('35 MPH')).toBe(56.33)
  })

  it('takes bare numbers and numeric strings as km/h', () => {
    expect(limit(60)).toBe(60)
    expect(limit('80')).toBe(80)
    expect(limit(72.004)).toBe(72)
  })

  it('returns null for garbage, zero, negatives and absurd values', () => {
    for (const v of [
      undefined,
      null,
      '',
      'kph',
      'unlimited',
      'sixty kph',
      '60 m/s',
      '60 kph 2',
      '-60 kph',
      '0.00 kph',
      0,
      -5,
      Number.NaN,
      Infinity,
      '301 kph',
      400,
      true,
      {},
      ['60 kph']
    ]) {
      expect(limit(v), String(v)).toBeNull()
    }
  })
})

describe('parseSessionMeta: session details', () => {
  it('parses lap limits from numbers and numeric strings', () => {
    const laps = [20, '15', ' 30 ', 'unlimited', 0, -3, 2.5, '12 laps', '1e2', null, {}, true]
    const s = withSessions(laps.map((SessionLaps, SessionNum) => ({ SessionNum, SessionLaps })))
    expect([...s.values()].map((d) => d.laps)).toEqual([
      20,
      15,
      30,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null
    ])
  })

  it('parses time limits like "3600.0000 sec"', () => {
    const times = [
      '3600.0000 sec',
      '1800 sec',
      '900',
      2700,
      '45.5 s',
      'unlimited',
      '0.0000 sec',
      '-60 sec',
      'abc sec',
      Number.NaN,
      -5,
      null,
      []
    ]
    const s = withSessions(times.map((SessionTime, SessionNum) => ({ SessionNum, SessionTime })))
    expect([...s.values()].map((d) => d.timeS)).toEqual([
      3600,
      1800,
      900,
      2700,
      45.5,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null
    ])
  })

  it('keeps the last entry for a repeated SessionNum and text-coerces names', () => {
    const s = withSessions([
      { SessionNum: 0, SessionType: 'Practice', SessionName: 'A' },
      { SessionNum: 0, SessionType: 'Race', SessionName: 99 }
    ])
    expect(s.get(0)).toEqual({
      type: 'Race',
      name: '99',
      laps: null,
      timeS: null,
      rubberState: ''
    })
  })

  it('reads the rubber state as text, trimmed, and nothing else', () => {
    const s = withSessions([
      { SessionNum: 0, SessionTrackRubberState: 'moderately high usage' },
      { SessionNum: 1, SessionTrackRubberState: 7 },
      { SessionNum: 2, SessionTrackRubberState: { usage: 'high' } },
      { SessionNum: 3, SessionTrackRubberState: null }
    ])
    expect([...s].map(([n, d]) => [n, d.rubberState])).toEqual([
      [0, 'moderately high usage'],
      [1, '7'],
      [2, ''],
      [3, '']
    ])
  })
})

describe('parseSessionMeta: sector starts', () => {
  it('sorts, deduplicates and starts at 0', () => {
    expect(
      sectors({
        Sectors: [
          { SectorNum: 2, SectorStartPct: 0.7 },
          { SectorNum: 1, SectorStartPct: 0.35 },
          { SectorNum: 3, SectorStartPct: 0.35 },
          { SectorNum: 4, SectorStartPct: 0.3500000001 },
          { SectorNum: 0, SectorStartPct: 0 }
        ]
      })
    ).toEqual([0, 0.35, 0.7])
  })

  it('adds the start line when the first sector does not start at 0, and treats 1 as 0', () => {
    expect(sectors({ Sectors: [{ SectorStartPct: 0.5 }, { SectorStartPct: 0.25 }] })).toEqual([
      0, 0.25, 0.5
    ])
    expect(sectors({ Sectors: [{ SectorStartPct: 1 }, { SectorStartPct: 0.5 }] })).toEqual([0, 0.5])
    expect(sectors({ Sectors: [{ SectorStartPct: 0 }] })).toEqual([0])
  })

  it('skips out-of-range and mistyped values', () => {
    expect(
      sectors({
        Sectors: [
          { SectorStartPct: '0.4' },
          { SectorStartPct: null },
          { SectorStartPct: -0.1 },
          { SectorStartPct: 1.2 },
          { SectorStartPct: Number.NaN },
          { SectorStartPct: Infinity },
          { SectorNum: 3 },
          0.6,
          null,
          { SectorStartPct: 0.6 }
        ]
      })
    ).toEqual([0, 0.6])
  })

  it('is empty when no sector is valid or the section is missing', () => {
    expect(sectors({ Sectors: [{ SectorStartPct: 'x' }, null] })).toEqual([])
    expect(sectors({ Sectors: 'x' })).toEqual([])
    expect(sectors({})).toEqual([])
    expect(sectors(null)).toEqual([])
  })
})

describe('parseSessionMeta: starting grid', () => {
  it('converts the 0-based QualifyResultsInfo to 1-based positions', () => {
    expect(
      gridOf({
        QualifyResultsInfo: {
          Results: [
            { Position: 2, ClassPosition: 1, CarIdx: 70 },
            { Position: 0, ClassPosition: 0, CarIdx: 4 },
            { Position: 1, ClassPosition: 0, CarIdx: 9 }
          ]
        }
      })
    ).toEqual<[number, GridEntry][]>([
      [70, { position: 3, classPosition: 2, bestLap: null }],
      [4, { position: 1, classPosition: 1, bestLap: null }],
      [9, { position: 2, classPosition: 1, bestLap: null }]
    ])
  })

  it('skips invalid results and keeps the first one of a repeated CarIdx', () => {
    expect(
      gridOf({
        QualifyResultsInfo: {
          Results: [
            null,
            'P1',
            { Position: 0, ClassPosition: 0 },
            { Position: 0, ClassPosition: 0, CarIdx: '3' },
            { Position: 0, ClassPosition: 0, CarIdx: MAX_CARS },
            { Position: -1, ClassPosition: 0, CarIdx: 5 },
            { Position: 0, ClassPosition: 0.5, CarIdx: 6 },
            { Position: '1', ClassPosition: 0, CarIdx: 7 },
            { Position: 1, CarIdx: 8 },
            { Position: 3, ClassPosition: 2, CarIdx: 10 },
            { Position: 4, ClassPosition: 3, CarIdx: 10 }
          ]
        }
      })
    ).toEqual<[number, GridEntry][]>([[10, { position: 4, classPosition: 3, bestLap: null }]])
  })

  it("falls back to the last Race session's QualifyPositions", () => {
    const sessions = [
      {
        SessionNum: 0,
        SessionType: 'Practice',
        QualifyPositions: [{ Position: 0, ClassPosition: 0, CarIdx: 1 }]
      },
      {
        SessionNum: 1,
        SessionType: 'Race',
        QualifyPositions: [{ Position: 0, ClassPosition: 0, CarIdx: 2 }]
      },
      {
        SessionNum: 2,
        SessionType: 'Race',
        QualifyPositions: [
          { Position: 1, ClassPosition: 1, CarIdx: 3 },
          { Position: 0, ClassPosition: 0, CarIdx: 4 }
        ]
      },
      { SessionNum: 3, SessionType: 'Race', QualifyPositions: 'x' }
    ]
    const expected: [number, GridEntry][] = [
      [3, { position: 2, classPosition: 2, bestLap: null }],
      [4, { position: 1, classPosition: 1, bestLap: null }]
    ]
    expect(gridOf({ SessionInfo: { Sessions: sessions } })).toEqual(expected)
    // Also when QualifyResultsInfo is there but gives nothing usable.
    expect(
      gridOf({
        QualifyResultsInfo: { Results: [{ Position: 'x', ClassPosition: 0, CarIdx: 9 }] },
        SessionInfo: { Sessions: sessions }
      })
    ).toEqual(expected)
  })

  it('prefers QualifyResultsInfo over QualifyPositions', () => {
    expect(
      gridOf({
        QualifyResultsInfo: { Results: [{ Position: 0, ClassPosition: 0, CarIdx: 9 }] },
        SessionInfo: {
          Sessions: [
            {
              SessionNum: 0,
              SessionType: 'Race',
              QualifyPositions: [{ Position: 0, ClassPosition: 0, CarIdx: 2 }]
            }
          ]
        }
      })
    ).toEqual<[number, GridEntry][]>([[9, { position: 1, classPosition: 1, bestLap: null }]])
  })

  it('is empty without any qualifying data', () => {
    expect(gridOf({ SessionInfo: { Sessions: [{ SessionNum: 0, SessionType: 'Race' }] } })).toEqual(
      []
    )
    expect(gridOf({ QualifyResultsInfo: { Results: null } })).toEqual([])
    expect(gridOf({ QualifyResultsInfo: null })).toEqual([])
  })
})

describe('parseSessionMeta: entry identity', () => {
  const driverOf = (d: Record<string, unknown>): DriverEntry | undefined =>
    parseSessionMeta({ DriverInfo: { Drivers: [{ CarIdx: 3, UserName: 'A', ...d }] } }).drivers.get(
      3
    )

  it('reads UserID and TeamID of a team entry', () => {
    const d = driverOf({ UserID: 987654, TeamID: 41234 })
    expect(d?.userId).toBe(987654)
    expect(d?.teamId).toBe(41234)
  })

  it('treats missing, negative and mistyped ids as unknown (0)', () => {
    for (const v of [undefined, null, -1, 1.5, '42', Number.NaN, {}]) {
      const d = driverOf({ UserID: v, TeamID: v })
      expect(d?.userId).toBe(0)
      expect(d?.teamId).toBe(0)
    }
  })

  it("reads TeamName as text, '' when missing", () => {
    expect(driverOf({ TeamName: 'Équipe Rouge' })?.teamName).toBe('Équipe Rouge')
    expect(driverOf({ TeamName: 2024 })?.teamName).toBe('2024')
    expect(driverOf({})?.teamName).toBe('')
  })

  it("keeps a UserName iRacing wrote as '?' as it is (the widgets decide what to show)", () => {
    expect(driverOf({ UserName: '?????? ?????' })?.userName).toBe('?????? ?????')
  })
})

describe('parseSessionMeta: placeholder ratings', () => {
  const driverOf = (d: Record<string, unknown>): DriverEntry | undefined =>
    parseSessionMeta({ DriverInfo: { Drivers: [{ CarIdx: 3, UserName: 'A', ...d }] } }).drivers.get(
      3
    )
  const unknown = { iRating: 0, licString: '', licColor: null, licLevel: 0, licSubLevel: 0 }

  it("hides the player's placeholder ratings in an offline AI race (iRating 1, R 0.01)", () => {
    // As iRacing writes the player in an AI race (seen in a real session's YAML).
    const d = driverOf({
      IRating: 1,
      LicLevel: 1,
      LicSubLevel: 1,
      LicString: 'R 0.01',
      LicColor: '0xundefined',
      CarIsAI: 0
    })
    expect(d).toMatchObject({ ...unknown, isAI: false })
  })

  it("hides an AI driver's ratings, whatever iRacing puts there", () => {
    const zero = {
      IRating: 0,
      LicLevel: 1,
      LicSubLevel: 0,
      LicString: 'R 0.00',
      LicColor: 0x8800a0
    }
    expect(driverOf({ ...zero, CarIsAI: 1 })).toMatchObject({ ...unknown, isAI: true })
    // A hosted AI race could carry made-up ratings: an AI car is never rated.
    const made = { IRating: 2200, LicLevel: 18, LicSubLevel: 399, LicString: 'A 3.99' }
    expect(driverOf({ ...made, CarIsAI: 1 })).toMatchObject({ ...unknown, isAI: true })
  })

  it('keeps real ratings, the lowest a real driver can have included', () => {
    const rookie = driverOf({
      IRating: 1350,
      LicLevel: 2,
      LicSubLevel: 250,
      LicString: 'R 2.50',
      LicColor: 0xfc0706,
      CarIsAI: 0
    })
    expect(rookie).toMatchObject({
      iRating: 1350,
      licString: 'R 2.50',
      licColor: '#fc0706',
      licLevel: 2,
      licSubLevel: 250,
      isAI: false
    })
    // A real licence with a low SR but a real iRating is kept too.
    expect(
      driverOf({ IRating: 820, LicLevel: 1, LicSubLevel: 1, LicString: 'R 0.01' })
    ).toMatchObject({ iRating: 820, licString: 'R 0.01', licLevel: 1, licSubLevel: 1 })
  })
})
