/**
 * The real TelemetryLoop and RaceModel across frames the model does not see: a replay of the
 * tape and a reconnect, each spanning the S/F line, against the same race seen without them.
 */
import { describe, expect, it } from 'vitest'
import { RaceModel } from '@shared/race/raceModel'
import { LAP_S, V, makeFrame, makeSession } from '@shared/race/testing/raceSim'
import { TrackLocation } from '@shared/telemetry'
import type { TelemetryFrame } from '@shared/telemetry'
import { TelemetryLoop } from './loop'
import type { TelemetrySource } from './sources/TelemetrySource'

const TICK_MS = 1000 / 60
/** SessionTime at clock 0. */
const T_START = 100
const END_S = 60
/** Cars 0 and 1 cross the line at about 18 s and 12 s (and again a lap later). */
const at = (t: number): number[] => [3.4 + V * (t - T_START), 2.6 + V * (t - T_START)]

type Gap = 'none' | 'tape' | 'reconnect'
/** [from, to) in seconds of the run: both cars cross the line in it. */
const GAP: readonly [number, number] = [8, 24]

/** Every tick a new frame (the loop keeps the last live one while the tape plays). */
function frameAt(t: number, tape: boolean): TelemetryFrame {
  const f = makeFrame()
  // The tape plays what was live 20 s earlier, far from its end.
  const shown = tape ? t - 20 : t
  f.SessionTime[0] = shown
  f.IsReplayPlaying[0] = tape
  f.ReplayFrameNumEnd[0] = tape ? 1200 : 0
  at(shown).forEach((d, i) => {
    f.CarIdxLapDistPct[i] = Math.fround(d - Math.floor(d))
    f.CarIdxLapCompleted[i] = Math.floor(d)
    f.CarIdxTrackSurface[i] = TrackLocation.OnTrack
  })
  return f as TelemetryFrame
}

class ScriptedRace implements TelemetrySource {
  readonly kind = 'iracing'
  private connected = false

  constructor(
    private readonly gap: Gap,
    private readonly clock: { ms: number }
  ) {}

  private get s(): number {
    return this.clock.ms / 1000
  }

  private inGap(): boolean {
    return this.s >= GAP[0] && this.s < GAP[1]
  }

  connect(): Promise<boolean> {
    this.connected = !(this.gap === 'reconnect' && this.inGap())
    return Promise.resolve(this.connected)
  }

  disconnect(): void {
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected
  }

  waitForTick(): boolean {
    if (this.gap === 'reconnect' && this.inGap()) this.connected = false
    this.clock.ms += TICK_MS
    return this.connected
  }

  readFrame(): TelemetryFrame {
    return frameAt(T_START + this.s, this.gap === 'tape' && this.inGap())
  }

  sessionInfoVersion(): number {
    return 1
  }

  readSessionInfo(): unknown {
    return {}
  }
}

async function stintsAfter(gap: Gap): Promise<(number | undefined)[]> {
  const clock = { ms: 0 }
  const model = new RaceModel()
  const logs: string[] = []
  let drops = 0
  const loop: TelemetryLoop = new TelemetryLoop(
    new ScriptedRace(gap, clock),
    (msg) => {
      if (msg.type === 'log') logs.push(msg.message)
      if (msg.type === 'status' && msg.status.state === 'waiting' && clock.ms > 0) drops++
    },
    {
      now: () => clock.ms,
      sleep: (ms) => {
        clock.ms += ms
        return Promise.resolve()
      },
      yieldToEventLoop: () => {
        if (clock.ms >= END_S * 1000) loop.stop()
        return Promise.resolve()
      },
      parseSession: () => makeSession(2),
      createRaceModel: () => model
    }
  )
  await loop.start()
  expect(logs).toEqual([])
  expect(drops > 0).toBe(gap === 'reconnect')
  return [0, 1].map((i) => model.view.car(i)?.stintLaps)
}

describe('TelemetryLoop and the race model across a replay or a reconnect', () => {
  it('keeps the stint laps driven while the tape played or the sim was away', async () => {
    const plain = await stintsAfter('none')
    // Joined mid-race: every stint is the race so far, 60 s = 2 laps on.
    expect(plain).toEqual([Math.floor(3.4 + END_S / LAP_S), Math.floor(2.6 + END_S / LAP_S)])
    expect(await stintsAfter('tape')).toEqual(plain)
    expect(await stintsAfter('reconnect')).toEqual(plain)
  })
})
