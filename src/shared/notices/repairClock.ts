/**
 * The real seconds a repair has left, estimated from how fast iRacing's own figure falls.
 *
 * PitRepairLeft / PitOptRepairLeft are the crew's time: OverLap shows them within one provider
 * period (lights.repairCountdown.test.ts), yet in a live stop they fell about 1 s every several
 * seconds, so the crew's second is not a real one. While the car stands in its stall being
 * serviced, the figure is sampled on every tick; its fall over the last REPAIR_CLOCK.windowS of
 * the current run (at least REPAIR_CLOCK.minSpanS of it) is a rate, crew seconds per real
 * second, and the figure divided by it the real seconds left.
 *
 * The rules:
 * - Only stopped in your stall with the service on (PitstopActive; a sim without it counts as
 *   on, the fall itself being the evidence), in the car, not towed, not in a replay. Anywhere
 *   else nothing is estimated (null): the crew's figure is what there is.
 * - A run is the figure falling with no still stretch of REPAIR_CLOCK.pauseS or more. The rate
 *   is measured within the current run, fall to fall (a still stretch never dilutes it).
 * - Unknown (null) until a run spans REPAIR_CLOCK.minSpanS. A figure that only changes in steps
 *   further apart than pauseS never makes one: it stays unknown.
 * - A pause (the figure still for pauseS) keeps the rate last measured in this stop, so the
 *   estimate stands; the next run measures again.
 * - Never negative, never rising within a stop: what it shows can only stay or fall.
 * - The figure rising (new damage), the clock going back or the conditions breaking start over.
 *
 * Unverified live (see README): whether the figure falls smoothly or in steps, and whether the
 * crew's pace holds through a stop (fuel and tyres alongside, fast repair).
 */
import { finiteOr } from '../num'
import { TrackLocation, type TelemetryFrame } from '../telemetry'

export const REPAIR_CLOCK = {
  /** The fall is measured over the last this many seconds of the run. */
  windowS: 3,
  /** And needs at least this much of it (s) before it says anything. */
  minSpanS: 2,
  /** The figure still for this long (s) is a pause, not a slow fall. */
  pauseS: 1,
  /** Slower than this (m/s) the car stands still. */
  stillMs: 0.5,
  /** A rise of more than this (s) is new damage, not noise: start over. */
  riseS: 0.05
} as const

/** Which repair figure a clock follows. */
export type RepairFigure = 'PitRepairLeft' | 'PitOptRepairLeft'

/** Stopped in your stall with the service on: where the crew's figure falls. */
export function beingServiced(frame: TelemetryFrame): boolean {
  if (frame.IsOnTrack[0] !== true || frame.IsReplayPlaying[0] === true) return false
  if (finiteOr(frame.PlayerCarTowTime[0], 0) > 0) return false
  const inStall =
    frame.PlayerCarInPitStall[0] === true ||
    frame.PlayerTrackSurface[0] === TrackLocation.InPitStall
  if (!inStall) return false
  // A sim without PitstopActive (an empty array) does not block: the fall is the evidence.
  if (frame.PitstopActive[0] === false) return false
  return Math.abs(finiteOr(frame.Speed[0], 0)) < REPAIR_CLOCK.stillMs
}

/** One repair figure's estimate. observe() on every tick; realS() at any rate. */
export class RepairClock {
  /**
   * The falls of the current run within its last windowS: SessionTime and the figure just after
   * each. Measured fall to fall, so a figure that changes in steps counts each step once.
   */
  private readonly ts: number[] = []
  private readonly vs: number[] = []
  /** The last tick seen in this stop (NaN: none) and the figure then. */
  private lastT = Number.NaN
  private lastV = Number.NaN
  /** Crew seconds per real second last measured in this stop (NaN: none yet). */
  private rate = Number.NaN
  /** The last estimate given in this stop (NaN: none): it never rises. */
  private shown = Number.NaN

  constructor(private readonly figure: RepairFigure) {}

  reset(): void {
    this.ts.length = 0
    this.vs.length = 0
    this.lastT = Number.NaN
    this.lastV = Number.NaN
    this.rate = Number.NaN
    this.shown = Number.NaN
  }

  observe(frame: TelemetryFrame, serviced: boolean): void {
    const t = frame.SessionTime[0]
    const v = frame[this.figure][0]
    if (
      !serviced ||
      t === undefined ||
      !Number.isFinite(t) ||
      v === undefined ||
      !Number.isFinite(v) ||
      v <= 0
    ) {
      this.reset()
      return
    }
    // The clock went back, or more damage: this stop's measure says nothing about it.
    if (t < this.lastT || v > this.lastV + REPAIR_CLOCK.riseS) this.reset()
    // The same tick twice (a paused sim): nothing new.
    if (t === this.lastT) return
    const fell = v < this.lastV
    this.lastT = t
    this.lastV = v
    if (fell) this.fall(t, v)
    if (!(this.rate > 0)) return
    const raw = v / this.rate
    this.shown = Number.isNaN(this.shown) ? raw : Math.min(this.shown, raw)
  }

  /** A fall: in the current run (a new one after a pause), and the run's rate once long enough. */
  private fall(t: number, v: number): void {
    const n = this.ts.length
    if (n > 0 && t - (this.ts[n - 1] as number) >= REPAIR_CLOCK.pauseS) {
      this.ts.length = 0
      this.vs.length = 0
    }
    this.ts.push(t)
    this.vs.push(v)
    while (this.ts.length > 1 && t - (this.ts[0] as number) > REPAIR_CLOCK.windowS) {
      this.ts.shift()
      this.vs.shift()
    }
    const span = t - (this.ts[0] as number)
    const fall = (this.vs[0] as number) - v
    if (span >= REPAIR_CLOCK.minSpanS && fall > 0) this.rate = fall / span
  }

  /** The real seconds left (> 0), or null when unknown (see the rules). */
  realS(): number | null {
    return this.shown > 0 ? this.shown : null
  }
}
