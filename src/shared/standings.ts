/**
 * Standings widget: the classification per class, built from the RaceModel's
 * view (positions, gaps, pits, laps, finish) and the session YAML (names,
 * iRating, licences). Runs at 4 Hz. Its only state, owned by one
 * StandingsProvider per telemetry loop, is a cache of the rating projections (and your SR's).
 */
import { orderClasses } from './classOrder'
import { driverIdentity, fieldHasMultipleBrands } from './driver'
import { isElementVisible } from './elements'
import { infoItemShown } from './infoBar'
import { incidentCount } from './incidents/count'
import { isClassBest, lastLapKind, lastLapOf, quantLap } from './lapTimes'
import { penaltyOf } from './penalty'
import type { RaceCarState, RaceView } from './race/raceView'
import { ownTowTime, showsTow } from './race/towBadge'
import { classRatingField } from './ratings/field'
import { ClassRatingsCache } from './ratings/projection'
import { isRatedEvent } from './ratings/rated'
import { PlayerSafety } from './ratings/playerSafety'
import {
  currentSessionType,
  isRaceSession,
  resolveFocusCarIdx,
  resolvePlayerCarIdx
} from './sessionInfo'
import { OPTION_SCHEMA, clampOption } from './settingsSchema'
import type { TelemetryFrame } from './telemetry'
import { tyreCompoundOf, tyreModelOf, tyresVary, type TyreModel } from './tyres'
import type {
  DriverEntry,
  GapValue,
  PlayerRatingProjection,
  SessionMeta,
  StandingsClassBlock,
  StandingsColumnId,
  StandingsData,
  StandingsHeader,
  StandingsOptions,
  StandingsStatus
} from './types'

export type StandingsDisplayRow = StandingsClassBlock['rows'][number]

/** Race gap rounded to 0.1 s, never negative (the 0.5 s position hold can lag an overtake). */
function quantGap(s: number): number {
  const q = Math.round(s * 10) / 10
  return q > 0 ? q : 0
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
    towedAt: NaN,
    lastPitLap: null,
    outLap: false,
    stintLaps: 0,
    lastLapTime: null,
    bestLapTime: null,
    laps: [],
    pace: null,
    speed: 0,
    stoppedForS: 0,
    lapInvalid: false,
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
    const lastLap = lastLapOf(frame, car)
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
  return isElementVisible(opts.columns, id)
}

interface RowContext {
  frame: TelemetryFrame
  race: RaceView
  session: SessionMeta
  isRace: boolean
  playerIdx: number
  /** Your own car (resolvePlayerCarIdx): its tow countdown is known. */
  ownIdx: number
  needs: RowNeeds
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
    lastLapKind: lastLapKind(e.lastLap, e.bestLap, g.classBest),
    bestLap: e.bestLap,
    bestLapKind: isClassBest(e.bestLap, g.classBest) ? 'class-best' : 'normal',
    // The loop feeds one race model with live frames only (the live point of a replay
    // included) and never builds one from the tape (loop.ts): its stops are always known.
    pitStops: car.pitStops,
    lastPitLap: car.lastPitLap,
    outLap: car.outLap,
    // Only around the tow itself, then PIT (a car parked in its box for good).
    towed: showsTow(car, ctx.race.sessionTime, ownTowTime(ctx.frame, car.carIdx, ctx.ownIdx)),
    stintLaps: needs.stint ? car.stintLaps : null,
    tyre: ctx.tyres ? tyreCompoundOf(ctx.frame, ctx.session, ctx.tyreModel, car.carIdx) : null,
    status: statusOf(car),
    penalty: penaltyOf(car.sessionFlags, car.finished),
    iRatingDelta: delta,
    gapBefore
  }
}

/**
 * Rows of one class block: everything (full), its first topRows cars (top: another class in
 * compact mode), or top rows + around you (window).
 */
function blockRows(
  ctx: RowContext,
  g: ClassGroup,
  mode: 'full' | 'top' | 'window',
  topRows: number,
  aroundRows: number
): StandingsDisplayRow[] {
  const rows: StandingsDisplayRow[] = []
  const n = g.cars.length
  if (mode === 'full') {
    for (let i = 0; i < n; i++) rows.push(makeRow(ctx, g, i, false))
    return rows
  }
  if (mode === 'top') {
    for (let i = 0; i < Math.min(n, topRows); i++) rows.push(makeRow(ctx, g, i, false))
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

/**
 * One per telemetry loop. reset() on a reconnect or a new session (the loop
 * calls it when race.sessionKey changes).
 */
export class StandingsProvider {
  private readonly ratings = new ClassRatingsCache()
  private readonly safety = new PlayerSafety()

  reset(): void {
    this.ratings.clear()
    this.safety.reset()
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
    const ownIdx = resolvePlayerCarIdx(frame, session)
    const ownCar = playerIdx === ownIdx

    // Before the green the table is the grid, entries still loading included (their slots).
    const preGreen = isRace && !race.racing
    const groups = groupByClass(frame, session, race, preGreen)
    const playerGroup =
      playerDriver && (race.car(playerIdx) || (preGreen && session.grid.has(playerIdx)))
        ? groups.find((g) => g.classId === playerDriver.classId)
        : undefined
    // Without a player class (spectating) the fastest class gets the top rows, wherever its
    // block goes.
    const fastest = orderClasses(groups, undefined, 'speed', [])[0]
    const ordered = orderClasses(groups, playerGroup, opts.classOrder, opts.classList)

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
    // Only rated races change iRating; the player's own row and the header need the deltas.
    const headerIRating = infoItemShown('standings', opts, 'iRating')
    const withDeltas = rated && isRace && (headerIRating || deltaColumn)
    const compact = opts.mode !== 'full'
    const primary = playerGroup ?? fastest
    const topRows = clampOption(OPTION_SCHEMA.standings.topRows, opts.topRows)
    const aroundRows = clampOption(OPTION_SCHEMA.standings.aroundRows, opts.aroundRows)
    const otherRows = clampOption(OPTION_SCHEMA.standings.otherClassRows, opts.otherClassRows)
    const classes: StandingsClassBlock[] = []
    let iRating: PlayerRatingProjection | null = null

    this.ratings.begin()
    for (const g of ordered) {
      const isPrimary = g === primary
      // Compact: other classes only as their first (classified) cars.
      const leaderPos = g.cars[0]?.car.classPosition ?? 0
      if (compact && !isPrimary && (otherRows === 0 || leaderPos <= 0)) continue
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
        ownIdx,
        needs,
        deltas: ratings.deltas,
        tyreModel,
        tyres
      }
      const mode = !compact ? 'full' : isPrimary ? 'window' : 'top'
      classes.push({
        classId: g.classId,
        className: g.name,
        classColor: g.color,
        sof: ratings.sof,
        // The registered entries ('11 coches'), not only the cars loaded so far.
        carCount: g.entries,
        isPlayerClass: g === playerGroup,
        rows: blockRows(ctx, g, mode, isPrimary ? topRows : otherRows, aroundRows)
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
      iRating: withDeltas && headerIRating ? iRating : null,
      safetyRating:
        rated && infoItemShown('standings', opts, 'safetyRating') && playerDriver && ownCar
          ? this.safety.project(
              frame,
              session,
              race,
              playerIdx,
              isRace ? lapsLeft : null,
              sessionType ?? ''
            )
          : null,
      // Every session type, not only rated races: one cheap read.
      incidents: ownCar ? incidentCount(frame, session) : null
    }
    // The info bars' data is the provider set's (InfoFeed, fed this header).
    return { header, classes, info: null, multiBrand: fieldHasMultipleBrands(session) }
  }
}
