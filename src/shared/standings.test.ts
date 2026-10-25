import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionFlag } from './flags'
import type { RaceCarState, RaceView } from './race/raceView'
import { iRatingDeltas, playerProjection } from './ratings/irating'
import { projectSessionSafetyRating } from './ratings/sessionSafety'
import type { SessionSafetyInput } from './ratings/sessionSafety'
import { createDefaultSettings } from './settings'
import { StandingsProvider } from './standings'
import type { StandingsDisplayRow } from './standings'
import { MAX_CARS, TELEMETRY_VAR_NAMES } from './telemetry'
import type { TelemetryFrame } from './telemetry'
import type {
  DriverEntry,
  SafetyRatingProjection,
  SessionMeta,
  StandingsClassBlock,
  StandingsColumnId,
  StandingsData,
  StandingsOptions
} from './types'

// The real iRating port, wrapped to count calls; the SR header with a stand-in that echoes its
// inputs (its arithmetic is tested in ratings/).
vi.mock('./ratings/irating', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ratings/irating')>()
  return {
    ...actual,
    iRatingDeltas: vi.fn(actual.iRatingDeltas),
    playerProjection: vi.fn(actual.playerProjection)
  }
})

function fakeSafety(input: SessionSafetyInput): SafetyRatingProjection | null {
  return {
    current: input.licSubLevel / 100,
    projected: input.licSubLevel / 100 - input.incidents / 100,
    licClass: 'B',
    projectedLicClass: 'B',
    incidents: input.incidents,
    corners: input.corners,
    incidentBudget: input.totalCorners ?? -1
  }
}

vi.mock('./ratings/sessionSafety', () => ({ projectSessionSafetyRating: vi.fn() }))

