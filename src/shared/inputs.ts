/**
 * Inputs widget: the player's pedals, steering, gear and speed for one tick, plus the car block
 * (revs and shift lights, brake bias, TC, force feedback). Runs at 60 Hz, so it allocates nothing
 * but the payload. Missing variables read as zeros / false; a car control the car does not have
 * (dcBrakeBias, dcTractionControl: an empty array) reads as null, so its readout stays hidden.
 */
import { finiteOr, roundTo } from './num'
import type { TelemetryFrame } from './telemetry'
import type { InputsData, SessionMeta } from './types'

const MS_TO_KMH = 3.6
const RAD_TO_DEG = 180 / Math.PI
/**
 * Force feedback at or over this share of the maximum torque is clipping. The SDK's unit is '%':
 * read as 0..1 like Throttle (unverified live; a 0..100 scale would read as always clipping).
 */
export const FFB_CLIP_AT = 0.995

/** Clamped to 0..1 and quantised to 0.01; missing or NaN -> 0. */
function unit(v: number | undefined): number {
  if (v === undefined || !(v > 0)) return 0
  return v >= 1 ? 1 : Math.round(v * 100) / 100
}

/** -1..1 of the wheel's lock (positive = left), quantised to 0.01; 0 when unknown. */
function steeringRatio(angle: number | undefined, max: number | undefined): number {
  if (angle === undefined || max === undefined || !Number.isFinite(angle) || !(max > 0)) return 0
  const r = angle / max
  if (r >= 1) return 1
  if (r <= -1) return -1
  // `|| 0`: no -0 in the payload.
  return Math.round(r * 100) / 100 || 0
}

/** The wheel's angle in whole degrees, within the car's lock when it is known; 0 when unknown. */
function steeringDegrees(angle: number | undefined, max: number | undefined): number {
  if (angle === undefined || !Number.isFinite(angle)) return 0
  const lock = max !== undefined && max > 0 ? max : Infinity
  const a = angle >= lock ? lock : angle <= -lock ? -lock : angle
  return Math.round(a * RAD_TO_DEG) || 0
}

/** A car control (dcBrakeBias, dcTractionControl): null when the car has none. */
function control(v: number | undefined, decimals: number): number | null {
  return v !== undefined && Number.isFinite(v) ? roundTo(v, decimals) : null
}

export function computeInputs(frame: TelemetryFrame, session?: SessionMeta): InputsData {
  const clutch = frame.Clutch[0]
  const gear = frame.Gear[0]
  const speed = frame.Speed[0]
  const rpm = frame.RPM[0]
  const torque = frame.SteeringWheelPctTorque[0]
  const hasTorque = torque !== undefined && Number.isFinite(torque)
  const sl = session?.shiftRpm ?? null
  const angle = frame.SteeringWheelAngle[0]
  const max = frame.SteeringWheelAngleMax[0]
  return {
    throttle: unit(frame.Throttle[0]),
    brake: unit(frame.Brake[0]),
    // Clutch is 1 when engaged (pedal up): the pedal position is its complement.
    clutch: clutch !== undefined && Number.isFinite(clutch) ? unit(1 - clutch) : 0,
    steering: steeringRatio(angle, max),
    gear: gear !== undefined && Number.isFinite(gear) ? Math.round(gear) || 0 : 0,
    speedKmh:
      speed !== undefined && Number.isFinite(speed) && speed > 0
        ? Math.round(speed * MS_TO_KMH)
        : 0,
    abs: frame.BrakeABSactive[0] === true,
    active: frame.IsOnTrack[0] === true,
    // Sample time, so the trace keeps its time axis when ticks arrive late or in bursts. NaN
    // when unknown: the trace then spaces samples by period (a constant would freeze it).
    t: finiteOr(frame.SessionTime[0], Number.NaN),
    steeringDeg: steeringDegrees(angle, max),
    rpm: rpm !== undefined && Number.isFinite(rpm) && rpm > 0 ? Math.round(rpm) : 0,
    slFirst: sl?.first ?? 0,
    slShift: sl?.shift ?? 0,
    slLast: sl?.last ?? 0,
    slBlink: sl?.blink ?? 0,
    brakeBias: control(frame.dcBrakeBias[0], 1),
    tc: control(frame.dcTractionControl[0], 0),
    ffb: hasTorque ? unit(torque) : null,
    ffbClip: hasTorque && torque >= FFB_CLIP_AT
  }
}
