import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { SessionState } from '@shared/telemetry'
import { MOCK_SUBSESSION_ID, MockRace } from '../mock/simulation'
import { MOCK_SPEED_MAX, MockSource, parseMockSpeed } from './MockSource'

// Hermetic: a developer shell may have OVERLAY_MOCK_SPEED set.
beforeEach(() => {
  vi.stubEnv('OVERLAY_MOCK_SPEED', '')
})
afterEach(() => {
  vi.unstubAllEnvs()
})

/** Fake clock where Atomics.wait advances time like a timer with `quantumMs` resolution. */
function fakeTimers(quantumMs: number): { now: () => number; waits: number[] } {
  let t = 1000
  const waits: number[] = []
  vi.spyOn(performance, 'now').mockImplementation(() => t)
  vi.spyOn(Atomics, 'wait').mockImplementation((_cell, _index, _value, ms = 0) => {
    waits.push(ms)
    t += quantumMs > 0 ? Math.ceil(ms / quantumMs) * quantumMs : ms
    return 'timed-out'
  })
  return { now: () => t, waits }
}

async function rateHz(source: MockSource, now: () => number, ticks: number): Promise<number> {
  await source.connect()
  const start = now()
  for (let i = 0; i < ticks; i++) expect(source.waitForTick(16)).toBe(true)
  return ticks / ((now() - start) / 1000)
}

describe('MockSource', () => {
  it('stays near 60 Hz with Windows 15.6 ms timer quanta', async () => {
    const clock = fakeTimers(15.625)
    const hz = await rateHz(new MockSource({ seed: 1 }), clock.now, 120)
    // A 16 ms wait would round up to two quanta: ~32 Hz.
    expect(hz).toBeGreaterThan(55)
    expect(clock.waits.every((ms) => ms <= 15)).toBe(true)
  })

  it('never exceeds ~67 Hz with precise timers', async () => {
    const clock = fakeTimers(0)
    const hz = await rateHz(new MockSource({ seed: 1 }), clock.now, 120)
    expect(hz).toBeGreaterThan(55)
    expect(hz).toBeLessThanOrEqual(1000 / 15 + 0.01)
  })

  it('skips sub-millisecond waits and honours a shorter timeout', async () => {
    const clock = fakeTimers(0)
    const source = new MockSource({ seed: 1 })
    await source.connect()
    source.waitForTick(5)
    expect(clock.waits).toEqual([5])
    // A tick that took 16 ms to process leaves < 1 ms: no wait, a new tick at once.
    vi.mocked(performance.now).mockImplementation(() => clock.now() + 16)
    expect(source.waitForTick(16)).toBe(true)
    expect(clock.waits).toEqual([5])
  })

  it('advances the race by real elapsed time', async () => {
    const clock = fakeTimers(15.625)
    const source = new MockSource({ seed: 1 })
    await source.connect()
    const t0 = source.readFrame().SessionTime[0] ?? 0
    for (let i = 0; i < 64; i++) source.waitForTick(16)
    const t1 = source.readFrame().SessionTime[0] ?? 0
    expect(t1 - t0).toBeCloseTo(1, 6)
    expect(clock.now()).toBe(2000)
  })

  it('returns false without blocking when disconnected', () => {
    const clock = fakeTimers(15.625)
    const source = new MockSource({ seed: 1 })
    expect(source.waitForTick(16)).toBe(false)
    expect(clock.waits).toEqual([])
  })
})

