/**
 * Back-to-back mock sessions: when a session's cool-down ends, the next one
 * starts (new SubSessionID, new seed, the same drivers in other CarIdx, the
 * clock back at ~40 min), so long runs go through the finish and the reset
 * paths again and again. Holds one MockRace at a time.
 */
import type { TelemetryFrame } from '@shared/telemetry'
import { DEFAULT_PLAYER_CAR_IDX, MOCK_DRIVERS, rosterForSession, seatOf } from './drivers'
import { MockRace } from './race'
import type { MockSessionInfo } from './sessionInfo'

export interface MockSeriesOptions {
  /** Seed of the first session; session n uses seed + n. Default 1. */
  seed?: number
  /** The player's CarIdx in the first session (the same driver races every session). Default 7. */
  playerCarIdx?: number
}

export class MockSeries {
  private race: MockRace
  private index = 0
  private readonly seed: number
  private readonly playerUserId: number

  constructor(opts: MockSeriesOptions = {}) {
    this.seed = opts.seed ?? 1
    this.race = new MockRace({ seed: this.seed, playerCarIdx: opts.playerCarIdx })
    const first = opts.playerCarIdx ?? DEFAULT_PLAYER_CAR_IDX
    this.playerUserId = MOCK_DRIVERS.find((d) => d.carIdx === first)?.userId ?? -1
  }

  /** The session running now. */
  get current(): MockRace {
    return this.race
  }

  /** 0-based number of the session running now. */
  get sessionIndex(): number {
    return this.index
  }

  /** Changes with every new session (the YAML changes with it). Starts at 1. */
  get sessionInfoVersion(): number {
    return this.index + 1
  }

  get sessionTime(): number {
    return this.race.sessionTime
  }

  step(dtS: number): void {
    this.race.step(dtS)
    if (this.race.done) this.next()
  }

  frame(): TelemetryFrame {
    return this.race.frame()
  }

  sessionInfo(): MockSessionInfo {
    return this.race.sessionInfo()
  }

  private next(): void {
    this.index++
    this.race = new MockRace({
      seed: this.seed + this.index,
      sessionIndex: this.index,
      playerCarIdx: seatOf(rosterForSession(this.index), this.playerUserId)
    })
  }
}
