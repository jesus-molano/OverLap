/**
 * The engine's warning lights as one state that the alerts band (Avisos) and the warning lights
 * strip (Testigos) both read, so the rules the live races asked for live in one place: which
 * light is on, the temperature trend against your own average (engineTrend.ts), the repairs and
 * how long they take, the temperatures and the limiters. One per telemetry loop: observe() on
 * every tick, read() at a widget's rate, computed once per tick whoever asks first (two widgets
 * reading the same tick never sample the trend twice; whichever is shown keeps it going).
 *
 * The rules:
 * - No engine light means anything out of the car, towed, in the box, out of the world, just
 *   after the car reappears or as you get in it: they flicker at a standstill then (online, every
 *   one of them did), and one held from before does not carry into that (`quiet`).
 * - The pressures also need the engine running (moving, or stopped at its idle at least) and
 *   not stalled: a stopped engine has no pressure, and the stall says it all.
 * - The repairs are damage, not the engine: they stay on in the box and while towed (the stop is
 *   the repair, PitRepairLeft counts down there), only not out of the car, out of the world or
 *   just after it reappears or you get in.
 * - The limiters are not read while towed or just after the car appears: a tow or a reset puts
 *   it on pit road a moment before its limiter is on (online: a false OFF for 0.95 s).
 *
 * WaterTemp, OilTemp, PitRepairLeft and PitOptRepairLeft may be missing (an empty array): they
 * read as unknown, never as 0.
 */
import { EngineWarning } from '../flags'
import { isValidPct, wrapPctDelta } from '../lapDist'
import { finiteOr } from '../num'
import type { RaceView } from '../race/raceView'
import { resolvePlayerCarIdx } from '../sessionInfo'
import { TrackLocation, type TelemetryFrame } from '../telemetry'
import type { SessionMeta } from '../types'
import { EngineTrend, type TrendNotice } from './engineTrend'

export const ENGINE = {
  /** Close behind another car (the trend's slipstream hint): at most this far (s). */
  draftGapS: 1,
  /** Moving faster than this (m/s) counts as driving (the trend, the pressure lights). */
  movingMs: 5,
  /** The engine's lights wait this long (s) after you get in the car: the engine is starting. */
  inCarSettleS: 3,
  /** Stopped, a pressure light needs the revs at this share of the car's idle at least. */
  idleRpmShare: 0.8,
  /** Nothing is read this long (s) after the car appears in the world (a tow, a reset). */
  teleportS: 2,
  /** No read for longer than this (s): the trend's lap and smoothing start over. */
  staleS: 1
} as const

/** What the engine's lights say now, after the rules above. */
export interface EngineState {
  /** In the car (IsOnTrack). */
  readonly inCar: boolean
  /** No engine light means anything now (see the rules): none is on. */
  readonly quiet: boolean
  /** The limiter bits can be read: not towed, not just put in the world. */
  readonly limiterRead: boolean
  readonly stalled: boolean
  readonly oilPressure: boolean
  readonly fuelPressure: boolean
  /** The car's own temperature lights. */
  readonly water: boolean
  readonly oilTemp: boolean
  /** Mandatory repairs (MandatoryRepairs 0x80): pit now. */
  readonly repair: boolean
  /** Optional repairs (OptionalRepairs 0x100): fixable at the stop, with or without mandatory ones. */
  readonly repairOptional: boolean
  readonly pitLimiter: boolean
  readonly revLimiter: boolean
  /** Water / oil staying well above your own average (engineTrend.ts), null otherwise. */
  readonly waterTrend: TrendNotice | null
  readonly oilTrend: TrendNotice | null
  /** WaterTemp / OilTemp (°C) in the car, null when the car has no such reading. */
  readonly waterC: number | null
  readonly oilC: number | null
  /** PitRepairLeft / PitOptRepairLeft (s) in the car while above 0, null otherwise. */
  readonly repairS: number | null
  readonly optRepairS: number | null
}

/** The four warning lights of EngineWarnings: a lap with one of them on is no trend reference. */
const WARNING_LIGHTS =
  EngineWarning.OilPressure |
  EngineWarning.FuelPressure |
  EngineWarning.WaterTemp |
  EngineWarning.OilTemp

