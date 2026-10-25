import { describe, expect, it } from 'vitest'
import { cameraCarIdx, isGarageVisible, isReplayPlaying, isSimUiHidden } from '@shared/simScreen'
import { makeFrame } from '@shared/race/testing/raceSim'
import type { TelemetryFrame } from '@shared/telemetry'
import { START_SESSION_TIME_S } from './constants'
import { MOCK_SCREEN_TIMELINE, MockScreen, MockSeries } from './simulation'
import type { MockScreenRace } from './simulation'

const TL = MOCK_SCREEN_TIMELINE
const DT = 0.05
const RUN_S = TL.replay.atS + TL.replay.lengthS + 5

/** One output tick, reduced to what the tests read (whole frames would take ~30 MB). */
interface Tick {
  /** Seconds since the session started. */
  s: number
  same: boolean
  time: number
  replay: boolean
  ui: boolean
  garage: boolean
  cam: number
  /** CarIdxLapDistPct of the battle car ahead in the output, and live at that SessionTime. */
  pct: number
  livePctThen: number
}

function run(): { ticks: Tick[]; series: MockSeries } {
  const series = new MockSeries()
  const screen = new MockScreen()
  const battle = series.current.cast.battleAhead
  const livePct = new Map<number, number>()
  const ticks: Tick[] = []
  const key = (t: number): number => Math.round(t * 1000)
  for (let s = 0; s < RUN_S; s += DT) {
    series.step(DT)
    const live = series.frame()
    livePct.set(key(live.SessionTime[0] ?? NaN), live.CarIdxLapDistPct[battle] ?? NaN)
    const out = screen.frame(live, series.current)
    const time = out.SessionTime[0] ?? NaN
    ticks.push({
      s: series.sessionTime - START_SESSION_TIME_S,
      same: out === live,
      time,
      replay: isReplayPlaying(out),
      ui: isSimUiHidden(out),
      garage: isGarageVisible(out),
      cam: cameraCarIdx(out),
      pct: out.CarIdxLapDistPct[battle] ?? NaN,
      livePctThen: livePct.get(key(time)) ?? NaN
    })
  }
  return { ticks, series }
}

/** [first, last] s of the ticks where `pick` holds. */
function span(ticks: readonly Tick[], pick: (t: Tick) => boolean): [number, number] {
  const hits = ticks.filter(pick)
  return [hits[0]?.s ?? NaN, hits.at(-1)?.s ?? NaN]
}

describe('MockScreen', () => {
  const { ticks, series } = run()
  const cast = series.current.cast

  it('hands out the live frames themselves outside its moments', () => {
    const quiet = ticks.filter((t) => !t.replay && !t.ui && !t.garage)
    expect(quiet.every((t) => t.same)).toBe(true)
    expect(quiet.length).toBeGreaterThan(ticks.length * 0.8)
  })

  it('hides the iRacing UI, then opens the garage, at the timeline’s times', () => {
    const [uiFrom, uiTo] = span(ticks, (t) => t.ui)
    expect(uiFrom).toBeCloseTo(TL.uiHidden[0], 1)
    expect(uiTo).toBeCloseTo(TL.uiHidden[1] - DT, 1)
    const [gFrom, gTo] = span(ticks, (t) => t.garage)
    expect(gFrom).toBeCloseTo(TL.garage[0], 1)
    expect(gTo).toBeCloseTo(TL.garage[1] - DT, 1)
    // Never both, and never during the replay.
    expect(ticks.some((t) => t.ui && (t.garage || t.replay))).toBe(false)
  })

  it('plays back what was live rewindS earlier: the clock goes back, then jumps forward', () => {
    const replay = ticks.filter((t) => t.replay)
    const [from, to] = span(ticks, (t) => t.replay)
    expect(from).toBeCloseTo(TL.replay.atS, 1)
    expect(to).toBeCloseTo(TL.replay.atS + TL.replay.lengthS - DT, 1)
    for (const t of replay) {
      // Kept every 0.1 s: up to that much older than the exact moment.
      expect(t.s - TL.replay.rewindS - (t.time - START_SESSION_TIME_S)).toBeGreaterThanOrEqual(
        -1e-6
      )
      expect(t.s - TL.replay.rewindS - (t.time - START_SESSION_TIME_S)).toBeLessThan(0.1 + DT)
      // The cars are where they were then.
      expect(t.pct).toBe(t.livePctThen)
    }
    const i = ticks.findIndex((t) => t.replay)
    expect((ticks[i]?.time ?? NaN) - (ticks[i - 1]?.time ?? NaN)).toBeLessThan(
      -TL.replay.rewindS + 1
    )
    const j = ticks.findLastIndex((t) => t.replay)
    expect((ticks[j + 1]?.time ?? NaN) - (ticks[j]?.time ?? NaN)).toBeGreaterThan(
      TL.replay.rewindS - 1
    )
  })

  it('follows the battle car ahead for the first half, then the player', () => {
    const replay = ticks.filter((t) => t.replay)
    const half = TL.replay.atS + TL.replay.lengthS / 2
    expect(new Set(replay.filter((t) => t.s < half - DT).map((t) => t.cam))).toEqual(
      new Set([cast.battleAhead])
    )
    expect(new Set(replay.filter((t) => t.s > half + DT).map((t) => t.cam))).toEqual(
      new Set([series.current.playerCarIdx])
    )
    expect(cast.battleAhead).not.toBe(series.current.playerCarIdx)
  })

  it('is the same on every run', () => {
    expect(run().ticks).toEqual(ticks)
  })

  it('runs again in the next session, from that session’s own frames', () => {
    const screen = new MockScreen()
    const race = { sessionIndex: 0, sessionTime: 0, playerCarIdx: 3, cast: { battleAhead: 5 } }
    const at = (session: number, s: number, tag: number): TelemetryFrame => {
      const r: MockScreenRace = {
        ...race,
        sessionIndex: session,
        sessionTime: START_SESSION_TIME_S + s
      }
      const f = makeFrame()
      f.SessionTime[0] = tag
      return screen.frame(f, r)
    }
    for (let s = 150; s < TL.replay.atS; s += 1) at(0, s, s)
    expect(at(0, TL.replay.atS + 1, -1).SessionTime[0]).toBe(TL.replay.atS + 1 - TL.replay.rewindS)
    // A new session: nothing recorded yet, so its replay can only show its own frames.
    for (let s = 150; s < TL.replay.atS; s += 1) at(1, s, 1000 + s)
    const replay = at(1, TL.replay.atS + 1, -1)
    expect(replay.SessionTime[0]).toBe(1000 + TL.replay.atS + 1 - TL.replay.rewindS)
    expect(isReplayPlaying(replay)).toBe(true)
    expect(cameraCarIdx(replay)).toBe(5)
  })
})
