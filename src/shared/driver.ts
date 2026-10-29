/**
 * The driver fields every payload row carries (relative, standings, battle),
 * built in one place from the session's DriverEntry so the widgets never
 * disagree on a name, number, iRating, licence, make or country. Pure.
 */
import { hasMultipleBrands, type BrandId } from './carBrands'
import { isKnownName } from './format'
import type { DriverEntry, SessionMeta } from './types'

export interface DriverIdentity {
  carIdx: number
  carNumber: string
  /**
   * The driver's own name; '' when the session info has none worth showing (all '?', see
   * isKnownName). The widgets then show teamName, or their 'Piloto #7' placeholder.
   */
  driverName: string
  /** Only when driverName is '' and the team's name is known (team races). */
  teamName?: string
  /** CSS colour (#rrggbb) of the car class. */
  classColor: string
  /** null when unknown (0 or less in the session info). */
  iRating: number | null
  /** e.g. "A 4.99", null when unknown. */
  licString: string | null
  licColor: string | null
  /** The car's make ('unknown' when the brand table does not know it: no mark is drawn). */
  brand: BrandId
  /** The driver's flag code (DriverEntry.country): '' draws no flag. */
  country: string
}

export function driverIdentity(d: DriverEntry): DriverIdentity {
  const known = isKnownName(d.userName)
  const identity: DriverIdentity = {
    carIdx: d.carIdx,
    carNumber: d.carNumber,
    driverName: known ? d.userName : '',
    classColor: d.classColor,
    iRating: d.iRating > 0 ? d.iRating : null,
    licString: d.licString !== '' ? d.licString : null,
    licColor: d.licColor,
    brand: d.brand,
    country: d.country
  }
  // Outside team races TeamName is the same unknown name: nothing to add.
  if (!known && isKnownName(d.teamName)) identity.teamName = d.teamName
  return identity
}

/** Field-by-field equality of the identity part of two rows. */
export function identityEqual(a: DriverIdentity, b: DriverIdentity): boolean {
  return (
    a.carIdx === b.carIdx &&
    a.carNumber === b.carNumber &&
    a.driverName === b.driverName &&
    a.teamName === b.teamName &&
    a.classColor === b.classColor &&
    a.iRating === b.iRating &&
    a.licString === b.licString &&
    a.licColor === b.licColor &&
    a.brand === b.brand &&
    a.country === b.country
  )
}

/** Per session object (a new one arrives whenever the session info changes). */
const MULTI_BRAND = new WeakMap<SessionMeta, boolean>()

/**
 * More than one make among the cars of the session (the pace car and spectators left out, makes
 * the table does not know counted as none): brand marks in 'auto' mode. Decided on the whole
 * field, so the rows a window happens to show never make the marks come and go. Memoised per
 * session object.
 */
export function fieldHasMultipleBrands(session: SessionMeta): boolean {
  const known = MULTI_BRAND.get(session)
  if (known !== undefined) return known
  const brands: BrandId[] = []
  for (const d of session.drivers.values()) {
    if (d.isPaceCar || d.isSpectator || d.carIdx === session.paceCarIdx) continue
    brands.push(d.brand)
  }
  const multi = hasMultipleBrands(brands)
  MULTI_BRAND.set(session, multi)
  return multi
}
