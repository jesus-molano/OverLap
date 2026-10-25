/**
 * Which standings columns a car row has and how wide they are (ux §4.2-4.3). The text size comes
 * from the scale setting, so a narrower window drops columns instead of shrinking the text: the
 * name keeps NAME_MIN_EM and the columns go in DROP_ORDER, whatever order the user gave them.
 * Pure; widths are in em of the row font.
 */
import type { AppearanceSettings, StandingsColumnId, StandingsOptions } from '@shared/types'

/** First to go when the window narrows. 'gap' never goes (nor the position and the name). */
export const DROP_ORDER = [
  'delta',
  'gapLeader',
  'gained',
  'lic',
  'ir',
  'last',
  'pit'
] as const satisfies readonly StandingsColumnId[]

/** Narrowest readable name (em): "P. Duvalier" at the default size. */
export const NAME_MIN_EM = 8
/** Below this row width (em) the number chip becomes a bare class stripe. */
export const NARROW_EM = 20
export const COL_GAP_EM = 0.4
/** Row padding: left of the accent bar and right edge (em), plus the bar itself (px). */
export const ROW_PAD_EM = 0.95
export const BAR_PX = 3
/** Panel border, left + right (and top + bottom). */
export const BORDER_PX = 2
/** Text is never drawn below this (theme.css --ov-min-text). */
export const MIN_TEXT_PX = 9

/**
 * A column's width in em of the row font, and the size of its text in em: a cell whose text hits
 * the 9 px floor at small sizes is relatively wider, so its width scales with the floor.
 */
interface ColumnWidth {
  readonly w: number
  readonly text: number
}

const COLUMN_WIDTH: Readonly<Record<StandingsColumnId, ColumnWidth>> = {
  gained: { w: 1.9, text: 0.75 },
  ir: { w: 2.4, text: 0.82 },
  lic: { w: 2.7, text: 0.72 },
  delta: { w: 2.4, text: 0.82 },
  gap: { w: 3.2, text: 1 },
  gapLeader: { w: 3, text: 0.9 },
  last: { w: 4.2, text: 0.85 },
  pit: { w: 2.2, text: 0.65 }
}
/** Gaps to a best lap carry three decimals ('+0.412'). */
const NON_RACE_GAP: ColumnWidth = { w: 3.9, text: 1 }
const NON_RACE_GAP_LEADER: ColumnWidth = { w: 3.6, text: 0.9 }
/** Licence as its letter only. */
const LIC_LETTER: ColumnWidth = { w: 1.2, text: 0.72 }
export const POS_WIDTH: ColumnWidth = { w: 1.7, text: 0.82 }

/**
 * Number in front of the name: a class-colour chip, a stripe plus '#23', or (narrow) just the
 * stripe. Part of the name track, so it includes the gap before the name.
 */
export type NumberStyle = 'chip' | 'stripe' | 'bare'
const NUMBER_WIDTH: Readonly<Record<NumberStyle, ColumnWidth>> = {
  chip: { w: 2.2, text: 0.82 },
  stripe: { w: 2.5, text: 0.82 },
  bare: { w: 0.6, text: 1 }
}

export interface ColumnPrefs {
  columns: StandingsOptions['columns']
  gapMode: StandingsOptions['gapMode']
  iRatingDeltaAll: boolean
  /** Race session: positions gained and iRating changes only exist in races. */
  race: boolean
  licenseStyle: AppearanceSettings['licenseStyle']
  numberStyle: AppearanceSettings['numberStyle']
}

export interface Columns {
  /** Right-hand cells of a car row, in the user's order. */
  readonly cells: readonly StandingsColumnId[]
  /** grid-template-columns of a car row: position, name (1fr), then `cells`. */
  readonly template: string
  readonly numberStyle: NumberStyle
  /** The pit column is not shown: pit state goes as an icon after the name. */
  readonly pitInline: boolean
  /** Width the name gets (em); below NAME_MIN_EM only when nothing else could go. */
  readonly nameEm: number
  /** Row width (em) these columns were fitted to. */
  readonly widthEm: number
  /** Changes whenever the rendered cells do (v-memo). */
  readonly key: string
}

