/**
 * Your car's tank and the session's pit limits, from the session YAML (SessionMeta.pitSpec), and
 * what the tank may hold. Pure.
 *
 * Unverified, decided here only:
 * - DriverCarMaxFuelPct and CarClassMaxFuelPct are fractions of the tank (iRacing writes the
 *   class one as '0.850 %': the number is the fraction, the sign is noise); a value above 1 is
 *   taken as a percentage. The smaller of the two is the cap (the class one carries the BoP).
 * - CarClassDryTireSetLimit ('0 %', '4 %') is the dry sets for the session, 0 = unlimited.
 * - FuelLevelPct is FuelLevel over the whole tank (DriverCarFuelMaxLtr), before any cap.
 */
import { isFiniteNumber } from '../num'
import { MAX_CARS } from '../telemetry'
import type { PitSpec } from '../types'

export const NO_PIT_SPEC: PitSpec = Object.freeze({
  fuelMaxL: null,
  maxFuelFrac: null,
  fastRepairsLimit: null,
  tyreSetLimit: null
})

/** No car carries more than this (L): anything above is a corrupt value. */
const MAX_TANK_L = 1000
/** No session allows more than this many fast repairs or tyre sets: anything above is corrupt. */
const MAX_LIMIT = 99
/** FuelLevelPct below this says too little to work out the tank from it. */
const MIN_PCT_FOR_TANK = 0.05

type Obj = Record<string, unknown>

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** The leading number of a YAML value: 0.85, '0.850 %', '4 %' -> the number; else null. */
function leadingNumber(v: unknown): number | null {
  if (isFiniteNumber(v)) return v
  if (typeof v !== 'string') return null
  const m = /^\s*(-?\d+(?:[.,]\d+)?)/.exec(v)
  if (!m || m[1] === undefined) return null
  const n = Number(m[1].replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** A share of the tank in (0, 1]: a fraction, or a percentage above 1; null otherwise. */
export function fuelFraction(v: unknown): number | null {
  const n = leadingNumber(v)
  if (n === null || n <= 0) return null
  const frac = n > 1 ? n / 100 : n
  return frac > 0 && frac <= 1 ? frac : null
}

/** A whole limit 0..MAX_LIMIT ('unlimited' and anything else -> null). */
function limitOf(v: unknown): number | null {
  const n = leadingNumber(v)
  return n !== null && Number.isInteger(n) && n >= 0 && n <= MAX_LIMIT ? n : null
}

/** Your entry in DriverInfo.Drivers (by DriverCarIdx), null when missing. */
function playerEntry(driverInfo: Obj): Obj | null {
  const idx = driverInfo.DriverCarIdx
  if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx >= MAX_CARS) return null
  const drivers = driverInfo.Drivers
  if (!Array.isArray(drivers)) return null
  for (const d of drivers) if (isObj(d) && d.CarIdx === idx) return d
  return null
}

/** DriverInfo and WeekendInfo.WeekendOptions to the pit spec; never throws. */
export function parsePitSpec(driverInfo: unknown, weekendOptions: unknown): PitSpec {
  const info = isObj(driverInfo) ? driverInfo : null
  const me = info ? playerEntry(info) : null
  const tank = leadingNumber(info?.DriverCarFuelMaxLtr)
  const fuelMaxL = tank !== null && tank > 0 && tank <= MAX_TANK_L ? tank : null
  const fracs = [fuelFraction(info?.DriverCarMaxFuelPct), fuelFraction(me?.CarClassMaxFuelPct)]
  const known = fracs.filter((f): f is number => f !== null)
  const sets = limitOf(me?.CarClassDryTireSetLimit)
  return {
    fuelMaxL,
    maxFuelFrac: known.length > 0 ? Math.min(...known) : null,
    fastRepairsLimit: isObj(weekendOptions) ? limitOf(weekendOptions.FastRepairsLimit) : null,
    tyreSetLimit: sets !== null && sets > 0 ? sets : null
  }
}

/**
 * Litres you may carry: the tank times its cap; without the YAML's tank, worked out from
 * FuelLevel / FuelLevelPct. Null when neither says.
 */
export function tankLitres(
  spec: PitSpec | undefined,
  fuelL: number | null,
  fuelPct: unknown
): number | null {
  const s = spec ?? NO_PIT_SPEC
  let tank = s.fuelMaxL
  if (tank === null && fuelL !== null && isFiniteNumber(fuelPct) && fuelPct >= MIN_PCT_FOR_TANK) {
    const derived = fuelL / Math.min(1, fuelPct)
    tank = derived > 0 && derived <= MAX_TANK_L ? derived : null
  }
  if (tank === null) return null
  return tank * (s.maxFuelFrac ?? 1)
}