describe('MockSource speed (OVERLAY_MOCK_SPEED)', () => {
  it('parses the factor, clamped to 1..20, real time otherwise', () => {
    expect(parseMockSpeed(undefined)).toBe(1)
    expect(parseMockSpeed('')).toBe(1)
    expect(parseMockSpeed('fast')).toBe(1)
    expect(parseMockSpeed('0')).toBe(1)
    expect(parseMockSpeed('-4')).toBe(1)
    expect(parseMockSpeed('0.5')).toBe(1)
    expect(parseMockSpeed(' 5 ')).toBe(5)
    expect(parseMockSpeed('7.5')).toBe(7.5)
    expect(parseMockSpeed('100')).toBe(MOCK_SPEED_MAX)
    expect(parseMockSpeed('Infinity')).toBe(1)
  })

  it('reads the env in the constructor; an explicit option wins, clamped too', () => {
    expect(new MockSource().speed).toBe(1)
    vi.stubEnv('OVERLAY_MOCK_SPEED', '5')
    expect(new MockSource().speed).toBe(5)
    vi.stubEnv('OVERLAY_MOCK_SPEED', '99')
    expect(new MockSource().speed).toBe(20)
    expect(new MockSource({ speed: 3 }).speed).toBe(3)
    expect(new MockSource({ speed: 0 }).speed).toBe(1)
    expect(new MockSource({ speed: Number.NaN }).speed).toBe(1)
  })

  it('scales the simulated time, split into short steps', async () => {
    vi.stubEnv('OVERLAY_MOCK_SPEED', '10')
    const clock = fakeTimers(15.625)
    const steps: number[] = []
    const step = MockRace.prototype.step
    vi.spyOn(MockRace.prototype, 'step').mockImplementation(function (this: MockRace, dt) {
      steps.push(dt)
      step.call(this, dt)
    })
    const source = new MockSource({ seed: 1 })
    await source.connect()
    const t0 = source.readFrame().SessionTime[0] ?? 0
    for (let i = 0; i < 64; i++) source.waitForTick(16)
    expect(clock.now()).toBe(2000)
    // 1 s of real time is 10 s of race.
    expect((source.readFrame().SessionTime[0] ?? 0) - t0).toBeCloseTo(10, 6)
    expect(Math.max(...steps)).toBeLessThanOrEqual(0.1 + 1e-12)
  })

  it('caps a long pause before scaling it', async () => {
    const clock = fakeTimers(0)
    const source = new MockSource({ seed: 1, speed: 4 })
    await source.connect()
    const t0 = source.readFrame().SessionTime[0] ?? 0
    // A 5 s debugger pause: at most 0.25 s of real time counts.
    vi.mocked(performance.now).mockImplementation(() => clock.now() + 5000)
    source.waitForTick(16)
    expect((source.readFrame().SessionTime[0] ?? 0) - t0).toBeCloseTo(1, 6)
  })
})

describe('MockSource sessions', () => {
  it('blocks until the next tick and steps the race (real timers)', async () => {
    const src = new MockSource({ seed: 3 })
    expect(src.kind).toBe('mock')
    expect(src.waitForTick(10)).toBe(false)
    expect(await src.connect()).toBe(true)
    expect(src.isConnected()).toBe(true)
    const t0 = src.readFrame().SessionTime[0] ?? 0
    // The first call returns at once when connecting took longer than a tick (a busy
    // machine running the whole suite); the next one must wait for its own tick.
    expect(src.waitForTick(100)).toBe(true)
    const start = performance.now()
    expect(src.waitForTick(100)).toBe(true)
    expect(performance.now() - start).toBeGreaterThanOrEqual(5)
    expect(src.readFrame().SessionTime[0] ?? 0).toBeGreaterThan(t0)
    expect(src.sessionInfoVersion()).toBe(1)
    expect(src.readSessionInfo().DriverInfo.PaceCarIdx).toBe(0)
    src.disconnect()
    expect(src.isConnected()).toBe(false)
    expect(src.waitForTick(10)).toBe(false)
  })

  it('starts a new session after the cool-down, with a new session info version', async () => {
    const clock = fakeTimers(0)
    const source = new MockSource({ seed: 1, speed: MOCK_SPEED_MAX })
    await source.connect()
    const startMs = clock.now()
    const states = new Set<number>()
    let ticks = 0
    while (source.sessionInfoVersion() === 1 && ticks < 20_000) {
      source.waitForTick(16)
      states.add(source.readFrame().SessionState[0] ?? -1)
      ticks++
    }
    expect(source.sessionInfoVersion()).toBe(2)
    expect([...states]).toEqual([
      SessionState.Racing,
      SessionState.Checkered,
      SessionState.CoolDown
    ])
    expect(source.readSessionInfo().WeekendInfo.SubSessionID).toBe(MOCK_SUBSESSION_ID + 1)
    expect(source.readFrame().SessionState[0]).toBe(SessionState.Racing)
    // ~45 min of race at 20x is a bit over 2 min of real time.
    const realS = (clock.now() - startMs) / 1000
    expect(realS).toBeGreaterThan(120)
    expect(realS).toBeLessThan(150)
  })
})
