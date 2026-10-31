/**
 * View models of the relative widget (quality P1-10): which car goes in each slot (the player
 * always in the centre one), each slot formatted and flat so an unchanged slot keeps its object
 * (`reuseViews`) for v-memo, the grid columns in relative.columns' order (the driver's parts
 * that touch the name in its cell, shared/rowHead.ts), their heads, and the lines the font fit
 * counts besides the rows. Pure.
 */
import type { BrandId } from '@shared/carBrands'
import { visibleIds } from '@shared/elements'
import { formatClassPosition, formatGap } from '@shared/format'
import type { Messages } from '@shared/i18n'
import { INFO_BAR_LINE_EM } from '@shared/infoBar'
import { nameGroup, type DriverPartId } from '@shared/rowHead'
import type {
  CarPenalty,
  ElementEntry,
  IRatingFormat,
  LicenseStyle,
  NameFormat,
  RelativeColumnId,
  RelativeData,
  RelativeRow
} from '@shared/types'
import type { Density } from '@renderer/view/appearance'
import { lapCell, stintCell, tyreCell, type LapKind } from '@renderer/view/carExtras'
import { relativeHead, type ColumnHead } from '@renderer/view/columnHeads'
import { toDriverCell, type DriverCellView } from '@renderer/view/driverCell'
import type { DriverStyles } from '@renderer/view/styles'

