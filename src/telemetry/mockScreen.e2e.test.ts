/**
 * End to end without Electron: the mock series with its screen moments (MockScreen: the
 * iRacing UI hidden, the garage, a replay) through the real TelemetryLoop, RaceModel and
 * providers, against the same series without them.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { LapReference, PersonalBestStore } from '@shared/delta/references'
import type { TelemetryOutMessage } from '@shared/ipc'
import type { TelemetryFrame } from '@shared/telemetry'
import type { HiddenReason, WidgetPayloads } from '@shared/types'
import { WIDGET_IDS, followsCamera, type WidgetId } from '@shared/widgets'
import { TelemetryLoop } from './loop'
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

async function runLoop(withScreen: boolean): Promise<Run> {
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
  const source = new ScreenSource(withScreen, clock, () => s() >= RUN_S)
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
      if (!stopped && s() >= RUN_S) {
        stopped = true
        loop.stop()
      }
      return Promise.resolve()
    },
    bests
  })
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

describe('mock screen end to end: UI hidden, garage and a replay', () => {
  let screen: Run
  let plain: Run
  beforeAll(async () => {
    screen = await runLoop(true)
    plain = await runLoop(false)
  }, 30_000)

  const LIVE_ONLY = WIDGET_IDS.filter((id) => !followsCamera(id))
  const replayEnd = TL.replay.atS + TL.replay.lengthS

  it('runs without errors, and without the screen nothing is ever hidden in a race', () => {
    expect(screen.logs).toEqual([])
    expect(plain.logs).toEqual([])
    expect(plain.hidden).toEqual([])
  })

  it('hides every widget with the UI and in the garage, the live-only ones in the replay', () => {
    expect(moments(screen.hidden)).toEqual([
      [TL.uiHidden[0], 'ui-hidden', WIDGET_IDS],
      [TL.uiHidden[1], 'shown', WIDGET_IDS],
      [TL.garage[0], 'garage', WIDGET_IDS],
      [TL.garage[1], 'shown', WIDGET_IDS],
      [TL.replay.atS, 'replay-player', LIVE_ONLY],
      [replayEnd, 'shown', LIVE_ONLY]
    ])
  })

  it('centres the relative and the standings on the car on camera during the replay', () => {
    const cast = screen.source.series.current.cast
    const player = screen.source.series.current.playerCarIdx
    const half = TL.replay.atS + TL.replay.lengthS / 2
    const during = (from: number, to: number) => (x: { s: number }) => x.s > from && x.s < to
    const focus = (p: WidgetPayloads['relative']): number => p.rows[p.playerRow]?.carIdx ?? -1
    const firstHalf = screen.relative.filter(during(TL.replay.atS + 0.2, half - 0.2))
    expect(firstHalf.length).toBeGreaterThan(20)
    expect(new Set(firstHalf.map((x) => focus(x.payload)))).toEqual(new Set([cast.battleAhead]))
    const secondHalf = screen.relative.filter(during(half + 0.2, replayEnd - 0.2))
    expect(new Set(secondHalf.map((x) => focus(x.payload)))).toEqual(new Set([player]))
    const standings = screen.standings.filter(during(TL.replay.atS + 0.5, half - 0.5))
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

  it('keeps the live timing through the replay: the delta is back at once with its reference', () => {
    const before = screen.delta.filter((x) => x.s < TL.replay.atS).at(-1)?.payload
    expect(before?.visible).toBe(true)
    const back = screen.delta.find((x) => x.s >= replayEnd)
    expect(back?.s).toBeLessThan(replayEnd + 0.2)
    expect(back?.payload.visible).toBe(true)
    expect(back?.payload.reference).toBe(before?.reference)
    expect(back?.payload.refLapTime).toBe(before?.refLapTime)
  })

  it('records no lap from the replay, and does not time the lap it cut across', () => {
    expect(plain.offers.length).toBeGreaterThan(0)
    const times = (r: Run): number[] => r.offers.map((l) => l.lapTime)
    // Every lap offered is one the plain run offered too; the one across the replay is not.
    for (const t of times(screen)) expect(times(plain)).toContain(t)
    expect(times(screen).length).toBe(times(plain).length - 1)
  })
})
