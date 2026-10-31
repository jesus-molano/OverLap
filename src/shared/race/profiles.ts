/**
 * Lap profiles of the RaceModel (RaceView.currentLap / lapProfile), for the
 * delta widget.
 *
 * When an S/F crossing closes a lap record (laps.ts), the crossing times of
 * its RACE_TIMING_LINES + 1 lines, cumulative from the lap start, are copied
 * from the ring buffer into a per-car preallocated buffer (no allocation in
 * the 60 Hz loop). A clean lap faster than the car's best is copied again
 * into the best buffer, so it survives the 5-lap history.
 *
 * Queries hand out frozen snapshots, built on the first read and cached until
 * the lap they describe changes (a new lap, or CarIdxLastLapTime refining its
 * time): the same object while unchanged, a new one otherwise, so a consumer
 * may keep one (e.g. a reference for a whole lap) and compare by identity.
 */
import type { CarTrack, MutableLapRecord } from './carTrack'
import { RACE_TIMING_LINES } from './raceView'

const LINES = RACE_TIMING_LINES

export interface LapProfileView {
  readonly lap: number
  readonly lapTime: number
  readonly clean: boolean
  /** RACE_TIMING_LINES + 1 cumulative seconds from the lap start: 0 .. lapTime, non-decreasing. */
  readonly profile: readonly number[]
}

export interface CurrentLapView {
  readonly lap: number
  readonly elapsedS: number
}

/** One captured lap of a car: its record and the model's cumulative crossing times. */
export class LapCapture {
  /** Model-timed cumulative crossing times of lines 0..LINES (times[0] = 0); valid when rec. */
  readonly times = new Float64Array(LINES + 1)
  /** The lap, null when none (its time may still be refined to the official value). */
  rec: MutableLapRecord | null = null
  private view: LapProfileView | null = null
  private viewRec: MutableLapRecord | null = null

  clear(): void {
    this.rec = null
    this.view = null
    this.viewRec = null
  }

  copyFrom(other: LapCapture): void {
    this.times.set(other.times)
    this.rec = other.rec
  }

  /**
   * Frozen profile of the lap, scaled to its record time (the official one once
   * CarIdxLastLapTime confirmed it, a few ms off the model's); null when none.
   */
  snapshot(): LapProfileView | null {
    const rec = this.rec
    if (!rec) return null
    const cached = this.view
    // A lap can turn unclean after the line (an incident): a new snapshot says so.
    if (
      cached &&
      this.viewRec === rec &&
      cached.lapTime === rec.time &&
      cached.clean === rec.clean
    ) {
      return cached
    }
    const t = this.times
    const lapTime = rec.time
    const scale = lapTime / (t[LINES] ?? lapTime)
    const profile: number[] = []
    // Scaling keeps the order; the clamp absorbs the rounding of the last step.
    for (let k = 0; k < LINES; k++) profile.push(Math.min((t[k] ?? 0) * scale, lapTime))
    profile.push(lapTime)
    const view: LapProfileView = Object.freeze({
      lap: rec.lap,
      lapTime,
      clean: rec.clean,
      profile: Object.freeze(profile)
    })
    this.view = view
    this.viewRec = rec
    return view
  }
}

/**
 * Lap `rec` was just closed at line `g0 + LINES`: copies its crossings into
 * track.lastLap and makes it the best when clean and faster. A lap with a line
 * missing (teleport) or time going back gets no profile.
 */
export function captureLap(track: CarTrack, g0: number, rec: MutableLapRecord): void {
  const cap = track.lastLap
  cap.clear()
  const t0 = track.time(g0)
  const times = cap.times
  let prev = 0
  for (let k = 0; k <= LINES; k++) {
    const v = track.time(g0 + k) - t0
    if (!(v >= prev)) return
    times[k] = v
    prev = v
  }
  if (!(prev > 0)) return
  cap.rec = rec
  promoteBest(track)
}

/** Makes the last captured lap the car's best when it is clean and faster (also after a refinement). */
export function promoteBest(track: CarTrack): void {
  const rec = track.lastLap.rec
  if (!rec?.clean) return
  const best = track.bestLap
  if (best.rec === rec || (best.rec !== null && best.rec.time <= rec.time)) return
  // Kept until the next promotion: an incident just after the line puts it back (incidentOnLap).
  track.prevBest.copyFrom(best)
  best.copyFrom(track.lastLap)
}

/** See RaceView.lapProfile: 'last' only while it is the lap completed at the car's last S/F crossing. */
export function lapProfile(track: CarTrack, which: 'best' | 'last'): LapProfileView | null {
  if (which === 'best') return track.bestLap.snapshot()
  if (which !== 'last') return null
  const rec = track.lastLap.rec
  return rec && rec.lap === track.lastSfLap ? track.lastLap.snapshot() : null
}

/**
 * See RaceView.currentLap. Null too after the flag (cool-down laps are not
 * timed) and while the lap in progress is not continuous with its S/F
 * crossing (a tow, teleport, world exit/entry or telemetry gap since): its
 * elapsed time would not be a lap time, until the next crossing.
 */
export function currentLap(track: CarTrack, now: number): CurrentLapView | null {
  const st = track.state
  if (!st.inWorld || st.finished || track.dirty || Number.isNaN(track.lastSfT)) return null
  // Still on the lap that crossing started (the high-water line is on it).
  if (Math.floor(track.hwLine / LINES) !== track.lastSfLap) return null
  const elapsedS = now - track.lastSfT
  if (!(elapsedS >= 0)) return null
  const lap = track.lastSfLap + 1
  const cur = track.currentView
  if (cur && cur.lap === lap && cur.elapsedS === elapsedS) return cur
  const view: CurrentLapView = Object.freeze({ lap, elapsedS })
  track.currentView = view
  return view
}
