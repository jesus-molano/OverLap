/**
 * Fuel to the end of the session: what you need, what to add, how many stops and when. Pure
 * arithmetic over litres and laps.
 *
 * Distances are race distance in laps (laps completed + lap fraction); lap numbers are 1-based
 * ('V12' is the lap from distance 11 to 12). "Stopping on lap n" is entering the pits at the end
 * of it, at distance n: the fuel must last that far, and the stop's lap is counted as driven.
 *
 * - You take the flag at distance F = L + lapsRemaining, with marginLaps of fuel left: L is the
 *   laps completed, floor(d), and RaceView.lapsRemaining counts the lap in progress. On the grid
 *   or in the pit lane before the start (lap -1) the run to the line completes no lap, and
 *   lapsRemaining does not count it either: L is 0 there and the first lap is lap 1.
 * - Stops are made at lap ends, F - 1 the last one (a stop at the end of the last lap comes after
 *   the flag). On the last lap there is none left to make: all that is left to say is whether
 *   the fuel reaches the flag, and the margin buys nothing.
 * - Every stop can fill the tank (what you may carry, T), and a stint between two stops is whole
 *   laps, floor(T / avg) at most. With s stops, the first at x, the last is at x + (s - 1) x
 *   floor(T / avg) at the latest and its tank must reach F + margin: x >= F + margin - T / avg -
 *   (s - 1) x floor(T / avg) is the window's first lap; its last is the last lap end the fuel you
 *   have reaches.
 * - The stops are the fewest whose window is not empty.
 * - Saving a stop: the litres per lap at which one stop less has a window (each one still a full
 *   tank), shown only when within FUEL_STRATEGY.saveReach of the average.
 */
import type { FuelFinish } from '../types'

export const FUEL_STRATEGY = {
  /** Save a stop only when this much less per lap does it (fraction of the average). */
  saveReach: 0.1,
  /** Rounding slack: a value this close to a whole lap or litre is that value. */
  eps: 1e-6,
  /** Never more stops than this (a corrupt tank or average). */
  maxStops: 50,
  /** Halvings of the search for the saving (a 10 % range to well under 0.01 L). */
  saveSteps: 30
} as const

export interface StrategyInput {
  /** Litres in the tank now. */
  readonly fuelL: number
  /** Litres per lap (> 0). */
  readonly avgL: number
  /** Litres you may carry; null when unknown (every stop then holds what is missing). */
  readonly tankL: number | null
  /** Your race distance in laps. */
  readonly distance: number
  /** Laps still to complete, the lap in progress included (RaceView.lapsRemaining). */
  readonly lapsRemaining: number
  readonly marginLaps: number
}

const round1 = (v: number): number => Math.round(v * 10) / 10 || 0
const ceil1 = (v: number): number => Math.ceil(v * 10 - FUEL_STRATEGY.eps) / 10 || 0
const floor2 = (v: number): number => Math.floor(v * 100 + FUEL_STRATEGY.eps) / 100 || 0

/** Where you are, where the flag is and what the plan keeps at it. */
interface Course {
  readonly fuel: number
  /** Litres you may carry, Infinity when unknown. */
  readonly tank: number
  readonly distance: number
  /** The lap in progress. */
  readonly current: number
  /** Distance of the flag. */
  readonly finish: number
  readonly margin: number
}

/** The fewest stops at some litres per lap and the first one's window (null: no stop). */
interface Stops {
  readonly stops: number
  readonly window: { readonly from: number; readonly to: number } | null
}

function stopsAt(c: Course, rate: number): Stops {
  const eps = FUEL_STRATEGY.eps
  const deficit = (c.finish + c.margin - c.distance) * rate - c.fuel
  if (deficit <= 0) return { stops: 0, window: null }
  // The last lap end the fuel reaches (stop now when it does not reach this one), never after
  // the lap before the last.
  const reach = Math.floor(c.distance + c.fuel / rate + eps)
  const to = Math.min(c.finish - 1, Math.max(c.current, reach))
  if (!Number.isFinite(c.tank)) return { stops: 1, window: { from: c.current, to } }
  const tankLaps = c.tank / rate
  const stint = Math.floor(tankLaps + eps)
  const from = (stops: number): number =>
    Math.max(c.current, Math.ceil(c.finish + c.margin - tankLaps - (stops - 1) * stint - eps))
  let stops = Math.max(1, Math.ceil(deficit / c.tank - eps))
  while (from(stops) > to && stops < FUEL_STRATEGY.maxStops) stops++
  return { stops, window: { from: Math.min(from(stops), to), to } }
}

/**
 * The most litres per lap that need one stop less than `stops`, to 0.01 and rounded down; null
 * when that takes more than FUEL_STRATEGY.saveReach less than `avgL`.
 */
function saveRate(c: Course, avgL: number, stops: number): number | null {
  const fewer = (rate: number): boolean => stopsAt(c, rate).stops < stops
  let lo = avgL * (1 - FUEL_STRATEGY.saveReach)
  let hi = avgL
  if (!fewer(lo)) return null
  for (let k = 0; k < FUEL_STRATEGY.saveSteps; k++) {
    const mid = (lo + hi) / 2
    if (fewer(mid)) lo = mid
    else hi = mid
  }
  return floor2(lo)
}

/**
 * Null when the inputs say nothing (no average, a broken number). With no laps left (you took
 * the flag) nothing is needed: no stop, everything spare.
 */
export function fuelStrategy(i: StrategyInput): FuelFinish | null {
  const { fuelL, avgL, distance, lapsRemaining } = i
  if (
    !Number.isFinite(fuelL) ||
    !(avgL > 0) ||
    !Number.isFinite(distance) ||
    !Number.isFinite(lapsRemaining)
  ) {
    return null
  }
  const fuel = Math.max(0, fuelL)
  const eps = FUEL_STRATEGY.eps
  // Before the line on the grid or in the pit lane (lap -1) no lap is done yet.
  const done = Math.max(0, Math.floor(distance))
  const current = done + 1
  const finishD = done + lapsRemaining
  const lapsLeft = Math.max(0, finishD - distance)
  if (lapsRemaining <= 0 || lapsLeft <= 0) {
    return {
      lap: current,
      lapsLeft: 0,
      needL: 0,
      deficitL: round1(-fuel),
      short: false,
      stops: 0,
      addL: 0,
      fill: false,
      window: null,
      saveL: null
    }
  }
  // The last stop is at the end of the lap before the last: on the last lap there is none.
  const canStop = current <= finishD - 1
  const margin = canStop && Number.isFinite(i.marginLaps) ? Math.max(0, i.marginLaps) : 0
  const needL = (lapsLeft + margin) * avgL
  const deficit = needL - fuel
  const base = {
    lap: current,
    lapsLeft: round1(lapsLeft),
    needL: round1(needL),
    deficitL: round1(deficit),
    short: fuel + eps < lapsLeft * avgL
  }
  const tank = i.tankL !== null && i.tankL > 0 ? i.tankL : Infinity
  const course: Course = { fuel, tank, distance, current, finish: finishD, margin }
  const { stops, window } = canStop ? stopsAt(course, avgL) : { stops: 0, window: null }
  if (window === null) {
    return { ...base, stops: 0, addL: 0, fill: false, window: null, saveL: null }
  }

  // At the window's first lap the tank has room for the rest, or the stop fills it.
  const room = tank - Math.max(0, fuel - (window.from - distance) * avgL)
  const fill = deficit > room + eps
  const addL = ceil1(Math.max(0, Math.min(deficit, room)))
  return { ...base, stops, addL, fill, window, saveL: saveRate(course, avgL, stops) }
}
