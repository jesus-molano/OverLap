import { setFlagsFromString } from 'node:v8'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { setElementVisible } from '../elements'
import { SessionFlag } from '../flags'
import { SessionState } from '../telemetry'
import { EMPTY_RACE_VIEW } from '../race/emptyRaceView'
import { RACE_TIMING_LINES } from '../race/raceView'
import type { RaceCarState, RaceView } from '../race/raceView'
import { makeDriver, makeFrame, makeSession } from '../race/testing/raceSim'
import { DELTA_REFERENCES } from '../settings'
import { defaultOptions } from '../settings'
import type { DeltaData, DeltaOptions, DeltaReference, DriverEntry, SessionMeta } from '../types'

/** The same reference in every kind of session (the rig's sessions are of any kind). */
function everySession(
  r: DeltaReference
): Pick<DeltaOptions, 'referencePractice' | 'referenceQualify' | 'referenceRace'> {
  return { referencePractice: r, referenceQualify: r, referenceRace: r }
}
import {
  DELTA,
  DELTA_FALLBACK,
  DeltaProvider,
  NO_BARS,
  NO_BAR_TRENDS,
  NO_LAPS,
  deltaEqual,
  profileAt,
  sectorLines
} from './delta'
import { createMemoryStore, personalBestKey } from './references'
import type { LapReference } from './references'

const LINES = RACE_TIMING_LINES
const PLAYER = 0
const T0 = 1000

/** Profile of a lap driven at constant speed. */
function even(lapTime: number): number[] {
  return Array.from({ length: LINES + 1 }, (_, i) => (lapTime * i) / LINES)
}

/** Lap fraction reached `e` seconds into a lap driven along `profile`. */
function pctAt(profile: readonly number[], e: number): number {
  for (let i = 0; i < LINES; i++) {
    const a = profile[i] ?? 0
    const b = profile[i + 1] ?? 0
    if (e < b) return (i + (b > a ? (e - a) / (b - a) : 0)) / LINES
  }
  return 1
}

interface Lap {
  lap: number
  lapTime: number
  clean: boolean
  profile: readonly number[]
}

function lapOf(lapTime: number, lap = 2, profile: readonly number[] = even(lapTime)): Lap {
  return { lap, lapTime, clean: true, profile }
}

function carState(carIdx: number, o: Partial<RaceCarState> = {}): RaceCarState {
  return {
    carIdx,
    distance: 3.5,
    classPosition: 1,
    overallPosition: 1,
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
    stintLaps: 3,
    lastLapTime: null,
    bestLapTime: null,
    laps: [],
    pace: 100,
    speed: 0.01,
    stoppedForS: 0,
    lapInvalid: false,
    sessionFlags: 0,
    ...o
  }
}

/** A RaceView whose cars, laps and lap profiles each test sets by hand. */
class FakeRace {
  key = 'race-a'
  readonly states = new Map<number, RaceCarState>()
  readonly best = new Map<number, Lap>()
  readonly last = new Map<number, Lap>()
  readonly current = new Map<number, { lap: number; elapsedS: number }>()
  profileCalls = 0
  readonly view: RaceView

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this
    this.view = {
      ...EMPTY_RACE_VIEW,
      get sessionKey(): string {
        return self.key
      },
      car: (i) => self.states.get(i),
      cars: () => [...self.states.values()],
      currentLap: (i) => self.current.get(i) ?? null,
      lapProfile: (i, which) => {
        self.profileCalls++
        return (which === 'best' ? self.best : self.last).get(i) ?? null
      }
    }
  }

  /** Car `i` closes `lap` at the line: its newest record (RaceCarState.laps) and its last lap. */
  close(i: number, lap: Lap): void {
    const s = this.states.get(i) ?? carState(i)
    const rec = { lap: lap.lap, time: lap.lapTime, clean: lap.clean }
    this.states.set(i, { ...s, laps: [rec, ...s.laps].slice(0, 10) })
    this.last.set(i, lap)
  }

  /** close(), and the lap becomes the car's best when clean and faster. */
  complete(i: number, lap: Lap): void {
    this.close(i, lap)
    const best = this.best.get(i)
    if (lap.clean && (!best || lap.lapTime < best.lapTime)) this.best.set(i, lap)
  }
}

/** Sector start lines of the default rig (sectorStarts 0, 0.33, 0.66). */
const THIRDS = [0, 33, 66]

/** Profile of a lap at a constant speed within each sector: `times[k]` s in sector k (THIRDS). */
function split(times: readonly number[]): number[] {
  const profile = [0]
  let at = 0
  for (let k = 0; k < THIRDS.length; k++) {
    const a = THIRDS[k] ?? 0
    const b = THIRDS[k + 1] ?? LINES
    const t = times[k] ?? 0
    for (let i = a + 1; i <= b; i++) profile.push(at + (t * (i - a)) / (b - a))
    at += t
  }
  return profile
}

const DRIVERS: DriverEntry[] = [
  makeDriver(0, { userName: 'Andrés Lucena', carNumber: '7', carId: 67 }),
  makeDriver(1, { userName: 'Jonas Lindqvist', carNumber: '44', carId: 67 }),
  makeDriver(2, { userName: 'Ana Prototipo', carNumber: '2', classId: 2, carId: 80 }),
  makeDriver(3, { userName: 'Marta Ruiz', carNumber: '12', carId: 67 })
]

interface Sample {
  t: number
  lap: number
  pct: number
  data: DeltaData
}

interface DriveOptions {
  t0?: number
  /** Lap number of the first profile. */
  lap?: number
  hz?: number
  /** Stop on the last lap once the pct reaches this. */
  endPct?: number
  /** Make each completed lap the model's best when faster (the player's session best). */
  promote?: boolean
  /** Runs before each compute (the model updates before the providers). */
  before?: (t: number, lap: number, pct: number) => void
  /** Sees each payload (long runs that keep no samples). */
  after?: (data: DeltaData) => void
  /** Keep the samples (default true; false for long runs). */
  keep?: boolean
}

class Rig {
  readonly frame = makeFrame()
  readonly race = new FakeRace()
  readonly bests = createMemoryStore()
  readonly provider = new DeltaProvider()
  session: SessionMeta
  opts: DeltaOptions

  constructor(
    o: {
      reference?: DeltaReference
      fallback?: boolean
      sectorStarts?: number[]
      drivers?: DriverEntry[]
    } = {}
  ) {
    const drivers = o.drivers ?? DRIVERS
    this.session = makeSession(
      drivers.length,
      { sectorStarts: o.sectorStarts ?? [0, 0.33, 0.66], trackId: 219, trackConfig: 'Grand Prix' },
      drivers
    )
    this.opts = {
      ...defaultOptions('delta'),
      ...everySession(o.reference ?? 'session'),
      fallback: o.fallback ?? false,
      rangeS: 1
    }
    this.frame.PlayerCarIdx[0] = PLAYER
    for (const d of drivers) this.race.states.set(d.carIdx, carState(d.carIdx))
  }

  player(o: Partial<RaceCarState>): void {
    this.race.states.set(PLAYER, carState(PLAYER, o))
  }

  compute(): DeltaData {
    return this.provider.compute(this.frame, this.session, this.race.view, this.bests, this.opts)
  }

  /** The player `elapsed` s into lap `lap` (null: no lap in progress) at `pct`, SessionTime `t`. */
  at(t: number, lap: number | null, pct: number, elapsed = 0): DeltaData {
    this.frame.SessionTime[0] = t
    this.frame.CarIdxLapDistPct[PLAYER] = pct
    if (lap === null) this.race.current.delete(PLAYER)
    else this.race.current.set(PLAYER, { lap, elapsedS: elapsed })
    return this.compute()
  }

  /**
   * Drives consecutive laps from the S/F line at SessionTime t0, lap k along profiles[k]. At
   * each line the model's last lap (and best with `promote`) changes before the compute.
   */
  drive(profiles: readonly (readonly number[])[], o: DriveOptions = {}): Sample[] {
    const hz = o.hz ?? 30
    const t0 = o.t0 ?? T0
    const first = o.lap ?? 3
    const out: Sample[] = []
    let k = 0
    let start = t0
    for (let n = 1; ; n++) {
      const t = t0 + n / hz
      let prof = profiles[k] ?? []
      while (t >= start + (prof[LINES] ?? 0)) {
        const done: Lap = { lap: first + k, lapTime: prof[LINES] ?? 0, clean: true, profile: prof }
        this.race.close(PLAYER, done)
        const best = this.race.best.get(PLAYER)
        if (o.promote && (!best || best.lapTime > done.lapTime)) this.race.best.set(PLAYER, done)
        start += done.lapTime
        k++
        if (k >= profiles.length) return out
        prof = profiles[k] ?? []
      }
      const lap = first + k
      const pct = pctAt(prof, t - start)
      if (k === profiles.length - 1 && o.endPct !== undefined && pct >= o.endPct) return out
      o.before?.(t, lap, pct)
      const data = this.at(t, lap, pct, t - start)
      o.after?.(data)
      if (o.keep !== false) out.push({ t, lap, pct, data })
    }
  }
}

function pbLap(lapTime: number, o: Partial<LapReference> = {}): LapReference {
  return { lapTime, profile: even(lapTime), recordedAt: '2026-10-01T20:00:00.000Z', ...o }
}

