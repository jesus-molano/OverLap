/**
 * What the fuel widget and the alerts band learn from every tick (60 Hz), whatever the widgets'
 * rates and rules: the litres each of your laps used, measured at the S/F line, the fuel the lap
 * in progress started with (the plan projects from it) and the tyre readings of your stops. One
 * FuelTracker per telemetry loop, fed by ProviderSet.observe.
 *
 * A lap counts for the average when the RaceModel calls it clean (no pit road, caution, tow or
 * reset, off-track excursion or stop on track, not the race's first lap or a lap it joined
 * mid-way) and, as far as this tracker saw, you drove all of it (IsOnTrack: not a teammate's
 * stint), nothing was refuelled, nothing jumped and it used a plausible amount. Any lap driven
 * without a refuel, tow or jump is still your "last lap" (a caution lap, an in lap).
 *
 * The clean laps are kept per car and track: a new session of the same car and track (practice,
 * then the race) starts with the last session's laps as an estimate ("carried") until it has
 * one of its own. The laps are your own car's (resolvePlayerCarIdx), never the one on camera the
 * race view follows at a replay's live point; replay frames only break the lap in progress.
 *
 * Tyres: iRacing measures the tread only while the car sits in its pit stall. The reading of a
 * stay is the most worn one seen during it that differs from what the variables held when the
 * car arrived (a reading of brand new tyres alone says nothing and is dropped).
 */
import { isFiniteNumber } from '../num'
import type { RaceView } from '../race/raceView'
import { resolvePlayerCarIdx } from '../sessionInfo'
import { isReplayPlaying } from '../simScreen'
import type { TelemetryFrame } from '../telemetry'
import type { SessionMeta, TyreReading } from '../types'

export const FUEL_TRACK = {
  /** Clean laps kept per session (the average uses the last FuelOptions.avgLaps of them). */
  maxSamples: 10,
  /** Fuel this far (L) above the lap's lowest: a refuel (or a reset), the lap does not count. */
  refuelL: 0.3,
  /** A lap that used less than this (L) measured nothing (fuel use off, the sim paused). */
  minLapL: 0.05,
  /** A distance step in one tick beyond this (laps) is a tow or a reset. */
  jumpLaps: 0.1,
  /** Tread readings closer than this (0..1) are the same reading. */
  wearEps: 0.001,
  /** Every tyre at or above this (0..1) is a fresh set: nothing measured. */
  freshWear: 0.995
} as const

/** The tread variables of each tyre (left, middle and right band). */
const WEAR_VARS = [
  ['LFwearL', 'LFwearM', 'LFwearR'],
  ['RFwearL', 'RFwearM', 'RFwearR'],
  ['LRwearL', 'LRwearM', 'LRwearR'],
  ['RRwearL', 'RRwearM', 'RRwearR']
] as const

type Wear = readonly [number, number, number, number]
type Band3 = readonly [number, number, number]
type Bands = readonly [Band3, Band3, Band3, Band3]

/**
 * Tread left in every band of every tyre (front left, front right, rear left, rear right; each
 * left, middle, right), 0..1. The SDK's '%' is read as 0..1 like every '%' variable; a value
 * above 1 as already in percent. Null when any band is missing or not a number.
 */
export function tyreBands(frame: TelemetryFrame): Bands | null {
  const out: Band3[] = []
  for (const names of WEAR_VARS) {
    const tyre: number[] = []
    for (const name of names) {
      const v = frame[name][0]
      if (!isFiniteNumber(v) || v < 0) return null
      tyre.push(Math.min(1, v > 1 ? v / 100 : v))
    }
    out.push(tyre as unknown as Band3)
  }
  return out as unknown as Bands
}

/** Tread left per tyre, 0..1: the most worn of its three bands. */
const wearOf = (b: Bands): Wear => b.map((t) => Math.min(...t)) as unknown as Wear

/** tyreBands' tyres, each as its most worn band; null when any band is missing. */
export function tyreWear(frame: TelemetryFrame): Wear | null {
  const b = tyreBands(frame)
  return b === null ? null : wearOf(b)
}

const pct = (v: number): number => Math.round(v * 100)

function sameWear(a: Wear, b: Wear): boolean {
  return a.every((v, i) => Math.abs(v - (b[i] ?? NaN)) < FUEL_TRACK.wearEps)
}

const meanOf = (w: Wear): number => (w[0] + w[1] + w[2] + w[3]) / 4

