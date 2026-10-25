import { describe, expect, it } from 'vitest'
import { CAUTION_FLAGS } from './flags'
import { EMPTY_RACE_VIEW } from './race/emptyRaceView'
import type { RaceCarState, RaceView } from './race/raceView'
import { makeDriver, makeFrame, makeSession, PRACTICE } from './race/testing/raceSim'
import type { MutableFrame } from './race/testing/raceSim'
import { SessionState, TrackLocation } from './telemetry'
import { TRAFFIC, TrafficProvider, sectorOf, speedRelation, trafficEqual } from './traffic'
import type { DriverEntry, SessionMeta, TrafficData, TrafficEntry, TrafficOptions } from './types'

/** The player (CarIdx 0) laps in 100 s; GT3 is the player's class. */
const MY_PACE = 100

const OPTS: TrafficOptions = {
  behindS: 12,
  aheadS: 8,
  hazardS: 8,
  maxEntries: 3,
  showFaster: true,
  showSlower: true,
  showHazards: true,
  onlyMulticlass: true,
  nameFormat: 'inherit'
}

const GT3 = { classId: 1, classShortName: 'GT3', classRelSpeed: 50, classColor: '#ffda59' }
const LMP2 = { classId: 2, classShortName: 'LMP2', classRelSpeed: 70, classColor: '#33ceff' }
const GT4 = { classId: 3, classShortName: 'GT4', classRelSpeed: 40, classColor: '#ff5f5f' }

interface CarSpec {
  pct: number
  /** Laps completed (race distance = lap + pct). */
  lap?: number
  pace?: number | null
  /** Laps per second; default its pace. */
  speed?: number
  stoppedForS?: number
  offTrack?: boolean
  inPits?: boolean
  inWorld?: boolean
  finished?: boolean
}

function carState(carIdx: number, s: CarSpec): RaceCarState {
  const pace = s.pace === undefined ? MY_PACE : s.pace
  return {
    carIdx,
    distance: (s.lap ?? 10) + s.pct,
    classPosition: 1,
    overallPosition: 1,
    inWorld: s.inWorld ?? true,
    inPits: s.inPits ?? false,
    offTrack: s.offTrack ?? false,
    disconnected: false,
    finished: s.finished ?? false,
    pitStops: 0,
    lastPitLap: null,
    outLap: false,
    stintLaps: 0,
    lastLapTime: null,
    bestLapTime: null,
    laps: [],
    pace,
    speed: s.speed ?? (pace ? 1 / pace : 0),
    stoppedForS: s.stoppedForS ?? 0,
    sessionFlags: 0
  }
}

/** A frame and a fake RaceView built from car specs; the player is CarIdx 0. */
class World {
  readonly frame: MutableFrame = makeFrame()
  readonly session: SessionMeta
  private readonly states = new Map<number, RaceCarState>()
  racing = true
  t = 1000

  constructor(drivers: DriverEntry[], o: Partial<SessionMeta> = {}) {
    this.session = makeSession(drivers.length, o, drivers)
    this.frame.SessionTime[0] = this.t
  }

  set(carIdx: number, s: CarSpec | null): this {
    if (s === null) {
      this.states.delete(carIdx)
      this.frame.CarIdxLapDistPct[carIdx] = -1
      this.frame.CarIdxTrackSurface[carIdx] = TrackLocation.NotInWorld
      return this
    }
    this.states.set(carIdx, carState(carIdx, s))
    this.frame.CarIdxLapDistPct[carIdx] = s.inWorld === false ? -1 : s.pct
    this.frame.CarIdxTrackSurface[carIdx] = TrackLocation.OnTrack
    return this
  }

  at(t: number): this {
    this.t = t
    this.frame.SessionTime[0] = t
    return this
  }

  get view(): RaceView {
    const states = this.states
    return {
      ...EMPTY_RACE_VIEW,
      sessionTime: this.t,
      racing: this.racing,
      playerCarIdx: 0,
      car: (i) => states.get(i),
      cars: () => [...states.values()]
    }
  }
}

