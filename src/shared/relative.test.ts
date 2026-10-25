import { describe, it, expect } from 'vitest'
import {
  FALLBACK_LAP_TIME_S,
  clampRelativeSlots,
  computeRelative,
  estimateGap,
  lapRelation,
  lapRelationsActive,
  referenceLapTime
} from './relative'
import { EMPTY_SESSION } from './session'
import { MAX_CARS, SessionState, TELEMETRY_VAR_NAMES, TrackLocation } from './telemetry'
import type { TelemetryFrame } from './telemetry'
import type { DriverEntry, RelativeData, RelativeOptions, SessionMeta } from './types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface CarState {
  pct: number
  /** Defaults to pct * 100 (linear 100 s lap). */
  est?: number
  /** Defaults to 5. */
  lapCompleted?: number
  /** Defaults to OnTrack. */
  surface?: number
  onPitRoad?: boolean
  /** Defaults to carIdx + 1. */
  classPos?: number
}

type MutableFrame = { -readonly [K in keyof TelemetryFrame]: TelemetryFrame[K] }

interface FrameOpts {
  player?: number
  /** 0 = Race, 1 = Practice in makeSession. */
  sessionNum?: number
  sessionState?: number
  overrides?: Partial<MutableFrame>
}

/** Every variable missing (empty array); makeFrame fills the ones the relative reads. */
const MISSING_VARS = Object.fromEntries(
  TELEMETRY_VAR_NAMES.map((n) => [n, []])
) as unknown as TelemetryFrame

/** MAX_CARS-length arrays, every car not in world unless listed in `cars`. */
function makeFrame(cars: Record<number, CarState>, opts: FrameOpts = {}): TelemetryFrame {
  const pct = new Array<number>(MAX_CARS).fill(-1)
  const est = new Array<number>(MAX_CARS).fill(0)
  const lap = new Array<number>(MAX_CARS).fill(-1)
  const surface = new Array<number>(MAX_CARS).fill(TrackLocation.NotInWorld)
  const pit = new Array<boolean>(MAX_CARS).fill(false)
  const classPos = new Array<number>(MAX_CARS).fill(0)
  for (const [key, c] of Object.entries(cars)) {
    const i = Number(key)
    pct[i] = c.pct
    est[i] = c.est ?? c.pct * 100
    lap[i] = c.lapCompleted ?? 5
    surface[i] = c.surface ?? TrackLocation.OnTrack
    pit[i] = c.onPitRoad ?? false
    classPos[i] = c.classPos ?? i + 1
  }
  return {
    ...MISSING_VARS,
    SessionTime: [1000],
    SessionNum: [opts.sessionNum ?? 0],
    SessionState: [opts.sessionState ?? SessionState.Racing],
    PlayerCarIdx: [opts.player ?? 0],
    IsOnTrack: [true],
    CarLeftRight: [1],
    CarIdxLapDistPct: pct,
    CarIdxEstTime: est,
    CarIdxLapCompleted: lap,
    CarIdxOnPitRoad: pit,
    CarIdxTrackSurface: surface,
    CarIdxClassPosition: classPos,
    ...opts.overrides
  }
}

function makeDriver(carIdx: number, o: Partial<DriverEntry> = {}): DriverEntry {
  return {
    carIdx,
    userName: `Piloto ${carIdx}`,
    teamName: '',
    carNumber: String(carIdx),
    iRating: 1500 + carIdx,
    licString: 'A 4.60',
    licColor: '#0153db',
    classId: 1,
    classShortName: 'GT3',
    classColor: '#ffffff',
    classEstLapTime: 100,
    isPaceCar: false,
    isSpectator: false,
    licLevel: 18,
    licSubLevel: 460,
    classRelSpeed: 0,
    userId: 1000 + carIdx,
    teamId: 0,
    carId: 67,
    carName: 'Porsche 911 GT3 R',
    isAI: false,
    ...o
  }
}

