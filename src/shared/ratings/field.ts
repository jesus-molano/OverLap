/**
 * The iRating field of one class, built in one place so the standings and the
 * battle widget project the same numbers (Sporting Code 13.2.3: per class).
 * Pure.
 */
import type { RaceView } from '../race/raceView'
import type { SessionMeta } from '../types'
import type { IRatingEntry } from './irating'

export interface RatingField {
  /**
   * Registered drivers of the class with an iRating (> 0), sorted by carIdx
   * (the stable order irating.ts caches on). Positions are 1..n: the cars
   * classified so far by class position, then the others as non-starters.
   */
  readonly entries: readonly IRatingEntry[]
  /** Equal keys: same drivers, iRatings, positions and starts (same projections). */
  readonly key: string
}

/**
 * Registered drivers count even if they never joined: iRacing scores them as
 * non-starters, and their share of the field changes everybody's projection.
 */
export function classRatingField(
  session: Pick<SessionMeta, 'drivers' | 'paceCarIdx'>,
  race: Pick<RaceView, 'car'>,
  classId: number
): RatingField {
  const started: IRatingEntry[] = []
  const notStarted: IRatingEntry[] = []
  for (const d of session.drivers.values()) {
    if (d.classId !== classId || d.isPaceCar || d.isSpectator) continue
    if (d.carIdx === session.paceCarIdx || !(d.iRating > 0) || !Number.isFinite(d.iRating)) {
      continue
    }
    const cp = race.car(d.carIdx)?.classPosition ?? 0
    const entry = { carIdx: d.carIdx, iRating: d.iRating, position: cp, started: cp > 0 }
    if (entry.started) started.push(entry)
    else notStarted.push(entry)
  }
  started.sort((a, b) => a.position - b.position || a.carIdx - b.carIdx)
  notStarted.sort((a, b) => a.carIdx - b.carIdx)
  let rank = 0
  for (const e of started) e.position = ++rank
  for (const e of notStarted) e.position = ++rank
  const entries = started.concat(notStarted).sort((a, b) => a.carIdx - b.carIdx)
  let key = ''
  for (const e of entries) key += `${e.carIdx}:${e.iRating}:${e.position}:${e.started ? 1 : 0}|`
  return { entries, key }
}

/** The entry of `carIdx`, undefined when it is not in the field. */
export function fieldEntry(field: RatingField, carIdx: number): IRatingEntry | undefined {
  return field.entries.find((e) => e.carIdx === carIdx)
}
