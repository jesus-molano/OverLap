import { describe, expect, it } from 'vitest'
import { EMPTY_RACE_VIEW } from '../race/emptyRaceView'
import { RACE_TIMING_LINES } from '../race/raceView'
import type { LapRecord, RaceCarState, RaceView } from '../race/raceView'
import { makeDriver, makeSession } from '../race/testing/raceSim'
import type { SessionMeta } from '../types'
import { sectorLines } from './delta'
import { OptimalLaps } from './optimal'
import { usableLap } from './references'

const LINES = RACE_TIMING_LINES
/** Three sectors starting at 0, 33 % and 66 % of the lap. */
const THIRDS = sectorLines([0, 0.33, 0.66])

interface Lap {
  lap: number
  lapTime: number
  clean: boolean
  profile: readonly number[]
}

/** A lap driven at a constant speed within each sector: `times[k]` seconds in sector k. */
function lapOf(lap: number, times: readonly number[], lines = THIRDS, clean = true): Lap {
  const starts = lines.length > 0 ? lines : [0]
  const profile = [0]
  let at = 0
  for (let k = 0; k < starts.length; k++) {
    const a = starts[k] ?? 0
    const b = starts[k + 1] ?? LINES
    const t = times[k] ?? 0
    for (let i = a + 1; i <= b; i++) profile.push(at + (t * (i - a)) / (b - a))
    at += t
  }
  return { lap, lapTime: profile[LINES] ?? 0, clean, profile }
}

/** Seconds of sector k (start lines `lines`) on a profile. */
function sector(profile: readonly number[], k: number, lines = THIRDS): number {
  return (profile[lines[k + 1] ?? LINES] ?? NaN) - (profile[lines[k] ?? 0] ?? NaN)
}

const BASE: Omit<RaceCarState, 'carIdx' | 'laps'> = {
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
  pace: 100,
  speed: 0.01,
  stoppedForS: 0,
  lapInvalid: false,
  sessionFlags: 0
}

/** The cars' lap records and lap profiles as the RaceModel hands them out. */
class Field {
  readonly records = new Map<number, LapRecord[]>()
  readonly last = new Map<number, Lap>()
  readonly best = new Map<number, Lap>()
  /** lapProfile() calls. */
  calls = 0
  readonly view: RaceView = {
    ...EMPTY_RACE_VIEW,
    cars: () => [...this.records].map(([carIdx, laps]) => ({ ...BASE, carIdx, laps })),
    lapProfile: (i, which) => {
      this.calls++
      return (which === 'best' ? this.best : this.last).get(i) ?? null
    }
  }

  /** Car `idx` completes `lap`: its newest record, its last lap, its best when clean and faster. */
  complete(idx: number, lap: Lap): void {
    const rec: LapRecord = { lap: lap.lap, time: lap.lapTime, clean: lap.clean }
    this.records.set(idx, [rec, ...(this.records.get(idx) ?? [])].slice(0, 10))
    this.last.set(idx, lap)
    const best = this.best.get(idx)
    if (lap.clean && (!best || lap.lapTime < best.lapTime)) this.best.set(idx, lap)
  }

  /** CarIdxLastLapTime refines the newest lap of car `idx`: its profile is rescaled to it. */
  refine(idx: number, lapTime: number): Lap {
    const last = this.last.get(idx)
    if (!last) throw new Error(`no lap of car ${idx}`)
    const scale = lapTime / last.lapTime
    const refined = { ...last, lapTime, profile: last.profile.map((v) => v * scale) }
    const [, ...older] = this.records.get(idx) ?? []
    this.records.set(idx, [{ lap: last.lap, time: lapTime, clean: last.clean }, ...older])
    this.last.set(idx, refined)
    if (this.best.get(idx) === last) this.best.set(idx, refined)
    return refined
  }
}

const session: SessionMeta = makeSession(5, { sectorStarts: [0, 0.33, 0.66] }, [
  makeDriver(0),
  makeDriver(1),
  makeDriver(2, { classId: 2 }),
  makeDriver(3),
  makeDriver(4, { classId: 2 })
])

