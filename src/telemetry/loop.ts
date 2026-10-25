import {
  createMemoryStore,
  personalBestTarget,
  sameTarget,
  type PersonalBestStore,
  type PersonalBestTarget
} from '@shared/delta/references'
import type { TelemetryOutMessage } from '@shared/ipc'
import {
  SKIP_EMIT,
  createProviders,
  type ProviderContext,
  type ProviderSet,
  type WidgetProvider
} from '@shared/providers'
import { EMPTY_RACE_VIEW } from '@shared/race/emptyRaceView'
import { OFFICIAL_WAIT_S } from '@shared/race/laps'
import { RaceModel } from '@shared/race/raceModel'
import type { RaceView } from '@shared/race/raceView'
import { parseSessionMeta } from '@shared/session'
import { createDefaultSettings, toTelemetryConfig } from '@shared/settings'
import { isReplayPlaying } from '@shared/simScreen'
import type { TelemetryFrame } from '@shared/telemetry'
import type {
  ConnectionState,
  SessionMeta,
  StatusNote,
  TelemetryConfig,
  WidgetPayloads
} from '@shared/types'
import { WIDGET_DEFS, WIDGET_IDS, isWidgetId, type WidgetId } from '@shared/widgets'
import { AutoHide } from './autoHide'
import { errorMessage, isNativeSdkMissing } from './errors'
import type { TelemetrySource } from './sources/TelemetrySource'

/** What the loop needs from the RaceModel (a fake in tests). */
export type RaceModelLike = Pick<RaceModel, 'view' | 'update' | 'reset' | 'breakContinuity'>

export interface LoopDeps {
  now: () => number
  sleep: (ms: number) => Promise<void>
  yieldToEventLoop: () => Promise<void>
  /** The widget providers, built once per loop (they own their caches). */
  createProviders: () => ProviderSet
  skipEmit: typeof SKIP_EMIT
  parseSession: (raw: unknown) => SessionMeta
  /** Pause between connection attempts and after any dropped connection. */
  retryMs: number
  /** Max time one waitForTick() blocks. */
  tickTimeoutMs: number
  /** No tick for this long (counted from connect until the first one): reconnect. */
  staleMs: number
  /** The race timing model the loop owns and feeds on every tick. */
  createRaceModel: () => RaceModelLike
  /**
   * All-time personal bests (index.ts opens the one on disk): the providers
   * read it, the loop offers the player's clean laps. Null: an in-memory store
   * of this loop.
   */
  bests: PersonalBestStore | null
  /** Wall clock in ms since the epoch: when a new best was driven (recordedAt). */
  wallClockMs: () => number
  /**
   * The car + layout being driven changed (null: none, e.g. disconnected), so
   * the settings window can offer to delete that one's best. On change only.
   */
  onPersonalBestTarget: (target: PersonalBestTarget | null) => void
}

const DEFAULT_DEPS: LoopDeps = {
  now: () => performance.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  yieldToEventLoop: () => new Promise((resolve) => setImmediate(resolve)),
  createProviders,
  skipEmit: SKIP_EMIT,
  parseSession: parseSessionMeta,
  retryMs: 2000,
  tickTimeoutMs: 16,
  staleMs: 5000,
  createRaceModel: () => new RaceModel(),
  bests: null,
  wallClockMs: () => Date.now(),
  onPersonalBestTarget: () => {}
}

/** Widgets this fast run on every received tick: the sources tick at 60 Hz. */
const EVERY_TICK_HZ = 60
/**
 * Half a 60 Hz tick: puts slower widgets' due times between ticks, so tick
 * jitter does not push a run to the next tick.
 */
const TICK_SLACK_MS = 8
/** Per widget: 0 = every tick, otherwise the nominal interval. */
const INTERVAL_MS = Object.fromEntries(
  WIDGET_IDS.map((id) => {
    const { hz } = WIDGET_DEFS[id]
    return [id, hz >= EVERY_TICK_HZ ? 0 : 1000 / hz]
  })
) as Record<WidgetId, number>