function drivers(n: number, o: Partial<DriverEntry> = {}): DriverEntry[] {
  return Array.from({ length: n }, (_, i) => makeDriver(i, o))
}

function makeSession(list: DriverEntry[], o: Partial<SessionMeta> = {}): SessionMeta {
  return {
    ...EMPTY_SESSION,
    playerCarIdx: 0,
    paceCarIdx: -1,
    driverCarEstLapTime: 100,
    trackLengthM: 5000,
    trackName: 'Test',
    drivers: new Map(list.map((d) => [d.carIdx, d])),
    sessionTypes: new Map([
      [0, 'Race'],
      [1, 'Practice']
    ]),
    ...o
  }
}

const OPTS: RelativeOptions = {
  carsAhead: 3,
  carsBehind: 3,
  showClassPosition: true,
  showLicense: true,
  showIRating: true,
  showIncidents: true,
  nameFormat: 'full'
}

const ids = (data: RelativeData): number[] => data.rows.map((r) => r.carIdx)

function rowOf(data: RelativeData, carIdx: number): RelativeData['rows'][number] {
  const row = data.rows.find((r) => r.carIdx === carIdx)
  if (!row) throw new Error(`car ${carIdx} not in rows`)
  return row
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('S/F line crossing', () => {
  it('estimateGap corrects the crossing with the focus lap time', () => {
    expect(estimateGap(2, 98, 0.02, 0.98, 100, 100)).toBeCloseTo(4)
    expect(estimateGap(98, 2, 0.98, 0.02, 100, 100)).toBeCloseTo(-4)
  })

  it('sorts a car just past the line ahead of the player', () => {
    const session = makeSession(drivers(2))
    const data = computeRelative(
      makeFrame({
        0: { pct: 0.98, est: 98, lapCompleted: 5 },
        1: { pct: 0.02, est: 2, lapCompleted: 6 }
      }),
      session,
      OPTS
    )
    expect(ids(data)).toEqual([1, 0])
    expect(data.playerRow).toBe(1)
    expect(rowOf(data, 1).gapS).toBeCloseTo(4)
    expect(rowOf(data, 1).lapRelation).toBe('same')
  })

  it('sorts a car just before the line behind a player who crossed it', () => {
    const session = makeSession(drivers(2))
    const data = computeRelative(
      makeFrame({
        0: { pct: 0.02, est: 2, lapCompleted: 6 },
        1: { pct: 0.98, est: 98, lapCompleted: 5 }
      }),
      session,
      OPTS
    )
    expect(ids(data)).toEqual([0, 1])
    expect(data.playerRow).toBe(0)
    expect(rowOf(data, 1).gapS).toBeCloseTo(-4)
    expect(rowOf(data, 1).lapRelation).toBe('same')
  })
})

describe('lap relation', () => {
  const cars: Record<number, CarState> = {
    0: { pct: 0.5, lapCompleted: 5 },
    1: { pct: 0.55, lapCompleted: 4 }, // just ahead on track, one lap down
    2: { pct: 0.45, lapCompleted: 6 }, // just behind on track, one lap up
    3: { pct: 0.52, lapCompleted: 5 }
  }
  const session = makeSession(drivers(4))

  it('marks lapped and lapping cars in a race while racing', () => {
    const data = computeRelative(makeFrame(cars), session, OPTS)
    expect(ids(data)).toEqual([1, 3, 0, 2])
    expect(rowOf(data, 1).lapRelation).toBe('behind')
    expect(rowOf(data, 2).lapRelation).toBe('ahead')
    expect(rowOf(data, 3).lapRelation).toBe('same')
    expect(rowOf(data, 0).lapRelation).toBe('same')
  })

  it('is always same in practice', () => {
    const data = computeRelative(makeFrame(cars, { sessionNum: 1 }), session, OPTS)
    expect(data.sessionType).toBe('Practice')
    expect(data.rows.every((r) => r.lapRelation === 'same')).toBe(true)
  })

  it('is always same in a race before the green flag', () => {
    const frame = makeFrame(cars, { sessionState: SessionState.ParadeLaps })
    const data = computeRelative(frame, session, OPTS)
    expect(data.sessionType).toBe('Race')
    expect(data.rows.every((r) => r.lapRelation === 'same')).toBe(true)
  })

  it('lapRelationsActive needs a race session from Racing on', () => {
    expect(lapRelationsActive('Race', SessionState.Racing)).toBe(true)
    expect(lapRelationsActive('race', SessionState.Checkered)).toBe(true)
    expect(lapRelationsActive('Race', SessionState.ParadeLaps)).toBe(false)
    expect(lapRelationsActive('Lone Qualify', SessionState.Racing)).toBe(false)
    expect(lapRelationsActive(null, SessionState.Racing)).toBe(false)
  })

  it('lapRelation edge cases', () => {
    expect(lapRelation(false, 3, 0.5, 5, 0.5)).toBe('same')
    expect(lapRelation(true, -1, 0.5, 5, 0.5)).toBe('same')
    expect(lapRelation(true, 5, 0.5, -1, 0.5)).toBe('same')
    expect(lapRelation(true, NaN, 0.5, 5, 0.5)).toBe('same')
    // Math.round(-0.5) === -0
    expect(lapRelation(true, 5, 0.25, 5, 0.75)).toBe('same')
    expect(lapRelation(true, 7, 0.1, 5, 0.1)).toBe('ahead')
    expect(lapRelation(true, 3, 0.1, 5, 0.1)).toBe('behind')
  })
})

describe('cars in the pits', () => {
  it('includes them with inPits set', () => {
    const session = makeSession(drivers(4))
    const frame = makeFrame({
      0: { pct: 0.5 },
      1: { pct: 0.52, onPitRoad: true, surface: TrackLocation.ApproachingPits },
      2: { pct: 0.48, surface: TrackLocation.InPitStall },
      3: { pct: 0.47 }
    })
    const data = computeRelative(frame, session, OPTS)
    expect(ids(data)).toEqual([1, 0, 2, 3])
    expect(rowOf(data, 1).inPits).toBe(true)
    expect(rowOf(data, 2).inPits).toBe(true)
    expect(rowOf(data, 3).inPits).toBe(false)
    expect(rowOf(data, 0).inPits).toBe(false)
  })
})

describe('exclusions', () => {
  it('hides pace car, spectators, cars not in world and unknown cars', () => {
    const list = drivers(8)
    list[1] = makeDriver(1, { isPaceCar: true })
    list[3] = makeDriver(3, { isSpectator: true })
    const session = makeSession(list, { paceCarIdx: 2 })
    const frame = makeFrame({
      0: { pct: 0.5 },
      1: { pct: 0.51 }, // CarIsPaceCar
      2: { pct: 0.52 }, // DriverInfo.PaceCarIdx
      3: { pct: 0.53 }, // spectator
      4: { pct: -1 },
      5: { pct: 0.49, surface: TrackLocation.NotInWorld },
      6: { pct: NaN },
      7: { pct: 0.48 },
      9: { pct: 0.47 } // no DriverEntry
    })
    const data = computeRelative(frame, session, OPTS)
    expect(ids(data)).toEqual([0, 7])
  })
})

describe('multi-class normalisation', () => {
  it('rescales the other est time to the focus class lap', () => {
    // Focus class 100 s, other class 90 s, other 0.01 lap ahead.
    const raw = 0.51 * 90 - 0.5 * 100
    expect(raw).toBeLessThan(0)
    expect(estimateGap(0.51 * 90, 50, 0.51, 0.5, 90, 100)).toBeCloseTo(1, 6)
    expect(estimateGap(0.49 * 90, 50, 0.49, 0.5, 90, 100)).toBeCloseTo(-1, 6)
    // Crossing the line with a different class: corrected with the focus lap.
    expect(estimateGap(0.02 * 90, 98, 0.02, 0.98, 90, 100)).toBeCloseTo(4, 6)
  })

  it('applies it in computeRelative', () => {
    const list = [
      makeDriver(0),
      makeDriver(1, { classId: 2, classShortName: 'GT4', classEstLapTime: 90 }),
      makeDriver(2, { classId: 2, classShortName: 'GT4', classEstLapTime: 90 })
    ]
    const frame = makeFrame({
      0: { pct: 0.5, est: 50 },
      1: { pct: 0.51, est: 0.51 * 90 },
      2: { pct: 0.49, est: 0.49 * 90 }
    })
    const data = computeRelative(frame, makeSession(list), OPTS)
    expect(ids(data)).toEqual([1, 0, 2])
    expect(rowOf(data, 1).gapS).toBeCloseTo(1, 6)
    expect(rowOf(data, 2).gapS).toBeCloseTo(-1, 6)
    expect(rowOf(data, 1).classShortName).toBe('GT4')
  })
})

describe('window', () => {
  it('shows the closest cars, symmetric', () => {
    const cars: Record<number, CarState> = { 0: { pct: 0.5 } }
    for (let k = 1; k <= 5; k++) {
      cars[k] = { pct: 0.5 + k * 0.01 } // ahead
      cars[k + 5] = { pct: 0.5 - k * 0.01 } // behind
    }
    const data = computeRelative(makeFrame(cars), makeSession(drivers(11)), OPTS)
    expect(ids(data)).toEqual([3, 2, 1, 0, 6, 7, 8])
    expect(data.playerRow).toBe(3)
    expect(data.slotsAhead).toBe(3)
    expect(data.slotsBehind).toBe(3)
    const gaps = data.rows.map((r) => r.gapS ?? NaN)
    expect(gaps[0]).toBeCloseTo(3)
    expect(gaps[3]).toBe(0)
    expect(gaps[6]).toBeCloseTo(-3)
  })

  it('does not borrow rows from the other side', () => {
    const cars: Record<number, CarState> = { 0: { pct: 0.5 }, 1: { pct: 0.6 } }
    for (let k = 2; k <= 9; k++) cars[k] = { pct: 0.5 - k * 0.01 }
    const data = computeRelative(makeFrame(cars), makeSession(drivers(10)), OPTS)
    expect(ids(data)).toEqual([1, 0, 2, 3, 4])
    expect(data.playerRow).toBe(1)
  })

  it('puts a car at exactly the same pct below the player', () => {
    const frame = makeFrame({ 0: { pct: 0.5 }, 1: { pct: 0.5 } })
    const data = computeRelative(frame, makeSession(drivers(2)), OPTS)
    expect(ids(data)).toEqual([0, 1])
    expect(data.playerRow).toBe(0)
    expect(rowOf(data, 1).gapS).toBe(0)
  })

  it('breaks relPct ties by carIdx', () => {
    const frame = makeFrame({ 0: { pct: 0.5 }, 4: { pct: 0.6 }, 2: { pct: 0.6 }, 3: { pct: 0.7 } })
    const data = computeRelative(frame, makeSession(drivers(5)), OPTS)
    expect(ids(data)).toEqual([3, 2, 4, 0])
  })

  it('clamps the options to integers 0..10, invalid ones to the default', () => {
    expect(clampRelativeSlots(99)).toBe(10)
    expect(clampRelativeSlots(-3)).toBe(0)
    expect(clampRelativeSlots(2.6)).toBe(3)
    expect(clampRelativeSlots(NaN)).toBe(3)
    expect(clampRelativeSlots(Infinity)).toBe(3)
    const frame = makeFrame({ 0: { pct: 0.5 }, 1: { pct: 0.6 }, 2: { pct: 0.4 } })
    const data = computeRelative(frame, makeSession(drivers(3)), {
      ...OPTS,
      carsAhead: 0,
      carsBehind: 42
    })
    expect(ids(data)).toEqual([0, 2])
    expect(data.slotsAhead).toBe(0)
    expect(data.slotsBehind).toBe(10)
  })
})

describe('focus car', () => {
  const session = makeSession(drivers(3))

  it('returns no rows when the focus car is not in the world', () => {
    const offWorld = computeRelative(makeFrame({ 0: { pct: -1 }, 1: { pct: 0.5 } }), session, OPTS)
    expect(offWorld.rows).toEqual([])
    expect(offWorld.playerRow).toBe(-1)
    expect(offWorld.slotsAhead).toBe(3)
    expect(offWorld.sessionType).toBe('Race')

    const frame = makeFrame({ 0: { pct: 0.3, surface: TrackLocation.NotInWorld }, 1: { pct: 0.5 } })
    const surf = computeRelative(frame, session, OPTS)
    expect(surf.rows).toEqual([])
    expect(surf.playerRow).toBe(-1)
  })

  it('returns no rows when the focus car is unknown', () => {
    const frame = makeFrame({ 1: { pct: 0.5 } }, { player: -1 })
    const data = computeRelative(frame, makeSession(drivers(3), { playerCarIdx: -1 }), OPTS)
    expect(data.rows).toEqual([])
    expect(data.playerRow).toBe(-1)
  })

  it('falls back to DriverInfo.DriverCarIdx when PlayerCarIdx has no driver', () => {
    const frame = makeFrame({ 1: { pct: 0.5 }, 2: { pct: 0.6 } }, { player: 40 })
    const data = computeRelative(frame, makeSession(drivers(3), { playerCarIdx: 1 }), OPTS)
    expect(ids(data)).toEqual([2, 1])
    expect(rowOf(data, 1).isPlayer).toBe(true)
  })

  it('ignores an out-of-range PlayerCarIdx', () => {
    const frame = makeFrame({ 1: { pct: 0.5 }, 2: { pct: 0.6 } }, { player: 1.5 })
    const data = computeRelative(frame, makeSession(drivers(3), { playerCarIdx: 1 }), OPTS)
    expect(rowOf(data, 1).isPlayer).toBe(true)
  })

  it('prefers telemetry PlayerCarIdx', () => {
    const frame = makeFrame({ 1: { pct: 0.5 }, 2: { pct: 0.6 } }, { player: 2 })
    const data = computeRelative(frame, makeSession(drivers(3), { playerCarIdx: 1 }), OPTS)
    expect(ids(data)).toEqual([2, 1])
    expect(rowOf(data, 2).isPlayer).toBe(true)
    expect(data.playerRow).toBe(0)
  })
})

describe('fallbacks', () => {
  const sfCars: Record<number, CarState> = { 0: { pct: 0.98, est: 98 }, 1: { pct: 0.02, est: 2 } }

  it('uses DriverCarEstLapTime when the class est lap is 0', () => {
    const session = makeSession(drivers(2, { classEstLapTime: 0 }), { driverCarEstLapTime: 100 })
    expect(referenceLapTime(session.drivers.get(0), session)).toBe(100)
    const data = computeRelative(makeFrame(sfCars), session, OPTS)
    expect(rowOf(data, 1).gapS).toBeCloseTo(4)
  })

  it('uses 90 s when both are unknown', () => {
    const session = makeSession(drivers(2, { classEstLapTime: 0 }), { driverCarEstLapTime: 0 })
    expect(referenceLapTime(session.drivers.get(0), session)).toBe(FALLBACK_LAP_TIME_S)
    expect(referenceLapTime(undefined, session)).toBe(FALLBACK_LAP_TIME_S)
    const frame = makeFrame({ 0: { pct: 0.98, est: 88.2 }, 1: { pct: 0.02, est: 1.8 } })
    const data = computeRelative(frame, session, OPTS)
    expect(rowOf(data, 1).gapS).toBeCloseTo(3.6)
  })

  it('uses the focus lap for another class without est lap', () => {
    const list = [makeDriver(0), makeDriver(1, { classEstLapTime: 0 })]
    const data = computeRelative(makeFrame(sfCars), makeSession(list), OPTS)
    expect(rowOf(data, 1).gapS).toBeCloseTo(4)
    expect(estimateGap(2, 98, 0.02, 0.98, NaN, 100)).toBeCloseTo(4)
  })

  it('returns a null gap for non-finite est times', () => {
    expect(estimateGap(NaN, 50, 0.6, 0.5, 100, 100)).toBeNull()
    expect(estimateGap(60, Infinity, 0.6, 0.5, 100, 100)).toBeNull()
    const frame = makeFrame({ 0: { pct: 0.5 }, 1: { pct: 0.6, est: NaN }, 2: { pct: 0.4 } })
    const data = computeRelative(frame, makeSession(drivers(3)), OPTS)
    expect(rowOf(data, 1).gapS).toBeNull()
    expect(rowOf(data, 2).gapS).toBeCloseTo(-10)
    expect(rowOf(data, 0).gapS).toBe(0)

    const noFocusEst = makeFrame({ 0: { pct: 0.5, est: NaN }, 1: { pct: 0.6 } })
    const data2 = computeRelative(noFocusEst, makeSession(drivers(2)), OPTS)
    expect(rowOf(data2, 1).gapS).toBeNull()
    expect(rowOf(data2, 0).gapS).toBe(0)
  })

  it('survives short or empty arrays', () => {
    const frame = makeFrame(
      { 0: { pct: 0.5 }, 1: { pct: 0.6 } },
      {
        overrides: {
          SessionNum: [],
          SessionState: [],
          CarIdxEstTime: [],
          CarIdxLapCompleted: [],
          CarIdxOnPitRoad: [],
          CarIdxTrackSurface: [],
          CarIdxClassPosition: []
        }
      }
    )
    const data = computeRelative(frame, makeSession(drivers(2)), OPTS)
    expect(ids(data)).toEqual([1, 0])
    expect(data.sessionType).toBeNull()
    const row = rowOf(data, 1)
    expect(row.gapS).toBeNull()
    expect(row.classPosition).toBeNull()
    expect(row.inPits).toBe(false)
    expect(row.lapRelation).toBe('same')

    const empty = makeFrame({}, { overrides: { PlayerCarIdx: [], CarIdxLapDistPct: [] } })
    expect(computeRelative(empty, makeSession(drivers(2)), OPTS).rows).toEqual([])
  })

  it('shows the starting slot on the grid, before the first scored crossing', () => {
    // On the grid iRacing reports class position 0 for everyone.
    const frame = makeFrame(
      { 0: { pct: 0.5, classPos: 0 }, 1: { pct: 0.6, classPos: 0 }, 2: { pct: 0.4, classPos: 0 } },
      { sessionState: SessionState.ParadeLaps }
    )
    const grid = new Map([
      [0, { position: 7, classPosition: 7 }],
      [1, { position: 6, classPosition: 6 }]
    ])
    const data = computeRelative(frame, makeSession(drivers(3), { grid }), OPTS)
    expect(rowOf(data, 0).classPosition).toBe(7)
    expect(rowOf(data, 1).classPosition).toBe(6)
    // Not on the grid (joined late): unknown.
    expect(rowOf(data, 2).classPosition).toBeNull()
    // Once scored, the live position wins.
    const racing = makeFrame({ 0: { pct: 0.5, classPos: 3 }, 1: { pct: 0.6, classPos: 2 } })
    expect(
      rowOf(computeRelative(racing, makeSession(drivers(2), { grid }), OPTS), 0).classPosition
    ).toBe(3)
  })
})

describe('gap sign agreement', () => {
  it('clamps to 0 when the gap disagrees with the track position', () => {
    // Ahead on track, est says slightly behind.
    expect(estimateGap(50.04, 50.1, 0.501, 0.5, 100, 100)).toBe(0)
    // Behind on track, est says slightly ahead.
    expect(estimateGap(50.2, 50.1, 0.499, 0.5, 100, 100)).toBe(0)
    // Same pct counts as behind: a positive gap is clamped.
    expect(estimateGap(50.2, 50, 0.5, 0.5, 100, 100)).toBe(0)
    // Agreeing signs are kept.
    expect(estimateGap(50.2, 50, 0.502, 0.5, 100, 100)).toBeCloseTo(0.2)
    // Never -0.
    expect(Object.is(estimateGap(50, 50, 0.5, 0.5, 100, 100), 0)).toBe(true)
  })

  it('clamps in computeRelative for a faster class next to the player', () => {
    const list = [makeDriver(0), makeDriver(1, { classEstLapTime: 90 })]
    // Other car 0.001 lap ahead, but its est (on a 90 s lap) normalises to behind.
    const frame = makeFrame({ 0: { pct: 0.5, est: 50 }, 1: { pct: 0.501, est: 44.9 } })
    const data = computeRelative(frame, makeSession(list), OPTS)
    expect(ids(data)).toEqual([1, 0])
    expect(rowOf(data, 1).gapS).toBe(0)
  })
})

describe('row fields', () => {
  it('marks a car in its pit stall as in the pits', () => {
    const frame = makeFrame({
      0: { pct: 0.5 },
      1: { pct: 0.45, surface: TrackLocation.InPitStall }
    })
    expect(rowOf(computeRelative(frame, makeSession(drivers(2)), OPTS), 1).inPits).toBe(true)
  })

  it('maps driver and telemetry data', () => {
    const list = [
      makeDriver(0, { userName: 'Yo', carNumber: '7', iRating: 2100, licColor: '#00c702' }),
      makeDriver(1, {
        userName: 'Rookie',
        carNumber: '23',
        iRating: 0,
        licString: '',
        licColor: null,
        classColor: '#ffda59'
      })
    ]
    const frame = makeFrame({ 0: { pct: 0.5, classPos: 4 }, 1: { pct: 0.45, classPos: 0 } })
    const data = computeRelative(frame, makeSession(list), OPTS)
    expect(data.rows).toEqual([
      {
        carIdx: 0,
        isPlayer: true,
        classPosition: 4,
        carNumber: '7',
        driverName: 'Yo',
        classShortName: 'GT3',
        classColor: '#ffffff',
        iRating: 2100,
        licString: 'A 4.60',
        licColor: '#00c702',
        gapS: 0,
        lapRelation: 'same',
        inPits: false
      },
      {
        carIdx: 1,
        isPlayer: false,
        classPosition: null,
        carNumber: '23',
        driverName: 'Rookie',
        classShortName: 'GT3',
        classColor: '#ffda59',
        iRating: null,
        licString: null,
        licColor: null,
        gapS: expect.closeTo(-5),
        lapRelation: 'same',
        inPits: false
      }
    ])
  })
})

describe('incidents', () => {
  const LIMITS = { dq: null, penalty: 17, penaltyEvery: 8 }

  it('carries your count and the next limit for the header, in any session', () => {
    const session = makeSession(drivers(2), { incidentLimits: LIMITS })
    const frame = makeFrame(
      { 0: { pct: 0.5 }, 1: { pct: 0.6 } },
      { sessionNum: 1, overrides: { PlayerCarMyIncidentCount: [11] } }
    )
    expect(computeRelative(frame, session, OPTS).incidents).toEqual({
      mine: 11,
      team: null,
      limit: { kind: 'penalty', at: 17 }
    })
  })

  it('out of the car the header still counts; without the variable it is unknown', () => {
    const session = makeSession(drivers(2))
    const out = makeFrame({ 1: { pct: 0.6 } }, { overrides: { PlayerCarMyIncidentCount: [4] } })
    const data = computeRelative(out, session, OPTS)
    expect(data.playerRow).toBe(-1)
    expect(data.incidents?.mine).toBe(4)
    expect(computeRelative(makeFrame({ 0: { pct: 0.5 } }), session, OPTS).incidents).toBeNull()
  })
})
