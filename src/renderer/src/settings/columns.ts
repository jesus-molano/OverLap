/**
 * The standings' column options that go together, kept consistent by the settings window (the
 * shared element editor edits the list itself, settings/elements). Pure: every function returns
 * new arrays/objects and never mutates its input.
 *
 * Coupled options:
 * - the 'gapLeader' column is visible exactly when gapMode is 'both' (choosing "Ambos" shows
 *   it, hiding the column goes back to the interval);
 * - turning on "Δ iRating de todos" also shows the 'delta' column, which would otherwise
 *   leave the option without any visible effect; hiding the column turns it off.
 */
import { setElementVisible } from '@shared/elements'
import type { Messages } from '@shared/i18n'
import type { StandingsColumn, StandingsColumnId, StandingsOptions } from '@shared/types'
import type { ElementChange } from './elements/listOps'

/** Keys of the fixed left block, listed (locked) above the editable columns. */
export const FIXED_COLUMN_KEYS = ['pos', 'num', 'name'] as const

export type FixedColumnKey = (typeof FIXED_COLUMN_KEYS)[number]

/** The fixed left block, worded by `m`. */
export function fixedColumns(
  m: Messages
): readonly { readonly key: FixedColumnKey; readonly label: string }[] {
  const labels = m.settings.columns.fixed
  return FIXED_COLUMN_KEYS.map((key) => ({ key, label: labels[key] }))
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
 * the interval); hiding the delta column also drops "Δ iRating de todos".
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

/** Patch for "Δ iRating de todos": turning it on also shows the delta column. */
export function deltaAllPatch(opts: ColumnOpts, on: boolean): Partial<StandingsOptions> {
  if (on && !isColumnVisible(opts.columns, 'delta')) {
    return { iRatingDeltaAll: true, columns: setColumnVisible(opts.columns, 'delta', true) }
  }
  return { iRatingDeltaAll: on }
}

/**
 * Patch for the columns editor (ElementEditor's apply): the new list `next`, with the options
 * that go with what changed. A move changes the order only; showing or hiding a column couples
 * as columnVisiblePatch does; a reset (the default list) brings gapMode and "Δ iRating de todos"
 * in line with the gapLeader and delta columns it leaves.
 */
export function columnsEditPatch(
  opts: ColumnOpts,
  next: readonly StandingsColumn[],
  change: ElementChange<StandingsColumnId>
): Partial<StandingsOptions> {
  const columns = next.map((c) => ({ id: c.id, visible: c.visible }))
  if (change.kind === 'visible') {
    return columnVisiblePatch({ ...opts, columns }, change.id, change.visible)
  }
  if (change.kind === 'move') return { columns }
  const patch: Partial<StandingsOptions> = { columns }
  const leader = isColumnVisible(columns, 'gapLeader')
  if (!leader && opts.gapMode === 'both') patch.gapMode = 'interval'
  if (leader && opts.gapMode !== 'both') patch.gapMode = 'both'
  if (!isColumnVisible(columns, 'delta') && opts.iRatingDeltaAll) patch.iRatingDeltaAll = false
  return patch
}
