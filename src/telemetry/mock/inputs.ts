/**
 * The player's pedals, wheel, gear and speed: the track profile at the
 * player's spot on a racing lap, gentler on the cool-down lap, and scripted
 * through a pit stop (a late limiter on pit road, clutch in to leave the box).
 */
import { clamp } from '@shared/num'
import { lerp, smooth01 } from './math'
import {
  CREEP_FROM_S,
  LAUNCH_CLUTCH_S,
  PIT_SPEED_MS,
  PLAYER_STALL_S,
  STALL_CLUTCH_S,
  STALL_READY_S
} from './pitLane'
import type { PlayerPitStop } from './pitLane'
import { createTrackSample, gearFor, sampleTrack } from './track'

/** Lap-rate scale of a cool-down lap (finishers): ~1.4x the lap time. */
export const COOL_DOWN_PACE = 0.72
/** Clutch dip on each downshift (heel-and-toe blip). */
const CLUTCH_BLIP_S = 0.14
/** Below this speed on pit road: first gear (m/s). */
const FIRST_GEAR_MS = 8.3
/** Below this speed when stopping in the box: clutch in (m/s). */
const CLUTCH_IN_MS = 4

export class PlayerInputs {
  throttle = 0
  brake = 0
  /** 1 = engaged (pedal up), 0 = pedal fully pressed. */
  clutch = 1
  steer = 0
  gear = 0
  /** m/s. */
  speed = 0
  abs = false
  private readonly sample = createTrackSample()
  private clutchBlipAtS = -Infinity

  /**
   * `pct`: the player's lap fraction; `t`: seconds since the start (for the
   * wobble); `paceScale`: lap-rate scale (1 racing, COOL_DOWN_PACE cooling down).
   */
  update(pct: number, t: number, pit: PlayerPitStop, paceScale: number): void {
    sampleTrack(pct, this.sample)
    const steerWobble = 0.01 * Math.sin(t * 5.3) + 0.005 * Math.sin(t * 12.7)
    if (pit.phase === 'none') this.drive(t, paceScale, steerWobble)
    else this.drivePit(t, pit, steerWobble)
  }

  private drive(t: number, paceScale: number, steerWobble: number): void {
    const s = this.sample
    // A human foot: partial positions wobble a little, full and zero stay put.
    let throttle = s.throttle
    if (throttle > 0.02 && throttle < 0.98) {
      throttle = clamp(throttle + 0.025 * Math.sin(t * 9.1) + 0.015 * Math.sin(t * 23.3), 0, 1)
    }
    let brake = s.brake
    if (brake > 0.02) brake = clamp(brake + 0.015 * Math.sin(t * 17.9), 0, 1)
    // Cooling down: the same lines, with softer pedals.
    const cool = paceScale < 1 ? clamp((1 - paceScale) / (1 - COOL_DOWN_PACE), 0, 1) : 0
    if (cool > 0) {
      throttle *= 1 - 0.55 * cool
      brake *= 1 - 0.6 * cool
    }
    const speed = s.speedMs * paceScale
    this.shift(gearFor(speed), t)
    this.throttle = throttle
    this.brake = brake
    this.steer = s.steerRad + steerWobble
    this.speed = speed
    this.abs = s.abs && brake > 0.5 && cool === 0
  }

  private drivePit(t: number, pit: PlayerPitStop, steerWobble: number): void {
    const v = pit.speedMs
    this.abs = false
    this.steer = steerWobble
    this.speed = v
    switch (pit.phase) {
      case 'approach':
        this.throttle = 0
        this.brake = 0.62 + 0.015 * Math.sin(t * 17.9)
        this.shift(gearFor(v), t)
        break
      case 'lane-in':
        if (pit.boxBraking) {
          // Braking into the box: clutch in just before stopping.
          this.set(0, 0.35, v < CLUTCH_IN_MS ? 0 : 1, v < FIRST_GEAR_MS ? 1 : 2)
        } else if (pit.limiter) {
          // Flat out against the limiter (still coasting down to it right after pressing it).
          this.set(1, 0, 1, 2)
        } else {
          // No limiter yet: rolling just under the limit, then creeping over it.
          this.set(pit.phaseS < CREEP_FROM_S ? 0.12 : 0.45, 0, 1, 2)
        }
        break
      case 'stall': {
        this.speed = 0
        const st = pit.phaseS
        if (st < STALL_CLUTCH_S) this.set(0, 0.5, 0, 1)
        else if (st < PLAYER_STALL_S - STALL_READY_S) this.set(0, 0.3, 1, 0)
        else this.set(0.2, 0.3, 0, 1)
        break
      }
      case 'lane-out': {
        // Pulling away: the clutch comes up while the throttle opens.
        const clutch = smooth01(pit.phaseS / LAUNCH_CLUTCH_S)
        const throttle = v < PIT_SPEED_MS - 0.05 ? lerp(0.45, 1, clamp(v / PIT_SPEED_MS, 0, 1)) : 1
        this.set(throttle, 0, clutch, v < FIRST_GEAR_MS ? 1 : 2)
        break
      }
      case 'rejoin': {
        const s = this.sample
        const blend = pit.rejoinBlend
        const speed = lerp(v, s.speedMs, blend)
        this.throttle = lerp(1, s.throttle, blend)
        this.brake = s.brake * blend
        this.steer = lerp(steerWobble, s.steerRad + steerWobble, blend)
        this.speed = speed
        this.shift(gearFor(speed), t)
        break
      }
      case 'none':
        break
    }
  }

  /** Pedals and gear chosen by hand (pit stop): no downshift blip. */
  private set(throttle: number, brake: number, clutch: number, gear: number): void {
    this.throttle = throttle
    this.brake = brake
    this.clutch = clutch
    this.gear = gear
    this.clutchBlipAtS = -Infinity
  }

  /** Gear by speed, with a clutch dip on each downshift. */
  private shift(gear: number, t: number): void {
    if (gear < this.gear) this.clutchBlipAtS = t
    const blip = t - this.clutchBlipAtS
    this.clutch =
      blip >= 0 && blip < CLUTCH_BLIP_S ? 1 - 0.85 * Math.sin((Math.PI * blip) / CLUTCH_BLIP_S) : 1
    this.gear = gear
  }
}
