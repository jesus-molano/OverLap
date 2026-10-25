/**
 * Per-tick movement of one car (pure functions over CarTrack, no allocations):
 * S/F wrap fix-up, teleport/jitter rules, timing-line interpolation and
 * pit-road edges.
 */
import type { CarTrack } from './carTrack'
import { RACE_TIMING_LINES } from './raceView'

const LINES = RACE_TIMING_LINES
/** Forward jump in one tick (laps) treated as a tow/reset. */
export const TELEPORT_LAPS = 0.1
/** Backward movement (laps) tolerated as pct noise of a slow or stopped car. */
const JITTER_LAPS = 0.005
/** Lap fraction around the S/F line where the lap counter may lag or lead the pct wrap. */
const WRAP_WINDOW = 0.03

/** Called for every S/F line `g` (g % LINES === 0) crossed at SessionTime `tc`, in order. */
export type SfCrossing = (track: CarTrack, g: number, tc: number) => void

/**
 * Lap counter of this tick: CarIdxLapCompleted can change a few ticks before
 * or after the pct wraps, so near the line keep the lap that continues the
 * previous distance.
 */
function effectiveLap(track: CarTrack, lapRaw: number, pct: number): number {
  if (!track.prevValid) return lapRaw
  const dp = pct - track.prevPct
  const derived = dp < -0.5 ? track.effLap + 1 : dp > 0.5 ? track.effLap - 1 : track.effLap
  if (
    lapRaw !== derived &&
    Math.abs(lapRaw - derived) === 1 &&
    (pct < WRAP_WINDOW || pct > 1 - WRAP_WINDOW)
  ) {
    return derived
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
  const lap = effectiveLap(track, lapRaw, pct)
  const d = lap + pct
  track.lastDelta = 0
  const delta = d - track.prevD
  track.continuous = track.prevValid && delta <= TELEPORT_LAPS && delta >= -JITTER_LAPS
  if (!track.continuous) {
    // Entering the world, first sight or a jump: nothing to interpolate from.
    track.hwLine = Math.floor(d * LINES)
    track.hwD = d
    track.dirty = true
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
 * Pit-road entry/exit edges. Stops count only when `countStops` (green flag
 * running); a car already on pit road at first sight (pit-lane start) is not
 * a stop. Finishers keep their state as it was at the flag.
 */
export function updatePitEdges(
  track: CarTrack,
  onPitRoad: boolean,
  countStops: boolean,
  lapRaw: number,
  d: number
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
    if (countStops) st.pitStops++
    return
  }
  if (countStops) st.lastPitLap = lapRaw
  st.outLap = true
  track.stintStartLap = Math.floor(d)
}
