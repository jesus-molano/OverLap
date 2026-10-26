/**
 * The alerts band's fuel alerts, from the fuel plan (fuel/provider.ts fuelAlertInput): 'ENTRA
 * ESTA VUELTA' while a race's pit window closes on the lap in progress, and 'COMBUSTIBLE · 1.6 V'
 * under FUEL_ALERT.lowLaps laps of fuel. Both only when the fuel does not reach the flag at your
 * average (FuelFinish.short): a stop the margin alone asks for is the widget's plan, not an
 * alarm; the low fuel also when the end of the session is unknown (a practice without a time
 * limit). Neither while you are on pit road (you are already in) or out of the car. Both can be
 * on at once: the band shows the stop, the chip how much is left. Pure.
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
  /**
   * The fuel does not reach the flag at your average (FuelFinish.short); null when the end of
   * the session is unknown or while measuring.
   */
  readonly short: boolean | null
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
  if (input.closesThisLap && input.short === true) out.push({ kind: 'boxThisLap' })
  const laps = input.lapsOfFuel
  if (laps !== null && laps >= 0 && laps < FUEL_ALERT.lowLaps && input.short !== false) {
    // Floored to the tenth: 1.96 laps is never shown as '2.0'.
    out.push({ kind: 'fuelLow', laps: Math.floor(laps * 10) / 10 })
  }
  return out
}
