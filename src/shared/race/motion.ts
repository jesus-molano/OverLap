/**
 * Per-tick speed and stop detection of one car (pure function over CarTrack,
 * no allocations), run after advanceTrack():
 * - Speed (laps/s) = distance covered over SessionTime, sampled over at least
 *   SAMPLE_S (a frame that repeats a position and the next one catching up
 *   average out) and smoothed by an EMA with time constant TAU_S. The EMA is
 *   bias-corrected (raw average / accumulated weight): it reads the true speed
 *   from the first sample instead of ramping up from 0.
 * - A tick that does not continue the previous one (teleport, world entry, the
 *   lap counter wrapping apart from the pct beyond the fix-up window: see
 *   advanceTrack) measures afresh from there; the last speed shows until the
 *   first new sample. A sample faster than JUMP_FACTOR x the speed of the
 *   car's fastest known lap is a jump too (a network warp, a tow shorter than
 *   TELEPORT_LAPS) and is discarded, unless such samples last over MAX_JUMP_S
 *   (then the lap reference is what is wrong). So there are no spikes.
 * - stoppedForS accumulates SessionTime while the speed is below STOP_FRACTION
 *   of the pace speed, in the world and off pit road; anything else resets it.
 *   Such a crawl makes the lap in progress unclean, so a stop on track does
 *   not inflate the pace of the next laps.
 */
import type { CarTrack } from './carTrack'

/** Shortest span of one speed sample (s): 6 ticks at 60 Hz. */
const SAMPLE_S = 0.09
/** EMA time constant of the speed (s). */
const TAU_S = 0.5
/** A sample above this many times the speed of the car's fastest known lap is a jump. */
const JUMP_FACTOR = 3
/** Jump threshold (laps/s) when no lap time is known: nothing laps in under 4 s. */
const MAX_SPEED = 0.25
/** Consecutive "jump" samples spanning more than this (s) are real speed after all. */
const MAX_JUMP_S = 0.5
/** Crawling: below this fraction of the pace speed. */
export const STOP_FRACTION = 0.15
/** Reference lap (s) for the crawl threshold when the car has no pace. */
const FALLBACK_LAP_S = 120

/** Fastest lap reference (s) of the car: pace, best lap or class estimate; null when none. */
function fastestLap(track: CarTrack): number | null {
  let best = track.state.pace ?? Infinity
  const b = track.state.bestLapTime
  if (b !== null && b > 0 && b < best) best = b
  if (track.estLapTime > 0 && track.estLapTime < best) best = track.estLapTime
  return Number.isFinite(best) ? best : null
}

/** Feeds one speed sample `v` (laps/s) measured over `span` seconds. */
function addSample(track: CarTrack, v: number, span: number): void {
  const lap = fastestLap(track)
  const jump = v > (lap !== null ? JUMP_FACTOR / lap : MAX_SPEED)
  track.spdJumpS = jump ? track.spdJumpS + span : 0
  // A "jump" that lasts is the real speed (the lap reference is wrong): take it.
  if (jump && track.spdJumpS <= MAX_JUMP_S) return
  const a = 1 - Math.exp(-span / TAU_S)
  track.spdEma += (v - track.spdEma) * a
  track.spdWeight += (1 - track.spdWeight) * a
  // Backward pct noise of a stopped car may average slightly negative.
  track.state.speed = Math.max(0, track.spdEma / track.spdWeight)
  track.spdKnown = true
}

/**
 * Updates state.speed and state.stoppedForS of an in-world car at race
 * distance `d` and SessionTime `t`; state.pace must already be current.
 * Out of the world the caller resets the motion instead (CarTrack.resetMotion).
 */
export function updateMotion(track: CarTrack, d: number, t: number, inPits: boolean): void {
  const st = track.state
  const prevT = track.motionT
  track.motionT = t
  if (!track.continuous || !(t >= track.spdT)) {
    // Nothing to measure from (or time went back): start over here.
    track.spdD = d
    track.spdT = t
    track.spdEma = 0
    track.spdWeight = 0
  } else if (t - track.spdT >= SAMPLE_S) {
    const span = t - track.spdT
    addSample(track, (d - track.spdD) / span, span)
    track.spdD = d
    track.spdT = t
  }
  const crawling = track.spdKnown && st.speed < STOP_FRACTION / (st.pace ?? FALLBACK_LAP_S)
  if (inPits || !crawling) {
    st.stoppedForS = 0
    return
  }
  if (t > prevT) st.stoppedForS += t - prevT
  // A lap with a stop on track would inflate the pace: not clean.
  track.lapStopped = true
}
