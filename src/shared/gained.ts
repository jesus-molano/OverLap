import type { SessionMeta } from './types'

/**
 * Positions gained since the start, one rule for Posiciones and Relativo (request 11): the car's
 * grid slot in its class minus its class position now (+ gained, - lost). Null while not
 * racing (before the green, outside races), and without either position. Pure.
 */
export function positionsGainedOf(
  session: Pick<SessionMeta, 'grid'>,
  carIdx: number,
  classPosition: number | null,
  racing: boolean
): number | null {
  if (!racing || classPosition === null || !(classPosition > 0)) return null
  const grid = session.grid.get(carIdx)
  return grid !== undefined && grid.classPosition > 0 ? grid.classPosition - classPosition : null
}