function gt3(i: number, o: Partial<DriverEntry> = {}): DriverEntry {
  return makeDriver(i, { ...GT3, ...o })
}

/** Player GT3 at 0.5 of the lap; cars 1-3 LMP2 (faster), 4-6 GT4 (slower), 7-9 GT3. */
function field(o: Partial<SessionMeta> = {}): World {
  const drivers = Array.from({ length: 10 }, (_, i) =>
    i >= 1 && i <= 3
      ? makeDriver(i, { ...LMP2 })
      : i >= 4 && i <= 6
        ? makeDriver(i, { ...GT4 })
        : gt3(i)
  )
  return new World(drivers, o).set(0, { pct: 0.5 })
}

function compute(
  w: World,
  opts: Partial<TrafficOptions> = {},
  p = new TrafficProvider(),
  prev: TrafficData | null = null
): TrafficData {
  return p.compute(w.frame, w.session, w.view, { ...OPTS, ...opts }, prev)
}

const ids = (list: readonly TrafficEntry[]): number[] => list.map((e) => e.driver.carIdx)

describe('speedRelation', () => {
  const me = makeDriver(0, { ...GT3 })
  it('class speeds decide between classes, whatever the paces', () => {
    expect(speedRelation(me, 100, makeDriver(1, { ...LMP2 }), 100)).toBe(1)
    expect(speedRelation(me, 100, makeDriver(1, { ...GT4 }), 90)).toBe(-1)
  })

  it('without class speeds (or in the same class), a pace 2 % quicker or slower', () => {
    const other = makeDriver(1, { ...LMP2, classRelSpeed: 0 })
    expect(speedRelation(me, 100, other, 98)).toBe(1)
    expect(speedRelation(me, 100, other, 98.5)).toBe(0)
    expect(speedRelation(me, 100, other, 102)).toBe(0)
    expect(speedRelation(me, 100, other, 103)).toBe(-1)
    expect(speedRelation(me, 100, makeDriver(1, { ...GT3 }), 97)).toBe(1)
    expect(speedRelation(me, 100, other, null)).toBe(0)
  })
})

describe('sectorOf', () => {
  it('is 1-based over the sector starts, null when unknown', () => {
    const starts = [0, 0.3, 0.7]
    expect(sectorOf(0, starts)).toBe(1)
    expect(sectorOf(0.2999, starts)).toBe(1)
    expect(sectorOf(0.3, starts)).toBe(2)
    expect(sectorOf(0.95, starts)).toBe(3)
    expect(sectorOf(0.5, [])).toBeNull()
    expect(sectorOf(Number.NaN, starts)).toBeNull()
  })
})

