/**
 * The standings' column options that go together, kept consistent by the settings window (the
 * shared element editor edits the list itself, settings/elements). Pure: every function returns
 * new arrays/objects and never mutates its input.
 *
 * Coupled options:
 * - the 'gapLeader' column is visible exactly when gapMode is 'both' (choosing "Ambos" shows
 *   it, hiding the column goes back to the interval);
 * - turning on "iRating en juego de todos" also shows the 'delta' column, which would otherwise
 *   leave the option without any visible effect; hiding the column turns it off.
 */
import { driverBlock, type DriverBlockGlobals, type DriverBlockOptions } from '@shared/driverBlock'
import { setElementVisible } from '@shared/elements'
import type { Messages } from '@shared/i18n'
import { BLOCK_PARTS, type BlockPartId } from '@shared/rowHead'
import type {
  ElementEntry,
  StandingsColumn,
  StandingsColumnId,
  StandingsOptions
} from '@shared/types'
import {
  brandChoicesInherit,
  flagChoicesInherit,
  toFlagChoice,
  type FlagChoice
} from './controls/choices'
import type { ElementChange } from './elements/listOps'

/** A list row whose part the «Piloto» block shows or hides (ElementEditor's `linked`). */
export interface LinkedRow {
  /** The block draws it (its own value or Apariencia's). */
  readonly on: boolean
  /** Where it is switched, for the row's mark. */
  readonly title: string
  /** Where it is switched and how it is now: «Se muestra u oculta en «Piloto»: Global (Sí)». */
  readonly hint: string
}

/**
 * The tables' rows of the parts the «Piloto» block shows or hides (request 11): the logo, the
 * driver's flag and the penalty flags (shared/rowHead.ts BLOCK_PARTS). Each says the block's
 * value as its row there reads it, and whether that draws it. Their eye is the block's row: the
 * list only places them.
 */
export function linkedParts(
  m: Messages,
  own: Partial<DriverBlockOptions>,
  globals: DriverBlockGlobals,
  parts: readonly BlockPartId[] = BLOCK_PARTS
): Partial<Record<BlockPartId, LinkedRow>> {
  const drawn = driverBlock(own, globals)
  const c = m.settings.columns
  const label = <V>(choices: readonly { value: V; label: string }[], value: V): string =>
    choices.find((o) => o.value === value)?.label ?? ''
  const flag = (v: boolean | 'inherit' | undefined): FlagChoice => toFlagChoice(v ?? 'inherit')
  const values: Record<BlockPartId, readonly [string, boolean]> = {
    brand: [
      label(brandChoicesInherit(m, globals.brandMarks), own.brandMarks ?? 'inherit'),
      drawn.brandMarks !== 'off'
    ],
    country: [
      label(flagChoicesInherit(m, globals.countryFlags), flag(own.countryFlags)),
      drawn.countryFlags
    ],
    flags: [
      label(flagChoicesInherit(m, globals.penaltyFlags), flag(own.showFlags)),
      drawn.showFlags
    ]
  }
  const out: Partial<Record<BlockPartId, LinkedRow>> = {}
  for (const id of parts) {
    const [value, on] = values[id]
    out[id] = { on, title: c.inBlockTitle, hint: c.inBlock(value) }
  }
  return out
}

export function setColumnVisible(
  cols: readonly StandingsColumn[],
  id: StandingsColumnId,
  visible: boolean
): StandingsColumn[] {
  return setElementVisible(cols, id, visible)
}

export function isColumnVisible(cols: readonly StandingsColumn[], id: StandingsColumnId): boolean {
  return cols.some((c) => c.id === id && c.visible)
}

type ColumnOpts = Pick<StandingsOptions, 'columns' | 'gapMode' | 'iRatingDeltaAll'>

/** Patch for the "Hueco" choice: 'both' shows the gapLeader column, the others hide it. */
export function gapModePatch(
  opts: ColumnOpts,
  gapMode: StandingsOptions['gapMode']
): Pick<StandingsOptions, 'gapMode' | 'columns'> {
  return { gapMode, columns: setColumnVisible(opts.columns, 'gapLeader', gapMode === 'both') }
}

