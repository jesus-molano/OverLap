import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BATTLE, BattleProvider, battleEqual, gapSlope } from './battle'
import { SessionFlag } from './flags'
import { NO_INCIDENT_LIMITS } from './incidents/limits'
import type { LapRecord, RaceCarState, RaceView } from './race/raceView'
import { makeFrame } from './race/testing/raceSim'
import { iRatingDeltas } from './ratings/irating'
import { createDefaultSettings } from './settings'
import type {
  BattleData,
  BattleLaneId,
  BattleOptions,
  BattlePartId,
  BattleRowId,
  DriverEntry,
  ElementEntry,
  SessionMeta
} from './types'

// The real projection, wrapped to count calls and to make it fail once.
vi.mock('./ratings/irating', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ratings/irating')>()
  return { ...actual, iRatingDeltas: vi.fn(actual.iRatingDeltas) }
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type Sample = { distance: number; gap: number; clean: boolean }

const key = (behind: number, ahead: number): string => `${behind}>${ahead}`

class FakeRace implements RaceView {
  sessionTime = 1000
  sessionKey = 'test'
  racing = true
  playerCarIdx = 0
  timeRemainingS: number | null = null
  playerDistanceDriven = 10
  playerIncidents = 0
  readonly states = new Map<number, RaceCarState>()
  /** timeGap by `behind>ahead`. */
  readonly gaps = new Map<string, number>()
  readonly histories = new Map<string, Sample[]>()
  /** Sector times by `carIdx@lap`. */
  readonly sectors = new Map<string, number[]>()
  readonly remaining = new Map<number, number>()

  add(...cars: RaceCarState[]): this {
    for (const c of cars) this.states.set(c.carIdx, c)
    return this
  }
  set(carIdx: number, o: Partial<RaceCarState>): void {
    const c = this.states.get(carIdx)
    if (c) this.states.set(carIdx, { ...c, ...o })
  }
  car(carIdx: number): RaceCarState | undefined {
    return this.states.get(carIdx)
  }
  cars(): readonly RaceCarState[] {
    return [...this.states.values()]
  }
  timeGap(behind: number, ahead: number): number | null {
    return this.gaps.get(key(behind, ahead)) ?? null
  }
  lapsBehind(behind: number, ahead: number): number {
    const d = Math.floor((this.car(ahead)?.distance ?? NaN) - (this.car(behind)?.distance ?? NaN))
    return d > 0 ? d : 0
  }
  gapHistory(behind: number, ahead: number): readonly Sample[] {
    return this.histories.get(key(behind, ahead)) ?? []
  }
  lastLapSectors(carIdx: number): readonly number[] | null {
    const lap = this.car(carIdx)?.laps[0]?.lap
    return lap === undefined ? null : this.lapSectors(carIdx, lap)
  }
  lapSectors(carIdx: number, lap: number): readonly number[] | null {
    return this.sectors.get(`${carIdx}@${lap}`) ?? null
  }
  lapsRemaining(carIdx: number): number | null {
    return this.remaining.get(carIdx) ?? null
  }
  currentLap(): null {
    return null
  }
  lapProfile(): null {
    return null
  }
}

function makeCar(carIdx: number, o: Partial<RaceCarState> = {}): RaceCarState {
  return {
    carIdx,
    distance: 10.5,
    classPosition: carIdx + 1,
    overallPosition: carIdx + 1,
    inWorld: true,
    inPits: false,
    offTrack: false,
    disconnected: false,
    finished: false,
    pitStops: 0,
    towStops: 0,
    towed: false,
    towedAt: NaN,
    lastPitLap: null,
    outLap: false,
    stintLaps: 10,
    lastLapTime: null,
    bestLapTime: null,
    laps: [],
    pace: null,
    speed: 0,
    stoppedForS: 0,
    lapInvalid: false,
    sessionFlags: 0,
    ...o
  }
}

function makeDriver(carIdx: number, o: Partial<DriverEntry> = {}): DriverEntry {
  return {
    carIdx,
    userName: `Piloto ${carIdx}`,
    teamName: '',
    carNumber: String(carIdx + 10),
    iRating: 2000,
    licString: 'A 3.50',
    licColor: '#0153db',
    classId: 1,
    classShortName: 'MX5',
    classColor: '#ffda59',
    classEstLapTime: 100,
    isPaceCar: false,
    isSpectator: false,
    licLevel: 20,
    licSubLevel: 350,
    classRelSpeed: 10,
    userId: 500 + carIdx,
    teamId: 0,
    carId: 67,
    carName: 'Porsche 911 GT3 R',
    isAI: false,
    brand: 'unknown',
    country: '',
    ...o
  }
}

function makeSession(list: DriverEntry[], o: Partial<SessionMeta> = {}): SessionMeta {
  return {
    playerCarIdx: 0,
    paceCarIdx: -1,
    driverCarEstLapTime: 100,
    trackLengthM: 5000,
    trackName: 'Test',
    drivers: new Map(list.map((d) => [d.carIdx, d])),
    tyreCompounds: new Map(),
    sessionTypes: new Map([[0, 'Race']]),
    sessions: new Map(),
    subSessionId: 1,
    eventType: 'Race',
    official: true,
    trackNumTurns: 12,
    sectorStarts: [0, 0.33, 0.66],
    grid: new Map(),
    teamRacing: false,
    pitSpeedLimitKmh: null,
    trackId: 1,
    trackConfig: '',
    incidentLimits: NO_INCIDENT_LIMITS,
    ...o
  }
}

const OPTS: BattleOptions = { ...createDefaultSettings().battle, thresholdS: 1.5, holdS: 0 }

/** The options with these lanes, rows or parts hidden. */
function hiding(o: {
  lanes?: readonly BattleLaneId[]
  rows?: readonly BattleRowId[]
  parts?: readonly BattlePartId[]
}): BattleOptions {
  const hide = <Id extends string>(
    list: ElementEntry<Id>[],
    ids: readonly Id[] = []
  ): ElementEntry<Id>[] => list.map((e) => ({ ...e, visible: e.visible && !ids.includes(e.id) }))
  return {
    ...OPTS,
    lanes: hide(OPTS.lanes, o.lanes),
    rows: hide(OPTS.rows, o.rows),
    parts: hide(OPTS.parts, o.parts)
  }
}

/**
 * Class 1: car 1 (P1) 0.8 s ahead of the player (car 0, P2), car 2 (P3) 1.2 s behind, 10 laps
 * left at mid-lap. Class 2 has cars 3 (P1) and 4 (P3) that must never be picked.
 */
function scenario(): { race: FakeRace; session: SessionMeta } {
  const race = new FakeRace().add(
    makeCar(3, { classPosition: 1, distance: 10.7 }),
    makeCar(4, { classPosition: 3, distance: 10.4 }),
    makeCar(1, { classPosition: 1, distance: 10.51 }),
    makeCar(0, { classPosition: 2, distance: 10.5 }),
    makeCar(2, { classPosition: 3, distance: 10.49 })
  )
  race.gaps.set(key(0, 1), 0.84)
  race.gaps.set(key(2, 0), 1.23)
  race.gaps.set(key(0, 3), 0.3)
  race.gaps.set(key(4, 0), 0.3)
  race.remaining.set(0, 10)
  const session = makeSession([
    makeDriver(0),
    makeDriver(1, { iRating: 2100 }),
    makeDriver(2, { iRating: 1900 }),
    makeDriver(3, { classId: 2 }),
    makeDriver(4, { classId: 2 })
  ])
  return { race, session }
}

/** Linear gap history over the 2 laps before `toDistance`, every 0.05 lap. */
function linearHistory(toDistance: number, gapAtEnd: number, slope: number): Sample[] {
  const out: Sample[] = []
  for (let k = 40; k >= 0; k--) {
    const distance = toDistance - k * 0.05
    out.push({ distance, gap: gapAtEnd + slope * (distance - toDistance), clean: true })
  }
  return out
}

/** Laps 10, 9, 8... most recent first. */
function laps(...times: number[]): LapRecord[] {
  return times.map((time, i) => ({ lap: 10 - i, time, clean: true }))
}

let battle: BattleProvider
beforeEach(() => {
  vi.mocked(iRatingDeltas).mockClear()
  battle = new BattleProvider()
})

function compute(
  session: SessionMeta,
  race: RaceView,
  opts: BattleOptions = OPTS,
  prev: BattleData | null = null
): BattleData {
  return battle.compute(session, race, opts, prev)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('gapSlope', () => {
  it('fits the least-squares slope of the clean samples', () => {
    expect(gapSlope(linearHistory(20, 1, -0.25), 0.5)).toBeCloseTo(-0.25, 10)
  })

  it('needs two clean samples spanning the minimum distance', () => {
    expect(gapSlope([], 0.5)).toBeNull()
    expect(gapSlope([{ distance: 5, gap: 1, clean: true }], 0.5)).toBeNull()
    const short = linearHistory(20, 1, -0.25).filter((s) => s.distance >= 19.6)
    expect(gapSlope(short, 0.5)).toBeNull()
    expect(gapSlope(short, 0.3)).toBeCloseTo(-0.25, 10)
  })

  it('ignores unclean and non-finite samples', () => {
    const samples = linearHistory(20, 1, 0.1).map((s, i) =>
      i % 3 === 0 ? { ...s, gap: s.gap + 5, clean: false } : s
    )
    samples.push({ distance: 20.01, gap: NaN, clean: true })
    expect(gapSlope(samples, 0.5)).toBeCloseTo(0.1, 10)
  })
})

describe('opponents and visibility', () => {
  it('shows the class neighbours within the threshold', () => {
    const { race, session } = scenario()
    const d = compute(session, race)
    expect(d.visible).toBe(true)
    expect(d.lapsRemaining).toBe(10)
    expect(d.ahead).toMatchObject({
      carIdx: 1,
      carNumber: '11',
      driverName: 'Piloto 1',
      classColor: '#ffda59',
      iRating: 2100,
      licString: 'A 3.50',
      licColor: '#0153db',
      gapS: 0.8,
      inPits: false
    })
    expect(d.behind).toMatchObject({ carIdx: 2, gapS: 1.2, iRating: 1900 })
  })

  it('flags an opponent on pit road', () => {
    const { race, session } = scenario()
    race.set(1, { inPits: true })
    expect(compute(session, race).ahead?.inPits).toBe(true)
  })

  it('gives a rival its flag badge, as the relative does (R08)', () => {
    const { race, session } = scenario()
    expect(compute(session, race).ahead?.penalty).toBeNull()
    race.set(1, { sessionFlags: SessionFlag.Black })
    expect(compute(session, race).ahead?.penalty).toBe('black')
    race.set(2, { sessionFlags: SessionFlag.Repair })
    expect(compute(session, race).behind?.penalty).toBe('meatball')
  })

  it('hides opponents above the threshold', () => {
    const { race, session } = scenario()
    const one = compute(session, race, { ...OPTS, thresholdS: 1 })
    expect(one.ahead?.carIdx).toBe(1)
    expect(one.behind).toBeNull()
    expect(one.visible).toBe(true)
    const none = compute(session, race, { ...OPTS, thresholdS: 0.5 })
    expect(none).toMatchObject({ visible: false, ahead: null, behind: null, lapsRemaining: 10 })
  })

  it('keeps a shown opponent until the gap exceeds the threshold by the hysteresis', () => {
    const { race, session } = scenario()
    const shown = compute(session, race)
    expect(shown.behind?.carIdx).toBe(2)
    race.gaps.set(key(2, 0), 1.7)
    // Not shown before: 1.7 s is over the threshold.
    expect(compute(session, race).behind).toBeNull()
    // Shown last time: it stays up to 1.5 + 0.3 s...
    const kept = compute(session, race, OPTS, shown)
    expect(kept.behind).toMatchObject({ carIdx: 2, gapS: 1.7 })
    race.gaps.set(key(2, 0), 1.9)
    expect(compute(session, race, OPTS, kept).behind).toBeNull()
    // ...but only for the same car.
    race.gaps.set(key(2, 0), 1.7)
    const other = { ...shown, behind: shown.behind && { ...shown.behind, carIdx: 7 } }
    expect(compute(session, race, OPTS, other).behind).toBeNull()
  })

  it('"Mantener visible": a shown opponent stays holdS seconds after leaving the threshold', () => {
    const { race, session } = scenario()
    const opts = { ...OPTS, holdS: 3 }
    let prev = compute(session, race, opts)
    race.gaps.set(key(2, 0), 2.5)
    for (const t of [1000.25, 1001, 1002.9]) {
      race.sessionTime = t
      prev = compute(session, race, opts, prev)
      expect(prev.behind, `t=${t}`).toMatchObject({ carIdx: 2, gapS: 2.5 })
    }
    race.sessionTime = 1003.3
    prev = compute(session, race, opts, prev)
    expect(prev.behind).toBeNull()
    // Gone: it needs to come back inside the threshold to show again.
    race.sessionTime = 1003.5
    expect(compute(session, race, opts, prev).behind).toBeNull()
  })

  it('restarts the hold when the gap comes back inside, and when the clock goes back', () => {
    const { race, session } = scenario()
    const opts = { ...OPTS, holdS: 2 }
    let prev = compute(session, race, opts)
    race.gaps.set(key(2, 0), 2.5)
    race.sessionTime = 1001.5
    prev = compute(session, race, opts, prev)
    race.gaps.set(key(2, 0), 1.2)
    race.sessionTime = 1001.8
    prev = compute(session, race, opts, prev)
    race.gaps.set(key(2, 0), 2.5)
    race.sessionTime = 1003
    prev = compute(session, race, opts, prev)
    // 0.6 s into the new hold; counted from 1001.5 it would have ended.
    race.sessionTime = 1003.6
    expect(compute(session, race, opts, prev).behind?.carIdx).toBe(2)
    // A replay jumps back: the hold starts over rather than lasting forever or ending at once.
    race.sessionTime = 900
    prev = compute(session, race, opts, prev)
    expect(prev.behind?.carIdx).toBe(2)
    race.sessionTime = 902.5
    expect(compute(session, race, opts, prev).behind).toBeNull()
  })

  it('falls back to the default threshold for an invalid one', () => {
    const { race, session } = scenario()
    race.gaps.set(key(2, 0), 1.6)
    const d = compute(session, race, { ...OPTS, thresholdS: NaN })
    expect(d.ahead?.carIdx).toBe(1)
    expect(d.behind).toBeNull()
  })

  it('respects the lanes shown', () => {
    const { race, session } = scenario()
    const noAhead = compute(session, race, hiding({ lanes: ['ahead'] }))
    expect(noAhead.ahead).toBeNull()
    expect(noAhead.behind?.carIdx).toBe(2)
    const noBehind = compute(session, race, hiding({ lanes: ['behind'] }))
    expect(noBehind.ahead?.carIdx).toBe(1)
    expect(noBehind.behind).toBeNull()
    const neither = compute(session, race, hiding({ lanes: ['ahead', 'behind'] }))
    expect(neither.visible).toBe(false)
  })

  it('has no car ahead when leading the class', () => {
    const { race, session } = scenario()
    race.set(1, { classPosition: 2 })
    race.set(0, { classPosition: 1 })
    // An unclassified class car (position 0) is not "ahead" of the leader.
    race.add(makeCar(5, { classPosition: 0 }))
    session.drivers = new Map([...session.drivers, [5, makeDriver(5)]])
    race.gaps.set(key(0, 5), 0.2)
    expect(compute(session, race).ahead).toBeNull()
  })

  it('drops an opponent that is not on the same lap or has no gap', () => {
    const { race, session } = scenario()
    race.set(1, { distance: 11.6 })
    race.gaps.delete(key(2, 0))
    const d = compute(session, race)
    expect(d.ahead).toBeNull()
    expect(d.behind).toBeNull()
    expect(d.visible).toBe(false)
  })

  it('drops disconnected and out-of-world opponents', () => {
    const { race, session } = scenario()
    race.set(1, { disconnected: true })
    race.set(2, { inWorld: false })
    expect(compute(session, race).visible).toBe(false)
  })

  it('shows a slightly negative gap as 0 and ignores a large one', () => {
    const { race, session } = scenario()
    race.gaps.set(key(0, 1), -0.2)
    race.gaps.set(key(2, 0), -3)
    const d = compute(session, race)
    expect(d.ahead?.gapS).toBe(0)
    expect(d.behind).toBeNull()
  })

  it('is hidden outside a racing race session, keeping laps left and your laps', () => {
    const { race, session } = scenario()
    race.racing = false
    race.set(0, { laps: laps(95.1) })
    expect(compute(session, race)).toEqual({
      visible: false,
      ahead: null,
      behind: null,
      lapsRemaining: 10,
      playerLastLaps: [95.1],
      multiBrand: false,
      info: null
    })
  })

  it('is hidden when the player is unknown or not classified', () => {
    const { race, session } = scenario()
    race.playerCarIdx = -1
    expect(compute(session, race)).toEqual({
      visible: false,
      ahead: null,
      behind: null,
      lapsRemaining: null,
      playerLastLaps: [],
      multiBrand: false,
      info: null
    })
    race.playerCarIdx = 0
    race.set(0, { classPosition: 0 })
    expect(compute(session, race).visible).toBe(false)
  })

  it('sends the laps left as whole laps, counting the one in progress', () => {
    const { race, session } = scenario()
    race.remaining.set(0, 7.3)
    expect(compute(session, race).lapsRemaining).toBe(8)
    race.remaining.set(0, -1)
    expect(compute(session, race).lapsRemaining).toBe(0)
  })
})

describe('the gap as Relativo (gapStyle, 2.4)', () => {
  /** The tick Relativo reads: you at mid-lap, car 1 0.83 s ahead, car 2 1.23 s behind. */
  function frame(): ReturnType<typeof makeFrame> {
    const f = makeFrame()
    f.PlayerCarIdx[0] = 0
    f.CarIdxLapDistPct[0] = 0.5
    f.CarIdxEstTime[0] = 50
    f.CarIdxLapDistPct[1] = 0.508
    f.CarIdxEstTime[1] = 50.83
    f.CarIdxLapDistPct[2] = 0.49
    f.CarIdxEstTime[2] = 48.77
    return f
  }

  it('sends Relativo’s own signed time only when chosen, in 0.1 s steps', () => {
    const { race, session } = scenario()
    const rel = { ...OPTS, gapStyle: 'relative' as const }
    const d = battle.compute(session, race, rel, null, frame())
    expect(d.ahead).toMatchObject({ gapS: 0.8, relativeGapS: 0.8 })
    expect(d.behind).toMatchObject({ gapS: 1.2, relativeGapS: -1.2 })
    // Measured (the default), or without the tick: not computed.
    expect(battle.compute(session, race, OPTS, null, frame()).ahead?.relativeGapS).toBeNull()
    expect(battle.compute(session, race, rel).ahead?.relativeGapS).toBeNull()
  })

  it('is null for a car Relativo cannot place, and counts in the payload equality', () => {
    const { race, session } = scenario()
    const rel = { ...OPTS, gapStyle: 'relative' as const }
    const f = frame()
    f.CarIdxLapDistPct[2] = -1
    const d = battle.compute(session, race, rel, null, f)
    expect(d.behind?.relativeGapS).toBeNull()
    const e = battle.compute(session, race, rel, null, frame())
    expect(battleEqual(d, e)).toBe(false)
  })
})

describe('after the chequered flag', () => {
  it('is hidden once you have finished: the result is fixed', () => {
    const { race, session } = scenario()
    race.set(0, { finished: true })
    race.remaining.set(0, 0)
    expect(compute(session, race)).toMatchObject({ visible: false, ahead: null, behind: null })
  })

  it('drops a car ahead that has finished, keeps the one behind until you cross', () => {
    const { race, session } = scenario()
    race.set(1, { finished: true })
    const d = compute(session, race)
    expect(d.ahead).toBeNull()
    expect(d.behind?.carIdx).toBe(2)
    expect(d.visible).toBe(true)
  })
})

describe('trend and catch', () => {
  it('ahead: a shrinking gap is a positive trend, with laps to catch', () => {
    const { race, session } = scenario()
    race.gaps.set(key(0, 1), 0.8)
    race.histories.set(key(0, 1), linearHistory(10.5, 0.8, -0.2))
    expect(compute(session, race).ahead).toMatchObject({
      trendSPerLap: 0.2,
      lapsToCatch: 4,
      catchesBeforeEnd: true,
      neededSPerLap: null
    })
  })

  it('ahead: a growing gap is a negative trend and needs a pace to catch', () => {
    const { race, session } = scenario()
    race.gaps.set(key(0, 1), 0.8)
    race.histories.set(key(0, 1), linearHistory(10.5, 0.8, 0.1))
    // 9.5 laps of distance left (10 laps including the current one, at mid-lap).
    expect(compute(session, race).ahead).toMatchObject({
      trendSPerLap: -0.1,
      lapsToCatch: null,
      catchesBeforeEnd: null,
      neededSPerLap: 0.08
    })
  })

  it('ahead: catching too late reports the pace needed', () => {
    const { race, session } = scenario()
    race.gaps.set(key(0, 1), 0.8)
    race.histories.set(key(0, 1), linearHistory(10.5, 0.8, -0.2))
    race.remaining.set(0, 3)
    expect(compute(session, race).ahead).toMatchObject({
      lapsToCatch: 4,
      catchesBeforeEnd: false,
      neededSPerLap: 0.32
    })
  })

  it('sends whole laps to catch but decides "before the end" at full precision', () => {
    const { race, session } = scenario()
    // 0.84 s at 0.2 s/lap: 4.2 laps, shown as 4; 4.1 laps of distance left.
    race.set(0, { distance: 10.9 })
    race.set(1, { distance: 10.91 })
    race.histories.set(key(0, 1), linearHistory(10.9, 0.84, -0.2))
    race.remaining.set(0, 5)
    expect(compute(session, race).ahead).toMatchObject({
      lapsToCatch: 4,
      catchesBeforeEnd: false,
      neededSPerLap: 0.2
    })
  })

  it('behind: a shrinking gap is a negative trend (it catches you)', () => {
    const { race, session } = scenario()
    race.gaps.set(key(2, 0), 1.2)
    race.histories.set(key(2, 0), linearHistory(10.49, 1.2, -0.2))
    expect(compute(session, race).behind).toMatchObject({
      trendSPerLap: -0.2,
      lapsToCatch: 6,
      catchesBeforeEnd: true,
      neededSPerLap: null
    })
  })

  it('behind: a growing gap is a positive trend (you pull away)', () => {
    const { race, session } = scenario()
    race.histories.set(key(2, 0), linearHistory(10.49, 1.23, 0.15))
    expect(compute(session, race).behind).toMatchObject({
      trendSPerLap: 0.15,
      lapsToCatch: null,
      catchesBeforeEnd: null
    })
  })

  it('a trend at the noise floor does not converge', () => {
    const { race, session } = scenario()
    race.histories.set(key(0, 1), linearHistory(10.5, 0.84, -BATTLE.minCatchTrend))
    race.histories.set(key(2, 0), linearHistory(10.49, 1.23, -0.018))
    const d = compute(session, race)
    expect(d.ahead).toMatchObject({ trendSPerLap: 0.02, lapsToCatch: null })
    expect(d.behind).toMatchObject({ trendSPerLap: -0.02, lapsToCatch: null })
  })

  it('ignores unclean samples (pit stops, cautions)', () => {
    const { race, session } = scenario()
    race.gaps.set(key(0, 1), 0.8)
    const history = linearHistory(10.5, 0.8, -0.2).map((s) =>
      s.distance < 9.5 ? { ...s, gap: s.gap + 20, clean: false } : s
    )
    race.histories.set(key(0, 1), history)
    expect(compute(session, race).ahead?.trendSPerLap).toBe(0.2)
    // Only 0.4 lap of clean data left: no trend.
    race.histories.set(
      key(0, 1),
      history.map((s) => (s.distance < 10.1 ? { ...s, clean: false } : s))
    )
    expect(compute(session, race).ahead).toMatchObject({
      trendSPerLap: null,
      lapsToCatch: null,
      catchesBeforeEnd: null
    })
  })

  it('fits only the samples after the last pit stop or caution', () => {
    const { race, session } = scenario()
    race.gaps.set(key(0, 1), 0.8)
    // Before the opponent's stop the gap was 20 s larger: clean samples, but not comparable.
    const history = linearHistory(10.5, 0.8, -0.2).map((s) =>
      s.distance < 9.4
        ? { ...s, gap: s.gap + 20 }
        : s.distance < 9.5
          ? { ...s, gap: s.gap + 10, clean: false }
          : s
    )
    race.histories.set(key(0, 1), history)
    expect(compute(session, race).ahead?.trendSPerLap).toBe(0.2)
  })

  it('without laps remaining nothing about the finish is known', () => {
    const { race, session } = scenario()
    race.remaining.clear()
    race.histories.set(key(0, 1), linearHistory(10.5, 0.84, -0.2))
    const d = compute(session, race)
    expect(d.lapsRemaining).toBeNull()
    expect(d.ahead).toMatchObject({ catchesBeforeEnd: null, neededSPerLap: null, lapsToCatch: 4 })
  })

  it('predicts nothing with "Mostrar predicción" off, but keeps the trend', () => {
    const { race, session } = scenario()
    race.histories.set(key(0, 1), linearHistory(10.5, 0.84, 0.1))
    expect(compute(session, race, hiding({ rows: ['prediction'] })).ahead).toMatchObject({
      trendSPerLap: -0.1,
      lapsToCatch: null,
      catchesBeforeEnd: null,
      neededSPerLap: null
    })
  })
})

describe('laps and sectors', () => {
  it('lists your last 3 laps, most recent first, and the same laps of each opponent', () => {
    const { race, session } = scenario()
    race.set(0, { laps: laps(91.2, 91.4, 91.6) })
    // The car ahead already completed lap 11: its laps 10, 9, 8 line up with yours.
    race.set(1, {
      laps: [{ lap: 11, time: 89, clean: true }, ...laps(90.12345, 90.5)]
    })
    const d = compute(session, race)
    expect(d.playerLastLaps).toEqual([91.2, 91.4, 91.6])
    expect(d.ahead?.lastLaps).toEqual([90.123, 90.5, null])
    // No laps recorded for the car behind.
    expect(d.behind?.lastLaps).toEqual([null, null, null])
  })

  it("lists an opponent's own last laps while you have none", () => {
    const { race, session } = scenario()
    race.set(1, { laps: laps(90.12345, 90.5, 0, 92) })
    race.set(0, { laps: [], lastLapTime: 91.25 })
    const d = compute(session, race)
    expect(d.ahead?.lastLaps).toEqual([90.123, 90.5, null])
    expect(d.playerLastLaps).toEqual([91.25])
    expect(d.behind?.lastLaps).toEqual([])
  })

  it('compares the sectors of the latest lap both completed (+ = you were faster)', () => {
    const { race, session } = scenario()
    race.set(0, { laps: laps(100.2) })
    race.set(1, { laps: [{ lap: 11, time: 100, clean: true }, ...laps(100.2)] })
    race.sectors.set('0@10', [30.1, 40.2, 29.9])
    race.sectors.set('1@10', [30.3, 40.0, 29.9])
    race.sectors.set('1@11', [29, 39, 29])
    // The car ahead is on its lap 11 already: lap 10 is compared until you finish yours.
    expect(compute(session, race).ahead?.sectorDeltas).toEqual([0.2, -0.2, 0])
    race.set(0, { laps: [{ lap: 11, time: 100.1, clean: true }, ...laps(100.2)] })
    race.sectors.set('0@11', [30, 40, 30.1])
    expect(compute(session, race).ahead?.sectorDeltas).toEqual([-1, -1, -1.1])
  })

  it('has no sector deltas when unknown, mismatched or not finite', () => {
    const { race, session } = scenario()
    race.set(0, { laps: laps(100.2) })
    race.set(1, { laps: laps(100.2) })
    race.set(2, { laps: laps(100.2) })
    race.sectors.set('0@10', [30.1, 40.2, 29.9])
    race.sectors.set('2@10', [30.3, 40.0])
    const d = compute(session, race)
    expect(d.ahead?.sectorDeltas).toBeNull()
    expect(d.behind?.sectorDeltas).toBeNull()
    race.sectors.set('1@10', [30.3, NaN, 29.9])
    expect(compute(session, race).ahead?.sectorDeltas).toBeNull()
  })
})

describe('iRating at stake', () => {
  it('is the swing between finishing ahead of and behind the opponent (one position)', () => {
    const { race, session } = scenario()
    const d = compute(session, race)
    // Three starters in the class: 198 / 3 per position.
    expect(d.ahead?.iRatingAtStake).toBe(66)
    expect(d.behind?.iRatingAtStake).toBe(66)
  })

  it('counts registered non-starters in the field, like the standings', () => {
    const { race, session } = scenario()
    session.drivers = new Map([...session.drivers, [6, makeDriver(6, { iRating: 1500 })]])
    compute(session, race, hiding({ lanes: ['behind'] }))
    const entries = vi.mocked(iRatingDeltas).mock.calls[0]?.[0]
    expect(entries).toEqual([
      { carIdx: 0, iRating: 2000, position: 2, started: true },
      { carIdx: 1, iRating: 2100, position: 1, started: true },
      { carIdx: 2, iRating: 1900, position: 3, started: true },
      { carIdx: 6, iRating: 1500, position: 4, started: false }
    ])
  })

  it('is computed once per field, not per opponent or per tick', () => {
    const { race, session } = scenario()
    compute(session, race)
    compute(session, race)
    expect(iRatingDeltas).toHaveBeenCalledTimes(1)
    battle.reset()
    compute(session, race)
    expect(iRatingDeltas).toHaveBeenCalledTimes(2)
  })

  it('is null when an iRating is unknown, the option is off, the race unrated or it fails', () => {
    const { race, session } = scenario()
    session.drivers = new Map([...session.drivers, [1, makeDriver(1, { iRating: 0 })]])
    const d = compute(session, race)
    expect(d.ahead?.iRatingAtStake).toBeNull()
    expect(d.ahead?.iRating).toBeNull()
    expect(d.behind?.iRatingAtStake).toBe(99)

    const off = compute(session, race, hiding({ parts: ['stake'] }))
    expect(off.behind?.iRatingAtStake).toBeNull()
    const hosted = compute({ ...session, official: false }, race)
    expect(hosted.behind?.iRatingAtStake).toBeNull()

    battle.reset()
    vi.mocked(iRatingDeltas).mockImplementationOnce(() => {
      throw new Error('boom')
    })
    const failed = compute(session, race, hiding({ lanes: ['ahead'] }))
    expect(failed.behind?.iRatingAtStake).toBeNull()
    expect(failed.behind?.carIdx).toBe(2)
  })
})

describe('battleEqual', () => {
  it('is structural', () => {
    const { race, session } = scenario()
    race.histories.set(key(0, 1), linearHistory(10.5, 0.84, -0.2))
    race.set(0, { laps: laps(90, 91) })
    race.set(1, { laps: laps(90, 91) })
    race.sectors.set('0@10', [30, 40])
    race.sectors.set('1@10', [30.1, 40])
    const a = compute(session, race)
    const b = compute(session, race)
    expect(a).not.toBe(b)
    expect(battleEqual(a, b)).toBe(true)
  })

  it('sees quantised changes only', () => {
    const { race, session } = scenario()
    const a = compute(session, race)
    race.gaps.set(key(0, 1), 0.81)
    expect(battleEqual(a, compute(session, race))).toBe(true)
    race.gaps.set(key(0, 1), 0.86)
    expect(battleEqual(a, compute(session, race))).toBe(false)
  })

  it('compares every field', () => {
    const { race, session } = scenario()
    const a = compute(session, race)
    const ahead = a.ahead
    if (!ahead) throw new Error('expected an opponent ahead')
    const variants = [
      { ...a, visible: false },
      { ...a, lapsRemaining: 9 },
      { ...a, playerLastLaps: [90] },
      { ...a, behind: null },
      { ...a, ahead: { ...ahead, inPits: true } },
      { ...a, ahead: { ...ahead, gapS: 0.9 } },
      { ...a, ahead: { ...ahead, trendSPerLap: 0.1 } },
      { ...a, ahead: { ...ahead, lapsToCatch: 3 } },
      { ...a, ahead: { ...ahead, catchesBeforeEnd: false } },
      { ...a, ahead: { ...ahead, neededSPerLap: 0.2 } },
      { ...a, ahead: { ...ahead, lastLaps: [90] } },
      { ...a, ahead: { ...ahead, sectorDeltas: [0.1, 0.1] } },
      { ...a, ahead: { ...ahead, iRatingAtStake: 11 } },
      { ...a, ahead: { ...ahead, driverName: 'Otro' } },
      { ...a, ahead: { ...ahead, licColor: null } }
    ]
    for (const v of variants) expect(battleEqual(a, v)).toBe(false)
    expect(battleEqual(a, { ...a, ahead: { ...ahead } })).toBe(true)
  })
})
