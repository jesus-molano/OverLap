/**
 * Fuel to the end of the session: what you need, what to add, how many stops and when. Pure
 * arithmetic over litres and laps.
 *
 * Distances are race distance in laps (laps completed + lap fraction); lap numbers are 1-based
 * ('V12' is the lap from distance 11 to 12). "Stopping on lap n" is entering the pits at the end
 * of it, at distance n: the fuel must last that far, and the stop's lap is counted as driven.
 *
 * - You take the flag at distance floor(d) + lapsRemaining (RaceView.lapsRemaining counts the
 *   lap in progress), with marginLaps of fuel left.
 * - Every stop can fill the tank (what you may carry, tankL), so after the first stop at distance
 *   x you have at most stops x tankL for the rest: x >= finish + margin - stops x tank / avg is
 *   the window's first lap; the last is the last lap end the fuel you have reaches.
 * - The stops are the fewest whose window is not empty: ceil(short / tank), one more when the
 *   rounding to whole laps closes that window.
 * - Saving a stop: the litres per lap with one stop less (each one still a full tank), shown only
 *   when within FUEL_STRATEGY.saveReach of the average.
 */
import type { FuelFinish } from '../types'

export const FUEL_STRATEGY = {
  /** Save a stop only when this much less per lap does it (fraction of the average). */
  saveReach: 0.1,
  /** Rounding slack: a value this close to a whole lap or litre is that value. */
  eps: 1e-6,
  /** Never more stops than this (a corrupt tank or average). */
  maxStops: 50
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

/**
 * Null when the inputs say nothing (no average, a broken number). With no laps left (you took
 * the flag) nothing is needed: no stop, everything spare.
 */
export function fuelStrategy(i: StrategyInput): FuelFinish | null {
  const { fuelL, avgL, distance, lapsRemaining } = i
  const margin = Number.isFinite(i.marginLaps) ? Math.max(0, i.marginLaps) : 0
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
  const current = Math.floor(distance) + 1
  const finishD = Math.floor(distance) + lapsRemaining
  const lapsLeft = Math.max(0, finishD - distance)
  if (lapsRemaining <= 0 || lapsLeft <= 0) {
    return {
      lap: current,
      lapsLeft: 0,
      needL: 0,
      deficitL: round1(-fuel),
      stops: 0,
      addL: 0,
      fill: false,
      window: null,
      saveL: null
    }
  }
  const needL = (lapsLeft + margin) * avgL
  const deficit = needL - fuel
  const base = {
    lap: current,
    lapsLeft: round1(lapsLeft),
    needL: round1(needL),
    deficitL: round1(deficit)
  }
  if (deficit <= 0) {
    return { ...base, stops: 0, addL: 0, fill: false, window: null, saveL: null }
  }

  const tank = i.tankL !== null && i.tankL > 0 ? i.tankL : Infinity
  // The last lap end the fuel reaches, never before the lap in progress (then: stop now).
  const to = Math.max(current, Math.floor(distance + fuel / avgL + eps))
  const from = (stops: number): number =>
    Number.isFinite(tank)
      ? Math.max(current, Math.ceil(finishD + margin - (stops * tank) / avgL - eps))
      : current
  let stops = Number.isFinite(tank) ? Math.max(1, Math.ceil(deficit / tank - eps)) : 1
  while (from(stops) > to && stops < FUEL_STRATEGY.maxStops) stops++
  const first = Math.min(from(stops), to)

  // At the window's first lap the tank has room for the rest, or the stop fills it.
  const room = tank - Math.max(0, fuel - (first - distance) * avgL)
  const fill = deficit > room + eps
  const addL = ceil1(Math.max(0, Math.min(deficit, room)))

  let saveL: number | null = null
  const available = fuel + (stops - 1) * (Number.isFinite(tank) ? tank : 0)
  const target = available / (lapsLeft + margin)
  if (target > 0 && target < avgL && 1 - target / avgL <= FUEL_STRATEGY.saveReach) {
    saveL = floor2(target)
  }

  return { ...base, stops, addL, fill, window: { from: first, to }, saveL }
}
