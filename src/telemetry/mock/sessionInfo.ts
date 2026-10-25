/** The mock's session YAML (the shape js-yaml gives for iRacing's session string). */
import {
  MOCK_PIT_SPEED_LIMIT_KMH,
  MOCK_RACE_LENGTH_S,
  MOCK_SESSION_ID,
  MOCK_SUBSESSION_ID,
  MOCK_TRACK_LENGTH_M
} from './constants'
import { MOCK_CLASSES, MOCK_PACE_CAR_IDX, licColorOf, licLevelOf, licSubLevelOf } from './drivers'
import type { MockDriver } from './drivers'
import type { Rng } from './rng'
import { MOCK_CORNERS, MOCK_SECTOR_STARTS } from './track'
import { mockDriverTires, type MockDriverTire } from './tyres'

export interface MockYamlDriver {
  CarIdx: number
  UserName: string
  AbbrevName: string
  Initials: string
  UserID: number
  /** 0 outside team races. */
  TeamID: number
  TeamName: string
  CarNumber: string
  /** Car model: with the track and its layout, the key of the personal bests. */
  CarID: number
  CarScreenNameShort: string
  CarClassID: number
  CarClassShortName: string
  CarClassRelSpeed: number
  CarClassColor: number
  CarClassEstLapTime: number
  IRating: number
  LicLevel: number
  LicSubLevel: number
  LicString: string
  LicColor: number
  CarIsPaceCar: 0 | 1
  CarIsAI: 0 | 1
  IsSpectator: 0 | 1
}

/** QualifyResultsInfo.Results entry: Position and ClassPosition are 0-based, as in iRacing. */
export interface MockQualifyResult {
  Position: number
  ClassPosition: number
  CarIdx: number
  FastestLap: number
  FastestTime: number
}

export interface MockSessionInfo {
  WeekendInfo: {
    TrackName: string
    TrackID: number
    TrackLength: string
    TrackLengthOfficial: string
    TrackDisplayName: string
    TrackDisplayShortName: string
    TrackConfigName: string
    TrackCity: string
    TrackCountry: string
    TrackNumTurns: number
    /** '60.00 kph', as iRacing writes it. */
    TrackPitSpeedLimit: string
    SeriesID: number
    SeasonID: number
    SessionID: number
    SubSessionID: number
    Official: number
    EventType: string
    Category: string
    NumCarClasses: number
    /** 1 when drivers share cars. */
    TeamRacing: number
  }
  SessionInfo: {
    Sessions: {
      SessionNum: number
      SessionType: string
      SessionName: string
      SessionLaps: string
      SessionTime: string
    }[]
  }
  SplitTimeInfo: {
    Sectors: { SectorNum: number; SectorStartPct: number }[]
  }
  QualifyResultsInfo: {
    Results: MockQualifyResult[]
  }
  DriverInfo: {
    DriverCarIdx: number
    DriverUserID: number
    PaceCarIdx: number
    DriverCarEstLapTime: number
    /** The player's car model's compounds (tyres.ts). */
    DriverTires: MockDriverTire[]
    Drivers: MockYamlDriver[]
  }
}

export interface SessionInfoInput {
  /** 0-based session of the series: offsets SessionID and SubSessionID. */
  readonly sessionIndex: number
  readonly playerCarIdx: number
  readonly roster: readonly MockDriver[]
  readonly grid: readonly MockQualifyResult[]
}

