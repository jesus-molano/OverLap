import { describe, expect, it } from 'vitest'
import { BORDER_PX } from './columns'
import {
  BOTTOM_PAD_EM,
  HEAD_RULE_PX,
  LAYOUT_SLACK_PX,
  headEm,
  lineBudgetEm,
  lineMetrics,
  linesEm,
  panelHeightPx,
  planLines,
  primaryBlock,
  type PlannedLine
} from './layout'
import { block } from './testing/rows'

const M = lineMetrics('compact')
const COMPACT = { oneLineLeaders: true }
const FULL = { oneLineLeaders: false }

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

describe('panelHeightPx', () => {
  it('is header + lines + padding in px, plus the borders and a little slack', () => {
    const px = panelHeightPx(10, 2, 13)
    expect(px).toBeCloseTo(
      (headEm(2) + 10 + BOTTOM_PAD_EM) * 13 + BORDER_PX + HEAD_RULE_PX + LAYOUT_SLACK_PX,
      9
    )
    expect(panelHeightPx(10, 1, 13)).toBeLessThan(px)
  })

  it('takes no window size: equal inputs, equal heights (no feedback loop possible)', () => {
    expect(panelHeightPx.length).toBe(3)
    expect(panelHeightPx(7.5, 1, 15)).toBe(panelHeightPx(7.5, 1, 15))
  })

  it('scales with the font and is 0 for unusable input', () => {
    expect(panelHeightPx(10, 1, 26) - panelHeightPx(10, 1, 13)).toBeCloseTo(
      (headEm(1) + 10 + BOTTOM_PAD_EM) * 13,
      9
    )
    expect(panelHeightPx(10, 1, 0)).toBe(0)
    expect(panelHeightPx(Number.NaN, 1, 13)).toBe(0)
  })

  it('gives a compact default table of about 300 px at 13 px', () => {
    // Header with ratings, class line, 8 rows, one other-class leader.
    const px = panelHeightPx(1.25 + 9 * 1.5, 2, 13)
    expect(px).toBeGreaterThan(240)
    expect(px).toBeLessThan(320)
  })
})

describe('lineBudgetEm', () => {
  it('is unlimited while the window is not measured', () => {
    expect(lineBudgetEm(0, 13, 1)).toBe(Infinity)
    expect(lineBudgetEm(300, 0, 1)).toBe(Infinity)
  })

  it('fits exactly the lines of the height that was asked for', () => {
    for (const body of [0, 3.5, 12.25, 30]) {
      for (const lines of [1, 2] as const) {
        const h = Math.ceil(panelHeightPx(body, lines, 13))
        expect(lineBudgetEm(h, 13, lines)).toBeGreaterThanOrEqual(body)
        expect(lineBudgetEm(h, 13, lines)).toBeLessThan(body + 0.2)
      }
    }
  })

  it('never goes negative', () => {
    expect(lineBudgetEm(10, 13, 2)).toBe(0)
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
