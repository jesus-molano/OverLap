import { AlertsProvider, alertsEqual } from './alerts'
import { BattleProvider, battleEqual } from './battle'
import { DeltaProvider, deltaEqual } from './delta/delta'
import type { PersonalBestStore } from './delta/references'
import { computeInputs } from './inputs'
import type { RaceView } from './race/raceView'
import { computeRadar } from './radar'
import { computeRelative } from './relative'
import { StandingsProvider } from './standings'
import { standingsEqual } from './standingsEqual'
import { TrafficProvider, trafficEqual } from './traffic'
import type { TelemetryFrame } from './telemetry'
import type { SessionMeta, TelemetryConfig, WidgetPayloads } from './types'
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
  /** Forget all provider state: reconnect, or race.sessionKey changed (new session). */
  reset(): void
}

export function createProviders(): ProviderSet {
  const standings = new StandingsProvider()
  const battle = new BattleProvider()
  const traffic = new TrafficProvider()
  const alerts = new AlertsProvider()
  const delta = new DeltaProvider()
  return {
    run: {
      relative: (ctx) => computeRelative(ctx.frame, ctx.session, ctx.config.relative),
      radar: (ctx, prev) => computeRadar(ctx.frame, ctx.session, ctx.config.radar, prev),
      standings: (ctx) => standings.compute(ctx.frame, ctx.session, ctx.race, ctx.config.standings),
      battle: (ctx, prev) => battle.compute(ctx.session, ctx.race, ctx.config.battle, prev),
      inputs: (ctx) => computeInputs(ctx.frame),
      traffic: (ctx, prev) =>
        traffic.compute(ctx.frame, ctx.session, ctx.race, ctx.config.traffic, prev),
      alerts: (ctx) => alerts.compute(ctx.frame, ctx.session, ctx.race, ctx.config.alerts),
      delta: (ctx) => delta.compute(ctx.frame, ctx.session, ctx.race, ctx.bests, ctx.config.delta)
    },
    reset: () => {
      standings.reset()
      battle.reset()
      traffic.reset()
      alerts.reset()
      delta.reset()
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
  // Out of the car the relative is an empty, unchanging table.
  relative: (payload, prev) =>
    prev !== null &&
    payload.playerRow < 0 &&
    prev.playerRow < 0 &&
    payload.slotsAhead === prev.slotsAhead &&
    payload.slotsBehind === prev.slotsBehind &&
    payload.sessionType === prev.sessionType,
  radar: (payload, prev) => !payload.visible && prev !== null && !prev.visible,
  // Quantised payloads: an unchanged table is not re-sent.
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
    prev !== null && ((!payload.visible && !prev.visible) || deltaEqual(payload, prev))
}