/**
 * Spin guard. A healthy source blocks in waitForTick() (~60 iterations/s), but
 * one that stops blocking (irsdk's MockSDK, a broken addon) would spin a core.
 * Every SPIN_WINDOW connected iterations, if they took less than
 * MIN_ITERATION_MS each on average, the loop sleeps the difference: at most
 * ~240 iterations/s, 4x the tick rate, so a healthy source never trips it.
 */
const SPIN_WINDOW = 4
const MIN_ITERATION_MS = 1000 / 240

/** The same failure is logged at most this often (per widget / race model / rules). */
const ERROR_LOG_MS = 5000

/** Retry period when the session YAML of a version could not be read (avoids parsing at 60 Hz). */
const SESSION_RETRY_MS = 1000

/**
 * A completed lap is offered as a personal best once iRacing had time to
 * publish its official time (the model refines its own with it): session
 * seconds after the lap is first seen.
 */
const BEST_SETTLE_S = OFFICIAL_WAIT_S + 0.5
/** ...or after this much real time, whatever the session clock does (paused sim). */
const BEST_SETTLE_MAX_MS = 30_000

/** Config used until main sends one: every widget, default options and rules. */
export function defaultTelemetryConfig(): TelemetryConfig {
  return { ...toTelemetryConfig(createDefaultSettings()), enabledWidgets: [...WIDGET_IDS] }
}

type PrevPayloads = { [K in WidgetId]: WidgetPayloads[K] | null }
type SkipRule<K extends WidgetId> = (
  payload: WidgetPayloads[K],
  prev: WidgetPayloads[K] | null
) => boolean
/** What a rate-limited error log is about. */
type LogTopic = WidgetId | 'race' | 'rules' | 'providers' | 'bests'

/** The player's last completed lap as the RaceModel profiles it. */
type LastLap = NonNullable<ReturnType<RaceView['lapProfile']>>

function perWidget<T>(value: T): Record<WidgetId, T> {
  return Object.fromEntries(WIDGET_IDS.map((id) => [id, value])) as Record<WidgetId, T>
}

function dataMessage<K extends WidgetId>(
  widget: K,
  payload: WidgetPayloads[K]
): TelemetryOutMessage {
  // TS cannot match a generic K against the distributive WidgetDataMessage union.
  return { type: 'data', widget, payload } as TelemetryOutMessage
}

/**
 * Drives a TelemetrySource: connects (retrying), reads ticks, re-parses the
 * session when its version changes, applies the visibility rules and runs
 * each enabled, shown widget provider at its WIDGET_DEFS rate, emitting
 * status/data/auto-hidden/log messages for main.
 *
 * The RaceModel lives as long as the loop: a reconnect to the same session
 * carries its history on (it only breaks continuity); the model itself
 * starts over when the session changes, and the providers follow its
 * sessionKey.
 *
 * While a replay plays its frames are not live (their own clock, which goes
 * back and jumps; any car on camera), so the live model is not fed them: it
 * keeps its laps, bests and incidents and resumes after the replay without
 * timing anything across it. A second model built for each replay times the
 * replay instead, for the widgets that follow the car on camera; no lap of
 * it is ever offered as a personal best.
 */
export class TelemetryLoop {
  private readonly deps: LoopDeps
  private config: TelemetryConfig = defaultTelemetryConfig()
  private enabled: readonly WidgetId[] = WIDGET_IDS

  private running = false
  /** Resolves the current wait(); null outside one. */
  private wakeOnStop: (() => void) | null = null

  private connected = false
  private receivedTick = false
  private lastTickAt = 0
  private lastConnectError = ''
  private lastStatusKey = ''

  private spinCount = 0
  private spinWindowStart = 0
  private warnedSpin = false

  private session: SessionMeta | null = null
  private sessionVersion: number | null = null
  private failedSessionVersion: number | null = null
  private sessionRetryAt = 0

  private readonly prev: PrevPayloads = perWidget(null)
  private readonly nextDue = perWidget(-Infinity)
  private readonly lastLogAt = new Map<LogTopic, number>()