describe('faster cars behind', () => {
  it('ETA and meeting point, hand-computed', () => {
    // LMP2 0.05 lap behind lapping in 90 s: 4.5 s away at its pace, closing at
    // 1/90 - 1/100 = 1/900 lap/s, so it reaches you in 0.05 * 900 = 45 s, at 0.5 + 45/100 = 0.95.
    const w = field({ sectorStarts: [0, 0.3, 0.7] }).set(1, { pct: 0.45, pace: 90 })
    const d = compute(w)
    expect(d.visible).toBe(true)
    expect(d.faster).toEqual([
      {
        driver: {
          carIdx: 1,
          carNumber: '2',
          driverName: 'Piloto 1',
          classColor: '#33ceff',
          iRating: 1500,
          licString: 'B 3.00',
          licColor: null
        },
        kind: 'faster',
        className: 'LMP2',
        gapS: -4.5,
        etaS: 45,
        meetPct: 0.95,
        meetSector: 3,
        lapping: false,
        hazard: null
      }
    ])
    expect(d.slower).toEqual([])
    expect(d.hazards).toEqual([])
  })

  it('across the start/finish line, and the meeting point wraps', () => {
    // Player at 0.02, LMP2 at 0.98 (0.04 behind): 3.6 s, ETA 36 s, meet at 0.02 + 0.36 = 0.38.
    const w = field({ sectorStarts: [0, 0.3, 0.7] })
      .set(0, { pct: 0.02 })
      .set(1, {
        pct: 0.98,
        pace: 90
      })
    const e = compute(w).faster[0]
    expect(e).toMatchObject({ gapS: -3.6, etaS: 36, meetPct: 0.38, meetSector: 2 })
    // Player at 0.9, LMP2 at 0.85: ETA 45 s, meet at 0.9 + 0.45 = 1.35 -> 0.35.
    w.set(0, { pct: 0.9 }).set(1, { pct: 0.85, pace: 90 })
    expect(compute(w).faster[0]).toMatchObject({ etaS: 45, meetPct: 0.35, meetSector: 2 })
  })

  it('lapping: the faster car is ahead in race distance', () => {
    const w = field().set(0, { pct: 0.5, lap: 10 })
    // Same lap: 0.05 behind on road and in race distance.
    w.set(1, { pct: 0.45, lap: 10, pace: 90 })
    expect(compute(w).faster[0]?.lapping).toBe(false)
    // A lap ahead: 0.95 laps ahead in race distance, 0.05 behind on road.
    w.set(1, { pct: 0.45, lap: 11, pace: 90 })
    expect(compute(w).faster[0]?.lapping).toBe(true)
    // Outside a race, laps completed say nothing.
    w.racing = false
    expect(compute(w).faster[0]?.lapping).toBe(false)
  })

  it('only within behindS seconds at its pace', () => {
    // 0.13 lap at 90 s = 11.7 s (in); 0.14 lap = 12.6 s (out).
    const w = field().set(1, { pct: 0.37, pace: 90 }).set(2, { pct: 0.36, pace: 90 })
    expect(ids(compute(w).faster)).toEqual([1])
    expect(ids(compute(w, { behindS: 13 }).faster)).toEqual([1, 2])
  })

  it('a faster class that is not closing is listed without an ETA', () => {
    const w = field({ sectorStarts: [0, 0.5] }).set(1, { pct: 0.44, pace: 101 })
    expect(compute(w).faster[0]).toMatchObject({
      gapS: -6.1,
      etaS: null,
      meetPct: null,
      meetSector: null
    })
  })

  it('no ETA under a full-course caution (nobody closes at racing pace)', () => {
    const w = field().set(1, { pct: 0.45, pace: 90 })
    w.frame.SessionFlags[0] = CAUTION_FLAGS
    expect(compute(w).faster[0]).toMatchObject({ gapS: -4.5, etaS: null, meetPct: null })
  })

  it('meeting further than TRAFFIC.maxEtaS away is not converging', () => {
    // 0.1 lap behind at 1/99.5 - 1/100 lap/s: ~1990 s.
    const w = field().set(1, { pct: 0.4, pace: 99.5 })
    expect(compute(w).faster[0]?.etaS).toBeNull()
    expect(TRAFFIC.maxEtaS).toBeLessThan(1990)
  })

  it('cars ahead on the road are not faster traffic; a car without pace is skipped', () => {
    const w = field().set(1, { pct: 0.55, pace: 90 }).set(2, { pct: 0.45, pace: null })
    expect(compute(w).faster).toEqual([])
  })
})

