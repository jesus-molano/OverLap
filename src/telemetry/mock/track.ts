/**
 * Driving profile of the mock circuit: speed, pedals and steering by lap
 * distance, from a small lap simulation (full throttle out of each corner,
 * constant-rate braking into the next one, trail braking into the apex).
 *
 * It only feeds the player's driver inputs (Throttle, Brake, Clutch,
 * SteeringWheelAngle, Gear, Speed, BrakeABSactive). Cars still move at a
 * steady pace along the lap, so Speed is plausible for the spot of the track
 * but does not drive CarIdxLapDistPct (except in the player's pit stop,
 * pitLane.ts). Built once at import, then sampled without allocating.
 */

export const TRACK_LENGTH_M = 7000

export interface MockCorner {
  /** Arc start, metres from the S/F line. */
  readonly startM: number
  readonly lengthM: number
  /** Speed through the arc. */
  readonly speedKmh: number
  /** 1 = left-hander (positive SteeringWheelAngle), -1 = right-hander. */
  readonly dir: 1 | -1
}

/** 16 corners; the main straight runs from the last one, past the S/F line, to T1. */
export const MOCK_CORNERS: readonly MockCorner[] = [
  { startM: 430, lengthM: 70, speedKmh: 92, dir: -1 },
  { startM: 600, lengthM: 90, speedKmh: 128, dir: 1 },
  { startM: 880, lengthM: 110, speedKmh: 168, dir: -1 },
  { startM: 1330, lengthM: 70, speedKmh: 232, dir: 1 },
  { startM: 1880, lengthM: 80, speedKmh: 82, dir: -1 },
  { startM: 2160, lengthM: 100, speedKmh: 140, dir: 1 },
  { startM: 2430, lengthM: 80, speedKmh: 118, dir: -1 },
  { startM: 2720, lengthM: 70, speedKmh: 172, dir: 1 },
  { startM: 2830, lengthM: 70, speedKmh: 165, dir: -1 },
  { startM: 3380, lengthM: 170, speedKmh: 205, dir: 1 },
  { startM: 4280, lengthM: 80, speedKmh: 76, dir: -1 },
  { startM: 4560, lengthM: 100, speedKmh: 138, dir: 1 },
  { startM: 4960, lengthM: 60, speedKmh: 236, dir: -1 },
  { startM: 5520, lengthM: 100, speedKmh: 108, dir: 1 },
  { startM: 5800, lengthM: 90, speedKmh: 152, dir: -1 },
  { startM: 6180, lengthM: 130, speedKmh: 122, dir: 1 }
]

/** SplitTimeInfo sector starts (lap fractions). */
export const MOCK_SECTOR_STARTS: readonly number[] = [0, 0.33, 0.66]

/** SteeringWheelAngleMax: half of a 900 degree lock-to-lock wheel, radians. */
export const STEERING_MAX_RAD = 7.85

/** One sample per metre: pedal transitions stay within one 60 Hz tick. */
const SAMPLES = 7000
const DS_M = TRACK_LENGTH_M / SAMPLES
const VMAX_MS = 72
const BRAKE_MS2 = 14
const LAT_ACCEL_MS2 = 16
/** Wheel angle (rad) x corner radius (m): ~3 rad in a hairpin, ~0.4 rad in a fast sweeper. */
const STEER_K = 90
const TURN_IN_M = 15
const UNWIND_M = 25
/** Throttle goes from the corner-exit value to full over this distance. */
const EXIT_RAMP_M = 40
const EXIT_THROTTLE = 0.65
/** Fraction of the braking peak still applied at the turn-in, bled off over the first part of the arc. */
const TRAIL_FRACTION = 0.45
const TRAIL_ARC = 0.35
/** Brake pedal at a braking zone's peak: light dab for a small speed drop, flat out for a big one. */
const BRAKE_PEAK_MIN = 0.3
const BRAKE_PEAK_PER_MS = 1 / 32
const BRAKE_RAMP = 0.06
/** The pedal never goes from 0 to the peak in less than this (m), nor the throttle from 1 to 0. */
const BRAKE_RAMP_MIN_M = 5
const LIFT_M = 3
/** ABS kicks in at the start of the hardest braking zones. */
const ABS_MIN_PEAK = 0.85
const ABS_FROM = 0.03
const ABS_TO = 0.22
/** Upshift points (km/h) from 2nd gear (1st is only for pulling away). */
const UPSHIFT_KMH = [112, 148, 185, 222] as const

function accelMs2(v: number): number {
  return Math.max(0.6, 9.5 - 0.115 * v)
}

const speedMs = new Float32Array(SAMPLES)
const throttleAt = new Float32Array(SAMPLES)
const brakeAt = new Float32Array(SAMPLES)
const steerAt = new Float32Array(SAMPLES)
const absAt = new Uint8Array(SAMPLES)

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function sampleRange(startM: number, endM: number): [from: number, to: number] {
  return [Math.floor(startM / DS_M), Math.ceil(endM / DS_M)]
}

