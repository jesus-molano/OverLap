/**
 * The mock player's fuel, pit menu, tyre readings and session limits (the fuel widget's
 * variables), stepped by MockRace with the distance the player drove.
 *
 * A GT3 with an 85 L cap (a 100 L tank at 85 %, MOCK_FUEL) burns ~2.95 L a lap, a little more or
 * less from lap to lap, less under the caution and in the pit lane. Each session starts with what
 * reaches the scripted pit stop (MOCK_TIMELINE.playerPitS) and a little more: the low fuel alert
 * comes on in the laps before it and the pit window closes on the in lap. In the stall the crew
 * measures the tyres (the tread variables change once, after a few seconds), puts in the pit
 * menu's 20 L and fits a new set (one of the four the session allows). Deterministic: no random
 * draws (the race's own sequences stay the same).
 */
import { frac } from '@shared/num'
import { PIT_APPROACH_PCT, PIT_IN_PCT } from './pitLane'

/** The variables this module writes (MockVars extends it). */
export interface MockFuelVars {
  FuelLevel: number[]
  FuelLevelPct: number[]
  PitSvFuel: number[]
  PitSvFlags: number[]
  PlayerCarInPitStall: boolean[]
  FastRepairAvailable: number[]
  FastRepairUsed: number[]
  TireSetsAvailable: number[]
  TireSetsUsed: number[]
  LFwearL: number[]
  LFwearM: number[]
  LFwearR: number[]
  RFwearL: number[]
  RFwearM: number[]
  RFwearR: number[]
  LRwearL: number[]
  LRwearM: number[]
  LRwearR: number[]
  RRwearL: number[]
  RRwearM: number[]
  RRwearR: number[]
}

export const MOCK_FUEL = {
  /** DriverCarFuelMaxLtr and DriverCarMaxFuelPct / CarClassMaxFuelPct of the GT3s. */
  tankL: 100,
  maxFuelFrac: 0.85,
  kgPerL: 0.75,
  /** Litres per lap at racing pace. */
  perLapL: 2.95,
  /** Lap-to-lap spread of the burn (fraction). */
  lapSpread: 0.012,
  /** Burn under the caution and on pit road (fraction of racing pace). */
  cautionBurn: 0.6,
  pitLaneBurn: 0.5,
  /** Laps of fuel beyond the pit entry at the session start. */
  reserveLaps: 0.55,
  /** The pit menu: 20 L, four tyres and fuel ticked (irsdk_PitSvFlags 0x0f | 0x10). */
  boxL: 20,
  boxFlags: 0x1f,
  /** Refuelling rate in the stall (L/s), from this many seconds after stopping. */
  refuelLps: 2.5,
  refuelFromS: 2,
  /** The crew's tread reading this many seconds after stopping. */
  readingAtS: 3,
  /** Dry sets the session allows (CarClassDryTireSetLimit) and fast repairs (FastRepairsLimit). */
  tyreSets: 4,
  fastRepairs: 1
} as const

/** Tread left on the set the car carries into its stop, per tyre and band (left, middle, right). */
export const MOCK_WEAR: Readonly<Record<'LF' | 'RF' | 'LR' | 'RR', readonly number[]>> = {
  LF: [0.84, 0.81, 0.78],
  RF: [0.79, 0.76, 0.74],
  LR: [0.89, 0.88, 0.86],
  RR: [0.86, 0.84, 0.82]
}

const CAP_L = MOCK_FUEL.tankL * MOCK_FUEL.maxFuelFrac
/** The tank never quite runs dry: the mock keeps the car going. */
const MIN_L = 0.2

/** Litres per lap of distance on lap `lap` (laps completed), at racing pace. */
export function burnPerLap(lap: number): number {
  return MOCK_FUEL.perLapL * (1 + MOCK_FUEL.lapSpread * Math.sin(1.9 * Math.floor(lap) + 0.4))
}

/**
 * Fuel at the session start: what takes the player from `startDist` to the pit entry of its
 * stop (armed `pitS` seconds in, at a lap of `lapS`), plus MOCK_FUEL.reserveLaps.
 */