describe('profileAt', () => {
  it('interpolates linearly between timing lines and clamps the lap fraction', () => {
    const p = even(100)
    expect(profileAt(p, 0)).toBe(0)
    expect(profileAt(p, 0.5)).toBeCloseTo(50, 9)
    expect(profileAt(p, 0.255)).toBeCloseTo(25.5, 9)
    expect(profileAt(p, 1)).toBe(100)
    expect(profileAt(p, -0.2)).toBe(0)
    expect(profileAt(p, 1.3)).toBe(100)
    // A lap that speeds up: t(line i) = i^2 / 100.
    const q = Array.from({ length: LINES + 1 }, (_, i) => (i * i) / 100)
    expect(profileAt(q, 0.105)).toBeCloseTo(1 + 0.5 * 0.21, 9)
    expect(profileAt(q, 0.999)).toBeCloseTo(98.01 + 0.9 * 1.99, 9)
  })
})

describe('sectorLines', () => {
  it('snaps the sector starts to timing lines like the RaceModel', () => {
    expect(sectorLines([0, 0.33, 0.66])).toEqual([0, 33, 66])
    expect(sectorLines([0, 0.334, 0.999])).toEqual([0, 33, 99])
    expect(sectorLines([])).toEqual([])
    expect(sectorLines([0.1, 0.5])).toEqual([])
  })
})

describe('DeltaProvider: the live delta', () => {
  it('is seconds versus the reference at the same point of the lap: faster is negative', () => {
    const rig = new Rig()
    rig.race.best.set(PLAYER, lapOf(100))
    // Half a second down at half distance: the lap is heading for 100.5.
    expect(rig.at(T0, 3, 0.5, 50.5)).toMatchObject({
      visible: true,
      reference: 'session',
      refDriver: '',
      refSelf: false,
      refLapTime: 100,
      delta: 0.5,
      predictedLap: 100.5,
      lapState: 'valid'
    })
    // 0.3 s up a bit later: negative.
    const up = rig.at(T0 + 0.5, 3, 0.505, 50.2)
    expect(up.delta).toBe(-0.3)
    expect(up.predictedLap).toBe(99.7)
    // Quantised to 0.01.
    expect(rig.at(T0 + 1, 3, 0.51, 51.0049).delta).toBe(0)
    expect(rig.at(T0 + 1.5, 3, 0.515, 51.4361).delta).toBe(-0.06)
  })

  it('follows the shape of the reference lap, not just its average', () => {
    const rig = new Rig()
    // The reference is quick in the first half (40 s) and slow in the second (60 s).
    const ref = Array.from({ length: LINES + 1 }, (_, i) =>
      i <= 50 ? 0.8 * i : 40 + 1.2 * (i - 50)
    )
    rig.race.best.set(PLAYER, lapOf(100, 2, ref))
    expect(rig.at(T0, 3, 0.25, 21).delta).toBe(1)
    expect(rig.at(T0 + 0.5, 3, 0.755, 70.6).delta).toBe(0)
  })

  it('is hidden without a reference or out of the car, and shown when one appears', () => {
    const rig = new Rig()
    const none = rig.at(T0, 3, 0.5, 50)
    expect(none).toEqual({
      visible: false,
      reference: 'session',
      refDriver: '',
      refSelf: false,
      refLapTime: null,
      delta: null,
      trend: 0,
      predictedLap: null,
      sectors: [],
      lapState: 'none',
      preferred: 'session',
      pending: null,
      temporary: false,
      laps: NO_LAPS,
      bars: NO_BARS,
      barTrends: NO_BAR_TRENDS
    })
    // A reference appears while there is none: taken at once (nothing to keep consistent).
    rig.race.best.set(PLAYER, lapOf(100))
    expect(rig.at(T0 + 0.5, 3, 0.505, 50.5).visible).toBe(true)
    // Garage, replay or a teammate driving.
    rig.frame.IsOnTrack[0] = false
    expect(rig.at(T0 + 1, 3, 0.51, 51).visible).toBe(false)
    rig.frame.IsOnTrack[0] = true
    expect(rig.at(T0 + 1.5, 3, 0.515, 51.5)).toMatchObject({ visible: true, delta: 0 })
  })

  it('without a lap in progress (before your first line) shows no delta and no lap state', () => {
    const rig = new Rig()
    rig.race.best.set(PLAYER, lapOf(100))
    expect(rig.at(T0, null, 0.4)).toMatchObject({
      visible: true,
      delta: null,
      predictedLap: null,
      sectors: [null, null, null],
      lapState: 'none'
    })
  })
})

