/**
 * The start of a table row as columns (request 11): Relativo's and Posiciones' rows begin with
 * the position, the car's number, the make's logo, the driver's flag and the name, and each of
 * them is a column of the same list as the rest, in any order. One rule says how they are drawn:
 *
 * - The driver's parts (number, logo, flag, penalty flags) that touch the name in the list are
 *   drawn with it, in the name's cell: before it each keeps its slot, so the names line up down
 *   the table; after it they follow the name's text (the penalty flags as they always did).
 * - Separated from the name by any other column, a part is a column of its own.
 * - Whether the logo, the flag and the penalty flags show is the «Piloto» block's (the same rows
 *   in the four driver widgets); the list only says where they go. The position and the number,
 *   which the block has no row for, have their eye in the list. The name always shows.
 *
 * Pure.
 */

/** The row's start, in today's order: what a list saved before request 11 gets in front. */
export const ROW_HEAD_IDS = ['pos', 'number', 'brand', 'country', 'driver'] as const

/** The driver's parts: drawn in the name's cell while they touch the name. */
export const DRIVER_PARTS = ['number', 'brand', 'country', 'flags'] as const
export type DriverPartId = (typeof DRIVER_PARTS)[number]

/** The parts the «Piloto» block shows or hides: the list has no eye for them, only their place. */
export const BLOCK_PARTS = ['brand', 'country', 'flags'] as const
export type BlockPartId = (typeof BLOCK_PARTS)[number]

export const isDriverPart = (id: string): id is DriverPartId =>
  (DRIVER_PARTS as readonly string[]).includes(id)

export const isBlockPart = (id: string): id is BlockPartId =>
  (BLOCK_PARTS as readonly string[]).includes(id)

/** How a row's cells are drawn: its grid tracks, and the parts drawn in the name's cell. */
export interface NameGroup<Id extends string> {
  /** The grid's tracks, left to right: the cells but the parts drawn with the name. */
  readonly tracks: readonly Id[]
  /** Drawn in the name's cell before the name, in order (each in its slot). */
  readonly before: readonly DriverPartId[]
  /** Drawn in the name's cell after the name, in order (after its text). */
  readonly after: readonly DriverPartId[]
}

/**
 * The tracks of a row of `cells` (the drawn ones, in order) and the driver's parts drawn with
 * `name`: the run of parts right before it and the run right after it. Without the name in
 * `cells`, every cell is a track.
 */
export function nameGroup<Id extends string>(cells: readonly Id[], name: Id): NameGroup<Id> {
  const at = cells.indexOf(name)
  if (at < 0) return { tracks: cells, before: [], after: [] }
  let first = at
  while (first > 0 && isDriverPart(cells[first - 1] ?? '')) first--
  let last = at
  while (last < cells.length - 1 && isDriverPart(cells[last + 1] ?? '')) last++
  return {
    tracks: [...cells.slice(0, first), name, ...cells.slice(last + 1)],
    before: cells.slice(first, at) as unknown as DriverPartId[],
    after: cells.slice(at + 1, last + 1) as unknown as DriverPartId[]
  }
}

/** `cells` with `id` moved to right after `name` (where the penalty flags go when narrow). */
export function moveAfterName<Id extends string>(
  cells: readonly Id[],
  id: Id,
  name: Id
): readonly Id[] {
  if (!cells.includes(id) || !cells.includes(name)) return cells
  const rest = cells.filter((c) => c !== id)
  const at = rest.indexOf(name)
  return [...rest.slice(0, at + 1), id, ...rest.slice(at + 1)]
}
