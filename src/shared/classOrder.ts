/**
 * The order of the standings' class blocks (9, «Orden de las clases»), one rule for the
 * provider and the settings page's sample: your class first, then the faster ones ('player',
 * the order it always had); the fastest first, yours in its place ('speed', iRacing's); or by
 * hand ('manual'): the classes the list names, in its order, then the ones it does not, the
 * fastest first. A class is named by its short name ('LMP2'), regardless of case, so the list
 * holds across sessions. Pure.
 *
 * The settings page's sample knows a class by `classOrderKey` (letters only, as the preview's
 * `data-el` ids are; one key for the spellings the list takes as one, «GT3» and «gt3»), and
 * reads the name back with `classOfKey` (as the key has it: in lower case).
 */
import type { DriverEntry, SessionMeta, StandingsClassOrder } from './types'

/** What ordering needs of a class. */
export interface OrderableClass {
  readonly classId: number
  /** Its short name ('LMP2'); '' when the session gives none (never matched by the list). */
  readonly name: string
  /** iRacing's relative speed (CarClassRelSpeed): the higher, the faster. */
  readonly relSpeed: number
}

/** A name as the list matches it. */
export const classNameKey = (name: string): string => name.trim().toLowerCase()

/** Faster first; the same speed by class id (a stable order). */
function bySpeed(a: OrderableClass, b: OrderableClass): number {
  return b.relSpeed - a.relSpeed || a.classId - b.classId
}

/**
 * `classes` in the order `order` puts them (a new array). `player` is your class (undefined
 * while spectating: 'player' is then the fastest first too); `list` the names of «A mano».
 */
export function orderClasses<G extends OrderableClass>(
  classes: readonly G[],
  player: G | undefined,
  order: StandingsClassOrder,
  list: readonly string[]
): G[] {
  const out = [...classes]
  if (order === 'manual') {
    const rank = new Map<string, number>()
    list.forEach((name, i) => {
      const key = classNameKey(name)
      if (key !== '' && !rank.has(key)) rank.set(key, i)
    })
    const at = (g: G): number => rank.get(classNameKey(g.name)) ?? Infinity
    // Infinity - Infinity is NaN (falsy): two unlisted classes fall through to their speed.
    return out.sort((a, b) => at(a) - at(b) || bySpeed(a, b))
  }
  if (order === 'speed' || player === undefined) return out.sort(bySpeed)
  return out.sort((a, b) => Number(b === player) - Number(a === player) || bySpeed(a, b))
}

/**
 * The names of «A mano» as the settings page lists them: the saved ones in their order, then
 * each of `more` (the classes of this session, of the sample...) the list does not name yet, in
 * the order given. Empty names are left out.
 */
export function classListWith(saved: readonly string[], ...more: (readonly string[])[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const name of [...saved, ...more.flat()]) {
    const key = classNameKey(name)
    if (key === '' || seen.has(key)) continue
    seen.add(key)
    out.push(name.trim())
  }
  return out
}

/**
 * The classes of a multiclass session (their short names, the fastest first), for the
 * settings page's list; [] with one class or none. Pace car and spectators left out, as the
 * standings leave them out.
 */
export function sessionClassNames(session: SessionMeta): string[] {
  const byId = new Map<number, OrderableClass & { name: string }>()
  for (const d of session.drivers.values()) {
    if (!isEntry(d, session)) continue
    const g = byId.get(d.classId)
    if (g === undefined) {
      byId.set(d.classId, { classId: d.classId, name: d.classShortName, relSpeed: d.classRelSpeed })
    } else {
      if (g.name === '') g.name = d.classShortName
      if (d.classRelSpeed > g.relSpeed) byId.set(d.classId, { ...g, relSpeed: d.classRelSpeed })
    }
  }
  if (byId.size < 2) return []
  return classListWith([...byId.values()].sort(bySpeed).map((g) => g.name))
}

function isEntry(d: DriverEntry, session: SessionMeta): boolean {
  return !d.isPaceCar && !d.isSpectator && d.carIdx !== session.paceCarIdx
}

/** Two name lists alike, in the same order. */
export function sameNames(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((n, i) => n === b[i])
}

// ---- The sample's ids ------------------------------------------------------------------------

const A = 'a'.charCodeAt(0)

/**
 * A class's id in the settings page's sample (its `data-el`, its row in the list): the name as
 * the list matches it (classNameKey: «GT3» and «gt3» are one class) in UTF-16 units of four
 * letters each, a..p for a hex digit ('GT3' → 'aaghaaheaadd'), so any name is a plain id. '' for
 * an empty name.
 */
export function classOrderKey(name: string): string {
  const n = classNameKey(name)
  let out = ''
  for (let i = 0; i < n.length; i++) {
    const code = n.charCodeAt(i)
    for (let shift = 12; shift >= 0; shift -= 4) {
      out += String.fromCharCode(A + ((code >> shift) & 15))
    }
  }
  return out
}

/** The name of a `classOrderKey` id (in lower case, as the key holds it); null when it is not one. */
export function classOfKey(key: string): string | null {
  if (key === '' || key.length % 4 !== 0 || !/^[a-p]+$/.test(key)) return null
  let out = ''
  for (let i = 0; i < key.length; i += 4) {
    let code = 0
    for (let j = 0; j < 4; j++) code = code * 16 + (key.charCodeAt(i + j) - A)
    out += String.fromCharCode(code)
  }
  return out
}