describe('DeltaProvider: references', () => {
  const key = (rig: Rig): string => personalBestKey(rig.session, PLAYER) ?? ''

  function pick(rig: Rig): DeltaData {
    return rig.at(T0, 3, 0.5, 50)
  }

  it('fallback walks pb -> session -> class from the chosen one', () => {
    const setup = (reference: DeltaReference, fallback: boolean, have: DeltaReference[]): Rig => {
      const rig = new Rig({ reference, fallback })
      if (have.includes('pb')) rig.bests.offer(key(rig), pbLap(99))
      if (have.includes('session')) rig.race.best.set(PLAYER, lapOf(101))
      if (have.includes('class')) rig.race.best.set(1, lapOf(100))
      return rig
    }
    const ref = (d: DeltaData): string => (d.visible ? `${d.reference} ${d.refLapTime}` : 'none')
    expect(ref(pick(setup('pb', true, ['pb', 'session', 'class'])))).toBe('pb 99')
    expect(ref(pick(setup('pb', true, ['session', 'class'])))).toBe('session 101')
    // The class best (car 1, 100) is faster than your own (101) but comes later in the chain.
    expect(ref(pick(setup('pb', true, ['class'])))).toBe('class 100')
    expect(ref(pick(setup('session', true, ['pb', 'class'])))).toBe('class 100')
    // The chain never goes back...
    expect(ref(pick(setup('session', true, ['pb'])))).toBe('none')
    expect(ref(pick(setup('class', true, ['pb'])))).toBe('none')
    // ...but your own session best is a lap of your class too.
    expect(ref(pick(setup('class', true, ['pb', 'session'])))).toBe('class 101')
    // Without fallback, only the chosen one.
    expect(ref(pick(setup('pb', false, ['session', 'class'])))).toBe('none')
    expect(ref(pick(setup('class', false, ['class'])))).toBe('class 100')
  })

  it('personal best: this car on this layout, with no driver (the widget names it)', () => {
    const rig = new Rig({ reference: 'pb' })
    expect(key(rig)).toBe('67@219/Grand Prix')
    rig.bests.offer('67@219/Oval', pbLap(90))
    rig.bests.offer('80@219/Grand Prix', pbLap(80))
    expect(pick(rig).visible).toBe(false)
    const mine = new Rig({ reference: 'pb' })
    mine.bests.offer(key(mine), pbLap(99.5))
    expect(pick(mine)).toMatchObject({
      visible: true,
      reference: 'pb',
      refDriver: '',
      refSelf: false,
      refLapTime: 99.5,
      delta: 0.25
    })
  })

  it('ignores unusable laps (corrupt store data): wrong length, NaN, time going back', () => {
    const bad: LapReference[] = [
      pbLap(99, { profile: even(99).slice(0, 50) }),
      pbLap(99, { profile: even(99).map((v, i) => (i === 40 ? Number.NaN : v)) }),
      pbLap(99, { profile: even(99).map((v, i) => (i === 40 ? 1 : v)) }),
      pbLap(0, { profile: even(0) }),
      pbLap(Number.POSITIVE_INFINITY)
    ]
    for (const lap of bad) {
      const rig = new Rig({ reference: 'pb', fallback: true })
      rig.bests.offer(key(rig), lap)
      rig.race.best.set(PLAYER, lapOf(101))
      expect(pick(rig)).toMatchObject({ reference: 'session', refLapTime: 101 })
    }
    // The model's laps are checked the same way; a lap that is not clean is never a reference.
    const rig = new Rig({ reference: 'class' })
    rig.race.best.set(1, { ...lapOf(98), clean: false })
    rig.race.best.set(3, lapOf(99, 4, even(99).slice(1)))
    expect(pick(rig).visible).toBe(false)
  })

  it('class: the fastest clean lap of your class by anyone, labelled by number and name', () => {
    const rig = new Rig({ reference: 'class' })
    rig.race.best.set(PLAYER, lapOf(101))
    rig.race.best.set(1, lapOf(100.5))
    // Another class is faster, it does not count.
    rig.race.best.set(2, lapOf(95))
    rig.race.best.set(3, lapOf(100.8))
    expect(pick(rig)).toMatchObject({
      reference: 'class',
      refDriver: '#44 J. Lindqvist',
      refSelf: false,
      refLapTime: 100.5
    })
  })

  it("class: a name iRacing wrote as '?' gives way to the team's, else to the number alone", () => {
    const drivers = (o: Partial<DriverEntry>): DriverEntry[] =>
      DRIVERS.map((d) => (d.carIdx === 1 ? { ...d, ...o } : d))
    const refOf = (o: Partial<DriverEntry>): string => {
      const rig = new Rig({ reference: 'class', drivers: drivers(o) })
      rig.race.best.set(PLAYER, lapOf(101))
      rig.race.best.set(1, lapOf(100.5))
      return pick(rig).refDriver
    }
    expect(refOf({ userName: '?????? ?????', teamName: '?????? ?????' })).toBe('#44')
    expect(refOf({ userName: '?????? ?????', teamName: 'Équipe   Rouge' })).toBe('#44 Équipe Rouge')
    expect(refOf({ userName: '?????? ?????', carNumber: '' })).toBe('')
    expect(refOf({ userName: 'Jonas Lindqvist', carNumber: '' })).toBe('J. Lindqvist')
  })

  it('class: your own lap when you are the fastest (refSelf), also on a tie', () => {
    const fastest = new Rig({ reference: 'class' })
    fastest.race.best.set(PLAYER, lapOf(99))
    fastest.race.best.set(1, lapOf(100.5))
    expect(pick(fastest)).toMatchObject({ refDriver: '', refSelf: true, refLapTime: 99 })
    const tie = new Rig({ reference: 'class' })
    tie.race.best.set(3, lapOf(100))
    tie.race.best.set(PLAYER, lapOf(100))
    tie.race.best.set(1, lapOf(100))
    expect(pick(tie)).toMatchObject({ refDriver: '', refSelf: true })
    // Without you: the lowest CarIdx.
    const others = new Rig({ reference: 'class' })
    others.race.best.set(3, lapOf(100))
    others.race.best.set(1, lapOf(100))
    expect(pick(others)).toMatchObject({ refDriver: '#44 J. Lindqvist', refSelf: false })
  })

  it('switches only at the S/F line: a faster lap set mid-lap waits for your next lap', () => {
    const rig = new Rig({ reference: 'class' })
    rig.race.best.set(1, lapOf(100.5, 5))
    expect(rig.at(T0, 3, 0.3, 30.35)).toMatchObject({ refLapTime: 100.5, delta: 0.2 })
    // The same lap of car 1 with its official time: refined mid-lap (a few ms).
    rig.race.best.set(1, lapOf(100.503, 5))
    expect(rig.at(T0 + 2, 3, 0.32, 32.36)).toMatchObject({ refLapTime: 100.503, delta: 0.2 })
    // Car 3 laps faster while you are mid-lap: the delta keeps comparing with car 1.
    rig.race.best.set(3, lapOf(100, 6))
    expect(rig.at(T0 + 4, 3, 0.34, 34.37)).toMatchObject({
      refDriver: '#44 J. Lindqvist',
      refLapTime: 100.503,
      delta: 0.2
    })
    // Your next lap compares with car 3.
    expect(rig.at(T0 + 5, 4, 0.005, 0.5)).toMatchObject({
      refDriver: '#12 M. Ruiz',
      refLapTime: 100
    })
  })

  it('a personal best offered a few seconds after the line is the reference of that same lap', () => {
    const rig = new Rig({ reference: 'pb', fallback: true })
    rig.bests.offer(key(rig), pbLap(101))
    const samples = rig.drive([even(100), even(101)], {
      promote: true,
      endPct: 0.4,
      // The loop offers lap 3 (100 s) once its official time had time to arrive.
      before: (t) => {
        if (t >= T0 + 105.5) rig.bests.offer(key(rig), pbLap(100))
      }
    })
    // Lap 3 against the old record: -1.00 at the line...
    const line = samples.filter((s) => s.lap === 4 && s.pct < DELTA.guardPct)
    expect(line.every((s) => s.data.delta === -1 && s.data.refLapTime === 101)).toBe(true)
    // ...which stays the reference until the new one is stored...
    const lap4 = samples.filter((s) => s.lap === 4 && s.pct >= DELTA.guardPct)
    const early = lap4.filter((s) => s.t < T0 + 105.5)
    expect(early.length).toBeGreaterThan(90)
    expect(early.every((s) => s.data.reference === 'pb' && s.data.refLapTime === 101)).toBe(true)
    // ...then the new record, in the same lap (before its first sector line).
    const late = lap4.filter((s) => s.t >= T0 + 105.5 + DELTA.searchS + 0.05)
    expect(late.length).toBeGreaterThan(100)
    expect(late.every((s) => s.data.reference === 'pb' && s.data.refLapTime === 100)).toBe(true)
    expect(late.at(-1)?.data.sectors).toEqual([0.33, null, null])
  })

  it('a better lap that arrives once a sector is done waits for the next lap', () => {
    // A short first sector: done 2 s into the lap.
    const rig = new Rig({ reference: 'class', sectorStarts: [0, 0.02, 0.5] })
    rig.race.best.set(1, lapOf(100.5, 5))
    const samples = rig.drive([even(100)], {
      endPct: 0.1,
      before: (t) => {
        if (t >= T0 + 4) rig.race.best.set(3, lapOf(100, 6))
      }
    })
    const after = samples.filter((s) => s.t >= T0 + 4)
    expect(after.length).toBeGreaterThan(100)
    expect(after.every((s) => s.data.refLapTime === 100.5)).toBe(true)
  })

  it('a change of options mid-lap waits for the next lap start, pending meanwhile', () => {
    const rig = new Rig({ reference: 'class' })
    rig.race.best.set(1, lapOf(100.5, 5))
    rig.race.best.set(PLAYER, lapOf(101, 2))
    expect(rig.at(T0, 3, 0.3, 30.35)).toMatchObject({
      reference: 'class',
      preferred: 'class',
      pending: null
    })
    rig.opts = { ...rig.opts, ...everySession('session') }
    expect(rig.at(T0 + 0.1, 3, 0.301, 30.45)).toMatchObject({
      reference: 'class',
      preferred: 'class',
      pending: 'session',
      refLapTime: 100.5
    })
    // Chosen again before the line: nothing waits any more.
    rig.opts = { ...rig.opts, ...everySession('class') }
    expect(rig.at(T0 + 0.2, 3, 0.302, 30.55)).toMatchObject({ reference: 'class', pending: null })
    rig.opts = { ...rig.opts, ...everySession('session') }
    expect(rig.at(T0 + 0.3, 3, 0.303, 30.65).pending).toBe('session')
    // The next lap compares with it.
    expect(rig.at(T0 + 70, 4, 0.005, 0.5)).toMatchObject({
      reference: 'session',
      preferred: 'session',
      pending: null,
      refDriver: '',
      refSelf: false,
      refLapTime: 101
    })
    // A fallback switched off mid-lap waits too (nothing pending to name: the same reference).
    rig.opts = { ...rig.opts, fallback: true, ...everySession('pb') }
    expect(rig.at(T0 + 80, 4, 0.3, 30.3)).toMatchObject({ reference: 'session', pending: 'pb' })
    expect(rig.at(T0 + 150, 5, 0.005, 0.5)).toMatchObject({
      reference: 'session',
      preferred: 'pb',
      pending: null
    })
    rig.opts = { ...rig.opts, fallback: false }
    expect(rig.at(T0 + 160, 5, 0.3, 30.3)).toMatchObject({ visible: true, pending: null })
    expect(rig.at(T0 + 230, 6, 0.005, 0.5).visible).toBe(false)
  })

  it('the cycle shortcut: this session only, from the next lap, never in the options', () => {
    const rig = new Rig({ reference: 'session' })
    rig.race.best.set(1, lapOf(100.5, 5))
    rig.race.best.set(PLAYER, lapOf(101, 2))
    const saved = JSON.stringify(rig.opts)
    expect(rig.at(T0, 3, 0.3, 30.35)).toMatchObject({ reference: 'session', temporary: false })
    // Twice mid-lap: session -> optimal -> class, waiting for the line.
    expect(rig.provider.cycleReference()).toBe(true)
    expect(rig.provider.cycleReference()).toBe(true)
    expect(rig.at(T0 + 0.1, 3, 0.301, 30.45)).toMatchObject({
      reference: 'session',
      pending: 'class',
      temporary: true
    })
    expect(rig.at(T0 + 70, 4, 0.005, 0.5)).toMatchObject({
      reference: 'class',
      preferred: 'class',
      pending: null,
      temporary: true,
      refLapTime: 100.5
    })
    // A reconnect to the same session keeps it.
    rig.provider.reset()
    expect(rig.at(T0 + 71, 4, 0.01, 1.5)).toMatchObject({ reference: 'class', temporary: true })
    // The options never changed.
    expect(JSON.stringify(rig.opts)).toBe(saved)
    // Another session (or subsession): the settings' choice again.
    rig.race.key = 'race-b'
    expect(rig.at(T0 + 72, 4, 0.02, 2.5)).toMatchObject({
      reference: 'session',
      preferred: 'session',
      temporary: false
    })
  })

  it('the cycle shortcut ends with the kind of session, and back on the setting it is none', () => {
    const rig = new Rig({ reference: 'session' })
    rig.race.best.set(1, lapOf(100.5, 5))
    rig.race.best.set(PLAYER, lapOf(101, 2))
    // No session seen yet: nothing to cycle.
    expect(rig.provider.cycleReference()).toBe(false)
    rig.at(T0, 3, 0.005, 0.5)
    rig.provider.cycleReference()
    expect(rig.at(T0 + 0.1, 3, 0.006, 0.6)).toMatchObject({ preferred: 'optimal', temporary: true })
    // Another kind of session in the same sessionKey (SessionNum moved on): the default again.
    const practice = [...rig.session.sessionTypes].find(([, type]) => type === 'Practice')?.[0]
    rig.frame.SessionNum[0] = practice ?? -1
    expect(rig.at(T0 + 0.2, 3, 0.007, 0.7)).toMatchObject({
      preferred: 'session',
      temporary: false
    })
    // Round the five references and back to the setting: no override left.
    for (let i = 0; i < 5; i++) rig.provider.cycleReference()
    expect(rig.at(T0 + 0.3, 3, 0.008, 0.8)).toMatchObject({
      preferred: 'session',
      temporary: false
    })
  })

  it('with no reference in use, a change of options applies at once', () => {
    const rig = new Rig({ reference: 'pb' })
    rig.race.best.set(PLAYER, lapOf(101, 2))
    expect(rig.at(T0, 3, 0.3, 30.35).visible).toBe(false)
    rig.opts = { ...rig.opts, ...everySession('session') }
    expect(rig.at(T0 + 0.1, 3, 0.301, 30.45)).toMatchObject({
      visible: true,
      reference: 'session',
      pending: null
    })
  })

  it('carries your lap times whatever the reference: last, best, optimal and record', () => {
    const rig = new Rig({ reference: 'class' })
    rig.bests.offer(key(rig), pbLap(99.5))
    rig.race.best.set(1, lapOf(100.5, 5))
    rig.race.best.set(PLAYER, lapOf(100.8123, 2))
    rig.player({ lastLapTime: 101.2 })
    const d = rig.at(T0, 3, 0.005, 0.5)
    expect(d.laps).toEqual({ last: 101.2, best: 100.812, optimal: null, pb: 99.5 })
    // The same object while they stay (cheap to compare, nothing re-renders).
    expect(rig.at(T0 + 0.5, 3, 0.01, 1).laps).toBe(d.laps)
    // Not looked up mid-lap: a new last lap shows from the next lap start.
    rig.player({ lastLapTime: 100.1 })
    expect(rig.at(T0 + 30, 3, 0.3, 30).laps.last).toBe(101.2)
    expect(rig.at(T0 + 101, 4, 0.005, 0.5).laps.last).toBe(100.1)
    // An unclean best is no session best.
    const dirty = new Rig({ reference: 'pb' })
    dirty.bests.offer(key(dirty), pbLap(99.5))
    dirty.race.best.set(PLAYER, { ...lapOf(98), clean: false })
    expect(dirty.at(T0, 3, 0.005, 0.5).laps).toMatchObject({ best: null, pb: 99.5 })
  })

  it('looks the references up at most every refreshS while one is in use (cheap at 30 Hz)', () => {
    const drivers = Array.from({ length: 20 }, (_, i) => makeDriver(i, { carId: 67 }))
    const rig = new Rig({ reference: 'class', drivers })
    for (let i = 1; i < 20; i++) rig.race.best.set(i, lapOf(100 + i / 10, 5))
    const profile = even(100)
    rig.race.profileCalls = 0
    // 60 s mid-lap at 30 Hz: 1800 computes.
    const samples = rig.drive([profile], { t0: T0 - 20, endPct: 0.8 })
    const mid = samples.filter((s) => s.pct > 0.2)
    expect(mid.length).toBeGreaterThan(1700)
    expect(mid.every((s) => s.data.refLapTime === 100.1)).toBe(true)
    // One scan of the 20 cars per second (4 per second while the lap starts), not one per
    // compute (48000 calls).
    const scans = 80 / DELTA.refreshS + DELTA.switchS / DELTA.searchS + 2
    expect(rig.race.profileCalls).toBeLessThanOrEqual(scans * 20)
  })
})

