/**
 * Read-side timing queries of the RaceModel, as free functions over CarTrack.
 * They run at provider rate (a few Hz), never inside the 60 Hz update.
 */
import { FLAG_PIT, HISTORY_LAPS, NO_LINE } from './carTrack'
import type { CarTrack } from './carTrack'
import { RACE_TIMING_LINES } from './raceView'

const LINES = RACE_TIMING_LINES
/** Most recent clean laps averaged for a car's pace. */
const PACE_LAPS = 3

export interface GapSample {
  distance: number
  gap: number
  clean: boolean
}

/**
 * Seconds `b` trails `a` at the last timing line `b` crossed (see
 * RaceView.timeGap); `now` is the SessionTime of the last tick.
 */
export function timeGap(b: CarTrack, a: CarTrack, now: number): number | null {
  if (b.state.finished || a.state.finished) return finishGap(b, a, now)
  if (!a.state.inWorld || !b.state.inWorld) return null
  if (a.lastLine === NO_LINE || b.lastLine === NO_LINE) return null
  if (b.lastLine <= a.lastLine) {
    const g = b.lastLine
    if (!a.has(g) || !b.has(g)) return null
    const gap = b.time(g) - a.time(g)
    // Between lines the gap is at least the time since `ahead` crossed the next one,
    // so it grows live when `behind` slows down or stops.
    const live = a.has(g + 1) ? Math.max(gap, now - a.time(g + 1)) : gap
    // Passed between two lines (e.g. a car stopped in its box): not behind any more.
    if (b.lastD >= a.lastD) return Math.min(live, 0)
    // `ahead` is in or went through the pits after line g: the gap there predates its
    // stop and would stay that large until `behind` reaches the pit box. Use the time
    // `behind` needs to reach it at its own pace instead.
    if (a.state.inPits || crossedPitsAfter(a, g)) {
      const reach = timeToReach(b, a)
      if (reach !== null) return Math.min(live, reach)
    }
    return live
  }
  // `behind` is actually ahead: negative gap at `ahead`'s last line.
  const g = a.lastLine
  if (!a.has(g) || !b.has(g)) return null
  const gap = b.time(g) - a.time(g)
  return b.has(g + 1) ? Math.min(gap, b.time(g + 1) - now) : gap
}

/**
 * Gap when either car took the flag. A finisher's timing stopped at its finish
 * line (no cool-down lines are recorded), so the gap is frozen there and
 * survives it leaving the world; cool-down driving, slowing down or a pit
 * entry after the flag do not change it.
 */
function finishGap(b: CarTrack, a: CarTrack, now: number): number | null {
  const bs = b.state
  const as = a.state
  if ((!bs.finished && !bs.inWorld) || (!as.finished && !as.inWorld)) return null
  if (bs.finished && as.finished && b.finishLap === a.finishLap) return b.finishT - a.finishT
  if (a.lastLine === NO_LINE || b.lastLine === NO_LINE) return null
  const g = Math.min(a.lastLine, b.lastLine)
  if (!a.has(g) || !b.has(g)) return null
  const gap = b.time(g) - a.time(g)
  // Still racing towards a finisher: the gap grows live until the next line, as above.
  if (!bs.finished && g === b.lastLine && g < a.lastLine && a.has(g + 1)) {
    return Math.max(gap, now - a.time(g + 1))
  }
  return gap
}

/**
 * Seconds `b` needs to cover the distance up to `a`: what it took over the same stretch
 * on its previous lap, else distance x pace. Null when unknown.
 */
function timeToReach(b: CarTrack, a: CarTrack): number | null {
  const from = b.lastD
  const to = a.lastD
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null
  if (to <= from) return 0
  const t0 = timeAtDistance(b, from - 1)
  const t1 = timeAtDistance(b, to - 1)
  if (t1 >= t0 && !crossedPitsBetween(b, from - 1, to - 1)) return t1 - t0
  const p = pace(b)
  return p !== null ? (to - from) * p : null
}

/** Whole laps `b` trails `a` by race distance (frozen at the finish line for finishers). */
export function lapsBehind(b: CarTrack, a: CarTrack): number {
  const diff = a.orderDistance() - b.orderDistance()
  return diff > 0 ? Math.floor(diff) : 0
}

/** Gap samples at each line `b` crossed during its last `laps` laps (see RaceView.gapHistory). */
export function gapHistory(b: CarTrack, a: CarTrack, laps: number): GapSample[] {
  const out: GapSample[] = []
  if (b.lastLine === NO_LINE || !(laps > 0)) return out
  const span = Math.round(Math.min(laps, HISTORY_LAPS) * LINES)
  const last = b.lastLine
  for (let g = last - span + 1; g <= last; g++) {
    if (!b.has(g) || !a.has(g)) continue
    out.push({
      distance: g / LINES,
      gap: b.time(g) - a.time(g),
      clean: (b.flagsAt(g) | a.flagsAt(g)) === 0
    })
  }
  return out
}

/**
 * Sector times of completed lap `lap` (CarIdxLapCompleted after it), from the
 * crossings of the sector `lines` (snapped SectorStartPct); null when unknown.
 */
export function lapSectors(
  track: CarTrack,
  lap: number,
  lines: readonly number[]
): number[] | null {
  if (lines.length === 0 || !Number.isInteger(lap)) return null
  const end = lap * LINES
  const start = end - LINES
  const out = new Array<number>(lines.length)
  for (let k = 0; k < lines.length; k++) {
    const next = lines[k + 1]
    const a = start + (lines[k] ?? 0)
    const b = next !== undefined ? start + next : end
    if (!track.has(a) || !track.has(b)) return null
    out[k] = track.time(b) - track.time(a)
  }
  return out
}

/** Average of the last clean laps, else class est lap, else best lap; null when none. */
export function pace(track: CarTrack): number | null {
  let sum = 0
  let n = 0
  const recs = track.records
  for (let k = 0; k < recs.length && n < PACE_LAPS; k++) {
    const r = recs[k]
    if (r?.clean) {
      sum += r.time
      n++
    }
  }
  if (n > 0) return sum / n
  if (track.estLapTime > 0) return track.estLapTime
  const best = track.state.bestLapTime
  return best !== null && best > 0 ? best : null
}

/** A recorded crossing of `track` of a line in first..last was on pit road. */
function pitCrossing(track: CarTrack, first: number, last: number): boolean {
  const end = Math.min(last, first + HISTORY_LAPS * LINES)
  for (let k = first; k <= end; k++) {
    if (track.has(k) && (track.flagsAt(k) & FLAG_PIT) !== 0) return true
  }
  return false
}

/** `track` crossed a line on pit road after line `g`. */
function crossedPitsAfter(track: CarTrack, g: number): boolean {
  return pitCrossing(track, g + 1, track.lastLine)
}

/** `track` crossed a line on pit road between race distances `from` and `to` (laps). */
function crossedPitsBetween(track: CarTrack, from: number, to: number): boolean {
  return pitCrossing(track, Math.floor(from * LINES), Math.ceil(to * LINES))
}

/** SessionTime at which `track` was at race distance `x`, between line crossings; NaN when unknown. */
function timeAtDistance(track: CarTrack, x: number): number {
  const pos = x * LINES
  const g = Math.floor(pos)
  const t0 = track.time(g)
  const t1 = track.time(g + 1)
  return t0 + (t1 - t0) * (pos - g)
}
