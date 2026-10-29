import { describe, expect, it } from 'vitest'
import { FFB_CLIP_AT, computeInputs } from './inputs'
import { EMPTY_SESSION } from './session'
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
      t: 1234.5678,
      steeringDeg: -69,
      rpm: 0,
      slFirst: 0,
      slShift: 0,
      slLast: 0,
      slBlink: 0,
      brakeBias: null,
      tc: null,
      ffb: null,
      ffbClip: false
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
      t: Number.NaN,
      steeringDeg: 0,
      rpm: 0,
      slFirst: 0,
      slShift: 0,
      slLast: 0,
      slBlink: 0,
      brakeBias: null,
      tc: null,
      ffb: null,
      ffbClip: false
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

  it("reads the wheel angle in whole degrees, within the car's lock", () => {
    const deg = (angle: number, max?: number): number =>
      computeInputs(
        makeFrame({
          SteeringWheelAngle: [angle],
          ...(max !== undefined ? { SteeringWheelAngleMax: [max] } : {})
        })
      ).steeringDeg
    expect(deg(Math.PI / 2, 4.71)).toBe(90)
    expect(deg(-Math.PI, 4.71)).toBe(-180)
    // Past the lock (a glitch, a car change): held at the lock, 270 degrees each way here.
    expect(deg(6, 4.712389)).toBe(270)
    expect(deg(-6, 4.712389)).toBe(-270)
    // No lock known: the angle as it is.
    expect(deg(6)).toBe(344)
    expect(deg(NaN, 4.71)).toBe(0)
    expect(Object.is(deg(-0.001, 4.71), 0)).toBe(true)
  })

  it('reads the revs and the shift lights of the session', () => {
    const session = {
      ...EMPTY_SESSION,
      shiftRpm: { first: 6200, shift: 7400, last: 7600, blink: 7800 }
    }
    const d = computeInputs(makeFrame({ RPM: [7012.6] }), session)
    expect(d).toMatchObject({
      rpm: 7013,
      slFirst: 6200,
      slShift: 7400,
      slLast: 7600,
      slBlink: 7800
    })
    expect(computeInputs(makeFrame({ RPM: [NaN] }), EMPTY_SESSION)).toMatchObject({
      rpm: 0,
      slFirst: 0,
      slBlink: 0
    })
  })

  it('reads brake bias and TC only when the car has them', () => {
    const d = computeInputs(makeFrame({ dcBrakeBias: [54.4999], dcTractionControl: [3.0] }))
    expect(d).toMatchObject({ brakeBias: 54.5, tc: 3 })
    // Missing (an empty array): null, the readout hides.
    expect(computeInputs(makeFrame())).toMatchObject({ brakeBias: null, tc: null })
    expect(computeInputs(makeFrame({ dcBrakeBias: [NaN] })).brakeBias).toBeNull()
    expect(computeInputs(makeFrame({ dcBrakeBias: [-1.5] })).brakeBias).toBe(-1.5)
  })

  it('flags force-feedback clipping at the maximum torque', () => {
    const ffb = (v: number): Pick<InputsData, 'ffb' | 'ffbClip'> => {
      const d = computeInputs(makeFrame({ SteeringWheelPctTorque: [v] }))
      return { ffb: d.ffb, ffbClip: d.ffbClip }
    }
    expect(ffb(0.42)).toEqual({ ffb: 0.42, ffbClip: false })
    expect(ffb(FFB_CLIP_AT - 0.01)).toEqual({ ffb: 0.99, ffbClip: false })
    expect(ffb(1)).toEqual({ ffb: 1, ffbClip: true })
    expect(ffb(1.3)).toEqual({ ffb: 1, ffbClip: true })
    expect(ffb(NaN)).toEqual({ ffb: null, ffbClip: false })
  })

  it('returns a fresh payload on every call', () => {
    const f = makeFrame(DRIVING)
    expect(computeInputs(f)).not.toBe(computeInputs(f))
  })
})