  /** Null when it could not be built (logged once): race widgets then see an empty field. */
  private readonly raceModel: RaceModelLike | null = null
  private readonly providers: ProviderSet
  /** race.sessionKey the providers' state belongs to (null: none yet). */
  private raceKey: string | null = null
  /** The last frame was a replay's (IsReplayPlaying). */
  private replaying = false
  /** Times the replay playing now; built on its first frame, dropped when it ends. */
  private replayModel: RaceModelLike | null = null
  private replayModelFailed = false
  private readonly autoHide: AutoHide

  private readonly bests: PersonalBestStore
  /** The player's last lap as last seen (the model's snapshot: same object while unchanged). */
  private bestLap: LastLap | null = null
  /** bestLap is still to be offered. */
  private bestPending = false
  /** Personal-best key (and names) and whether you drove it, fixed when the lap was first seen. */
  private bestTarget: PersonalBestTarget | null = null
  private bestDriven = false
  private bestSeenAt = 0
  private bestSeenAtMs = 0
  /** The car + layout last reported to onPersonalBestTarget, and what it was computed from. */
  private currentTarget: PersonalBestTarget | null = null
  private targetSession: SessionMeta | null = null
  private targetPlayer = -1

  constructor(
    private readonly source: TelemetrySource,
    private readonly emit: (msg: TelemetryOutMessage) => void,
    deps: Partial<LoopDeps> = {}
  ) {
    this.deps = { ...DEFAULT_DEPS, ...deps }
    try {
      this.raceModel = this.deps.createRaceModel()
    } catch (err) {
      this.log('error', `Race model unavailable: ${errorMessage(err)}`)
    }
    this.providers = this.deps.createProviders()
    this.bests = this.deps.bests ?? createMemoryStore()
    this.autoHide = new AutoHide((widget, hidden, reason) => {
      this.emit({ type: 'auto-hidden', widget, hidden, reason })
      // Back on screen: send a fresh payload at once, not "unchanged since before".
      if (!hidden) this.forget(widget)
    })
  }

  setConfig(config: TelemetryConfig): void {
    this.config = config
    const enabled = new Set(config.enabledWidgets.filter(isWidgetId))
    this.enabled = WIDGET_IDS.filter((id) => enabled.has(id))
    for (const id of WIDGET_IDS) {
      if (!enabled.has(id)) this.prev[id] = null
      // Recompute on the next tick so the change shows up immediately.
      this.nextDue[id] = -Infinity
    }
  }

