/**
 * Relative widget: cars nearest to the player on track, with time gaps
 * estimated from CarIdxEstTime, and your incident count for its header. Pure function of one
 * telemetry tick (plus the RaceModel's positions and stint counts, when given).
 */
import { driverIdentity } from './driver'
import { incidentCount } from './incidents/count'
import { isValidPct, wrapPctDelta } from './lapDist'
import { penaltyOf } from './penalty'
import type { RaceView } from './race/raceView'
import {
  currentSessionType,
  isCarInPits,
  isRaceSession,
  resolveFocusCarIdx,
  resolvePlayerCarIdx
} from './sessionInfo'
import { OPTION_SCHEMA, clampOption } from './settingsSchema'
import { isReplayPlaying } from './simScreen'
import { MAX_CARS, SessionState, TrackLocation } from './telemetry'
import type { TelemetryFrame } from './telemetry'
import { tyreCompoundOf, tyreModelOf, tyresVary } from './tyres'
import type {
  DriverEntry,
  LapRelation,
  RelativeData,
  RelativeOptions,
  RelativeRow,
  SessionMeta
} from './types'

/** Lap time assumed when neither the class nor DriverInfo report one (irDashies uses 90 s too). */
export const FALLBACK_LAP_TIME_S = 90

/** A configured row count as an integer in the option's range (invalid -> its default). */
export function clampRelativeSlots(n: number): number {
  return clampOption(OPTION_SCHEMA.relative.carsAhead, n)
}

function positive(n: number | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0
}

/**
 * Est lap time of the focus car's class (the ruler for every gap):
 * class est lap, else DriverInfo.DriverCarEstLapTime, else FALLBACK_LAP_TIME_S.
 */
export function referenceLapTime(focus: DriverEntry | undefined, session: SessionMeta): number {
  if (positive(focus?.classEstLapTime)) return focus.classEstLapTime
  if (positive(session.driverCarEstLapTime)) return session.driverCarEstLapTime
  return FALLBACK_LAP_TIME_S
}

/**
 * Time gap in seconds from the focus car to another car, positive = other is ahead.
 *
 * - `estOther` / `estFocus`: CarIdxEstTime of each car (seconds along its own class lap).
 * - `pctOther` / `pctFocus`: CarIdxLapDistPct of each car (both valid).
 * - `lapTimeOther` / `lapTimeFocus`: est lap time of each car's class. Non-positive
 *   values fall back to `lapTimeFocus`, and that one to FALLBACK_LAP_TIME_S.
 *
 * The other car's est time is rescaled to the focus class lap, and a crossing of
 * the S/F line between the two cars is corrected with the focus class lap time.
 * irDashies instead uses the class of the car physically behind as the ruler;
 * both are identical in single-class sessions, here the player's class is used.
 *
 * Returns null when an est time is not finite, and 0 when the gap sign disagrees
 * with the track position (tiny cross-class mismatch right next to the player).
 */
export function estimateGap(
  estOther: number,
  estFocus: number,
  pctOther: number,
  pctFocus: number,
  lapTimeOther: number,
  lapTimeFocus: number
): number | null {
  if (!Number.isFinite(estOther) || !Number.isFinite(estFocus)) return null
  if (!Number.isFinite(pctOther) || !Number.isFinite(pctFocus)) return null
  const lf = positive(lapTimeFocus) ? lapTimeFocus : FALLBACK_LAP_TIME_S
  const lo = positive(lapTimeOther) ? lapTimeOther : lf
  let d = estOther * (lf / lo) - estFocus
  const dp = pctOther - pctFocus
  if (dp > 0.5) d -= lf
  else if (dp < -0.5) d += lf
  // A car at exactly the same pct counts as behind (it sorts below the player).
  const rel = wrapPctDelta(pctOther, pctFocus)
  if ((rel > 0 && d < 0) || (rel <= 0 && d > 0)) return 0
  return d === 0 ? 0 : d
}

/** Lap relations only make sense in a race once the green flag has dropped. */
export function lapRelationsActive(sessionType: string | null, sessionState: number): boolean {
  return isRaceSession(sessionType) && sessionState >= SessionState.Racing
}

/**
 * Race-distance relation of another car to the focus car, from CarIdxLapCompleted
 * and CarIdxLapDistPct. `active` comes from `lapRelationsActive`.
 */
export function lapRelation(
  active: boolean,
  lapCompletedOther: number,
  pctOther: number,
  lapCompletedFocus: number,
  pctFocus: number
): LapRelation {
  if (!active) return 'same'
  if (!(lapCompletedOther >= 0) || !(lapCompletedFocus >= 0)) return 'same'
  const lapDiff = Math.round(lapCompletedOther + pctOther - (lapCompletedFocus + pctFocus))
  // Math.round(-0.5) is -0, which is neither > 0 nor < 0: 'same'.
  if (lapDiff > 0) return 'ahead'
  if (lapDiff < 0) return 'behind'
  return 'same'
}

// Scratch buffers reused across calls (the function is synchronous and not reentrant).
const relBuf = new Float64Array(MAX_CARS)
const aheadBuf: number[] = []
const behindBuf: number[] = []

/** relPct descending, ties by carIdx: the order rows are shown top to bottom. */
function byRelDesc(a: number, b: number): number {
  return (relBuf[b] ?? 0) - (relBuf[a] ?? 0) || a - b
}

