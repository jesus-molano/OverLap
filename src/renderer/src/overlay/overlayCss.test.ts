/**
 * An overlay window covers its whole display: anything that paints its document, its root or
 * the panel containers would cover the game. The page and the containers stay transparent; only
 * the widgets inside the panels paint.
 */
import { describe, expect, it } from 'vitest'

const RAW = import.meta.glob(['../**/*.vue', '../**/*.css'], {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

/** Sources by path under src/renderer/src ('styles/theme.css', 'overlay/WidgetSlot.vue'). */
const SOURCES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(RAW).map(([k, v]) => [k.replace(/^\.\.\//, '').replace(/^\.\//, 'overlay/'), v])
)

interface Rule {
  file: string
  selectors: string[]
  decls: { prop: string; value: string }[]
}

/** CSS of a file: the <style> blocks of an SFC, or the whole stylesheet; comments removed. */
function cssOf(file: string, source: string): string {
  const css = file.endsWith('.vue')
    ? [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1] ?? '').join('\n')
    : source
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Innermost rules (inside @media / @container too), with their selector lists. */
function rulesOf(file: string, source: string): Rule[] {
  const out: Rule[] = []
  for (const m of cssOf(file, source).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = (m[1] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '')
    const decls = [...(m[2] ?? '').matchAll(/([-\w]+)\s*:\s*([^;]+)/g)].map((d) => ({
      prop: (d[1] ?? '').toLowerCase(),
      value: (d[2] ?? '').trim()
    }))
    out.push({ file, selectors, decls })
  }
  return out
}

const OVERLAY_RULES: readonly Rule[] = Object.entries(SOURCES)
  .filter(([file]) => !file.startsWith('settings/'))
  .flatMap(([file, source]) => rulesOf(file, source))

function backgrounds(rule: Rule): string[] {
  return rule.decls.filter((d) => d.prop.startsWith('background')).map((d) => d.value)
}

/** The element a selector styles: its last compound selector. */
function subject(selector: string): string {
  return (
    selector
      .split(/\s+|>|\+|~/)
      .filter((s) => s !== '')
      .pop() ?? ''
  )
}

const ROOTS = ['html', 'body', '#app', ':root']

describe('overlay window CSS', () => {
  it('finds the overlay sources', () => {
    expect(Object.keys(SOURCES)).toContain('styles/theme.css')
    expect(Object.keys(SOURCES)).toContain('overlay/OverlayApp.vue')
    expect(Object.keys(SOURCES)).toContain('overlay/WidgetSlot.vue')
  })

  it('keeps the document transparent (html, body, #app)', () => {
    const theme = rulesOf('styles/theme.css', SOURCES['styles/theme.css'] ?? '')
    for (const root of ['html', 'body', '#app']) {
      const own = theme.filter((r) => r.selectors.includes(root))
      expect(own.flatMap(backgrounds), root).toContain('transparent')
    }
    const painted = OVERLAY_RULES.filter((r) => r.selectors.some((s) => ROOTS.includes(s)))
      .flatMap(backgrounds)
      .filter((v) => v !== 'transparent')
    expect(painted).toEqual([])
  })

  it('never paints the overlay root or a panel container', () => {
    const containers = OVERLAY_RULES.filter((r) =>
      r.selectors.some((s) => /\.ov-(overlay|slot)\b/.test(subject(s)))
    )
    expect(containers.length).toBeGreaterThan(0)
    const painted = containers.flatMap((r) =>
      backgrounds(r).map((v) => `${r.file}: ${r.selectors.join(', ')} { background: ${v} }`)
    )
    expect(painted).toEqual([])
  })

  it('isolates every panel and adds no transitions or animations to the containers', () => {
    const slot = rulesOf('overlay/WidgetSlot.vue', SOURCES['overlay/WidgetSlot.vue'] ?? '')
    const base = slot.find((r) => r.selectors.includes('.ov-slot'))
    expect(base?.decls).toContainEqual({ prop: 'contain', value: 'strict' })
    expect(base?.decls).toContainEqual({ prop: 'position', value: 'absolute' })
    const moving = ['overlay/WidgetSlot.vue', 'overlay/OverlayApp.vue']
      .flatMap((f) => rulesOf(f, SOURCES[f] ?? ''))
      .flatMap((r) => r.decls)
      .filter((d) => /^(transition|animation|will-change)/.test(d.prop))
    expect(moving).toEqual([])
  })
})