export function startFuelL(startDist: number, lapS: number, pitS: number): number {
  const armed = startDist + pitS / lapS
  const entry = Math.floor(armed) + PIT_IN_PCT + (frac(armed) > PIT_APPROACH_PCT ? 1 : 0)
  let litres = 0
  for (let d = startDist; d < entry; d = Math.floor(d) + 1) {
    litres += (Math.min(entry, Math.floor(d) + 1) - d) * burnPerLap(d)
  }
  return Math.min(CAP_L, litres + MOCK_FUEL.reserveLaps * MOCK_FUEL.perLapL)
}

/** Before the first step: a fresh set measured as new, nothing used yet. */
export function initialFuelVars(): MockFuelVars {
  return {
    FuelLevel: [0],
    FuelLevelPct: [0],
    PitSvFuel: [MOCK_FUEL.boxL],
    PitSvFlags: [MOCK_FUEL.boxFlags],
    PlayerCarInPitStall: [false],
    FastRepairAvailable: [MOCK_FUEL.fastRepairs],
    FastRepairUsed: [0],
    TireSetsAvailable: [MOCK_FUEL.tyreSets - 1],
    TireSetsUsed: [1],
    LFwearL: [1],
    LFwearM: [1],
    LFwearR: [1],
    RFwearL: [1],
    RFwearM: [1],
    RFwearR: [1],
    LRwearL: [1],
    LRwearM: [1],
    LRwearR: [1],
    RRwearL: [1],
    RRwearM: [1],
    RRwearR: [1]
  }
}

const CORNERS = ['LF', 'RF', 'LR', 'RR'] as const
/** The tread variables of each tyre, left to right. */
const WEAR_KEYS = {
  LF: ['LFwearL', 'LFwearM', 'LFwearR'],
  RF: ['RFwearL', 'RFwearM', 'RFwearR'],
  LR: ['LRwearL', 'LRwearM', 'LRwearR'],
  RR: ['RRwearL', 'RRwearM', 'RRwearR']
} as const satisfies Record<(typeof CORNERS)[number], readonly (keyof MockFuelVars)[]>

/** What the player did in a step. */
export interface FuelStep {
  /** Race distance driven (laps). */
  readonly fromDist: number
  readonly toDist: number
  readonly caution: boolean
  readonly onPitRoad: boolean
  /** Seconds stopped in the stall, -1 when not in it. */
  readonly stallS: number
}

export class MockFuel {
  private fuel: number
  /** Litres put in during this stall stay. */
  private added = 0
  private measured = false
  private changed = false
  private setsUsed = 1

  constructor(startL: number) {
    this.fuel = Math.max(MIN_L, Math.min(CAP_L, startL))
  }

  get litres(): number {
    return this.fuel
  }

  step(dtS: number, s: FuelStep): void {
    const moved = Math.max(0, s.toDist - s.fromDist)
    if (moved > 0) {
      const factor = s.onPitRoad ? MOCK_FUEL.pitLaneBurn : s.caution ? MOCK_FUEL.cautionBurn : 1
      this.fuel = Math.max(MIN_L, this.fuel - moved * burnPerLap(s.fromDist) * factor)
    }
    if (s.stallS < 0) {
      this.added = 0
      if (this.measured && !this.changed) {
        // The new set goes on as the car leaves.
        this.changed = true
        this.setsUsed++
      }
      return
    }
    if (s.stallS >= MOCK_FUEL.readingAtS) this.measured = true
    if (s.stallS >= MOCK_FUEL.refuelFromS) {
      const want = Math.min(MOCK_FUEL.boxL - this.added, CAP_L - this.fuel)
      const put = Math.max(0, Math.min(want, MOCK_FUEL.refuelLps * dtS))
      this.fuel += put
      this.added += put
    }
  }

  write(v: MockFuelVars, inStall: boolean): void {
    v.FuelLevel[0] = this.fuel
    v.FuelLevelPct[0] = this.fuel / MOCK_FUEL.tankL
    v.PlayerCarInPitStall[0] = inStall
    v.TireSetsUsed[0] = this.setsUsed
    v.TireSetsAvailable[0] = Math.max(0, MOCK_FUEL.tyreSets - this.setsUsed)
    if (!this.measured) return
    for (const corner of CORNERS) {
      WEAR_KEYS[corner].forEach((key, i) => {
        v[key][0] = MOCK_WEAR[corner][i] ?? 1
      })
    }
  }
}
