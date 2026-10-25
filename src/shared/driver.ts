/**
 * The driver fields every payload row carries (relative, standings, battle),
 * built in one place from the session's DriverEntry so the widgets never
 * disagree on a name, number, iRating or licence. Pure.
 */
import type { DriverEntry } from './types'

export interface DriverIdentity {
  carIdx: number
  carNumber: string
  driverName: string
  /** CSS colour (#rrggbb) of the car class. */
  classColor: string
  /** null when unknown (0 or less in the session info). */
  iRating: number | null
  /** e.g. "A 4.99", null when unknown. */
  licString: string | null
  licColor: string | null
}

export function driverIdentity(d: DriverEntry): DriverIdentity {
  return {
    carIdx: d.carIdx,
    carNumber: d.carNumber,
    driverName: d.userName,
    classColor: d.classColor,
    iRating: d.iRating > 0 ? d.iRating : null,
    licString: d.licString !== '' ? d.licString : null,
    licColor: d.licColor
  }
}

/** Field-by-field equality of the identity part of two rows. */
export function identityEqual(a: DriverIdentity, b: DriverIdentity): boolean {
  return (
    a.carIdx === b.carIdx &&
    a.carNumber === b.carNumber &&
    a.driverName === b.driverName &&
    a.classColor === b.classColor &&
    a.iRating === b.iRating &&
    a.licString === b.licString &&
    a.licColor === b.licColor
  )
}