/** A fresh object every call (callers may keep or mutate it). */
export function buildSessionInfo(input: SessionInfoInput): MockSessionInfo {
  const me = input.roster.find((d) => d.carIdx === input.playerCarIdx)
  return {
    WeekendInfo: {
      TrackName: 'sierraalta gp',
      TrackID: 9001,
      TrackLength: `${(MOCK_TRACK_LENGTH_M / 1000).toFixed(2)} km`,
      TrackLengthOfficial: '7.01 km',
      TrackDisplayName: 'Autódromo Sierra Alta',
      TrackDisplayShortName: 'Sierra Alta',
      TrackConfigName: 'Gran Premio',
      TrackCity: 'Valle Alto',
      TrackCountry: 'Chile',
      TrackNumTurns: MOCK_CORNERS.length,
      TrackPitSpeedLimit: `${MOCK_PIT_SPEED_LIMIT_KMH.toFixed(2)} kph`,
      SeriesID: 4711,
      SeasonID: 5310,
      SessionID: MOCK_SESSION_ID + input.sessionIndex,
      SubSessionID: MOCK_SUBSESSION_ID + input.sessionIndex,
      Official: 1,
      EventType: 'Race',
      Category: 'Road',
      NumCarClasses: 2,
      TeamRacing: 0
    },
    SessionInfo: {
      Sessions: [
        {
          SessionNum: 0,
          SessionType: 'Race',
          SessionName: 'RACE',
          SessionLaps: 'unlimited',
          SessionTime: `${MOCK_RACE_LENGTH_S.toFixed(4)} sec`
        }
      ]
    },
    SplitTimeInfo: {
      Sectors: MOCK_SECTOR_STARTS.map((pct, i) => ({ SectorNum: i, SectorStartPct: pct }))
    },
    QualifyResultsInfo: { Results: input.grid.map((r) => ({ ...r })) },
    DriverInfo: {
      DriverCarIdx: input.playerCarIdx,
      DriverUserID: me?.userId ?? -1,
      PaceCarIdx: MOCK_PACE_CAR_IDX,
      DriverCarEstLapTime: me ? MOCK_CLASSES[me.classKey].estLapTimeS : 0,
      DriverTires: mockDriverTires(),
      Drivers: input.roster.map(toYamlDriver)
    }
  }
}

/** What buildGrid needs of a car. */
export interface GridCar {
  readonly idx: number
  readonly classId: number
  readonly classEstS: number
  readonly dist: number
}

/**
 * QualifyResultsInfo: classes fastest first; within a class the current order
 * shuffled a little (some cars gained places since the start, some lost) and
 * the player started 2-3 places further back.
 */
export function buildGrid(
  cars: readonly GridCar[],
  playerIdx: number,
  rng: Rng
): MockQualifyResult[] {
  const classes = [...new Map(cars.map((c) => [c.classId, c.classEstS])).entries()].sort(
    (a, b) => a[1] - b[1] || a[0] - b[0]
  )
  const results: MockQualifyResult[] = []
  for (const [classId] of classes) {
    const keyed = cars
      .filter((c) => c.classId === classId)
      .sort((a, b) => b.dist - a.dist || a.idx - b.idx)
      .map((car, k) => {
        const shift = car.idx === playerIdx ? 2.5 : Math.round((rng() * 2 - 1) * 3)
        return { car, key: k + shift }
      })
      .sort((a, b) => a.key - b.key || a.car.idx - b.car.idx)
    keyed.forEach(({ car }, k) => {
      results.push({
        Position: results.length,
        ClassPosition: k,
        CarIdx: car.idx,
        FastestLap: 2 + (car.idx % 3),
        FastestTime: Math.round(car.classEstS * (0.987 + 0.0012 * k) * 10000) / 10000
      })
    })
  }
  return results
}

function toYamlDriver(d: MockDriver): MockYamlDriver {
  const cls = MOCK_CLASSES[d.classKey]
  const parts = d.userName.split(' ')
  const first = parts[0] ?? ''
  const last = parts.slice(1).join(' ')
  return {
    CarIdx: d.carIdx,
    UserName: d.userName,
    AbbrevName: d.abbrevName ?? (last ? `${last}, ${first.charAt(0)}` : first),
    Initials: d.isPaceCar ? '' : `${first.charAt(0)}${last.charAt(0)}`,
    UserID: d.userId,
    TeamID: 0,
    TeamName: d.userName,
    CarNumber: d.carNumber,
    CarID: cls.carId,
    CarScreenNameShort: d.carScreenNameShort,
    CarClassID: cls.id,
    CarClassShortName: cls.shortName,
    CarClassRelSpeed: cls.relSpeed,
    CarClassColor: cls.color,
    CarClassEstLapTime: cls.estLapTimeS,
    IRating: d.iRating,
    LicLevel: licLevelOf(d.licString),
    LicSubLevel: licSubLevelOf(d.licString),
    LicString: d.licString,
    LicColor: licColorOf(d.licString),
    CarIsPaceCar: d.isPaceCar ? 1 : 0,
    CarIsAI: 0,
    IsSpectator: d.isSpectator ? 1 : 0
  }
}