describe('slower cars ahead', () => {
  it('ETA and meeting point, hand-computed', () => {
    // GT4 0.05 lap ahead lapping in 110 s: 5 s away at your pace, closing at
    // 1/100 - 1/110 = 1/1100 lap/s: 55 s, at 0.5 + 0.55 = 1.05 -> 0.05.
    const w = field({ sectorStarts: [0, 0.3, 0.7] }).set(4, { pct: 0.55, pace: 110 })
    expect(compute(w).slower).toEqual([
      expect.objectContaining({
        kind: 'slower',
        className: 'GT4',
        gapS: 5,
        etaS: 55,
        meetPct: 0.05,
        meetSector: 1,
        lapping: false,
        hazard: null
      })
    ])
  })

  it('lapping: you are a lap or more ahead of it', () => {
    const w = field().set(0, { pct: 0.5, lap: 10 })
    w.set(4, { pct: 0.55, lap: 10, pace: 110 })
    expect(compute(w).slower[0]?.lapping).toBe(false)
    w.set(4, { pct: 0.55, lap: 9, pace: 110 })
    expect(compute(w).slower[0]?.lapping).toBe(true)
  })

  it('only within aheadS seconds at your pace', () => {
    const w = field().set(4, { pct: 0.579, pace: 110 }).set(5, { pct: 0.581, pace: 110 })
    expect(ids(compute(w).slower)).toEqual([4])
  })

  it('a crawling slower car (beyond the hazard window) is reached at its actual speed', () => {
    // 0.079 lap ahead (7.9 s) at 0.002 lap/s, slower than half of yours: 0.079 / 0.008 = 9.875 s.
    const w = field().set(4, { pct: 0.579, pace: 110, speed: 0.002, stoppedForS: 0 })
    const d = compute(w, { hazardS: 5 })
    expect(d.hazards).toEqual([])
    expect(d.slower[0]?.etaS).toBe(9.9)
  })
})

describe('hazards ahead', () => {
  it('stopped, slow and off-track cars within hazardS seconds at your pace', () => {
    const w = field({ sectorStarts: [0, 0.3, 0.7] })
    w.set(7, { pct: 0.52, speed: 0, stoppedForS: 2 })
    w.set(8, { pct: 0.54, speed: 0.004 })
    w.set(9, { pct: 0.56, offTrack: true })
    const d = compute(w)
    expect(d.hazards).toEqual([
      expect.objectContaining({
        kind: 'hazard',
        hazard: 'stopped',
        gapS: 2,
        etaS: 2,
        meetPct: 0.52,
        meetSector: 2,
        lapping: false
      }),
      expect.objectContaining({ hazard: 'slow', gapS: 4, etaS: 4, meetPct: 0.54 }),
      expect.objectContaining({ hazard: 'off-track', gapS: 6, etaS: 6, meetPct: 0.56 })
    ])
    expect(ids(d.hazards)).toEqual([7, 8, 9])
    // Any class, also in a single-class session.
    expect(compute(w, { onlyMulticlass: true }).hazards).toHaveLength(3)
  })

  it('off track wins over stopped; nothing behind you or beyond hazardS', () => {
    const w = field()
    w.set(7, { pct: 0.52, speed: 0, stoppedForS: 5, offTrack: true })
    w.set(8, { pct: 0.45, speed: 0, stoppedForS: 5 })
    w.set(9, { pct: 0.59, speed: 0, stoppedForS: 5 })
    const d = compute(w)
    expect(d.hazards.map((e) => [e.driver.carIdx, e.hazard])).toEqual([[7, 'off-track']])
  })

  it('ignores cars in the pits, out of the world or finished', () => {
    const w = field()
    w.set(7, { pct: 0.52, speed: 0, stoppedForS: 5, inPits: true })
    w.set(8, { pct: 0.53, speed: 0, stoppedForS: 5, inWorld: false })
    w.set(9, { pct: 0.54, speed: 0, stoppedForS: 5, finished: true })
    expect(compute(w).visible).toBe(false)
  })

  it('a crawling car is no hazard while you crawl too (start, pace car, a jam)', () => {
    const w = field().set(0, { pct: 0.5, speed: 0.003 })
    w.set(7, { pct: 0.52, speed: 0.002, stoppedForS: 3 })
    w.set(8, { pct: 0.53, speed: 0.002 })
    expect(compute(w).hazards).toEqual([])
    // Off track still is.
    w.set(9, { pct: 0.54, offTrack: true })
    expect(ids(compute(w).hazards)).toEqual([9])
  })

  it('no "slow" under a caution or when braking for the pit entry; stopped still counts', () => {
    const w = field()
    w.set(7, { pct: 0.52, speed: 0.004 })
    w.set(8, { pct: 0.53, speed: 0, stoppedForS: 2 })
    w.frame.SessionFlags[0] = CAUTION_FLAGS
    expect(compute(w).hazards.map((e) => e.hazard)).toEqual(['stopped'])
    w.frame.SessionFlags[0] = 0
    w.frame.CarIdxTrackSurface[7] = TrackLocation.ApproachingPits
    expect(compute(w).hazards.map((e) => e.hazard)).toEqual(['stopped'])
  })

  it('crawling below 1 s is not stopped yet; slow is judged against its own pace', () => {
    const w = field()
    // Half of its 120 s pace is 0.0041 lap/s: 0.0045 is not slow for it.
    w.set(7, { pct: 0.52, speed: 0.0045, pace: 120, stoppedForS: 0.5 })
    expect(compute(w).hazards).toEqual([])
    w.set(7, { pct: 0.52, speed: 0.004, pace: 120, stoppedForS: 0.5 })
    expect(compute(w).hazards[0]?.hazard).toBe('slow')
  })

  it('a hazard is not also slower traffic', () => {
    const w = field().set(4, { pct: 0.52, pace: 110, speed: 0, stoppedForS: 3 })
    const d = compute(w)
    expect(ids(d.hazards)).toEqual([4])
    expect(d.slower).toEqual([])
    // Hidden hazards: it is slower traffic again, reached at its actual speed (0.02 / 0.01 = 2 s).
    const s = compute(w, { showHazards: false })
    expect(s.hazards).toEqual([])
    expect(s.slower[0]).toMatchObject({ gapS: 2, etaS: 2 })
  })
})

