/**
 * Standings column editor: reordering, visibility and the options that go together with a
 * column. Pure: every function returns new arrays/objects and never mutates its input.
 *
 * Coupled options, kept consistent by the settings window:
 * - the 'gapLeader' column is visible exactly when gapMode is 'both' (choosing "Ambos" shows
 *   it, hiding the column goes back to the interval);
 * - turning on "Δ iRating de todos" also shows the 'delta' column, which would otherwise
 *   leave the option without any visible effect.
 */
import type { Messages } from '@shared/i18n'
import { STANDINGS_COLUMN_IDS } from '@shared/settingsSchema'
import type { StandingsColumn, StandingsColumnId, StandingsOptions } from '@shared/types'

/** Keys of the fixed left block, listed (disabled) above the editable columns. */
export const FIXED_COLUMN_KEYS = ['pos', 'num', 'name'] as const

export type FixedColumnKey = (typeof FIXED_COLUMN_KEYS)[number]

/** The fixed left block, worded by `m`. */
export function fixedColumns(
  m: Messages
): readonly { readonly key: FixedColumnKey; readonly label: string }[] {
  const labels = m.settings.columns.fixed
  return FIXED_COLUMN_KEYS.map((key) => ({ key, label: labels[key] }))
}

export function columnLabel(m: Messages, id: StandingsColumnId): string {
  return m.settings.columns.labels[id]
}

/** Short help shown under a column label in the editor; undefined for columns without one. */
export function columnHint(m: Messages, id: StandingsColumnId): string | undefined {
  const hints: Readonly<Partial<Record<StandingsColumnId, string>>> = m.settings.columns.hints
  return hints[id]
}

/** The list with the item at `from` moved to `to` (both clamped); a copy even when unchanged. */
export function moveColumn(
  cols: readonly StandingsColumn[],
  from: number,
  to: number
): StandingsColumn[] {
  const out = cols.map((c) => ({ ...c }))
  if (out.length === 0 || !Number.isFinite(from) || !Number.isFinite(to)) return out
  const last = out.length - 1
  const f = Math.min(last, Math.max(0, Math.trunc(from)))
  const t = Math.min(last, Math.max(0, Math.trunc(to)))
  if (f === t) return out
  const [item] = out.splice(f, 1)
  if (item !== undefined) out.splice(t, 0, item)
  return out
}

export function setColumnVisible(
  cols: readonly StandingsColumn[],
  id: StandingsColumnId,
  visible: boolean
): StandingsColumn[] {
  return cols.map((c) => (c.id === id ? { id, visible } : { ...c }))
}

export function isColumnVisible(cols: readonly StandingsColumn[], id: StandingsColumnId): boolean {
  return cols.some((c) => c.id === id && c.visible)
}

/**
 * The columns in the default order, each keeping its visibility (visibility is tied to other
 * options, see the file header). Ids missing from `cols` are left out.
 */
export function defaultOrder(cols: readonly StandingsColumn[]): StandingsColumn[] {
  const out: StandingsColumn[] = []
  for (const id of STANDINGS_COLUMN_IDS) {
    const c = cols.find((x) => x.id === id)
    if (c !== undefined) out.push({ ...c })
  }
  return out
}

/** Same ids in the same order (visibility ignored). */
export function sameOrder(a: readonly StandingsColumn[], b: readonly StandingsColumn[]): boolean {
  return a.length === b.length && a.every((c, i) => c.id === b[i]?.id)
}

/**
 * Index the dragged item lands on: how many of the other items have their vertical centre
 * above the pointer. `centres` are the item centres (px, any common origin) measured when the
 * drag started; rows have one height, so those slots stay valid while the list reorders.
 */
export function dropIndex(centres: readonly number[], from: number, pointerY: number): number {
  let n = 0
  for (let i = 0; i < centres.length; i++) {
    const c = centres[i]
    if (i !== from && c !== undefined && c < pointerY) n++
  }
  return n
}

/** Screen-reader announcement after a move ('iRating movida a la posición 3 de 8.'). */
export function movedMessage(
  m: Messages,
  id: StandingsColumnId,
  index: number,
  total: number
): string {
  return m.settings.columns.moved(columnLabel(m, id), index + 1, total)
}

/** 'Boxes visible.', 'Última vuelta oculta.' */
export function visibilityMessage(m: Messages, id: StandingsColumnId, visible: boolean): string {
  const c = m.settings.columns
  return visible ? c.shown(columnLabel(m, id)) : c.hidden(columnLabel(m, id))
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
 * Patch for one column's checkbox. The gapLeader column switches gapMode ('both', or back to
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
