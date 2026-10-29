/**
 * Battle widget: the player's class neighbours (the car ahead and the car behind by class
 * position) while they are on the same lap and within a gap threshold, with the gap trend,
 * laps to catch, sector comparison of the last common lap and the iRating at stake. Runs at
 * 4 Hz; values are quantised so SKIP_EMIT drops unchanged payloads. The only state (how long
 * an opponent has been held past the threshold, the rating cache) lives in one BattleProvider
 * per telemetry loop.
 */
import { driverIdentity, fieldHasMultipleBrands, identityEqual } from './driver'
import { isElementVisible } from './elements'
import { arrayEqual } from './equal'
import { infoBarDataEqual } from './infoFeed'
import { quantise } from './num'
import type { RaceCarState, RaceView } from './race/raceView'
import { classRatingField } from './ratings/field'
import type { RatingField } from './ratings/field'
import { ClassRatingsCache, iRatingAtStake } from './ratings/projection'
import { isRatedEvent } from './ratings/rated'
import { OPTION_SCHEMA, clampOption } from './settingsSchema'
import type { BattleData, BattleOpponent, BattleOptions, DriverEntry, SessionMeta } from './types'

export const BATTLE = {
  /** An opponent already shown stays until its gap exceeds the threshold by this much (s). */
  hysteresisS: 0.3,
  /** Laps of gap history the trend is fitted over. */
  trendLaps: 2,
  /** Clean samples must span at least this many laps of race distance for a trend. */
  minTrendSpanLaps: 0.5,
  /** |trend| (s/lap) at or below this counts as not converging. */
  minCatchTrend: 0.02,
  /**
   * A class neighbour can read slightly negative while its position change is held by the model
   * (0.5 s); it is shown at 0.0 down to this, and ignored beyond (inconsistent data).
   */
  maxNegativeGapS: 1,
  /** Last lap times per car. */
  lastLaps: 3,
  /** neededSPerLap is not computed with less race distance left than this (laps). */
  minNeededDistance: 0.05
} as const

type GapSample = ReturnType<RaceView['gapHistory']>[number]

type Side = 'ahead' | 'behind'

/**
 * Least-squares slope (s of gap per lap of distance) of the clean samples, null when fewer than
 * two finite clean samples or when they span less than `minSpanLaps`.
 */
export function gapSlope(samples: readonly GapSample[], minSpanLaps: number): number | null {
  let n = 0
  let x0 = 0
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  let minX = Infinity
  let maxX = -Infinity
  for (const s of samples) {
    if (!s.clean || !Number.isFinite(s.distance) || !Number.isFinite(s.gap)) continue
    // Offset x by the first sample: race distances of 50+ laps would lose precision in sxx.
    if (n === 0) x0 = s.distance
    const x = s.distance - x0
    n++
    sx += x
    sy += s.gap
    sxx += x * x
    sxy += x * s.gap
    if (s.distance < minX) minX = s.distance
    if (s.distance > maxX) maxX = s.distance
  }
  if (n < 2 || maxX - minX < minSpanLaps) return null
  const den = n * sxx - sx * sx
  if (!(den > 0)) return null
  return (n * sxy - sx * sy) / den
}

/**
 * The samples after the last unclean one: gaps from before a pit stop or a caution are not
 * comparable with the ones after it (the stop or the bunching is a step, not a trend).
 */
function sinceLastBreak(samples: readonly GapSample[]): readonly GapSample[] {
  for (let i = samples.length - 1; i >= 0; i--) {
    if (samples[i]?.clean === false) return samples.slice(i + 1)
  }
  return samples
}

/**
 * Race distance the player still has to cover: lapsRemaining counts the current lap, so the part
 * of it already driven is subtracted. Null when unknown.
 */
function distanceLeft(lapsRemaining: number | null, distance: number): number | null {
  if (lapsRemaining === null || !Number.isFinite(lapsRemaining)) return null
  const done = Number.isFinite(distance) ? distance - Math.floor(distance) : 0
  return Math.max(0, lapsRemaining - done)
}

