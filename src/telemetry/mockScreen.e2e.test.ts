/**
 * End to end without Electron: the mock series with its screen moments (MockScreen: the
 * iRacing UI hidden, the garage, the session screen, a replay at its live point and on the
 * tape) through the real TelemetryLoop, RaceModel and
 * providers, against the same series without them.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { LapReference, PersonalBestStore } from '@shared/delta/references'
import type { TelemetryOutMessage } from '@shared/ipc'
import type { TelemetryFrame } from '@shared/telemetry'
import type { HiddenReason, VisibilityOptions, WidgetPayloads } from '@shared/types'
import { WIDGET_IDS, followsCamera, keepsLiveInReplay, type WidgetId } from '@shared/widgets'
import { TelemetryLoop, defaultTelemetryConfig } from './loop'
import { MOCK_SCREEN_TIMELINE, MockScreen, MockSeries } from './mock/simulation'
import type { MockSessionInfo } from './mock/simulation'
import type { TelemetrySource } from './sources/TelemetrySource'

const TL = MOCK_SCREEN_TIMELINE
const DT_S = 1 / 30
/** Past the end of the player's lap that runs across the replay. */
const RUN_S = 330

/** The series stepped by one tick per waitForTick, its frames through the screen (or not). */
class ScreenSource implements TelemetrySource {
  readonly kind = 'mock'
  readonly series = new MockSeries()
  private readonly screen = new MockScreen()

  constructor(
    private readonly withScreen: boolean,
    private readonly clock: { ms: number },
    private readonly done: () => boolean
  ) {}

  connect(): Promise<boolean> {
    return Promise.resolve(true)
  }

  disconnect(): void {
    // Nothing to release.
  }

  isConnected(): boolean {
    return true
  }

  waitForTick(): boolean {
    if (this.done()) return false
    this.series.step(DT_S)
    this.clock.ms += DT_S * 1000
    return true
  }

  readFrame(): TelemetryFrame {
    const live = this.series.frame()
    return this.withScreen ? this.screen.frame(live, this.series.current) : live
  }

  sessionInfoVersion(): number {
    return this.series.sessionInfoVersion
  }

  readSessionInfo(): MockSessionInfo {
    return this.series.sessionInfo()
  }
}

interface Hidden {
  s: number
  widget: WidgetId
  reason: HiddenReason | null
}
type Sent<K extends WidgetId> = { s: number; payload: WidgetPayloads[K] }

interface Run {
  source: ScreenSource
  hidden: Hidden[]
  relative: Sent<'relative'>[]
  standings: Sent<'standings'>[]
  delta: Sent<'delta'>[]
  offers: LapReference[]
  logs: string[]
}

/**
 * The series through the loop for `runS` session seconds, with replays following the camera
 * unless `visibility` says otherwise (the default hides them).
 */
async function runLoop(
  withScreen: boolean,
  visibility: Partial<VisibilityOptions> = { replays: 'follow' },
  runS = RUN_S
): Promise<Run> {
  const clock = { ms: 0 }
  const start = new MockSeries().sessionTime
  const run: Run = {
    source: null as unknown as ScreenSource,
    hidden: [],
    relative: [],
    standings: [],
    delta: [],
    offers: [],
    logs: []
  }
  const source = new ScreenSource(withScreen, clock, () => s() >= runS)
  run.source = source
  const s = (): number => source.series.sessionTime - start
  const bests: PersonalBestStore = {
    get: () => null,
    offer: (_key, lap) => {
      run.offers.push(lap)
      return true
    }
  }
  const emit = (msg: TelemetryOutMessage): void => {
    if (msg.type === 'log') run.logs.push(`${msg.level}: ${msg.message}`)
    if (msg.type === 'auto-hidden')
      run.hidden.push({ s: s(), widget: msg.widget, reason: msg.reason })
    if (msg.type !== 'data') return
    if (msg.widget === 'relative') run.relative.push({ s: s(), payload: msg.payload })
    else if (msg.widget === 'standings') run.standings.push({ s: s(), payload: msg.payload })
    else if (msg.widget === 'delta') run.delta.push({ s: s(), payload: msg.payload })
  }
  let stopped = false
  const loop: TelemetryLoop = new TelemetryLoop(source, emit, {
    now: () => clock.ms,
    sleep: () => Promise.resolve(),
    yieldToEventLoop: () => {
      if (!stopped && s() >= runS) {
        stopped = true
        loop.stop()
      }
      return Promise.resolve()
    },
    bests
  })
  const config = defaultTelemetryConfig()
  config.visibility = { ...config.visibility, ...visibility }
  loop.setConfig(config)
  await loop.start()
  return run
}

