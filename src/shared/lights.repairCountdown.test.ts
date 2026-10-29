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
import { makeFrame, makeSession } from './race/testing/raceSim'
import { defaultOptions } from './settings'
import { TrackLocation } from './telemetry'
import type { LightsData } from './types'

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
}

/**
 * Parked in the box being repaired: `repairAt(t)` / `optAt(t)` are what iRacing says at session
 * time t. Returns what the strip is sent, in order.
 */
function stop(
  seconds: number,
  repairAt: (t: number) => number,
  optAt: (t: number) => number
): Sent[] {
  const frame = makeFrame()
  const session = makeSession(3, { driverCarIdleRpm: 900 })
  const p = new LightsProvider()
  const skip = SKIP_EMIT.lights
  if (!skip) throw new Error('no SKIP_EMIT.lights')
  frame.Speed[0] = 0
  frame.OnPitRoad[0] = true
  frame.PlayerTrackSurface[0] = TrackLocation.InPitStall
  frame.EngineWarnings[0] = EngineWarning.MandatoryRepairs | EngineWarning.OptionalRepairs
  const sent: Sent[] = []
  let prev: LightsData | null = null
  for (let n = 0; n <= seconds * HZ; n++) {
    const t = 100 + n / HZ
    frame.SessionTime[0] = t
    frame.PitRepairLeft[0] = Math.max(0, repairAt(t - 100))
    frame.PitOptRepairLeft[0] = Math.max(0, optAt(t - 100))
    p.observe(frame)
    if (n % EVERY !== 0) continue
    const d = p.compute(frame, session, EMPTY_RACE_VIEW, defaultOptions('lights'))
    if (!skip(d, prev)) {
      const of = (kind: string): number | null =>
        d.lights.find((l) => l.kind === kind)?.seconds ?? null
      sent.push({ t: t - 100, repair: of('repair'), optional: of('repairOptional') })
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
