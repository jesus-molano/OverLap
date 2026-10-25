import { describe, it, expect, vi } from 'vitest'
import type {
  LapReference,
  PersonalBestLabel,
  PersonalBestStore,
  PersonalBestTarget
} from '@shared/delta/references'
import type { TelemetryOutMessage } from '@shared/ipc'
import type { ProviderContext, ProviderSet, SKIP_EMIT } from '@shared/providers'
import type { RaceView } from '@shared/race/raceView'
import { TELEMETRY_VAR_NAMES, TrackLocation } from '@shared/telemetry'
import type { TelemetryFrame } from '@shared/telemetry'
import type {
  BattleData,
  DeltaData,
  DriverEntry,
  InputsData,
  OverlayStatus,
  RadarData,
  RelativeData,
  SessionMeta,
  SourceKind,
  StandingsData,
  TelemetryConfig,
  TrafficData,
  AlertsData
} from '@shared/types'
import { WIDGET_IDS, followsCamera, type WidgetId } from '@shared/widgets'
import { messagesFor, statusText } from '@shared/i18n'
import { NativeSdkMissingError } from './errors'
import { TelemetryLoop, defaultTelemetryConfig, type LoopDeps, type RaceModelLike } from './loop'
import type { TelemetrySource } from './sources/TelemetrySource'

// The loop gets fakes injected; keep the real widget/session/timing code out of this test.
vi.mock('@shared/providers', () => ({
  createProviders: () => ({ run: {}, reset: () => {} }),
  SKIP_EMIT: {}
}))
vi.mock('@shared/session', () => ({ parseSessionMeta: () => null }))
vi.mock('@shared/race/raceModel', () => ({
  RaceModel: class {
    view = {}
    update(): void {
      // Inert: tests that need a model inject a fake.
    }
    reset(): void {
      // Inert.
    }
    breakContinuity(): void {
      // Inert.
    }
  }
}))

const TICK_MS = 16.7

type MutableFrame = { -readonly [K in keyof TelemetryFrame]: TelemetryFrame[K] }

/** Every variable empty (no data) unless overridden. */
function makeFrame(o: Partial<MutableFrame> = {}): TelemetryFrame {
  const empty = Object.fromEntries(TELEMETRY_VAR_NAMES.map((n) => [n, []])) as unknown
  return { ...(empty as MutableFrame), SessionTime: [1], ...o }
}

const FRAME = makeFrame()

interface Clock {
  t: number
}

class FakeSource implements TelemetrySource {
  /** Scripted connect() results (true once exhausted); an Error rejects. */
  connectResults: (boolean | Error)[] = []
  /** Scripted waitForTick() results while connected (true once exhausted). */
  tickResults: boolean[] = []
  /** Scripted duration of each delivered tick (TICK_MS once exhausted). */
  tickGaps: number[] = []
  /** False: waitForTick() returns at once without advancing the clock. */
  blocking = true
  /** Like irsdk: isConnected() is false until the first tick of a connection. */
  irsdkLike = false
  connectCalls = 0
  disconnectCalls = 0
  readSessionCalls = 0
  waitCalls = 0
  connected = false
  /** False simulates the sim going away. */
  alive = true
  version = 1
  sessionRaw: unknown = { name: 'S1' }
  frame: TelemetryFrame = FRAME
  frameError: Error | null = null
  private ticksThisConnection = 0

  constructor(
    readonly kind: SourceKind,
    private readonly clock: Clock
  ) {}

  async connect(): Promise<boolean> {
    this.connectCalls++
    const result = this.connectResults.shift() ?? true
    if (result instanceof Error) throw result
    this.connected = result
    this.ticksThisConnection = 0
    if (result) this.alive = true
    return result
  }

  disconnect(): void {
    this.disconnectCalls++
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected && this.alive && (!this.irsdkLike || this.ticksThisConnection > 0)
  }

  waitForTick(timeoutMs: number): boolean {
    this.waitCalls++
    const got = this.connected && this.alive && (this.tickResults.shift() ?? true)
    if (got) this.ticksThisConnection++
    if (this.blocking) this.clock.t += got ? (this.tickGaps.shift() ?? TICK_MS) : timeoutMs
    return got
  }

  readFrame(): TelemetryFrame {
    if (this.frameError) throw this.frameError
    return this.frame
  }

  sessionInfoVersion(): number {
    return this.version
  }

  readSessionInfo(): unknown {
    this.readSessionCalls++
    return this.sessionRaw
  }
}

/** `type`: the SessionType of SessionNum 0 (none: unknown session kind). */
function session(name: string, type?: string): SessionMeta {
  return {
    playerCarIdx: 0,
    paceCarIdx: -1,
    driverCarEstLapTime: 90,
    trackLengthM: 4000,
    trackName: name,
    drivers: new Map(),
    sessionTypes: new Map(type === undefined ? [] : [[0, type]]),
    sessions: new Map(),
    subSessionId: 0,
    eventType: '',
    official: false,
    trackNumTurns: 0,
    sectorStarts: [],
    grid: new Map(),
    teamRacing: false,
    pitSpeedLimitKmh: null,
    trackId: 0,
    trackConfig: ''
  }
}

class FakeRaceModel implements RaceModelLike {
  /** sessionKey is settable: the providers follow it. */
  readonly view = { fake: 'race view', sessionKey: 'k1' } as unknown as RaceView & {
    sessionKey: string
  }
  updates: { frame: TelemetryFrame; session: SessionMeta }[] = []
  resets = 0
  breaks = 0
  updateError: Error | null = null
  resetError: Error | null = null

  update(frame: TelemetryFrame, session: SessionMeta): void {
    this.updates.push({ frame, session })
    if (this.updateError) throw this.updateError
  }

  reset(): void {
    this.resets++
    if (this.resetError) throw this.resetError
  }

  breakContinuity(): void {
    this.breaks++
  }
}

const STANDINGS: StandingsData = {
  header: {
    sessionType: null,
    lapsRemaining: null,
    timeRemainingS: null,
    iRating: null,
    safetyRating: null
  },
  classes: []
}
const BATTLE: BattleData = {
  visible: false,
  lapsRemaining: null,
  playerLastLaps: [],
  ahead: null,
  behind: null
}
const INPUTS: InputsData = {
  throttle: 0,
  brake: 0,
  clutch: 0,
  steering: 0,
  gear: 0,
  speedKmh: 0,
  abs: false,
  active: true,
  t: 1
}
const TRAFFIC: TrafficData = { visible: false, faster: [], slower: [], hazards: [] }
const ALERTS: AlertsData = {
  visible: false,
  flags: [],
  pitLimiter: null,
  speedKmh: 0,
  pitLimitKmh: null
}
const DELTA: DeltaData = {
  visible: false,
  reference: 'pb',
  refDriver: '',
  refSelf: false,
  refLapTime: null,
  delta: null,
  trend: 0,
  predictedLap: null,
  sectors: [],
  lapValid: true
}

