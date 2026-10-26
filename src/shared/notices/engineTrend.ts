/**
 * Engine temperature trend, for the warning lights (engine.ts): water or oil staying well above
 * your own reference, before the sim's warning light comes on. The reference is the average of your last
 * clean laps this session (each lap's mean reading), so it is your car on this track today, not a
 * fixed threshold. Only a lap like the one before it counts (within ENGINE_TREND.stableC): the
 * laps of a warm-up, still climbing, would make a reference below your normal. A tow or a jump of
 * a reading (a repair cools the oil by 12 °C at once) starts the reference over: the engine is
 * not the one it was built on. Following another car closely heats the engine without any
 * damage: the notice says so when you spent most of the time behind one. Pure.
 *
 * WaterTemp and OilTemp are per car model: a reading the car does not have (NaN) is skipped.
 */
export const ENGINE_TREND = {
  /** The reference averages this many of your last clean laps... */
  refLaps: 5,
  /** ...and needs at least this many. */
  minLaps: 2,
  /** A lap needs this many samples to be a reference (a few seconds at the widgets' 10 Hz). */
  minSamples: 20,
  /** A lap is a reference only when its mean is this close (°C) to the mean of the lap before. */
  stableC: 1,
  /** A reading moving more than this (°C) from one tick to the next: a repair or a reset. */
  jumpC: 5,
  /** Ticks further apart than this (s) are not compared for a jump. */
  jumpGapS: 1,
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

/**
 * A temperature well above your own reference (whole °C) for a while; `draft`: you spent most of
 * that time close behind another car, which heats the engine without any damage.
 */
export interface TrendNotice {
  readonly kind: 'engineTrend'
  readonly fluid: Fluid
  readonly tempC: number
  readonly deltaC: number
  readonly draft: boolean
}

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

const NO_MEANS: Readonly<Record<Fluid, number>> = Object.freeze({
  water: Number.NaN,
  oil: Number.NaN
})

const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length

/**
 * One per EngineMonitor. update() once per read tick; observe() on every tick (a tow or a repair
 * may come while the widgets are hidden); resume() after a gap in the reads (the reference
 * stays: it is the session's); reset() for a new session.
 */
export class EngineTrend {
  private readonly fluids: Readonly<Record<Fluid, FluidState>> = {
    water: fluidState(),
    oil: fluidState()
  }
  private pending: PendingLap[] = []
  /** Means of the last lap closed (NaN unless sampled whole): the next one must be like it. */
  private prevMeans: Readonly<Record<Fluid, number>> = NO_MEANS
  /** CarIdxLapCompleted during the lap being sampled, NaN when unknown. */
  private lap = Number.NaN
  /** That lap was sampled from its start (its S/F crossing was seen). */
  private fromStart = false
  /** That lap had a warning light or a reading riseC above: no reference. */
  private tainted = false
  private lastNow = Number.NaN
  private draft = 0
  /** The readings of the last tick observe() saw, and when. */
  private seenT = Number.NaN
  private seenWater = Number.NaN
  private seenOil = Number.NaN
  /** Each fluid's notice at the last update (null: not above its reference). */
  private readonly notices: Record<Fluid, TrendNotice | null> = { water: null, oil: null }

  resume(): void {
    this.lap = Number.NaN
    this.fromStart = false
    this.lastNow = Number.NaN
    this.draft = 0
    this.prevMeans = NO_MEANS
    for (const k of FLUIDS) {
      const f = this.fluids[k]
      f.smooth = Number.NaN
      f.aboveSince = Number.NaN
      f.active = false
      this.notices[k] = null
    }
    this.clearLap()
  }

  reset(): void {
    this.restart()
    this.seenT = Number.NaN
    this.seenWater = Number.NaN
    this.seenOil = Number.NaN
  }

  /**
   * Every tick. While towed (PlayerCarTowTime > 0), or when a reading jumps more than jumpC from
   * one tick to the next, the engine is not the one the reference was built on (repaired, reset):
   * it starts over, and so does the lap being sampled.
   */
  observe(now: number, towing: boolean, water: number, oil: number): void {
    const dt = now - this.seenT
    const jumped =
      dt > 0 &&
      dt <= ENGINE_TREND.jumpGapS &&
      (Math.abs(water - this.seenWater) > ENGINE_TREND.jumpC ||
        Math.abs(oil - this.seenOil) > ENGINE_TREND.jumpC)
    this.seenT = now
    this.seenWater = water
    this.seenOil = oil
    if (towing || jumped) this.restart()
  }

  /** The reference of a fluid (°C), null until minLaps clean laps. */
  reference(fluid: Fluid): number | null {
    const refs = this.fluids[fluid].refs
    return refs.length >= ENGINE_TREND.minLaps ? mean(refs) : null
  }

  /** One fluid's notice at the last update(): null while it is not well above its reference. */
  notice(fluid: Fluid): TrendNotice | null {
    return this.notices[fluid]
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
      this.notices[fluid] = null
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
      const notice: TrendNotice = {
        kind: 'engineTrend',
        fluid,
        tempC: Math.round(f.smooth),
        deltaC: Math.round(delta),
        draft: this.draft >= ENGINE_TREND.draftShare
      }
      this.notices[fluid] = notice
      if (delta > bestDelta) {
        bestDelta = delta
        best = notice
      }
    }
    return best
  }

  /** Nothing of the engine before: no reference, nothing waiting to be one, a new lap. */
  private restart(): void {
    this.resume()
    this.pending = []
    for (const k of FLUIDS) this.fluids[k].refs.length = 0
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
    // One lap more, sampled whole: a reference candidate if it is like the lap before. Anything
    // else (the first lap seen, a reset, a jump) only starts a new lap.
    const means =
      next && this.fromStart
        ? { water: this.lapMean(this.fluids.water), oil: this.lapMean(this.fluids.oil) }
        : NO_MEANS
    if (!this.tainted) {
      const stable = {
        water: stableMean(means.water, this.prevMeans.water),
        oil: stableMean(means.oil, this.prevMeans.oil)
      }
      if (Number.isFinite(stable.water) || Number.isFinite(stable.oil)) {
        this.pending.push({ lap: laps, means: stable, at: i.now })
      }
    }
    this.prevMeans = means
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

/** A lap mean within stableC of the lap before it, else NaN (NaN when either is unknown). */
function stableMean(v: number, prev: number): number {
  return Math.abs(v - prev) <= ENGINE_TREND.stableC ? v : Number.NaN
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
