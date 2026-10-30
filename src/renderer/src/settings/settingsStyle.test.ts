/**
 * R55: the settings window's own visual system. Six type sizes (settings.css --st-t-*), spacing
 * on the 4 px scale (4, 8, 12, 16, 24, 32; 1 to 3 px for hairlines; past 32, multiples of 8), and
 * every symbol an icon of the one set (ui/icons.ts), never a text character beside the icons.
 */
import { describe, expect, it } from 'vitest'
import SETTINGS_CSS from './settings.css?raw'
import SETTINGS_MESSAGES from '@shared/i18n/messages/settings.ts?raw'

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

/** The symbols an icon draws (ui/icons.ts), never typed as text in Ajustes. */
const SYMBOLS = /[↑↓←→⠿ⓘ×▲▼◉−✕⚙▸]/g

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
      for (const m of tpl.matchAll(SYMBOLS)) bad.push(`${path}: ${m[0]}`)
    }
    expect(bad).toEqual([])
  })

  it('types none of them in its texts either (both languages), only in comments', () => {
    const code = SETTINGS_MESSAGES.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const bad = code.split('\n').filter((line) => line.match(SYMBOLS) !== null)
    expect(bad).toEqual([])
  })

  it('opens a fold with the same chevron icon, never the native marker', () => {
    for (const [path, src] of Object.entries(SOURCES)) {
      if (!path.endsWith('.vue')) continue
      for (const m of templateOf(src).matchAll(/<summary>([\s\S]*?)<\/summary>/g)) {
        expect(m[1], path).toMatch(/<Icon name="chevron"/)
        expect(src, path).toMatch(/summary::-webkit-details-marker \{\s*display: none;/)
      }
    }
  })

  it('stays dark: no light theme of its own', () => {
    expect(SETTINGS_CSS).toContain('color-scheme: dark;')
    expect(SETTINGS_CSS).not.toMatch(/prefers-color-scheme:\s*light/)
  })
})

describe('a row that cannot be changed now (A11)', () => {
  it('dims its name and its control, never the help that says why', () => {
    const css = withoutComments(SETTINGS_CSS)
    const dimmed = [...css.matchAll(/([^{}]+)\{[^}]*opacity:\s*0\.45/g)].map((m) => m[1] ?? '')
    const selectors = dimmed.join(',')
    expect(selectors).toContain('.st-disabled')
    // Every selector that dims a disabled row's text leaves its .st-help out.
    for (const sel of selectors.split(',').map((s) => s.trim())) {
      if (!sel.includes('disabled')) continue
      expect(sel, sel).not.toMatch(/\.st-help\s*$/)
      if (/\.st-row-(text|head)\.st-disabled/.test(sel)) expect(sel).toContain(':not(.st-help)')
    }
  })
})
