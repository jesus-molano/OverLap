/**
 * R55: the settings window's own visual system. Six type sizes (settings.css --st-t-*), spacing
 * on the 4 px scale (4, 8, 12, 16, 24, 32; 1 to 3 px for hairlines; past 32, multiples of 8), and
 * every symbol an icon of the one set (ui/icons.ts), never a text character beside the icons.
 */
import { describe, expect, it } from 'vitest'
import SETTINGS_CSS from './settings.css?raw'

const SOURCES = import.meta.glob(['./**/*.vue', './*.css'], {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

/** The CSS of a file: a stylesheet, or a component's style blocks. */
const cssOf = (path: string, src: string): string =>
  path.endsWith('.css')
    ? src
    : [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')

/** A component's template without its comments. */
const templateOf = (src: string): string =>
  (/<template>([\s\S]*)<\/template>/.exec(src)?.[1] ?? '').replace(/<!--[\s\S]*?-->/g, '')

const withoutComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '')

const TOKENS = ['caption', 'help', 'ui', 'body', 'title', 'page'] as const

describe('settings visual system (R55)', () => {
  it('defines six type sizes', () => {
    for (const t of TOKENS) expect(SETTINGS_CSS).toMatch(new RegExp(`--st-t-${t}: \\d+px;`))
  })

  it('sets every font size with one of them (or relative to its parent)', () => {
    const bad: string[] = []
    for (const [path, src] of Object.entries(SOURCES)) {
      const css = withoutComments(cssOf(path, src))
      for (const m of css.matchAll(/font-size:\s*([^;}\n]+)/g)) {
        const v = (m[1] ?? '').trim()
        const ok =
          new RegExp(`^var\\(--st-t-(${TOKENS.join('|')})\\)$`).test(v) ||
          /^[\d.]+(em|%)$/.test(v) ||
          v === 'inherit'
        if (!ok) bad.push(`${path}: ${v}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('spaces on the 4 px scale', () => {
    const bad: string[] = []
    const allowed = (n: number): boolean =>
      n <= 3 || [4, 8, 12, 16, 24, 32].includes(n) || (n > 32 && n % 8 === 0)
    for (const [path, src] of Object.entries(SOURCES)) {
      const css = withoutComments(cssOf(path, src))
      const decls = css.matchAll(
        /(?:^|[;{\s])((?:margin|padding)(?:-[a-z-]+)?|gap|row-gap|column-gap):\s*([^;{}]+)/g
      )
      for (const m of decls) {
        for (const px of (m[2] ?? '').matchAll(/(\d+(?:\.\d+)?)px/g)) {
          if (!allowed(Number(px[1]))) bad.push(`${path}: ${m[1]}: ${m[2]?.trim()}`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('draws every symbol as an icon, none as a text character', () => {
    const bad: string[] = []
    for (const [path, src] of Object.entries(SOURCES)) {
      if (!path.endsWith('.vue')) continue
      const tpl = templateOf(src)
      for (const m of tpl.matchAll(/[↑↓←→⠿ⓘ×▲▼◉−✕]/g)) bad.push(`${path}: ${m[0]}`)
    }
    expect(bad).toEqual([])
  })

  it('stays dark: no light theme of its own', () => {
    expect(SETTINGS_CSS).toContain('color-scheme: dark;')
    expect(SETTINGS_CSS).not.toMatch(/prefers-color-scheme:\s*light/)
  })
})
