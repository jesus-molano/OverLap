/**
 * The standings' column heads row (its `columnHeads` option): one caption per grid track of the
 * car rows, so it follows the column order and the narrow-width dropping (the same Columns), and
 * the gap headers follow the gap mode the way the cells do (view/columnHeads.ts). Pure.
 *
 *   POS  PILOTO                    iR   SR    INT.   ÚLTIMA  BOX
 */
import type { Messages } from '@shared/i18n'
import type { StandingsColumnId } from '@shared/types'
import {
  standingsHead,
  type HeadAlign,
  type StandingsFixedHead,
  type StandingsHeadContext
} from '@renderer/view/columnHeads'
import type { Columns } from './columns'

export interface HeadCell {
  readonly id: StandingsColumnId | StandingsFixedHead
  readonly label: string
  readonly align: HeadAlign
  /** A column's `data-el` ('standings.columns.ir'); none for the fixed position and name. */
  readonly el?: string
}

/** One head per track: position, name, then the drawn cells in their order. */
export type HeadsView = readonly HeadCell[]

export function toHeadsView(
  cols: Pick<Columns, 'cells'>,
  c: StandingsHeadContext,
  m: Messages
): HeadsView {
  const fixed: HeadCell[] = (['pos', 'name'] as const).map((id) => ({
    id,
    ...standingsHead(id, c, m)
  }))
  return [
    ...fixed,
    ...cols.cells.map((id) => ({ id, ...standingsHead(id, c, m), el: `standings.columns.${id}` }))
  ]
}

/** `next`, or `prev` while every head reads the same (a payload re-renders nothing there). */
export function reuseHeads(prev: HeadsView | undefined, next: HeadsView): HeadsView {
  if (prev === undefined || prev.length !== next.length) return next
  return next.every((h, i) => {
    const p = prev[i]
    return p !== undefined && p.id === h.id && p.label === h.label && p.align === h.align
  })
    ? prev
    : next
}
