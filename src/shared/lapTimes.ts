/**
 * The lap times a table shows for a car (Posiciones' and Relativo's «Última vuelta» column): its
 * last and best laps at the sim's millisecond resolution, and what the last one was (the class's
 * fastest, the driver's own best, or neither). One rule for both tables. Pure.
 */
import type { RaceCarState } from './race/raceView'
import type { TelemetryFrame } from './telemetry'
import type { StandingsRow } from './types'

/** Two lap times this close (s) are the same lap. */
export const LAP_EPS = 0.0005

/** A lap time rounded to the millisecond; null for none (missing, not finite, 0 or negative). */
export function quantLap(s: number | null | undefined): number | null {
  if (s === null || s === undefined || !Number.isFinite(s) || s <= 0) return null
  return Math.round(s * 1000) / 1000
}

/**
 * The car's last lap: the sim's own (ms resolution, same source as CarIdxBestLapTime) when it has
 * one; a finisher's stays frozen at its finishing lap (the model's), whatever the cool-down does.
 */
export function lastLapOf(frame: TelemetryFrame, car: RaceCarState): number | null {
  return car.finished
    ? quantLap(car.lastLapTime)
    : (quantLap(frame.CarIdxLastLapTime[car.carIdx]) ?? quantLap(car.lastLapTime))
}

/** `lap` is the class's fastest (`classBest`, null when nobody has a lap). */
export function isClassBest(lap: number | null, classBest: number | null): boolean {
  return lap !== null && classBest !== null && Math.abs(lap - classBest) <= LAP_EPS
}

/**
 * What the last lap was: the class's fastest ('class-best'), the driver's own best
 * ('personal-best'), or 'normal'.
 */
export function lastLapKind(
  last: number | null,
  best: number | null,
  classBest: number | null
): StandingsRow['lastLapKind'] {
  if (last === null || best === null || Math.abs(last - best) > LAP_EPS) return 'normal'
  return isClassBest(best, classBest) ? 'class-best' : 'personal-best'
}
