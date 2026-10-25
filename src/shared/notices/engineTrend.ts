/**
 * Engine temperature trend, for the alerts widget: water or oil staying well above your own
 * reference, before the sim's warning light comes on. The reference is the average of your last
 * clean laps this session (each lap's mean reading), so it is your car on this track today, not a
 * fixed threshold. Following another car closely heats the engine without any damage: the
 * notice says so when you spent most of the time behind one. Pure.
 *
 * WaterTemp and OilTemp are per car model: a reading the car does not have (NaN) is skipped.
 */
import type { AlertNotice } from '../types'

export const ENGINE_TREND = {
  /** The reference averages this many of your last clean laps... */
  refLaps: 5,
  /** ...and needs at least this many. */
  minLaps: 2,
  /** A lap needs this many samples to be a reference (a few seconds at the 10 Hz of the widget). */
  minSamples: 20,
  /** Above the reference by this much (°C)... */
  riseC: 5,
  /** ...for this long (s) raises the notice... */
  sustainS: 20,
  /** ...which ends when it is less than this above (°C). */
  clearC: 3,
  /** Time constant of the smoothed reading (s): a straight's spike is not a trend. */
  smoothS: 4,
  /** Time constant of the share of time spent close behind another car (s). */
  draftTauS: 30,
  /** That share from which the notice suggests slipstreaming. */
  draftShare: 0.5,
  /** A completed lap waits this long (s) for the RaceModel to say whether it was clean. */
  pendingS: 15
} as const

export type Fluid = 'water' | 'oil'

export interface EngineTrendInput {
  /** SessionTime (s). */
  readonly now: number
  /** CarIdxLapCompleted of the player (NaN when unknown). */
  readonly lapsCompleted: number
  /** WaterTemp / OilTemp (°C), NaN when the car does not have it. */
  readonly water: number
  readonly oil: number
  /** In the car, off pit road and moving: idling in the box heats an engine up too. */
  readonly driving: boolean
  /** Close behind another car right now. */
  readonly closeBehind: boolean
  /** An engine warning light is on: this lap is no reference. */
  readonly warning: boolean
  /** Whether a completed lap (its CarIdxLapCompleted number) was clean; null while not known. */
  readonly lapClean: (lap: number) => boolean | null
}

export type TrendNotice = Extract<AlertNotice, { kind: 'engineTrend' }>

const FLUIDS = ['water', 'oil'] as const satisfies readonly Fluid[]

interface FluidState {
  lapSum: number
  lapN: number
  /** Lap means of the last clean laps, oldest first. */
  readonly refs: number[]
  smooth: number
  aboveSince: number
  active: boolean
}

interface PendingLap {
  readonly lap: number
  readonly means: Readonly<Record<Fluid, number>>
  readonly at: number
}

function fluidState(): FluidState {
  return {
    lapSum: 0,
    lapN: 0,
    refs: [],
    smooth: Number.NaN,
    aboveSince: Number.NaN,
    active: false
  }
}

const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length

/**
 * One per alerts provider. update() at every compute; resume() after a gap in the computes (the
 * reference stays: it is the session's); reset() for a new session.
 */
export class EngineTrend {
  private readonly fluids: Readonly<Record<Fluid, FluidState>> = {
    water: fluidState(),
    oil: fluidState()
  }
  private pending: PendingLap[] = []
  /** CarIdxLapCompleted during the lap being sampled, NaN when unknown. */
  private lap = Number.NaN
  /** That lap was sampled from its start (its S/F crossing was seen). */
  private fromStart = false
  /** That lap had a warning light or a reading riseC above: no reference. */
  private tainted = false
  private lastNow = Number.NaN
  private draft = 0

  resume(): void {
    this.lap = Number.NaN
    this.fromStart = false
    this.lastNow = Number.NaN
    this.draft = 0
    for (const f of FLUIDS.map((k) => this.fluids[k])) {
      f.smooth = Number.NaN
      f.aboveSince = Number.NaN
      f.active = false
    }
    this.clearLap()
  }

  reset(): void {
    this.resume()
    this.pending = []
    for (const k of FLUIDS) this.fluids[k].refs.length = 0
  }

  /** The reference of a fluid (°C), null until minLaps clean laps. */
  reference(fluid: Fluid): number | null {
    const refs = this.fluids[fluid].refs
    return refs.length >= ENGINE_TREND.minLaps ? mean(refs) : null
  }

