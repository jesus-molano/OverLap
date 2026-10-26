/**
 * When a towed car reads as towed (the GRÚA badge) rather than PIT, in the standings and the
 * relative alike: only around the tow itself. iRacing puts a towed car in its box at once and
 * runs the countdown there; once it is over the car is just a car in the pits, also one that
 * stays parked for good (from the Lime Rock race: a car parked in its box from the first laps
 * read GRÚA to the final results). Pure.
 */
import { finiteOr } from '../num'
import type { TelemetryFrame } from '../telemetry'
import type { RaceCarState } from './raceView'

/**
 * Another car's countdown is not published: it reads as towed for this long (s of SessionTime)
 * after landing in its box, about a tow's countdown (67 s and 65 s in that race).
 */
export const TOW_BADGE_S = 60
/** Your own countdown (PlayerCarTowTime) starts a moment after the car lands: held this long (s). */
export const TOW_START_S = 3

/**
 * `car` reads as towed at SessionTime `now`. `ownTowS`: PlayerCarTowTime when `car` is your own,
 * null for any other car (its countdown is unknown).
 */
export function showsTow(
  car: Pick<RaceCarState, 'towed' | 'towedAt'>,
  now: number,
  ownTowS: number | null
): boolean {
  if (!car.towed || !Number.isFinite(car.towedAt)) return false
  const since = now - car.towedAt
  if (ownTowS !== null) return ownTowS > 0 || since < TOW_START_S
  return since < TOW_BADGE_S
}

/** PlayerCarTowTime for your own car (`carIdx === player`), null for any other. */
export function ownTowTime(
  frame: Pick<TelemetryFrame, 'PlayerCarTowTime'>,
  carIdx: number,
  player: number
): number | null {
  return carIdx === player && player >= 0 ? finiteOr(frame.PlayerCarTowTime[0], 0) : null
}