interface Call<P> {
  ctx: ProviderContext
  prev: P | null
  /** Fake clock when the provider ran. */
  at: number
  payload: P
}

interface Harness {
  loop: TelemetryLoop
  source: FakeSource
  raceModel: FakeRaceModel
  /** providers.reset() calls. */
  providerResets: () => number
  clock: Clock
  out: TelemetryOutMessage[]
  sleeps: number[]
  parsed: unknown[]
  calls: { relative: Call<RelativeData>[]; radar: Call<RadarData>[]; delta: Call<DeltaData>[] }
  throwing: Set<WidgetId>
  /** Scripted radar `visible` per call (false once exhausted). */
  radarVisible: boolean[]
  /** Runs `n` more loop iterations (each ends with one yieldToEventLoop). */
  run(n: number, hook?: (iteration: number) => void): Promise<void>
  statuses(): OverlayStatus[]
  data(widget: WidgetId): TelemetryOutMessage[]
  logs(): TelemetryOutMessage[]
}

function setup(
  kind: SourceKind = 'iracing',
  skipEmit: typeof SKIP_EMIT = {},
  createRaceModel?: () => RaceModelLike,
  overrides: Partial<LoopDeps> = {}
): Harness {
  const clock: Clock = { t: 0 }
  const source = new FakeSource(kind, clock)
  const raceModel = new FakeRaceModel()
  const out: TelemetryOutMessage[] = []
  const sleeps: number[] = []
  const parsed: unknown[] = []
  const calls: Harness['calls'] = { relative: [], radar: [], delta: [] }
  const throwing = new Set<WidgetId>()
  const radarVisible: boolean[] = []
  let iteration = 0
  let maxIterations = 0
  let onIteration: (i: number) => void = () => {}

  let providerResets = 0
  const providers: ProviderSet['run'] = {
    relative: (ctx, prev) => {
      if (throwing.has('relative')) throw new Error('relative boom')
      const payload: RelativeData = {
        rows: [],
        playerRow: -1,
        slotsAhead: ctx.config.relative.carsAhead,
        slotsBehind: ctx.config.relative.carsBehind,
        sessionType: null
      }
      calls.relative.push({ ctx, prev, at: clock.t, payload })
      return payload
    },
    radar: (ctx, prev) => {
      const payload: RadarData = {
        visible: radarVisible.shift() ?? false,
        rangeM: ctx.config.radar.rangeM,
        carLeftRight: 0,
        leftCount: 0,
        rightCount: 0,
        cars: [],
        trackLengthKnown: true
      }
      calls.radar.push({ ctx, prev, at: clock.t, payload })
      if (throwing.has('radar')) throw new Error('radar boom')
      return payload
    },
    standings: () => STANDINGS,
    battle: () => BATTLE,
    inputs: () => INPUTS,
    traffic: () => TRAFFIC,
    alerts: () => ALERTS,
    delta: (ctx, prev) => {
      calls.delta.push({ ctx, prev, at: clock.t, payload: DELTA })
      return DELTA
    }
  }

  const loop = new TelemetryLoop(source, (msg) => out.push(msg), {
    now: () => clock.t,
    sleep: async (ms) => {
      sleeps.push(ms)
      clock.t += ms
    },
    yieldToEventLoop: async () => {
      iteration++
      onIteration(iteration)
      if (iteration >= maxIterations) loop.stop()
    },
    createProviders: () => ({
      run: providers,
      reset: () => {
        providerResets++
      }
    }),
    skipEmit,
    parseSession: (raw) => {
      parsed.push(raw)
      const r = raw as { name: string; type?: string }
      return session(r.name, r.type)
    },
    retryMs: 2000,
    tickTimeoutMs: 16,
    staleMs: 5000,
    createRaceModel: createRaceModel ?? (() => raceModel),
    ...overrides
  })

  return {
    loop,
    source,
    raceModel,
    providerResets: () => providerResets,
    clock,
    out,
    sleeps,
    parsed,
    calls,
    throwing,
    radarVisible,
    run: async (n, hook = () => {}) => {
      maxIterations = iteration + n
      onIteration = hook
      await loop.start()
    },
    statuses: () => out.flatMap((m) => (m.type === 'status' ? [m.status] : [])),
    data: (widget) => out.filter((m) => m.type === 'data' && m.widget === widget),
    logs: () => out.filter((m) => m.type === 'log')
  }
}

function autoHidden(h: Harness): TelemetryOutMessage[] {
  return h.out.filter((m) => m.type === 'auto-hidden')
}

/** The player (CarIdx 0) of SessionNum 0, on track unless overridden. */
function playerFrame(o: Partial<MutableFrame> = {}): TelemetryFrame {
  return makeFrame({
    SessionNum: [0],
    PlayerCarIdx: [0],
    CarIdxOnPitRoad: [false],
    CarIdxTrackSurface: [TrackLocation.OnTrack],
    ...o
  })
}

/** Gaps between consecutive runs, in ms. */
function gaps(calls: readonly { at: number }[]): number[] {
  return calls.slice(1).map((c, i) => c.at - (calls[i]?.at ?? 0))
}

