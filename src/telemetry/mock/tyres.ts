/**
 * The mock's tyres: DriverInfo.DriverTires (which, as in iRacing, names the compounds of the
 * player's car model only: the GT3) and each car's CarIdxTireCompound. Static per session, so
 * the standings' and the relative's tyre columns show hards, a few wets and, for the other
 * class's model, no name.
 */
import type { MockCast } from './field'

/** DriverTires as js-yaml gives it: 0 = Hard, 1 = Wet (like the MX-5's). */
export const MOCK_DRIVER_TIRES = [
  { TireIndex: 0, TireCompoundType: 'Hard' },
  { TireIndex: 1, TireCompoundType: 'Wet' }
] as const

export const HARD = 0
export const WET = 1

export interface MockDriverTire {
  TireIndex: number
  TireCompoundType: string
}

/** A fresh copy for the session YAML (callers may mutate it). */
export function mockDriverTires(): MockDriverTire[] {
  return MOCK_DRIVER_TIRES.map((t) => ({ ...t }))
}

/**
 * CarIdxTireCompound of a race car: hards, but the classmate battling the player from behind
 * and one car in five (by CarIdx) gamble on rain.
 */
export function mockTyreCompound(carIdx: number, cast: MockCast): number {
  return carIdx === cast.battleBehind || carIdx % 5 === 3 ? WET : HARD
}