function setup(lines = THIRDS): { field: Field; laps: OptimalLaps; scan: () => void } {
  const field = new Field()
  const laps = new OptimalLaps()
  laps.setSectors(lines)
  return { field, laps, scan: () => laps.scan(field.view, session) }
}

describe('OptimalLaps: your optimal lap', () => {
  it('joins your best time in each sector, from whichever lap set it', () => {
    const { field, laps, scan } = setup()
    expect(laps.ofCar(0)).toBeNull()
    field.complete(0, lapOf(2, [30, 35, 35]))
    field.complete(0, lapOf(3, [32, 33, 36]))
    scan()
    field.complete(0, lapOf(4, [33, 34, 34]))
    scan()
    const o = laps.ofCar(0)
    expect(o?.lapTime).toBeCloseTo(30 + 33 + 34, 9)
    // Faster than any of the laps it is made of.
    expect(o?.lapTime).toBeLessThan(100)
    for (const [k, best] of [30, 33, 34].entries()) {
      expect(sector(o?.profile ?? [], k)).toBeCloseTo(best, 9)
    }
  })

  it('drops a lap that turns unclean after the scan took it (an incident just after the line)', () => {
    const { field, laps, scan } = setup()
    field.complete(0, lapOf(2, [30, 35, 35]))
    scan()
    // Lap 3 best in every sector, clean at the line: the optimal is it for a moment.
    const spoilt = lapOf(3, [29, 33, 33])
    field.complete(0, spoilt)
    scan()
    expect(laps.ofCar(0)?.lapTime).toBeCloseTo(95, 9)
    // The model takes it back: not clean any more, and lap 2 is the best again.
    const [, ...older] = field.records.get(0) ?? []
    field.records.set(0, [{ lap: 3, time: spoilt.lapTime, clean: false }, ...older])
    field.last.set(0, { ...spoilt, clean: false })
    field.best.set(0, lapOf(2, [30, 35, 35]))
    scan()
    expect(laps.ofCar(0)?.lapTime).toBeCloseTo(100, 9)
    // Nor does it settle when the next lap comes: none of its sectors is ever used.
    field.complete(0, lapOf(4, [31, 36, 36]))
    scan()
    expect(laps.ofCar(0)?.lapTime).toBeCloseTo(100, 9)
    expect(laps.ofClass(1)?.lapTime).toBeCloseTo(100, 9)
  })

  it('is continuous: each sector is the segment of its lap, shifted to where the last one ends', () => {
    const { field, laps, scan } = setup()
    // Lap 3 is quick at the start of S2 and slow at its end; the optimal keeps that shape.
    const shaped = Array.from({ length: LINES + 1 }, (_, i) =>
      i <= 33 ? i : i <= 50 ? 33 + 0.5 * (i - 33) : i <= 66 ? 41.5 + 1.25 * (i - 50) : 61.5 + i - 66
    )
    field.complete(0, lapOf(2, [30, 35, 35]))
    scan()
    field.complete(0, { lap: 3, lapTime: shaped[LINES] ?? 0, clean: true, profile: shaped })
    scan()
    const p = laps.ofCar(0)?.profile ?? []
    expect(usableLap(laps.ofCar(0)?.lapTime ?? 0, p)).toBe(true)
    expect(p).toHaveLength(LINES + 1)
    expect(p[0]).toBe(0)
    // S1 from lap 2 (30 s), S2 and S3 from lap 3 (8.5 + 20 s, then 34 s).
    expect(p[33]).toBeCloseTo(30, 9)
    expect((p[50] ?? 0) - (p[33] ?? 0)).toBeCloseTo(8.5, 9)
    expect((p[66] ?? 0) - (p[50] ?? 0)).toBeCloseTo(20, 9)
    expect((p[LINES] ?? 0) - (p[66] ?? 0)).toBeCloseTo(34, 9)
    for (let i = 1; i <= LINES; i++) expect(p[i] ?? 0).toBeGreaterThanOrEqual(p[i - 1] ?? 0)
    expect(laps.ofCar(0)?.lapTime).toBe(p[LINES])
  })

  it('takes clean laps only', () => {
    const { field, laps, scan } = setup()
    field.complete(0, lapOf(2, [31, 34, 35]))
    // Off track, a pit stop, a tow: never a best sector, however fast.
    field.complete(0, lapOf(3, [20, 20, 20], THIRDS, false))
    scan()
    field.complete(0, lapOf(4, [32, 33, 36]))
    scan()
    expect(laps.ofCar(0)?.lapTime).toBeCloseTo(31 + 33 + 35, 9)
    // Only dirty laps: no optimal.
    const dirty = setup()
    dirty.field.complete(1, lapOf(2, [30, 30, 30], THIRDS, false))
    dirty.scan()
    expect(dirty.laps.ofCar(1)).toBeNull()
  })

  it('without sectors the lap is one sector: the optimal is your best clean lap', () => {
    const { field, laps, scan } = setup(sectorLines([]))
    const best = lapOf(3, [30, 34, 35])
    field.complete(0, lapOf(2, [29, 36, 36]))
    scan()
    field.complete(0, best)
    scan()
    field.complete(0, lapOf(4, [31, 33, 36]))
    scan()
    expect(laps.ofCar(0)?.lapTime).toBe(best.lapTime)
    expect(laps.ofCar(0)?.profile).toEqual(best.profile)
  })

  it('cuts sectors at the timing lines of sectorLines(), exactly', () => {
    // A sector line at 33.4 % snaps to line 33; a two-sector track at 50 %.
    const lines = sectorLines([0, 0.5])
    expect(lines).toEqual([0, 50])
    const { field, laps, scan } = setup(lines)
    const a = lapOf(2, [40, 60], lines)
    const b = lapOf(3, [45, 50], lines)
    field.complete(0, a)
    scan()
    field.complete(0, b)
    scan()
    const p = laps.ofCar(0)?.profile ?? []
    expect(p[50]).toBe(a.profile[50])
    // The first line of S2 is lap 3's, from where S1 ended.
    expect((p[51] ?? 0) - (p[50] ?? 0)).toBeCloseTo((b.profile[51] ?? 0) - (b.profile[50] ?? 0), 9)
    expect(laps.ofCar(0)?.lapTime).toBeCloseTo(90, 9)
    // A zero-length sector (two starts on one line) costs nothing.
    const tight = sectorLines([0, 0.5, 0.501])
    expect(tight).toEqual([0, 50, 50])
    const t = setup(tight)
    t.field.complete(0, lapOf(2, [40, 0, 60], tight))
    t.scan()
    expect(t.laps.ofCar(0)?.lapTime).toBeCloseTo(100, 9)
    expect(usableLap(100, t.laps.ofCar(0)?.profile ?? [])).toBe(true)
  })

  it('a lap best in every sector is the optimal exactly, whatever the sector lines', () => {
    // Uneven sectors and model-like times (a lap scaled to its official time): joining a lap's
    // own segments end to end must not round it a hair slower than itself.
    const lines = sectorLines([0, 0.07, 0.31, 0.52, 0.8])
    for (let n = 0; n < 200; n++) {
      const lapTime = 120 + ((n * 7919) % 3001) / 100
      const raw = Array.from({ length: LINES + 1 }, (_, i) => i + 0.37 * Math.sin(i * (n + 1)))
      const scale = lapTime / (raw[LINES] ?? 1)
      const profile = raw.map((v, i) => (i === LINES ? lapTime : Math.min(v * scale, lapTime)))
      const { field, laps, scan } = setup(lines)
      field.complete(0, { lap: 2, lapTime, clean: true, profile })
      scan()
      expect(laps.ofCar(0)?.lapTime, `lap ${lapTime}`).toBe(lapTime)
      expect(laps.ofCar(0)?.profile).toEqual(profile)
      // Alone in the class: the class optimal is the same lap.
      expect(laps.ofClass(1)?.lapTime).toBe(lapTime)
    }
  })

  it('a lap refined after the line (CarIdxLastLapTime) replaces the one taken at it', () => {
    const { field, laps, scan } = setup()
    field.complete(0, lapOf(2, [33, 33, 33.99]))
    scan()
    expect(laps.ofCar(0)?.lapTime).toBeCloseTo(99.99, 9)
    // The official time is 10 ms slower: the model's own value does not stay as a best sector.
    field.refine(0, 100)
    scan()
    expect(laps.ofCar(0)?.lapTime).toBeCloseTo(100, 9)
    // Still so once the next (slower) lap settles it.
    field.complete(0, lapOf(3, [34, 34, 34]))
    scan()
    expect(laps.ofCar(0)?.lapTime).toBeCloseTo(100, 9)
  })

  it('laps no scan saw (the widget was not computed) count with the best lap', () => {
    const { field, laps, scan } = setup()
    field.complete(0, lapOf(2, [30, 36, 36]))
    field.complete(0, lapOf(3, [33, 33, 36]))
    field.complete(0, lapOf(4, [33, 36, 34]))
    scan()
    // Lap 2 is the best (102) and lap 4 the last: lap 3's S2 was never seen.
    expect(laps.ofCar(0)?.lapTime).toBeCloseTo(30 + 36 + 34, 9)
  })

  it('is the same object until a best sector changes; a scan reads only cars with a new lap', () => {
    const { field, laps, scan } = setup()
    field.complete(0, lapOf(2, [30, 35, 35]))
    field.complete(1, lapOf(2, [31, 34, 35]))
    scan()
    const first = laps.ofCar(0)
    expect(first).not.toBeNull()
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first?.profile)).toBe(true)
    // Nothing new: no lap profile read, nothing rebuilt.
    field.calls = 0
    for (let i = 0; i < 1000; i++) scan()
    expect(field.calls).toBe(0)
    expect(laps.ofCar(0)).toBe(first)
    // A slower lap sets no best sector: still the same lap.
    field.complete(0, lapOf(3, [31, 36, 36]))
    scan()
    expect(field.calls).toBe(2)
    expect(laps.ofCar(0)).toBe(first)
    // Car 1's lap does not touch yours.
    field.complete(1, lapOf(3, [29, 33, 33]))
    scan()
    expect(laps.ofCar(0)).toBe(first)
    // A best sector: another lap (another id).
    field.complete(0, lapOf(4, [31, 34.5, 36]))
    scan()
    const next = laps.ofCar(0)
    expect(next).not.toBe(first)
    expect(next?.id).not.toBe(first?.id)
    expect(next?.lapTime).toBeCloseTo(30 + 34.5 + 35, 9)
  })

  it('starts over with other sector lines or a reset (a new session)', () => {
    const { field, laps, scan } = setup()
    field.complete(0, lapOf(2, [30, 35, 35]))
    scan()
    expect(laps.ofCar(0)).not.toBeNull()
    // The same lines: nothing lost.
    laps.setSectors(sectorLines([0, 0.33, 0.66]))
    expect(laps.ofCar(0)).not.toBeNull()
    laps.setSectors(sectorLines([0, 0.5]))
    expect(laps.ofCar(0)).toBeNull()
    // The next scan reads the laps there are again, cut at the new lines.
    scan()
    expect(laps.ofCar(0)?.lapTime).toBeCloseTo(100, 9)
    laps.reset()
    expect(laps.ofCar(0)).toBeNull()
    expect(laps.ofClass(1)).toBeNull()
  })
})

