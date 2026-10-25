import { describe, expect, it } from 'vitest'
import { computeInputs } from './inputs'
import { TELEMETRY_VAR_NAMES } from './telemetry'
import type { TelemetryFrame } from './telemetry'
import type { InputsData } from './types'

type MutableFrame = { -readonly [K in keyof TelemetryFrame]: TelemetryFrame[K] }

/** Every variable missing (empty array) unless overridden. */
function makeFrame(o: Partial<MutableFrame> = {}): TelemetryFrame {
  const empty = Object.fromEntries(TELEMETRY_VAR_NAMES.map((n) => [n, []])) as unknown
  return { ...(empty as MutableFrame), ...o }
}

const DRIVING: Partial<MutableFrame> = {
  SessionTime: [1234.5678],
  IsOnTrack: [true],
  Throttle: [0.734],
  Brake: [0.2],
  Clutch: [1],
  SteeringWheelAngle: [-1.2],
  SteeringWheelAngleMax: [4.8],
  Gear: [3],
  Speed: [41.7],
  BrakeABSactive: [false]
}

describe('computeInputs', () => {
  it('maps a driving tick', () => {
    expect(computeInputs(makeFrame(DRIVING))).toEqual<InputsData>({
      throttle: 0.73,
      brake: 0.2,
      clutch: 0,
      steering: -0.25,
      gear: 3,
      speedKmh: 150,
      abs: false,
      active: true,
      t: 1234.5678
    })
  })

  it('reads zeros and false when every variable is missing', () => {
    expect(computeInputs(makeFrame())).toEqual<InputsData>({
      throttle: 0,
      brake: 0,
      clutch: 0,
      steering: 0,
      gear: 0,
      speedKmh: 0,
      abs: false,
      active: false,
      t: Number.NaN
    })
  })

  it('clamps pedals to 0..1 and treats NaN as 0', () => {
    const d = computeInputs(makeFrame({ Throttle: [1.2], Brake: [-0.1] }))
    expect(d.throttle).toBe(1)
    expect(d.brake).toBe(0)
    expect(computeInputs(makeFrame({ Throttle: [NaN], Brake: [NaN] }))).toMatchObject({
      throttle: 0,
      brake: 0
    })
  })

  it('quantises pedals to 0.01', () => {
    const d = computeInputs(makeFrame({ Throttle: [0.996], Brake: [0.004] }))
    expect(d.throttle).toBe(1)
    expect(d.brake).toBe(0)
    expect(computeInputs(makeFrame({ Brake: [0.555] })).brake).toBe(0.56)
  })

  it('turns Clutch (1 = engaged) into the pedal position', () => {
    expect(computeInputs(makeFrame({ Clutch: [1] })).clutch).toBe(0)
    expect(computeInputs(makeFrame({ Clutch: [0] })).clutch).toBe(1)
    expect(computeInputs(makeFrame({ Clutch: [0.3] })).clutch).toBe(0.7)
    expect(computeInputs(makeFrame({ Clutch: [1.05] })).clutch).toBe(0)
    expect(computeInputs(makeFrame({ Clutch: [NaN] })).clutch).toBe(0)
  })

  it('normalises steering by the wheel lock, positive = left, clamped', () => {
    const steer = (angle: number, max: number): number =>
      computeInputs(makeFrame({ SteeringWheelAngle: [angle], SteeringWheelAngleMax: [max] }))
        .steering
    expect(steer(2.4, 4.8)).toBe(0.5)
    expect(steer(-4.8, 4.8)).toBe(-1)
    expect(steer(6, 4.8)).toBe(1)
    expect(steer(-6, 4.8)).toBe(-1)
    expect(steer(1, 0)).toBe(0)
    expect(steer(1, -2)).toBe(0)
    expect(steer(NaN, 4.8)).toBe(0)
    // No -0 in the payload.
    expect(Object.is(steer(-0.001, 4.8), 0)).toBe(true)
    expect(computeInputs(makeFrame({ SteeringWheelAngle: [1] })).steering).toBe(0)
  })

  it('reports gear, speed in km/h, ABS and on-track state', () => {
    const d = computeInputs(
      makeFrame({ Gear: [-1], Speed: [27.78], BrakeABSactive: [true], IsOnTrack: [false] })
    )
    expect(d).toMatchObject({ gear: -1, speedKmh: 100, abs: true, active: false })
    expect(computeInputs(makeFrame({ Gear: [0] })).gear).toBe(0)
    expect(computeInputs(makeFrame({ Gear: [NaN], Speed: [-3] }))).toMatchObject({
      gear: 0,
      speedKmh: 0
    })
    expect(computeInputs(makeFrame({ Speed: [Infinity] })).speedKmh).toBe(0)
  })

  it('stamps the sample with SessionTime (NaN when unknown)', () => {
    expect(computeInputs(makeFrame({ SessionTime: [61.25] })).t).toBe(61.25)
    expect(computeInputs(makeFrame({ SessionTime: [NaN] })).t).toBeNaN()
  })

  it('returns a fresh payload on every call', () => {
    const f = makeFrame(DRIVING)
    expect(computeInputs(f)).not.toBe(computeInputs(f))
  })
})
