import { describe, it, expect } from 'vitest'
import { COOL_DOWN_PACE, PlayerInputs } from './inputs'
import { PlayerPitStop } from './pitLane'
import { MOCK_TRACK_LENGTH_M, MockRace } from './simulation'
import { at, run } from './testUtils'
import { MOCK_CORNERS, STEERING_MAX_RAD, createTrackSample, gearFor, sampleTrack } from './track'

interface InputSample {
  t: number
  pct: number
  throttle: number
  brake: number
  clutch: number
  steer: number
  gear: number
  kmh: number
  abs: boolean
}

let lapCache: InputSample[] | null = null

/** One lap of the player's inputs at 60 Hz. */
function inputsLap(): InputSample[] {
  if (lapCache) return lapCache
  const race = new MockRace()
  const out: InputSample[] = []
  run(race, 142, 1 / 60, (f, t) => {
    expect(at(f.SteeringWheelAngleMax, 0)).toBe(STEERING_MAX_RAD)
    out.push({
      t,
      pct: at(f.CarIdxLapDistPct, at(f.PlayerCarIdx, 0)),
      throttle: at(f.Throttle, 0),
      brake: at(f.Brake, 0),
      clutch: at(f.Clutch, 0),
      steer: at(f.SteeringWheelAngle, 0),
      gear: at(f.Gear, 0),
      kmh: at(f.Speed, 0) * 3.6,
      abs: at(f.BrakeABSactive, 0)
    })
  })
  lapCache = out
  return out
}

describe('MockRace player inputs', () => {
  it('stays within the SDK ranges', () => {
    for (const s of inputsLap()) {
      for (const v of [s.throttle, s.brake, s.clutch]) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
      expect(Math.abs(s.steer)).toBeLessThan(STEERING_MAX_RAD)
      expect(s.gear).toBeGreaterThanOrEqual(2)
      expect(s.gear).toBeLessThanOrEqual(6)
      expect(s.kmh).toBeGreaterThan(65)
      expect(s.kmh).toBeLessThan(275)
    }
  })

  it('is flat out on the main straight with the wheel straight', () => {
    const straight = inputsLap().filter((s) => s.pct > 0.915 || s.pct < 0.035)
    expect(straight.length).toBeGreaterThan(500)
    for (const s of straight) {
      expect(s.throttle).toBe(1)
      expect(s.brake).toBe(0)
      expect(Math.abs(s.steer)).toBeLessThan(0.05)
      expect(s.clutch).toBe(1)
    }
  })

  it('brakes hard before the slow corners, with ABS at the start, then turns in', () => {
    const lap = inputsLap()
    const near = (m: number): InputSample => {
      const pct = m / MOCK_TRACK_LENGTH_M
      return lap.reduce((a, b) => (Math.abs(b.pct - pct) < Math.abs(a.pct - pct) ? b : a))
    }
    const slow = MOCK_CORNERS.filter((c) => c.speedKmh < 115)
    expect(slow.length).toBeGreaterThanOrEqual(4)
    for (const c of slow) {
      const braking = near(c.startM - 60)
      expect(braking.brake, `T at ${c.startM}`).toBeGreaterThan(0.4)
      expect(braking.throttle).toBe(0)
      expect(near(c.startM - 150).kmh).toBeGreaterThan(near(c.startM + 20).kmh + 60)
      // Steering towards the corner at the apex, throttle back on at the exit.
      expect(Math.sign(near(c.startM + c.lengthM / 2).steer)).toBe(c.dir)
      expect(Math.abs(near(c.startM + c.lengthM / 2).steer)).toBeGreaterThan(1)
      expect(near(c.startM + c.lengthM + 60).throttle).toBe(1)
    }
    expect(lap.some((s) => s.abs)).toBe(true)
    for (const s of lap) if (s.abs) expect(s.brake).toBeGreaterThan(0.5)
  })

  it('never mixes throttle and brake and looks like a real lap', () => {
    const lap = inputsLap()
    for (const s of lap) expect(s.throttle > 0.15 && s.brake > 0.15).toBe(false)
    const share = (pred: (s: InputSample) => boolean): number =>
      lap.filter(pred).length / lap.length
    expect(share((s) => s.throttle === 1)).toBeGreaterThan(0.45)
    expect(share((s) => s.throttle === 1)).toBeLessThan(0.75)
    expect(share((s) => s.brake > 0.05)).toBeGreaterThan(0.08)
    expect(share((s) => s.brake > 0.05)).toBeLessThan(0.3)
    const meanKmh = lap.reduce((sum, s) => sum + s.kmh, 0) / lap.length
    expect(meanKmh).toBeGreaterThan(160)
    expect(meanKmh).toBeLessThan(210)
    expect(lap.some((s) => s.steer > 1)).toBe(true)
    expect(lap.some((s) => s.steer < -1)).toBe(true)
  })

  it('picks gears by speed and dips the clutch only on downshifts', () => {
    const lap = inputsLap()
    let lastDownshift = -Infinity
    let dips = 0
    let prev: InputSample | undefined
    for (const s of lap) {
      expect(s.gear).toBe(gearFor(s.kmh / 3.6))
      if (prev && s.gear < prev.gear) lastDownshift = s.t
      if (s.clutch < 1) {
        expect(s.t - lastDownshift).toBeLessThan(0.15)
        expect(s.brake).toBeGreaterThan(0)
      }
      if (prev && prev.clutch === 1 && s.clutch < 1) dips++
      prev = s
    }
    expect(dips).toBeGreaterThanOrEqual(8)
    expect(Math.min(...lap.map((s) => s.clutch))).toBeLessThan(0.3)
  })
})

describe('PlayerInputs on a cool-down lap', () => {
  it('drives the same lines slower and with softer pedals', () => {
    const racing = new PlayerInputs()
    const cooling = new PlayerInputs()
    const pit = new PlayerPitStop()
    let softer = 0
    for (let k = 0; k < 7000; k++) {
      const pct = k / 7000
      racing.update(pct, k * 0.02, pit, 1)
      cooling.update(pct, k * 0.02, pit, COOL_DOWN_PACE)
      expect(cooling.speed).toBeCloseTo(racing.speed * COOL_DOWN_PACE, 9)
      expect(cooling.throttle).toBeLessThanOrEqual(racing.throttle)
      expect(cooling.brake).toBeLessThanOrEqual(racing.brake)
      expect(cooling.abs).toBe(false)
      expect(cooling.gear).toBe(gearFor(cooling.speed))
      if (cooling.throttle < racing.throttle) softer++
    }
    expect(softer).toBeGreaterThan(3000)
  })
})

describe('sampleTrack', () => {
  it('fills the sample in place', () => {
    const sample = createTrackSample()
    sampleTrack(0.5, sample)
    const same = sample
    sampleTrack(1.25, sample)
    expect(sample).toBe(same)
    const ref = createTrackSample()
    sampleTrack(0.25, ref)
    expect(sample).toEqual(ref)
  })
})
