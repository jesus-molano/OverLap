import { AlertsProvider, alertsEqual } from './alerts'
import { BattleProvider, battleEqual } from './battle'
import { ConditionsFeed } from './conditions'
import { DeltaProvider, deltaEqual } from './delta/delta'
import type { PersonalBestStore } from './delta/references'
import { computeFuel, fuelAlertInput, fuelEqual } from './fuel/provider'
import { FuelTracker } from './fuel/tracker'
import { incidentCountEqual } from './incidents/count'
import { sectionInfoItems } from './infoBar'
import { InfoFeed, infoBarDataEqual, type KnownInfo } from './infoFeed'
import { computeInputs } from './inputs'
import { LightsProvider, lightsEqual } from './lights'
import { EngineMonitor } from './notices/engine'
import type { RaceView } from './race/raceView'
import { computeRadar } from './radar'
import { computeRelative } from './relative'
import { StandingsProvider } from './standings'
import { standingsEqual } from './standingsEqual'
import { TrafficProvider, trafficEqual } from './traffic'
import type { TelemetryFrame } from './telemetry'
import type { InfoBarData, InfoItemId, SessionMeta, TelemetryConfig, WidgetPayloads } from './types'
import type { WidgetId } from './widgets'

export interface ProviderContext {
  frame: TelemetryFrame
  session: SessionMeta
  config: TelemetryConfig
  /** Race state the telemetry loop's RaceModel built from every tick so far. */
  race: RaceView
  /** All-time personal bests (read only here; the loop offers the player's clean laps). */
  bests: PersonalBestStore
}

/**
 * Turns one telemetry tick into one widget payload. `prev` is the payload
 * this provider returned last time (null after a reconnect, a new session or
 * a visibility rule hiding the widget), for widgets that need temporal
 * smoothing such as the radar lanes or the battle threshold.
 */
export type WidgetProvider<K extends WidgetId> = (
  ctx: ProviderContext,
  prev: WidgetPayloads[K] | null
) => WidgetPayloads[K]

/** The providers of one telemetry loop; their caches live and die with it. */
export interface ProviderSet {
  /** One provider per widget; the loop runs each at WIDGET_DEFS[id].hz. */
  readonly run: { readonly [K in WidgetId]: WidgetProvider<K> }
  /**
   * Fed every tick, whatever the widgets' rates and rules, for state that must see each one
   * (a PlayerIncidents report can last a single tick). A set with no such state has none.
   */
  readonly observe?: (frame: TelemetryFrame, session: SessionMeta, race: RaceView) => void
  /** Forget all provider state: reconnect, or race.sessionKey changed (new session). */
  reset(): void
  /**
   * The delta's cycle shortcut: the next reference for the rest of this session only (never
   * saved). False with no session to cycle in. A set without a delta has none.
   */
  readonly cycleDeltaReference?: () => boolean
}

/** A payload with its info bars' data filled in (the providers build it with null). */
function withInfo<T extends { info: InfoBarData | null }>(payload: T, info: InfoBarData | null): T {
  payload.info = info
  return payload
}

