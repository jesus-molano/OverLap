/**
 * Tyre compounds: CarIdxTireCompound gives each car's TireIndex, and DriverInfo.DriverTires
 * names those indices, but only for your own car model (another model's index 1 may be a
 * different tyre). So a name is only given for cars of your model. Pure.
 */
import type { TelemetryFrame } from './telemetry'
import type { SessionMeta } from './types'

/**
 * Which cars DriverTires describes: your car (DriverInfo.DriverCarIdx, the car the session
 * info is about) and every car of its model. carId 0 when the model is unknown.
 */
export interface TyreModel {
  readonly carIdx: number
  readonly carId: number
}

/** The model DriverTires describes; computed once per tick by the caller. */
export function tyreModelOf(session: SessionMeta): TyreModel {
  const carIdx = session.playerCarIdx
  return { carIdx, carId: carIdx >= 0 ? (session.drivers.get(carIdx)?.carId ?? 0) : 0 }
}

/**
 * The name of the compound `carIdx` runs ('Hard', 'Wet'), null when unknown: the sim reports
 * none (-1, or a build without the variable), DriverTires does not list it, or the car is
 * another model than yours.
 */
export function tyreCompoundOf(
  frame: TelemetryFrame,
  session: SessionMeta,
  model: TyreModel,
  carIdx: number
): string | null {
  if (session.tyreCompounds.size === 0) return null
  const index = frame.CarIdxTireCompound[carIdx]
  if (index === undefined || !Number.isInteger(index) || index < 0) return null
  if (carIdx !== model.carIdx) {
    const carId = session.drivers.get(carIdx)?.carId ?? 0
    if (model.carId <= 0 || carId !== model.carId) return null
  }
  return session.tyreCompounds.get(index) ?? null
}

/**
 * Whether the compounds are worth a column: some car the names cover (in the world) runs
 * another one than TireIndex 0, the model's usual dry tyre (so the field does not all run
 * the same, or all runs something else). A field all on 0 would only say 'H' on every row.
 */
export function tyresVary(frame: TelemetryFrame, session: SessionMeta, model: TyreModel): boolean {
  if (session.tyreCompounds.size === 0) return false
  const indices = frame.CarIdxTireCompound
  for (let i = 0; i < indices.length; i++) {
    const index = indices[i]
    if (index === undefined || !Number.isInteger(index) || index <= 0) continue
    if (tyreCompoundOf(frame, session, model, i) !== null) return true
  }
  return false
}

/**
 * The letter a widget draws for a compound ('Hard' -> 'H', 'Wet' -> 'W'): the sim's own
 * English initial, the one printed on tyre walls, in both languages. '' for a blank name.
 */
export function tyreLetter(name: string | null): string {
  const first = name?.trim().charAt(0) ?? ''
  return first.toLocaleUpperCase('en')
}