describe('DeltaProvider: optimal references', () => {
  const ref = (d: DeltaData): string =>
    d.visible ? `${d.reference} ${(d.refLapTime ?? NaN).toFixed(2)}` : 'none'

  it('optimal: your best sectors of the session joined, nobody’s lap; sectors against the best', () => {
    const rig = new Rig({ reference: 'optimal' })
    // Lap 3 is quick in S1 and S3, lap 4 in S2: 31 + 33 + 35 = 99 s, faster than either.
    const laps = [
      [31, 34, 35],
      [33, 33, 36],
      [30.5, 33.5, 35],
      [31, 33, 35]
    ].map(split)
    const samples = rig.drive(laps, { endPct: 0.05 })
    const on = (lap: number, from: number, to = 1): Sample[] =>
      samples.filter((s) => s.lap === lap && s.pct >= from && s.pct < to)
    // Nothing to compare with on your first lap.
    expect(on(3, 0).every((s) => !s.data.visible)).toBe(true)
    // Lap 4 against lap 3, the only one so far.
    const lap4 = on(4, DELTA.guardPct)
    expect(lap4.length).toBeGreaterThan(1000)
    for (const s of lap4) {
      expect(s.data).toMatchObject({ reference: 'optimal', refDriver: '', refSelf: false })
      expect(s.data.refLapTime).toBeCloseTo(100, 9)
    }
    // At its line lap 4 still reads against lap 3: two seconds down, S2 a second up.
    const line4 = on(5, 0, DELTA.guardPct)
    expect(line4.length).toBeGreaterThan(30)
    for (const s of line4) {
      expect(s.data.delta).toBe(2)
      expect(s.data.sectors.map((v) => v?.toFixed(1))).toEqual(['2.0', '-1.0', '1.0'])
    }
    // Lap 5 against the optimal of laps 3 and 4: the predicted lap and the sectors follow it.
    const lap5 = on(5, DELTA.guardPct)
    expect(lap5.length).toBeGreaterThan(1000)
    for (const s of lap5) expect(s.data.refLapTime).toBeCloseTo(99, 9)
    const mid = lap5.find((s) => s.pct >= 0.5)?.data
    expect(mid?.sectors[0]).toBeCloseTo(-0.5, 1)
    expect(mid?.predictedLap).toBeCloseTo(99 + (mid?.delta ?? NaN), 2)
    // The same lap time as the optimal, half a second gained in S1 and lost in S2.
    for (const s of on(6, 0, DELTA.guardPct)) {
      expect(s.data.delta).toBe(0)
      expect(s.data.sectors.map((v) => v?.toFixed(1))).toEqual(['-0.5', '0.5', '0.0'])
    }
    // Lap 5's S1 (30.5 s) is a new best: lap 6 compares with 98.5.
    const lap6 = on(6, DELTA.guardPct)
    expect(lap6.length).toBeGreaterThan(10)
    for (const s of lap6) expect(s.data.refLapTime).toBeCloseTo(98.5, 9)
  })

  it('classOptimal: the best in each sector by anyone in your class, joined; nobody’s lap', () => {
    const rig = new Rig({ reference: 'classOptimal' })
    rig.race.complete(PLAYER, lapOf(100.5, 5, split([31, 34, 35.5])))
    rig.race.complete(1, lapOf(100, 6, split([30, 35, 35])))
    rig.race.complete(3, lapOf(101, 4, split([32, 33, 36])))
    // Another class is much faster: it does not count.
    rig.race.complete(2, lapOf(75, 4, split([25, 25, 25])))
    const d = rig.at(T0, 3, 0.5, 50)
    expect(d).toMatchObject({ visible: true, reference: 'classOptimal', refDriver: '' })
    expect(d.refSelf).toBe(false)
    expect(d.refLapTime).toBeCloseTo(30 + 33 + 35, 9)
    // Under the class best and your own optimal.
    const mine = new Rig({ reference: 'optimal' })
    mine.race.complete(PLAYER, lapOf(100.5, 5, split([31, 34, 35.5])))
    expect(mine.at(T0, 3, 0.5, 50).refLapTime).toBeCloseTo(100.5, 9)
  })

  it('fallback: optimal -> pb -> classOptimal, classOptimal -> pb; the class best has none', () => {
    const key = (rig: Rig): string => personalBestKey(rig.session, PLAYER) ?? ''
    const setup = (
      reference: DeltaReference,
      fallback: boolean,
      have: ('pb' | 'mine' | 'classmate')[]
    ): Rig => {
      const rig = new Rig({ reference, fallback })
      if (have.includes('pb')) rig.bests.offer(key(rig), pbLap(99))
      if (have.includes('mine')) rig.race.complete(PLAYER, lapOf(101, 4))
      if (have.includes('classmate')) rig.race.complete(1, lapOf(100, 5))
      return rig
    }
    const pick = (rig: Rig): string => ref(rig.at(T0, 3, 0.5, 50))
    expect(pick(setup('optimal', true, ['pb', 'mine', 'classmate']))).toBe('optimal 101.00')
    expect(pick(setup('optimal', true, ['pb', 'classmate']))).toBe('pb 99.00')
    expect(pick(setup('optimal', true, ['classmate']))).toBe('classOptimal 100.00')
    expect(pick(setup('optimal', true, []))).toBe('none')
    expect(pick(setup('classOptimal', true, ['pb', 'mine', 'classmate']))).toBe(
      'classOptimal 100.00'
    )
    expect(pick(setup('classOptimal', true, ['pb']))).toBe('pb 99.00')
    // Your own lap is a lap of your class.
    expect(pick(setup('classOptimal', true, ['mine']))).toBe('classOptimal 101.00')
    // Without fallback, only the chosen one.
    expect(pick(setup('optimal', false, ['pb', 'classmate']))).toBe('none')
    expect(pick(setup('classOptimal', false, ['pb']))).toBe('none')
    // The chains of the other references are as they were.
    expect(pick(setup('pb', true, ['mine']))).toBe('session 101.00')
    expect(pick(setup('session', true, ['classmate']))).toBe('class 100.00')
    expect(pick(setup('class', true, ['pb']))).toBe('none')
    // Every reference falls back from itself, never to itself again.
    expect(Object.keys(DELTA_FALLBACK).sort()).toEqual([...DELTA_REFERENCES].sort())
    for (const r of DELTA_REFERENCES) {
      const chain = DELTA_FALLBACK[r]
      expect(chain[0], r).toBe(r)
      expect(new Set(chain).size, r).toBe(chain.length)
    }
  })

  it('a best sector set mid-lap waits for your next lap; a new lap, a new optimal', () => {
    const rig = new Rig({ reference: 'classOptimal' })
    const car1 = split([30, 35, 35])
    rig.race.complete(1, lapOf(100, 5, car1))
    // 0.2 s down on car 1's lap all along S1.
    const at = (i: number): DeltaData =>
      rig.at(T0 + i, 3, 0.2 + i / 100, profileAt(car1, 0.2 + i / 100) + 0.2)
    const first = at(0)
    expect(first.refLapTime).toBeCloseTo(100, 9)
    expect(first.delta).toBe(0.2)
    // Car 3 sets a better S2 while you are mid-lap: the delta keeps comparing with car 1's lap.
    rig.race.complete(3, lapOf(101, 4, split([32, 33, 36])))
    for (let i = 1; i <= 10; i++) {
      const d = at(i)
      expect(d.refLapTime, `t=${i}`).toBe(first.refLapTime)
      expect(d.delta, `t=${i}`).toBe(0.2)
    }
    // Your next lap compares with 30 + 33 + 35.
    const next = rig.at(T0 + 11, 4, 0.005, 0.5)
    expect(next.refLapTime).toBeCloseTo(98, 9)
    expect(next.reference).toBe('classOptimal')
  })

  it('takes in the laps of your class while you are not driving', () => {
    const rig = new Rig({ reference: 'classOptimal' })
    rig.frame.IsOnTrack[0] = false
    // In the garage while car 1 laps: its best is the first lap, its last the third.
    const laps = [
      [30, 35, 35],
      [32, 33, 36],
      [33, 36, 36]
    ].map(split)
    laps.forEach((p, i) => {
      rig.race.complete(1, lapOf(p[LINES] ?? 0, 5 + i, p))
      expect(rig.at(T0 + 2 * i, 3, 0.5, 50).visible).toBe(false)
    })
    // The second lap's S2 counts although it is neither.
    rig.frame.IsOnTrack[0] = true
    expect(rig.at(T0 + 10, 3, 0.5, 50).refLapTime).toBeCloseTo(30 + 33 + 35, 9)
  })

  it('is looked up without rebuilding it per compute (cheap at 30 Hz)', () => {
    const drivers = Array.from({ length: 20 }, (_, i) => makeDriver(i, { carId: 67 }))
    for (const reference of ['optimal', 'classOptimal'] as const) {
      const rig = new Rig({ reference, drivers })
      for (let i = 0; i < 20; i++) rig.race.complete(i, lapOf(100 + i / 10, 5))
      rig.race.profileCalls = 0
      // 60 s mid-lap at 30 Hz: 1800 computes, no lap completed.
      const samples = rig.drive([even(100)], { t0: T0 - 20, endPct: 0.8 })
      const mid = samples.filter((s) => s.pct > 0.2)
      expect(mid.length).toBeGreaterThan(1700)
      expect(mid.every((s) => s.data.refLapTime === mid[0]?.data.refLapTime)).toBe(true)
      expect(mid[0]?.data.refLapTime).toBeCloseTo(100, 9)
      // Each car's last and best lap read once, at the first scan, and your best once for the
      // lap times; then nothing.
      expect(rig.race.profileCalls, reference).toBeLessThanOrEqual(20 * 2 + 1)
    }
  })

  it('starts over in a new session: the laps of the last one are not an optimal any more', () => {
    const rig = new Rig({ reference: 'optimal' })
    rig.race.complete(PLAYER, lapOf(100, 5))
    expect(rig.at(T0, 3, 0.5, 50).visible).toBe(true)
    // The next session: the model starts over (no laps yet).
    rig.race.key = 'race-b'
    rig.race.last.clear()
    rig.race.best.clear()
    rig.player({})
    expect(rig.at(T0 + 1, 1, 0.5, 50).visible).toBe(false)
  })

  it('falls back to your record until the optimal exists, then switches at a lap start only', () => {
    // Class optimal: a classmate's first lap mid-lap waits for your next lap.
    const cls = new Rig({ reference: 'classOptimal', fallback: true })
    cls.bests.offer(personalBestKey(cls.session, PLAYER) ?? '', pbLap(99))
    expect(cls.at(T0, 3, 0.3, 30)).toMatchObject({ reference: 'pb', refLapTime: 99 })
    cls.race.complete(1, lapOf(100, 5, split([30, 35, 35])))
    // A second down on the record all along.
    for (let i = 1; i <= 10; i++) {
      const pct = 0.3 + i / 100
      expect(cls.at(T0 + i, 3, pct, 99 * pct + 1), `t=${i}`).toMatchObject({
        reference: 'pb',
        refLapTime: 99,
        delta: 1
      })
    }
    expect(cls.at(T0 + 72, 4, 0.005, 0.5)).toMatchObject({
      reference: 'classOptimal',
      refLapTime: 100
    })
    // Your optimal: your record on your first lap, your first clean lap from the next one on.
    const own = new Rig({ reference: 'optimal', fallback: true })
    own.bests.offer(personalBestKey(own.session, PLAYER) ?? '', pbLap(99))
    const samples = own.drive([even(101), even(100)], { endPct: 0.9 })
    const lap3 = samples.filter((s) => s.lap === 3)
    expect(lap3.length).toBeGreaterThan(2900)
    expect(lap3.every((s) => s.data.reference === 'pb' && s.data.refLapTime === 99)).toBe(true)
    const lap4 = samples.filter((s) => s.lap === 4 && s.pct >= DELTA.guardPct)
    expect(lap4.length).toBeGreaterThan(2500)
    for (const s of lap4) {
      expect(s.data).toMatchObject({ reference: 'optimal', refDriver: '', refSelf: false })
      expect(s.data.refLapTime).toBe(101)
    }
  })

  it('a class of one: the class optimal is your optimal', () => {
    // You alone in your class; the others are faster, in another one.
    const drivers = DRIVERS.map((d) => (d.carIdx === PLAYER ? { ...d, classId: 9 } : d))
    const run = (reference: DeltaReference): DeltaData => {
      const rig = new Rig({ reference, drivers })
      rig.race.complete(PLAYER, lapOf(100, 3, split([30, 35, 35])))
      rig.race.complete(PLAYER, lapOf(100, 4, split([32, 33, 35])))
      rig.race.complete(1, lapOf(90, 5, split([30, 30, 30])))
      return rig.at(T0, 5, 0.5, 50)
    }
    const mine = run('optimal')
    const cls = run('classOptimal')
    expect(mine.refLapTime).toBeCloseTo(98, 9)
    expect(cls).toMatchObject({ visible: true, reference: 'classOptimal', refDriver: '' })
    expect(cls.refSelf).toBe(false)
    expect(cls.refLapTime).toBe(mine.refLapTime)
    expect(cls.delta).toBe(mine.delta)
  })
})