/** Deterministic pseudo-random numbers in [0, 1). */
function lcg(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

describe('TelemetryLoop', () => {
  it('reports waiting and retries connect() after sleep(retryMs)', async () => {
    const h = setup()
    h.source.connectResults = [false, false, new Error('no sim'), true]
    await h.run(5)

    expect(h.source.connectCalls).toBe(4)
    expect(h.sleeps).toEqual([2000, 2000, 2000])
    // A rejected connect() shows as an error until an attempt no longer throws.
    expect(h.statuses()).toEqual([
      { state: 'waiting', source: 'iracing', note: 'none', detail: '' },
      { state: 'error', source: 'iracing', note: 'none', detail: 'no sim' },
      { state: 'waiting', source: 'iracing', note: 'none', detail: '' },
      { state: 'connected', source: 'iracing', note: 'none', detail: '' }
    ])
    expect(h.logs()).toHaveLength(1)
  })

  it('keeps a repeated connect() error on screen without flapping and backs off', async () => {
    const h = setup()
    const fail = (): Error => new Error('addon gone')
    h.source.connectResults = [fail(), fail(), fail(), fail()]
    await h.run(4)

    expect(h.sleeps).toEqual([2000, 2000, 2000, 2000])
    expect(h.statuses()).toEqual([
      { state: 'waiting', source: 'iracing', note: 'none', detail: '' },
      { state: 'error', source: 'iracing', note: 'none', detail: 'addon gone' }
    ])
    expect(h.logs()).toHaveLength(1)
  })

  it("marks a missing native SDK module with the 'native-missing' note (a code, no sentence)", async () => {
    const h = setup()
    h.source.connectResults = [new NativeSdkMissingError(), new NativeSdkMissingError()]
    await h.run(2)

    expect(h.statuses()).toEqual([
      { state: 'waiting', source: 'iracing', note: 'none', detail: '' },
      {
        state: 'error',
        source: 'iracing',
        note: 'native-missing',
        detail: 'The iRacing SDK native module could not be loaded'
      }
    ])
    // Each window words it in its language.
    const status = h.statuses().at(-1)
    if (!status) throw new Error('no status')
    expect(statusText(messagesFor('es'), status)).toBe(
      'No se pudo cargar el módulo nativo del SDK de iRacing'
    )
    expect(statusText(messagesFor('en'), status)).toBe(
      'Could not load the iRacing SDK native module'
    )
  })

  it('reports connected on the first tick, and mock for the mock source', async () => {
    const h = setup()
    h.source.tickResults = [false, false]
    await h.run(3)
    expect(h.statuses().map((s) => s.state)).toEqual(['waiting'])
    await h.run(1)
    expect(h.statuses().map((s) => s.state)).toEqual(['waiting', 'connected'])

    const m = setup('mock')
    await m.run(3)
    expect(m.statuses().at(-1)).toEqual({
      state: 'mock',
      source: 'mock',
      note: 'none',
      detail: ''
    })
  })

  it('runs radar every tick and throttles relative to ~10 Hz', async () => {
    const h = setup()
    await h.run(1 + 60) // connect + 60 ticks of 16.7 ms (~1 s)

    expect(h.data('radar')).toHaveLength(60)
    expect(h.data('relative')).toHaveLength(10)
    // A source that blocks never trips the spin guard.
    expect(h.sleeps).toEqual([])
    // Default config before main sends one: every widget, default options and rules.
    const config = h.calls.relative[0]?.ctx.config
    expect(config).toEqual(defaultTelemetryConfig())
    expect(config?.enabledWidgets).toEqual([...WIDGET_IDS])
    expect(config?.relative).toEqual({
      carsAhead: 3,
      carsBehind: 3,
      showClassPosition: true,
      showLicense: true,
      showIRating: true,
      nameFormat: 'inherit'
    })
    expect(config?.rules.battle).toEqual({
      showIn: { practice: false, qualify: false, race: true },
      hideInPits: false
    })
    expect(h.calls.radar[0]?.ctx.frame).toBe(FRAME)
    // Each radar call gets the previous payload.
    expect(h.calls.radar[0]?.prev).toBeNull()
    const firstPayload = h.data('radar')[0]
    expect(firstPayload?.type === 'data' && h.calls.radar[1]?.prev === firstPayload.payload).toBe(
      true
    )
  })

  it('runs the 60 Hz radar on every tick, also on the quick one after a stall', async () => {
    const h = setup()
    // 5 regular ticks, a 45 ms stall, the backlog tick 4 ms later, 5 regular ticks.
    h.source.tickGaps = [16.7, 16.7, 16.7, 16.7, 16.7, 45, 4, 16.7, 16.7, 16.7, 16.7, 16.7]
    await h.run(1 + 12)
    expect(h.calls.radar).toHaveLength(12)
    expect(h.data('radar')).toHaveLength(12)
  })

  it('keeps relative at 10 Hz under tick jitter, without double runs after a stall', async () => {
    const h = setup()
    const rand = lcg(7)
    // 10 s of ticks jittered by ±4 ms.
    h.source.tickGaps = Array.from({ length: 600 }, () => 1000 / 60 + (rand() - 0.5) * 8)
    await h.run(1 + 600)
    const steady = h.calls.relative.length
    expect(steady).toBeGreaterThanOrEqual(99)
    expect(steady).toBeLessThanOrEqual(101)
    for (const g of gaps(h.calls.relative)) {
      expect(g).toBeGreaterThan(80)
      expect(g).toBeLessThan(120)
    }

    // A 350 ms stall runs it on the tick that ends it, then about one interval later.
    const stallEnd = h.clock.t + 350
    const regular = (n: number): number[] => new Array<number>(n).fill(1000 / 60)
    h.source.tickGaps = [350, ...regular(20), 90, ...regular(20)]
    await h.run(42)
    const after = h.calls.relative.slice(steady)
    expect(after[0]?.at).toBe(stallEnd)
    expect(gaps(after)[0]).toBeGreaterThanOrEqual(90)
    // Neither stall makes it run twice in a row.
    for (const g of gaps(h.calls.relative.slice(steady - 1))) expect(g).toBeGreaterThanOrEqual(50)
  })

  it('parses the session only when its version changes and keeps it on null', async () => {
    const h = setup()
    await h.run(1 + 5)
    expect(h.parsed).toEqual([{ name: 'S1' }])
    expect(h.source.readSessionCalls).toBe(1)

    // New version but unreadable YAML: keep S1, retry at most once per second.
    h.source.version = 2
    h.source.sessionRaw = null
    await h.run(10)
    expect(h.parsed).toHaveLength(1)
    expect(h.source.readSessionCalls).toBe(2)
    expect(h.calls.radar.at(-1)?.ctx.session.trackName).toBe('S1')

    h.source.sessionRaw = { name: 'S2' }
    await h.run(60)
    expect(h.parsed).toEqual([{ name: 'S1' }, { name: 'S2' }])
    expect(h.source.readSessionCalls).toBe(3)
    expect(h.calls.radar.at(-1)?.ctx.session.trackName).toBe('S2')
  })

  it('skips providers until a session has been parsed', async () => {
    const h = setup()
    h.source.sessionRaw = null
    await h.run(1 + 10)
    expect(h.calls.radar).toHaveLength(0)
    expect(h.statuses().at(-1)?.state).toBe('connected')

    h.source.sessionRaw = { name: 'S1' }
    await h.run(70)
    expect(h.calls.radar.length).toBeGreaterThan(0)
  })

  it('does not compute disabled widgets', async () => {
    const h = setup()
    h.loop.setConfig({ ...defaultTelemetryConfig(), enabledWidgets: ['radar'] })
    await h.run(1 + 30)
    expect(h.calls.relative).toHaveLength(0)
    expect(h.data('radar')).toHaveLength(30)
  })

  it('keeps running when a provider throws and rate-limits its error log', async () => {
    const h = setup()
    h.throwing.add('radar')
    await h.run(1 + 60)
    expect(h.calls.radar).toHaveLength(60)
    expect(h.data('radar')).toHaveLength(0)
    expect(h.data('relative')).toHaveLength(10)
    expect(h.logs()).toEqual([
      { type: 'log', level: 'error', message: 'Widget "radar" failed: radar boom' }
    ])

    await h.run(300) // past the 5 s log window
    expect(h.logs()).toHaveLength(2)
  })

  it('computes every payload but only sends those the skip rule lets through', async () => {
    const h = setup('iracing', {
      radar: (payload, prev) => !payload.visible && prev !== null && !prev.visible
    })
    h.radarVisible.push(false, false, false, true, true, false, false, false)
    await h.run(1 + 8)

    expect(h.calls.radar).toHaveLength(8)
    const sent = h.data('radar').map((m) => (m.type === 'data' ? m.payload : null))
    expect(sent).toEqual([1, 4, 5, 6].map((tick) => h.calls.radar[tick - 1]?.payload))
    // prev is the last computed payload, sent or not.
    expect(h.calls.radar[2]?.prev).toBe(h.calls.radar[1]?.payload)
    // Relative has no rule: always sent.
    expect(h.data('relative')).toHaveLength(h.calls.relative.length)

    // After a reconnect prev is null again, so the first payload is sent.
    h.source.alive = false
    await h.run(1 + 1 + 1)
    expect(h.calls.radar.at(-1)?.prev).toBeNull()
    expect(h.data('radar')).toHaveLength(5)
  })

  it('drops the connection when the sim goes away and backs off before reconnecting', async () => {
    const h = setup()
    await h.run(1 + 10)
    expect(h.parsed).toHaveLength(1)

    h.source.alive = false
    h.source.connectResults = [false, true]
    await h.run(1 + 2 + 3) // lost tick, failed attempt, reconnect, ticks
    expect(h.source.disconnectCalls).toBe(1)
    // The drop itself now backs off too (it used to reconnect at once).
    expect(h.sleeps).toEqual([2000, 2000])
    expect(h.statuses().map((s) => s.state)).toEqual([
      'waiting',
      'connected',
      'waiting',
      'connected'
    ])
    // Same version as before, but the session is re-read after a reconnect.
    expect(h.parsed).toHaveLength(2)
    const afterReconnect = h.calls.radar.filter((c) => c.prev === null)
    expect(afterReconnect).toHaveLength(2)
  })

  it('drops a connection that stops ticking for staleMs', async () => {
    const h = setup()
    await h.run(1 + 2)
    h.source.tickResults = new Array<boolean>(400).fill(false)
    // 5000 ms / 16 ms per empty wait = 313 empty ticks.
    await h.run(312)
    expect(h.source.disconnectCalls).toBe(0)
    await h.run(1)
    expect(h.source.disconnectCalls).toBe(1)
    expect(h.sleeps).toEqual([2000])
    await h.run(1)
    expect(h.statuses().at(-1)?.state).toBe('waiting')
  })

  it('does not storm reconnects while the sim is up but not ticking', async () => {
    const h = setup()
    // connect() succeeds, irsdk reports not connected (no first tick) and no tick arrives.
    h.source.irsdkLike = true
    h.source.tickResults = new Array<boolean>(5000).fill(false)
    await h.run(3000)

    const seconds = h.clock.t / 1000
    // Each attempt waits staleMs for a first tick, then backs off retryMs.
    expect(h.source.connectCalls).toBeLessThanOrEqual(Math.ceil(seconds / 7) + 1)
    expect(h.source.connectCalls).toBeGreaterThanOrEqual(2)
    expect(h.sleeps.length).toBeGreaterThanOrEqual(h.source.disconnectCalls)
    expect(h.sleeps.every((ms) => ms === 2000)).toBe(true)
  })

  it('keeps a fresh irsdk connection whose first wait times out', async () => {
    const h = setup()
    h.source.irsdkLike = true
    h.source.tickResults = [false, false]
    await h.run(1 + 2 + 10)
    expect(h.source.disconnectCalls).toBe(0)
    expect(h.source.connectCalls).toBe(1)
    expect(h.sleeps).toEqual([])
    expect(h.statuses().map((s) => s.state)).toEqual(['waiting', 'connected'])
    expect(h.calls.radar).toHaveLength(10)
  })

  it('reports a source failure as an error and recovers', async () => {
    const h = setup()
    await h.run(1 + 3)
    h.source.frameError = new Error('boom')
    await h.run(1)
    expect(h.statuses().at(-1)).toEqual({
      state: 'error',
      source: 'iracing',
      note: 'none',
      detail: 'boom'
    })
    expect(h.source.disconnectCalls).toBe(1)
    expect(h.sleeps).toEqual([2000])

    h.source.frameError = null
    await h.run(3)
    expect(h.statuses().map((s) => s.state)).toEqual([
      'waiting',
      'connected',
      'error',
      'waiting',
      'connected'
    ])
  })

  it('caps a source that never blocks at ~240 iterations/s', async () => {
    const h = setup()
    h.source.blocking = false
    await h.run(1 + 480)

    expect(h.source.waitCalls).toBe(480)
    // Only the guard's sleeps move the fake clock.
    const rate = 480 / (h.clock.t / 1000)
    expect(rate).toBeLessThanOrEqual(240)
    expect(rate).toBeGreaterThan(220)
    expect(h.sleeps.every((ms) => ms > 0 && ms <= 17)).toBe(true)
    expect(h.logs()).toEqual([
      {
        type: 'log',
        level: 'warn',
        message: 'Telemetry source returns without waiting for ticks; throttling the loop'
      }
    ])
    expect(h.data('radar')).toHaveLength(480)
  })

  it('caps a non-blocking source with real timers too', async () => {
    const clock: Clock = { t: 0 }
    const source = new FakeSource('iracing', clock)
    source.blocking = false
    const loop = new TelemetryLoop(source, () => {})
    const started = performance.now()
    const done = loop.start()
    await new Promise((resolve) => setTimeout(resolve, 300))
    loop.stop()
    await done
    const seconds = (performance.now() - started) / 1000
    expect(source.waitCalls).toBeGreaterThan(0)
    expect(source.waitCalls / seconds).toBeLessThanOrEqual(260)
  })

  it('applies setConfig on the next tick', async () => {
    const h = setup()
    const config: TelemetryConfig = {
      ...defaultTelemetryConfig(),
      enabledWidgets: ['relative'],
      relative: { ...defaultTelemetryConfig().relative, carsAhead: 5, carsBehind: 1 },
      radar: { ...defaultTelemetryConfig().radar, rangeM: 40 }
    }
    await h.run(1 + 3, (i) => {
      if (i === 2) h.loop.setConfig(config)
    })
    // Tick 1 ran both widgets with the defaults; tick 2 re-ran relative at once, radar no more.
    expect(h.calls.radar).toHaveLength(1)
    expect(h.calls.relative).toHaveLength(2)
    const last = h.data('relative').at(-1)
    expect(last?.type === 'data' && last.widget === 'relative' && last.payload.slotsAhead).toBe(5)
  })

  it('feeds the race model on every tick once a session exists and hands its view to providers', async () => {
    const h = setup()
    h.source.sessionRaw = null
    await h.run(1 + 5)
    expect(h.raceModel.updates).toHaveLength(0)

    h.source.sessionRaw = { name: 'S1' }
    await h.run(70) // the unreadable version is retried after 1 s
    const n = h.raceModel.updates.length
    expect(n).toBeGreaterThan(0)
    // Fed on every tick that ran the (every-tick) radar, i.e. every tick with a session.
    expect(n).toBe(h.calls.radar.length)
    expect(h.raceModel.updates[0]?.frame).toBe(FRAME)
    expect(h.raceModel.updates[0]?.session.trackName).toBe('S1')
    expect(h.calls.radar[0]?.ctx.race).toBe(h.raceModel.view)
    expect(h.calls.relative[0]?.ctx.race).toBe(h.raceModel.view)

    // A new session reaches the model on the tick it is parsed.
    h.source.version = 2
    h.source.sessionRaw = { name: 'S2' }
    await h.run(1)
    expect(h.raceModel.updates.at(-1)?.session.trackName).toBe('S2')
  })

  it('feeds the race model even with no widget enabled', async () => {
    const h = setup()
    h.loop.setConfig({ ...defaultTelemetryConfig(), enabledWidgets: [] })
    await h.run(1 + 30)
    expect(h.raceModel.updates).toHaveLength(30)
    expect(h.calls.radar).toHaveLength(0)
    expect(h.calls.relative).toHaveLength(0)
  })

  it('soft-resets the race model when the connection drops (it keeps the same session)', async () => {
    const h = setup()
    await h.run(1 + 5)
    expect(h.raceModel.resets).toBe(0)
    h.source.alive = false
    await h.run(1 + 1 + 3) // lost tick, reconnect, ticks
    // The same model instance keeps being fed: reset() only breaks continuity.
    expect(h.raceModel.resets).toBe(1)
    expect(h.raceModel.updates).toHaveLength(5 + 3)

    // A failing source drops the connection too; a reset that throws is only logged.
    h.raceModel.resetError = new Error('reset boom')
    h.source.frameError = new Error('boom')
    await h.run(1)
    expect(h.raceModel.resets).toBe(2)
    expect(h.logs().at(-1)).toEqual({
      type: 'log',
      level: 'error',
      message: 'Race model reset failed: reset boom'
    })
    h.source.frameError = null
    await h.run(3)
    expect(h.statuses().at(-1)?.state).toBe('connected')
  })

  it('keeps the widgets running when the race model throws, logging at most every 5 s', async () => {
    const h = setup()
    h.raceModel.updateError = new Error('timing boom')
    await h.run(1 + 60)
    expect(h.raceModel.updates).toHaveLength(60)
    expect(h.data('radar')).toHaveLength(60)
    expect(h.data('relative')).toHaveLength(10)
    expect(h.calls.radar.at(-1)?.ctx.race).toBe(h.raceModel.view)
    expect(h.logs()).toEqual([
      { type: 'log', level: 'error', message: 'Race model update failed: timing boom' }
    ])
    expect(h.statuses().at(-1)?.state).toBe('connected')

    await h.run(300) // past the 5 s log window
    expect(h.logs()).toHaveLength(2)
  })

  it('runs the widgets with an empty race view when the model cannot be built', async () => {
    const h = setup('iracing', {}, () => {
      throw new Error('no model')
    })
    await h.run(1 + 10)
    expect(h.logs()).toEqual([
      { type: 'log', level: 'error', message: 'Race model unavailable: no model' }
    ])
    expect(h.data('radar')).toHaveLength(10)
    const race = h.calls.radar[0]?.ctx.race
    expect(race?.cars()).toEqual([])
    expect(race?.car(3)).toBeUndefined()
    expect(race?.timeGap(1, 2)).toBeNull()
    expect(race?.racing).toBe(false)
  })

  it('resets the providers on a new session key and after a dropped connection', async () => {
    const h = setup()
    await h.run(1 + 5)
    // The first tick adopts the first key.
    expect(h.providerResets()).toBe(1)
    expect(h.calls.radar.at(-1)?.prev).not.toBeNull()
    h.raceModel.view.sessionKey = 'k2'
    await h.run(1)
    expect(h.providerResets()).toBe(2)
    // The old session's payloads are nobody's "previous" one.
    expect(h.calls.radar.at(-1)?.prev).toBeNull()
    await h.run(1)
    expect(h.calls.radar.at(-1)?.prev).not.toBeNull()
    expect(h.providerResets()).toBe(2)
    h.source.alive = false
    await h.run(1)
    expect(h.providerResets()).toBe(3)
    await h.run(1 + 1)
    expect(h.calls.radar.at(-1)?.prev).toBeNull()
  })

  it('hides a widget its "Mostrar en" rule excludes: not computed, one message per change', async () => {
    const h = setup()
    h.source.sessionRaw = { name: 'S1', type: 'Practice' }
    h.source.frame = playerFrame()
    const config = defaultTelemetryConfig()
    config.rules.radar = {
      showIn: { practice: false, qualify: true, race: true },
      hideInPits: false
    }
    h.loop.setConfig(config)
    await h.run(1 + 10)
    expect(h.calls.radar).toHaveLength(0)
    expect(h.data('battle')).toHaveLength(0)
    expect(h.data('relative').length).toBeGreaterThan(0)
    // Battle is race-only by default.
    expect(autoHidden(h)).toEqual([
      { type: 'auto-hidden', widget: 'radar', hidden: true, reason: 'practice' },
      { type: 'auto-hidden', widget: 'battle', hidden: true, reason: 'practice' }
    ])

    // The race session starts: both are shown again and computed at once, with no stale prev.
    h.source.version = 2
    h.source.sessionRaw = { name: 'S2', type: 'Race' }
    await h.run(1)
    expect(autoHidden(h).slice(2)).toEqual([
      { type: 'auto-hidden', widget: 'radar', hidden: false, reason: null },
      { type: 'auto-hidden', widget: 'battle', hidden: false, reason: null }
    ])
    expect(h.calls.radar).toHaveLength(1)
    expect(h.calls.radar[0]?.prev).toBeNull()
    expect(h.data('battle')).toHaveLength(1)
    await h.run(20)
    expect(autoHidden(h)).toHaveLength(4)
  })

  it('"Ocultar en boxes": hidden while the player is on pit road or in the stall', async () => {
    const h = setup()
    h.source.sessionRaw = { name: 'S1', type: 'Race' }
    const config = defaultTelemetryConfig()
    config.rules.inputs = { ...config.rules.inputs, hideInPits: true }
    h.loop.setConfig(config)
    h.source.frame = playerFrame()
    await h.run(1 + 3)
    expect(autoHidden(h)).toEqual([])
    expect(h.data('inputs')).toHaveLength(3)
    h.source.frame = playerFrame({ CarIdxOnPitRoad: [true] })
    await h.run(3)
    h.source.frame = playerFrame({ CarIdxTrackSurface: [TrackLocation.InPitStall] })
    await h.run(3)
    expect(h.data('inputs')).toHaveLength(3)
    h.source.frame = playerFrame()
    await h.run(2)
    expect(autoHidden(h)).toEqual([
      { type: 'auto-hidden', widget: 'inputs', hidden: true, reason: 'pits' },
      { type: 'auto-hidden', widget: 'inputs', hidden: false, reason: null }
    ])
    expect(h.data('inputs')).toHaveLength(5)
  })

  it('a widget shown again starts from no previous payload, so its first one is sent', async () => {
    const h = setup('iracing', {
      radar: (payload, prev) => !payload.visible && prev !== null && !prev.visible
    })
    h.source.sessionRaw = { name: 'S1', type: 'Race' }
    const config = defaultTelemetryConfig()
    config.rules.radar = { ...config.rules.radar, hideInPits: true }
    h.loop.setConfig(config)
    h.source.frame = playerFrame()
    // Nobody around: only the first (hidden) radar payload is sent.
    await h.run(1 + 3)
    expect(h.data('radar')).toHaveLength(1)
    h.source.frame = playerFrame({ CarIdxOnPitRoad: [true] })
    await h.run(3)
    expect(h.calls.radar).toHaveLength(3)
    h.source.frame = playerFrame()
    await h.run(2)
    // Not "unchanged since before the stop": the window gets a fresh payload at once.
    expect(h.calls.radar[3]?.prev).toBeNull()
    expect(h.data('radar')).toHaveLength(2)
  })

  it('shows every hidden widget again when the connection drops (the session is unknown)', async () => {
    const h = setup()
    h.source.sessionRaw = { name: 'S1', type: 'Practice' }
    h.source.frame = playerFrame()
    await h.run(1 + 2)
    const hidden = {
      type: 'auto-hidden',
      widget: 'battle',
      hidden: true,
      reason: 'practice'
    }
    expect(autoHidden(h)).toEqual([hidden])
    h.source.alive = false
    await h.run(1)
    expect(autoHidden(h).at(-1)).toEqual({
      type: 'auto-hidden',
      widget: 'battle',
      hidden: false,
      reason: null
    })
    // Reconnected to the same practice: hidden again.
    await h.run(1 + 1)
    expect(autoHidden(h)).toEqual([hidden, { ...hidden, hidden: false, reason: null }, hidden])
  })

  it('keeps running with broken rules, logging at most every 5 s', async () => {
    const h = setup()
    h.loop.setConfig({
      ...defaultTelemetryConfig(),
      rules: null as unknown as TelemetryConfig['rules']
    })
    await h.run(1 + 60)
    expect(h.data('radar')).toHaveLength(60)
    expect(h.logs()).toEqual([
      { type: 'log', level: 'error', message: expect.stringContaining('Visibility rules failed') }
    ])
    await h.run(300)
    expect(h.logs()).toHaveLength(2)
  })

  it('stop() ends start(), even while waiting to retry', async () => {
    const clock: Clock = { t: 0 }
    const source = new FakeSource('iracing', clock)
    source.connectResults = [false]
    const loop = new TelemetryLoop(source, () => {}, {
      sleep: () => new Promise<void>(() => {}),
      yieldToEventLoop: () => Promise.resolve()
    })
    const done = loop.start()
    await new Promise((resolve) => setTimeout(resolve, 0))
    loop.stop()
    await expect(done).resolves.toBeUndefined()
    expect(source.connectCalls).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Personal bests
// ---------------------------------------------------------------------------

type LastLap = NonNullable<ReturnType<RaceView['lapProfile']>>

/** The model's snapshot of a completed lap (uniform pace). */
function lastLap(lap: number, lapTime: number, clean = true): LastLap {
  const profile = Array.from({ length: 101 }, (_, i) => (lapTime * i) / 100)
  return Object.freeze({ lap, lapTime, clean, profile: Object.freeze(profile) })
}

/** A lap as the store keeps it. */
function reference(lapTime: number): LapReference {
  const { profile } = lastLap(1, lapTime)
  return { lapTime, profile, recordedAt: '' }
}

/** A model whose view exposes the player's last lap and the session clock, set by the test. */
class LapsModel implements RaceModelLike {
  last: LastLap | null = null
  time = 100
  profileError: Error | null = null
  readonly view: RaceView

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this
    this.view = {
      sessionKey: 'k1',
      playerCarIdx: 0,
      get sessionTime(): number {
        return self.time
      },
      lapProfile: (carIdx: number, which: 'best' | 'last') => {
        if (self.profileError) throw self.profileError
        return carIdx === 0 && which === 'last' ? self.last : null
      }
    } as unknown as RaceView
  }

  update(): void {
    // Scripted by the test.
  }

  reset(): void {
    // Keeps its laps, like the real soft reset.
  }

  breakContinuity(): void {
    // Keeps its laps too.
  }
}

function pbDriver(carId: number): DriverEntry {
  return {
    carIdx: 0,
    userName: 'Alejandro Ruiz',
    teamName: '',
    carNumber: '07',
    iRating: 2380,
    licString: 'B 3.27',
    licColor: null,
    classId: 4029,
    classShortName: 'GT3',
    classColor: '#ffda59',
    classEstLapTime: 138,
    isPaceCar: false,
    isSpectator: false,
    licLevel: 15,
    licSubLevel: 327,
    classRelSpeed: 54,
    userId: 1,
    teamId: 0,
    carId,
    carName: 'Porsche 911 GT3 R',
    isAI: false
  }
}

interface PbHarness extends Harness {
  model: LapsModel
  offers: [string, LapReference][]
  /** The names offered with each lap. */
  labels: (PersonalBestLabel | undefined)[]
  /** What onPersonalBestTarget reported, in order. */
  targets: (PersonalBestTarget | null)[]
}

function setupBests(carId = 67, wallClockMs = Date.UTC(2026, 9, 25, 18, 30)): PbHarness {
  const model = new LapsModel()
  const offers: [string, LapReference][] = []
  const labels: (PersonalBestLabel | undefined)[] = []
  const targets: (PersonalBestTarget | null)[] = []
  const store: PersonalBestStore = {
    get: () => null,
    offer: (key, lap, label) => {
      offers.push([key, lap])
      labels.push(label)
      return true
    }
  }
  const h = setup('iracing', {}, () => model, {
    bests: store,
    wallClockMs: () => wallClockMs,
    onPersonalBestTarget: (t) => targets.push(t),
    parseSession: (raw) => ({
      ...session((raw as { name: string }).name, 'Practice'),
      drivers: new Map([[0, pbDriver(carId)]]),
      trackId: 219,
      trackConfig: 'Grand Prix'
    })
  })
  h.source.frame = playerFrame({ IsOnTrack: [true] })
  return Object.assign(h, { model, offers, labels, targets })
}

/** Runs `n` ticks, the session clock advancing 1 s per tick. */
async function seconds(
  h: PbHarness,
  n: number,
  hook: (i: number) => void = () => {}
): Promise<void> {
  await h.run(n, (i) => {
    h.model.time += 1
    hook(i)
  })
}

describe('TelemetryLoop personal bests', () => {
  it('offers a clean lap once, after its official time had time to arrive, with the refined time', async () => {
    const h = setupBests()
    await h.run(1 + 2) // connect, two ticks without a lap
    h.model.last = lastLap(15, 138.214)
    await seconds(h, 3)
    expect(h.offers).toEqual([])
    // CarIdxLastLapTime refined the model's time: a new snapshot of the same lap.
    h.model.last = lastLap(15, 138.2093)
    await seconds(h, 2)
    expect(h.offers).toEqual([])
    await seconds(h, 2)
    expect(h.offers).toHaveLength(1)
    const [key, lap] = h.offers[0] ?? []
    expect(key).toBe('67@219/Grand Prix')
    expect(lap?.lapTime).toBe(138.2093)
    expect(lap?.profile).toHaveLength(101)
    expect(lap?.recordedAt).toBe('2026-10-25T18:30:00.000Z')
    // Never again for that lap, whatever happens to its snapshot.
    await seconds(h, 30)
    h.model.last = lastLap(15, 138.2)
    await seconds(h, 30)
    expect(h.offers).toHaveLength(1)
    // The next lap is offered in turn.
    h.model.last = lastLap(16, 137.9)
    await seconds(h, 10)
    expect(h.offers.map(([, l]) => l.lapTime)).toEqual([138.2093, 137.9])
  })

  it('offers the names of the car and the layout with the lap', async () => {
    const h = setupBests()
    await h.run(1 + 1)
    h.model.last = lastLap(15, 138)
    await seconds(h, 10)
    expect(h.labels).toEqual([
      { key: '67@219/Grand Prix', car: 'Porsche 911 GT3 R', track: 'S1', layout: 'Grand Prix' }
    ])
  })

  it('reports the car + layout being driven on change only, and null once disconnected', async () => {
    const h = setupBests()
    await h.run(1 + 5)
    const s1 = {
      key: '67@219/Grand Prix',
      car: 'Porsche 911 GT3 R',
      track: 'S1',
      layout: 'Grand Prix'
    }
    expect(h.targets).toEqual([s1])
    // A new YAML version of the same car and layout: nothing to report.
    h.source.version = 2
    await h.run(5)
    expect(h.targets).toEqual([s1])
    h.source.version = 3
    h.source.sessionRaw = { name: 'S2' }
    await h.run(5)
    expect(h.targets).toEqual([s1, { ...s1, track: 'S2' }])
    // The sim goes away: nothing is being driven until it is back.
    h.source.alive = false
    await h.run(3)
    expect(h.targets[2]).toBeNull()
  })

  it('a throwing target listener breaks nothing', async () => {
    const model = new LapsModel()
    const h = setup('iracing', {}, () => model, {
      onPersonalBestTarget: () => {
        throw new Error('listener')
      },
      parseSession: (raw) => ({
        ...session((raw as { name: string }).name, 'Practice'),
        drivers: new Map([[0, pbDriver(67)]]),
        trackId: 219
      })
    })
    await h.run(1 + 3)
    expect(h.calls.relative.length).toBeGreaterThan(0)
  })

  it('hands the store to the providers', async () => {
    const h = setupBests()
    await h.run(1 + 1)
    const bests = h.calls.delta[0]?.ctx.bests
    expect(bests?.offer('x', reference(90))).toBe(true)
    expect(h.offers.map(([k]) => k)).toEqual(['x'])
  })

  it('skips unclean laps, laps you did not drive and cars or tracks it cannot key', async () => {
    const h = setupBests()
    await h.run(1 + 1)
    h.model.last = lastLap(15, 138, false)
    await seconds(h, 10)
    // IsOnTrack false at the line: a teammate's stint or a replay.
    h.source.frame = playerFrame({ IsOnTrack: [false] })
    h.model.last = lastLap(16, 137)
    await seconds(h, 1)
    h.source.frame = playerFrame({ IsOnTrack: [true] })
    await seconds(h, 10)
    expect(h.offers).toEqual([])

    const unknownCar = setupBests(0)
    await unknownCar.run(1 + 1)
    unknownCar.model.last = lastLap(15, 138)
    await seconds(unknownCar, 10)
    expect(unknownCar.offers).toEqual([])
  })

  it('offers a pending lap at once when it stops being the last one', async () => {
    const h = setupBests()
    await h.run(1 + 1)
    h.model.last = lastLap(15, 138)
    await seconds(h, 1)
    // New session: the model forgets its laps.
    h.model.last = null
    await seconds(h, 1)
    expect(h.offers.map(([, l]) => l.lapTime)).toEqual([138])
    h.model.last = lastLap(3, 139)
    await seconds(h, 1)
    h.model.last = lastLap(4, 137)
    await seconds(h, 1)
    expect(h.offers.map(([, l]) => l.lapTime)).toEqual([138, 139])
  })

  it('does not offer a lap again after a reconnect to the same session', async () => {
    const h = setupBests()
    await h.run(1 + 1)
    h.model.last = lastLap(15, 138)
    await seconds(h, 10)
    expect(h.offers).toHaveLength(1)
    h.source.alive = false
    await h.run(1 + 1 + 20)
    expect(h.statuses().map((s) => s.state)).toEqual([
      'waiting',
      'connected',
      'waiting',
      'connected'
    ])
    expect(h.offers).toHaveLength(1)
  })

  it('settles a lap still waiting for its official time on shutdown, once', async () => {
    const h = setupBests()
    h.loop.settlePersonalBests()
    await h.run(1 + 1)
    h.model.last = lastLap(15, 138)
    await seconds(h, 2)
    expect(h.offers).toEqual([])
    h.loop.settlePersonalBests()
    h.loop.settlePersonalBests()
    expect(h.offers.map(([, l]) => l.lapTime)).toEqual([138])
    await seconds(h, 10)
    expect(h.offers).toHaveLength(1)
  })

  it('offers after 30 s of real time when the session clock stands still (paused sim)', async () => {
    const h = setupBests()
    await h.run(1 + 1)
    h.model.last = lastLap(15, 138)
    await h.run(Math.floor(29_000 / TICK_MS))
    expect(h.offers).toEqual([])
    await h.run(Math.ceil(2_000 / TICK_MS))
    expect(h.offers).toHaveLength(1)
  })

  it('keeps the widgets running when the lap lookup throws, logging at most every 5 s', async () => {
    const h = setupBests()
    h.model.profileError = new Error('profile boom')
    await h.run(1 + 60)
    expect(h.data('radar')).toHaveLength(60)
    expect(h.logs()).toEqual([
      { type: 'log', level: 'error', message: 'Personal best update failed: profile boom' }
    ])
    await h.run(300)
    expect(h.logs()).toHaveLength(2)
  })

  it('uses an in-memory store of its own without one injected', async () => {
    const a = setup()
    const b = setup()
    await a.run(1 + 1)
    await b.run(1 + 1)
    const storeA = a.calls.delta[0]?.ctx.bests
    const storeB = b.calls.delta[0]?.ctx.bests
    expect(storeA?.offer('k', reference(90))).toBe(true)
    expect(storeA?.get('k')?.lapTime).toBe(90)
    expect(storeB?.get('k')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Replays
// ---------------------------------------------------------------------------

const LIVE = playerFrame()
/** A replay frame: its own clock (50 s back), the camera on car 4. */
const REPLAY = playerFrame({ IsReplayPlaying: [true], CamCarIdx: [4], SessionTime: [-49] })
const LIVE_ONLY = WIDGET_IDS.filter((id) => !followsCamera(id))

interface ReplayHarness extends Harness {
  /** Every model the loop built: [0] is the live one, then one per replay. */
  models: FakeRaceModel[]
}

function setupReplay(): ReplayHarness {
  const models: FakeRaceModel[] = []
  const h = setup('iracing', {}, () => {
    const model = new FakeRaceModel()
    model.view.sessionKey = `k${models.length + 1}`
    models.push(model)
    return model
  })
  h.source.sessionRaw = { name: 'S1', type: 'Race' }
  h.source.frame = LIVE
  return Object.assign(h, { models })
}

function model(h: ReplayHarness, i: number): FakeRaceModel {
  const m = h.models[i]
  if (!m) throw new Error(`no model ${i}`)
  return m
}

describe('TelemetryLoop replays', () => {
  it('times a replay with a model of its own; the live one keeps its history and resumes', async () => {
    const h = setupReplay()
    await h.run(1 + 3)
    expect(h.models).toHaveLength(1)
    const live = model(h, 0)
    h.source.frame = REPLAY
    await h.run(4)
    const replay = model(h, 1)
    expect(live.updates).toHaveLength(3)
    // Nothing timed across the replay, nothing forgotten either.
    expect(live.breaks).toBe(1)
    expect(live.resets).toBe(0)
    expect(replay.updates.map((u) => u.frame)).toEqual([REPLAY, REPLAY, REPLAY, REPLAY])
    // The widgets that follow the camera read the replay's timing, from no previous payload.
    expect(h.calls.relative.at(-1)?.ctx.race).toBe(replay.view)
    expect(h.calls.relative.at(-1)?.prev).toBeNull()

    h.source.frame = LIVE
    await h.run(2)
    expect(live.updates).toHaveLength(5)
    expect(replay.updates).toHaveLength(4)
    expect(h.calls.relative.at(-1)?.ctx.race).toBe(live.view)
    expect(h.calls.relative.at(-1)?.prev).toBeNull()
    // The same session all along: the providers keep their state (the delta's optimal laps).
    expect(h.providerResets()).toBe(1)

    // The next replay starts from nothing.
    h.source.frame = REPLAY
    await h.run(1)
    expect(h.models).toHaveLength(3)
    expect(live.breaks).toBe(2)
    expect(h.logs()).toEqual([])
  })

  it('hides the widgets with only your live data while it plays, and computes them again after', async () => {
    const h = setupReplay()
    await h.run(1 + 2)
    const deltaRuns = h.calls.delta.length
    h.source.frame = REPLAY
    await h.run(5)
    expect(autoHidden(h)).toEqual(
      LIVE_ONLY.map((widget) => ({
        type: 'auto-hidden',
        widget,
        hidden: true,
        reason: 'replay-player'
      }))
    )
    // Not computed at all on replay frames (the rule runs before the providers).
    expect(h.calls.radar).toHaveLength(2)
    expect(h.calls.delta).toHaveLength(deltaRuns)
    h.source.frame = LIVE
    await h.run(1)
    expect(autoHidden(h).slice(LIVE_ONLY.length)).toEqual(
      LIVE_ONLY.map((widget) => ({ type: 'auto-hidden', widget, hidden: false, reason: null }))
    )
    expect(h.calls.radar).toHaveLength(3)
    expect(h.calls.radar.at(-1)?.prev).toBeNull()
  })

  it('hides and computes nothing in a replay when replays are set to hide', async () => {
    const h = setupReplay()
    const config = defaultTelemetryConfig()
    config.visibility = { ...config.visibility, replays: 'hide' }
    h.loop.setConfig(config)
    await h.run(1 + 1)
    const before = h.calls.relative.length
    h.source.frame = REPLAY
    await h.run(10)
    expect(autoHidden(h)).toEqual(
      WIDGET_IDS.map((widget) => ({ type: 'auto-hidden', widget, hidden: true, reason: 'replay' }))
    )
    expect(h.calls.relative).toHaveLength(before)
  })

  it('offers no lap of a replay as a personal best and keeps the car + layout being driven', async () => {
    const live = new LapsModel()
    const replay = new LapsModel()
    // A clean lap in the replay's timing, the camera on another car.
    replay.last = lastLap(15, 90)
    Object.assign(replay.view, { playerCarIdx: 4 })
    const models = [live, replay]
    const offers: string[] = []
    const targets: (PersonalBestTarget | null)[] = []
    const h = setup('iracing', {}, () => models.shift() ?? new LapsModel(), {
      bests: {
        get: () => null,
        offer: (key) => {
          offers.push(key)
          return true
        }
      },
      onPersonalBestTarget: (t) => targets.push(t),
      parseSession: (raw) => ({
        ...session((raw as { name: string }).name, 'Practice'),
        drivers: new Map([
          [0, pbDriver(67)],
          [4, { ...pbDriver(68), carIdx: 4 }]
        ]),
        trackId: 219,
        trackConfig: 'Grand Prix'
      })
    })
    h.source.frame = playerFrame({ IsOnTrack: [true] })
    await h.run(1 + 2)
    expect(targets.map((t) => t?.key)).toEqual(['67@219/Grand Prix'])
    h.source.frame = { ...REPLAY, IsOnTrack: [true] }
    await h.run(Math.ceil(40_000 / TICK_MS))
    h.source.frame = playerFrame({ IsOnTrack: [true] })
    await h.run(Math.ceil(40_000 / TICK_MS))
    expect(offers).toEqual([])
    expect(targets.map((t) => t?.key)).toEqual(['67@219/Grand Prix'])
  })

  it('leaves the replay widgets an empty view when its model cannot be built, logged once', async () => {
    let built = 0
    const h = setup('iracing', {}, () => {
      if (built++ === 0) return new FakeRaceModel()
      throw new Error('no replay model')
    })
    h.source.sessionRaw = { name: 'S1', type: 'Race' }
    h.source.frame = LIVE
    await h.run(1 + 1)
    h.source.frame = REPLAY
    await h.run(20)
    expect(built).toBe(2)
    expect(h.logs()).toEqual([
      { type: 'log', level: 'error', message: 'Replay model unavailable: no replay model' }
    ])
    expect(h.calls.relative.at(-1)?.ctx.race.cars()).toEqual([])
  })

  it('forgets a replay when the connection drops: the next live frames go to the live model', async () => {
    const h = setupReplay()
    await h.run(1 + 1)
    h.source.frame = REPLAY
    await h.run(2)
    h.source.alive = false
    await h.run(1)
    h.source.frame = LIVE
    await h.run(1 + 2)
    const live = model(h, 0)
    expect(live.updates.map((u) => u.frame)).toEqual([LIVE, LIVE, LIVE])
    expect(h.calls.relative.at(-1)?.ctx.race).toBe(live.view)
  })
})
