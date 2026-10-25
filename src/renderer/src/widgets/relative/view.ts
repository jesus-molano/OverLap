/**
 * View models of the relative widget (quality P1-10): which car goes in each slot (the player
 * always in the centre one), each slot formatted and flat so an unchanged slot keeps its object
 * (`reuseViews`) for v-memo, and the grid columns of the row options. Pure.
 */
import { formatClassPosition, formatGap } from '@shared/format'
import type { Messages } from '@shared/i18n'
import type { NameFormat, RelativeData, RelativeOptions, RelativeRow } from '@shared/types'
import { toDriverCell, type DriverCellView } from '@renderer/view/driverCell'
import type { DriverStyles } from '@renderer/view/styles'

export interface RelativeSlotView extends DriverCellView {
  kind: 'car'
  /** Class attribute of the row element, state classes included. */
  css: string
  isPlayer: boolean
  inPits: boolean
  /** Lapping you / lapped by you; null on your lap. */
  lap: 'ahead' | 'behind' | null
  /** 'P5', '' when unknown. */
  pos: string
  /** '1.2', '-0.8'; blank on your own row. */
  gap: string
}

/** A slot with no car (fewer cars than slots on that side). */
export interface EmptySlotView {
  kind: 'empty'
  css: string
}

export type SlotView = RelativeSlotView | EmptySlotView

const EMPTY_EVEN: EmptySlotView = Object.freeze({ kind: 'empty', css: 'rl-row' })
const EMPTY_ODD: EmptySlotView = Object.freeze({ kind: 'empty', css: 'rl-row is-alt' })

/**
 * Rows per slot, `ahead + 1 + behind` long, the player in slot `ahead`: padded with nulls above
 * or below when fewer cars are around. Without a player row (not on track) the rows are listed
 * from the top. Slot counts are clamped by the caller.
 */
export function layoutSlots(
  d: RelativeData | null,
  ahead: number,
  behind: number
): (RelativeRow | null)[] {
  const total = ahead + 1 + behind
  const out: (RelativeRow | null)[] = []
  if (d !== null && d.playerRow >= 0 && d.playerRow < d.rows.length) {
    const p = d.playerRow
    const first = Math.max(0, p - ahead)
    for (let i = p - first; i < ahead; i++) out.push(null)
    const last = Math.min(d.rows.length - 1, p + behind)
    for (let i = first; i <= last; i++) out.push(d.rows[i] ?? null)
  } else if (d !== null) {
    for (let i = 0; i < Math.min(d.rows.length, total); i++) out.push(d.rows[i] ?? null)
  }
  while (out.length < total) out.push(null)
  return out
}

function rowCss(row: RelativeRow, alt: boolean, lap: RelativeSlotView['lap']): string {
  let css = alt ? 'rl-row is-alt' : 'rl-row'
  if (row.isPlayer) css += ' ov-player'
  if (row.inPits) css += ' is-pits'
  if (lap !== null) css += ` is-lap-${lap}`
  return css
}

export function toSlotView(
  row: RelativeRow,
  index: number,
  styles: DriverStyles,
  nameFormat: NameFormat,
  m: Messages
): RelativeSlotView {
  const lap = row.isPlayer || row.lapRelation === 'same' ? null : row.lapRelation
  return {
    ...toDriverCell(row, styles, nameFormat, m),
    kind: 'car',
    css: rowCss(row, index % 2 === 1, lap),
    isPlayer: row.isPlayer,
    inPits: row.inPits,
    lap,
    pos: formatClassPosition(row.classPosition),
    // Your own gap is always 0.0: noise.
    gap: row.isPlayer ? '' : formatGap(row.gapS)
  }
}

export function toSlotViews(
  rows: readonly (RelativeRow | null)[],
  styles: DriverStyles,
  nameFormat: NameFormat,
  m: Messages
): SlotView[] {
  return rows.map((row, i) => {
    if (row !== null) return toSlotView(row, i, styles, nameFormat, m)
    return i % 2 === 1 ? EMPTY_ODD : EMPTY_EVEN
  })
}

/** Column widths (em of the row font). The name takes the rest. */
export const RELATIVE_COL_EM = { pos: 1.9, lic: 2.8, ir: 2.4, gap: 3.1 } as const

export interface RelativeColumns {
  pos: boolean
  lic: boolean
  ir: boolean
  /** grid-template-columns of a row. */
  template: string
  /** Changes with the set of columns (v-memo). */
  key: string
}

/** Hidden columns leave the grid, so the name takes their width. */
export function relativeColumns(
  o: Pick<RelativeOptions, 'showClassPosition' | 'showLicense' | 'showIRating'>
): RelativeColumns {
  const pos = o.showClassPosition !== false
  const lic = o.showLicense !== false
  const ir = o.showIRating !== false
  const tracks: string[] = []
  if (pos) tracks.push(`${RELATIVE_COL_EM.pos}em`)
  tracks.push('minmax(0, 1fr)')
  if (lic) tracks.push(`${RELATIVE_COL_EM.lic}em`)
  if (ir) tracks.push(`${RELATIVE_COL_EM.ir}em`)
  tracks.push(`${RELATIVE_COL_EM.gap}em`)
  return {
    pos,
    lic,
    ir,
    template: tracks.join(' '),
    key: `${Number(pos)}${Number(lic)}${Number(ir)}`
  }
}