function lapTimeOrNull(t: number | null | undefined): number | null {
  return typeof t === 'number' && Number.isFinite(t) && t > 0 ? quantise(t, 1000) : null
}

/** Most recent first, up to BATTLE.lastLaps; falls back to lastLapTime when no lap is recorded. */
function lastLapTimes(car: RaceCarState | undefined): (number | null)[] {
  if (!car) return []
  const laps = car.laps
  if (laps.length === 0) return car.lastLapTime !== null ? [lapTimeOrNull(car.lastLapTime)] : []
  const n = Math.min(BATTLE.lastLaps, laps.length)
  const out = new Array<number | null>(n)
  for (let i = 0; i < n; i++) out[i] = lapTimeOrNull(laps[i]?.time)
  return out
}

/**
 * The opponent's times of the same laps as your last ones (null where it has none), so the
 * rows compare like with like: the car ahead completes each lap first, and its newest lap is
 * not shown against your previous one. Its own last laps while you have none recorded.
 */
function alignedLapTimes(player: RaceCarState, car: RaceCarState): (number | null)[] {
  const mine = player.laps
  if (mine.length === 0) return lastLapTimes(car)
  const n = Math.min(BATTLE.lastLaps, mine.length)
  const out = new Array<number | null>(n)
  for (let i = 0; i < n; i++) {
    const lap = mine[i]?.lap
    out[i] = lapTimeOrNull(car.laps.find((r) => r.lap === lap)?.time)
  }
  return out
}

/**
 * Opponent minus player time per sector (+ = you were faster) of the latest lap both completed,
 * so the row does not blink each time one of them crosses the line first. Null when either is
 * unknown or they disagree in length.
 */
function sectorDeltas(race: RaceView, player: RaceCarState, opp: RaceCarState): number[] | null {
  const myLap = player.laps[0]?.lap
  const theirLap = opp.laps[0]?.lap
  if (myLap === undefined || theirLap === undefined) return null
  const lap = Math.min(myLap, theirLap)
  const mine = race.lapSectors(player.carIdx, lap)
  const theirs = race.lapSectors(opp.carIdx, lap)
  if (!mine || !theirs || mine.length === 0 || mine.length !== theirs.length) return null
  const out = new Array<number>(mine.length)
  for (let i = 0; i < mine.length; i++) {
    const a = theirs[i]
    const b = mine[i]
    if (a === undefined || b === undefined || !Number.isFinite(a) || !Number.isFinite(b)) {
      return null
    }
    out[i] = quantise(a - b, 100)
  }
  return out
}

/** How long an opponent has been past the threshold (`since` = SessionTime it left). */
interface Hold {
  carIdx: number
  since: number
}

/** Everything one compute() shares between the two sides. */
interface Run {
  race: RaceView
  player: RaceCarState
  opts: BattleOptions
  thresholdS: number
  holdS: number
  distLeft: number | null
  prev: BattleData | null
  stake: (oppIdx: number) => number | null
}

/**
 * One per telemetry loop: `prev` (the last payload) and the hold state give the threshold its
 * hysteresis and the "Mantener visible" time. reset() on a reconnect or a new session.
 */
export class BattleProvider {
  private readonly ratings = new ClassRatingsCache()
  private readonly holds: Record<Side, Hold> = {
    ahead: { carIdx: -1, since: NaN },
    behind: { carIdx: -1, since: NaN }
  }

  reset(): void {
    this.ratings.clear()
    this.clearHolds()
  }

