/**
 * The data of the info bars (infoBar.ts): one InfoFeed per provider set fills, for the items a
 * widget's bars draw, the InfoBarData its payload carries (RelativeData.info, StandingsData.info,
 * FuelData.info). Only the sources those items read are computed (INFO_ITEMS[id].source), so a
 * bar of three items costs three reads; the rest stays null and the payload only changes when
 * something shown does. The weather is the provider set's ConditionsFeed (one reading a second
 * for every bar), the fuel its FuelTracker; the projections have their own caches here (the
 * standings hand theirs in instead, `known`).
 */
import type { ConditionsFeed } from './conditions'
import { footerConditionsEqual } from './conditions'
import { sameNumber } from './equal'
import { consumption } from './fuel/provider'
import type { FuelTracker } from './fuel/tracker'
import { incidentCount, incidentCountEqual } from './incidents/count'
import { infoSources, type InfoSource } from './infoBar'
import { isFiniteNumber } from './num'
import type { RaceView } from './race/raceView'
import { projectionEqual, safetyEqual } from './ratings/equal'
import { classRatingField } from './ratings/field'
import { PlayerSafety } from './ratings/playerSafety'
import { ClassRatingsCache } from './ratings/projection'
import { isRatedEvent } from './ratings/rated'
import {
  currentSessionType,
  isRaceSession,
  resolveFocusCarIdx,
  resolvePlayerCarIdx
} from './sessionInfo'
import type { TelemetryFrame } from './telemetry'
import type { FastestLapInfo, InfoBarData, InfoItemId, SessionMeta } from './types'

/** Nothing known: every field a bar does not read. */
export const NO_INFO: Readonly<InfoBarData> = Object.freeze({
  sessionType: null,
  lapsRemaining: null,
  timeRemainingS: null,
  finished: false,
  sof: null,
  carCount: null,
  incidents: null,
  iRating: null,
  classPosition: null,
  safetyRating: null,
  fastestLap: null,
  conditions: null,
  fuelLaps: null,
  simMinutes: null
})

/** What the asking provider already computed (the standings' header): taken as it is. */
export type KnownInfo = Partial<InfoBarData>

/** Your car, or the car on camera while a replay plays (as the standings' header does). */
function focusCar(frame: TelemetryFrame, session: SessionMeta, race: RaceView): number {
  return race.playerCarIdx >= 0 ? race.playerCarIdx : resolveFocusCarIdx(frame, session)
}

/** Whole laps left (ceil, so the 4 Hz payloads only change when the display does). */
function wholeLaps(laps: number | null): number | null {
  return laps !== null && Number.isFinite(laps) ? Math.max(0, Math.ceil(laps - 1e-6)) : null
}

function wholeSeconds(s: number | null): number | null {
  return s !== null && Number.isFinite(s) ? Math.max(0, Math.floor(s)) : null
}

/** The fastest lap of `classId` (every class with -1) this session; null when nobody has one. */
export function fastestLapOf(
  session: SessionMeta,
  race: RaceView,
  classId: number,
  playerIdx: number
): FastestLapInfo | null {
  let best: FastestLapInfo | null = null
  for (const car of race.cars()) {
    const lap = car.bestLapTime
    if (lap === null || !(lap > 0)) continue
    const d = session.drivers.get(car.carIdx)
    if (d === undefined || (classId >= 0 && d.classId !== classId)) continue
    if (best !== null && !(lap < best.lapTime)) continue
    best = {
      lapTime: Math.round(lap * 1000) / 1000,
      carIdx: car.carIdx,
      carNumber: d.carNumber,
      driverName: d.userName,
      isPlayer: car.carIdx === playerIdx
    }
  }
  return best
}

export class InfoFeed {
  private readonly ratings = new ClassRatingsCache()
  private readonly safety = new PlayerSafety()

  constructor(
    private readonly conditions: ConditionsFeed,
    private readonly fuel: FuelTracker
  ) {}

  /** A reconnect or a new session (the conditions and the fuel reset with their own owners). */
  reset(): void {
    this.ratings.clear()
    this.safety.reset()
  }