describe('DeltaProvider: the S/F line', () => {
  it('shows the lap just finished in the first guardPct of the next one, with every sector', () => {
    const rig = new Rig()
    rig.race.best.set(PLAYER, lapOf(100))
    // 1 % slower everywhere: +0.33 per 33 % sector, +1.00 on the lap.
    const samples = rig.drive([even(101), even(101)], { endPct: 0.05 })
    const lap3 = samples.filter((s) => s.lap === 3)
    const at = (pct: number): Sample | undefined => lap3.find((s) => s.pct >= pct)
    expect(at(0.5)?.data.delta).toBeCloseTo(0.5, 2)
    expect(at(0.5)?.data.sectors).toEqual([0.33, null, null])
    expect(at(0.7)?.data.sectors).toEqual([0.33, 0.33, null])
    expect(lap3.at(-1)?.data.delta).toBeCloseTo(1, 1)
    expect(lap3.every((s) => s.data.lapState === 'valid')).toBe(true)

    const line = samples.filter((s) => s.lap === 4 && s.pct < DELTA.guardPct)
    expect(line.length).toBeGreaterThan(30)
    for (const s of line) {
      expect(s.data, `pct=${s.pct}`).toEqual({
        visible: true,
        reference: 'session',
        refDriver: '',
        refSelf: false,
        refLapTime: 100,
        delta: 1,
        trend: 0,
        predictedLap: 101,
        sectors: [0.33, 0.33, 0.34],
        lapState: 'valid',
        preferred: 'session',
        pending: null,
        temporary: false,
        laps: s.data.laps,
        bars: NO_BARS,
        barTrends: NO_BAR_TRENDS
      })
    }
    // Your times as they were at the line: the best is the model's, the optimal your laps'.
    expect(line[0]?.data.laps).toMatchObject({ last: null, best: 100, pb: null })
    // Then the new lap, live.
    const after = samples.filter((s) => s.lap === 4 && s.pct >= DELTA.guardPct)
    expect(after.length).toBeGreaterThan(0)
    expect(after[0]?.data.sectors).toEqual([null, null, null])
    expect(after[0]?.data.delta).toBeCloseTo(0.02, 2)
  })

  it('a new session best becomes the reference of the next lap; the line still shows the old one', () => {
    const rig = new Rig()
    rig.race.best.set(PLAYER, lapOf(100))
    // Lap 3 is faster (99 s) and becomes your best at the line.
    const samples = rig.drive([even(99), even(99)], { promote: true, endPct: 0.05 })
    const line = samples.filter((s) => s.lap === 4 && s.pct < DELTA.guardPct)
    expect(line.every((s) => s.data.refLapTime === 100 && s.data.delta === -1)).toBe(true)
    const after = samples.filter((s) => s.lap === 4 && s.pct >= DELTA.guardPct)
    expect(after.every((s) => s.data.refLapTime === 99 && s.data.delta === 0)).toBe(true)
  })

  it('without a summary (a gap in the computes) the last delta holds', () => {
    const rig = new Rig()
    rig.race.best.set(PLAYER, lapOf(100))
    expect(rig.at(T0, 3, 0.9, 90.5).delta).toBe(0.5)
    // The widget was off for a while: nothing to summarise, the last value holds at the line.
    expect(rig.at(T0 + 12, 4, 0.01, 1.5)).toMatchObject({ delta: 0.5, predictedLap: 100.5 })
    expect(rig.at(T0 + 12.5, 4, 0.025, 2.6).delta).toBe(0.1)
  })

  it('a lap counter out of step with the pct (impossible delta) holds the last value', () => {
    const rig = new Rig()
    rig.race.best.set(PLAYER, lapOf(100))
    expect(rig.at(T0, 3, 0.5, 50.2).delta).toBe(0.2)
    // The counter says a new lap but the pct is still mid-lap: -50 s is not a delta.
    const glitch = rig.at(T0 + 1 / 30, 4, 0.5003, 0.01)
    expect(glitch.delta).toBe(0.2)
    expect(glitch.trend).toBe(0)
  })

  it('after the chequered flag the last lap stays on show', () => {
    const rig = new Rig()
    rig.race.best.set(PLAYER, lapOf(100))
    const samples = rig.drive([even(100.6)], { endPct: 0.999 })
    const end = samples.at(-1)
    expect(end?.data.delta).toBeCloseTo(0.6, 1)
    // The model closes the lap and stops timing you: no lap in progress any more.
    rig.race.last.set(PLAYER, lapOf(100.6, 3))
    rig.player({ finished: true })
    const t = (end?.t ?? 0) + 0.2
    const done = { delta: 0.6, predictedLap: 100.6, sectors: [0.2, 0.2, 0.2], lapState: 'valid' }
    expect(rig.at(t, null, 0.001)).toMatchObject(done)
    expect(rig.at(t + 20, null, 0.15)).toMatchObject(done)
  })

  it('after your flag without a lap to show, nothing (not the last delta held)', () => {
    const rig = new Rig()
    rig.race.best.set(PLAYER, lapOf(100))
    rig.at(T0, 3, 0.5, 50.5)
    rig.player({ finished: true })
    expect(rig.at(T0 + 0.5, null, 0.6)).toMatchObject({ visible: false, delta: null })
  })
})