/** `now - since` is within [0, s): since a moment that is not in the future. */
const within = (now: number, since: number, s: number): boolean =>
  now - since >= 0 && now - since < s

const reading = (v: number | undefined): number | null =>
  v !== undefined && Number.isFinite(v) ? v : null

const positive = (v: number | undefined): number | null =>
  v !== undefined && Number.isFinite(v) && v > 0 ? v : null

/** Whether a car is within ENGINE.draftGapS ahead of the player on track. */
function closeBehind(frame: TelemetryFrame, race: RaceView, player: number): boolean {
  const me = race.car(player)
  const pace = me?.pace ?? null
  const myPct = frame.CarIdxLapDistPct[player]
  if (!me || !me.inWorld || me.inPits || pace === null || !(pace > 0) || !isValidPct(myPct)) {
    return false
  }
  // race.cars() leaves out the pace car and spectators.
  for (const car of race.cars()) {
    if (car.carIdx === player || !car.inWorld || car.inPits) continue
    const pct = frame.CarIdxLapDistPct[car.carIdx]
    if (!isValidPct(pct)) continue
    const ahead = wrapPctDelta(pct, myPct)
    if (ahead > 0 && ahead * pace <= ENGINE.draftGapS) return true
  }
  return false
}

/**
 * One per telemetry loop (the band and the strip share it). observe() on every tick; read() at
 * any rate; reset() on a reconnect or a new session (the trend's reference and when you got in
 * the car are the session's).
 */
export class EngineMonitor {
  /** SessionTime of the last tick observed (NaN: none since the start). */
  private tickT = Number.NaN
  /** IsOnTrack last tick (null: unknown, no edge), and when it last turned true. */
  private inCarWas: boolean | null = null
  private inCarSince = Number.NaN
  /** PlayerTrackSurface last tick, and when the car last appeared in the world. */
  private surfaceWas: number | null = null
  private appearedAt = Number.NaN
  private readonly trend = new EngineTrend()
  /** SessionTime of the last read (NaN: none): a gap starts the trend's lap over. */
  private readT = Number.NaN
  /** The last state read, with the frame and the time it was read for. */
  private cached: EngineState | null = null
  private cachedFrame: TelemetryFrame | null = null
  private cachedT = Number.NaN

  reset(): void {
    this.trend.reset()
    this.readT = Number.NaN
    this.forgetRead()
    this.forgetTicks()
  }

  /**
   * Every tick, whatever the widgets' rates or rules: getting in the car, a tow or a repair may
   * happen while both are hidden.
   */
  observe(frame: TelemetryFrame): void {
    const t = frame.SessionTime[0]
    if (t === undefined || !Number.isFinite(t)) return
    // The clock went back (a replay, a restarted session): no edge across it.
    if (t < this.tickT) this.forgetTicks()
    this.tickT = t
    const inCar = frame.IsOnTrack[0] === true
    if (inCar && this.inCarWas === false) this.inCarSince = t
    this.inCarWas = inCar
    const surface = reading(frame.PlayerTrackSurface[0])
    if (
      surface !== null &&
      surface !== TrackLocation.NotInWorld &&
      this.surfaceWas === TrackLocation.NotInWorld
    ) {
      this.appearedAt = t
    }
    this.surfaceWas = surface
    // A replay's readings are not your engine's now.
    if (frame.IsReplayPlaying[0] !== true) {
      this.trend.observe(
        t,
        finiteOr(frame.PlayerCarTowTime[0], 0) > 0,
        finiteOr(frame.WaterTemp[0], Number.NaN),
        finiteOr(frame.OilTemp[0], Number.NaN)
      )
    }
  }

  /** The car appeared in the world (a tow, a reset) less than ENGINE.teleportS ago. */
  justAppeared(now: number): boolean {
    return within(now, this.appearedAt, ENGINE.teleportS)
  }

  /** The state for this frame: computed on the first read of a tick, the same object after. */
  read(frame: TelemetryFrame, session: SessionMeta, race: RaceView): EngineState {
    const now = finiteOr(frame.SessionTime[0], Number.NaN)
    if (this.cached !== null && frame === this.cachedFrame && now === this.cachedT) {
      return this.cached
    }
    // The clock went back or nobody read for a while: the lap being sampled is not whole.
    if (!(now >= this.readT && now - this.readT <= ENGINE.staleS)) this.trend.resume()
    this.readT = now
    const state = this.compute(frame, session, race, now)
    this.cached = state
    this.cachedFrame = frame
    this.cachedT = now
    return state
  }