/** The widgets' reasons as changes, merged per moment: [s rounded, reason, widgets]. */
function moments(hidden: readonly Hidden[]): [number, string, WidgetId[]][] {
  const out: [number, string, WidgetId[]][] = []
  for (const h of hidden) {
    const at = Math.round(h.s)
    const reason = h.reason ?? 'shown'
    const last = out.at(-1)
    if (last && last[0] === at && last[1] === reason) last[2].push(h.widget)
    else out.push([at, reason, [h.widget]])
  }
  return out
}

describe('mock screen end to end: UI hidden, garage, session screen and a replay', () => {
  let screen: Run
  let plain: Run
  /** The defaults (replays hidden), until just after the replay. */
  let defaults: Run
  beforeAll(async () => {
    screen = await runLoop(true)
    plain = await runLoop(false)
    defaults = await runLoop(true, {}, TL.replay.atS + TL.replay.lengthS + 2)
  }, 45_000)

  const LIVE_ONLY = WIDGET_IDS.filter((id) => !followsCamera(id))
  const OFF_TAPE = WIDGET_IDS.filter((id) => !keepsLiveInReplay(id))
  const NOT_KEPT = WIDGET_IDS.filter((id) => id !== 'standings')
  const tapeAt = TL.replay.atS + TL.replay.lengthS / 2
  const replayEnd = TL.replay.atS + TL.replay.lengthS
  const during = (from: number, to: number) => (x: { s: number }) => x.s > from && x.s < to
  type Row = WidgetPayloads['standings']['classes'][number]['rows'][number]
  const rows = (x: Sent<'standings'> | undefined): Row[] =>
    x?.payload.classes.flatMap((c) => c.rows) ?? []

  it('runs without errors, and without the screen nothing is ever hidden in a race', () => {
    expect(screen.logs).toEqual([])
    expect(plain.logs).toEqual([])
    expect(defaults.logs).toEqual([])
    expect(plain.hidden).toEqual([])
  })

  it('with the defaults, in the car all along: the session screen, then the whole replay hidden', () => {
    expect(moments(defaults.hidden)).toEqual([
      [TL.uiHidden[0], 'ui-hidden', WIDGET_IDS],
      [TL.uiHidden[1], 'shown', WIDGET_IDS],
      [TL.garage[0], 'garage', WIDGET_IDS],
      [TL.garage[1], 'shown', WIDGET_IDS],
      [TL.sessionScreen[0], 'session-screen', NOT_KEPT],
      [TL.sessionScreen[1], 'shown', NOT_KEPT],
      // The live point on another car, from the car: live, it follows the camera.
      [TL.replay.atS, 'camera-other', LIVE_ONLY],
      [tapeAt, 'replay', WIDGET_IDS],
      [replayEnd, 'shown', WIDGET_IDS]
    ])
    // Nothing computed on the tape, not even the standings.
    expect(defaults.standings.filter(during(tapeAt + 0.1, replayEnd - 0.1))).toEqual([])
  })

  it('hides with the UI, in the garage, on the session screen, for another car and on the tape', () => {
    expect(moments(screen.hidden)).toEqual([
      [TL.uiHidden[0], 'ui-hidden', WIDGET_IDS],
      [TL.uiHidden[1], 'shown', WIDGET_IDS],
      [TL.garage[0], 'garage', WIDGET_IDS],
      [TL.garage[1], 'shown', WIDGET_IDS],
      // The standings stay on the session screen (the results).
      [TL.sessionScreen[0], 'session-screen', NOT_KEPT],
      [TL.sessionScreen[1], 'shown', NOT_KEPT],
      [TL.replay.atS, 'camera-other', LIVE_ONLY],
      [tapeAt, 'replay-player', OFF_TAPE],
      [replayEnd, 'shown', OFF_TAPE]
    ])
  })

  it('keeps the standings live on the session screen: the same table as without it (Q1)', () => {
    const onScreen = screen.standings.filter(during(TL.sessionScreen[0], TL.sessionScreen[1]))
    expect(onScreen.length).toBeGreaterThan(5)
    for (const x of onScreen) {
      // The last table the plain run sent by then (unchanged ones are not sent).
      const then = plain.standings.filter((p) => p.s <= x.s + 1e-6).at(-1)
      expect(x.payload).toEqual(then?.payload)
    }
  })

  it('centres the relative and the standings on the car on camera at the live point', () => {
    const cast = screen.source.series.current.cast
    const player = screen.source.series.current.playerCarIdx
    const focus = (p: WidgetPayloads['relative']): number => p.rows[p.playerRow]?.carIdx ?? -1
    const watching = screen.relative.filter(during(TL.replay.atS + 0.2, tapeAt - 0.2))
    expect(watching.length).toBeGreaterThan(20)
    expect(new Set(watching.map((x) => focus(x.payload)))).toEqual(new Set([cast.battleAhead]))
    // Nothing of the relative while the tape plays: it only shows live data.
    expect(screen.relative.filter(during(tapeAt + 0.2, replayEnd - 0.2))).toEqual([])
    const standings = screen.standings.filter(during(TL.replay.atS + 0.5, tapeAt - 0.5))
    expect(standings.length).toBeGreaterThan(5)
    for (const { payload } of standings) {
      const me = payload.classes[0]?.rows.find((r) => r.isPlayer)
      expect(me?.carIdx).toBe(cast.battleAhead)
      // The SR line is yours: not shown for another car.
      expect(payload.header.safetyRating).toBeNull()
    }
    // Live again: you, with your SR.
    const after = screen.standings.find((x) => x.s > replayEnd + 0.5)
    expect(after?.payload.classes[0]?.rows.find((r) => r.isPlayer)?.carIdx).toBe(player)
    expect(after?.payload.header.safetyRating).not.toBeNull()
  })

  it('keeps the live stops and stints through the replay: one live model, never the tape (Q1)', () => {
    const live = rows(screen.standings.filter((x) => x.s < TL.replay.atS).at(-1))
    const stopped = live.filter((r) => (r.pitStops ?? 0) > 0)
    expect(stopped.length).toBeGreaterThan(0)
    const replay = screen.standings.filter(during(TL.replay.atS, replayEnd))
    expect(replay.length).toBeGreaterThan(10)
    for (const x of replay) for (const r of rows(x)) expect(r.pitStops).not.toBeNull()
    const seen = replay.flatMap((x) => rows(x))
    for (const r of stopped) {
      expect(seen.find((b) => b.carIdx === r.carIdx)?.pitStops).toBeGreaterThanOrEqual(
        r.pitStops ?? 0
      )
    }
    // On the tape the standings are the live race as it was: sent once, then unchanged.
    const tape = screen.standings.filter(during(tapeAt - 0.1, replayEnd))
    expect(tape).toHaveLength(1)
    const relative = screen.relative.filter(during(TL.replay.atS + 0.5, tapeAt))
    expect(relative.some((x) => x.payload.rows.some((r) => r.stintLaps !== null))).toBe(true)
  })

  it('keeps the live timing through the replay: the delta is back at once with a reference', () => {
    const before = screen.delta.filter((x) => x.s < TL.replay.atS).at(-1)?.payload
    expect(before?.visible).toBe(true)
    const back = screen.delta.find((x) => x.s >= replayEnd)
    expect(back?.s).toBeLessThan(replayEnd + 0.2)
    expect(back?.payload.visible).toBe(true)
    expect(back?.payload.reference).toBe(before?.reference)
    // The lap the tape cut is not timed: the delta may pick its reference afresh, never none.
    expect(back?.payload.refLapTime).toBeGreaterThan(0)
  })

  it('records no lap from the tape, and does not time the lap it cut across', () => {
    expect(plain.offers.length).toBeGreaterThan(0)
    const times = (r: Run): number[] => r.offers.map((l) => l.lapTime)
    // Every lap offered is one the plain run offered too; the one across the tape is not.
    for (const t of times(screen)) expect(times(plain)).toContain(t)
    expect(times(screen).length).toBe(times(plain).length - 1)
  })
})