describe('classes and options', () => {
  it('onlyMulticlass: a single-class session lists no faster/slower traffic', () => {
    const drivers = [0, 1, 2].map((i) => gt3(i))
    const w = new World(drivers).set(0, { pct: 0.5 })
    // A GT3 5 % quicker lapping you, another 5 % slower ahead.
    w.set(1, { pct: 0.45, pace: 95, lap: 11 })
    w.set(2, { pct: 0.55, pace: 105, lap: 9 })
    expect(compute(w).visible).toBe(false)
    const d = compute(w, { onlyMulticlass: false })
    expect(d.faster[0]).toMatchObject({ className: 'GT3', lapping: true, etaS: 95 })
    expect(d.slower[0]).toMatchObject({ className: 'GT3', lapping: true, etaS: 105 })
  })

  it('a car of another class in the world makes it multiclass (only you in your class)', () => {
    const drivers = [gt3(0), makeDriver(1, { ...LMP2 })]
    const w = new World(drivers).set(0, { pct: 0.5 }).set(1, { pct: 0.45, pace: 90 })
    expect(ids(compute(w).faster)).toEqual([1])
  })

  it('in a race your own class is traffic only on another lap (else a rival)', () => {
    const w = field()
    // 5 % quicker / slower on your lap: rivals, not traffic.
    w.set(7, { pct: 0.45, pace: 95, lap: 10 }).set(8, { pct: 0.55, pace: 105, lap: 10 })
    expect(compute(w, { onlyMulticlass: false }).visible).toBe(false)
    // On another lap they are: the leader lapping you, a backmarker you lap.
    w.set(7, { pct: 0.45, pace: 95, lap: 11 }).set(8, { pct: 0.55, pace: 105, lap: 9 })
    const d = compute(w, { onlyMulticlass: false })
    expect(d.faster[0]).toMatchObject({ className: 'GT3', lapping: true, etaS: 95 })
    expect(d.slower[0]).toMatchObject({ className: 'GT3', lapping: true, etaS: 105 })
    // A lapped car (or one lapping you) at your pace is never reached: not traffic.
    w.set(7, { pct: 0.45, pace: 100.5, lap: 11 }).set(8, { pct: 0.55, pace: 101, lap: 9 })
    expect(compute(w, { onlyMulticlass: false }).visible).toBe(false)
    // Outside a race the paces decide: 5 % quicker on any lap is faster traffic.
    w.racing = false
    w.set(7, { pct: 0.45, pace: 95, lap: 10 }).set(8, { pct: 0.55, pace: 100.5, lap: 9 })
    const p = compute(w, { onlyMulticlass: false })
    expect(ids(p.faster)).toEqual([7])
    expect(p.slower).toEqual([])
  })

  it('a same-class car of similar pace is never traffic', () => {
    const w = field().set(7, { pct: 0.45, pace: 99 }).set(8, { pct: 0.55, pace: 101 })
    expect(compute(w, { onlyMulticlass: false }).visible).toBe(false)
  })

  it('hidden groups are not listed', () => {
    const w = field()
      .set(1, { pct: 0.45, pace: 90 })
      .set(4, { pct: 0.55, pace: 110 })
      .set(7, { pct: 0.52, offTrack: true })
    const all = compute(w)
    expect([all.faster.length, all.slower.length, all.hazards.length]).toEqual([1, 1, 1])
    const none = compute(w, { showFaster: false, showSlower: false, showHazards: false })
    expect(none).toEqual({ visible: false, faster: [], slower: [], hazards: [] })
    const onlySlower = compute(w, { showFaster: false, showHazards: false })
    expect([onlySlower.faster.length, onlySlower.slower.length, onlySlower.hazards.length]).toEqual(
      [0, 1, 0]
    )
  })

  it('closest first by ETA, not converging last, capped at maxEntries', () => {
    const w = field()
    // ETAs: car 1 at 0.05 behind / 90 s = 45 s; car 2 at 0.02 / 95 s: 0.02 / (1/95 - 1/100) = 38 s;
    // car 3 at 0.01 behind but not closing (101 s): last despite being closest on the road.
    w.set(1, { pct: 0.45, pace: 90 })
      .set(2, { pct: 0.48, pace: 95 })
      .set(3, { pct: 0.49, pace: 101 })
    expect(ids(compute(w).faster)).toEqual([2, 1, 3])
    expect(ids(compute(w, { maxEntries: 2 }).faster)).toEqual([2, 1])
    expect(ids(compute(w, { maxEntries: 1 }).faster)).toEqual([2])
  })

  it('equal ETAs: the closer on the road first, then by CarIdx', () => {
    const w = field()
    // Three LMP2 that are not closing (no ETA): 6.1 s, 3 s and 3 s behind.
    w.set(1, { pct: 0.44, pace: 101 }).set(2, { pct: 0.47, pace: 101 })
    w.set(3, { pct: 0.47, pace: 101 })
    expect(ids(compute(w).faster)).toEqual([2, 3, 1])
    // Hazards: the ETA is the gap; ties by CarIdx.
    w.set(7, { pct: 0.53, offTrack: true }).set(8, { pct: 0.52, offTrack: true })
    w.set(9, { pct: 0.52, offTrack: true })
    expect(ids(compute(w).hazards)).toEqual([8, 9, 7])
  })

  it('quantises gaps and ETAs to 0.1 s and the meeting point to 0.01', () => {
    // 0.0333 lap at 90 s = 2.997 s; ETA 0.0333 * 900 = 29.97 s; meet 0.5 + 0.2997 = 0.7997.
    const w = field({ sectorStarts: [0, 0.8] }).set(1, { pct: 0.4667, pace: 90 })
    const e = compute(w).faster[0]
    expect(e).toMatchObject({ gapS: -3, etaS: 30, meetPct: 0.8 })
    // The sector comes from the exact point (0.7997 is still sector 1).
    expect(e?.meetSector).toBe(1)
    // A meeting point that rounds to 1.00 reads 0.
    w.set(0, { pct: 0.7 }).set(1, { pct: 0.6667, pace: 90 })
    expect(compute(w).faster[0]?.meetPct).toBe(0)
  })
})

