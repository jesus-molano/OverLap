/**
 * Laps-left arithmetic of the RaceModel (pure, seconds and laps).
 *
 * Timed races end when the overall leader crosses the S/F line for the first
 * time at or after the clock reaches 0 (what drivers report; not in the
 * Sporting Code). Every other car finishes at its first crossing after that.
 */

/** Tolerance so a crossing that lands exactly on the deadline counts as "at" it. */
const EPS = 1e-6

/**
 * S/F crossings a car still makes up to and including its first one at or
 * after `timeS` seconds from now, at `paceS` per lap from lap fraction `pct`.
 * Always >= 1 (the lap in progress).
 */
export function crossingsUntil(timeS: number, pct: number, paceS: number): number {
  const first = (1 - pct) * paceS
  return Math.max(1, Math.ceil((timeS - first) / paceS - EPS) + 1)
}

/**
 * Seconds from now until the leader takes the chequered flag in a timed race:
 * its N_L-th crossing, N_L = max(1, ceil((T - (1 - fL)·pL) / pL) + 1).
 */
export function timedRaceEndS(timeRemainS: number, leaderPct: number, leaderPaceS: number): number {
  const n = crossingsUntil(timeRemainS, leaderPct, leaderPaceS)
  return (1 - leaderPct) * leaderPaceS + (n - 1) * leaderPaceS
}

/**
 * Lap-limited race: laps a car still has to complete including the current
 * one. `leaderFinishLap` is the lap count at which the overall leader takes
 * the flag (its completed laps + SessionLapsRemainEx); the car finishes at its
 * first crossing after that, i.e. at leaderFinishLap minus its whole laps down.
 */
export function lapLimitedLapsLeft(
  leaderFinishLap: number,
  leaderDistance: number,
  carDistance: number
): number {
  const lapsDown = Math.max(0, Math.floor(leaderDistance - carDistance))
  return leaderFinishLap - lapsDown - Math.floor(carDistance)
}