  compute(
    session: SessionMeta,
    race: RaceView,
    opts: BattleOptions,
    prev: BattleData | null = null
  ): BattleData {
    const playerIdx = race.playerCarIdx
    const player = playerIdx >= 0 ? race.car(playerIdx) : undefined
    const remaining = player ? race.lapsRemaining(playerIdx) : null
    const result: BattleData = {
      visible: false,
      // Whole laps, as shown ("de 19"), counting the lap in progress.
      lapsRemaining:
        remaining !== null && Number.isFinite(remaining)
          ? Math.max(0, Math.ceil(remaining - 1e-6))
          : null,
      playerLastLaps: lastLapTimes(player),
      ahead: null,
      behind: null,
      multiBrand: fieldHasMultipleBrands(session),
      // The info bars' data is the provider set's (InfoFeed).
      info: null
    }
    const me = session.drivers.get(playerIdx)
    // After your flag the result is fixed: nothing left to fight for.
    if (!race.racing || !player || !me || player.classPosition < 1 || player.finished) {
      this.clearHolds()
      return result
    }
    const showAhead = isElementVisible(opts.lanes, 'ahead')
    const showBehind = isElementVisible(opts.lanes, 'behind')
    if (!showAhead && !showBehind) return result

    const pos = player.classPosition
    let aheadCar: RaceCarState | undefined
    let behindCar: RaceCarState | undefined
    for (const c of race.cars()) {
      const cp = c.classPosition
      // 0 = not classified, never a neighbour (the class leader has no car ahead).
      if (cp < 1 || (cp !== pos - 1 && cp !== pos + 1)) continue
      if (c.carIdx === playerIdx || session.drivers.get(c.carIdx)?.classId !== me.classId) continue
      if (cp === pos - 1) aheadCar ??= c
      else behindCar ??= c
    }

    const run: Run = {
      race,
      player,
      opts,
      thresholdS: clampOption(OPTION_SCHEMA.battle.thresholdS, opts.thresholdS),
      holdS: clampOption(OPTION_SCHEMA.battle.holdS, opts.holdS),
      distLeft: distanceLeft(remaining, player.distance),
      prev,
      stake: this.stakeFor(session, race, opts, me.classId, playerIdx)
    }
    // A car ahead that took the flag can no longer be caught.
    if (showAhead && aheadCar && !aheadCar.finished) {
      result.ahead = this.opponent(run, 'ahead', aheadCar, session.drivers.get(aheadCar.carIdx))
    }
    if (showBehind && behindCar) {
      result.behind = this.opponent(run, 'behind', behindCar, session.drivers.get(behindCar.carIdx))
    }
    if (!result.ahead) this.holds.ahead.carIdx = -1
    if (!result.behind) this.holds.behind.carIdx = -1
    result.visible = result.ahead !== null || result.behind !== null
    return result
  }

  private clearHolds(): void {
    this.holds.ahead.carIdx = -1
    this.holds.behind.carIdx = -1
  }

  /**
   * Over the limit, a car shown last time stays for holdS seconds of SessionTime (restarted
   * when the clock goes back, e.g. a replay); back inside the limit, the hold starts over.
   */
  private held(side: Side, carIdx: number, now: number, holdS: number): boolean {
    const h = this.holds[side]
    if (h.carIdx !== carIdx || !(now >= h.since)) {
      h.carIdx = carIdx
      h.since = now
    }
    return now - h.since < holdS
  }