  /** Runs until stop(). */
  async start(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      while (this.running) {
        const stepped = this.connected
        const ok = stepped ? this.step() : await this.tryConnect()
        if (!this.running) break
        if (!ok) await this.wait(this.deps.retryMs)
        else if (stepped) await this.guardSpin()
        await this.deps.yieldToEventLoop()
      }
    } finally {
      this.running = false
      this.wakeOnStop = null
    }
  }

  stop(): void {
    this.running = false
    this.wakeOnStop?.()
  }

  /**
   * Offers a lap still waiting for its official time as it is. For shutdown,
   * right before the store is flushed; never throws.
   */
  settlePersonalBests(): void {
    const lap = this.bestLap
    if (!lap || !this.bestPending) return
    try {
      this.offerPersonalBest(lap)
    } catch (err) {
      this.bestPending = false
      this.log('error', `Personal best update failed: ${errorMessage(err)}`)
    }
  }

  /**
   * Sleeps `ms`, cut short by stop(). One short-lived promise per wait: racing
   * a long-lived one would add a reaction to it on every retry, for hours.
   */
  private async wait(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      this.wakeOnStop = resolve
      void this.deps.sleep(ms).then(resolve, resolve)
    })
    this.wakeOnStop = null
  }

  private async guardSpin(): Promise<void> {
    if (++this.spinCount < SPIN_WINDOW) return
    const budget = SPIN_WINDOW * MIN_ITERATION_MS
    const elapsed = this.deps.now() - this.spinWindowStart
    if (elapsed < budget) {
      if (!this.warnedSpin) {
        this.warnedSpin = true
        this.log('warn', 'Telemetry source returns without waiting for ticks; throttling the loop')
      }
      await this.wait(Math.ceil(budget - elapsed))
    }
    this.spinCount = 0
    this.spinWindowStart = this.deps.now()
  }

  private async tryConnect(): Promise<boolean> {
    // A persistent connect error stays on screen instead of flapping with "waiting".
    if (!this.lastConnectError) this.setStatus('waiting')
    let ok: boolean
    try {
      ok = await this.source.connect()
    } catch (err) {
      const message = errorMessage(err)
      if (message !== this.lastConnectError) {
        this.lastConnectError = message
        this.log('warn', `Telemetry source connect failed: ${message}`)
        this.setStatus('error', isNativeSdkMissing(err) ? 'native-missing' : 'none', message)
      }
      return false
    }
    if (this.lastConnectError) {
      this.lastConnectError = ''
      this.setStatus('waiting')
    }
    if (ok) {
      this.connected = true
      this.receivedTick = false
      this.lastTickAt = this.deps.now()
      this.spinCount = 0
      this.spinWindowStart = this.lastTickAt
    }
    return ok
  }

  /** One connected iteration. False when the connection was dropped (the caller backs off). */
  private step(): boolean {
    try {
      return this.tick()
    } catch (err) {
      const message = errorMessage(err)
      this.log('error', `Telemetry source failed: ${message}`)
      this.setStatus('error', 'none', message)
      this.dropConnection()
      return false
    }
  }

  private tick(): boolean {
    const { source, deps } = this
    const got = source.waitForTick(deps.tickTimeoutMs)
    const now = deps.now()
    if (!got) {
      // irsdk reports "not connected" until the first tick: before it only staleMs counts.
      const stale = now - this.lastTickAt >= deps.staleMs
      if (stale || (this.receivedTick && !source.isConnected())) {
        this.dropConnection()
        this.setStatus('waiting')
        return false
      }
      return true
    }
    this.lastTickAt = now
    if (!this.receivedTick) {
      this.receivedTick = true
      this.setStatus(source.kind === 'mock' ? 'mock' : 'connected')
    }

    const frame = source.readFrame()
    this.refreshSession(now)
    const session = this.session
    if (!session) return true

    const replay = isReplayPlaying(frame)
    if (replay !== this.replaying) this.followReplay(replay, now)
    // Every tick, whatever widgets are enabled or hidden: timing needs each one.
    let race: RaceView
    if (replay) {
      race = this.updateReplay(frame, session, now)
    } else {
      this.updateRace(frame, session, now)
      race = this.raceModel?.view ?? EMPTY_RACE_VIEW
      this.followSessionKey(race, now)
      // Live frames only: a replay's laps are not yours to keep, its car is not yours.
      this.followPersonalBest(frame, session, race, now)
      this.followTarget(session, race.playerCarIdx, now)
    }
    this.updateRules(frame, session, now)
    let ctx: ProviderContext | null = null
    for (const id of this.enabled) {
      // A widget hidden by its rule is not computed (its overlay panel is not drawn).
      if (this.autoHide.isHidden(id) || !this.isDue(id, now)) continue
      ctx ??= { frame, session, config: this.config, race, bests: this.bests }
      this.runProvider(id, ctx, now)
    }
    return true
  }

  /**
   * A replay started or ended. The live model will not see the replay's frames: nothing is
   * timed across the gap (its history stays, and so does its sessionKey, so the providers keep
   * theirs). Each replay gets a model of its own. Every widget's next payload is computed
   * afresh and sent, so no hold or smoothing carries from live to replay or back.
   */
  private followReplay(replay: boolean, now: number): void {
    this.replaying = replay
    this.replayModel = null
    this.replayModelFailed = false
    if (replay) {
      try {
        this.raceModel?.breakContinuity()
      } catch (err) {
        this.logEvery('race', now, `Race model pause failed: ${errorMessage(err)}`)
      }
    }
    for (const id of WIDGET_IDS) this.forget(id)
  }

  /**
   * Feeds the replay's own model (built on its first frame) and returns its view, where the
   * car on camera is the player (resolveFocusCarIdx). An empty view when it cannot be built
   * (tried once per replay).
   */
  private updateReplay(frame: TelemetryFrame, session: SessionMeta, now: number): RaceView {
    if (!this.replayModel && !this.replayModelFailed) {
      try {
        this.replayModel = this.deps.createRaceModel()
      } catch (err) {
        this.replayModelFailed = true
        this.logEvery('race', now, `Replay model unavailable: ${errorMessage(err)}`)
      }
    }
    const model = this.replayModel
    if (!model) return EMPTY_RACE_VIEW
    try {
      model.update(frame, session)
    } catch (err) {
      this.logEvery('race', now, `Replay model update failed: ${errorMessage(err)}`)
    }
    return model.view
  }

  /** A failing model must not take the widgets down: providers still run with its last view. */
  private updateRace(frame: TelemetryFrame, session: SessionMeta, now: number): void {
    if (!this.raceModel) return
    try {
      this.raceModel.update(frame, session)
    } catch (err) {
      this.logEvery('race', now, `Race model update failed: ${errorMessage(err)}`)
    }
  }

  /**
   * Offers each lap the player completes, once, to the personal bests: when it
   * is clean and the player drove it (IsOnTrack at the line: not a teammate's
   * stint, not a replay). The model's snapshot of the last lap is the same
   * object while unchanged, so a tick without a new lap costs one lookup. The
   * lap waits until its official time had time to arrive, then is offered
   * with the latest snapshot (a new snapshot of the same lap is that
   * refinement); a lap that stops being the last one (next lap, new session)
   * is offered at once.
   */
  private followPersonalBest(
    frame: TelemetryFrame,
    session: SessionMeta,
    race: RaceView,
    now: number
  ): void {
    try {
      const player = race.playerCarIdx
      const last = player >= 0 ? race.lapProfile(player, 'last') : null
      const prev = this.bestLap
      if (last !== prev) {
        const sameLap = prev !== null && last !== null && last.lap === prev.lap
        if (prev && this.bestPending && !sameLap) this.offerPersonalBest(prev)
        this.bestLap = last
        if (last && !sameLap) {
          this.bestPending = true
          this.bestTarget = personalBestTarget(session, player)
          this.bestDriven = frame.IsOnTrack[0] === true
          this.bestSeenAt = race.sessionTime
          this.bestSeenAtMs = now
        }
      }
      const lap = this.bestLap
      if (
        lap &&
        this.bestPending &&
        (race.sessionTime - this.bestSeenAt >= BEST_SETTLE_S ||
          now - this.bestSeenAtMs >= BEST_SETTLE_MAX_MS)
      ) {
        this.offerPersonalBest(lap)
      }
    } catch (err) {
      this.bestPending = false
      this.logEvery('bests', now, `Personal best update failed: ${errorMessage(err)}`)
    }
  }

  private offerPersonalBest(lap: LastLap): void {
    this.bestPending = false
    const target = this.bestTarget
    if (!target || !this.bestDriven || !lap.clean) return
    const recordedAt = new Date(this.deps.wallClockMs()).toISOString()
    this.bests.offer(target.key, { lapTime: lap.lapTime, profile: lap.profile, recordedAt }, target)
  }

  /** Recomputed only when the session (a new YAML version) or the player's car changes. */
  private followTarget(session: SessionMeta, player: number, now: number): void {
    if (session === this.targetSession && player === this.targetPlayer) return
    this.targetSession = session
    this.targetPlayer = player
    this.setTarget(personalBestTarget(session, player), now)
  }

  private setTarget(target: PersonalBestTarget | null, now: number): void {
    if (sameTarget(target, this.currentTarget)) return
    this.currentTarget = target
    try {
      this.deps.onPersonalBestTarget(target)
    } catch (err) {
      this.logEvery('bests', now, `Personal best target update failed: ${errorMessage(err)}`)
    }
  }

  /** New session (or a reconnect): the providers' state and last payloads belong to the old one. */
  private followSessionKey(race: RaceView, now: number): void {
    const key = race.sessionKey
    if (key === this.raceKey) return
    this.raceKey = key
    this.resetProviders(now)
  }

  private resetProviders(now: number): void {
    for (const id of WIDGET_IDS) this.forget(id)
    try {
      this.providers.reset()
    } catch (err) {
      this.logEvery('providers', now, `Provider reset failed: ${errorMessage(err)}`)
    }
  }

  /** The next payload of `id` is computed on the next tick and sent whatever it holds. */
  private forget(id: WidgetId): void {
    this.prev[id] = null
    this.nextDue[id] = -Infinity
  }

  /** A broken rule must not stop the loop: the widgets then stay as they were. */
  private updateRules(frame: TelemetryFrame, session: SessionMeta, now: number): void {
    try {
      this.autoHide.update(this.config, frame, session)
    } catch (err) {
      this.logEvery('rules', now, `Visibility rules failed: ${errorMessage(err)}`)
    }
  }

  /**
   * Widgets at EVERY_TICK_HZ run on every tick: timing them against a source of
   * the same rate drops fresh ticks after any loop stall. Slower ones keep a
   * nominal cadence, unless the next run would come less than half an interval
   * after this one (stall, first run): then it restarts from now.
   */
  private isDue(id: WidgetId, now: number): boolean {
    const interval = INTERVAL_MS[id]
    if (interval === 0) return true
    const due = this.nextDue[id]
    if (now < due) return false
    const next = due + interval
    this.nextDue[id] = next - now >= interval / 2 ? next : now + interval - TICK_SLACK_MS
    return true
  }

  private refreshSession(now: number): void {
    const version = this.source.sessionInfoVersion()
    if (version === this.sessionVersion) return
    if (version === this.failedSessionVersion && now < this.sessionRetryAt) return
    let raw: unknown
    try {
      raw = this.source.readSessionInfo()
    } catch {
      raw = null
    }
    if (raw === null || raw === undefined) {
      this.failedSessionVersion = version
      this.sessionRetryAt = now + SESSION_RETRY_MS
      return
    }
    this.sessionVersion = version
    this.failedSessionVersion = null
    try {
      this.session = this.deps.parseSession(raw)
    } catch (err) {
      this.log('error', `Could not parse session info: ${errorMessage(err)}`)
    }
  }

  private runProvider<K extends WidgetId>(id: K, ctx: ProviderContext, now: number): void {
    try {
      const provider: WidgetProvider<K> = this.providers.run[id]
      const prev = this.prev[id]
      const payload = provider(ctx, prev)
      // Always the latest computed payload, sent or not: skip rules compare against it.
      this.prev[id] = payload
      const skip: SkipRule<K> | undefined = this.deps.skipEmit[id]
      if (!skip?.(payload, prev)) this.emit(dataMessage(id, payload))
    } catch (err) {
      this.logEvery(id, now, `Widget "${id}" failed: ${errorMessage(err)}`)
    }
  }

  /**
   * The model is kept (soft reset: continuity broken, history kept until the
   * next tick shows whether the session is the same); everything per
   * connection is forgotten, and no rule hides anything until a session is known.
   */
  private dropConnection(): void {
    try {
      this.source.disconnect()
    } catch {
      // Nothing left to release.
    }
    this.connected = false
    this.receivedTick = false
    this.session = null
    this.sessionVersion = null
    this.failedSessionVersion = null
    const now = this.deps.now()
    try {
      this.raceModel?.reset()
    } catch (err) {
      this.logEvery('race', now, `Race model reset failed: ${errorMessage(err)}`)
    }
    this.raceKey = null
    this.replaying = false
    this.replayModel = null
    this.replayModelFailed = false
    this.resetProviders(now)
    this.autoHide.showAll()
    this.targetSession = null
    this.setTarget(null, now)
  }

  /** Codes only: each window words the status in its language (statusText in @shared/i18n). */
  private setStatus(state: ConnectionState, note: StatusNote = 'none', detail = ''): void {
    const key = `${state}\n${note}\n${detail}`
    if (key === this.lastStatusKey) return
    this.lastStatusKey = key
    this.emit({ type: 'status', status: { state, source: this.source.kind, note, detail } })
  }

  private logEvery(topic: LogTopic, now: number, message: string): void {
    if (now - (this.lastLogAt.get(topic) ?? -Infinity) < ERROR_LOG_MS) return
    this.lastLogAt.set(topic, now)
    this.log('error', message)
  }

  private log(level: 'info' | 'warn' | 'error', message: string): void {
    this.emit({ type: 'log', level, message })
  }
}
