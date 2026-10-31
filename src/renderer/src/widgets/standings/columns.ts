/**
 * Which standings columns a car row has and how wide they are (ux §4.2-4.3). The text size comes
 * from the scale setting, so a narrower window drops columns instead of shrinking the text: the
 * name keeps NAME_MIN_EM and the columns go in DROP_ORDER, whatever order the user gave them.
 * The row's start is columns too (request 11): the driver's parts that touch the name are drawn
 * in its cell, the others in tracks of their own (shared/rowHead.ts). Pure; widths are in em of
 * the row font.
 */
import { moveAfterName, nameGroup, type DriverPartId } from '@shared/rowHead'
import type { AppearanceSettings, StandingsColumnId, StandingsOptions } from '@shared/types'

/**
 * First to go when the window narrows. 'gap' never goes (nor the position, the number and the
 * name). The stint extras go before the best lap, which goes before anything that was there
 * first. The flag and the make's mark (DECORATIONS_BEFORE) go before the best lap too: a
 * decoration never costs a column the table had before it. The penalty flags placed anywhere but
 * after the name go first of all: they then go after the name, where they always were.
 */
export const DROP_ORDER = [
  // Never lost: they go back after the name.
  'flags',
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

/** The row's start: the position, the driver's parts in tracks of their own, the name. */
type HeadId = 'pos' | 'number' | 'brand' | 'country' | 'driver'
const isHead = (id: StandingsColumnId): id is HeadId =>
  id === 'pos' || id === 'number' || id === 'brand' || id === 'country' || id === 'driver'

/** The other columns' widths (the row's start: headWidth). */
const COLUMN_WIDTH: Readonly<Record<Exclude<StandingsColumnId, HeadId>, ColumnWidth>> = {
  // One flag badge, centred (as the tyre's ring), at the icons' 0.85em.
  flags: { w: 1.3, text: 0.85 },
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

/** The driver cell's gap between its parts (DriverCell.vue .ov-driver). */
export const CELL_GAP_EM = 0.35
/** The make's mark in the name track (BrandMark: 1.75em wide), with the driver cell's gap. */
export const BRAND_EM = 1.75 + CELL_GAP_EM
/** The penalty flag's slot before the name (DriverPart.vue: one badge, as the flags' column). */
export const FLAGS_SLOT_EM = 1.3 + CELL_GAP_EM
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
  /** The penalty flags are drawn (the «Piloto» block's showFlags); false if absent. */
  penalties?: boolean
  /** The text floor (px, theme.css --ov-min-text: 10 with «Texto mínimo de 10 px»); 9 if absent. */
  minText?: number
  /** The iRating column's width (iRatingColumnEm: request 10's format and plate); today's if absent. */
  irEm?: number
}

export interface Columns {
  /** What a car row draws, in the user's order: the row's start too (the name always). */
  readonly cells: readonly StandingsColumnId[]
  /** The row's grid tracks: `cells` but the driver's parts drawn in the name's cell. */
  readonly tracks: readonly StandingsColumnId[]
  /** The driver's parts drawn in the name's cell, before and after the name (rowHead.ts). */
  readonly before: readonly DriverPartId[]
  readonly after: readonly DriverPartId[]
  /** grid-template-columns of a car row: one per track, the name's 1fr. */
  readonly template: string
  /** The position is drawn (its eye). */
  readonly pos: boolean
  readonly numberStyle: NumberStyle
  /** The make's mark and the flag are drawn (the block's, and they fit), wherever they are. */
  readonly brand: boolean
  readonly flag: boolean
  /** The pit column is not shown: pit state goes as an icon after the name. */
  readonly pitInline: boolean
  /** The penalty flags are drawn after the name (their place, or no room for it elsewhere). */
  readonly flagsInline: boolean
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
 * - 'brand', 'country' and 'flags' while the «Piloto» block draws them; the name always.
 */
export function columnWanted(id: StandingsColumnId, visible: boolean, p: ColumnPrefs): boolean {
  switch (id) {
    case 'driver':
      return true
    case 'brand':
      return visible && p.brand
    case 'country':
      return visible && p.flag
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
    case 'flags':
      return visible && p.penalties === true
    default:
      return visible
  }
}

/** Width (em of the row font) of a cell whose text is `text` em, given the text floor. */
function widthAt(c: ColumnWidth, fontPx: number, minPx = MIN_TEXT_PX): number {
  const floor = fontPx > 0 ? minPx / fontPx : 1
  return c.w * Math.max(1, floor / c.text)
}

/** A part of the row's start in a track of its own (the name's track is the rest: 1fr). */
function headWidth(
  id: HeadId,
  numberStyle: NumberStyle,
  fontPx: number,
  minPx: number
): ColumnWidth {
  switch (id) {
    case 'pos':
      return POS_WIDTH
    case 'number': {
      const n = NUMBER_WIDTH[numberStyle]
      return { w: n.w - CELL_GAP_EM, text: n.text }
    }
    case 'brand':
      return { w: BRAND_EM - CELL_GAP_EM, text: 1 }
    case 'country':
      return { w: flagEm(fontPx, minPx) - CELL_GAP_EM, text: 1 }
    case 'driver':
      return { w: 0, text: 1 }
  }
}

/** The width (em) a driver's part takes in the name's cell, its gap included. */
function inNameEm(
  part: DriverPartId,
  side: 'before' | 'after',
  numberStyle: NumberStyle,
  fontPx: number,
  minPx: number
): number {
  switch (part) {
    case 'number':
      return widthAt(NUMBER_WIDTH[numberStyle], fontPx, minPx)
    case 'brand':
      return BRAND_EM
    case 'country':
      return flagEm(fontPx, minPx)
    // After the name the flags take the name's room, as they always did.
    case 'flags':
      return side === 'before' ? FLAGS_SLOT_EM : 0
  }
}

function columnWidth(
  id: StandingsColumnId,
  p: ColumnPrefs,
  numberStyle: NumberStyle = 'chip',
  fontPx = 0,
  minPx = MIN_TEXT_PX
): ColumnWidth {
  if (isHead(id)) return headWidth(id, numberStyle, fontPx, minPx)
  if (id === 'gap' && !p.race) return NON_RACE_GAP
  if (id === 'gapLeader' && !p.race) return NON_RACE_GAP_LEADER
  if (id === 'lic' && p.licenseStyle === 'letter') return LIC_LETTER
  if (id === 'ir' && p.irEm !== undefined) return { w: p.irEm, text: COLUMN_WIDTH.ir.text }
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
  // The name is required: a list main normalised always has it; a missing one goes where it is by
  // default, after the position.
  if (!seen.has('driver')) shown.splice(shown[0] === 'pos' ? 1 : 0, 0, 'driver')
  const widthEm = rowWidthEm(widthPx, fontPx)
  const measured = widthEm > 0
  let numberStyle: NumberStyle = p.numberStyle === 'stripe' ? 'stripe' : 'chip'
  const minPx = p.minText ?? MIN_TEXT_PX
  const trackEm = (id: StandingsColumnId): number =>
    widthAt(columnWidth(id, p, numberStyle, fontPx, minPx), fontPx, minPx)

  const fixedEm = (cells: readonly StandingsColumnId[]): number => {
    const g = nameGroup(cells, 'driver')
    let sum = 0
    for (const id of g.tracks) if (id !== 'driver') sum += trackEm(id)
    for (const part of g.before) sum += inNameEm(part, 'before', numberStyle, fontPx, minPx)
    for (const part of g.after) sum += inNameEm(part, 'after', numberStyle, fontPx, minPx)
    return sum + COL_GAP_EM * (g.tracks.length - 1)
  }

  let cells: readonly StandingsColumnId[] = shown
  const drop = (id: StandingsColumnId): void => {
    cells = cells.filter((c) => c !== id)
  }
  if (measured) {
    const short = (): boolean => widthEm - fixedEm(cells) < NAME_MIN_EM
    for (const id of DROP_ORDER) {
      if (!short()) break
      if (id === DECORATIONS_BEFORE) {
        drop('country')
        if (short()) drop('brand')
        if (!short()) break
      }
      // The penalty flags are never lost: they go after the name.
      if (id === 'flags') cells = moveAfterName(cells, 'flags', 'driver')
      else drop(id)
    }
    if (short()) drop('country')
    if (short()) drop('brand')
    if (short() || widthEm < NARROW_EM) {
      numberStyle = 'bare'
      drop('brand')
      drop('country')
    }
  }

  const g = nameGroup(cells, 'driver')
  const template = g.tracks
    .map((id) => (id === 'driver' ? 'minmax(0, 1fr)' : em(trackEm(id))))
    .join(' ')
  return {
    cells,
    tracks: g.tracks,
    before: g.before,
    after: g.after,
    template,
    numberStyle,
    brand: cells.includes('brand'),
    flag: cells.includes('country'),
    pitInline: !cells.includes('pit'),
    flagsInline: g.after.includes('flags'),
    pos: cells.includes('pos'),
    nameEm: measured ? round2(widthEm - fixedEm(cells)) : 0,
    widthEm: round2(widthEm),
    key: `${cells.join(',')}|${numberStyle}|${template}`
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
    // The penalty flags are never lost: they go after the name.
    columns: wanted.filter((id) => id !== 'flags' && !cols.cells.includes(id)),
    brand: p.brand && !cols.brand,
    flag: p.flag && !cols.flag
  }
}