export function createProviders(): ProviderSet {
  const standings = new StandingsProvider()
  const battle = new BattleProvider()
  const traffic = new TrafficProvider()
  // Fed on every tick: the alerts band and the warning lights read the same engine state.
  const engine = new EngineMonitor()
  const alerts = new AlertsProvider(engine)
  const lights = new LightsProvider(engine)
  const delta = new DeltaProvider()
  // Fed on every tick: the fuel widget and the alerts band plan with the same laps.
  const fuel = new FuelTracker()
  // The weather for every info bar that shows it: one reading a second for all of them, only
  // while one does.
  const conditions = new ConditionsFeed()
  const infoFeed = new InfoFeed(conditions, fuel)
  /** The data of a widget's bars for this tick (null while none of their items needs any). */
  const info = (
    ctx: ProviderContext,
    items: readonly InfoItemId[],
    known?: KnownInfo
  ): InfoBarData | null =>
    infoFeed.get(ctx.frame, ctx.session, ctx.race, items, ctx.config.fuel.avgLaps, known)
  return {
    run: {
      relative: (ctx) => {
        const p = computeRelative(ctx.frame, ctx.session, ctx.config.relative, ctx.race)
        const items = sectionInfoItems('relative', ctx.config.relative)
        return withInfo(p, info(ctx, items, { sessionType: p.sessionType, incidents: p.incidents }))
      },
      radar: (ctx, prev) => computeRadar(ctx.frame, ctx.session, ctx.config.radar, prev),
      standings: (ctx) => {
        const p = standings.compute(ctx.frame, ctx.session, ctx.race, ctx.config.standings)
        const h = p.header
        const mine = p.classes.find((c) => c.isPlayerClass)
        // What the table computed already: the header's figures and your class's.
        const known: KnownInfo = {
          sessionType: h.sessionType,
          lapsRemaining: h.lapsRemaining,
          timeRemainingS: h.timeRemainingS,
          iRating: h.iRating,
          safetyRating: h.safetyRating,
          incidents: h.incidents,
          ...(mine !== undefined ? { sof: mine.sof, carCount: mine.carCount } : {})
        }
        return withInfo(p, info(ctx, sectionInfoItems('standings', ctx.config.standings), known))
      },
      battle: (ctx, prev) =>
        withInfo(
          battle.compute(ctx.session, ctx.race, ctx.config.battle, prev, ctx.frame),
          info(ctx, sectionInfoItems('battle', ctx.config.battle))
        ),
      inputs: (ctx) => computeInputs(ctx.frame, ctx.session),
      traffic: (ctx, prev) =>
        withInfo(
          traffic.compute(ctx.frame, ctx.session, ctx.race, ctx.config.traffic, prev),
          info(ctx, sectionInfoItems('traffic', ctx.config.traffic))
        ),
      alerts: (ctx) =>
        alerts.compute(
          ctx.frame,
          ctx.session,
          ctx.race,
          ctx.config.alerts,
          fuelAlertInput(ctx.frame, ctx.session, ctx.race, fuel, ctx.config.fuel)
        ),
      delta: (ctx) => delta.compute(ctx.frame, ctx.session, ctx.race, ctx.bests, ctx.config.delta),
      fuel: (ctx) =>
        withInfo(
          computeFuel(ctx.frame, ctx.session, ctx.race, fuel, ctx.config.fuel),
          info(ctx, sectionInfoItems('fuel', ctx.config.fuel))
        ),
      lights: (ctx) => lights.compute(ctx.frame, ctx.session, ctx.race, ctx.config.lights)
    },
    cycleDeltaReference: () => delta.cycleReference(),
    observe: (frame, session, race) => {
      engine.observe(frame)
      alerts.observe(frame, session, race)
      fuel.observe(frame, session, race)
    },
    reset: () => {
      standings.reset()
      battle.reset()
      traffic.reset()
      engine.reset()
      alerts.reset()
      lights.reset()
      delta.reset()
      conditions.reset()
      infoFeed.reset()
      fuel.reset()
    }
  }
}

/**
 * Optional per-widget rule: true when `payload` would paint nothing new after
 * `prev` was already sent, so the loop computes it (to keep `prev` current)
 * but does not send it. Saves the IPC hop and a renderer wake-up per tick for
 * widgets that are idle most of the race, like the radar with nobody around.
 */
export const SKIP_EMIT: {
  readonly [K in WidgetId]?: (payload: WidgetPayloads[K], prev: WidgetPayloads[K] | null) => boolean
} = {
  // Out of the car the relative is an empty, unchanging table (its info bars still count).
  relative: (payload, prev) =>
    prev !== null &&
    payload.playerRow < 0 &&
    prev.playerRow < 0 &&
    payload.slotsAhead === prev.slotsAhead &&
    payload.slotsBehind === prev.slotsBehind &&
    payload.sessionType === prev.sessionType &&
    payload.multiBrand === prev.multiBrand &&
    incidentCountEqual(payload.incidents, prev.incidents) &&
    infoBarDataEqual(payload.info, prev.info),
  radar: (payload, prev) => !payload.visible && prev !== null && !prev.visible,
  // Quantised payloads: an unchanged table (and footer, standingsEqual) is not re-sent.
  standings: (payload, prev) => prev !== null && standingsEqual(payload, prev),
  // A hidden card draws nothing, whatever its laps left or your last laps say.
  battle: (payload, prev) =>
    prev !== null && ((!payload.visible && !prev.visible) || battleEqual(payload, prev)),
  // Every active sample is a point of the trace (even when unchanged); none while out of the car.
  inputs: (payload, prev) => !payload.active && prev !== null && !prev.active,
  traffic: (payload, prev) =>
    prev !== null && ((!payload.visible && !prev.visible) || trafficEqual(payload, prev)),
  alerts: (payload, prev) => prev !== null && alertsEqual(payload, prev),
  delta: (payload, prev) =>
    prev !== null && ((!payload.visible && !prev.visible) || deltaEqual(payload, prev)),
  // A tenth of a litre every few seconds: most ticks change nothing shown.
  fuel: (payload, prev) =>
    prev !== null && ((!payload.visible && !prev.visible) || fuelEqual(payload, prev)),
  // A light or a shown reading changes now and then: most ticks change nothing.
  lights: (payload, prev) => prev !== null && lightsEqual(payload, prev)
}
