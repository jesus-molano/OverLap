/**
 * Which standings columns a car row has and how wide they are (ux §4.2-4.3). The text size comes
 * from the scale setting, so a narrower window drops columns instead of shrinking the text: the
 * name keeps NAME_MIN_EM and the columns go in DROP_ORDER, whatever order the user gave them.
 * Pure; widths are in em of the row font.
 */
import type { AppearanceSettings, StandingsColumnId, StandingsOptions } from '@shared/types'

/**
 * First to go when the window narrows. 'gap' never goes (nor the position and the name). The
 * stint extras go before the best lap, which goes before anything that was there first. The flag
 * and the make's mark (DECORATIONS_BEFORE) go before the best lap too: a decoration never costs a
 * column the table had before it.
 */
export const DROP_ORDER = [
  'delta',
  'gapLeader',
  'pitLap',
  'stint',
  'tyre',
  'best',
  'gained',
  'lic',
  'ir',
  'last',
  'pit'
] as const satisfies readonly StandingsColumnId[]

/** The first column of DROP_ORDER that the flag, then the make's mark, go before. */
export const DECORATIONS_BEFORE: (typeof DROP_ORDER)[number] = 'best'

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
  best: { w: 4.2, text: 0.85 },
  pit: { w: 2.2, text: 0.65 },
  // 'V123', '123 v' and a one-letter tyre ring.
  pitLap: { w: 2.1, text: 0.75 },
  stint: { w: 2.2, text: 0.82 },
  tyre: { w: 1.3, text: 0.65 }
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

/** The make's mark in the name track (BrandMark: 1.75em wide), with the driver cell's gap. */
export const BRAND_EM = 1.75 + 0.35
/** The plate height (theme.css --ov-plate-h): 1.15em, never below the minimum text + 4 px. */
function plateEm(fontPx: number, minPx = MIN_TEXT_PX): number {
  return fontPx > 0 ? Math.max(1.15, (minPx + 4) / fontPx) : 1.15
}
/** The flag in the name track (CountryFlag: 3:2 at the plate height), with the cell's gap. */
export function flagEm(fontPx: number, minPx = MIN_TEXT_PX): number {
  return 1.5 * plateEm(fontPx, minPx) + 0.35
}

export interface ColumnPrefs {
  columns: StandingsOptions['columns']
  gapMode: StandingsOptions['gapMode']
  iRatingDeltaAll: boolean
  /** Race session: positions gained and iRating changes only exist in races. */
  race: boolean
  /** Some row has a tyre compound (the provider sends none while the whole field runs one). */
  tyres: boolean
  licenseStyle: AppearanceSettings['licenseStyle']
  numberStyle: AppearanceSettings['numberStyle']
  /** The make's mark before the name (brandMarksOn: the option and the field). */
  brand: boolean
  /** The driver's flag before the name (countryFlags). */
  flag: boolean
  /** The text floor (px, theme.css --ov-min-text: 10 with «Texto mínimo de 10 px»); 9 if absent. */
  minText?: number
}