/**
 * `race` gives each row its position and stint (null without it). The stint, tyre and flag
 * options are display-only: every row carries them.
 */
export function computeRelative(
  frame: TelemetryFrame,
  session: SessionMeta,
  opts: RelativeOptions,
  race: RaceView | null = null
): RelativeData {
  const slotsAhead = clampRelativeSlots(opts.carsAhead)
  const slotsBehind = clampRelativeSlots(opts.carsBehind)
  const sessionType = currentSessionType(frame, session)
  // The player, or the car on camera while a replay plays.
  const focusIdx = resolveFocusCarIdx(frame, session)
  const ownCar = focusIdx === resolvePlayerCarIdx(frame, session)
  const result: RelativeData = {
    rows: [],
    playerRow: -1,
    slotsAhead,
    slotsBehind,
    sessionType,
    // In the payload whatever showIncidents says (display only): one cheap read per tick. Yours
    // alone, so not while a replay follows another car (the header would read as theirs).
    incidents: ownCar ? incidentCount(frame, session) : null
  }

  const pcts = frame.CarIdxLapDistPct
  const surfaces = frame.CarIdxTrackSurface
  const focus = session.drivers.get(focusIdx)
  const pctF = pcts[focusIdx]
  if (!focus || !isValidPct(pctF) || surfaces[focusIdx] === TrackLocation.NotInWorld) {
    return result
  }

  aheadBuf.length = 0
  behindBuf.length = 0
  for (let i = 0; i < MAX_CARS; i++) {
    if (i === focusIdx) continue
    const pct = pcts[i]
    if (!isValidPct(pct) || surfaces[i] === TrackLocation.NotInWorld) continue
    const d = session.drivers.get(i)
    if (!d || d.isPaceCar || d.isSpectator || i === session.paceCarIdx) continue
    const rel = wrapPctDelta(pct, pctF)
    relBuf[i] = rel
    // rel 0 (same pct) is behind by the irDashies convention.
    if (rel > 0) aheadBuf.push(i)
    else behindBuf.push(i)
  }
  aheadBuf.sort(byRelDesc)
  behindBuf.sort(byRelDesc)

  const lapF = referenceLapTime(focus, session)
  const estF = frame.CarIdxEstTime[focusIdx] ?? NaN
  const sessionState = frame.SessionState[0] ?? SessionState.Invalid
  const lapsActive = lapRelationsActive(sessionType, sessionState)
  const lapCompletedF = frame.CarIdxLapCompleted[focusIdx] ?? -1
  const tyreModel = tyreModelOf(session)
  // The same compound on every car says nothing: no tyre until one differs.
  const tyres = tyresVary(frame, session, tyreModel)
  // A replay's race model never saw the stops before it (loop.ts): its stints would be the race.
  const stints = isReplayPlaying(frame) ? null : race
  const isRace = isRaceSession(sessionType)
  const preGreen = isRace && sessionState < SessionState.Racing

  /**
   * The position Standings shows (the race model's, live by distance), not CarIdxClassPosition:
   * iRacing only updates that at the line (on lap 1 it is still the grid). The grid slot only
   * in a race before the green; outside races, none without a lap time. Without a model of
   * the car, CarIdxClassPosition in a race.
   */
  const positionOf = (idx: number): number | null => {
    if (preGreen) {
      const slot = session.grid.get(idx)?.classPosition ?? 0
      if (slot > 0) return slot
    }
    const car = race?.car(idx)
    if (car) return car.classPosition > 0 ? car.classPosition : null
    const classPos = frame.CarIdxClassPosition[idx]
    return isRace && classPos !== undefined && classPos > 0 ? classPos : null
  }

  const makeRow = (idx: number, d: DriverEntry): RelativeRow => {
    const isPlayer = idx === focusIdx
    const pct = pcts[idx] ?? 0
    return {
      ...driverIdentity(d),
      isPlayer,
      classPosition: positionOf(idx),
      classShortName: d.classShortName,
      gapS: isPlayer
        ? 0
        : estimateGap(frame.CarIdxEstTime[idx] ?? NaN, estF, pct, pctF, d.classEstLapTime, lapF),
      lapRelation: isPlayer
        ? 'same'
        : lapRelation(lapsActive, frame.CarIdxLapCompleted[idx] ?? -1, pct, lapCompletedF, pctF),
      inPits: isCarInPits(frame, idx),
      stintLaps: stints?.car(idx)?.stintLaps ?? null,
      tyre: tyres ? tyreCompoundOf(frame, session, tyreModel, idx) : null,
      penalty: penaltyOf(frame.CarIdxSessionFlags[idx], race?.car(idx)?.finished === true)
    }
  }

  const rows = result.rows
  // Closest cars ahead are at the end of the descending order.
  for (let k = Math.max(0, aheadBuf.length - slotsAhead); k < aheadBuf.length; k++) {
    const idx = aheadBuf[k]
    const d = idx !== undefined ? session.drivers.get(idx) : undefined
    if (idx !== undefined && d) rows.push(makeRow(idx, d))
  }
  result.playerRow = rows.length
  rows.push(makeRow(focusIdx, focus))
  const behindEnd = Math.min(behindBuf.length, slotsBehind)
  for (let k = 0; k < behindEnd; k++) {
    const idx = behindBuf[k]
    const d = idx !== undefined ? session.drivers.get(idx) : undefined
    if (idx !== undefined && d) rows.push(makeRow(idx, d))
  }
  return result
}
