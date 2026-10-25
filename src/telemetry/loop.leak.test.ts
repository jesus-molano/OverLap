import { setFlagsFromString } from 'node:v8'
import { runInNewContext } from 'node:vm'
import { describe, it, expect, vi } from 'vitest'
import type { TelemetryFrame } from '@shared/telemetry'
import { TelemetryLoop } from './loop'
import type { TelemetrySource } from './sources/TelemetrySource'

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
  }
}))

/** The process-wide gc() even without --expose-gc, or null if V8 refuses. */
function exposeGc(): (() => void) | null {
  try {
    setFlagsFromString('--expose-gc')
    const gc: unknown = runInNewContext('gc')
    return typeof gc === 'function' ? (gc as () => void) : null
  } catch {
    return null
  }
}

/** iRacing closed: every connect() resolves false. */
const closedSim: TelemetrySource = {
  kind: 'iracing',
  connect: () => Promise.resolve(false),
  disconnect: () => {},
  isConnected: () => false,
  waitForTick: () => false,
  readFrame: () => ({}) as TelemetryFrame,
  sessionInfoVersion: () => -1,
  readSessionInfo: () => null
}

describe('TelemetryLoop retries', () => {
  it('keeps no per-retry state across hours of failed connects', async () => {
    const gc = exposeGc()
    const WARMUP = 2_000
    const RETRIES = 60_000
    let iteration = 0
    let sleeps = 0
    let pendingWakers = 0
    let heapBefore = 0
    let heapAfter = 0

    const loop = new TelemetryLoop(closedSim, () => {}, {
      sleep: () => {
        sleeps++
        return Promise.resolve()
      },
      yieldToEventLoop: () => {
        iteration++
        // Between waits nothing may stay registered for stop().
        if ((loop as unknown as { wakeOnStop: unknown }).wakeOnStop !== null) pendingWakers++
        if (gc && (iteration === WARMUP || iteration === WARMUP + RETRIES)) {
          gc()
          const used = process.memoryUsage().heapUsed
          if (iteration === WARMUP) heapBefore = used
          else heapAfter = used
        }
        if (iteration >= WARMUP + RETRIES) loop.stop()
        return Promise.resolve()
      }
    })
    await loop.start()

    expect(sleeps).toBe(WARMUP + RETRIES)
    expect(pendingWakers).toBe(0)
    // The old Promise.race against a never-settling promise kept ~300 B per retry (~18 MB here).
    if (gc) expect(heapAfter - heapBefore).toBeLessThan(3 * 1024 * 1024)
  })
})