export interface RelativeSlotView extends DriverCellView {
  kind: 'car'
  /** Class attribute of the row element, state classes included. */
  css: string
  isPlayer: boolean
  inPits: boolean
  /** In the pits around a tow: the tow badge (as in the standings) instead of PIT. */
  towed: boolean
  /** Lapping you / lapped by you; null on your lap. */
  lap: 'ahead' | 'behind' | null
  /** 'P5', '' when unknown. */
  pos: string
  /** '1.2', '-0.8'; blank on your own row. */
  gap: string
  /** Flag badge after the name (when the flags option is on). */
  penalty: CarPenalty | null
  /** Laps of the stint ('7', then stintUnit 'v'); both '' when unknown. */
  stint: string
  stintUnit: string
  /** Tyre compound letter ('H'), '—' when unknown. */
  tyre: string
  /** «Última vuelta», as the standings' (lapCell): outside races, the best lap. */
  lastLap: string
  lastLapKind: LapKind
  /** The car's make ('unknown' keeps an empty slot) and the driver's flag code ('' for none). */
  brand: BrandId
  country: string
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

/**
 * `race`: a race session (the «Última vuelta» cell shows the best lap elsewhere); `irFormat`: the
 * «Piloto» block's «Formato del iRating».
 */
export function toSlotView(
  row: RelativeRow,
  index: number,
  styles: DriverStyles,
  nameFormat: NameFormat,
  m: Messages,
  race = true,
  irFormat: IRatingFormat = 'compact'
): RelativeSlotView {
  const lap = row.isPlayer || row.lapRelation === 'same' ? null : row.lapRelation
  const stint = stintCell(row.stintLaps, m)
  const last = lapCell(row, race)
  return {
    ...toDriverCell(row, styles, nameFormat, m, irFormat),
    kind: 'car',
    css: rowCss(row, index % 2 === 1, lap),
    isPlayer: row.isPlayer,
    inPits: row.inPits,
    towed: row.inPits && row.towed,
    lap,
    pos: formatClassPosition(row.classPosition),
    // Your own gap is always 0.0: noise.
    gap: row.isPlayer ? '' : formatGap(row.gapS),
    penalty: row.penalty,
    stint: stint.text,
    stintUnit: stint.unit,
    tyre: tyreCell(row.tyre),
    lastLap: last.text,
    lastLapKind: last.kind,
    brand: row.brand,
    country: row.country
  }
}

export function toSlotViews(
  rows: readonly (RelativeRow | null)[],
  styles: DriverStyles,
  nameFormat: NameFormat,
  m: Messages,
  race = true,
  irFormat: IRatingFormat = 'compact'
): SlotView[] {
  return rows.map((row, i) => {
    if (row !== null) return toSlotView(row, i, styles, nameFormat, m, race, irFormat)
    return i % 2 === 1 ? EMPTY_ODD : EMPTY_EVEN
  })
}

/**
 * Column widths (em of the row font). The driver cell takes the rest. The driver's parts in
 * columns of their own (request 11) as wide as their slot in the driver cell: the number's plate
 * (NumberBadge: 2.1em of the plate's 0.82em text, 2.4 with the stripe), the make, the flag.
 */
export const RELATIVE_COL_EM = {
  pos: 1.9,
  number: 1.85,
  brand: 1.75,
  country: 1.73,
  // One flag badge, centred (as the tyre's ring).
  flags: 1.3,
  lic: 2.8,
  ir: 2.4,
  pit: 2.6,
  tyre: 1.3,
  stint: 2.3,
  // As the standings' (widgets/standings/columns.ts): '1:47.312' at 0.85em.
  last: 4.2,
  gap: 3.1
} as const satisfies Readonly<Record<Exclude<RelativeColumnId, 'driver'>, number>>
/** Row width (em) the default columns need with a readable name: it caps the font by width. */
export const RELATIVE_FIT_EM = 27
/** The number's column with the stripe style ('#23' after the stripe). */
const NUMBER_STRIPE_EM = 2.15
const COL_GAP_EM = 0.4
/** The driver cell's gap between its parts (DriverCell.vue .ov-driver). */
const CELL_GAP_EM = 0.35
/** The make's slot (BrandMark.vue: 1.75em wide) and its gap. */
export const BRAND_FIT_EM = 1.75 + CELL_GAP_EM
/** The flag's slot (CountryFlag.vue: 1.5 × the plate's 1.15em) and its gap, rounded up. */
export const FLAG_FIT_EM = Math.ceil((1.5 * 1.15 + CELL_GAP_EM) * 100) / 100
/** The penalty flag's slot before the name (DriverPart.vue) and its gap. */
const FLAGS_SLOT_EM = RELATIVE_COL_EM.flags + CELL_GAP_EM

export interface RelativeColumns {
  /** What a row draws, in the list's order (the name always among them). */
  cells: readonly RelativeColumnId[]
  /** The row's grid tracks: `cells` but the driver's parts drawn in the name's cell. */
  tracks: readonly RelativeColumnId[]
  /** The driver's parts drawn in the name's cell, before and after the name (rowHead.ts). */
  before: readonly DriverPartId[]
  after: readonly DriverPartId[]
  /** Penalty flag badges after the name: on, and placed there. */
  flags: boolean
  /**
   * The PIT / tow badge after the name: the PIT column is hidden (as the standings put it
   * inline without their "Boxes" column, R10).
   */
  pitInline: boolean
  /** The make's logo and the driver's flag are drawn, wherever they are. */
  brand: boolean
  country: boolean
  /** grid-template-columns of a row (and of the column heads). */
  template: string
  /**
   * Row width (em) the columns need: RELATIVE_FIT_EM plus the optional extras, so turning them on
   * shrinks the text in a narrow window instead of squeezing the name.
   */
  fitEm: number
  /** Changes with the cells, their order and the driver cell's parts (v-memo). */
  key: string
}

/** What the row draws besides relative.columns. */
export interface ColumnExtras {
  /** Some row names a compound: the tyre column can show (the provider names none otherwise). */
  tyres: boolean
  /** relative.showFlags. */
  flags: boolean
  /** brandMarksOn(relative.brandMarks, payload.multiBrand). */
  brand: boolean
  /** relative.countryFlags. */
  country: boolean
  /** The iRating column's width (iRatingColumnEm: request 10's format and plate); today's if absent. */
  irEm?: number
  /** appearance.numberStyle: the number's own column is wider with the stripe. */
  numberStyle?: 'chip' | 'stripe'
}

/**
 * The row's cells in the list's order: hidden ones leave the grid, so the name takes their
 * width. The row's start is columns too (request 11): the driver's parts that touch the name
 * are drawn in its cell, the others in tracks of their own. The make's logo and both flags show
 * while the «Piloto» block draws them; the tyre column only while some row has a compound
 * (today's rule).
 */
export function relativeColumns(
  list: readonly Readonly<ElementEntry<RelativeColumnId>>[],
  x: ColumnExtras
): RelativeColumns {
  const cells: RelativeColumnId[] = []
  for (const id of visibleIds(list)) {
    if (id === 'tyre' && !x.tyres) continue
    // The «Piloto» block's parts while it draws them.
    if (id === 'flags' && !x.flags) continue
    if (id === 'brand' && !x.brand) continue
    if (id === 'country' && !x.country) continue
    if (!cells.includes(id)) cells.push(id)
  }
  // The driver is required: a list main normalised always has it; a missing one goes where it is
  // by default. The gap can be hidden (R10, as in the standings); a list without it at all (not
  // normalised) still draws it at the end.
  if (!cells.includes('driver')) cells.splice(cells[0] === 'pos' ? 1 : 0, 0, 'driver')
  if (!cells.includes('gap') && !list.some((e) => e.id === 'gap')) cells.push('gap')
  const g = nameGroup(cells, 'driver')
  const irEm = x.irEm ?? RELATIVE_COL_EM.ir
  const numberEm = x.numberStyle === 'stripe' ? NUMBER_STRIPE_EM : RELATIVE_COL_EM.number
  const width = (id: Exclude<RelativeColumnId, 'driver'>): number =>
    id === 'ir' ? irEm : id === 'number' ? numberEm : RELATIVE_COL_EM[id]
  const tracks = g.tracks.map((id) => (id === 'driver' ? 'minmax(0, 1fr)' : `${width(id)}em`))
  let fitEm = RELATIVE_FIT_EM
  // A wider iRating (request 10) widens the fit by what it adds, as the extras below.
  if (cells.includes('ir')) fitEm += irEm - RELATIVE_COL_EM.ir
  if (cells.includes('tyre')) fitEm += RELATIVE_COL_EM.tyre + COL_GAP_EM
  if (cells.includes('stint')) fitEm += RELATIVE_COL_EM.stint + COL_GAP_EM
  if (cells.includes('pit')) fitEm += RELATIVE_COL_EM.pit + COL_GAP_EM
  if (cells.includes('last')) fitEm += RELATIVE_COL_EM.last + COL_GAP_EM
  // The penalty flags take room anywhere but after the name (after its text, as always).
  if (g.tracks.includes('flags')) fitEm += RELATIVE_COL_EM.flags + COL_GAP_EM
  if (g.before.includes('flags')) fitEm += FLAGS_SLOT_EM
  if (cells.includes('brand')) fitEm += BRAND_FIT_EM
  if (cells.includes('country')) fitEm += FLAG_FIT_EM
  // A part in a column of its own: a column's gap instead of the driver cell's.
  for (const id of g.tracks) {
    if (id === 'number' || id === 'brand' || id === 'country') fitEm += COL_GAP_EM - CELL_GAP_EM
  }
  return {
    cells,
    tracks: g.tracks,
    before: g.before,
    after: g.after,
    flags: g.after.includes('flags'),
    pitInline: !cells.includes('pit'),
    brand: cells.includes('brand'),
    country: cells.includes('country'),
    template: tracks.join(' '),
    fitEm: Math.round(fitEm * 100) / 100,
    key: `${cells.join(',')}|${irEm}|${numberEm}`
  }
}

/** One column head, keyed by its cell. */
export interface RelativeHeadView extends ColumnHead {
  readonly id: RelativeColumnId
}

/** The heads row over the tracks (same order, same grid). */
export function relativeHeads(
  cells: readonly RelativeColumnId[],
  licenseStyle: LicenseStyle,
  m: Messages,
  race = true
): RelativeHeadView[] {
  return cells.map((id) => ({ id, ...relativeHead(id, licenseStyle, m, race) }))
}

/** The column heads row's height (em of the row font), counted in the font fit. */
export const HEADS_EM = 1.1
/** Slack kept under the rows whatever the bars (today's header was 1.6em of line + this). */
export const CHROME_BASE_EM = 0.2

/**
 * A row's height in em of the row font, per density: 'comfortable' is the relative as it always
 * was (the text half a row high); 'compact' the same 1.2 step the standings take (DENSITY_EM).
 */
export const RELATIVE_ROW_EM = {
  comfortable: 2,
  compact: 1.65
} as const satisfies Record<Density, number>

/** The row height (em) for `density`, the comfortable one for anything else. */
export function relativeRowEm(density: unknown): number {
  return density === 'compact' ? RELATIVE_ROW_EM.compact : RELATIVE_ROW_EM.comfortable
}

/** The text's floor and cap (px), as RelativeWidget's .rl-panel clamps it. */
const FONT_MIN_PX = 9
const FONT_MAX_PX = 30

/**
 * The text size (px) a relative of `widthPx` × `heightPx` draws at (RelativeWidget .rl-panel):
 * `slots` rows of `rowEm` and the bars' `chromeEm` fill the height, unless the columns
 * (`fitEm`) need the width first.
 */
export function relativeFontPx(
  widthPx: number,
  heightPx: number,
  slots: number,
  rowEm: number,
  chromeEm: number,
  fitEm: number,
  minPx = FONT_MIN_PX
): number {
  const byHeight = heightPx / (slots * rowEm + chromeEm)
  const byWidth = widthPx / fitEm
  return Math.min(FONT_MAX_PX, Math.max(minPx, Math.min(byHeight, byWidth)))
}

/**
 * Whether the density changes what a relative of this size draws: the rows always fill the
 * height, so it only shows while the height sets the text for one of them; a narrow window
 * (the width sets it) draws both the same. Unmeasured: true.
 */
export function densityShows(
  widthPx: number,
  heightPx: number,
  slots: number,
  chromeEm: number,
  fitEm: number
): boolean {
  if (!(widthPx > 0) || !(heightPx > 0) || slots <= 0) return true
  const at = (rowEm: number): number =>
    relativeFontPx(widthPx, heightPx, slots, rowEm, chromeEm, fitEm)
  return Math.abs(at(RELATIVE_ROW_EM.comfortable) - at(RELATIVE_ROW_EM.compact)) >= 0.25
}

/** The panel's lines besides the rows: what the font fit divides the height by, with the rows. */
export interface ChromeParts {
  /** The header bar's text scale (INFO_BAR_SCALE), null when it is not drawn. */
  header: number | null
  heads: boolean
  footer: number | null
}

/**
 * The height (em of the row font) the bars and the heads take: each bar is INFO_BAR_LINE_EM of
 * its own (scaled) text. Today's header at 'normal' and no footer: 1.8.
 */
export function chromeEm(p: ChromeParts): number {
  let em = CHROME_BASE_EM
  if (p.header !== null) em += INFO_BAR_LINE_EM * p.header
  if (p.heads) em += HEADS_EM
  if (p.footer !== null) em += INFO_BAR_LINE_EM * p.footer
  return Math.round(em * 1000) / 1000
}
