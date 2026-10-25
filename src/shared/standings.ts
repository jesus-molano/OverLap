/**
 * Standings widget: the classification per class, built from the RaceModel's
 * view (positions, gaps, pits, laps, finish) and the session YAML (names,
 * iRating, licences). Runs at 4 Hz. Its only state, owned by one
 * StandingsProvider per telemetry loop, is a cache of the rating projections.
 */
import { driverIdentity } from './driver'
import { incidentCount } from './incidents/count'
import { frac } from './num'
import { penaltyOf } from './penalty'
import type { RaceCarState, RaceView } from './race/raceView'
import { classRatingField } from './ratings/field'
import { ClassRatingsCache } from './ratings/projection'
import { isRatedEvent } from './ratings/rated'
import { projectSessionSafetyRating } from './ratings/sessionSafety'
import {
  currentSessionType,
  isRaceSession,
  resolveFocusCarIdx,
  resolvePlayerCarIdx
} from './sessionInfo'
import { OPTION_SCHEMA, clampOption } from './settingsSchema'
import { isReplayPlaying } from './simScreen'
import type { TelemetryFrame } from './telemetry'
import { tyreCompoundOf, tyreModelOf, tyresVary, type TyreModel } from './tyres'
import type {
  DriverEntry,
  GapValue,
  PlayerRatingProjection,
  SafetyRatingProjection,
  SessionMeta,
  StandingsClassBlock,
  StandingsColumnId,
  StandingsData,
  StandingsHeader,
  StandingsOptions,
  StandingsRow,
  StandingsStatus
} from './types'

/** Two lap times this close (s) are the same lap. */
const LAP_EPS = 0.0005

export type StandingsDisplayRow = StandingsClassBlock['rows'][number]

/** Race gap rounded to 0.1 s, never negative (the 0.5 s position hold can lag an overtake). */
function quantGap(s: number): number {
  const q = Math.round(s * 10) / 10
  return q > 0 ? q : 0
}

function quantLap(s: number | null | undefined): number | null {
  if (s === null || s === undefined || !Number.isFinite(s) || s <= 0) return null
  return Math.round(s * 1000) / 1000
}

interface Entry {
  car: RaceCarState
  driver: DriverEntry
  lastLap: number | null
  bestLap: number | null
}

interface ClassGroup {
  classId: number
  name: string
  color: string
  relSpeed: number
  /** Display order: classPosition ascending, unclassified (0) last, ties by carIdx. */
  cars: Entry[]
  /** Fastest best lap of the class, null when nobody has one. */
  classBest: number | null
  /** Registered entries of the class (SessionMeta.drivers), loaded or not. */
  entries: number
}

function byClassPosition(a: Entry, b: Entry): number {
  const pa = a.car.classPosition > 0 ? a.car.classPosition : Infinity
  const pb = b.car.classPosition > 0 ? b.car.classPosition : Infinity
  // Infinity - Infinity is NaN (falsy): falls through to carIdx.
  return pa - pb || a.car.carIdx - b.car.carIdx
}

function isEntry(driver: DriverEntry | undefined, session: SessionMeta): driver is DriverEntry {
  return (
    driver !== undefined &&
    !driver.isPaceCar &&
    !driver.isSpectator &&
    driver.carIdx !== session.paceCarIdx
  )
}

/**
 * An entry on the grid the model has not seen yet (still loading before the green): its
 * slot and nothing else, so the grid shows whole and in its real order.
 */
function absentCar(carIdx: number, classPosition: number, position: number): RaceCarState {
  return {
    carIdx,
    distance: NaN,
    classPosition,
    overallPosition: position,
    inWorld: false,
    inPits: false,
    offTrack: false,
    disconnected: false,
    finished: false,
    pitStops: 0,
    towStops: 0,
    towed: false,
    lastPitLap: null,
    outLap: false,
    stintLaps: 0,
    lastLapTime: null,
    bestLapTime: null,
    laps: [],
    pace: null,
    speed: 0,
    stoppedForS: 0,
    sessionFlags: 0
  }
}