/**
 * Whether a column is on for these options, before fitting:
 * - 'gained' and 'delta' only in races; 'delta' also when the Δ of every row is on.
 * - 'gapLeader' when the gap mode is 'both' (or the column is on), never in 'leader' mode,
 *   where 'gap' already shows the gap to the leader.
 */
export function columnWanted(id: StandingsColumnId, visible: boolean, p: ColumnPrefs): boolean {
  switch (id) {
    case 'gained':
      return visible && p.race
    case 'delta':
      return (visible || p.iRatingDeltaAll) && p.race
    case 'gapLeader':
      return p.gapMode !== 'leader' && (visible || p.gapMode === 'both')
    default:
      return visible
  }
}

/** Width (em of the row font) of a cell whose text is `text` em, given the 9 px floor. */
function widthAt(c: ColumnWidth, fontPx: number): number {
  const floor = fontPx > 0 ? MIN_TEXT_PX / fontPx : 1
  return c.w * Math.max(1, floor / c.text)
}

function columnWidth(id: StandingsColumnId, p: ColumnPrefs): ColumnWidth {
  if (id === 'gap' && !p.race) return NON_RACE_GAP
  if (id === 'gapLeader' && !p.race) return NON_RACE_GAP_LEADER
  if (id === 'lic' && p.licenseStyle === 'letter') return LIC_LETTER
  return COLUMN_WIDTH[id]
}

const round2 = (v: number): number => Math.round(v * 100) / 100
const em = (v: number): string => `${round2(v)}em`

/** Row width available to the cells (em), from the panel width. */
export function rowWidthEm(widthPx: number, fontPx: number): number {
  if (!(widthPx > 0) || !(fontPx > 0)) return 0
  return (widthPx - BORDER_PX - BAR_PX) / fontPx - ROW_PAD_EM
}

/**
 * The columns that fit `widthPx` at `fontPx`: every wanted column while the name keeps
 * NAME_MIN_EM, otherwise columns go in DROP_ORDER; if the name is still short, or the row is
 * narrower than NARROW_EM, the number chip becomes a bare stripe. A width of 0 (not measured
 * yet) keeps every wanted column.
 */
export function fitColumns(p: ColumnPrefs, widthPx: number, fontPx: number): Columns {
  const shown: StandingsColumnId[] = []
  const seen = new Set<StandingsColumnId>()
  for (const c of p.columns) {
    if (seen.has(c.id)) continue
    seen.add(c.id)
    if (columnWanted(c.id, c.visible, p)) shown.push(c.id)
  }
  const widthEm = rowWidthEm(widthPx, fontPx)
  const measured = widthEm > 0
  let numberStyle: NumberStyle = p.numberStyle === 'stripe' ? 'stripe' : 'chip'

  const fixedEm = (cells: readonly StandingsColumnId[]): number => {
    let sum = widthAt(POS_WIDTH, fontPx) + widthAt(NUMBER_WIDTH[numberStyle], fontPx)
    for (const id of cells) sum += widthAt(columnWidth(id, p), fontPx)
    // Tracks: position, name, then the cells.
    return sum + COL_GAP_EM * (cells.length + 1)
  }

  let cells = shown
  if (measured) {
    for (const id of DROP_ORDER) {
      if (widthEm - fixedEm(cells) >= NAME_MIN_EM) break
      if (cells.includes(id)) cells = cells.filter((c) => c !== id)
    }
    if (widthEm - fixedEm(cells) < NAME_MIN_EM || widthEm < NARROW_EM) numberStyle = 'bare'
  }

  const tracks = [em(widthAt(POS_WIDTH, fontPx)), 'minmax(0, 1fr)']
  for (const id of cells) tracks.push(em(widthAt(columnWidth(id, p), fontPx)))
  const template = tracks.join(' ')
  const pitInline = !cells.includes('pit')
  return {
    cells,
    template,
    numberStyle,
    pitInline,
    nameEm: measured ? round2(widthEm - fixedEm(cells)) : 0,
    widthEm: round2(widthEm),
    key: `${cells.join(',')}|${numberStyle}|${template}`
  }
}

/** `next`, or `prev` when it renders the same (a resize that changes nothing re-renders nothing). */
export function reuseColumns(prev: Columns | undefined, next: Columns): Columns {
  return prev !== undefined && prev.key === next.key ? prev : next
}