describe('DeltaProvider: the cool-down lap outside races (B14)', () => {
  const QUALIFY = 5

  /** A lone qualifying: the RaceModel keeps timing after the flag there (it does in races). */
  function qualifying(): Rig {
    const rig = new Rig()
    rig.session = { ...rig.session, sessionTypes: new Map([[QUALIFY, 'Lone Qualify']]) }
    rig.frame.SessionNum[0] = QUALIFY
    rig.frame.SessionLapsRemainEx[0] = 2
    rig.race.best.set(PLAYER, lapOf(100))
    return rig
  }

  const finished = { delta: 0.6, predictedLap: 100.6, sectors: [0.2, 0.2, 0.2] }

  it('a lap started once the chequered flag is out shows the lap before it, all of it', () => {
    // Online: the flag came out mid flying lap; the cool-down lap read +5.86, +22.3, +25.1 s.
    const rig = qualifying()
    const samples = rig.drive([even(100.6), even(130), even(130)], {
      endPct: 0.5,
      before: (_t, lap, pct) => {
        if (lap === 3 && pct >= 0.6) rig.frame.SessionFlags[0] = SessionFlag.Checkered
      }
    })
    const flying = samples.filter((s) => s.lap === 3 && s.pct > 0.7)
    expect(flying.every((s) => s.data.delta !== null && s.data.lapState === 'valid')).toBe(true)
    const coolDown = samples.filter((s) => s.lap >= 4)
    expect(coolDown.length).toBeGreaterThan(30 * 150)
    for (const s of coolDown) {
      expect(s.data, `lap ${s.lap} pct ${s.pct}`).toMatchObject({ visible: true, ...finished })
    }
  })

  it('also when the laps run out (SessionLapsRemainEx 0 with the crossing)', () => {
    const rig = qualifying()
    const samples = rig.drive([even(100.6), even(130)], {
      endPct: 0.9,
      before: (_t, lap) => {
        rig.frame.SessionLapsRemainEx[0] = lap >= 4 ? 0 : 1
      }
    })
    for (const s of samples.filter((x) => x.lap === 4)) {
      expect(s.data).toMatchObject({ visible: true, ...finished, lapState: 'valid' })
    }
  })

  it('a flag or 0 laps left as you start following: every lap is a cool-down lap', () => {
    const rig = qualifying()
    rig.frame.SessionState[0] = SessionState.Checkered
    expect(rig.at(T0, 4, 0.5, 60)).toMatchObject({ visible: false, delta: null })
  })

  it("in a race the lap after the flag is the model's to stop timing, not this rule", () => {
    const rig = new Rig()
    rig.race.best.set(PLAYER, lapOf(100))
    rig.frame.SessionFlags[0] = SessionFlag.Checkered
    rig.frame.SessionLapsRemainEx[0] = 0
    expect(rig.at(T0, 4, 0.5, 50.5)).toMatchObject({ visible: true, delta: 0.5 })
  })
})

describe('DeltaProvider: the lap state (B15)', () => {
  it('no lap in progress: nothing on the grid or before your first line; out and tow said', () => {
    const rig = new Rig()
    rig.race.best.set(PLAYER, lapOf(100))
    // The grid (online: INVALID LAP on the grid, the out lap from the pits and the tow).
    expect(rig.at(T0, null, 0.97)).toMatchObject({ visible: true, delta: null, lapState: 'none' })
    // Being towed.
    rig.frame.PlayerCarTowTime[0] = 42
    expect(rig.at(T0 + 1, null, 0.01).lapState).toBe('tow')
    rig.frame.PlayerCarTowTime[0] = 0
    // In the box after it, then the out lap from the pit exit (the model has no lap until the
    // line after a tow).
    rig.player({ inPits: true })
    expect(rig.at(T0 + 2, null, 0.01).lapState).toBe('none')
    rig.player({ outLap: true })
    expect(rig.at(T0 + 3, null, 0.05).lapState).toBe('out')
  })

  it('a timed out lap is the out lap, at the line too; the next one is a lap again', () => {
    const rig = new Rig()
    rig.race.best.set(PLAYER, lapOf(100))
    const samples = rig.drive([even(100), even(100)], {
      endPct: 0.5,
      before: (_t, lap, pct) => rig.player({ outLap: lap === 3 && pct >= 0.1 })
    })
    const state = (lap: number, from: number, to: number): string[] => [
      ...new Set(
        samples
          .filter((s) => s.lap === lap && s.pct >= from && s.pct < to)
          .map((s) => s.data.lapState)
      )
    ]
    expect(state(3, 0, 0.1)).toEqual(['valid'])
    expect(state(3, 0.1, 1)).toEqual(['out'])
    expect(state(4, 0, DELTA.guardPct)).toEqual(['out'])
    expect(state(4, DELTA.guardPct, 1)).toEqual(['valid'])
  })
})

describe('DeltaProvider: sectors and lap validity', () => {
  it('a sector is unknown when its start or end line was not seen (a gap in the computes)', () => {
    const rig = new Rig()
    rig.race.best.set(PLAYER, lapOf(100))
    rig.at(T0, 3, 0.2, 20.1)
    // 2 s without computes across the S1/S2 line.
    rig.at(T0 + 2, 3, 0.4, 40.3)
    expect(rig.at(T0 + 2.1, 3, 0.401, 40.4).sectors).toEqual([null, null, null])
    // S2 has no start, S3 not finished either.
    const later = rig.at(T0 + 28, 3, 0.67, 67.5)
    expect(later.sectors).toEqual([null, null, null])
  })

  it('no sectors in the session info: none in the payload', () => {
    const rig = new Rig({ sectorStarts: [] })
    rig.race.best.set(PLAYER, lapOf(100))
    expect(rig.at(T0, 3, 0.5, 50).sectors).toEqual([])
  })

  it('pit road, off track, a stop or a full-course caution invalidate the lap until the line', () => {
    const cases: [string, (rig: Rig, on: boolean) => void][] = [
      ['pits', (rig, on) => rig.player({ inPits: on })],
      ['off track', (rig, on) => rig.player({ offTrack: on })],
      // The model's own rule (60 Hz, your incidents): an off-track between two computes too.
      ['lap rule', (rig, on) => rig.player({ lapInvalid: on })],
      ['stopped', (rig, on) => rig.player({ stoppedForS: on ? 0.5 : 0 })],
      ['out lap', (rig, on) => rig.player({ outLap: on })],
      [
        'caution',
        (rig, on) => {
          rig.frame.SessionFlags[0] = on ? SessionFlag.Caution : 0
        }
      ],
      [
        'parade lap',
        (rig, on) => {
          rig.frame.SessionState[0] = on ? SessionState.ParadeLaps : SessionState.Racing
        }
      ]
    ]
    for (const [name, set] of cases) {
      const rig = new Rig()
      rig.race.best.set(PLAYER, lapOf(100))
      const samples = rig.drive([even(100), even(100)], {
        endPct: 0.1,
        before: (_t, lap, pct) => set(rig, lap === 3 && pct >= 0.4 && pct < 0.42)
      })
      const valid = (from: number, to: number, lap: number): boolean[] =>
        samples
          .filter((s) => s.lap === lap && s.pct >= from && s.pct < to)
          .map((s) => s.data.lapState === 'valid')
      expect(valid(0, 0.4, 3).every(Boolean), name).toBe(true)
      expect(valid(0.4, 1, 3).some(Boolean), name).toBe(false)
      // The line shows the lap as it was; the next one starts valid.
      expect(valid(0, DELTA.guardPct, 4).some(Boolean), name).toBe(false)
      expect(valid(DELTA.guardPct, 1, 4).every(Boolean), name).toBe(true)
    }
  })
})

