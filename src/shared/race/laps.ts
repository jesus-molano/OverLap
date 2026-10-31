/**
 * Lap records of one car: built at each S/F crossing from the timing lines,
 * then refined with CarIdxLastLapTime (official precision) when iRacing
 * publishes the same lap.
 */
import type { CarTrack, MutableLapRecord } from './carTrack'
import { captureLap, promoteBest } from './profiles'
import { RACE_TIMING_LINES } from './raceView'

const LINES = RACE_TIMING_LINES
export const MAX_LAP_RECORDS = 10
/** CarIdxLastLapTime this close to the model lap is the same lap: the official value replaces it. */
const OFFICIAL_MATCH_S = 0.05
/** How long after the line CarIdxLastLapTime may still confirm the model lap. */
export const OFFICIAL_WAIT_S = 5
/**
 * An incident of yours this soon (s) after your line spoils the lap that line closed too: iRacing
 * scores an off-track a moment after the wheels left, and the line may come between.
 */
export const INCIDENT_LINE_GRACE_S = 0.5

/** Illegal lap times of your own kept (CarTrack.illegalTimes): a session's worth of offs. */
export const MAX_ILLEGAL_TIMES = 32

/** Notes one of your laps as not legal (its time): iRacing's best may be it. */
function noteIllegal(track: CarTrack, time: number): void {
  if (!track.ownCar || !Number.isFinite(time)) return
  track.illegalTimes.push(time)
  if (track.illegalTimes.length > MAX_ILLEGAL_TIMES) track.illegalTimes.shift()
}

/**
 * Lap `g / LINES` completed at SessionTime `tc`: adds its record when its start
 * line is in the history, then starts a new lap. In a race (`raceStartT`: the
 * green flag, -Infinity when it was never seen) a lap is not clean when it
 * started before the green or at the car's first S/F line under green. After a
 * standing start (the grid is behind the line) the first lap runs from the
 * green, as iRacing times it, not from the line.
 */
export function closeLap(
  track: CarTrack,
  g: number,
  tc: number,
  isRace: boolean,
  raceStartT: number
): void {
  const lapNo = g / LINES
  const newest = track.records[0]
  const g0 = g - LINES
  if ((!newest || lapNo >= newest.lap) && track.has(g0)) {
    const t0 = track.time(g0)
    const startLap = isRace && (!(t0 >= raceStartT) || g0 <= track.startSfLine)
    let clean =
      !track.dirty && !track.lapOffTrack && !track.lapStopped && !track.lapIncident && !startLap
    for (let k = g0; clean && k <= g; k++) {
      if (!track.has(k) || track.flagsAt(k) !== 0) clean = false
    }
    const fromGreen =
      isRace && track.gridStart && g0 === track.startSfLine && raceStartT > -Infinity
    const rec: MutableLapRecord = { lap: lapNo, time: tc - (fromGreen ? raceStartT : t0), clean }
    // Re-crossing after a backward jump replaces the record of that lap.
    const keep = track.records.slice(newest?.lap === lapNo ? 1 : 0, MAX_LAP_RECORDS)
    if (keep.length === MAX_LAP_RECORDS) keep.pop()
    keep.unshift(rec)
    track.records = keep
    track.state.laps = keep
    if (clean && rec.time < track.bestClean) {
      track.prevBestClean = track.bestClean
      track.bestCleanRec = rec
      track.bestClean = rec.time
    }
    // Off track, or an incident of yours on it: not legal (a pit or caution lap still is).
    if (track.lapOffTrack || track.lapIncident) noteIllegal(track, rec.time)
    track.pending = rec
    track.officialBefore = track.prevOfficial
    track.confirmUntil = tc + OFFICIAL_WAIT_S
    // The lines only span the part from the line: no profile of a lap timed from the green.
    if (fromGreen) track.lastLap.clear()
    else captureLap(track, g0, rec)
  } else {
    // No record for the lap just completed: no 'last' profile either.
    track.lastLap.clear()
  }
  track.dirty = false
  track.lapOffTrack = false
  track.lapStopped = false
  track.lapIncident = false
}

/**
 * Your incident count rose at SessionTime `now` (the player's car only, an off-track: see
 * RaceModel.updatePlayer). Under INCIDENT_LINE_GRACE_S after your line it is the lap that line
 * closed (iRacing scores an off a moment after the wheels left): that lap stops being clean, the
 * new one stays clean. Otherwise the lap in progress is not clean. A lap that stops being clean
 * stops being the best: the one before it is back (its time and its profile), so no reference,
 * record or optimal sector ever keeps it.
 */
export function incidentOnLap(track: CarTrack, now: number): void {
  const rec = track.records[0]
  if (now - track.lastSfT <= INCIDENT_LINE_GRACE_S && rec?.lap === track.lastSfLap) {
    if (!rec.clean) return
    rec.clean = false
    noteIllegal(track, rec.time)
    if (track.bestCleanRec === rec) {
      track.bestClean = track.prevBestClean
      track.bestCleanRec = null
    }
    if (track.bestLap.rec === rec) track.bestLap.copyFrom(track.prevBest)
    return
  }
  track.lapIncident = true
  track.state.lapInvalid = true
}

/**
 * Last/best lap of the tick from the model records and the official
 * CarIdxLastLapTime / CarIdxBestLapTime (-1 when none). A finisher's last lap
 * freezes once the official time of its finishing lap had time to arrive.
 */
export function updateLapTimes(
  track: CarTrack,
  official: number,
  officialBest: number,
  completed: number,
  now: number
): void {
  const pending = track.pending
  if (pending) {
    if (now > track.confirmUntil) {
      track.pending = null
    } else if (
      official > 0 &&
      official !== track.officialBefore &&
      Math.abs(official - pending.time) < OFFICIAL_MATCH_S
    ) {
      // Same lap as iRacing timed it: keep its exact value (matches its timing screens).
      pending.time = official
      track.pending = null
      // Its profile follows (rescaled on the next read); the exact time may make it the best.
      if (pending === track.lastLap.rec) promoteBest(track)
    }
  }
  track.prevOfficial = official
  if (officialBest > 0) track.officialBest = officialBest
  const st = track.state
  if (!st.finished || now <= track.finishT + OFFICIAL_WAIT_S) {
    const rec = track.records[0]
    st.lastLapTime =
      rec && rec.lap === completed ? rec.time : official > 0 ? official : (rec?.time ?? null)
  }
  // iRacing's best, but for your own car not when it is one of your illegal laps: then your
  // best legal lap, as the delta's session best (both say the same).
  const iBest = track.officialBest
  const illegal =
    track.ownCar &&
    Number.isFinite(iBest) &&
    track.illegalTimes.some((t) => Math.abs(t - iBest) < OFFICIAL_MATCH_S)
  const best = Number.isFinite(iBest) && !illegal ? iBest : track.bestClean
  st.bestLapTime = Number.isFinite(best) ? best : null
}