  private opponent(
    run: Run,
    side: Side,
    car: RaceCarState,
    d: DriverEntry | undefined
  ): BattleOpponent | null {
    const { race, player } = run
    if (!d || car.disconnected || !car.inWorld) return null
    const behindIdx = side === 'ahead' ? player.carIdx : car.carIdx
    const aheadIdx = side === 'ahead' ? car.carIdx : player.carIdx
    if (race.lapsBehind(behindIdx, aheadIdx) !== 0) return null
    const raw = race.timeGap(behindIdx, aheadIdx)
    if (raw === null || !Number.isFinite(raw) || raw < -BATTLE.maxNegativeGapS) return null
    const shown = run.prev?.[side]?.carIdx === car.carIdx
    const limit = shown ? run.thresholdS + BATTLE.hysteresisS : run.thresholdS
    if (raw > limit) {
      if (!shown || !this.held(side, car.carIdx, race.sessionTime, run.holdS)) return null
    } else {
      this.holds[side].carIdx = -1
    }
    const gap = Math.max(0, raw)

    const slope = gapSlope(
      sinceLastBreak(race.gapHistory(behindIdx, aheadIdx, BATTLE.trendLaps)),
      BATTLE.minTrendSpanLaps
    )
    // Ahead: a shrinking gap is in your favour; behind: a growing one.
    const trend = slope === null ? null : quantise(side === 'ahead' ? -slope : slope, 100)
    let lapsToCatch: number | null = null
    let catchesBeforeEnd: boolean | null = null
    let neededSPerLap: number | null = null
    if (isElementVisible(run.opts.rows, 'prediction')) {
      let laps: number | null = null
      if (trend !== null) {
        if (side === 'ahead' && trend > BATTLE.minCatchTrend) laps = gap / trend
        else if (side === 'behind' && trend < -BATTLE.minCatchTrend) laps = gap / -trend
      }
      const left = run.distLeft
      // Whole laps as shown ("~4 v"); the comparison with the distance left keeps full precision.
      lapsToCatch = laps === null ? null : Math.round(laps)
      catchesBeforeEnd = laps !== null && left !== null ? laps <= left : null
      if (
        side === 'ahead' &&
        left !== null &&
        left >= BATTLE.minNeededDistance &&
        catchesBeforeEnd !== true
      ) {
        neededSPerLap = quantise(gap / left, 100)
      }
    }

    return {
      ...driverIdentity(d),
      carIdx: car.carIdx,
      inPits: car.inPits,
      gapS: quantise(gap, 10),
      trendSPerLap: trend,
      lapsToCatch,
      catchesBeforeEnd,
      neededSPerLap,
      lastLaps: alignedLapTimes(player, car),
      sectorDeltas: sectorDeltas(race, player, car),
      iRatingAtStake: run.stake(car.carIdx)
    }
  }

  /**
   * The iRating swing per opponent, from the same class field as the standings (rated races
   * only). The field is built lazily, once per run, and only when an opponent asks.
   */
  private stakeFor(
    session: SessionMeta,
    race: RaceView,
    opts: BattleOptions,
    classId: number,
    playerIdx: number
  ): (oppIdx: number) => number | null {
    if (!isElementVisible(opts.parts, 'stake') || !isRatedEvent(session)) return () => null
    let field: RatingField | null = null
    return (oppIdx) => {
      try {
        field ??= classRatingField(session, race, classId)
        this.ratings.begin()
        const ratings = this.ratings.get(classId, field, playerIdx, true)
        this.ratings.sweep()
        return iRatingAtStake(field, ratings, playerIdx, oppIdx)
      } catch {
        // A failure in the rating projection must not cost the whole battle payload.
        return null
      }
    }
  }
}

function opponentEqual(a: BattleOpponent | null, b: BattleOpponent | null): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  return (
    identityEqual(a, b) &&
    a.inPits === b.inPits &&
    a.gapS === b.gapS &&
    a.trendSPerLap === b.trendSPerLap &&
    a.lapsToCatch === b.lapsToCatch &&
    a.catchesBeforeEnd === b.catchesBeforeEnd &&
    a.neededSPerLap === b.neededSPerLap &&
    a.iRatingAtStake === b.iRatingAtStake &&
    arrayEqual(a.lastLaps, b.lastLaps) &&
    arrayEqual(a.sectorDeltas, b.sectorDeltas)
  )
}

/** Structural equality of two payloads (for SKIP_EMIT). */
export function battleEqual(a: BattleData, b: BattleData): boolean {
  return (
    a.visible === b.visible &&
    a.lapsRemaining === b.lapsRemaining &&
    a.multiBrand === b.multiBrand &&
    arrayEqual(a.playerLastLaps, b.playerLastLaps) &&
    opponentEqual(a.ahead, b.ahead) &&
    opponentEqual(a.behind, b.behind) &&
    infoBarDataEqual(a.info, b.info)
  )
}
