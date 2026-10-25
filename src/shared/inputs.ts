/**
 * Inputs widget: the player's pedals, steering, gear and speed for one tick. Runs at 60 Hz, so
 * it allocates nothing but the payload. Missing variables read as zeros / false.
 */
import { finiteOr } from './num'
import type { TelemetryFrame } from './telemetry'
import type { InputsData } from './types'

const MS_TO_KMH = 3.6

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

export function computeInputs(frame: TelemetryFrame): InputsData {
  const clutch = frame.Clutch[0]
  const gear = frame.Gear[0]
  const speed = frame.Speed[0]
  return {
    throttle: unit(frame.Throttle[0]),
    brake: unit(frame.Brake[0]),
    // Clutch is 1 when engaged (pedal up): the pedal position is its complement.
    clutch: clutch !== undefined && Number.isFinite(clutch) ? unit(1 - clutch) : 0,
    steering: steeringRatio(frame.SteeringWheelAngle[0], frame.SteeringWheelAngleMax[0]),
    gear: gear !== undefined && Number.isFinite(gear) ? Math.round(gear) || 0 : 0,
    speedKmh:
      speed !== undefined && Number.isFinite(speed) && speed > 0
        ? Math.round(speed * MS_TO_KMH)
        : 0,
    abs: frame.BrakeABSactive[0] === true,
    active: frame.IsOnTrack[0] === true,
    // Sample time, so the trace keeps its time axis when ticks arrive late or in bursts. NaN
    // when unknown: the trace then spaces samples by period (a constant would freeze it).
    t: finiteOr(frame.SessionTime[0], Number.NaN)
  }
}
