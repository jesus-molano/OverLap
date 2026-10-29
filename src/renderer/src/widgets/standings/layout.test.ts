import { describe, expect, it } from 'vitest'
import { INFO_BAR_LINE_EM, INFO_BAR_TOP_EM } from '@shared/infoBar'
import { BORDER_PX } from './columns'
import {
  BAR_RULE_PX,
  BOTTOM_PAD_EM,
  HEADS_EM,
  LAYOUT_SLACK_PX,
  TOP_PAD_EM,
  barPx,
  chromePx,
  lineBudgetEm,
  lineMetrics,
  linesEm,
  panelHeightPx,
  planLines,
  primaryBlock,
  type Chrome,
  type PlannedLine
} from './layout'
import { block } from './testing/rows'

const M = lineMetrics('compact')
const COMPACT = { oneLineLeaders: true }
const FULL = { oneLineLeaders: false }

/** Today's default: the header and its second line, no heads, the footer. */
const TWO: Chrome = { head: ['normal', 'normal'], heads: false, foot: null }
const ONE: Chrome = { head: ['normal'], heads: false, foot: null }
const FOOTED: Chrome = { ...TWO, foot: 'normal' }
const BARE: Chrome = { head: [], heads: false, foot: null }

/** 'H' for a class header, 'L<pos>' for a one-line leader, the class position for a car row. */
function shape(lines: readonly PlannedLine[]): (string | number)[] {
  return lines.map((l) =>
    l.kind === 'class' ? 'H' : l.kind === 'leader' ? `L${l.row.classPosition}` : l.row.classPosition
  )
}

describe('lineMetrics', () => {
  it('follows the density', () => {
    expect(lineMetrics('compact')).toEqual({ rowEm: 1.5, classEm: 1.25 })
    expect(lineMetrics('comfortable')).toEqual({ rowEm: 1.8, classEm: 1.45 })
  })
})

describe('barPx', () => {
  it('is the bar line of its own text plus its rule', () => {
    expect(barPx('normal', 13)).toBeCloseTo(INFO_BAR_LINE_EM * 13 + BAR_RULE_PX, 9)
    expect(barPx('large', 13)).toBeCloseTo(INFO_BAR_LINE_EM * 13 * 1.2 + BAR_RULE_PX, 9)
    expect(barPx('small', 20)).toBeCloseTo(INFO_BAR_LINE_EM * 20 * 0.85 + BAR_RULE_PX, 9)
  })

  it('never puts the text below the minimum size', () => {
    // 0.85 x 10 px would be 8.5 px: the bar keeps 9 px text, so it is that tall.
    expect(barPx('small', 10)).toBeCloseTo(INFO_BAR_LINE_EM * 9 + BAR_RULE_PX, 9)
    expect(barPx('normal', 0)).toBe(0)
  })
})

describe('chromePx', () => {
  it('adds each header bar, the heads, the footer (or the paddings) and the borders', () => {
    const bar = barPx('normal', 13)
    const top = barPx('normal', 13, true)
    expect(chromePx(TWO, 13)).toBeCloseTo(BORDER_PX + top + bar + BOTTOM_PAD_EM * 13, 9)
    expect(chromePx(FOOTED, 13)).toBeCloseTo(BORDER_PX + top + 2 * bar, 9)
    expect(chromePx({ ...TWO, heads: true }, 13) - chromePx(TWO, 13)).toBeCloseTo(HEADS_EM * 13, 9)
  })

  it('keeps a top padding when no header bar is drawn', () => {
    expect(chromePx(BARE, 13)).toBeCloseTo(BORDER_PX + (TOP_PAD_EM + BOTTOM_PAD_EM) * 13, 9)
    expect(chromePx({ ...BARE, heads: true }, 13)).toBeCloseTo(
      BORDER_PX + (TOP_PAD_EM + HEADS_EM + BOTTOM_PAD_EM) * 13,
      9
    )
  })

  it('follows each bar’s size', () => {
    const small: Chrome = { head: ['small'], heads: false, foot: 'large' }
    expect(chromePx(small, 13)).toBeCloseTo(
      BORDER_PX + barPx('small', 13, true) + barPx('large', 13),
      9
    )
  })

  it('draws the two header lines as tall as today’s header: 3.45 em, the top one as its band', () => {
    expect(barPx('normal', 16, true) - BAR_RULE_PX).toBeCloseTo(INFO_BAR_TOP_EM * 16, 9)
    const lines = barPx('normal', 16, true) + barPx('normal', 16) - 2 * BAR_RULE_PX
    expect(lines / 16).toBeCloseTo(0.3 * 2 + 1.5 + 1.35, 9)
  })
})