  private forgetTicks(): void {
    this.tickT = Number.NaN
    this.inCarWas = null
    this.inCarSince = Number.NaN
    this.surfaceWas = null
    this.appearedAt = Number.NaN
  }

  private forgetRead(): void {
    this.cached = null
    this.cachedFrame = null
    this.cachedT = Number.NaN
  }

  private compute(
    frame: TelemetryFrame,
    session: SessionMeta,
    race: RaceView,
    now: number
  ): EngineState {
    const raw = reading(frame.EngineWarnings[0])
    // Bit fields arrive as signed Int32.
    const bits = raw === null ? 0 : raw >>> 0
    const on = (bit: number): boolean => (bits & bit) !== 0
    const inCar = frame.IsOnTrack[0] === true
    const surface = frame.PlayerTrackSurface[0]
    const towing = finiteOr(frame.PlayerCarTowTime[0], 0) > 0
    const speedMs = Math.abs(finiteOr(frame.Speed[0], 0))
    const justAppeared = this.justAppeared(now)
    const settling = justAppeared || within(now, this.inCarSince, ENGINE.inCarSettleS)
    const quiet =
      !inCar ||
      towing ||
      surface === TrackLocation.InPitStall ||
      surface === TrackLocation.NotInWorld ||
      settling
    // No pressure without the engine running: moving, or stopped at its idle at least.
    const idleRpm = finiteOr(session.driverCarIdleRpm, 0)
    const running =
      speedMs > ENGINE.movingMs ||
      (idleRpm > 0 && finiteOr(frame.RPM[0], 0) >= ENGINE.idleRpmShare * idleRpm)
    const lit = !quiet && raw !== null
    const stalled = lit && on(EngineWarning.Stalled)
    const pressure = lit && running && !stalled
    // The repairs stay through the stop and the tow: that is where they are made.
    const repairs = inCar && raw !== null && surface !== TrackLocation.NotInWorld && !settling
    const limiterRead = !towing && !justAppeared
    const limiters = inCar && raw !== null && limiterRead

    const player = resolvePlayerCarIdx(frame, session)
    const onPitRoad =
      frame.OnPitRoad[0] ?? (player >= 0 ? frame.CarIdxOnPitRoad[player] : undefined) ?? false
    this.trend.update({
      now,
      lapsCompleted:
        player >= 0 ? finiteOr(frame.CarIdxLapCompleted[player], Number.NaN) : Number.NaN,
      water: finiteOr(frame.WaterTemp[0], Number.NaN),
      oil: finiteOr(frame.OilTemp[0], Number.NaN),
      driving:
        inCar && !onPitRoad && surface !== TrackLocation.InPitStall && speedMs > ENGINE.movingMs,
      closeBehind: player >= 0 && closeBehind(frame, race, player),
      warning: inCar && on(WARNING_LIGHTS),
      lapClean: (lap) => race.car(player)?.laps.find((l) => l.lap === lap)?.clean ?? null
    })

    return {
      inCar,
      quiet,
      limiterRead,
      stalled,
      oilPressure: pressure && on(EngineWarning.OilPressure),
      fuelPressure: pressure && on(EngineWarning.FuelPressure),
      water: lit && on(EngineWarning.WaterTemp),
      oilTemp: lit && on(EngineWarning.OilTemp),
      repair: repairs && on(EngineWarning.MandatoryRepairs),
      repairOptional: repairs && on(EngineWarning.OptionalRepairs),
      pitLimiter: limiters && on(EngineWarning.PitSpeedLimiter),
      revLimiter: limiters && on(EngineWarning.RevLimiter),
      waterTrend: this.trend.notice('water'),
      oilTrend: this.trend.notice('oil'),
      waterC: inCar ? reading(frame.WaterTemp[0]) : null,
      oilC: inCar ? reading(frame.OilTemp[0]) : null,
      repairS: inCar ? positive(frame.PitRepairLeft[0]) : null,
      optRepairS: inCar ? positive(frame.PitOptRepairLeft[0]) : null
    }
  }
}