describe('OptimalLaps: class optimal', () => {
  it('the best in each sector by anyone in the class, you included; other classes do not count', () => {
    const { field, laps, scan } = setup()
    field.complete(0, lapOf(2, [30, 35, 35]))
    field.complete(1, lapOf(2, [32, 33, 36]))
    field.complete(3, lapOf(2, [33, 34, 34]))
    // Class 2 is much faster.
    field.complete(2, lapOf(2, [25, 25, 25]))
    scan()
    const o = laps.ofClass(1)
    expect(o?.lapTime).toBeCloseTo(30 + 33 + 34, 9)
    expect(usableLap(o?.lapTime ?? 0, o?.profile ?? [])).toBe(true)
    // At most your optimal and the class best.
    expect(o?.lapTime).toBeLessThanOrEqual(laps.ofCar(0)?.lapTime ?? 0)
    expect(o?.lapTime).toBeLessThanOrEqual(100)
    // Each class its own.
    field.complete(4, lapOf(2, [26, 24, 26]))
    scan()
    expect(laps.ofClass(2)?.lapTime).toBeCloseTo(25 + 24 + 25, 9)
    expect(laps.ofClass(1)).toBe(o)
    expect(laps.ofClass(9)).toBeNull()
  })

  it('a class of one: the optimal of its only driver', () => {
    const { field, laps } = setup()
    // You alone in class 7; the others are much faster but in class 1.
    const solo = makeSession(4, { sectorStarts: [0, 0.33, 0.66] }, [
      makeDriver(0, { classId: 7 }),
      makeDriver(1),
      makeDriver(3)
    ])
    field.complete(0, lapOf(2, [30, 35, 35]))
    field.complete(1, lapOf(2, [25, 25, 25]))
    laps.scan(field.view, solo)
    field.complete(0, lapOf(3, [32, 33, 36]))
    laps.scan(field.view, solo)
    expect(laps.ofClass(7)?.lapTime).toBeCloseTo(30 + 33 + 35, 9)
    expect(laps.ofClass(7)?.profile).toEqual(laps.ofCar(0)?.profile)
    expect(laps.ofClass(1)?.lapTime).toBeCloseTo(75, 9)
  })

  it('a slot taken over by another entry starts over: its laps were someone else’s', () => {
    const { field, laps, scan } = setup()
    // Car 1 (class 1) is quick, then leaves; a driver of class 2 takes its CarIdx.
    field.complete(1, lapOf(2, [25, 25, 25]))
    field.complete(4, lapOf(2, [30, 30, 30]))
    scan()
    expect(laps.ofClass(1)?.lapTime).toBeCloseTo(75, 9)
    expect(laps.ofClass(2)?.lapTime).toBeCloseTo(90, 9)
    const drivers = [...session.drivers.values()].map((d) =>
      d.carIdx === 1 ? makeDriver(1, { userId: 901, userName: 'Otra Persona', classId: 2 }) : d
    )
    const taken: SessionMeta = { ...session, drivers: new Map(drivers.map((d) => [d.carIdx, d])) }
    // The RaceModel starts the slot over: no laps until the new driver completes one.
    field.records.set(1, [])
    field.last.delete(1)
    field.best.delete(1)
    laps.scan(field.view, taken)
    // Its laps no longer count for class 1 (as with the class best: the model forgot them).
    expect(laps.ofClass(1)).toBeNull()
    field.complete(1, lapOf(3, [31, 29, 31]))
    laps.scan(field.view, taken)
    // Class 2: car 4's lap and the new driver's S2, never the 25 s sectors of class 1.
    expect(laps.ofClass(2)?.lapTime).toBeCloseTo(30 + 29 + 30, 9)
    expect(laps.ofCar(1)?.lapTime).toBeCloseTo(91, 9)
    // In a team race the entry is the team: a driver change keeps the car's laps.
    const team: SessionMeta = { ...session, teamRacing: true }
    const t = setup()
    t.field.complete(1, lapOf(2, [25, 25, 25]))
    t.laps.scan(t.field.view, team)
    const swap = [...team.drivers.values()].map((d) =>
      d.carIdx === 1 ? { ...d, userId: 902, userName: 'Relevo' } : d
    )
    t.field.complete(1, lapOf(3, [26, 26, 26]))
    t.laps.scan(t.field.view, { ...team, drivers: new Map(swap.map((d) => [d.carIdx, d])) })
    expect(t.laps.ofCar(1)?.lapTime).toBeCloseTo(75, 9)
  })

  it('a lap of another class, or one with no best sector, keeps the same lap', () => {
    const { field, laps, scan } = setup()
    field.complete(0, lapOf(2, [30, 35, 35]))
    field.complete(1, lapOf(2, [32, 33, 36]))
    scan()
    const o = laps.ofClass(1)
    field.complete(2, lapOf(2, [25, 25, 25]))
    field.complete(1, lapOf(3, [33, 34, 36]))
    scan()
    expect(laps.ofClass(1)).toBe(o)
    field.complete(3, lapOf(2, [31, 32, 35.5]))
    scan()
    expect(laps.ofClass(1)?.lapTime).toBeCloseTo(30 + 32 + 35, 9)
    expect(laps.ofClass(1)?.id).not.toBe(o?.id)
  })
})
