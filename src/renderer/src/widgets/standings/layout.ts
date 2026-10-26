/**
 * Vertical layout of the standings widget: which lines are drawn and how tall the panel is.
 * Every height is a fixed em of the panel font (set as CSS custom properties from these same
 * numbers), so the height the content wants is known without measuring and never depends on
 * the window height: the window follows the content, not the other way round (ux §3.1-3.2).
 * Pure.
 */
import type { StandingsClassBlock, StandingsRow } from '@shared/types'
import { DENSITY_EM, type Density } from '@renderer/view/appearance'
import { FOOTER_EM, FOOTER_RULE_PX } from '@renderer/view/conditions'
import { BORDER_PX } from './columns'

export type DisplayRow = StandingsClassBlock['rows'][number]

/** Panel header: padding above and below, first line, optional second line (em). */
export const HEAD_PAD_EM = 0.3
export const HEAD_LINE1_EM = 1.5
export const HEAD_LINE2_EM = 1.35
/** Rule under the header. */
export const HEAD_RULE_PX = 1
/** Below the last line (the conditions footer, when drawn, takes its place: it ends the panel). */
export const BOTTOM_PAD_EM = 0.25
/** Offline status line and the "no data yet" placeholder. */
export const STATUS_EM = 2.8
export const EMPTY_EM = 3.9
/**
 * Added to the reported height: the browser rounds each em height to its layout unit, so the
 * sum can exceed the computed one by a fraction of a pixel. Half a pixel of transparent window
 * is invisible; a clipped bottom border is not.
 */
export const LAYOUT_SLACK_PX = 0.5

export interface LineMetrics {
  /** Car row (em). */
  readonly rowEm: number
  /** Class header line (em). */
  readonly classEm: number
}

export function lineMetrics(density: Density): LineMetrics {
  const d = DENSITY_EM[density] ?? DENSITY_EM.compact
  return { rowEm: d.row, classEm: d.classLine }
}

export type HeadLines = 1 | 2

export function headEm(lines: HeadLines): number {
  return 2 * HEAD_PAD_EM + HEAD_LINE1_EM + (lines === 2 ? HEAD_LINE2_EM : 0)
}

/** Below the lines: the bottom padding, or the conditions footer (em, then its rule in px). */
function bottomEm(footer: boolean): number {
  return footer ? FOOTER_EM : BOTTOM_PAD_EM
}

function bottomPx(footer: boolean): number {
  return footer ? FOOTER_RULE_PX : 0
}

/**
 * Height (CSS px) of the whole panel for `bodyEm` of lines below a header of `headLines`, and
 * above the conditions footer when `footer`. Takes no window size: equal inputs give equal
 * heights, so reporting it cannot feed back.
 */
export function panelHeightPx(
  bodyEm: number,
  headLines: HeadLines,
  fontPx: number,
  footer = false
): number {
  if (!(fontPx > 0) || !Number.isFinite(bodyEm)) return 0
  const em = headEm(headLines) + Math.max(0, bodyEm) + bottomEm(footer)
  return em * fontPx + BORDER_PX + HEAD_RULE_PX + bottomPx(footer) + LAYOUT_SLACK_PX
}

/**
 * Em left for lines in a window `heightPx` tall (Infinity while it is not measured), with the
 * conditions footer drawn when `footer` (it stays: rows go first).
 */
export function lineBudgetEm(
  heightPx: number,
  fontPx: number,
  headLines: HeadLines,
  footer = false
): number {
  if (!(heightPx > 0) || !(fontPx > 0)) return Infinity
  const px = heightPx - BORDER_PX - HEAD_RULE_PX - bottomPx(footer)
  return Math.max(0, px / fontPx - headEm(headLines) - bottomEm(footer))
}

// ---------------------------------------------------------------------------
// Lines
// ---------------------------------------------------------------------------

export type PlannedLine =
  | { kind: 'class'; block: StandingsClassBlock }
  | {
      kind: 'car'
      row: DisplayRow
      /** Rows were skipped above this one (by the provider or by the trim): a separator. */
      gapBefore: boolean
      /** Odd row within its block (striping). */
      alt: boolean
    }
  /** Leader of another class on one line: its class tag takes the position slot. */
  | { kind: 'leader'; block: StandingsClassBlock; row: DisplayRow }

