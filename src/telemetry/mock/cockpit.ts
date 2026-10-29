/**
 * The mock car's cockpit for the pedals' car block: revs by gear (so the shift lights fill up
 * through each gear and blink just before each upshift), the shift points its session YAML gives,
 * the brake bias and TC the driver dials in now and then, and the force feedback, which clips in
 * the fastest corners. Pure: everything is a function of the race's state at one tick.
 */
import { clamp } from '@shared/num'
import type { ShiftRpm } from '@shared/types'
import { STEER_K, UPSHIFT_KMH } from './track'

/** DriverInfo DriverCarSL*RPM and DriverCarRedLine of the mock's car (a GT3-like engine). */
export const MOCK_SHIFT_RPM: Readonly<ShiftRpm> = Object.freeze({
  first: 5800,
  shift: 7400,
  last: 7600,
  blink: 7800
})
export const MOCK_REDLINE_RPM = 8000
/** The revs the driver upshifts at: a touch late, so the strip blinks for a moment each time. */
export const MOCK_UPSHIFT_RPM = 7850
/** Where 6th would upshift (it never does): top speed sits in the shift band, lit but steady. */
const TOP_GEAR_KMH = 264
/** 1st gear only pulls away in the pits. */
const FIRST_GEAR_KMH = 70

/** Each forward gear's top (km/h): where the driver upshifts out of it. */
function gearTopKmh(gear: number): number {
  if (gear <= 1) return FIRST_GEAR_KMH
  return UPSHIFT_KMH[gear - 2] ?? TOP_GEAR_KMH
}

/** Revs in `gear` at `speedMs`: the idle in neutral, stopped or stalled (0 then). */
export function mockRpm(gear: number, speedMs: number, idleRpm: number, stalled: boolean): number {
  if (stalled) return 0
  if (!(gear > 0) || !(speedMs > 0)) return idleRpm
  const rpm = (MOCK_UPSHIFT_RPM * speedMs * 3.6) / gearTopKmh(gear)
  return Math.min(MOCK_REDLINE_RPM, Math.max(idleRpm, rpm))
}

/** The bias steps the driver dials in (% front), by seconds since the start. */
const BIAS_STEPS: readonly (readonly [fromS: number, bias: number])[] = [
  [0, 54.5],
  [150, 54],
  [420, 53.5]
]
/** TC: one click down once the tyres are in. */
const TC_STEPS: readonly (readonly [fromS: number, tc: number])[] = [
  [0, 4],
  [240, 3]
]

function stepAt(steps: readonly (readonly [number, number])[], t: number): number {
  let v = steps[0]?.[1] ?? 0
  for (const [from, value] of steps) if (t >= from) v = value
  return v
}

export function mockBrakeBias(elapsedS: number): number {
  return stepAt(BIAS_STEPS, elapsedS)
}

export function mockTractionControl(elapsedS: number): number {
  return stepAt(TC_STEPS, elapsedS)
}

/** Lateral grip at the limit of the mock's corners (track.ts LAT_ACCEL_MS2). */
const LIMIT_G_MS2 = 16
/** Of the full torque: the centring at rest, the share of the corner load, the aero's extra. */
const FFB_BASE = 0.08
const FFB_LOAD = 0.78
const FFB_AERO = 0.24
const FFB_AERO_MS = 65

/**
 * SteeringWheelPctTorque (0..1, 1 is clipping) for a wheel angle (rad) at a speed: the
 * corner's lateral load, more with speed (aero), so the fastest corners clip and the slow ones
 * do not.
 */
export function mockFfbTorque(steerRad: number, speedMs: number): number {
  const lateral = clamp((speedMs * speedMs * Math.abs(steerRad)) / STEER_K / LIMIT_G_MS2, 0, 1.2)
  const aero = (speedMs / FFB_AERO_MS) ** 2
  // The wheelbase gives no more than its maximum: clipping reads as 1, like the sim.
  return Math.min(1, FFB_BASE + lateral * (FFB_LOAD + FFB_AERO * aero))
}