function groupByClass(
  frame: TelemetryFrame,
  session: SessionMeta,
  race: RaceView,
  preGreen: boolean
): ClassGroup[] {
  const byId = new Map<number, ClassGroup>()
  const officialLast = frame.CarIdxLastLapTime
  const group = (driver: DriverEntry): ClassGroup => {
    let g = byId.get(driver.classId)
    if (!g) {
      g = {
        classId: driver.classId,
        name: driver.classShortName,
        color: driver.classColor,
        relSpeed: driver.classRelSpeed,
        cars: [],
        classBest: null,
        entries: 0
      }
      byId.set(driver.classId, g)
    } else {
      if (g.name === '') g.name = driver.classShortName
      if (driver.classRelSpeed > g.relSpeed) g.relSpeed = driver.classRelSpeed
    }
    return g
  }
  for (const driver of session.drivers.values()) {
    if (!isEntry(driver, session)) continue
    const g = group(driver)
    g.entries++
    // Before the green, the whole grid: entries still loading at their slot.
    const slot = preGreen && !race.car(driver.carIdx) ? session.grid.get(driver.carIdx) : undefined
    if (slot) {
      const car = absentCar(driver.carIdx, slot.classPosition, slot.position)
      g.cars.push({ car, driver, lastLap: null, bestLap: null })
    }
  }
  for (const car of race.cars()) {
    const driver = session.drivers.get(car.carIdx)
    if (!isEntry(driver, session)) continue
    const g = group(driver)
    // The sim's own last lap (ms resolution, same source as CarIdxBestLapTime) when it has one;
    // a finisher's stays frozen at its finishing lap (the model's), whatever the cool-down does.
    const lastLap = car.finished
      ? quantLap(car.lastLapTime)
      : (quantLap(officialLast[car.carIdx]) ?? quantLap(car.lastLapTime))
    const bestLap = quantLap(car.bestLapTime)
    if (bestLap !== null && (g.classBest === null || bestLap < g.classBest)) g.classBest = bestLap
    g.cars.push({ car, driver, lastLap, bestLap })
  }
  // Only classes with a car to show; a class with no name stays '': the widget words it in
  // the window's language ('Clase 30').
  const groups = [...byId.values()].filter((g) => g.cars.length > 0)
  for (const g of groups) g.cars.sort(byClassPosition)
  return groups
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

function raceGap(race: RaceView, behind: number, ahead: number): GapValue | null {
  const laps = Math.floor(race.lapsBehind(behind, ahead))
  if (laps > 0) return { kind: 'laps', laps }
  const t = race.timeGap(behind, ahead)
  if (t === null || !Number.isFinite(t)) return null
  return { kind: 'time', seconds: quantGap(t) }
}

function bestLapGap(behind: number | null, ahead: number | null): GapValue | null {
  if (behind === null || ahead === null) return null
  // Best laps are stable between laps, so the gap keeps their 3 decimals (qualifying).
  const d = Math.round((behind - ahead) * 1000) / 1000
  return { kind: 'time', seconds: d > 0 ? d : 0 }
}

/** The chequered flag outranks everything (a finisher parking in the pits is still finished). */
function statusOf(car: RaceCarState): StandingsStatus {
  if (car.finished) return 'finished'
  if (car.disconnected) return 'disconnected'
  if (car.inPits) return 'pits'
  if (car.offTrack) return 'off-track'
  return 'running'
}

function isClassBest(lap: number | null, classBest: number | null): boolean {
  return lap !== null && classBest !== null && Math.abs(lap - classBest) <= LAP_EPS
}

function lapKind(e: Entry, classBest: number | null): StandingsRow['lastLapKind'] {
  const last = e.lastLap
  if (last === null || e.bestLap === null || Math.abs(last - e.bestLap) > LAP_EPS) return 'normal'
  return isClassBest(e.bestLap, classBest) ? 'class-best' : 'personal-best'
}

/** What the visible columns need: the rest is left null, so it never re-sends the table. */
interface RowNeeds {
  /** 'gap' shows interval or gap to the leader (gapMode is display-only): both. */
  interval: boolean
  gapToLeader: boolean
  /** Every row's iRating change (otherwise only the player's). */
  allDeltas: boolean
  /** Stint laps change on every lap of every car: only sent for the 'stint' column. */
  stint: boolean
  tyre: boolean
}

function columnShown(opts: StandingsOptions, id: StandingsColumnId): boolean {
  // A malformed list (never after normalisation) shows everything rather than nothing.
  if (!Array.isArray(opts.columns)) return true
  return opts.columns.some((c) => c.id === id && c.visible)
}

interface RowContext {
  frame: TelemetryFrame
  race: RaceView
  session: SessionMeta
  isRace: boolean
  playerIdx: number
  needs: RowNeeds
  /**
   * The stops and stints are known: false during a replay, whose race model (loop.ts) only saw
   * the replay, never the stops before it, so its counts would be a false 0 and a full race.
   */
  pitHistory: boolean
  deltas: ReadonlyMap<number, number> | null
  tyreModel: TyreModel
  /** The tyre column has something to say (tyresVary): otherwise every row's tyre is null. */
  tyres: boolean
}

function makeRow(
  ctx: RowContext,
  g: ClassGroup,
  i: number,
  gapBefore: boolean
): StandingsDisplayRow {
  const e = g.cars[i]
  if (!e) throw new RangeError(`row ${i} out of range`)
  const { car, driver } = e
  const { needs } = ctx
  const cp = car.classPosition
  const isPlayer = car.carIdx === ctx.playerIdx
  let interval: GapValue | null = null
  let gapToLeader: GapValue | null = null
  const ahead = cp > 0 && i > 0 ? g.cars[i - 1] : undefined
  const leader = cp > 0 && i > 0 ? g.cars[0] : undefined
  if (ahead && leader) {
    if (!ctx.isRace) {
      if (needs.interval) interval = bestLapGap(e.bestLap, ahead.bestLap)
      if (needs.gapToLeader) gapToLeader = bestLapGap(e.bestLap, leader.bestLap)
    } else if (ctx.race.racing) {
      // Finishers' gaps are frozen at their finish line by the model.
      if (needs.interval) interval = raceGap(ctx.race, car.carIdx, ahead.car.carIdx)
      if (needs.gapToLeader) gapToLeader = raceGap(ctx.race, car.carIdx, leader.car.carIdx)
    }
  }
  let positionsGained: number | null = null
  // Before the green everyone is on their grid slot: nothing gained yet.
  if (ctx.isRace && ctx.race.racing && cp > 0) {
    const grid = ctx.session.grid.get(car.carIdx)
    if (grid && grid.classPosition > 0) positionsGained = grid.classPosition - cp
  }
  const delta = isPlayer || needs.allDeltas ? (ctx.deltas?.get(car.carIdx) ?? null) : null
  return {
    ...driverIdentity(driver),
    carIdx: car.carIdx,
    isPlayer,
    classPosition: cp,
    positionsGained,
    interval,
    gapToLeader,
    lastLap: e.lastLap,
    lastLapKind: lapKind(e, g.classBest),
    bestLap: e.bestLap,
    bestLapKind: isClassBest(e.bestLap, g.classBest) ? 'class-best' : 'normal',
    pitStops: ctx.pitHistory ? car.pitStops : null,
    lastPitLap: ctx.pitHistory ? car.lastPitLap : null,
    outLap: car.outLap,
    towed: car.towed,
    stintLaps: needs.stint && ctx.pitHistory ? car.stintLaps : null,
    tyre: ctx.tyres ? tyreCompoundOf(ctx.frame, ctx.session, ctx.tyreModel, car.carIdx) : null,
    status: statusOf(car),
    penalty: penaltyOf(car.sessionFlags),
    iRatingDelta: delta,
    gapBefore
  }
}

/** Rows of one class block: everything (full), the leader only, or top rows + around you. */
function blockRows(
  ctx: RowContext,
  g: ClassGroup,
  mode: 'full' | 'leader' | 'window',
  topRows: number,
  aroundRows: number
): StandingsDisplayRow[] {
  const rows: StandingsDisplayRow[] = []
  const n = g.cars.length
  if (mode === 'full') {
    for (let i = 0; i < n; i++) rows.push(makeRow(ctx, g, i, false))
    return rows
  }
  if (mode === 'leader') {
    if (n > 0) rows.push(makeRow(ctx, g, 0, false))
    return rows
  }
  const topEnd = Math.min(n, topRows)
  for (let i = 0; i < topEnd; i++) rows.push(makeRow(ctx, g, i, false))
  let prev = topEnd - 1
  // Your rows stay anchored on you, also unclassified (no lap time yet in qualifying).
  const pi = g.cars.findIndex((e) => e.car.carIdx === ctx.playerIdx)
  if (pi >= 0) {
    const to = Math.min(n - 1, pi + aroundRows)
    for (let i = Math.max(topEnd, pi - aroundRows); i <= to; i++) {
      rows.push(makeRow(ctx, g, i, i > prev + 1))
      prev = i
    }
  }
  return rows
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface Licence {
  licLevel: number
  licSubLevel: number
}

/**
 * One per telemetry loop. reset() on a reconnect or a new session (the loop
 * calls it when race.sessionKey changes).
 */
export class StandingsProvider {
  private readonly ratings = new ClassRatingsCache()
  private sr: { key: string; result: SafetyRatingProjection | null } | null = null
  /** Team races: the user's own licence, from the last tick they were driving. */
  private ownLicence: Licence | null = null

  reset(): void {
    this.ratings.clear()
    this.sr = null
    this.ownLicence = null
  }

  compute(
    frame: TelemetryFrame,
    session: SessionMeta,
    race: RaceView,
    opts: StandingsOptions
  ): StandingsData {
    const sessionType = currentSessionType(frame, session)
    const isRace = isRaceSession(sessionType)
    const rated = isRatedEvent(session)
    // You, or the car on camera while a replay plays.
    const playerIdx =
      race.playerCarIdx >= 0 ? race.playerCarIdx : resolveFocusCarIdx(frame, session)
    const playerDriver = playerIdx >= 0 ? session.drivers.get(playerIdx) : undefined
    // The SR line and the incident count are your own: never shown for a car a replay follows.
    const ownCar = playerIdx === resolvePlayerCarIdx(frame, session)

    // Before the green the table is the grid, entries still loading included (their slots).
    const preGreen = isRace && !race.racing
    const groups = groupByClass(frame, session, race, preGreen)
    const playerGroup =
      playerDriver && (race.car(playerIdx) || (preGreen && session.grid.has(playerIdx)))
        ? groups.find((g) => g.classId === playerDriver.classId)
        : undefined
    groups.sort(
      (a, b) =>
        Number(b === playerGroup) - Number(a === playerGroup) ||
        b.relSpeed - a.relSpeed ||
        a.classId - b.classId
    )

    const deltaColumn = columnShown(opts, 'delta')
    const needs: RowNeeds = {
      interval: columnShown(opts, 'gap'),
      gapToLeader: columnShown(opts, 'gap') || columnShown(opts, 'gapLeader'),
      allDeltas: deltaColumn && opts.iRatingDeltaAll,
      stint: columnShown(opts, 'stint'),
      tyre: columnShown(opts, 'tyre')
    }
    const tyreModel = tyreModelOf(session)
    // A column of the same compound on every row says nothing: none until one differs.
    const tyres = needs.tyre && tyresVary(frame, session, tyreModel)
    const pitHistory = !isReplayPlaying(frame)
    // Only rated races change iRating; the player's own row and the header need the deltas.
    const withDeltas = rated && isRace && (opts.headerIRating || deltaColumn)
    const compact = opts.mode !== 'full'
    // Without a player class (spectating) the fastest class gets the top rows.
    const primary = playerGroup ?? groups[0]
    const topRows = clampOption(OPTION_SCHEMA.standings.topRows, opts.topRows)
    const aroundRows = clampOption(OPTION_SCHEMA.standings.aroundRows, opts.aroundRows)
    const classes: StandingsClassBlock[] = []
    let iRating: PlayerRatingProjection | null = null

    this.ratings.begin()
    for (const g of groups) {
      const isPrimary = g === primary
      // Compact: other classes only as their (classified) leader.
      const leaderPos = g.cars[0]?.car.classPosition ?? 0
      if (compact && !isPrimary && (!opts.otherClassLeaders || leaderPos <= 0)) continue
      const classDeltas = withDeltas && (g === playerGroup || needs.allDeltas)
      // Before the green, the grid is the field: everyone on it a starter.
      const field = classRatingField(session, race, g.classId, preGreen)
      const ratings = this.ratings.get(g.classId, field, playerIdx, classDeltas)
      if (g === playerGroup) iRating = ratings.player
      const ctx: RowContext = {
        frame,
        race,
        session,
        isRace,
        playerIdx,
        needs,
        pitHistory,
        deltas: ratings.deltas,
        tyreModel,
        tyres
      }
      const mode = !compact ? 'full' : isPrimary ? 'window' : 'leader'
      classes.push({
        classId: g.classId,
        className: g.name,
        classColor: g.color,
        sof: ratings.sof,
        // The registered entries ('11 coches'), not only the cars loaded so far.
        carCount: g.entries,
        isPlayerClass: g === playerGroup,
        rows: blockRows(ctx, g, mode, topRows, aroundRows)
      })
    }
    this.ratings.sweep()

    const lapsLeft = playerIdx >= 0 ? race.lapsRemaining(playerIdx) : null
    const timeLeft = race.timeRemainingS
    const header: StandingsHeader = {
      sessionType,
      // Integers so the 4 Hz payload only changes when the display does.
      lapsRemaining:
        lapsLeft !== null && Number.isFinite(lapsLeft)
          ? Math.max(0, Math.ceil(lapsLeft - 1e-6))
          : null,
      timeRemainingS:
        timeLeft !== null && Number.isFinite(timeLeft) ? Math.max(0, Math.floor(timeLeft)) : null,
      iRating: withDeltas && opts.headerIRating ? iRating : null,
      safetyRating:
        rated && opts.headerSafetyRating && playerDriver && ownCar
          ? this.safetyRating(
              frame,
              session,
              race,
              playerIdx,
              isRace ? lapsLeft : null,
              sessionType ?? ''
            )
          : null,
      // Every session type, not only rated races; headerIncidents is display only.
      incidents: ownCar ? incidentCount(frame, session) : null
    }
    return { header, classes }
  }

  /**
   * Incidents (the whole session's PlayerCarMyIncidentCount) over the corners
   * the user drove (the model's distance spans the same stretch). In a race
   * whose laps left are known the budget covers the whole race; in practice
   * nobody knows how much more you will drive, so it is "if you stopped now".
   * Recomputed only when an input changes, so the object stays the same.
   */
  private safetyRating(
    frame: TelemetryFrame,
    session: SessionMeta,
    race: RaceView,
    playerIdx: number,
    /** Race laps left (the budget's horizon), null outside races or when unknown. */
    lapsLeft: number | null,
    sessionType: string
  ): SafetyRatingProjection | null {
    const driver = session.drivers.get(playerIdx)
    if (!driver) return null
    const lic = this.licenceOf(frame, session, driver)
    const turns = session.trackNumTurns
    const driven = race.playerDistanceDriven
    const corners = turns > 0 && driven > 0 ? Math.floor(turns * driven) : 0
    let totalCorners: number | null = null
    if (turns > 0 && lapsLeft !== null && Number.isFinite(lapsLeft) && lapsLeft >= 0) {
      // lapsLeft counts the lap in progress, whose driven part is already in `driven`.
      const d = race.car(playerIdx)?.distance ?? NaN
      const left = Math.max(0, lapsLeft - (Number.isFinite(d) ? frac(d) : 0))
      totalCorners = Math.floor(turns * (Math.max(0, driven) + left))
    }
    const incidents = race.playerIncidents
    const key = `${lic.licLevel}:${lic.licSubLevel}:${incidents}:${corners}:${totalCorners}:${sessionType}`
    if (this.sr?.key === key) return this.sr.result
    const result = projectSessionSafetyRating({
      licLevel: lic.licLevel,
      licSubLevel: lic.licSubLevel,
      incidents,
      corners,
      totalCorners,
      sessionType
    })
    this.sr = { key, result }
    return result
  }

  /**
   * In team races the entry at the player's CarIdx is whoever drives it now;
   * the SR is the user's, so their licence is taken while IsOnTrack (they are
   * the one in the car) and kept through a teammate's stint.
   */
  private licenceOf(frame: TelemetryFrame, session: SessionMeta, driver: DriverEntry): Licence {
    const current = { licLevel: driver.licLevel, licSubLevel: driver.licSubLevel }
    if (!session.teamRacing) return current
    if (frame.IsOnTrack[0] === true) this.ownLicence = current
    return this.ownLicence ?? current
  }
}