export interface PlanOptions {
  /** Compact mode: another class sent as its leader alone is one line, with no class header. */
  oneLineLeaders: boolean
}

/** Index of the player's class block: the flagged one, else the first. */
export function primaryBlock(classes: readonly StandingsClassBlock[]): number {
  const i = classes.findIndex((c) => c.isPlayerClass)
  return i >= 0 ? i : 0
}

/** How a block is drawn: one leader line, or its rows (under a class header unless single-class). */
type BlockShape = 'leader' | 'rows' | 'headed'

function blockShape(
  classes: readonly StandingsClassBlock[],
  b: number,
  primary: number,
  o: PlanOptions
): BlockShape {
  const block = classes[b]
  if (classes.length === 1) return 'rows'
  if (o.oneLineLeaders && b !== primary && block?.rows.length === 1) return 'leader'
  return 'headed'
}

/** Rounding slack: a budget a hair short of a whole row still takes it. */
const FIT_EPS = 1e-6

/**
 * Lines to draw within `budgetEm` (Infinity: all of them). The class header is left out in a
 * single-class session (the header line shows its SoF instead). When everything does not fit,
 * rows go in this order: other classes from the bottom up (a block whose rows are all gone loses
 * its header too), then rows of your class farthest from you first (the class leader counts as
 * two rows away; ties drop the lower row first). Your row and its class header always stay.
 */
export function planLines(
  classes: readonly StandingsClassBlock[],
  o: PlanOptions,
  m: LineMetrics,
  budgetEm = Infinity
): PlannedLine[] {
  const primary = primaryBlock(classes)
  const shapes = classes.map((_, b) => blockShape(classes, b, primary, o))
  const keep = classes.map((c) => c.rows.map(() => true))
  const keepHead = shapes.map((s) => s === 'headed')
  let total = 0
  classes.forEach((c, b) => {
    total += c.rows.length * m.rowEm + (keepHead[b] ? m.classEm : 0)
  })
  const over = (): boolean => total > budgetEm + FIT_EPS

  if (over()) {
    for (let b = classes.length - 1; b >= 0 && over(); b--) {
      if (b === primary) continue
      const k = keep[b] ?? []
      for (let r = k.length - 1; r >= 0 && over(); r--) {
        k[r] = false
        total -= m.rowEm
      }
      if (keepHead[b] && !k.includes(true)) {
        keepHead[b] = false
        total -= m.classEm
      }
    }
    const k = keep[primary] ?? []
    for (const r of dropOrder(classes[primary]?.rows ?? [])) {
      if (!over()) break
      k[r] = false
      total -= m.rowEm
    }
  }

  const out: PlannedLine[] = []
  classes.forEach((block, b) => {
    const k = keep[b] ?? []
    if (shapes[b] === 'leader') {
      const row = block.rows[0]
      if (row !== undefined && k[0]) out.push({ kind: 'leader', block, row })
      return
    }
    if (!k.includes(true) && b !== primary) return
    if (keepHead[b]) out.push({ kind: 'class', block })
    let skipped = false
    let n = 0
    block.rows.forEach((row, r) => {
      if (!k[r]) {
        skipped = true
        return
      }
      out.push({ kind: 'car', row, gapBefore: row.gapBefore || skipped, alt: n % 2 === 1 })
      skipped = false
      n++
    })
  })
  return out
}

/** Height (em) of planned lines. */
export function linesEm(lines: readonly PlannedLine[], m: LineMetrics): number {
  let em = 0
  for (const l of lines) em += l.kind === 'class' ? m.classEm : m.rowEm
  return em
}

/** Row indices of a block in the order they are dropped (the player's row is never listed). */
function dropOrder(rows: readonly StandingsRow[]): number[] {
  const player = rows.findIndex((r) => r.isPlayer)
  const dist = (i: number): number => {
    // Without your row there is nothing to centre on: drop from the bottom.
    if (player < 0) return i
    const d = Math.abs(i - player)
    return rows[i]?.classPosition === 1 ? Math.min(d, 2) : d
  }
  const order: number[] = []
  for (let i = 0; i < rows.length; i++) if (i !== player) order.push(i)
  return order.sort((a, b) => dist(b) - dist(a) || b - a)
}