beforeEach(() => {
  vi.mocked(iRatingDeltas).mockClear()
  vi.mocked(playerProjection).mockClear()
  vi.mocked(projectSessionSafetyRating).mockReset().mockImplementation(fakeSafety)
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface FakeCar extends Partial<Omit<RaceCarState, 'carIdx'>> {
  carIdx: number
  /** Seconds behind the overall leader at the last line (timeGap = t[behind] - t[ahead]); null = unknown. Defaults to classPosition. */
  t?: number | null
}

interface FakeRaceOpts {
  playerCarIdx?: number
  racing?: boolean
  lapsRemaining?: number | null
  timeRemainingS?: number | null
  playerDistanceDriven?: number
  playerIncidents?: number
  sessionKey?: string
}

/** Hand-written RaceView: gaps from `t`, laps down from `distance` (default 10 for everybody). */
function makeRace(list: readonly FakeCar[], o: FakeRaceOpts = {}): RaceView {
  const states = new Map<number, RaceCarState>()
  const times = new Map<number, number | null>()
  for (const { t, ...c } of list) {
    const state: RaceCarState = {
      distance: 10,
      classPosition: 0,
      overallPosition: 0,
      inWorld: true,
      inPits: false,
      offTrack: false,
      disconnected: false,
      finished: false,
      pitStops: 0,
      lastPitLap: null,
      outLap: false,
      stintLaps: 0,
      lastLapTime: null,
      bestLapTime: null,
      laps: [],
      pace: null,
      speed: 0,
      stoppedForS: 0,
      sessionFlags: 0,
      ...c
    }
    states.set(c.carIdx, state)
    times.set(c.carIdx, t === undefined ? state.classPosition : t)
  }
  const cars = [...states.values()]
  return {
    sessionTime: 1000,
    sessionKey: o.sessionKey ?? 'test',
    racing: o.racing ?? true,
    playerCarIdx: o.playerCarIdx ?? 0,
    car: (i) => states.get(i),
    cars: () => cars,
    timeGap: (behind, ahead) => {
      const tb = times.get(behind)
      const ta = times.get(ahead)
      return tb === undefined || tb === null || ta === undefined || ta === null ? null : tb - ta
    },
    lapsBehind: (behind, ahead) => {
      const d = Math.floor(
        (states.get(ahead)?.distance ?? NaN) - (states.get(behind)?.distance ?? NaN)
      )
      return d > 0 ? d : 0
    },
    gapHistory: () => [],
    lastLapSectors: () => null,
    lapSectors: () => null,
    lapsRemaining: () => o.lapsRemaining ?? null,
    currentLap: () => null,
    lapProfile: () => null,
    timeRemainingS: o.timeRemainingS ?? null,
    playerDistanceDriven: o.playerDistanceDriven ?? 0,
    playerIncidents: o.playerIncidents ?? 0
  }
}

/** `n` cars of one class, carIdx `first`.., class positions 1..n. */
function field(n: number, first = 0, o: Partial<FakeCar> = {}): FakeCar[] {
  return Array.from({ length: n }, (_, k) => ({ classPosition: k + 1, ...o, carIdx: first + k }))
}

function makeDriver(carIdx: number, o: Partial<DriverEntry> = {}): DriverEntry {
  return {
    carIdx,
    userName: `Piloto ${carIdx}`,
    teamName: '',
    carNumber: String(carIdx),
    iRating: 2000 + carIdx,
    licString: 'B 3.12',
    licColor: '#00c702',
    classId: 1,
    classShortName: 'MX5',
    classColor: '#ffda59',
    classEstLapTime: 100,
    isPaceCar: false,
    isSpectator: false,
    licLevel: 12,
    licSubLevel: 312,
    classRelSpeed: 50,
    userId: 1000 + carIdx,
    teamId: 0,
    carId: 67,
    carName: 'Porsche 911 GT3 R',
    isAI: false,
    ...o
  }
}

function drivers(n: number, first = 0, o: Partial<DriverEntry> = {}): DriverEntry[] {
  return Array.from({ length: n }, (_, k) => makeDriver(first + k, o))
}

function makeSession(list: readonly DriverEntry[], o: Partial<SessionMeta> = {}): SessionMeta {
  return {
    playerCarIdx: 0,
    paceCarIdx: -1,
    driverCarEstLapTime: 100,
    trackLengthM: 5000,
    trackName: 'Test',
    drivers: new Map(list.map((d) => [d.carIdx, d])),
    tyreCompounds: new Map(),
    sessionTypes: new Map([
      [0, 'Race'],
      [1, 'Practice']
    ]),
    sessions: new Map(),
    subSessionId: 1,
    eventType: 'Race',
    official: true,
    trackNumTurns: 10,
    sectorStarts: [],
    grid: new Map(),
    teamRacing: false,
    pitSpeedLimitKmh: null,
    trackId: 1,
    trackConfig: '',
    ...o
  }
}

/** Every variable empty except SessionNum, IsOnTrack and CarIdxLastLapTime. */
function makeFrame(
  o: { sessionNum?: number; lastLaps?: Record<number, number>; onTrack?: boolean } = {}
): TelemetryFrame {
  const empty = Object.fromEntries(TELEMETRY_VAR_NAMES.map((n) => [n, []])) as unknown
  const last = new Array<number>(MAX_CARS).fill(-1)
  for (const [k, v] of Object.entries(o.lastLaps ?? {})) last[Number(k)] = v
  return {
    ...(empty as TelemetryFrame),
    SessionNum: [o.sessionNum ?? 0],
    IsOnTrack: [o.onTrack ?? true],
    CarIdxLastLapTime: last
  }
}

const RACE = makeFrame()
const PRACTICE = makeFrame({ sessionNum: 1 })

/** Every column shown, the iRating change on every row: the provider computes everything. */
const OPTS: StandingsOptions = {
  ...createDefaultSettings().standings,
  topRows: 3,
  aroundRows: 2,
  columns: createDefaultSettings().standings.columns.map((c) => ({ ...c, visible: true })),
  iRatingDeltaAll: true
}
const FULL: StandingsOptions = { ...OPTS, mode: 'full' }

function hide(opts: StandingsOptions, ...ids: StandingsColumnId[]): StandingsOptions {
  return {
    ...opts,
    columns: opts.columns.map((c) => (ids.includes(c.id) ? { ...c, visible: false } : c))
  }
}

let provider: StandingsProvider
beforeEach(() => {
  provider = new StandingsProvider()
})

function compute(
  frame: TelemetryFrame,
  session: SessionMeta,
  race: RaceView,
  opts: StandingsOptions
): StandingsData {
  return provider.compute(frame, session, race, opts)
}

function block(data: StandingsData, i = 0): StandingsClassBlock {
  const b = data.classes[i]
  if (!b) throw new Error(`no class block ${i}`)
  return b
}

const positions = (b: StandingsClassBlock): number[] => b.rows.map((r) => r.classPosition)
const carIdxs = (b: StandingsClassBlock): number[] => b.rows.map((r) => r.carIdx)

function rowOf(data: StandingsData, carIdx: number): StandingsDisplayRow {
  for (const b of data.classes) {
    const r = b.rows.find((x) => x.carIdx === carIdx)
    if (r) return r
  }
  throw new Error(`car ${carIdx} not in rows`)
}

// ---------------------------------------------------------------------------
// Row selection
// ---------------------------------------------------------------------------

describe('compact mode', () => {
  const session = makeSession(drivers(20))

  it('shows the top rows and a window around the player, with a separator', () => {
    const race = makeRace(field(20), { playerCarIdx: 11 })
    const b = block(compute(RACE, session, race, OPTS))
    expect(positions(b)).toEqual([1, 2, 3, 10, 11, 12, 13, 14])
    expect(b.rows.filter((r) => r.gapBefore).map((r) => r.classPosition)).toEqual([10])
    expect(b.rows.filter((r) => r.isPlayer).map((r) => r.carIdx)).toEqual([11])
    expect(b.isPlayerClass).toBe(true)
    expect(b.carCount).toBe(20)
  })

  it('does not duplicate rows when the player is near the top', () => {
    const race = makeRace(field(20), { playerCarIdx: 1 })
    const b = block(compute(RACE, session, race, { ...OPTS, aroundRows: 3 }))
    expect(positions(b)).toEqual([1, 2, 3, 4, 5])
    expect(b.rows.some((r) => r.gapBefore)).toBe(false)
  })

  it('joins the window to the top rows without a separator when they touch', () => {
    const race = makeRace(field(20), { playerCarIdx: 5 })
    const b = block(compute(RACE, session, race, OPTS))
    expect(positions(b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(b.rows.some((r) => r.gapBefore)).toBe(false)
  })

  it('clips the window at the end of the class', () => {
    const race = makeRace(field(20), { playerCarIdx: 19 })
    const b = block(compute(RACE, session, race, OPTS))
    expect(positions(b)).toEqual([1, 2, 3, 18, 19, 20])
    expect(b.rows.filter((r) => r.gapBefore).map((r) => r.classPosition)).toEqual([18])
  })

  it('shows just the top rows when the player is not classified', () => {
    const cars = field(20)
    const race = makeRace([...cars.slice(0, 19), { carIdx: 19, classPosition: 0 }], {
      playerCarIdx: 19
    })
    const b = block(compute(RACE, session, race, OPTS))
    expect(positions(b)).toEqual([1, 2, 3])
    expect(b.isPlayerClass).toBe(true)
  })

  it('marks rows skipped above the first row when there are no top rows', () => {
    const race = makeRace(field(20), { playerCarIdx: 4 })
    const b = block(compute(RACE, session, race, { ...OPTS, topRows: 0, aroundRows: 1 }))
    expect(positions(b)).toEqual([4, 5, 6])
    expect(b.rows.map((r) => r.gapBefore)).toEqual([true, false, false])
  })

  it('clamps the configured row counts to the schema range', () => {
    const race = makeRace(field(20), { playerCarIdx: 0 })
    expect(
      block(compute(RACE, session, race, { ...OPTS, topRows: 99, aroundRows: 0 })).rows
    ).toHaveLength(10)
    expect(
      block(compute(RACE, session, race, { ...OPTS, topRows: 2.6, aroundRows: -2 })).rows
    ).toHaveLength(3)
    // Not a number: the default (3 top rows, 3 around).
    const nan = compute(RACE, session, makeRace(field(20), { playerCarIdx: 10 }), {
      ...OPTS,
      topRows: NaN,
      aroundRows: NaN
    })
    expect(positions(block(nan))).toEqual([1, 2, 3, 8, 9, 10, 11, 12, 13, 14])
  })
})

describe('full mode', () => {
  it('shows every car of every class, unclassified cars last', () => {
    const session = makeSession([
      ...drivers(4),
      ...drivers(3, 10, { classId: 2, classRelSpeed: 90 })
    ])
    const race = makeRace([
      { carIdx: 0, classPosition: 0 },
      { carIdx: 1, classPosition: 3 },
      { carIdx: 2, classPosition: 1 },
      { carIdx: 3, classPosition: 2 },
      ...field(3, 10)
    ])
    const data = compute(RACE, session, race, FULL)
    expect(data.classes).toHaveLength(2)
    expect(carIdxs(block(data, 0))).toEqual([2, 3, 1, 0])
    expect(positions(block(data, 0))).toEqual([1, 2, 3, 0])
    expect(carIdxs(block(data, 1))).toEqual([10, 11, 12])
    expect(data.classes.flatMap((b) => b.rows).some((r) => r.gapBefore)).toBe(false)
    // An unclassified car has no gaps.
    expect(rowOf(data, 0).interval).toBeNull()
    expect(rowOf(data, 0).gapToLeader).toBeNull()
  })
})

describe('classes', () => {
  // Player (car 0) in the slowest class; 20 and 30 tie on speed.
  const list = [
    ...drivers(3, 0, {
      classId: 5,
      classShortName: 'MX5',
      classColor: '#ffda59',
      classRelSpeed: 50
    }),
    ...drivers(2, 10, {
      classId: 30,
      classShortName: '',
      classColor: '#33ceff',
      classRelSpeed: 80
    }),
    ...drivers(2, 20, {
      classId: 20,
      classShortName: 'GT4',
      classColor: '#ff5888',
      classRelSpeed: 80
    }),
    ...drivers(4, 30, {
      classId: 10,
      classShortName: 'GTP',
      classColor: '#ae6bff',
      classRelSpeed: 100
    })
  ]
  const session = makeSession(list)
  const race = makeRace([...field(3, 0), ...field(2, 10), ...field(2, 20), ...field(4, 30)])

  it("puts the player's class first, then the others fastest first (ties by class id)", () => {
    const data = compute(RACE, session, race, OPTS)
    expect(data.classes.map((b) => b.classId)).toEqual([5, 10, 20, 30])
    expect(data.classes.map((b) => b.isPlayerClass)).toEqual([true, false, false, false])
    // No name in the session info: '' (the widget words it in its own language).
    expect(data.classes.map((b) => b.className)).toEqual(['MX5', 'GTP', 'GT4', ''])
    expect(data.classes.map((b) => b.classColor)).toEqual([
      '#ffda59',
      '#ae6bff',
      '#ff5888',
      '#33ceff'
    ])
    expect(data.classes.map((b) => b.carCount)).toEqual([3, 4, 2, 2])
  })

  it('compact: one row with the leader of each other class', () => {
    const data = compute(RACE, session, race, OPTS)
    expect(data.classes.slice(1).map(carIdxs)).toEqual([[30], [20], [10]])
    expect(data.classes.slice(1).every((b) => b.rows[0]?.classPosition === 1)).toBe(true)
  })

  it('compact: no other classes without otherClassLeaders', () => {
    const data = compute(RACE, session, race, { ...OPTS, otherClassLeaders: false })
    expect(data.classes.map((b) => b.classId)).toEqual([5])
  })

  it('compact: skips another class nobody in which is classified yet', () => {
    const r = makeRace([...field(3, 0), { carIdx: 30, classPosition: 0 }])
    const data = compute(RACE, session, r, OPTS)
    expect(data.classes.map((b) => b.classId)).toEqual([5])
    expect(compute(RACE, session, r, FULL).classes.map((b) => b.classId)).toEqual([5, 10])
  })

  it('without a player class (spectating) the fastest class gets the top rows', () => {
    const r = makeRace([...field(3, 0), ...field(4, 30)], { playerCarIdx: 99 })
    const data = compute(RACE, session, r, { ...OPTS, topRows: 2 })
    expect(data.classes.map((b) => b.classId)).toEqual([10, 5])
    expect(carIdxs(block(data, 0))).toEqual([30, 31])
    expect(carIdxs(block(data, 1))).toEqual([0])
    expect(data.classes.some((b) => b.isPlayerClass)).toBe(false)
    expect(data.header.iRating).toBeNull()
  })

  it('skips cars missing from the session YAML, pace cars and spectators', () => {
    const s = makeSession([
      ...drivers(2),
      makeDriver(5, { isPaceCar: true }),
      makeDriver(6, { isSpectator: true })
    ])
    const r = makeRace([...field(2), { carIdx: 4, classPosition: 3 }, { carIdx: 5 }, { carIdx: 6 }])
    const b = block(compute(RACE, s, r, FULL))
    expect(carIdxs(b)).toEqual([0, 1])
    expect(b.carCount).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Row fields
// ---------------------------------------------------------------------------

describe('gaps', () => {
  const session = makeSession(drivers(6))

  it('race: interval and gap to the class leader from the timing lines, laps when lapped', () => {
    const race = makeRace([
      { carIdx: 0, classPosition: 1, t: 0, distance: 13 },
      { carIdx: 1, classPosition: 2, t: 1.26, distance: 12.95 },
      // Still shown behind car 1 (position hold) although already ahead on the line: 0.0.
      { carIdx: 2, classPosition: 3, t: 1.24, distance: 12.9 },
      { carIdx: 3, classPosition: 4, t: null, distance: 12.2 },
      { carIdx: 4, classPosition: 5, t: 90, distance: 10.9 }
    ])
    const data = compute(RACE, session, race, FULL)
    expect(rowOf(data, 0).interval).toBeNull()
    expect(rowOf(data, 0).gapToLeader).toBeNull()
    expect(rowOf(data, 1).interval).toEqual({ kind: 'time', seconds: 1.3 })
    expect(rowOf(data, 1).gapToLeader).toEqual({ kind: 'time', seconds: 1.3 })
    expect(rowOf(data, 2).interval).toEqual({ kind: 'time', seconds: 0 })
    expect(rowOf(data, 2).gapToLeader).toEqual({ kind: 'time', seconds: 1.2 })
    // No crossing of the same line in the history: unknown.
    expect(rowOf(data, 3).interval).toBeNull()
    expect(rowOf(data, 3).gapToLeader).toBeNull()
    expect(rowOf(data, 4).interval).toEqual({ kind: 'laps', laps: 1 })
    expect(rowOf(data, 4).gapToLeader).toEqual({ kind: 'laps', laps: 2 })
  })

  it('race: no gaps before the green flag', () => {
    const race = makeRace(field(3), { racing: false })
    const data = compute(RACE, session, race, FULL)
    expect(block(data).rows.map((r) => [r.interval, r.gapToLeader])).toEqual([
      [null, null],
      [null, null],
      [null, null]
    ])
  })

  it('race: finishers keep their (model-frozen) gaps after the flag', () => {
    const race = makeRace([
      { carIdx: 0, classPosition: 1, t: 0, finished: true, inWorld: false, distance: NaN },
      { carIdx: 1, classPosition: 2, t: 3.04, finished: true, inPits: true },
      { carIdx: 2, classPosition: 3, t: 4.5 }
    ])
    const data = compute(RACE, session, race, FULL)
    expect(rowOf(data, 1).interval).toEqual({ kind: 'time', seconds: 3 })
    expect(rowOf(data, 2).gapToLeader).toEqual({ kind: 'time', seconds: 4.5 })
  })

  it('practice: gaps from best laps, null without a time', () => {
    const race = makeRace([
      { carIdx: 0, classPosition: 1, bestLapTime: 90.1234 },
      { carIdx: 1, classPosition: 2, bestLapTime: 90.5 },
      { carIdx: 2, classPosition: 3, bestLapTime: null },
      { carIdx: 3, classPosition: 4, bestLapTime: 91 }
    ])
    const data = compute(PRACTICE, session, race, FULL)
    expect(rowOf(data, 0).interval).toBeNull()
    expect(rowOf(data, 1).interval).toEqual({ kind: 'time', seconds: 0.377 })
    expect(rowOf(data, 1).gapToLeader).toEqual({ kind: 'time', seconds: 0.377 })
    expect(rowOf(data, 2).interval).toBeNull()
    expect(rowOf(data, 2).gapToLeader).toBeNull()
    // The car ahead has no time: no interval, but the gap to the leader is known.
    expect(rowOf(data, 3).interval).toBeNull()
    expect(rowOf(data, 3).gapToLeader).toEqual({ kind: 'time', seconds: 0.877 })
    expect(rowOf(data, 0).bestLap).toBe(90.123)
  })

  it('computes only the gaps a visible column shows', () => {
    const race = makeRace(field(3))
    const noGaps = compute(RACE, session, race, hide(FULL, 'gap', 'gapLeader'))
    expect(block(noGaps).rows.every((r) => r.interval === null && r.gapToLeader === null)).toBe(
      true
    )
    const leaderOnly = compute(RACE, session, race, hide(FULL, 'gap'))
    expect(rowOf(leaderOnly, 2)).toMatchObject({
      interval: null,
      gapToLeader: { kind: 'time', seconds: 2 }
    })
    // 'gap' follows the display-only gapMode: both are sent.
    const gapOnly = compute(RACE, session, race, hide(FULL, 'gapLeader'))
    expect(rowOf(gapOnly, 2)).toMatchObject({
      interval: { kind: 'time', seconds: 1 },
      gapToLeader: { kind: 'time', seconds: 2 }
    })
  })
})

describe('last laps', () => {
  const session = makeSession(drivers(6))

  it('purple for the class best, green for a personal best', () => {
    const race = makeRace([
      { carIdx: 0, classPosition: 1, bestLapTime: 90, lastLapTime: 90 },
      { carIdx: 1, classPosition: 2, bestLapTime: 91, lastLapTime: 91.0004 },
      { carIdx: 2, classPosition: 3, bestLapTime: 92, lastLapTime: 93.5 },
      { carIdx: 3, classPosition: 4, bestLapTime: 92.5, lastLapTime: null },
      // Same time as the class best but not its own best (stale best): nothing special.
      { carIdx: 4, classPosition: 5, bestLapTime: 94, lastLapTime: 90 }
    ])
    const data = compute(PRACTICE, session, race, FULL)
    expect(block(data).rows.map((r) => r.lastLapKind)).toEqual([
      'class-best',
      'personal-best',
      'normal',
      'normal',
      'normal'
    ])
    expect(rowOf(data, 1).lastLap).toBe(91)
    expect(rowOf(data, 3).lastLap).toBeNull()
  })

  it("prefers the sim's own last lap time over the model-timed one", () => {
    const race = makeRace([
      { carIdx: 0, classPosition: 1, bestLapTime: 90.25, lastLapTime: 90.26 },
      { carIdx: 1, classPosition: 2, bestLapTime: 91, lastLapTime: 95.5 }
    ])
    const frame = makeFrame({ lastLaps: { 0: 90.2501, 1: -1 } })
    const data = compute(frame, session, race, FULL)
    expect(rowOf(data, 0).lastLap).toBe(90.25)
    expect(rowOf(data, 0).lastLapKind).toBe('class-best')
    // No official time: the model's.
    expect(rowOf(data, 1).lastLap).toBe(95.5)
  })

  it("keeps a finisher's last lap at its finishing lap, whatever the cool-down lap reads", () => {
    const race = makeRace([{ carIdx: 0, classPosition: 1, finished: true, lastLapTime: 90.5 }])
    const data = compute(makeFrame({ lastLaps: { 0: 140.2 } }), session, race, FULL)
    expect(rowOf(data, 0).lastLap).toBe(90.5)
  })
})

describe('positions gained', () => {
  const session = makeSession(drivers(4), {
    grid: new Map([
      [0, { position: 3, classPosition: 3 }],
      [1, { position: 1, classPosition: 1 }],
      [3, { position: 2, classPosition: 2 }]
    ])
  })
  const race = makeRace([...field(3), { carIdx: 3, classPosition: 0 }])

  it('grid class position minus the current one in races', () => {
    const data = compute(RACE, session, race, FULL)
    expect(rowOf(data, 0).positionsGained).toBe(2)
    expect(rowOf(data, 1).positionsGained).toBe(-1)
    // Not on the grid / not classified.
    expect(rowOf(data, 2).positionsGained).toBeNull()
    expect(rowOf(data, 3).positionsGained).toBeNull()
  })

  it('null outside races', () => {
    const data = compute(PRACTICE, session, race, FULL)
    expect(block(data).rows.every((r) => r.positionsGained === null)).toBe(true)
  })
})

describe('status, pits and penalties', () => {
  it('finished > disconnected > pits > off-track > running, penalty flags as badges', () => {
    const session = makeSession(drivers(7))
    const race = makeRace([
      { carIdx: 0, classPosition: 1, disconnected: true, inPits: true },
      {
        carIdx: 1,
        classPosition: 2,
        inPits: true,
        offTrack: true,
        sessionFlags: SessionFlag.Repair
      },
      {
        carIdx: 2,
        classPosition: 3,
        offTrack: true,
        sessionFlags: SessionFlag.Black | SessionFlag.Repair
      },
      { carIdx: 3, classPosition: 4, sessionFlags: SessionFlag.Green },
      {
        carIdx: 4,
        classPosition: 5,
        pitStops: 2,
        lastPitLap: 12,
        outLap: true,
        sessionFlags: SessionFlag.Black
      },
      // A finisher in the pits after the flag is still finished.
      { carIdx: 5, classPosition: 6, finished: true, inPits: true, offTrack: true },
      { carIdx: 6, classPosition: 7, sessionFlags: SessionFlag.Disqualify }
    ])
    const rows = block(compute(RACE, session, race, FULL)).rows
    expect(rows.map((r) => r.status)).toEqual([
      'disconnected',
      'pits',
      'off-track',
      'running',
      'running',
      'finished',
      'running'
    ])
    expect(rows.map((r) => r.penalty)).toEqual([
      null,
      'meatball',
      'black',
      null,
      'black',
      null,
      'black'
    ])
    expect(rows[4]).toMatchObject({ pitStops: 2, lastPitLap: 12, outLap: true })
    expect(rows[0]).toMatchObject({ pitStops: 0, lastPitLap: null, outLap: false })
  })

  it('driver fields from the session YAML', () => {
    const session = makeSession([
      makeDriver(0, { userName: 'Ana López', carNumber: '07', licString: '', licColor: null }),
      makeDriver(1, { iRating: 0 })
    ])
    const data = compute(RACE, session, makeRace(field(2)), FULL)
    expect(rowOf(data, 0)).toMatchObject({
      driverName: 'Ana López',
      carNumber: '07',
      classColor: '#ffda59',
      iRating: 2000,
      licString: null,
      licColor: null,
      isPlayer: true
    })
    expect(rowOf(data, 1)).toMatchObject({ iRating: null, licString: 'B 3.12', isPlayer: false })
  })
})

// ---------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------

describe('iRating', () => {
  const list = [
    ...drivers(4, 0, { classId: 1, classRelSpeed: 50 }),
    makeDriver(4, { classId: 1, iRating: 0 }),
    // Registered but never in the world: a non-starter.
    makeDriver(5, { classId: 1, iRating: 1800 }),
    ...drivers(3, 10, { classId: 2, classRelSpeed: 90 })
  ]
  const session = makeSession(list)
  const cars: FakeCar[] = [
    { carIdx: 0, classPosition: 2 },
    { carIdx: 1, classPosition: 1 },
    { carIdx: 2, classPosition: 0 },
    { carIdx: 3, classPosition: 3 },
    { carIdx: 4, classPosition: 4 },
    ...field(3, 10)
  ]

  it('is projected per class over the registered field, at each class position', () => {
    const data = compute(RACE, session, makeRace(cars), FULL)
    expect(iRatingDeltas).toHaveBeenCalledTimes(2)
    // By carIdx; iRating 0 left out; never classified (2) or never seen (5): non-starters.
    expect(vi.mocked(iRatingDeltas).mock.calls[0]?.[0]).toEqual([
      { carIdx: 0, iRating: 2000, position: 2, started: true },
      { carIdx: 1, iRating: 2001, position: 1, started: true },
      { carIdx: 2, iRating: 2002, position: 4, started: false },
      { carIdx: 3, iRating: 2003, position: 3, started: true },
      { carIdx: 5, iRating: 1800, position: 5, started: false }
    ])
    expect(vi.mocked(iRatingDeltas).mock.calls[1]?.[0].map((e) => e.carIdx)).toEqual([10, 11, 12])
    const rows = data.classes.flatMap((b) => b.rows)
    for (const r of rows.filter((x) => x.carIdx !== 4))
      expect(Number.isInteger(r.iRatingDelta)).toBe(true)
    expect(rowOf(data, 4).iRatingDelta).toBeNull()
    // Leader gains more than P2, the non-starter loses.
    expect(rowOf(data, 1).iRatingDelta ?? 0).toBeGreaterThan(rowOf(data, 0).iRatingDelta ?? 0)
    expect(rowOf(data, 2).iRatingDelta ?? 0).toBeLessThan(0)
    // The header agrees with the player's row.
    expect(data.header.iRating?.iRatingDelta).toBe(rowOf(data, 0).iRatingDelta)
    expect(data.header.iRating?.perPosition).toBe(Math.round((198 / 3) * 10) / 10)
    expect(playerProjection).toHaveBeenCalledTimes(1)
  })

  it("shows the others' change only with the delta column and 'Δ iRating de todos'", () => {
    const race = makeRace(cars)
    const mine = compute(RACE, session, race, { ...FULL, iRatingDeltaAll: false })
    expect(rowOf(mine, 0).iRatingDelta).not.toBeNull()
    expect(rowOf(mine, 1).iRatingDelta).toBeNull()
    expect(rowOf(mine, 10).iRatingDelta).toBeNull()
    const hidden = compute(RACE, session, race, hide(FULL, 'delta'))
    expect(rowOf(hidden, 0).iRatingDelta).not.toBeNull()
    expect(rowOf(hidden, 1).iRatingDelta).toBeNull()
    // Other classes are not even projected when no row of theirs shows it.
    provider.reset()
    vi.mocked(iRatingDeltas).mockClear()
    compute(RACE, session, race, { ...FULL, iRatingDeltaAll: false, mode: 'full' })
    expect(vi.mocked(iRatingDeltas).mock.calls.map((c) => c[0][0]?.carIdx)).toEqual([0])
  })

  it('is not computed outside races, but the strength of field is', () => {
    const data = compute(PRACTICE, session, makeRace(cars), FULL)
    expect(iRatingDeltas).not.toHaveBeenCalled()
    expect(data.classes.flatMap((b) => b.rows).every((r) => r.iRatingDelta === null)).toBe(true)
    expect(data.header.iRating).toBeNull()
    expect(block(data).sof).toBeGreaterThan(1800)
    expect(block(data).sof).toBeLessThan(2010)
  })

  it('is not computed where iRating cannot change (test drive, hosted, league, AI)', () => {
    for (const o of [
      { official: false, eventType: 'Test' },
      { official: false, eventType: 'Race' },
      { official: true, eventType: 'Test' }
    ]) {
      const data = compute(RACE, makeSession(list, o), makeRace(cars), FULL)
      expect(data.header.iRating).toBeNull()
      expect(data.header.safetyRating).toBeNull()
      expect(data.classes.flatMap((b) => b.rows).every((r) => r.iRatingDelta === null)).toBe(true)
    }
    expect(iRatingDeltas).not.toHaveBeenCalled()
    expect(projectSessionSafetyRating).not.toHaveBeenCalled()
  })

  it('is not computed when neither the column nor the header shows it', () => {
    const opts = { ...hide(FULL, 'delta'), headerIRating: false }
    const data = compute(RACE, session, makeRace(cars), opts)
    expect(iRatingDeltas).not.toHaveBeenCalled()
    expect(rowOf(data, 0).iRatingDelta).toBeNull()
    expect(data.header.iRating).toBeNull()
    // The column alone: rows, no header.
    const column = compute(RACE, session, makeRace(cars), { ...FULL, headerIRating: false })
    expect(column.header.iRating).toBeNull()
    expect(rowOf(column, 0).iRatingDelta).not.toBeNull()
  })

  it('is recomputed only when the field of a class changes', () => {
    compute(RACE, session, makeRace(cars), FULL)
    compute(RACE, session, makeRace(cars), FULL)
    compute(RACE, session, makeRace(cars), OPTS)
    expect(iRatingDeltas).toHaveBeenCalledTimes(2)

    // Cars 10 and 11 swap: only their class is recomputed.
    const swapped = cars.map((c) =>
      c.carIdx === 10
        ? { ...c, classPosition: 2 }
        : c.carIdx === 11
          ? { ...c, classPosition: 1 }
          : c
    )
    compute(RACE, session, makeRace(swapped), FULL)
    expect(iRatingDeltas).toHaveBeenCalledTimes(3)

    // A new iRating in the YAML (same order) counts as a change.
    const s2 = makeSession(list.map((d) => (d.carIdx === 12 ? { ...d, iRating: 3000 } : d)))
    compute(RACE, s2, makeRace(swapped), FULL)
    expect(iRatingDeltas).toHaveBeenCalledTimes(4)

    // reset() forgets the cache.
    provider.reset()
    compute(RACE, s2, makeRace(swapped), FULL)
    expect(iRatingDeltas).toHaveBeenCalledTimes(6)
  })

  it('reports the neutral position: the last one that does not lose iRating', () => {
    const even = makeSession(drivers(12, 0, { iRating: 1500 }))
    const data = compute(RACE, even, makeRace(field(12), { playerCarIdx: 3 }), FULL)
    const ir = data.header.iRating
    expect(ir?.breakEvenPosition).toBeGreaterThanOrEqual(6)
    expect(ir?.breakEvenPosition).toBeLessThanOrEqual(7)
    // The row at that position does not lose; the next one does.
    const at = rowOf(data, (ir?.breakEvenPosition ?? 0) - 1).iRatingDelta ?? -1
    const next = rowOf(data, ir?.breakEvenPosition ?? 0).iRatingDelta ?? 0
    expect(at).toBeGreaterThanOrEqual(0)
    expect(next).toBeLessThan(0)
  })
})

describe('header', () => {
  const session = makeSession(drivers(3), { trackNumTurns: 17 })

  it('session type, laps and time left, projected SR over the whole race', () => {
    const race = makeRace(field(3, 0, { distance: 3.5 }), {
      lapsRemaining: 7,
      timeRemainingS: 754.8,
      playerDistanceDriven: 3.5,
      playerIncidents: 4
    })
    const data = compute(RACE, session, race, OPTS)
    expect(data.header.sessionType).toBe('Race')
    expect(data.header.lapsRemaining).toBe(7)
    expect(data.header.timeRemainingS).toBe(754)
    // 7 laps left including the half-driven current one: 6.5 laps still to drive.
    expect(projectSessionSafetyRating).toHaveBeenCalledWith({
      licLevel: 12,
      licSubLevel: 312,
      incidents: 4,
      corners: 59,
      totalCorners: Math.floor(17 * (3.5 + 6.5)),
      sessionType: 'Race'
    })
    expect(data.header.safetyRating).toMatchObject({ current: 3.12, incidents: 4, corners: 59 })
  })

  it('practice: the SR margin is "if you stopped now", even with the laps left known', () => {
    const race = makeRace(field(3, 0, { distance: 3.5 }), {
      lapsRemaining: 7,
      playerDistanceDriven: 3.5
    })
    compute(PRACTICE, session, race, OPTS)
    expect(vi.mocked(projectSessionSafetyRating).mock.calls[0]?.[0]).toMatchObject({
      sessionType: 'Practice',
      corners: 59,
      totalCorners: null
    })
  })

  it('unknown values are null, and the SR is only projected again when its inputs change', () => {
    const race = makeRace(field(3))
    const a = compute(PRACTICE, session, race, OPTS)
    const b = compute(PRACTICE, session, race, OPTS)
    expect(a.header).toMatchObject({
      sessionType: 'Practice',
      lapsRemaining: null,
      timeRemainingS: null,
      iRating: null
    })
    expect(vi.mocked(projectSessionSafetyRating).mock.calls[0]?.[0].totalCorners).toBeNull()
    expect(projectSessionSafetyRating).toHaveBeenCalledTimes(1)
    expect(b.header.safetyRating).toBe(a.header.safetyRating)
    compute(PRACTICE, session, makeRace(field(3), { playerIncidents: 1 }), OPTS)
    expect(projectSessionSafetyRating).toHaveBeenCalledTimes(2)
    provider.reset()
    compute(PRACTICE, session, makeRace(field(3), { playerIncidents: 1 }), OPTS)
    expect(projectSessionSafetyRating).toHaveBeenCalledTimes(3)
  })

  it('no SR without the SR header or a player entry', () => {
    const race = makeRace(field(3))
    expect(
      compute(RACE, session, race, { ...OPTS, headerSafetyRating: false }).header.safetyRating
    ).toBeNull()
    const spectator = makeRace(field(3), { playerCarIdx: 42 })
    expect(
      compute(RACE, makeSession(drivers(3), { playerCarIdx: 42 }), spectator, OPTS).header
        .safetyRating
    ).toBeNull()
    expect(projectSessionSafetyRating).not.toHaveBeenCalled()
    // The iRating line has its own toggle.
    const noIr = compute(RACE, session, race, { ...OPTS, headerIRating: false })
    expect(noIr.header.iRating).toBeNull()
    expect(noIr.header.safetyRating).not.toBeNull()
  })

  it("team races: the user's own licence, kept while a teammate drives", () => {
    const team = makeSession(drivers(3), { teamRacing: true })
    const race = makeRace(field(3))
    compute(RACE, team, race, OPTS)
    const teammate = makeSession(
      [makeDriver(0, { licLevel: 20, licSubLevel: 450 }), ...drivers(2, 1)],
      { teamRacing: true }
    )
    const later = makeRace(field(3), { playerIncidents: 2 })
    compute(makeFrame({ onTrack: false }), teammate, later, OPTS)
    expect(projectSessionSafetyRating).toHaveBeenCalledTimes(2)
    expect(vi.mocked(projectSessionSafetyRating).mock.calls[1]?.[0]).toMatchObject({
      licLevel: 12,
      licSubLevel: 312,
      incidents: 2
    })
    // Solo races: the entry is always the user.
    const solo = makeSession([...teammate.drivers.values()], { teamRacing: false })
    compute(makeFrame({ onTrack: false }), solo, later, OPTS)
    expect(vi.mocked(projectSessionSafetyRating).mock.calls[2]?.[0]).toMatchObject({
      licLevel: 20,
      licSubLevel: 450
    })
  })

  it('rounds the laps left up and never shows negative time', () => {
    const race = makeRace(field(3), { lapsRemaining: 4.2, timeRemainingS: -1 })
    const h = compute(RACE, session, race, OPTS).header
    expect(h.lapsRemaining).toBe(5)
    expect(h.timeRemainingS).toBe(0)
  })
})

describe('performance', () => {
  it('a full 72-car multiclass table takes well under 1 ms', () => {
    const list = [
      ...drivers(24, 0, { classId: 1, classRelSpeed: 50 }),
      ...drivers(24, 24, { classId: 2, classRelSpeed: 80 }),
      ...drivers(24, 48, { classId: 3, classRelSpeed: 100 })
    ]
    const session = makeSession(list, { playerCarIdx: 10 })
    const race = makeRace([...field(24, 0), ...field(24, 24), ...field(24, 48)], {
      playerCarIdx: 10
    })
    compute(RACE, session, race, FULL)
    const runs = 200
    const t0 = performance.now()
    for (let i = 0; i < runs; i++) compute(RACE, session, race, FULL)
    const perRun = (performance.now() - t0) / runs
    expect(perRun).toBeLessThan(1)
  })
})

describe('best lap, stints, tyres and warnings', () => {
  it("marks each class's fastest best lap", () => {
    const session = makeSession([
      ...drivers(3, 0),
      ...drivers(2, 10, { classId: 2, classRelSpeed: 90 })
    ])
    const race = makeRace([
      { carIdx: 0, classPosition: 1, bestLapTime: 90.5 },
      { carIdx: 1, classPosition: 2, bestLapTime: 90.2 },
      { carIdx: 2, classPosition: 3, bestLapTime: null },
      { carIdx: 10, classPosition: 1, bestLapTime: 80 },
      { carIdx: 11, classPosition: 2, bestLapTime: 79.9 }
    ])
    const data = compute(RACE, session, race, FULL)
    const kinds = [0, 1, 2, 10, 11].map((i) => rowOf(data, i).bestLapKind)
    expect(kinds).toEqual(['normal', 'class-best', 'normal', 'normal', 'class-best'])
  })

  it('sends the stint only for the stint column, the last stop always', () => {
    const session = makeSession(drivers(2))
    const race = makeRace([
      { carIdx: 0, classPosition: 1, stintLaps: 7, pitStops: 1, lastPitLap: 9 },
      { carIdx: 1, classPosition: 2, stintLaps: 16 }
    ])
    const shown = compute(RACE, session, race, FULL)
    expect(rowOf(shown, 0)).toMatchObject({ stintLaps: 7, lastPitLap: 9 })
    expect(rowOf(shown, 1).stintLaps).toBe(16)
    // Every car's stint grows each lap: without the column the table is not re-sent for it.
    const hidden = compute(RACE, session, race, hide(FULL, 'stint'))
    expect(rowOf(hidden, 0)).toMatchObject({ stintLaps: null, lastPitLap: 9 })
  })

  it('names the tyres of your car model for the tyre column only', () => {
    const session = makeSession([...drivers(2), makeDriver(2, { carId: 128 })], {
      tyreCompounds: new Map([
        [0, 'Hard'],
        [1, 'Wet']
      ])
    })
    const compounds = new Array<number>(MAX_CARS).fill(-1)
    compounds[0] = 0
    compounds[1] = 1
    compounds[2] = 1
    const frame: TelemetryFrame = { ...RACE, CarIdxTireCompound: compounds }
    const race = makeRace(field(3))
    const data = compute(frame, session, race, FULL)
    expect([0, 1, 2].map((i) => rowOf(data, i).tyre)).toEqual(['Hard', 'Wet', null])
    const hidden = compute(frame, session, race, hide(FULL, 'tyre'))
    expect(hidden.classes.flatMap((b) => b.rows).every((r) => r.tyre === null)).toBe(true)
  })

  it('badges the furled black flag as a warning, under the black flag and the meatball', () => {
    const session = makeSession(drivers(3))
    const race = makeRace([
      // 0x80000000 makes the bit field a negative Int32, as the SDK sends it.
      { carIdx: 0, classPosition: 1, sessionFlags: SessionFlag.Furled | 0x80000000 },
      { carIdx: 1, classPosition: 2, sessionFlags: SessionFlag.Furled | SessionFlag.Repair },
      { carIdx: 2, classPosition: 3, sessionFlags: SessionFlag.Furled | SessionFlag.Black }
    ])
    const rows = block(compute(RACE, session, race, FULL)).rows
    expect(rows.map((r) => r.penalty)).toEqual(['furled', 'meatball', 'black'])
  })
})