function build(): void {
  const limit = new Float32Array(SAMPLES).fill(VMAX_MS)
  for (const c of MOCK_CORNERS) {
    const [from, to] = sampleRange(c.startM, c.startM + c.lengthM)
    for (let i = from; i < to; i++) {
      const k = i % SAMPLES
      limit[k] = Math.min(limit[k] ?? VMAX_MS, c.speedKmh / 3.6)
    }
  }

  // Two passes each way settle the wrap at the S/F line.
  const fwd = new Float32Array(SAMPLES)
  let v = VMAX_MS
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < SAMPLES; i++) {
      v = Math.min(limit[i] ?? VMAX_MS, Math.sqrt(v * v + 2 * accelMs2(v) * DS_M))
      fwd[i] = v
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let i = SAMPLES - 1; i >= 0; i--) {
      v = Math.min(fwd[i] ?? VMAX_MS, Math.sqrt(v * v + 2 * BRAKE_MS2 * DS_M))
      speedMs[i] = v
    }
  }
  const braking = (i: number): boolean => (speedMs[i] ?? 0) < (fwd[i] ?? 0) - 0.01

  throttleAt.fill(1)
  for (const c of MOCK_CORNERS) {
    const endM = c.startM + c.lengthM
    const [arcFrom, arcTo] = sampleRange(c.startM, endM)
    // Was there a braking zone right before the turn-in? Then trail the brakes into the arc.
    const trails = braking((arcFrom - 1 + SAMPLES) % SAMPLES)
    // Flat-out kinks need neither the partial throttle nor the exit ramp.
    if (trails) {
      const [, rampTo] = sampleRange(endM, endM + EXIT_RAMP_M)
      for (let i = arcTo; i < rampTo; i++) {
        throttleAt[i % SAMPLES] =
          EXIT_THROTTLE + ((1 - EXIT_THROTTLE) * (i - arcTo)) / (rampTo - arcTo)
      }
      for (let i = arcFrom; i < arcTo; i++) {
        const u = (i - arcFrom + 0.5) / (arcTo - arcFrom)
        throttleAt[i % SAMPLES] =
          u < TRAIL_ARC ? 0 : 0.15 + ((EXIT_THROTTLE - 0.15) * (u - TRAIL_ARC)) / (1 - TRAIL_ARC)
      }
    }

    const r = (c.speedKmh / 3.6) ** 2 / LAT_ACCEL_MS2
    const peak = (c.dir * STEER_K) / r
    const [wFrom, wTo] = sampleRange(c.startM - TURN_IN_M, endM + UNWIND_M)
    for (let i = wFrom; i < wTo; i++) {
      const w = (i - wFrom + 0.5) / (wTo - wFrom)
      const k = i % SAMPLES
      steerAt[k] = (steerAt[k] ?? 0) + peak * smoothstep(0, 0.3, w) * (1 - smoothstep(0.65, 1, w))
    }
  }

  // Braking zones last: they win over any throttle ramp they overlap. The main
  // straight crosses the S/F line at full speed, so no zone wraps around it.
  let i = 0
  while (i < SAMPLES) {
    if (!braking(i)) {
      i++
      continue
    }
    const from = i
    while (i < SAMPLES && braking(i)) i++
    const to = i
    const drop = (speedMs[from - 1] ?? VMAX_MS) - (speedMs[to % SAMPLES] ?? 0)
    const peak = Math.min(1, BRAKE_PEAK_MIN + drop * BRAKE_PEAK_PER_MS)
    const ramp = Math.min(0.5, Math.max(BRAKE_RAMP, BRAKE_RAMP_MIN_M / DS_M / (to - from)))
    // Lift off just before the brakes go on.
    for (let k = 1; k <= LIFT_M / DS_M; k++) {
      const j = (from - k + SAMPLES) % SAMPLES
      throttleAt[j] = Math.min(throttleAt[j] ?? 1, (k - 1) / (LIFT_M / DS_M))
    }
    for (let k = from; k < to; k++) {
      const u = (k - from + 0.5) / (to - from)
      brakeAt[k] =
        u < ramp ? (peak * u) / ramp : peak * (1 - ((1 - TRAIL_FRACTION) * (u - ramp)) / (1 - ramp))
      throttleAt[k] = 0
      absAt[k] = peak >= ABS_MIN_PEAK && u >= ABS_FROM && u < ABS_TO ? 1 : 0
    }
    // Trail braking: bleed the rest off over the first part of the arc that follows.
    const corner = MOCK_CORNERS.find((c) => Math.floor(c.startM / DS_M) === to)
    if (corner) {
      const [arcFrom, arcTo] = sampleRange(corner.startM, corner.startM + corner.lengthM)
      const trailTo = arcFrom + Math.round((arcTo - arcFrom) * TRAIL_ARC)
      for (let k = arcFrom; k < trailTo; k++) {
        brakeAt[k % SAMPLES] =
          peak * TRAIL_FRACTION * (1 - (k - arcFrom + 0.5) / (trailTo - arcFrom))
      }
    }
  }
}

build()

export interface TrackSample {
  speedMs: number
  /** 0..1. */
  throttle: number
  /** 0..1. */
  brake: number
  /** Radians, positive = left. */
  steerRad: number
  abs: boolean
}

export function createTrackSample(): TrackSample {
  return { speedMs: 0, throttle: 0, brake: 0, steerRad: 0, abs: false }
}

function lerpAt(a: Float32Array, i0: number, i1: number, f: number): number {
  const v0 = a[i0] ?? 0
  return v0 + ((a[i1] ?? 0) - v0) * f
}

/** Fills `out` with the profile at lap fraction `pct` (linear between samples, no allocation). */
export function sampleTrack(pct: number, out: TrackSample): void {
  const x = (((pct % 1) + 1) % 1) * SAMPLES
  const i0 = Math.floor(x) % SAMPLES
  const i1 = (i0 + 1) % SAMPLES
  const f = x - Math.floor(x)
  out.speedMs = lerpAt(speedMs, i0, i1, f)
  out.throttle = lerpAt(throttleAt, i0, i1, f)
  out.brake = lerpAt(brakeAt, i0, i1, f)
  out.steerRad = lerpAt(steerAt, i0, i1, f)
  out.abs = absAt[i0] === 1
}

/** Gear for a speed on track (2nd to 6th). */
export function gearFor(speed: number): number {
  const kmh = speed * 3.6
  let gear = 2
  for (const up of UPSHIFT_KMH) if (kmh >= up) gear++
  return gear
}