describe('when there is nothing to compute', () => {
  it('outside Racing/Checkered, with you in the pits, finished, out of the world or without pace', () => {
    const base = (): World =>
      field().set(1, { pct: 0.45, pace: 90 }).set(7, {
        pct: 0.52,
        offTrack: true
      })
    expect(compute(base()).visible).toBe(true)
    const grid = base()
    grid.frame.SessionState[0] = SessionState.ParadeLaps
    expect(compute(grid).visible).toBe(false)
    const checkered = base()
    checkered.frame.SessionState[0] = SessionState.Checkered
    expect(compute(checkered).visible).toBe(true)
    const coolDown = base()
    coolDown.frame.SessionState[0] = SessionState.CoolDown
    expect(compute(coolDown).visible).toBe(false)
    expect(compute(base().set(0, { pct: 0.5, inPits: true })).visible).toBe(false)
    expect(compute(base().set(0, { pct: 0.5, finished: true })).visible).toBe(false)
    expect(compute(base().set(0, { pct: 0.5, inWorld: false })).visible).toBe(false)
    expect(compute(base().set(0, { pct: 0.5, pace: null })).visible).toBe(false)
    expect(compute(base().set(0, null)).visible).toBe(false)
  })

  it('follows PlayerCarIdx (falling back to DriverCarIdx)', () => {
    const w = field().set(3, { pct: 0.5 }).set(0, { pct: 0.55, pace: 110 })
    w.frame.PlayerCarIdx[0] = 3
    // CarIdx 3 (LMP2) is now you: car 0, a GT3, is slower traffic ahead.
    const d = compute(w)
    expect(ids(d.slower)).toEqual([0])
    expect(d.faster).toEqual([])
  })
})

