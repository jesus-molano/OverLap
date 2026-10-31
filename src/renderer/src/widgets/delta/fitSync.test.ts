/**
 * The rows' sizes are written twice: in rows.ts (what the window fits, what the room holds) and
 * in DeltaWidget's stylesheet (what is drawn). Each number of the stylesheet is read here and
 * compared with its constant, so the two never drift apart.
 */
import { describe, expect, it } from 'vitest'
import SOURCE from './DeltaWidget.vue?raw'
import {
  DELTA_MULTI_HEAD_EM,
  DELTA_MULTI_NARROW_W,
  DELTA_MULTI_NOBAR_W,
  DELTA_MULTI_PAD_EM,
  DELTA_MULTI_ROW_EM,
  DELTA_MULTI_W,
  DELTA_NARROW_PX,
  DELTA_ROW_FIT_EM
} from './rows'

const STYLE = /<style scoped>([\s\S]*)<\/style>/.exec(SOURCE)?.[1] ?? ''

/** The declarations of the first rule whose selector is exactly `selector` (outside queries). */
function rule(selector: string, css = STYLE): string {
  const at = css.indexOf(`\n${selector} {`)
  expect(at, selector).toBeGreaterThanOrEqual(0)
  const open = css.indexOf('{', at)
  return css.slice(open + 1, css.indexOf('\n}', open))
}

/** A custom property's number in `decls`. */
function num(decls: string, prop: string): number {
  const m = new RegExp(`${prop}:\\s*(-?[\\d.]+)`).exec(decls)
  expect(m, prop).not.toBeNull()
  return Number(m?.[1])
}

/** The body of the `@container delta (max-width: Npx)` blocks, joined. */
function narrow(px: number): string {
  const head = `@container delta (max-width: ${px}px) {`
  let out = ''
  for (let at = STYLE.indexOf(head); at >= 0; at = STYLE.indexOf(head, at + 1)) {
    out += STYLE.slice(at + head.length, STYLE.indexOf('\n}', at))
  }
  return out
}

describe("the rows' sizes: rows.ts and the stylesheet agree", () => {
  it('the height: padding, head line, one row each, the sectors and the lap times', () => {
    const multi = rule('.dl--multi .dl-panel')
    expect(num(multi, '--dl-h-head')).toBe(DELTA_MULTI_HEAD_EM)
    expect(multi).toContain(`${DELTA_MULTI_PAD_EM} + var(--dl-h-head) + var(--dl-h-lanes)`)
    expect(num(multi, '--dl-h-lanes')).toBeCloseTo(2 * DELTA_MULTI_ROW_EM, 6)
    for (const n of [3, 4, 5]) {
      expect(num(rule(`.dl--multi-${n} .dl-panel`), '--dl-h-lanes')).toBeCloseTo(
        n * DELTA_MULTI_ROW_EM,
        6
      )
    }
    expect(num(rule('.dl--multi-nohead .dl-panel'), '--dl-h-head')).toBe(0)
    expect(num(rule('.dl--sectors .dl-panel'), '--dl-h-sectors')).toBe(DELTA_ROW_FIT_EM.sectors)
    expect(num(rule('.dl--laps .dl-panel'), '--dl-h-laps')).toBe(DELTA_ROW_FIT_EM.laps)
    // What a row and the head line take on screen.
    expect(rule('.dl-lane')).toContain(`height: ${DELTA_MULTI_ROW_EM}em`)
    const head = Number(/height: ([\d.]+)em/.exec(rule('.dl-head'))?.[1])
    const gap = Number(/gap: ([\d.]+)em/.exec(rule('.dl-multi'))?.[1])
    expect(head + gap).toBeCloseTo(DELTA_MULTI_HEAD_EM, 6)
  })

  it('the width: with the bar, without it, and in a narrow window', () => {
    expect(num(rule('.dl--multi .dl-panel'), '--dl-w-lanes')).toBe(DELTA_MULTI_NOBAR_W)
    expect(num(rule('.dl--multi.dl--bar .dl-panel'), '--dl-w-lanes')).toBe(DELTA_MULTI_W)
    const n = narrow(DELTA_NARROW_PX)
    expect(n).toContain('.dl--multi.dl--bar .dl-panel')
    expect(num(n.slice(n.indexOf('.dl--multi.dl--bar .dl-panel')), '--dl-w-lanes')).toBe(
      DELTA_MULTI_NARROW_W
    )
  })

  it('no narrow window hides the head line rows.ts counts', () => {
    for (const px of [DELTA_NARROW_PX, 220]) {
      expect(narrow(px), `${px}`).not.toMatch(/\.dl-head \{\s*display: none/)
      expect(narrow(px), `${px}`).not.toMatch(/--dl-h-head: 0/)
    }
  })
})