  /** The trend notice to show now (the fluid furthest above its reference), or null. */
  update(i: EngineTrendInput): TrendNotice | null {
    const dt = i.now - this.lastNow
    const step = dt > 0 && dt < 1 ? dt : 0
    this.lastNow = i.now
    this.followLaps(i)
    this.settlePending(i)
    if (i.warning) this.tainted = true
    if (i.driving && step > 0) {
      this.draft += ((i.closeBehind ? 1 : 0) - this.draft) * weight(step, ENGINE_TREND.draftTauS)
    }

    let best: TrendNotice | null = null
    let bestDelta = -Infinity
    for (const fluid of FLUIDS) {
      const f = this.fluids[fluid]
      const v = fluid === 'water' ? i.water : i.oil
      if (!Number.isFinite(v)) {
        f.smooth = Number.NaN
        f.aboveSince = Number.NaN
        f.active = false
        continue
      }
      if (i.driving) {
        f.lapSum += v
        f.lapN++
      }
      f.smooth = Number.isNaN(f.smooth)
        ? v
        : f.smooth + (v - f.smooth) * weight(step, ENGINE_TREND.smoothS)
      const ref = this.reference(fluid)
      const delta = ref === null ? Number.NaN : f.smooth - ref
      this.follow(f, delta, i)
      // A lap with a rise in it is not your normal either, even before the notice is up.
      if (f.active || delta >= ENGINE_TREND.riseC) this.tainted = true
      if (!f.active) continue
      if (delta > bestDelta) {
        bestDelta = delta
        best = {
          kind: 'engineTrend',
          fluid,
          tempC: Math.round(f.smooth),
          deltaC: Math.round(delta),
          draft: this.draft >= ENGINE_TREND.draftShare
        }
      }
    }
    return best
  }

  /** Raises or ends the notice of one fluid from its distance to the reference. */
  private follow(f: FluidState, delta: number, i: EngineTrendInput): void {
    // Sitting in the box or crawling down pit road is no trend; neither is an unknown reference.
    if (!i.driving || Number.isNaN(delta) || delta < ENGINE_TREND.clearC) {
      f.aboveSince = Number.NaN
      f.active = false
      return
    }
    if (delta < ENGINE_TREND.riseC) {
      // In between: a raised notice stays, a rise in progress starts over.
      if (!f.active) f.aboveSince = Number.NaN
      return
    }
    if (Number.isNaN(f.aboveSince)) f.aboveSince = i.now
    if (i.now - f.aboveSince >= ENGINE_TREND.sustainS) f.active = true
  }

  /** Closes the lap at each S/F crossing: its means wait for the RaceModel's verdict. */
  private followLaps(i: EngineTrendInput): void {
    const laps = i.lapsCompleted
    if (laps === this.lap) return
    const next = Number.isFinite(laps) && laps === this.lap + 1
    // One lap more, sampled whole: a reference candidate. Anything else (the first lap seen, a
    // reset, a jump) only starts a new lap.
    if (next && this.fromStart && !this.tainted) {
      const means = {
        water: this.lapMean(this.fluids.water),
        oil: this.lapMean(this.fluids.oil)
      }
      if (Number.isFinite(means.water) || Number.isFinite(means.oil)) {
        this.pending.push({ lap: laps, means, at: i.now })
      }
    }
    this.fromStart = next
    this.lap = Number.isFinite(laps) ? laps : Number.NaN
    this.clearLap()
  }

  private lapMean(f: FluidState): number {
    return f.lapN >= ENGINE_TREND.minSamples ? f.lapSum / f.lapN : Number.NaN
  }

  private settlePending(i: EngineTrendInput): void {
    if (this.pending.length === 0) return
    this.pending = this.pending.filter((p) => {
      const clean = i.lapClean(p.lap)
      if (clean === null) return i.now - p.at < ENGINE_TREND.pendingS
      if (clean) for (const k of FLUIDS) pushRef(this.fluids[k].refs, p.means[k])
      return false
    })
  }

  private clearLap(): void {
    this.tainted = false
    for (const k of FLUIDS) {
      this.fluids[k].lapSum = 0
      this.fluids[k].lapN = 0
    }
  }
}

function pushRef(refs: number[], v: number): void {
  if (!Number.isFinite(v)) return
  refs.push(v)
  if (refs.length > ENGINE_TREND.refLaps) refs.shift()
}

/** Weight of a step of `dt` seconds in an exponential average with time constant `tauS`. */
function weight(dt: number, tauS: number): number {
  return dt > 0 ? 1 - Math.exp(-dt / tauS) : 0
}
