/**
 * Structural equality of standings payloads, for SKIP_EMIT: an unchanged
 * table is not sent again. The provider already leaves out what no visible
 * column draws, so every field compared here can be on screen. Pure.
 */
import { identityEqual } from './driver'
import { sameNumber } from './equal'
import { incidentCountEqual } from './incidents/count'
import type {
  GapValue,
  PlayerRatingProjection,
  SafetyRatingProjection,
  StandingsClassBlock,
  StandingsData
} from './types'

type DisplayRow = StandingsClassBlock['rows'][number]

/** sameNumber for nullable numbers. */
function same(a: number | null, b: number | null): boolean {
  return a === null || b === null ? a === b : sameNumber(a, b)
}

function gapEqual(a: GapValue | null, b: GapValue | null): boolean {
  if (a === null || b === null) return a === b
  if (a.kind === 'time') return b.kind === 'time' && sameNumber(a.seconds, b.seconds)
  return b.kind === 'laps' && sameNumber(a.laps, b.laps)
}

function rowEqual(a: DisplayRow, b: DisplayRow): boolean {
  return (
    identityEqual(a, b) &&
    a.isPlayer === b.isPlayer &&
    a.classPosition === b.classPosition &&
    same(a.positionsGained, b.positionsGained) &&
    gapEqual(a.interval, b.interval) &&
    gapEqual(a.gapToLeader, b.gapToLeader) &&
    same(a.lastLap, b.lastLap) &&
    a.lastLapKind === b.lastLapKind &&
    same(a.bestLap, b.bestLap) &&
    a.bestLapKind === b.bestLapKind &&
    a.pitStops === b.pitStops &&
    same(a.lastPitLap, b.lastPitLap) &&
    a.outLap === b.outLap &&
    same(a.stintLaps, b.stintLaps) &&
    a.tyre === b.tyre &&
    a.status === b.status &&
    a.penalty === b.penalty &&
    same(a.iRatingDelta, b.iRatingDelta) &&
    a.gapBefore === b.gapBefore
  )
}

function projectionEqual(
  a: PlayerRatingProjection | null,
  b: PlayerRatingProjection | null
): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  return (
    sameNumber(a.iRatingDelta, b.iRatingDelta) &&
    sameNumber(a.perPosition, b.perPosition) &&
    sameNumber(a.breakEvenPosition, b.breakEvenPosition) &&
    same(a.ifGainOne, b.ifGainOne) &&
    same(a.ifLoseOne, b.ifLoseOne)
  )
}

function safetyEqual(a: SafetyRatingProjection | null, b: SafetyRatingProjection | null): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  return (
    sameNumber(a.current, b.current) &&
    sameNumber(a.projected, b.projected) &&
    a.licClass === b.licClass &&
    a.projectedLicClass === b.projectedLicClass &&
    sameNumber(a.incidents, b.incidents) &&
    sameNumber(a.corners, b.corners) &&
    sameNumber(a.incidentBudget, b.incidentBudget)
  )
}

function blockEqual(a: StandingsClassBlock, b: StandingsClassBlock): boolean {
  if (
    a.classId !== b.classId ||
    a.className !== b.className ||
    a.classColor !== b.classColor ||
    !same(a.sof, b.sof) ||
    a.carCount !== b.carCount ||
    a.isPlayerClass !== b.isPlayerClass ||
    a.rows.length !== b.rows.length
  ) {
    return false
  }
  for (let r = 0; r < a.rows.length; r++) {
    const ra = a.rows[r]
    const rb = b.rows[r]
    if (!ra || !rb || !rowEqual(ra, rb)) return false
  }
  return true
}

/** True when the widget would paint the same table. */
export function standingsEqual(a: StandingsData, b: StandingsData): boolean {
  if (a === b) return true
  const ha = a.header
  const hb = b.header
  if (
    ha.sessionType !== hb.sessionType ||
    !same(ha.lapsRemaining, hb.lapsRemaining) ||
    !same(ha.timeRemainingS, hb.timeRemainingS) ||
    !projectionEqual(ha.iRating, hb.iRating) ||
    !safetyEqual(ha.safetyRating, hb.safetyRating) ||
    !incidentCountEqual(ha.incidents, hb.incidents) ||
    a.classes.length !== b.classes.length
  ) {
    return false
  }
  for (let c = 0; c < a.classes.length; c++) {
    const ca = a.classes[c]
    const cb = b.classes[c]
    if (!ca || !cb || !blockEqual(ca, cb)) return false
  }
  return true
}
