/**
 * fix/edit-freeze, bug 2 ("the repair seconds take several seconds to go down one"): OverLap's own
 * pipeline for PitRepairLeft / PitOptRepairLeft, from a 60 Hz feed to the payloads that reach the
 * warning lights strip (the provider at its 10 Hz rate, SKIP_EMIT.lights deciding what is sent).
 * A value that falls at 1 s per second must reach the strip as one new whole second per second,
 * at most one provider period (100 ms) after iRacing crosses it; whatever pace iRacing's value has,
 * the strip follows it, so a slow countdown on screen is a slow PitRepairLeft.
 */
import { describe, expect, it } from 'vitest'
import { EngineWarning } from './flags'
import { LightsProvider } from './lights'
import { SKIP_EMIT } from './providers'
import { EMPTY_RACE_VIEW } from './race/emptyRaceView'
import { makeFrame, makeSession, type MutableFrame } from './race/testing/raceSim'
import { defaultOptions } from './settings'
import { TrackLocation } from './telemetry'
import type { LightsData, LightsOptions } from './types'

const HZ = 60
/** WIDGET_DEFS.lights.hz: the loop computes the strip every 6th tick of a 60 Hz feed. */
const EVERY = 6

/** n, n - 1, ..., 1. */
const down = (n: number): number[] => Array.from({ length: n }, (_, i) => n - i)

interface Sent {
  /** SessionTime of the tick the payload was computed on. */
  t: number
  repair: number | null
  optional: number | null
  /** The mandatory repair's seconds are the real-time estimate (lights.repairRealTime). */
  real: boolean
}

/**
 * Parked in the box being repaired: `repairAt(t)` / `optAt(t)` are what iRacing says at session
 * time t. Returns what the strip is sent, in order.
 */
function stop(
  seconds: number,
  repairAt: (t: number) => number,
  optAt: (t: number) => number,
  opts: LightsOptions = defaultOptions('lights'),
  edit: (frame: MutableFrame, t: number) => void = () => {}
): Sent[] {
  const frame = makeFrame()
  const session = makeSession(3, { driverCarIdleRpm: 900 })
  const p = new LightsProvider()
  const skip = SKIP_EMIT.lights
  if (!skip) throw new Error('no SKIP_EMIT.lights')
  frame.Speed[0] = 0
  frame.OnPitRoad[0] = true
  frame.PlayerTrackSurface[0] = TrackLocation.InPitStall
  frame.PlayerCarInPitStall[0] = true
  frame.PitstopActive[0] = true
  frame.EngineWarnings[0] = EngineWarning.MandatoryRepairs | EngineWarning.OptionalRepairs
  const sent: Sent[] = []
  let prev: LightsData | null = null
  for (let n = 0; n <= seconds * HZ; n++) {
    const t = 100 + n / HZ
    frame.SessionTime[0] = t
    frame.PitRepairLeft[0] = Math.max(0, repairAt(t - 100))
    frame.PitOptRepairLeft[0] = Math.max(0, optAt(t - 100))
    edit(frame, t - 100)
    p.observe(frame)
    if (n % EVERY !== 0) continue
    const d = p.compute(frame, session, EMPTY_RACE_VIEW, opts)
    if (!skip(d, prev)) {
      const of = (kind: string): number | null =>
        d.lights.find((l) => l.kind === kind)?.seconds ?? null
      const real = d.lights.find((l) => l.kind === 'repair')?.realTime ?? false
      sent.push({ t: t - 100, repair: of('repair'), optional: of('repairOptional'), real })
    }
    prev = d
  }
  return sent
}

