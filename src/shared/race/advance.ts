/**
 * Per-tick movement of one car (pure functions over CarTrack, no allocations):
 * S/F wrap fix-up, teleport/jitter rules, timing-line interpolation and
 * pit-road edges.
 */
import { NO_LINE } from './carTrack'
import type { CarTrack } from './carTrack'
import { RACE_TIMING_LINES } from './raceView'

const LINES = RACE_TIMING_LINES
/** Forward jump in one tick (laps) treated as a tow/reset. */
export const TELEPORT_LAPS = 0.1
/** Backward movement (laps) tolerated as pct noise of a slow or stopped car. */
const JITTER_LAPS = 0.005
/** Lap fraction around the S/F line where the lap counter may lag or lead the pct wrap. */
const WRAP_WINDOW = 0.03
/**
 * How long (s) the lap counter may disagree with the pct wrap near the line: a few ticks
 * when driving through it. Longer, it is iRacing crediting a lap (a towed car parked in a
 * box just past the line keeps its pct and gets the lap after the tow): take the counter.
 */
const WRAP_HOLD_S = 1
/**
 * Longest step (s) between two ticks across which a lap counter that went up with the car
 * where it was is a lap credited in the box: far less than any lap, so the car cannot have
 * driven one meanwhile.
 */
const CREDIT_MAX_DT_S = 2

/** Called for every S/F line `g` (g % LINES === 0) crossed at SessionTime `tc`, in order. */
export type SfCrossing = (track: CarTrack, g: number, tc: number) => void

/**
 * Lap counter of this tick at SessionTime `t`: CarIdxLapCompleted can change a
 * few ticks before or after the pct wraps, so near the line keep the lap that
 * continues the previous distance, for up to WRAP_HOLD_S. A pct that jumps
 * from mid-lap to just past the line is a tow there, not a wrap.
 */
function effectiveLap(track: CarTrack, lapRaw: number, pct: number, t: number): number {
  if (!track.prevValid) {
    track.lapMismatchT = NaN
    return lapRaw
  }
  const dp = pct - track.prevPct
  // Forward across the line: 1 + dp is the distance covered, short for a real crossing.
  const wrapped = dp < -0.5 && 1 + dp <= TELEPORT_LAPS
  const derived = wrapped ? track.effLap + 1 : dp > 0.5 ? track.effLap - 1 : track.effLap
  if (
    lapRaw !== derived &&
    Math.abs(lapRaw - derived) === 1 &&
    (pct < WRAP_WINDOW || pct > 1 - WRAP_WINDOW)
  ) {
    if (Number.isNaN(track.lapMismatchT)) track.lapMismatchT = t
    if (t - track.lapMismatchT <= WRAP_HOLD_S) return derived
  } else {
    track.lapMismatchT = NaN
  }
  return lapRaw
}

/**
 * Moves `track` to CarIdxLapCompleted `lapRaw` + CarIdxLapDistPct `pct` at
 * SessionTime `t`: records every line crossed since the previous tick (time
 * interpolated, with crossing `flags`) and reports S/F crossings to `onSf`.
 * Teleports and world entries record nothing and dirty the lap. Returns the
 * effective race distance.
 */
export function advanceTrack(
  track: CarTrack,
  lapRaw: number,
  pct: number,
  t: number,
  flags: number,
  onSf: SfCrossing
): number {
  const lap = effectiveLap(track, lapRaw, pct, t)
  const d = lap + pct
  track.lastDelta = 0
  track.creditedLaps = 0
  const delta = d - track.prevD
  track.continuous = track.prevValid && delta <= TELEPORT_LAPS && delta >= -JITTER_LAPS
  if (!track.continuous) {
    // Entering the world, first sight or a jump: nothing to interpolate from.
    const at = Math.floor(d * LINES)
    // Laps gained without driving them (iRacing credits a towed car parked in its box): the
    // counter went up since the tick just before while the car stayed where it was. Not across
    // frames this model did not see (a replay, a reconnect, a gap): the car drove those laps.
    if (
      track.prevValid &&
      lap > track.effLap &&
      Math.abs(pct - track.prevPct) <= JITTER_LAPS &&
      t - track.prevT <= CREDIT_MAX_DT_S
    ) {
      track.creditedLaps = lap - track.effLap
    }
    // Its crossings ahead of here (a tow back) predate it and will be crossed again; the gap
    // to it is measured from here on (finishers keep their frozen finish line).
    if (track.lastLine !== NO_LINE && !track.state.finished) track.rewindTo(at)
    track.hwLine = at
    track.hwD = d
    track.dirty = true
    track.jumpT = t
  } else {
    if (d > track.hwD) {
      track.lastDelta = d - track.hwD
      track.hwD = d
    }
    const last = Math.floor(d * LINES)
    if (last > track.hwLine) {
      // last > hwLine >= floor(prevD * LINES) implies d > prevD.
      const d0 = track.prevD
      const t0 = track.prevT
      const span = d - d0
      const dt = t - t0
      for (let g = track.hwLine + 1; g <= last; g++) {
        const tc = t0 + (dt * (g / LINES - d0)) / span
        track.record(g, tc, flags)
        if (g % LINES === 0) onSf(track, g, tc)
      }
      track.hwLine = last
    }
  }
  track.prevValid = true
  track.prevD = d
  track.prevT = t
  track.prevPct = pct
  track.effLap = lap
  track.lastD = d
  track.lastInWorldT = t
  return d
}

/**
 * Lap a stint starting at race distance `d` counts from: the run from the grid
 * or the pit lane to the line (lap -1) completes no lap.
 */
export function stintStart(d: number): number {
  return Math.max(0, Math.floor(d))
}

/**
 * Pit-road entry/exit edges at SessionTime `t`. Stops count only when `countStops` (green flag
 * running); a car already on pit road at first sight (pit-lane start) is not
 * a stop. Landing on pit road from a tick that did not continue the one before
 * (a tow or reset puts the car in its box, through a world exit) is a tow, not
 * a stop. Finishers keep their state as it was at the flag.
 */
export function updatePitEdges(
  track: CarTrack,
  onPitRoad: boolean,
  countStops: boolean,
  lapRaw: number,
  d: number,
  t: number
): void {
  if (!track.pitKnown) {
    track.prevOnPit = onPitRoad
    track.pitKnown = true
  }
  if (onPitRoad === track.prevOnPit) return
  track.prevOnPit = onPitRoad
  const st = track.state
  if (st.finished) return
  if (onPitRoad) {
    st.towed = !track.continuous
    st.towedAt = st.towed ? t : NaN
    if (!countStops) return
    if (st.towed) st.towStops++
    else st.pitStops++
    return
  }
  // The lap of the last stop: a tow is not one.
  if (countStops && !st.towed) st.lastPitLap = lapRaw
  st.towed = false
  st.towedAt = NaN
  st.outLap = true
  track.stintStartLap = stintStart(d)
}
