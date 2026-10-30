/**
 * Row states (pits, disconnected) dim the cells of a line. The line element belongs to
 * StandingsWidget while the cells are StandingsCarCells' own roots, so the scoped rules must name
 * each cell: `.is-pits > :not(…)` or `.is-disconnected > *` compile with the scope attribute on
 * the line and never match (the pit row then dimmed only its name).
 */
import { describe, expect, it } from 'vitest'

const RAW = import.meta.glob('./StandingsCarCells.vue', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

const source = RAW['./StandingsCarCells.vue'] ?? ''
const template = /<template>([\s\S]*)<\/template>/.exec(source)?.[1] ?? ''
const css = [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
  .map((m) => m[1] ?? '')
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')

/** The cells of a line: the `c-*` classes on the template's elements. */
const cells = [...new Set([...template.matchAll(/class="(c-[\w-]+)"/g)].map((m) => m[1] ?? ''))]

/**
 * Whether a state's rules dim this cell. The other class's leader cell is display: contents, so its
 * rule dims its children (class tag and driver cell) instead.
 */
function dims(state: string, cell: string): boolean {
  const own = `.is-${state} > .${cell}`
  return selectors.includes(own) || (cell === 'c-lead' && selectors.includes(`${own} > *`))
}

/** Selectors of every rule (comma-separated lists split). */
const selectors = [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].flatMap((m) =>
  (m[1] ?? '').split(',').map((s) => s.trim().replace(/\s+/g, ' '))
)

describe('standings row states', () => {
  it('finds the cells', () => {
    expect(cells).toEqual(expect.arrayContaining(['c-pos', 'c-driver', 'c-gap', 'c-pit']))
  })

  it('never puts the scope on the line with a bare child selector', () => {
    const bare = selectors.filter((s) => /^\.is-[\w-]+ > (\*|:not\()/.test(s))
    expect(bare).toEqual([])
  })

  it('dims every cell of a car in the pits but its pit state, driver and penalty flags', () => {
    const dimmed = cells.filter((c) => dims('pits', c))
    expect(dimmed.sort()).toEqual(
      cells.filter((c) => !['c-pit', 'c-driver', 'c-flags'].includes(c)).sort()
    )
    // The driver's plate and name step back too, its state icons stay.
    expect(selectors).toContain('.is-pits > .c-driver > :deep(:not(.sd-icons))')
  })

  it('dims every cell of a disconnected car', () => {
    const dimmed = cells.filter((c) => dims('disconnected', c))
    expect(dimmed.sort()).toEqual([...cells].sort())
  })
})
