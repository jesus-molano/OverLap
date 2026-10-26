/**
 * The alerts band's fuel alerts, from the fuel plan (fuel/provider.ts fuelAlertInput): 'ENTRA
 * ESTA VUELTA' while a race's pit window closes on the lap in progress, and 'COMBUSTIBLE · 1.6 V'
 * under FUEL_ALERT.lowLaps laps of fuel when that does not reach the flag (or the end of the
 * session is unknown: a practice without a time limit). Neither while you are on pit road (you
 * are already in) or out of the car. Both can be on at once: the band shows the stop, the chip
 * how much is left. Pure.
 */
import type { AlertNotice } from '../types'

export const FUEL_ALERT = {
  /** Under this many laps of fuel (and not enough to finish): the low fuel alert. */
  lowLaps: 2
} as const

/** What the fuel plan says, for the alerts. */
export interface FuelAlertInput {
  /** Laps the fuel lasts at your average, null while measuring. */
  readonly lapsOfFuel: number | null
  /** Stops still needed to the flag, null when the end of the session is unknown. */
  readonly stops: number | null
  /** The pit window's last lap is the lap in progress. */
  readonly closesThisLap: boolean
}

export function fuelNotices(
  input: FuelAlertInput | null,
  onPitRoad: boolean,
  inCar: boolean
): AlertNotice[] {
  if (input === null || onPitRoad || !inCar) return []
  const out: AlertNotice[] = []
  if (input.closesThisLap && (input.stops ?? 0) > 0) out.push({ kind: 'boxThisLap' })
  const laps = input.lapsOfFuel
  if (laps !== null && laps >= 0 && laps < FUEL_ALERT.lowLaps && input.stops !== 0) {
    // Floored to the tenth: 1.96 laps is never shown as '2.0'.
    out.push({ kind: 'fuelLow', laps: Math.floor(laps * 10) / 10 })
  }
  return out
}