/**
 * Patch for one column's visibility. The gapLeader column switches gapMode ('both', or back to
 * the interval); hiding the delta column also drops "iRating en juego de todos".
 */
export function columnVisiblePatch(
  opts: ColumnOpts,
  id: StandingsColumnId,
  visible: boolean
): Partial<StandingsOptions> {
  if (id === 'gapLeader') {
    const gapMode = visible ? 'both' : opts.gapMode === 'both' ? 'interval' : opts.gapMode
    return gapModePatch(opts, gapMode)
  }
  const columns = setColumnVisible(opts.columns, id, visible)
  if (id === 'delta' && !visible && opts.iRatingDeltaAll) {
    return { columns, iRatingDeltaAll: false }
  }
  return { columns }
}

/**
 * Whether the last hide of the delta column turned "iRating en juego de todos" off (`prev`, then
 * after `change` patched as `patch`): what columnsEditPatch's `deltaAllDropped` needs for that
 * hide's "Deshacer". Other edits keep it; the delta column shown or hidden again, or a reset, end it
 * (the page also ends it when the option itself is set).
 */
export function deltaAllDroppedAfter(
  prev: boolean,
  change: ElementChange<StandingsColumnId>,
  patch: Partial<StandingsOptions>
): boolean {
  if (change.kind === 'reset') return false
  if (change.kind === 'visible' && change.id === 'delta') {
    return !change.visible && patch.iRatingDeltaAll === false
  }
  return prev
}

/** Patch for "iRating en juego de todos": turning it on also shows the delta column. */
export function deltaAllPatch(opts: ColumnOpts, on: boolean): Partial<StandingsOptions> {
  if (on && !isColumnVisible(opts.columns, 'delta')) {
    return { iRatingDeltaAll: true, columns: setColumnVisible(opts.columns, 'delta', true) }
  }
  return { iRatingDeltaAll: on }
}

/**
 * Patch for the columns editor (ElementEditor's apply): the new list `next`, with the options
 * that go with what changed. A move changes the order only; showing or hiding a column couples
 * as columnVisiblePatch does; a reset (the default list) brings gapMode and "iRating en juego de
 * todos" in line with the gapLeader and delta columns it leaves.
 */
export function columnsEditPatch(
  opts: ColumnOpts,
  next: readonly StandingsColumn[],
  change: ElementChange<StandingsColumnId>,
  deltaAllDropped = false
): Partial<StandingsOptions> {
  const columns = next.map((c) => ({ id: c.id, visible: c.visible }))
  if (change.kind === 'visible') {
    const patch = columnVisiblePatch({ ...opts, columns }, change.id, change.visible)
    // "Deshacer" after hiding the delta column: the option that hide turned off comes back.
    if (change.undo === true && change.id === 'delta' && change.visible && deltaAllDropped) {
      return { ...patch, iRatingDeltaAll: true }
    }
    return patch
  }
  if (change.kind === 'move') return { columns }
  const patch: Partial<StandingsOptions> = { columns }
  const leader = isColumnVisible(columns, 'gapLeader')
  if (!leader && opts.gapMode === 'both') patch.gapMode = 'interval'
  if (leader && opts.gapMode !== 'both') patch.gapMode = 'both'
  if (!isColumnVisible(columns, 'delta') && opts.iRatingDeltaAll) patch.iRatingDeltaAll = false
  return patch
}

/**
 * «Igualar con las columnas de …» (R10): the columns the relative and the standings share take
 * `source`'s order and visibility in `target`; the target's own columns keep their places (the
 * shared ones fill the places shared ones had). Pure.
 */
export function matchSharedColumns<T extends string, S extends string>(
  target: readonly Readonly<ElementEntry<T>>[],
  source: readonly Readonly<ElementEntry<S>>[]
): ElementEntry<T>[] {
  const ids = new Set<string>(target.map((e) => e.id))
  const shared = source.filter((e) => ids.has(e.id))
  const sharedIds = new Set<string>(shared.map((e) => e.id))
  let next = 0
  return target.map((e) => {
    if (!sharedIds.has(e.id)) return { id: e.id, visible: e.visible }
    const s = shared[next++] as Readonly<ElementEntry<string>>
    return { id: s.id as T, visible: s.visible }
  })
}
