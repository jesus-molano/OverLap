/**
 * Lap-to-lap pace of the mock player, so the delta widget sees its personal
 * best beaten now and then. On top of everybody's lap jitter the player gets
 * quicker through a session (rubber going down, fuel burning off: a little
 * slower than its base pace on the first laps, a little quicker on the last
 * ones, the same on average, so the scripted traffic keeps its timing), throws
 * in a push lap every few laps, and starts each later session of a series a
 * little quicker (a driver learning the track), up to a limit.
 * Deterministic: the lap number and the session count, plus the caller's jitter.
 */

/** Pace swing over a stint: +half at its start, -half from STINT_LAPS on (fraction of the lap). */
export const PLAYER_STINT_SWING = 0.004
export const STINT_LAPS = 16
/** Every this many laps a push lap... */
export const PUSH_LAP_EVERY = 4
/** ...this much quicker. */
export const PUSH_LAP_GAIN = 0.0025
/** Each later session starts this much quicker, for the first few sessions of a series. */
export const PLAYER_GAIN_PER_SESSION = 0.001
export const LEARNING_SESSIONS = 4

/**
 * Pace factor (1 = the player's base lap) of the player's `lap`-th lap of the
 * session (1 = the first lap started in it) in session `sessionIndex` of a
 * series; `jitter` is the lap-to-lap noise every car gets.
 */
export function playerLapPace(jitter: number, lap: number, sessionIndex: number): number {
  const laps = Math.max(0, Math.trunc(lap))
  const stint = PLAYER_STINT_SWING * (0.5 - Math.min(1, laps / STINT_LAPS))
  const push = laps > 0 && laps % PUSH_LAP_EVERY === 0 ? PUSH_LAP_GAIN : 0
  const learned =
    PLAYER_GAIN_PER_SESSION * Math.min(Math.max(0, Math.trunc(sessionIndex)), LEARNING_SESSIONS)
  return 1 + jitter + stint - push - learned
}
