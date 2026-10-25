/**
 * Optimal laps of the delta widget (references 'optimal' and 'classOptimal'): the best time in
 * each track sector over the clean laps of this session, joined into one lap. Per car (your
 * optimal) and per class (in each sector, the best of any of its cars).
 *
 * Sectors are the widget's (sectorLines()); without any the lap is one sector, so the optimal is
 * the best clean lap. Each sector of a joined profile is the timing-line segment of the lap that
 * set its best time, shifted to start where the previous one ends: 0 .. the sum of the best
 * sectors, non-decreasing (usableLap()). Consecutive sectors of one lap are one segment, so a
 * lap that is best in every sector is the optimal exactly (never a rounding slower).
 *
 * A CarIdx taken over by another entry (entryKey(): the person, the team in team races) starts
 * over, as the RaceModel's timing does: the laps before were someone else's, maybe of another
 * class.
 *
 * Fed from the RaceView by scan(), at the delta's reference lookups (never per compute): only a
 * car whose newest lap record (RaceCarState.laps[0]) changed since the last scan gets its 'last'
 * and 'best' lap profiles read. The best lap stands in for laps that ended while the widget was
 * not computed (hidden, or switched on mid-session): those count with the car's best only. The
 * newest lap of a car is kept apart until the next one, because CarIdxLastLapTime refines its
 * time a few seconds after the line: the refined lap replaces it instead of adding to it.
 *
 * Memory: per car, a time and a lap profile (the model's frozen snapshot, shared) per sector.
 * A joined lap is built only when one of its best sectors changed, and is the same frozen
 * object until then.
 */
import { arrayEqual } from '../equal'
import { entryKey } from '../race/entry'
import { RACE_TIMING_LINES } from '../race/raceView'
import type { RaceView } from '../race/raceView'
import type { SessionMeta } from '../types'
import { usableLap } from './references'

const LINES = RACE_TIMING_LINES

type LapProfile = NonNullable<ReturnType<RaceView['lapProfile']>>
type Profile = readonly number[]

export interface OptimalLap {
  /** Unique per build: another id is another lap (the delta switches to it at a lap start). */
  readonly id: number
  /** Sum of the best sectors (s). */
  readonly lapTime: number
  /** RACE_TIMING_LINES + 1 cumulative seconds, 0 .. lapTime. */
  readonly profile: readonly number[]
}

/** One car's best sectors this session. */
class CarSectors {
  classId = -1
  /** entryKey() of whoever drove these laps ('' when unknown). */
  entry: string
  /** The newest lap record seen: its number and its time (refined in place after the line). */
  seenLap = Number.NaN
  seenTime = Number.NaN
  /** Best time of each sector over the settled laps (Infinity: none), and the lap that set it. */
  readonly settledTime: Float64Array
  readonly settledFrom: (Profile | null)[]
  /** The newest clean lap, until the next one: its time may still be refined. */
  newest: LapProfile | null = null
  /** The better of the two in each sector: what the joins read. */
  readonly bestTime: Float64Array
  readonly bestFrom: (Profile | null)[]
  /** Bumped when bestTime / bestFrom change. */
  rev = 0
  /** The car's optimal lap as of `ownRev`. */
  own: OptimalLap | null = null
  ownRev = -1

  constructor(sectors: number, entry: string) {
    this.entry = entry
    this.settledTime = new Float64Array(sectors).fill(Number.POSITIVE_INFINITY)
    this.settledFrom = new Array<Profile | null>(sectors).fill(null)
    this.bestTime = new Float64Array(sectors).fill(Number.POSITIVE_INFINITY)
    this.bestFrom = new Array<Profile | null>(sectors).fill(null)
  }
}

/** A class's optimal lap as of `rev`, with the lap that set each of its sectors. */
interface ClassOptimal {
  rev: number
  from: (Profile | null)[]
  lap: OptimalLap | null
}

export class OptimalLaps {
  /** Start line of each sector: [0] for a lap without sectors. */
  private lines: readonly number[] = [0]
  private readonly cars = new Map<number, CarSectors>()
  /** Bumped when any car's best sectors (or class) change. */
  private rev = 0
  private nextId = 1
  private readonly classes = new Map<number, ClassOptimal>()

  /** Forgets every lap: a new session (the sectors go back to one per lap). */
  reset(): void {
    this.lines = [0]
    this.clear()
  }

  /** Sector start lines (sectorLines(); [] = none); other sectors start over. */
  setSectors(lines: readonly number[]): void {
    const next = lines.length > 0 ? lines.slice() : [0]
    if (arrayEqual(next, this.lines)) return
    this.lines = next
    this.clear()
  }