export interface Columns {
  /** Right-hand cells of a car row, in the user's order. */
  readonly cells: readonly StandingsColumnId[]
  /** grid-template-columns of a car row: position, name (1fr), then `cells`. */
  readonly template: string
  readonly numberStyle: NumberStyle
  /** The make's mark and the flag are drawn in the name track (they fit). */
  readonly brand: boolean
  readonly flag: boolean
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
 * - 'best' and 'pitLap' only in races: elsewhere 'last' already shows the best lap, and stops
 *   are only counted under the green flag.
 * - 'gapLeader' when the gap mode is 'both' (or the column is on), never in 'leader' mode,
 *   where 'gap' already shows the gap to the leader.
 * - 'tyre' only while some row has a compound: the same 'H' on every row says nothing.
 */
export function columnWanted(id: StandingsColumnId, visible: boolean, p: ColumnPrefs): boolean {
  switch (id) {
    case 'gained':
    case 'best':
    case 'pitLap':
      return visible && p.race
    case 'delta':
      return (visible || p.iRatingDeltaAll) && p.race
    case 'gapLeader':
      return p.gapMode !== 'leader' && (visible || p.gapMode === 'both')
    case 'tyre':
      return visible && p.tyres
    default:
      return visible
  }
}

/** Width (em of the row font) of a cell whose text is `text` em, given the text floor. */
function widthAt(c: ColumnWidth, fontPx: number, minPx = MIN_TEXT_PX): number {
  const floor = fontPx > 0 ? minPx / fontPx : 1
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
 * NAME_MIN_EM, otherwise columns go in DROP_ORDER, the flag and then the make's mark before
 * DECORATIONS_BEFORE (if the name is still short at the end they go anyway); if it is still short, or the row is narrower than NARROW_EM, the number
 * chip becomes a bare stripe (without mark or flag). A width of 0 (not measured yet) keeps every
 * wanted column.
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
  let brand = p.brand
  let flag = p.flag
  const minPx = p.minText ?? MIN_TEXT_PX

  const fixedEm = (cells: readonly StandingsColumnId[]): number => {
    let sum = widthAt(POS_WIDTH, fontPx, minPx) + widthAt(NUMBER_WIDTH[numberStyle], fontPx, minPx)
    if (brand) sum += BRAND_EM
    if (flag) sum += flagEm(fontPx, minPx)
    for (const id of cells) sum += widthAt(columnWidth(id, p), fontPx, minPx)
    // Tracks: position, name, then the cells.
    return sum + COL_GAP_EM * (cells.length + 1)
  }

  let cells = shown
  if (measured) {
    const short = (): boolean => widthEm - fixedEm(cells) < NAME_MIN_EM
    for (const id of DROP_ORDER) {
      if (!short()) break
      if (id === DECORATIONS_BEFORE) {
        if (flag) flag = false
        if (brand && short()) brand = false
        if (!short()) break
      }
      if (cells.includes(id)) cells = cells.filter((c) => c !== id)
    }
    if (flag && short()) flag = false
    if (brand && short()) brand = false
    if (short() || widthEm < NARROW_EM) {
      numberStyle = 'bare'
      brand = false
      flag = false
    }
  }

  const tracks = [em(widthAt(POS_WIDTH, fontPx, minPx)), 'minmax(0, 1fr)']
  for (const id of cells) tracks.push(em(widthAt(columnWidth(id, p), fontPx, minPx)))
  const template = tracks.join(' ')
  const pitInline = !cells.includes('pit')
  return {
    cells,
    template,
    numberStyle,
    brand,
    flag,
    pitInline,
    nameEm: measured ? round2(widthEm - fixedEm(cells)) : 0,
    widthEm: round2(widthEm),
    key: `${cells.join(',')}|${numberStyle}|${brand ? 'b' : ''}${flag ? 'f' : ''}|${template}`
  }
}

/** `next`, or `prev` when it renders the same (a resize that changes nothing re-renders nothing). */
export function reuseColumns(prev: Columns | undefined, next: Columns): Columns {
  return prev !== undefined && prev.key === next.key ? prev : next
}

/**
 * What `p` asks for that `cols` (fitted from it) has no room for: the columns the width dropped,
 * in the user's order, and the make's mark and the flag when they went too. Nothing before the
 * width is measured.
 */
export function withoutRoom(
  p: ColumnPrefs,
  cols: Columns
): { readonly columns: readonly StandingsColumnId[]; brand: boolean; flag: boolean } {
  if (!(cols.widthEm > 0)) return { columns: [], brand: false, flag: false }
  const wanted = fitColumns(p, 0, 0).cells
  return {
    columns: wanted.filter((id) => !cols.cells.includes(id)),
    brand: p.brand && !cols.brand,
    flag: p.flag && !cols.flag
  }
}
