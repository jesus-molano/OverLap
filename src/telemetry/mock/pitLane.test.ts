import { describe, it, expect } from 'vitest'
import { frac } from '@shared/num'
import { PlayerInputs } from './inputs'
import { MOCK_PIT_SPEED_LIMIT_KMH } from './constants'
import {
  CREEP_FROM_S,
  LAUNCH_CLUTCH_S,
  LIMITER_LATE_S,
  PIT_APPROACH_PCT,
  PIT_IN_PCT,
  PIT_LIMIT_MS,
  PIT_OUT_PCT,
  PIT_OVERSPEED_KMH,
  PIT_SPEED_MS,
  PLAYER_STALL_S,
  PlayerPitStop,
  stallPctOf
} from './pitLane'
import type { PlayerPitPhase } from './pitLane'
import { at } from './testUtils'
import { TRACK_LENGTH_M } from './track'

const DT = 1 / 60
const LAP_RATE = 1 / 139
const START = 14 + PIT_APPROACH_PCT + 1e-6

interface Sample {
  t: number
  phase: PlayerPitPhase
  /** Seconds in the phase. */
  phaseS: number
  dist: number
  speed: number
  onPitRoad: boolean
  inStall: boolean
  limiter: boolean
  throttle: number
  brake: number
  clutch: number
  gear: number
}

/** A whole stop of the player in CarIdx 7's box, from the braking point, at 60 Hz. */
function stop(): Sample[] {
  const pit = new PlayerPitStop()
  const inputs = new PlayerInputs()
  inputs.update(frac(START), 0, pit, 1)
  pit.begin(START, inputs.speed, stallPctOf(7))
  const out: Sample[] = []
  let dist = START
  for (let k = 1; k <= 200 / DT && pit.active; k++) {
    dist = pit.advance(dist, DT, LAP_RATE)
    inputs.update(frac(dist), k * DT, pit, 1)
    out.push({
      t: k * DT,
      phase: pit.phase,
      phaseS: pit.phaseS,
      dist,
      speed: inputs.speed,
      onPitRoad: pit.onPitRoad,
      inStall: pit.inStall,
      limiter: pit.limiter,
      throttle: inputs.throttle,
      brake: inputs.brake,
      clutch: inputs.clutch,
      gear: inputs.gear
    })
  }
  return out
}

/** Unbroken runs in ascending sample times (one sample apart). */
function spans(times: readonly number[]): number {
  let n = 0
  times.forEach((t, k) => {
    if (k === 0 || t - (times[k - 1] ?? 0) > DT * 1.5) n++
  })
  return n
}

const samples = stop()
const phases = (): PlayerPitPhase[] =>
  samples.map((s) => s.phase).filter((p, k, all) => k === 0 || p !== all[k - 1])
const during = (phase: PlayerPitPhase): Sample[] => samples.filter((s) => s.phase === phase)