/** The clean laps of the average: this session's, or the last session's while it has none. */
export interface FuelSamples {
  /** Litres per lap, newest first. */
  readonly laps: readonly number[]
  /** They come from an earlier session with the same car and track. */
  readonly carried: boolean
}

const NO_SAMPLES: FuelSamples = Object.freeze({ laps: Object.freeze([]), carried: false })

/** The lap in progress as it started at the S/F line. */
export interface LapStart {
  /** Laps completed at the line (the floor of the race distance during the lap). */
  readonly lap: number
  /** Litres in the tank there. */
  readonly fuelL: number
}

export class FuelTracker {
  /** Car (CarID, 0 before the first tick with one) and track layout the laps belong to. */
  private carId = 0
  private trackId = Number.NaN
  private trackConfig = ''
  /** The session they belong to (SubSessionID and SessionNum, NaN before the first tick). */
  private subSessionId = Number.NaN
  private sessionNum = Number.NaN
  /** This session's clean laps, newest first. */
  private current: number[] = []
  /** The last session's, for the same car and track. */
  private carried: number[] = []
  private samplesView: FuelSamples = NO_SAMPLES
  private last: number | null = null
  /** `last` was a clean lap: the newest of `current`. */
  private lastClean = false

  /** floor(distance) at the S/F crossing the lap in progress started at; NaN: none. */
  private anchorLap = Number.NaN
  private anchorFuel = Number.NaN
  /** The lap in progress can be measured (it started at the line, nothing spoilt it yet). */
  private lapOk = false
  private lapMinFuel = Infinity
  private prevD = Number.NaN
  /** The line the lap in progress started at (lapStart). */
  private start: LapStart | null = null

  private reading: TyreReading | null = null
  /** In the pit stall: what the tread variables held on arrival, and the stay's most worn. */
  private stallStart: Wear | null = null
  private stallBest: Wear | null = null
  private inStall = false

  /**
   * A reconnect or a new session (the providers' reset): the lap in progress is not measured.
   * What was measured stays; a new session moves it aside when its first tick arrives.
   */
  reset(): void {
    this.breakLap()
    this.inStall = false
    this.stallStart = null
    this.stallBest = null
  }

  /** The clean laps to average. Same object while they are unchanged. */
  get samples(): FuelSamples {
    return this.samplesView
  }

  /** Litres of your last lap driven without a refuel, tow or jump; null otherwise. */
  get lastLapL(): number | null {
    return this.last
  }

  /** That last lap was a clean one: the newest of `samples` (of this session, this car). */
  get lastLapClean(): boolean {
    return this.last !== null && this.lastClean
  }

  /** The last tyre reading of this session, null before any. */
  get tyres(): TyreReading | null {
    return this.reading
  }

  /**
   * The fuel at the S/F line the lap in progress started at; null when this tracker did not see
   * that line (it joined mid-lap), you are not driving, or a refuel, tow or reset changed the
   * fuel or the distance since. The plan projects the fuel from it at the average: a lap does
   * not burn evenly (full throttle, braking), and planning on the fuel of the moment would move
   * the window's last lap, and the stop alert with it, back and forth within a lap.
   */
  get lapStart(): LapStart | null {
    return this.start
  }

  observe(frame: TelemetryFrame, session: SessionMeta, race: RaceView): void {
    if (isReplayPlaying(frame)) {
      this.breakLap()
      return
    }
    const player = resolvePlayerCarIdx(frame, session)
    const car = player >= 0 ? race.car(player) : undefined
    this.follow(session, player, frame.SessionNum[0])
    const fuel = frame.FuelLevel[0]
    const d = car?.distance ?? Number.NaN
    if (!car || !Number.isFinite(d)) {
      this.breakLap()
      return
    }
    this.observeTyres(frame, Math.floor(d))
    if (!isFiniteNumber(fuel) || fuel < 0) {
      this.breakLap()
      return
    }

    const driving = frame.IsOnTrack[0] === true
    const towed = (frame.PlayerCarTowTime[0] ?? 0) > 0
    const jumped = Number.isFinite(this.prevD) && Math.abs(d - this.prevD) > FUEL_TRACK.jumpLaps
    this.prevD = d
    const lap = Math.floor(d)
    if (!Number.isFinite(this.anchorLap)) {
      // First sight, mid-lap: nothing to measure until the next line.
      this.startLap(lap, fuel, false)
      return
    }
    if (!driving || towed || jumped || fuel > this.lapMinFuel + FUEL_TRACK.refuelL) {
      this.lapOk = false
      this.start = null
    }
    this.lapMinFuel = Math.min(this.lapMinFuel, fuel)

    if (lap === this.anchorLap + 1) {
      this.closeLap(lap, fuel, race, player)
      const ok = driving && !towed && !jumped
      this.startLap(lap, fuel, ok)
      if (ok) this.start = Object.freeze({ lap, fuelL: fuel })
    } else if (lap > this.anchorLap + 1 || lap < this.anchorLap - 1) {
      // A crossing missed or a lap gone back (a reset): start over from here.
      this.last = null
      this.startLap(lap, fuel, false)
    }
    // One lap back is the lap counter jittering at the line: wait for it to come forward again.
  }