describe('DeltaProvider: trend', () => {
  it('positive while losing time, negative while gaining, 0 at the same pace', () => {
    const trendOf = (lapTime: number): number[] => {
      const rig = new Rig()
      rig.race.best.set(PLAYER, lapOf(100))
      return rig
        .drive([even(lapTime)], { endPct: 0.5 })
        .filter((s) => s.t - T0 > 3)
        .map((s) => s.data.trend)
    }
    // d(delta)/dt = 1 - 100 / lapTime.
    expect(new Set(trendOf(102))).toEqual(new Set([0.02]))
    expect(new Set(trendOf(98))).toEqual(new Set([-0.02]))
    expect(new Set(trendOf(100))).toEqual(new Set([0]))
  })

  it('reacts within about a second of a change of pace', () => {
    const rig = new Rig()
    // A reference that was quick in the first half and slow in the second (40 + 60 s).
    const ref = Array.from({ length: LINES + 1 }, (_, i) =>
      i <= 50 ? 0.8 * i : 40 + 1.2 * (i - 50)
    )
    rig.race.best.set(PLAYER, lapOf(100, 2, ref))
    const samples = rig.drive([even(100)], { endPct: 0.7 })
    // First half: 1 s per line against 0.8, losing 0.2 s/s; second half gaining 0.2 s/s.
    const t50 = samples.find((s) => s.pct >= 0.5)?.t ?? 0
    const before = samples.filter((s) => s.t > t50 - 5 && s.t < t50)
    expect(before.length).toBeGreaterThan(100)
    expect(before.every((s) => s.data.trend === 0.2)).toBe(true)
    const after = samples.filter((s) => s.t > t50 + 2)
    expect(after.length).toBeGreaterThan(100)
    expect(after.every((s) => s.data.trend <= -0.19 && s.data.trend >= -0.2)).toBe(true)
  })
})

describe('DeltaProvider: state', () => {
  it('starts over on a new session (sessionKey), when SessionTime goes back, or on reset()', () => {
    for (const restart of ['key', 'time', 'reset'] as const) {
      const rig = new Rig({ reference: 'class' })
      rig.race.best.set(1, lapOf(100.5, 5))
      expect(rig.at(T0, 3, 0.3, 30.35).refLapTime).toBe(100.5)
      // A faster class lap appears mid-lap: only a restart takes it at once.
      rig.race.best.set(3, lapOf(100, 6))
      expect(rig.at(T0 + 0.1, 3, 0.301, 30.45).refLapTime).toBe(100.5)
      let t = T0 + 0.2
      if (restart === 'key') rig.race.key = 'race-b'
      else if (restart === 'time') t = T0 - 50
      else rig.provider.reset()
      expect(rig.at(t, 3, 0.302, 30.55).refLapTime, restart).toBe(100)
    }
  })

  it('follows a change of player car (PlayerCarIdx)', () => {
    const rig = new Rig()
    rig.race.best.set(PLAYER, lapOf(100))
    rig.race.best.set(3, lapOf(102))
    expect(rig.at(T0, 3, 0.5, 50).refLapTime).toBe(100)
    rig.frame.PlayerCarIdx[0] = 3
    rig.race.current.set(3, { lap: 7, elapsedS: 51 })
    rig.frame.CarIdxLapDistPct[3] = 0.5
    rig.frame.SessionTime[0] = T0 + 0.1
    expect(rig.compute()).toMatchObject({ refLapTime: 102, delta: 0 })
  })

  it('every payload is a fresh object (the loop keeps the last one as prev)', () => {
    const rig = new Rig()
    rig.race.best.set(PLAYER, lapOf(100))
    const samples = rig.drive([even(101), even(101)], { endPct: 0.01 })
    const line = samples.filter((s) => s.lap === 4)
    expect(line.length).toBeGreaterThan(2)
    expect(line[0]?.data).not.toBe(line[1]?.data)
    expect(line[0]?.data.sectors).not.toBe(line[1]?.data.sectors)
    expect(line[0]?.data).toEqual(line[1]?.data)
  })
})

/** The process-wide gc() even without --expose-gc, or null if V8 refuses. */
function exposeGc(): (() => void) | null {
  try {
    setFlagsFromString('--expose-gc')
    const gc: unknown = runInNewContext('gc')
    return typeof gc === 'function' ? (gc as () => void) : null
  } catch {
    return null
  }
}

describe('DeltaProvider: long runs', () => {
  it('keeps nothing per lap or per compute: the heap does not grow over 60 laps at 30 Hz', () => {
    const gc = exposeGc()
    const rig = new Rig({ reference: 'pb', fallback: true })
    rig.race.best.set(1, lapOf(30.4, 5))
    // 30-s laps a tenth apart, a new personal best now and then.
    const laps = Array.from({ length: 60 }, (_, i) => even(30 + ((i * 7) % 5) / 10 - i / 1000))
    const key = personalBestKey(rig.session, PLAYER) ?? ''
    const heap: number[] = []
    let seen = 0
    let computes = 0
    rig.drive(laps, {
      keep: false,
      promote: true,
      before: (_t, lap) => {
        computes++
        if (lap === seen) return
        seen = lap
        // The loop stores your clean laps as records.
        const last = rig.race.last.get(PLAYER)
        if (last)
          rig.bests.offer(key, { lapTime: last.lapTime, profile: last.profile, recordedAt: '' })
        if (gc && (lap === 13 || lap === 62)) {
          gc()
          heap.push(process.memoryUsage().heapUsed)
        }
      }
    })
    expect(computes).toBeGreaterThan(50_000)
    // Still working, against the best of those laps.
    const best = Math.min(...laps.map((l) => l[LINES] ?? Infinity))
    expect(rig.at(T0 + 9000, 70, 0.5, 15)).toMatchObject({
      visible: true,
      reference: 'pb',
      refLapTime: best
    })
    if (heap.length === 2) {
      expect((heap[1] ?? 0) - (heap[0] ?? 0)).toBeLessThan(1_000_000)
    }
  })

  it('the optimal laps keep one lap per sector per car: no growth over 60 laps of new bests', () => {
    const gc = exposeGc()
    for (const reference of ['optimal', 'classOptimal'] as const) {
      const rig = new Rig({ reference })
      // 30-s laps whose sectors take turns at being the best: a new optimal most laps.
      const times = (i: number): number[] =>
        [0, 1, 2].map((k) => 10 + ((i + k * 3) % 7) / 20 - i / 5000)
      const laps = Array.from({ length: 60 }, (_, i) => split(times(i)))
      const heap: number[] = []
      const optimals = new Set<number>()
      let seen = 0
      rig.drive(laps, {
        keep: false,
        before: (_t, lap) => {
          if (lap === seen) return
          seen = lap
          // A classmate laps alongside.
          rig.race.complete(1, lapOf(30.2, lap, split(times(lap + 3).map((v) => v + 0.05))))
          if (gc && (lap === 13 || lap === 62)) {
            gc()
            heap.push(process.memoryUsage().heapUsed)
          }
        },
        after: (d) => {
          if (d.visible && d.refLapTime !== null) optimals.add(d.refLapTime)
        }
      })
      // Rebuilt many times, against an ever better optimal.
      expect(optimals.size, reference).toBeGreaterThan(5)
      const best = Math.min(...optimals)
      for (let k = 0; k < 60; k++) expect(best).toBeLessThanOrEqual(laps[k]?.[LINES] ?? 0)
      if (heap.length === 2) {
        expect((heap[1] ?? 0) - (heap[0] ?? 0), reference).toBeLessThan(1_000_000)
      }
    }
  })
})

describe('deltaEqual', () => {
  const base: DeltaData = {
    visible: true,
    reference: 'pb',
    refDriver: '',
    refSelf: false,
    refLapTime: 92.5,
    delta: -0.12,
    trend: 0.01,
    predictedLap: 92.38,
    sectors: [-0.05, null, null],
    lapState: 'valid',
    preferred: 'pb',
    pending: null,
    temporary: false,
    laps: { last: 93.1, best: 92.5, optimal: 92.2, pb: 92.5 },
    bars: NO_BARS,
    barTrends: { pb: 0.01 }
  }

  it('compares every field, sectors element by element', () => {
    expect(deltaEqual(base, structuredClone(base))).toBe(true)
    const changes: Partial<DeltaData>[] = [
      { visible: false },
      { reference: 'session' },
      { refDriver: '#44 J. Lindqvist' },
      { refSelf: true },
      { refLapTime: 92.51 },
      { delta: -0.13 },
      { delta: null },
      { trend: 0 },
      { predictedLap: null },
      { sectors: [-0.05, 0.02, null] },
      { sectors: [-0.05, null] },
      { lapState: 'invalid' },
      { lapState: 'out' },
      { lapState: 'none' },
      { preferred: 'optimal' },
      { pending: 'class' },
      { laps: { last: 93.2, best: 92.5, optimal: 92.2, pb: 92.5 } },
      { laps: { last: 93.1, best: 92.4, optimal: 92.2, pb: 92.5 } },
      { laps: { last: 93.1, best: 92.5, optimal: null, pb: 92.5 } },
      { laps: { last: 93.1, best: 92.5, optimal: 92.2, pb: null } },
      { bars: { ...NO_BARS, pb: -0.1 } },
      { bars: { ...NO_BARS, classOptimal: 0 } },
      { barTrends: { pb: 0.02 } },
      { barTrends: { pb: 0.01, session: 0 } },
      { barTrends: {} }
    ]
    for (const c of changes)
      expect(deltaEqual({ ...base, ...c }, base), JSON.stringify(c)).toBe(false)
  })
})