  /** Takes in the laps completed (or refined) since the last scan. */
  scan(race: RaceView, session: SessionMeta): void {
    for (const car of race.cars()) {
      const idx = car.carIdx
      const driver = session.drivers.get(idx)
      const entry = driver ? entryKey(driver, session.teamRacing) : ''
      let c = this.cars.get(idx)
      // Another entry in the slot: its laps so far were someone else's.
      if (c !== undefined && entry !== '' && c.entry !== entry) {
        this.cars.delete(idx)
        this.rev++
        c = undefined
      }
      const rec = car.laps[0]
      if (rec === undefined) continue
      const classId = driver?.classId ?? -1
      if (c === undefined) {
        c = new CarSectors(this.lines.length, entry)
        this.cars.set(idx, c)
      }
      if (c.classId !== classId) {
        c.classId = classId
        this.rev++
      }
      if (c.seenLap === rec.lap && c.seenTime === rec.time) continue
      c.seenLap = rec.lap
      c.seenTime = rec.time
      this.take(c, race.lapProfile(idx, 'last'), race.lapProfile(idx, 'best'))
    }
  }

  /** The car's optimal lap, null without a clean lap this session. */
  ofCar(carIdx: number): OptimalLap | null {
    const c = this.cars.get(carIdx)
    if (c === undefined) return null
    if (c.ownRev !== c.rev) {
      c.own = this.join(c.bestFrom)
      c.ownRev = c.rev
    }
    return c.own
  }

  /** The optimal lap of a class: in each sector the best of any of its cars; null without laps. */
  ofClass(classId: number): OptimalLap | null {
    let entry = this.classes.get(classId)
    if (entry?.rev === this.rev) return entry.lap
    const n = this.lines.length
    const times = new Float64Array(n).fill(Number.POSITIVE_INFINITY)
    const from = new Array<Profile | null>(n).fill(null)
    for (const c of this.cars.values()) {
      if (c.classId !== classId) continue
      for (let k = 0; k < n; k++) {
        const t = c.bestTime[k] ?? Number.POSITIVE_INFINITY
        if (t < (times[k] ?? 0)) {
          times[k] = t
          from[k] = c.bestFrom[k] ?? null
        }
      }
    }
    // Another class's lap (or a lap that set no best) changed nothing: the same lap.
    if (entry !== undefined && arrayEqual(entry.from, from)) {
      entry.rev = this.rev
      return entry.lap
    }
    entry = { rev: this.rev, from, lap: this.join(from) }
    this.classes.set(classId, entry)
    return entry.lap
  }

  private clear(): void {
    this.cars.clear()
    this.classes.clear()
    this.rev++
  }

  /** A car's newest lap (`last`) and its best: settles the lap before, keeps the new one apart. */
  private take(c: CarSectors, last: LapProfile | null, best: LapProfile | null): void {
    const newest = c.newest
    if (newest !== null && newest.lap !== last?.lap) this.settle(c, newest)
    // The same lap again is its refined version: it replaces the one kept.
    c.newest = last !== null && isCleanLap(last) ? last : null
    if (best !== null && best.lap !== c.newest?.lap && isCleanLap(best)) this.settle(c, best)

    const n = this.lines.length
    let changed = false
    for (let k = 0; k < n; k++) {
      let t = c.settledTime[k] ?? Number.POSITIVE_INFINITY
      let from = c.settledFrom[k] ?? null
      if (c.newest !== null) {
        const v = this.sectorTime(c.newest.profile, k)
        if (v < t) {
          t = v
          from = c.newest.profile
        }
      }
      if (t !== c.bestTime[k] || from !== c.bestFrom[k]) {
        c.bestTime[k] = t
        c.bestFrom[k] = from
        changed = true
      }
    }
    if (changed) {
      c.rev++
      this.rev++
    }
  }

  private settle(c: CarSectors, lap: LapProfile): void {
    for (let k = 0; k < this.lines.length; k++) {
      const t = this.sectorTime(lap.profile, k)
      if (t < (c.settledTime[k] ?? 0)) {
        c.settledTime[k] = t
        c.settledFrom[k] = lap.profile
      }
    }
  }

  /** Seconds of sector k on a lap profile. */
  private sectorTime(profile: Profile, k: number): number {
    const a = this.lines[k] ?? 0
    const b = this.lines[k + 1] ?? LINES
    return (profile[b] ?? Number.NaN) - (profile[a] ?? Number.NaN)
  }

  /**
   * Each sector's segment of the lap that set it, joined end to end; null when one is missing.
   * A run of sectors from one lap is one segment: its own times, shifted once.
   */
  private join(from: readonly (Profile | null)[]): OptimalLap | null {
    const profile = new Array<number>(LINES + 1).fill(0)
    let src: Profile | null = null
    // Where the run of `src` starts: its time there and the joined time there.
    let base = 0
    let start = 0
    let at = 0
    for (let k = 0; k < this.lines.length; k++) {
      const next = from[k]
      if (!next) return null
      const a = this.lines[k] ?? 0
      const b = this.lines[k + 1] ?? LINES
      if (next !== src) {
        src = next
        base = src[a] ?? Number.NaN
        start = at
      }
      for (let i = a + 1; i <= b; i++) profile[i] = start + ((src[i] ?? Number.NaN) - base)
      at = profile[b] ?? Number.NaN
    }
    return Object.freeze({ id: this.nextId++, lapTime: at, profile: Object.freeze(profile) })
  }
}

/** A clean lap with a usable profile (anything else sets no sector). */
function isCleanLap(lap: LapProfile): boolean {
  return lap.clean && usableLap(lap.lapTime, lap.profile)
}
