/**
 * Wrong way, for the alerts widget: your lap fraction going backwards while you drive forwards
 * at speed (a car turned round after a spin). Counted in metres along the lap, so the rate the
 * provider runs at does not matter. Pure.
 */
import { isValidPct } from '../lapDist'

export const WRONG_WAY = {
  /** Slower than this (m/s, 30 km/h) nothing counts: turning round, crawling after a spin. */
  minSpeedMs: 30 / 3.6,
  /** Metres backwards along the lap before it is the wrong way (under a second at speed). */
  triggerM: 20,
  /** Metres forwards that end it. */
  clearM: 10,
  /** A step longer than this lap fraction is a reset or a tow, not driving: skipped. */
  maxStepPct: 0.05,
  /** Lap length when the session does not give one (m): a usual road course. */
  defaultTrackM: 4000
} as const

export interface WrongWayInput {
  /** LapDistPct (undefined or out of 0..1 when unknown). */
  readonly pct: number | undefined
  readonly speedMs: number
  /** -1 reverse, 0 neutral, 1.. forward. */
  readonly gear: number
  readonly onPitRoad: boolean
  /** IsOnTrack: in the car with the physics running. */
  readonly inCar: boolean
  readonly trackLengthM: number | null
}

/** One per alerts provider. update() at every compute; resume() after a gap in the computes. */
export class WrongWayDetector {
  private prevPct = Number.NaN
  private backM = 0
  private fwdM = 0
  private on = false

  resume(): void {
    this.prevPct = Number.NaN
    this.clear()
  }

  /** True while driving the wrong way. */
  update(i: WrongWayInput): boolean {
    if (!isValidPct(i.pct)) {
      this.resume()
      return false
    }
    const prev = this.prevPct
    this.prevPct = i.pct
    // Reversing (on purpose), neutral (rolling back after a spin, unknown which way the car
    // points), slow, on pit road or out of the car: nothing to say.
    const driving =
      i.inCar && !i.onPitRoad && i.gear >= 1 && Math.abs(i.speedMs) >= WRONG_WAY.minSpeedMs
    if (!driving) {
      this.clear()
      return false
    }
    const step = i.pct - prev
    // The first sample, the S/F line (the fraction wraps from ~1 to ~0) and jumps are skipped,
    // keeping what was counted so far.
    if (Number.isNaN(step) || Math.abs(step) > WRONG_WAY.maxStepPct) return this.on
    const lengthM =
      i.trackLengthM !== null && i.trackLengthM > 0 ? i.trackLengthM : WRONG_WAY.defaultTrackM
    const m = step * lengthM
    if (m < 0) {
      this.backM -= m
      this.fwdM = 0
      if (this.backM >= WRONG_WAY.triggerM) this.on = true
    } else if (m > 0) {
      this.fwdM += m
      if (this.fwdM >= WRONG_WAY.clearM) {
        this.backM = 0
        this.on = false
      }
    }
    return this.on
  }

  private clear(): void {
    this.backM = 0
    this.fwdM = 0
    this.on = false
  }
}
