import type { TelemetryFrame } from '@shared/telemetry'
import { MockSeries } from '../mock/simulation'
import type { MockSessionInfo } from '../mock/simulation'
import type { TelemetrySource } from './TelemetrySource'

const TICK_MS = 1000 / 60
/** Longer gaps (debugger pause, sleep) do not fast-forward the race. */
const MAX_STEP_S = 0.25
/**
 * Windows rounds Atomics.wait up to whole ~15.6 ms timer quanta, so a 16 ms
 * wait costs two (~32 Hz). Waiting at most one quantum keeps it near 60 Hz.
 */
const MAX_WAIT_MS = 15
/** Less than this left until the next tick: return it now rather than wait a whole quantum. */
const MIN_WAIT_MS = 1
/** Longest simulated step: a fast-forwarded tick is split so pit stops and lap timing stay exact. */
const MAX_SUBSTEP_S = 0.1
export const MOCK_SPEED_MIN = 1
export const MOCK_SPEED_MAX = 20

/**
 * Time scale of the mock race from the OVERLAY_MOCK_SPEED env var, for
 * development and screenshots (laps, gaps and stints go by faster), e.g.
 * `cross-env OVERLAY_SOURCE=mock OVERLAY_MOCK_SPEED=10 electron-vite dev`.
 * A number from 1 to 20, clamped; missing or not a number means 1 (real time).
 */
export function parseMockSpeed(raw: string | undefined): number {
  const text = raw?.trim() ?? ''
  return clampSpeed(text === '' ? Number.NaN : Number(text))
}

function clampSpeed(n: number): number {
  return Number.isFinite(n) ? Math.min(MOCK_SPEED_MAX, Math.max(MOCK_SPEED_MIN, n)) : MOCK_SPEED_MIN
}

export interface MockSourceOptions {
  seed?: number
  /** Simulated seconds per real second; defaults to OVERLAY_MOCK_SPEED (see parseMockSpeed). */
  speed?: number
}

/**
 * Simulated races (OVERLAY_SOURCE=mock): no iRacing, no native addon. Session
 * after session: each new one bumps sessionInfoVersion (new SubSessionID).
 */
export class MockSource implements TelemetrySource {
  readonly kind = 'mock'
  /** Simulated seconds per real second (1..20). */
  readonly speed: number
  private readonly series: MockSeries
  private connected = false
  private lastTickMs = 0
  /**
   * Atomics.wait target, never notified: it is only a synchronous sleep.
   * Blocking here mimics irsdk's waitForData, so the telemetry loop is the
   * same for both sources. Node (and so an Electron utility process) allows
   * Atomics.wait on its main thread, unlike browsers.
   */
  private readonly sleepCell = new Int32Array(new SharedArrayBuffer(4))

  constructor(opts: MockSourceOptions = {}) {
    this.series = new MockSeries({ seed: opts.seed })
    // Read here, so index.ts needs no new plumbing.
    this.speed =
      opts.speed === undefined
        ? parseMockSpeed(process.env.OVERLAY_MOCK_SPEED)
        : clampSpeed(opts.speed)
  }

  connect(): Promise<boolean> {
    this.connected = true
    this.lastTickMs = performance.now()
    return Promise.resolve(true)
  }

  disconnect(): void {
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected
  }

  waitForTick(timeoutMs: number): boolean {
    if (!this.connected) return false
    const remaining = this.lastTickMs + TICK_MS - performance.now()
    if (remaining > MIN_WAIT_MS) {
      Atomics.wait(this.sleepCell, 0, 0, Math.min(remaining, MAX_WAIT_MS, timeoutMs))
    }
    // The race advances by real elapsed time, whatever the wait actually took.
    const now = performance.now()
    let left = Math.min((now - this.lastTickMs) / 1000, MAX_STEP_S) * this.speed
    while (left > 1e-9) {
      const dt = Math.min(left, MAX_SUBSTEP_S)
      this.series.step(dt)
      left -= dt
    }
    this.lastTickMs = now
    return true
  }

  readFrame(): TelemetryFrame {
    return this.series.frame()
  }

  sessionInfoVersion(): number {
    return this.series.sessionInfoVersion
  }

  readSessionInfo(): MockSessionInfo {
    return this.series.sessionInfo()
  }
}