describe('panelHeightPx', () => {
  it('is the lines in px plus the chrome and a little slack', () => {
    const px = panelHeightPx(10, TWO, 13)
    expect(px).toBeCloseTo(10 * 13 + chromePx(TWO, 13) + LAYOUT_SLACK_PX, 9)
    expect(panelHeightPx(10, ONE, 13)).toBeLessThan(px)
  })

  it('puts the footer bar, with its rule, in the bottom padding’s place', () => {
    const px = panelHeightPx(10, FOOTED, 13)
    expect(px - panelHeightPx(10, TWO, 13)).toBeCloseTo(barPx('normal', 13) - BOTTOM_PAD_EM * 13, 9)
  })

  it('takes no window size: equal inputs, equal heights (no feedback loop possible)', () => {
    expect(panelHeightPx.length).toBe(3)
    expect(panelHeightPx(7.5, ONE, 15)).toBe(panelHeightPx(7.5, ONE, 15))
  })

  it('scales with the font and is 0 for unusable input', () => {
    expect(panelHeightPx(10, ONE, 26) - panelHeightPx(10, ONE, 13)).toBeCloseTo(
      (10 + INFO_BAR_TOP_EM + BOTTOM_PAD_EM) * 13,
      9
    )
    expect(panelHeightPx(10, ONE, 0)).toBe(0)
    expect(panelHeightPx(Number.NaN, ONE, 13)).toBe(0)
  })

  it('gives a compact default table of about 300 px at 13 px', () => {
    // Header and its second line, class line, 8 rows, one other-class leader, the footer.
    const px = panelHeightPx(1.25 + 9 * 1.5, FOOTED, 13)
    expect(px).toBeGreaterThan(240)
    expect(px).toBeLessThan(320)
  })
})

describe('lineBudgetEm', () => {
  it('is unlimited while the window is not measured', () => {
    expect(lineBudgetEm(0, 13, ONE)).toBe(Infinity)
    expect(lineBudgetEm(300, 0, ONE)).toBe(Infinity)
  })

  it('fits exactly the lines of the height that was asked for', () => {
    const chromes: Chrome[] = [BARE, ONE, TWO, FOOTED, { ...FOOTED, heads: true }]
    for (const body of [0, 3.5, 12.25, 30]) {
      for (const c of chromes) {
        const h = Math.ceil(panelHeightPx(body, c, 13))
        expect(lineBudgetEm(h, 13, c)).toBeGreaterThanOrEqual(body)
        expect(lineBudgetEm(h, 13, c)).toBeLessThan(body + 0.2)
      }
    }
  })

  it('never goes negative', () => {
    expect(lineBudgetEm(10, 13, TWO)).toBe(0)
    expect(lineBudgetEm(30, 13, FOOTED)).toBe(0)
  })

  it('keeps the bars: a window sized with the footer gives its rows that room without it', () => {
    for (const body of [0, 3.5, 12.25]) {
      const h = Math.ceil(panelHeightPx(body, FOOTED, 13))
      expect(lineBudgetEm(h, 13, TWO)).toBeGreaterThan(body + INFO_BAR_LINE_EM - BOTTOM_PAD_EM)
    }
  })
})

describe('primaryBlock', () => {
  it('is the player class, else the first block', () => {
    expect(primaryBlock([block([1]), block([1], {}, 1)])).toBe(1)
    expect(primaryBlock([block([1]), block([1])])).toBe(0)
    expect(primaryBlock([])).toBe(0)
  })
})