describe('hysteresis', () => {
  it('an entry stays TRAFFIC.holdS after leaving its window, only when shown last time', () => {
    const w = field().set(1, { pct: 0.37, pace: 90 }) // 11.7 s, inside 12 s
    const p = new TrafficProvider()
    let prev = compute(w.at(100), {}, p)
    expect(ids(prev.faster)).toEqual([1])
    // Drops back to 12.6 s.
    w.set(1, { pct: 0.36, pace: 90 })
    prev = compute(w.at(100.25), {}, p, prev)
    expect(prev.faster[0]).toMatchObject({ gapS: -12.6 })
    prev = compute(w.at(100.75), {}, p, prev)
    expect(ids(prev.faster)).toEqual([1])
    prev = compute(w.at(101), {}, p, prev)
    expect(prev.faster).toEqual([])
    // Not shown last time (no prev): not held.
    w.set(1, { pct: 0.37, pace: 90 })
    compute(w.at(102), {}, p, null)
    w.set(1, { pct: 0.36, pace: 90 })
    expect(compute(w.at(102.25), {}, p, null).faster).toEqual([])
  })

  it('back inside the window, the hold starts over', () => {
    const w = field().set(1, { pct: 0.37, pace: 90 })
    const p = new TrafficProvider()
    let prev = compute(w.at(10), {}, p)
    for (let k = 1; k <= 12; k++) {
      // Flickers across the edge every quarter second: always listed.
      w.set(1, { pct: k % 2 === 0 ? 0.37 : 0.36, pace: 90 })
      prev = compute(w.at(10 + k / 4), {}, p, prev)
      expect(ids(prev.faster), `k=${k}`).toEqual([1])
    }
  })

  it('a car that passed you, pitted or left the world goes at once', () => {
    const w = field().set(1, { pct: 0.45, pace: 90 }).set(2, { pct: 0.46, pace: 90 })
    w.set(3, { pct: 0.47, pace: 90 })
    const p = new TrafficProvider()
    const prev = compute(w.at(10), {}, p)
    expect(prev.faster).toHaveLength(3)
    w.set(1, { pct: 0.51, pace: 90 }).set(2, { pct: 0.46, pace: 90, inPits: true }).set(3, null)
    expect(compute(w.at(10.25), {}, p, prev).faster).toEqual([])
  })

  it('a hazard that moves again stays a moment with its last kind', () => {
    const w = field().set(7, { pct: 0.52, speed: 0, stoppedForS: 3 })
    const p = new TrafficProvider()
    let prev = compute(w.at(10), {}, p)
    expect(prev.hazards[0]?.hazard).toBe('stopped')
    w.set(7, { pct: 0.521 })
    prev = compute(w.at(10.5), {}, p, prev)
    expect(prev.hazards[0]).toMatchObject({ hazard: 'stopped', gapS: 2.1 })
    prev = compute(w.at(11), {}, p, prev)
    expect(prev.hazards).toEqual([])
  })

  it('reset() and a clock going back forget the holds', () => {
    const w = field().set(1, { pct: 0.37, pace: 90 })
    const p = new TrafficProvider()
    const prev = compute(w.at(50), {}, p)
    w.set(1, { pct: 0.36, pace: 90 })
    expect(compute(w.at(50.25), {}, p, prev).faster).toHaveLength(1)
    p.reset()
    expect(compute(w.at(50.5), {}, p, prev).faster).toEqual([])

    const q = new TrafficProvider()
    w.set(1, { pct: 0.37, pace: 90 })
    const shown = compute(w.at(50), {}, q)
    w.set(1, { pct: 0.36, pace: 90 })
    expect(compute(w.at(49.9), {}, q, shown).faster).toEqual([])
  })

  it('keeps no record of cars that came and went (no growth over a long run)', () => {
    const drivers = Array.from({ length: 64 }, (_, i) =>
      i === 0 ? gt3(0) : makeDriver(i, i % 2 === 0 ? { ...LMP2 } : { ...GT4 })
    )
    const w = new World(drivers).set(0, { pct: 0.5 })
    const p = new TrafficProvider()
    let prev: TrafficData | null = null
    for (let k = 0; k < 2000; k++) {
      // Everybody circulates around you; a different third of the field is in the world each time.
      for (let i = 1; i < 64; i++) {
        const pct = (0.5 + ((i * 0.0123 + k * 0.003) % 0.4) - 0.2 + 1) % 1
        w.set(i, (i + k) % 3 === 0 ? null : { pct, pace: i % 2 === 0 ? 90 : 110 })
      }
      prev = compute(w.at(k / 4), {}, p, prev)
    }
    const holds = (p as unknown as { holds: Record<string, Map<number, unknown>> }).holds
    const sizes = Object.values(holds).map((m) => m.size)
    expect(Math.max(...sizes)).toBeLessThanOrEqual(63)
    // Gone from the world: nothing is kept for them.
    for (let i = 1; i < 64; i++) w.set(i, null)
    compute(w.at(1000), {}, p, prev)
    expect(Object.values(holds).map((m) => m.size)).toEqual([0, 0, 0])
  })
})