describe('repair seconds on the warning lights (PitRepairLeft at 60 Hz -> the strip at 10 Hz)', () => {
  it('a repair falling at 1 s per second is sent once per second, within 100 ms of each second', () => {
    const sent = stop(
      12,
      (t) => 10.4 - t,
      (t) => 8 - t
    )
    // The first payload, then one per whole second of either countdown (mandatory 11..1, then 0
    // = no time; optional 8..1, then none).
    const repairs = sent.map((s) => s.repair)
    expect(repairs.filter((v, i) => i === 0 || v !== repairs[i - 1])).toEqual([...down(11), null])
    // Each new mandatory second reaches the strip at most one provider period (0.1 s) after
    // iRacing's value crossed it: 10.4 - t crosses k at t = 10.4 - k.
    for (const [i, s] of sent.entries()) {
      // Only where the mandatory second changed (the optional one changes on its own ticks).
      if (i === 0 || s.repair === null || s.repair === sent[i - 1]?.repair) continue
      const crossed = 10.4 - s.repair
      expect(s.t - crossed).toBeGreaterThanOrEqual(0)
      expect(s.t - crossed).toBeLessThan(0.1 + 1e-9)
    }
    const optionals = sent.map((s) => s.optional)
    expect(optionals.filter((v, i) => i === 0 || v !== optionals[i - 1])).toEqual([
      ...down(8),
      null
    ])
  })

  it('follows iRacing at whatever pace it counts: a value falling 1 s every 3 s is shown that way', () => {
    // What the user reports ("several seconds to go down one"): OverLap shows exactly that if
    // PitRepairLeft itself falls at a third of real time.
    const sent = stop(
      9,
      (t) => 20 - t / 3,
      () => 0
    )
    const changes = sent.filter((s, i) => i === 0 || s.repair !== sent[i - 1]?.repair)
    expect(changes.map((s) => s.repair)).toEqual([20, 19, 18, 17])
    // Three seconds between steps (to the 0.1 s provider period).
    const gaps = changes.slice(1).map((s, i) => s.t - (changes[i] as Sent).t)
    for (const g of gaps.slice(1)) expect(Math.abs(g - 3)).toBeLessThan(0.1 + 1e-9)
  })
})

describe('the real countdown on the strip (lights.repairRealTime)', () => {
  const REAL: LightsOptions = { ...defaultOptions('lights'), repairRealTime: true }

  it('off by default: the crew figure, never the estimate', () => {
    expect(defaultOptions('lights').repairRealTime).toBe(false)
    const sent = stop(
      10,
      (t) => 20 - t / 3,
      () => 0
    )
    expect(sent.every((s) => !s.real)).toBe(true)
  })

  it('a crew second every 3 s: the crew figure first, then real seconds falling one per second', () => {
    const sent = stop(
      14,
      (t) => 20 - t / 3,
      () => 0,
      REAL
    )
    // Until a run spans 2 s, iRacing's figure.
    for (const s of sent.filter((s) => s.t < 2)) expect(s.real).toBe(false)
    const est = sent.filter((s) => s.real)
    expect(est.length).toBeGreaterThan(8)
    // (20 - t / 3) * 3 = 60 - t real seconds, whole seconds rounded up.
    for (const s of est) expect(s.repair).toBe(Math.ceil(60 - s.t - 1e-9))
    // One new whole second per real second, never rising.
    const values = est.map((s) => s.repair as number)
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1] as number)
    }
    expect(new Set(values).size).toBeGreaterThanOrEqual(10)
  })

  it('1 s per second: the estimate is the crew figure', () => {
    const sent = stop(
      8,
      (t) => 30.5 - t,
      () => 0,
      REAL
    )
    for (const s of sent.filter((s) => s.real)) expect(s.repair).toBe(Math.ceil(30.5 - s.t - 1e-9))
  })

  it('towed to the box: the crew figure while towed, the estimate once stopped there', () => {
    const sent = stop(
      12,
      (t) => 20 - t / 2,
      () => 0,
      REAL,
      (f, t) => {
        f.PlayerCarTowTime[0] = t < 6 ? 6 - t : 0
      }
    )
    for (const s of sent.filter((s) => s.t < 8)) expect(s.real).toBe(false)
    expect(sent.some((s) => s.real)).toBe(true)
  })

  it('a fast repair: the light goes when the figure does, no estimate left behind', () => {
    let fixed = false
    const sent = stop(
      8,
      (t) => (t < 5 ? 30 - t / 3 : 0),
      () => 0,
      REAL,
      (f, t) => {
        fixed = t >= 5
        f.EngineWarnings[0] = fixed ? 0 : EngineWarning.MandatoryRepairs
      }
    )
    expect(sent.some((s) => s.real)).toBe(true)
    for (const s of sent.filter((s) => s.t >= 5)) expect(s.repair).toBeNull()
  })

  it('without the repair time shown, no estimate either', () => {
    const sent = stop(
      8,
      (t) => 20 - t / 3,
      () => 0,
      { ...REAL, showRepairTime: false }
    )
    for (const s of sent) expect(s.repair).toBeNull()
  })
})