describe('planLines', () => {
  it('hides the class header in a single-class session', () => {
    expect(shape(planLines([block([1, 2, 3], {}, 2)], COMPACT, M))).toEqual([1, 2, 3])
    expect(shape(planLines([block([1, 2, 3], {}, 2)], FULL, M))).toEqual([1, 2, 3])
  })

  it('compact: other classes sent as their leader become one line each', () => {
    const classes = [
      block([1, 2, 3], {}, 2),
      block([1], { classId: 2 }),
      block([1], { classId: 3 })
    ]
    expect(shape(planLines(classes, COMPACT, M))).toEqual(['H', 1, 2, 3, 'L1', 'L1'])
    // Full mode (or a block with more rows) keeps the class header.
    expect(shape(planLines(classes, FULL, M))).toEqual(['H', 1, 2, 3, 'H', 1, 'H', 1])
    const two = [block([1, 2], {}, 1), block([1, 2], { classId: 2 })]
    expect(shape(planLines(two, COMPACT, M))).toEqual(['H', 1, 2, 'H', 1, 2])
  })

  it('stripes rows per block and keeps separators from the provider', () => {
    const b = block([1, 2, 3, 7, 8], {}, 8)
    const rows = b.rows.map((r) => ({ ...r, gapBefore: r.classPosition === 7 }))
    const lines = planLines([{ ...b, rows }], COMPACT, M)
    expect(lines.map((l) => (l.kind === 'car' ? [l.alt, l.gapBefore] : null))).toEqual([
      [false, false],
      [true, false],
      [false, false],
      [true, true],
      [false, false]
    ])
  })

  it('keeps everything when it fits', () => {
    const classes = [block([1, 2, 3], {}, 2), block([1], { classId: 2 })]
    const all = planLines(classes, COMPACT, M)
    const em = linesEm(all, M)
    expect(em).toBeCloseTo(M.classEm + 4 * M.rowEm, 9)
    expect(shape(planLines(classes, COMPACT, M, em))).toEqual(shape(all))
  })

  it('drops other classes first, from the bottom up, header last', () => {
    const classes = [
      block([1, 2], {}, 1),
      block([1, 2], { classId: 2 }),
      block([1, 2], { classId: 3 })
    ]
    const fit = (rows: number, headers: number): (string | number)[] =>
      shape(planLines(classes, COMPACT, M, rows * M.rowEm + headers * M.classEm))
    expect(fit(6, 3)).toEqual(['H', 1, 2, 'H', 1, 2, 'H', 1, 2])
    expect(fit(5, 3)).toEqual(['H', 1, 2, 'H', 1, 2, 'H', 1])
    expect(fit(4, 2)).toEqual(['H', 1, 2, 'H', 1, 2])
    expect(fit(3, 2)).toEqual(['H', 1, 2, 'H', 1])
    expect(fit(2, 1)).toEqual(['H', 1, 2])
  })

  it('drops a one-line leader as a whole', () => {
    const classes = [block([1, 2], {}, 1), block([1], { classId: 2 })]
    expect(shape(planLines(classes, COMPACT, M, M.classEm + 2 * M.rowEm))).toEqual(['H', 1, 2])
  })

  it('then drops the rows of your class farthest from you, keeping the leader longer', () => {
    const b = block([1, 2, 3, 7, 8, 9, 10, 11, 12, 13], {}, 10)
    const fit = (rows: number): (string | number)[] =>
      shape(planLines([b], COMPACT, M, rows * M.rowEm))
    expect(fit(10)).toEqual([1, 2, 3, 7, 8, 9, 10, 11, 12, 13])
    expect(fit(9)).toEqual([1, 3, 7, 8, 9, 10, 11, 12, 13])
    expect(fit(8)).toEqual([1, 7, 8, 9, 10, 11, 12, 13])
    expect(fit(7)).toEqual([1, 7, 8, 9, 10, 11, 12])
    expect(fit(6)).toEqual([1, 8, 9, 10, 11, 12])
    expect(fit(3)).toEqual([9, 10, 11])
    expect(fit(1)).toEqual([10])
  })

  it('never drops your row, even when nothing fits', () => {
    const classes = [block([1, 2, 3], {}, 3), block([1], { classId: 2 })]
    expect(shape(planLines(classes, COMPACT, M, 0))).toEqual(['H', 3])
  })

  it('marks a separator wherever rows were dropped', () => {
    const b = block([1, 2, 3, 4, 5, 6], {}, 5)
    const lines = planLines([b], COMPACT, M, 4 * M.rowEm)
    expect(
      lines.map((l) => (l.kind === 'car' ? `${l.row.classPosition}${l.gapBefore ? '|' : ''}` : 'H'))
    ).toEqual(['1', '4|', '5', '6'])
  })

  it('without your row drops from the bottom', () => {
    expect(shape(planLines([block([1, 2, 3, 4])], COMPACT, M, 2 * M.rowEm))).toEqual([1, 2])
  })

  it('handles no classes and empty blocks', () => {
    expect(planLines([], COMPACT, M)).toEqual([])
    expect(shape(planLines([block([], {}, 1), block([], { classId: 2 })], COMPACT, M))).toEqual([
      'H'
    ])
  })
})

describe('linesEm', () => {
  it('sums class lines and rows', () => {
    const lines = planLines([block([1, 2], {}, 1), block([1], { classId: 2 })], COMPACT, M)
    expect(linesEm(lines, M)).toBeCloseTo(M.classEm + 3 * M.rowEm, 9)
    expect(linesEm(lines, lineMetrics('comfortable'))).toBeCloseTo(1.45 + 3 * 1.8, 9)
  })
})