describe('trafficEqual', () => {
  const w = field({ sectorStarts: [0, 0.5] })
    .set(1, { pct: 0.45, pace: 90 })
    .set(4, { pct: 0.55, pace: 110 })
    .set(7, { pct: 0.52, offTrack: true })
  const a = compute(w)

  it('is structural', () => {
    expect(trafficEqual(a, structuredClone(a))).toBe(true)
    expect(trafficEqual(a, compute(w))).toBe(true)
  })

  it('sees every field that is drawn', () => {
    const f = a.faster[0] as TrafficEntry
    const changed: Partial<TrafficEntry>[] = [
      { gapS: f.gapS + 0.1 },
      { etaS: null },
      { meetPct: 0.5 },
      { meetSector: 1 },
      { lapping: true },
      { className: 'GTP' },
      { driver: { ...f.driver, driverName: 'Otro' } }
    ]
    for (const c of changed) {
      expect(trafficEqual(a, { ...a, faster: [{ ...f, ...c }] }), JSON.stringify(c)).toBe(false)
    }
    expect(trafficEqual(a, { ...a, visible: false })).toBe(false)
    expect(trafficEqual(a, { ...a, slower: [] })).toBe(false)
    const h = a.hazards[0] as TrafficEntry
    expect(trafficEqual(a, { ...a, hazards: [{ ...h, hazard: 'slow' }] })).toBe(false)
  })
})

describe('practice sessions', () => {
  it('traffic without lap relations', () => {
    const w = field().set(1, { pct: 0.45, lap: 11, pace: 90 })
    w.frame.SessionNum[0] = PRACTICE
    w.racing = false
    expect(compute(w).faster[0]).toMatchObject({ etaS: 45, lapping: false })
  })
})