  /**
   * A new car or track forgets every lap (an unknown car changes nothing); a new session keeps
   * the last one's as an estimate.
   */
  private follow(session: SessionMeta, player: number, sessionNum: number | undefined): void {
    const carId = player >= 0 ? (session.drivers.get(player)?.carId ?? 0) : 0
    if (
      carId > 0 &&
      (carId !== this.carId ||
        session.trackId !== this.trackId ||
        session.trackConfig !== this.trackConfig)
    ) {
      this.carId = carId
      this.trackId = session.trackId
      this.trackConfig = session.trackConfig
      this.current = []
      this.carried = []
      this.lastClean = false
      this.updateSamples()
    }
    const num = isFiniteNumber(sessionNum) ? sessionNum : -1
    if (session.subSessionId !== this.subSessionId || num !== this.sessionNum) {
      this.subSessionId = session.subSessionId
      this.sessionNum = num
      if (this.current.length > 0) this.carried = this.current
      this.current = []
      this.last = null
      this.reading = null
      this.breakLap()
      this.updateSamples()
    }
  }

  private closeLap(lap: number, fuel: number, race: RaceView, player: number): void {
    const used = this.anchorFuel - fuel
    this.lastClean = false
    if (!this.lapOk || !(used >= FUEL_TRACK.minLapL)) {
      this.last = null
      return
    }
    this.last = used
    const rec = race.car(player)?.laps[0]
    if (rec === undefined || rec.lap !== lap || !rec.clean) return
    this.current = [used, ...this.current].slice(0, FUEL_TRACK.maxSamples)
    this.lastClean = true
    this.updateSamples()
  }

  /** A lap is followed from `lap` with `fuel`; the caller sets `start` when that is the line. */
  private startLap(lap: number, fuel: number, ok: boolean): void {
    this.anchorLap = lap
    this.anchorFuel = fuel
    this.lapOk = ok
    this.lapMinFuel = fuel
    this.start = null
  }

  private breakLap(): void {
    this.anchorLap = Number.NaN
    this.anchorFuel = Number.NaN
    this.lapOk = false
    this.lapMinFuel = Infinity
    this.prevD = Number.NaN
    this.start = null
  }

  private updateSamples(): void {
    const own = this.current.length > 0
    const laps = own ? this.current : this.carried
    this.samplesView =
      laps.length === 0
        ? NO_SAMPLES
        : Object.freeze({ laps: Object.freeze([...laps]), carried: !own })
  }

  private observeTyres(frame: TelemetryFrame, lapsCompleted: number): void {
    if (frame.PlayerCarInPitStall[0] !== true) {
      this.inStall = false
      this.stallStart = null
      this.stallBest = null
      return
    }
    const bands = tyreBands(frame)
    const wear = bands === null ? null : wearOf(bands)
    if (!this.inStall) {
      this.inStall = true
      this.stallStart = wear
      this.stallBest = null
      return
    }
    if (wear === null || bands === null) return
    if (this.stallStart !== null && sameWear(wear, this.stallStart)) return
    if (wear.every((v) => v >= FUEL_TRACK.freshWear)) return
    if (this.stallBest !== null && meanOf(wear) >= meanOf(this.stallBest)) return
    this.stallBest = wear
    this.reading = Object.freeze({
      lap: Math.max(0, lapsCompleted),
      wearPct: Object.freeze(wear.map(pct)) as unknown as TyreReading['wearPct'],
      bands: Object.freeze(
        bands.map((t) => Object.freeze(t.map(pct)))
      ) as unknown as TyreReading['bands']
    })
  }
}
