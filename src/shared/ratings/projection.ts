/**
 * What the widgets show of the iRating projection of one class field
 * (field.ts), on top of the literal port in irating.ts: whole points, the
 * neutral position, the iRating at stake against a neighbour, and a small
 * per-provider cache. Pure apart from the cache instances.
 */
import type { PlayerRatingProjection } from '../types'
import type { RatingField } from './field'
import { fieldEntry } from './field'
import { iRatingDeltas, playerProjection, strengthOfField } from './irating'

/** Float slack when a position's change is exactly 0. */
const EPS = 1e-9

export interface FieldRatings {
  /** Strength of field, rounded; null when no driver has an iRating. */
  readonly sof: number | null
  /** Projected change per carIdx in whole points; null when not computed. */
  readonly deltas: ReadonlyMap<number, number> | null
  /** The player's projection as shown; null when not computed or not in the field. */
  readonly player: PlayerRatingProjection | null
  /** Exact iRating one position is worth to the player (0 when unknown), for stakes. */
  readonly perPosition: number
}

/** Whole points, no -0, null for anything not finite. */
function whole(v: number | null): number | null {
  return v !== null && Number.isFinite(v) ? Math.round(v) || 0 : null
}

/**
 * Last class position (1..starters) at which the change is still >= 0: finish
 * there or better and you do not lose iRating ("neutro P#"). A starter's
 * change is linear in rank (perPosition per place), so it is a closed form.
 * 0 when even P1 loses or the slope is unknown.
 */
export function neutralPosition(
  delta: number,
  rank: number,
  perPosition: number,
  starters: number
): number {
  if (!(perPosition > 0) || !Number.isFinite(delta) || !(starters >= 1)) return 0
  const p = Math.floor(rank + delta / perPosition + EPS)
  return p < 1 ? 0 : Math.min(starters, p)
}

/**
 * Deltas and the player's projection only when `withDeltas` (they are only
 * meaningful in rated races); the strength of field always.
 */
export function projectField(
  field: RatingField,
  playerIdx: number,
  withDeltas: boolean
): FieldRatings {
  const sof = strengthOfField(field.entries.map((e) => e.iRating))
  const out = { sof: whole(sof), deltas: null, player: null, perPosition: 0 }
  if (!withDeltas || field.entries.length === 0) return out
  const deltas = new Map<number, number>()
  for (const [carIdx, d] of iRatingDeltas(field.entries)) {
    const w = whole(d)
    if (w !== null) deltas.set(carIdx, w)
  }
  const me = fieldEntry(field, playerIdx)
  const raw = me ? playerProjection(field.entries, playerIdx) : null
  if (!me || !raw) return { ...out, deltas }
  let starters = 0
  for (const e of field.entries) if (e.started) starters++
  const perPosition = me.started && Number.isFinite(raw.perPosition) ? raw.perPosition : 0
  const player: PlayerRatingProjection = {
    iRatingDelta: whole(raw.iRatingDelta) ?? 0,
    perPosition: Math.round(perPosition * 10) / 10,
    breakEvenPosition: neutralPosition(raw.iRatingDelta, me.position, perPosition, starters),
    ifGainOne: whole(raw.ifGainOne),
    ifLoseOne: whole(raw.ifLoseOne)
  }
  return { ...out, deltas, player, perPosition }
}

/**
 * Your projected change finishing ahead of `oppIdx` minus finishing behind
 * it (positions swapped, everybody else in place), whole points. Your change
 * depends on your rank only, so it is perPosition times the rank difference.
 * Null unless both started and the projection is known.
 */
export function iRatingAtStake(
  field: RatingField,
  ratings: FieldRatings,
  playerIdx: number,
  oppIdx: number
): number | null {
  const me = fieldEntry(field, playerIdx)
  const opp = fieldEntry(field, oppIdx)
  if (!me?.started || !opp?.started || !(ratings.perPosition > 0)) return null
  return whole(ratings.perPosition * Math.abs(me.position - opp.position))
}

/**
 * FieldRatings per class, recomputed only when the field (drivers, iRatings,
 * positions), the player or `withDeltas` change. One instance per provider:
 * begin() at the start of a run, sweep() at its end drops the classes that
 * were not asked for (gone with the session).
 */
export class ClassRatingsCache {
  private readonly byClass = new Map<number, { key: string; run: number; value: FieldRatings }>()
  private run = 0

  begin(): void {
    this.run++
  }

  get(classId: number, field: RatingField, playerIdx: number, withDeltas: boolean): FieldRatings {
    const key = `${withDeltas ? `d${playerIdx}` : 's'}#${field.key}`
    const hit = this.byClass.get(classId)
    if (hit && hit.key === key) {
      hit.run = this.run
      return hit.value
    }
    const value = projectField(field, playerIdx, withDeltas)
    this.byClass.set(classId, { key, run: this.run, value })
    return value
  }

  sweep(): void {
    for (const [id, e] of this.byClass) if (e.run !== this.run) this.byClass.delete(id)
  }

  clear(): void {
    this.byClass.clear()
  }

  /** Classes held (tests). */
  get size(): number {
    return this.byClass.size
  }
}