/** The rig with the bars per reference shown, for `refs` (the 'refs' row's eye on). */
function withBars(rig: Rig, refs: readonly DeltaReference[]): Rig {
  rig.opts = {
    ...rig.opts,
    rows: setElementVisible(rig.opts.rows, 'refs', true),
    refBars: DELTA_REFERENCES.map((id) => ({ id, visible: refs.includes(id) }))
  }
  return rig
}

describe('DeltaProvider: the bars per reference (request 4)', () => {
  it('computes nothing while the row is hidden (the default)', () => {
    const rig = new Rig()
    rig.race.best.set(PLAYER, lapOf(100))
    expect(rig.at(T0, 3, 0.5, 50.5).bars).toBe(NO_BARS)
    // Shown references with the row hidden: still nothing.
    rig.opts = { ...rig.opts, refBars: DELTA_REFERENCES.map((id) => ({ id, visible: true })) }
    expect(rig.at(T0 + 0.5, 3, 0.505, 51).bars).toBe(NO_BARS)
  })

  it('gives each shown reference its own delta, the others null', () => {
    const rig = withBars(new Rig(), ['pb', 'session', 'class'])
    rig.race.best.set(PLAYER, lapOf(100))
    rig.race.best.set(1, lapOf(98, 4))
    rig.bests.offer(personalBestKey(rig.session, PLAYER) ?? '', pbLap(99))
    const d = rig.at(T0, 3, 0.5, 50.5)
    expect(d.delta).toBe(0.5)
    expect(d.bars).toEqual({ pb: 1, session: 0.5, optimal: null, class: 1.5, classOptimal: null })
    // Hiding a reference's bar forgets it at once; the order of the list changes nothing.
    rig.opts = { ...rig.opts, refBars: [...rig.opts.refBars].reverse() }
    expect(rig.at(T0 + 0.5, 3, 0.5, 50.5).bars).toEqual({
      pb: 1,
      session: 0.5,
      optimal: null,
      class: 1.5,
      classOptimal: null
    })
    withBars(rig, ['class'])
    expect(rig.at(T0 + 1, 3, 0.5, 50.5).bars).toEqual({ ...NO_BARS, class: 1.5 })
  })

  it('has no fallback: a reference without a lap is null, and taken as soon as it has one', () => {
    const rig = withBars(new Rig({ reference: 'session' }), ['pb', 'optimal'])
    rig.race.best.set(PLAYER, lapOf(100))
    expect(rig.at(T0, 3, 0.5, 50.5).bars).toEqual(NO_BARS)
    rig.bests.offer(personalBestKey(rig.session, PLAYER) ?? '', pbLap(99))
    // Looked up with the references (DELTA.refreshS): a bar with none takes it mid-lap.
    expect(rig.at(T0 + DELTA.refreshS, 3, 0.51, 51.49).bars).toEqual({ ...NO_BARS, pb: 1 })
  })

  it('keeps its lap for the whole lap, and takes a newer one at the next lap start', () => {
    const rig = withBars(new Rig(), ['pb'])
    rig.race.best.set(PLAYER, lapOf(100))
    const key = personalBestKey(rig.session, PLAYER) ?? ''
    rig.bests.offer(key, pbLap(99))
    expect(rig.at(T0, 3, 0.5, 50.5).bars.pb).toBe(1)
    // A faster record mid-lap: the bar still compares with the lap it started with.
    rig.bests.offer(key, pbLap(97))
    expect(rig.at(T0 + 2, 3, 0.52, 52.48).bars.pb).toBe(1)
    // At the line the lap just finished shows against that same lap (as the main delta)...
    rig.at(T0 + 2.5, 3, 0.995, 99.5)
    rig.race.close(PLAYER, lapOf(100.5, 3))
    expect(rig.at(T0 + 3, 4, 0.005, 0.5).bars.pb).toBe(1.5)
    // ...then the new lap compares with the new record.
    expect(rig.at(T0 + 12, 4, 0.1, 10).bars.pb).toBe(0.3)
  })

  it('holds where the main delta holds, and is null with no lap in progress', () => {
    const rig = withBars(new Rig(), ['session'])
    rig.race.best.set(PLAYER, lapOf(100))
    expect(rig.at(T0, 3, 0.5, 50.5).bars.session).toBe(0.5)
    // An impossible gain (a glitch): the last value holds, as the hero's.
    expect(rig.at(T0 + 0.5, 3, 0.505, 0.2).bars.session).toBe(0.5)
    expect(rig.at(T0 + 1, null, 0.51).bars.session).toBeNull()
  })

  it('gives each bar its own trend, smoothed as the main one', () => {
    const rig = withBars(new Rig({ reference: 'session' }), ['pb', 'session', 'class'])
    rig.race.best.set(PLAYER, lapOf(100))
    // A class best 2 s quicker, a record (an older car setup) 2 s slower: driven at the session
    // best's pace you lose 0.02 s per second on the class best and gain as much on the record.
    rig.bests.offer(personalBestKey(rig.session, PLAYER) ?? '', pbLap(102))
    rig.race.best.set(1, lapOf(98, 4))
    const late = rig.drive([even(100)], { endPct: 0.5 }).filter((s) => s.t - T0 > 3)
    expect(late.length).toBeGreaterThan(50)
    for (const s of late) {
      expect(s.data.barTrends).toEqual({ pb: -0.02, session: 0, class: 0.02 })
      // The bar of the reference in use follows the main trend.
      expect(s.data.barTrends.session).toBe(s.data.trend)
    }
  })

  it("starts each bar's trend over where its value holds, and computes none without bars", () => {
    const rig = withBars(new Rig(), ['session'])
    rig.race.best.set(PLAYER, lapOf(100))
    rig.at(T0, 3, 0.5, 50.5)
    expect(rig.at(T0 + 0.5, 3, 0.505, 51.5).barTrends.session).toBeGreaterThan(0)
    // An impossible gain (a glitch): the value holds, the trend reads 0 and starts over.
    expect(rig.at(T0 + 1, 3, 0.51, 0.2).barTrends).toEqual({ session: 0 })
    // No lap in progress: 0.
    expect(rig.at(T0 + 1.5, null, 0.515).barTrends).toEqual({ session: 0 })
    // The row hidden: no trend at all.
    rig.opts = { ...rig.opts, rows: setElementVisible(rig.opts.rows, 'refs', false) }
    expect(rig.at(T0 + 2, 3, 0.52, 52).barTrends).toBe(NO_BAR_TRENDS)
  })
})

describe('DeltaProvider: legal laps only (request 4)', () => {
  it('a lap that turns unclean just after its line is never the reference, nor your best', () => {
    const rig = new Rig({ reference: 'session' })
    rig.race.best.set(PLAYER, lapOf(100))
    rig.race.close(PLAYER, lapOf(100))
    rig.at(T0, 3, 0.98, 98)
    rig.at(T0 + 0.5, 3, 0.995, 99.5)
    // Lap 3 in 99.0, clean at the line: the new session best, the reference of lap 4.
    const lap3 = lapOf(99, 3)
    rig.race.complete(PLAYER, lap3)
    const line = rig.at(T0 + 1, 4, 0.004, 0.4)
    expect(line).toMatchObject({ delta: -1, lapState: 'valid', refLapTime: 100 })
    expect(rig.at(T0 + 1.1, 4, 0.005, 0.5).laps.best).toBe(99)
    // An incident scored 0.2 s after the line: the model takes lap 3 back.
    rig.race.close(PLAYER, { ...lap3, clean: false })
    rig.race.best.set(PLAYER, lapOf(100))
    rig.player({ ...rig.race.view.car(PLAYER), lapInvalid: true })
    const after = rig.at(T0 + 1.4, 4, 0.008, 0.8)
    // The summary of lap 3 now says it won't count.
    expect(after).toMatchObject({ delta: -1, lapState: 'invalid' })
    expect(after.laps.best).toBe(100)
    // Lap 4 runs against lap 2, the legal best.
    const live = rig.at(T0 + 5, 4, 0.05, 5)
    expect(live.refLapTime).toBe(100)
    expect(live.delta).toBe(0)
  })

  it('a bar never compares with an unclean lap, however fast', () => {
    const rig = withBars(new Rig({ reference: 'class' }), ['session', 'class'])
    // Your only lap went off track: no session best; someone else's clean lap is the class's.
    rig.race.close(PLAYER, { ...lapOf(95, 2), clean: false })
    rig.race.complete(1, lapOf(101, 2))
    rig.race.complete(3, { ...lapOf(94, 2), clean: false })
    const d = rig.at(T0, 3, 0.5, 50)
    expect(d.refLapTime).toBe(101)
    expect(d.bars).toEqual({ ...NO_BARS, class: -0.5 })
  })
})