describe('PlayerPitStop', () => {
  it('goes through every phase once and back to racing', () => {
    expect(phases()).toEqual(['approach', 'lane-in', 'stall', 'lane-out', 'rejoin', 'none'])
    const total = at(samples, samples.length - 1).t
    // ~700 m of pit lane at 60 km/h and 24 s in the box.
    expect(total).toBeGreaterThan(60)
    expect(total).toBeLessThan(90)
  })

  it('moves forward without jumps, entering at the entry line and leaving at the exit line', () => {
    let prev = START
    for (const s of samples) {
      expect(s.dist).toBeGreaterThanOrEqual(prev)
      expect((s.dist - prev) * TRACK_LENGTH_M).toBeLessThan(75 * DT)
      prev = s.dist
    }
    const laneIn = at(during('lane-in'), 0)
    expect(laneIn.dist).toBeGreaterThanOrEqual(14 + PIT_IN_PCT)
    expect((laneIn.dist - 14 - PIT_IN_PCT) * TRACK_LENGTH_M).toBeLessThan(1)
    for (const s of during('stall')) expect(s.dist).toBe(15 + stallPctOf(7))
    const rejoin = at(during('rejoin'), 0)
    expect(rejoin.dist).toBeGreaterThanOrEqual(15 + PIT_OUT_PCT)
    expect((rejoin.dist - 15 - PIT_OUT_PCT) * TRACK_LENGTH_M).toBeLessThan(1)
  })

  it('brakes to just under the limit for the entry line', () => {
    const approach = during('approach')
    // Still accelerating out of the last corner (~200 km/h) at the braking point.
    expect(at(approach, 0).speed).toBeGreaterThan(50)
    for (let k = 1; k < approach.length; k++) {
      expect(at(approach, k).speed).toBeLessThanOrEqual(at(approach, k - 1).speed)
      expect(at(approach, k).throttle).toBe(0)
      expect(at(approach, k).brake).toBeGreaterThan(0.5)
    }
    const entry = at(approach, approach.length - 1).speed
    expect(entry).toBeLessThan(PIT_LIMIT_MS)
    expect(entry).toBeGreaterThan(PIT_LIMIT_MS - 1)
    expect(PIT_LIMIT_MS * 3.6).toBeCloseTo(MOCK_PIT_SPEED_LIMIT_KMH, 9)
  })

  it('engages the limiter LIMITER_LATE_S after the entry line, then keeps it to the exit line', () => {
    for (const s of samples) {
      const late = s.phase === 'lane-in' && s.phaseS < LIMITER_LATE_S
      expect(s.limiter, `${s.phase} +${s.phaseS.toFixed(2)} s`).toBe(s.onPitRoad && !late)
    }
    const off = during('lane-in').filter((s) => !s.limiter)
    // About two seconds of OFF on pit road.
    expect(off.length * DT).toBeCloseTo(LIMITER_LATE_S, 1)
    for (const s of off) {
      expect(s.brake).toBe(0)
      expect(s.throttle).toBeGreaterThan(0)
      expect(s.throttle).toBeLessThan(1)
    }
  })

  it('creeps a few km/h over the limit once, without and then with the limiter, before slowing', () => {
    const onPit = samples.filter((x) => x.onPitRoad)
    const over = onPit.filter((x) => x.speed > PIT_LIMIT_MS + 1e-9)
    expect(over.length).toBeGreaterThan(0)
    // One stretch, in the lane-in phase, from the creep to shortly after the limiter goes on.
    expect(spans(over.map((s) => s.t))).toBe(1)
    for (const s of over) {
      expect(s.phase).toBe('lane-in')
      expect(s.phaseS).toBeGreaterThan(CREEP_FROM_S)
      expect(s.phaseS).toBeLessThan(LIMITER_LATE_S + 3)
    }
    const peakKmh = Math.max(...over.map((s) => s.speed)) * 3.6
    expect(peakKmh).toBeGreaterThan(MOCK_PIT_SPEED_LIMIT_KMH + PIT_OVERSPEED_KMH - 0.5)
    expect(peakKmh).toBeLessThanOrEqual(MOCK_PIT_SPEED_LIMIT_KMH + PIT_OVERSPEED_KMH + 1e-6)
    // Over the limit with the limiter off (forgot it) and then on (still coasting down to it):
    // the alerts show OFF, then over the limit, then on.
    const overOn = over.filter((s) => s.limiter)
    expect(over.some((s) => !s.limiter)).toBe(true)
    // More than a second at least 1 km/h over the limit with the limiter on.
    const speeding = overOn.filter((s) => s.speed * 3.6 > MOCK_PIT_SPEED_LIMIT_KMH + 1.5)
    expect(speeding.length * DT).toBeGreaterThan(0.8)
    for (let k = 1; k < overOn.length; k++) {
      expect(at(overOn, k).speed).toBeLessThan(at(overOn, k - 1).speed)
    }
    // Then never over the limit again, and at or under the limiter speed once it has slowed.
    const last = at(over, over.length - 1).t
    for (const s of onPit.filter((x) => x.t > last)) {
      expect(s.speed).toBeLessThanOrEqual(PIT_LIMIT_MS)
      if (s.phase !== 'lane-in' || s.phaseS > LIMITER_LATE_S + 3) {
        expect(s.speed).toBeLessThanOrEqual(PIT_SPEED_MS + 1e-9)
      }
    }
    // Flat out against the limiter between the entry and the box.
    expect(during('lane-in').some((s) => s.throttle === 1 && s.speed === PIT_SPEED_MS)).toBe(true)
    expect(PIT_SPEED_MS).toBeLessThan(PIT_LIMIT_MS)
  })

  it('stands still in the box for the service, in neutral with the brake on', () => {
    const stall = during('stall')
    expect(stall.length * DT).toBeCloseTo(PLAYER_STALL_S, 1)
    for (const s of stall) {
      expect(s.speed).toBe(0)
      expect(s.inStall).toBe(true)
      expect(s.brake).toBeGreaterThan(0)
    }
    expect(stall.some((s) => s.gear === 0 && s.clutch === 1)).toBe(true)
  })

  it('leaves the box with the clutch pressed, letting it up while pulling away in first', () => {
    const last = at(during('stall'), during('stall').length - 1)
    expect(last.clutch).toBe(0)
    expect(last.gear).toBe(1)
    const out = during('lane-out')
    const first = at(out, 0)
    expect(first.clutch).toBeLessThan(0.05)
    expect(first.gear).toBe(1)
    expect(first.throttle).toBeGreaterThan(0.3)
    expect(first.brake).toBe(0)
    const engaged = out.find((s) => s.clutch === 1)
    expect(engaged && engaged.t - first.t).toBeLessThanOrEqual(LAUNCH_CLUTCH_S + DT)
    for (let k = 1; k < out.length; k++) {
      expect(at(out, k).clutch).toBeGreaterThanOrEqual(at(out, k - 1).clutch)
      expect(at(out, k).speed).toBeGreaterThanOrEqual(at(out, k - 1).speed)
    }
    expect(out.some((s) => s.gear === 2)).toBe(true)
  })

  it('blends back to the lap rate after the exit line', () => {
    const rejoin = during('rejoin')
    const a = at(rejoin, rejoin.length - 2)
    const b = at(rejoin, rejoin.length - 1)
    expect((b.dist - a.dist) / DT).toBeCloseTo(LAP_RATE, 4)
    expect(at(rejoin, 0).throttle).toBe(1)
  })
})