  /**
   * The data for `items` (the items some bar of the widget draws: sectionInfoItems), null when
   * none of them needs any. `avgLaps`: the fuel's average (FuelOptions.avgLaps).
   */
  get(
    frame: TelemetryFrame,
    session: SessionMeta,
    race: RaceView,
    items: readonly InfoItemId[],
    avgLaps: number,
    known: KnownInfo = {}
  ): InfoBarData | null {
    const sources = infoSources(items)
    if (sources.size === 0) return null
    const need = (s: InfoSource): boolean => sources.has(s)
    const out: InfoBarData = { ...NO_INFO }
    const sessionType = known.sessionType ?? currentSessionType(frame, session)
    const isRace = isRaceSession(sessionType)
    const playerIdx = focusCar(frame, session, race)
    // Yours alone: never for a car a replay follows (it would read as theirs).
    const ownCar = playerIdx >= 0 && playerIdx === resolvePlayerCarIdx(frame, session)
    const driver = playerIdx >= 0 ? session.drivers.get(playerIdx) : undefined
    const classId = driver?.classId ?? -1
    const lapsLeft = playerIdx >= 0 ? race.lapsRemaining(playerIdx) : null

    if (need('session')) {
      out.sessionType = sessionType
      out.lapsRemaining =
        known.lapsRemaining !== undefined ? known.lapsRemaining : wholeLaps(lapsLeft)
      out.timeRemainingS =
        known.timeRemainingS !== undefined
          ? known.timeRemainingS
          : wholeSeconds(race.timeRemainingS)
      const car = playerIdx >= 0 ? race.car(playerIdx) : undefined
      out.finished = isRace && (out.lapsRemaining === 0 || car?.finished === true)
    }
    if (need('incidents')) {
      out.incidents =
        known.incidents !== undefined
          ? known.incidents
          : ownCar
            ? incidentCount(frame, session)
            : null
    }
    if ((need('field') || need('ratings')) && classId >= 0) {
      const preGreen = isRace && !race.racing
      const withDeltas = need('ratings') && isRace && isRatedEvent(session)
      this.ratings.begin()
      const field = classRatingField(session, race, classId, preGreen)
      const ratings = this.ratings.get(classId, field, playerIdx, withDeltas)
      this.ratings.sweep()
      if (need('field')) {
        out.sof = known.sof !== undefined ? known.sof : ratings.sof
        out.carCount =
          known.carCount !== undefined ? known.carCount : classEntries(session, classId)
      }
      if (need('ratings')) {
        out.iRating =
          known.iRating !== undefined ? known.iRating : withDeltas ? ratings.player : null
        const pos = race.car(playerIdx)?.classPosition ?? 0
        out.classPosition = pos > 0 ? pos : null
      }
    }
    if (need('ratings')) {
      out.safetyRating =
        known.safetyRating !== undefined
          ? known.safetyRating
          : isRatedEvent(session) && ownCar
            ? this.safety.project(
                frame,
                session,
                race,
                playerIdx,
                isRace ? lapsLeft : null,
                sessionType ?? ''
              )
            : null
    }
    if (need('fastestLap')) out.fastestLap = fastestLapOf(session, race, classId, playerIdx)
    if (need('conditions')) out.conditions = this.conditions.get(frame, session)
    if (need('fuel') && ownCar) {
      const raw = frame.FuelLevel[0]
      const avg = consumption(this.fuel.samples, avgLaps).avgL
      out.fuelLaps =
        isFiniteNumber(raw) && raw >= 0 && avg !== null && avg > 0
          ? Math.round((raw / avg) * 10) / 10
          : null
    }
    if (need('simTime')) out.simMinutes = simMinutesOf(frame.SessionTimeOfDay[0])
    return out
  }
}

/** Whole minutes since midnight (0..1439) of a time of day in seconds; null when unknown. */
export function simMinutesOf(seconds: number | undefined): number | null {
  if (!isFiniteNumber(seconds) || seconds < 0) return null
  return Math.floor(seconds / 60) % 1440
}

/** The registered entries of a class (pace car and spectators left out). */
function classEntries(session: SessionMeta, classId: number): number {
  let n = 0
  for (const d of session.drivers.values()) {
    if (
      d.classId === classId &&
      !d.isPaceCar &&
      !d.isSpectator &&
      d.carIdx !== session.paceCarIdx
    ) {
      n++
    }
  }
  return n
}

function same(a: number | null, b: number | null): boolean {
  return a === null || b === null ? a === b : sameNumber(a, b)
}

function fastestEqual(a: FastestLapInfo | null, b: FastestLapInfo | null): boolean {
  if (a === null || b === null) return a === b
  return (
    sameNumber(a.lapTime, b.lapTime) &&
    a.carIdx === b.carIdx &&
    a.carNumber === b.carNumber &&
    a.driverName === b.driverName &&
    a.isPlayer === b.isPlayer
  )
}

/** Structural equality (for the SKIP_EMIT rules of the widgets that carry it). */
export function infoBarDataEqual(a: InfoBarData | null, b: InfoBarData | null): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  return (
    a.sessionType === b.sessionType &&
    same(a.lapsRemaining, b.lapsRemaining) &&
    same(a.timeRemainingS, b.timeRemainingS) &&
    a.finished === b.finished &&
    same(a.sof, b.sof) &&
    same(a.carCount, b.carCount) &&
    incidentCountEqual(a.incidents, b.incidents) &&
    projectionEqual(a.iRating, b.iRating) &&
    same(a.classPosition, b.classPosition) &&
    safetyEqual(a.safetyRating, b.safetyRating) &&
    fastestEqual(a.fastestLap, b.fastestLap) &&
    footerConditionsEqual(a.conditions, b.conditions) &&
    same(a.fuelLaps, b.fuelLaps) &&
    a.simMinutes === b.simMinutes
  )
}
