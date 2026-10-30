/**
 * GPU and legibility budget of the renderer CSS (ux §2.9). The overlay windows are transparent
 * and composited over the game, so anything that forces extra GPU passes or repaints every
 * frame is banned:
 *
 * - `filter` / `backdrop-filter` (and SVG <filter> elements in templates),
 * - box-shadow / text-shadow blurred by more than 2 px (custom properties are expanded),
 * - infinite animations,
 * - overlay windows only: transitions of anything but opacity / transform / visibility,
 *   `will-change` outside the 60 Hz widgets (inputs, radar), and text floors below 9 px.
 *
 * The settings window is an ordinary opaque window: only the first three rules apply there.
 */
import { describe, expect, it } from 'vitest'

const RAW = import.meta.glob(['../**/*.vue', '../**/*.css'], {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

/** Sources by path under src/renderer/src ('ui/Icon.vue', 'widgets/radar/RadarWidget.vue'). */
const SOURCES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(RAW).map(([k, v]) => [k.replace(/^\.\.\//, '').replace(/^\.\//, 'ui/'), v])
)

const WILL_CHANGE_DIRS = ['widgets/inputs/', 'widgets/radar/']
const TRANSITION_OK = new Set(['opacity', 'transform', 'visibility', 'none'])
const MAX_BLUR_PX = 2
const MIN_TEXT_PX = 9
/** Accesibilidad's «Texto mínimo de 10 px» (R15): theme.css raises the floor to this. */
const LARGE_MIN_PX = 10
const EM_PX = 16

interface Decl {
  prop: string
  value: string
}

interface Violation {
  file: string
  rule: string
  text: string
}

/** CSS of a file: the <style> blocks of an SFC, or the whole stylesheet; comments removed. */
function cssOf(file: string, source: string): string {
  const css = file.endsWith('.vue')
    ? [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1] ?? '').join('\n')
    : source
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

function templateOf(source: string): string {
  return /<template>([\s\S]*)<\/template>/.exec(source)?.[1] ?? ''
}

function declarations(css: string): Decl[] {
  const out: Decl[] = []
  for (const m of css.matchAll(/([-\w]+)\s*:\s*([^;{}]+)(?=[;}])/g)) {
    out.push({ prop: (m[1] ?? '').toLowerCase(), value: (m[2] ?? '').trim() })
  }
  return out
}

/** Splits on `sep` outside parentheses. */
function splitTop(value: string, sep: RegExp): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of value) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (depth === 0 && sep.test(ch)) {
      if (cur.trim() !== '') out.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur.trim() !== '') out.push(cur.trim())
  return out
}

const LENGTH_RE = /^-?\d*\.?\d+(px|em|rem)?$/
const MATH_RE = /^(calc|max|min|clamp)\(/

/** Largest length in a token, in px (em and rem at 16 px); null when it is not a length. */
function lengthPx(token: string): number | null {
  if (!LENGTH_RE.test(token) && !MATH_RE.test(token)) return null
  let max = 0
  for (const m of token.matchAll(/(-?\d*\.?\d+)(px|em|rem)?/g)) {
    const n = Math.abs(Number(m[1]))
    max = Math.max(max, m[2] === 'em' || m[2] === 'rem' ? n * EM_PX : n)
  }
  return max
}

/** Replaces var(--x) with each declared value of --x (one variant per value). */
function expandVars(value: string, vars: ReadonlyMap<string, string[]>, depth = 0): string[] {
  const m = /var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)/.exec(value)
  if (m === null || depth > 4) return [value]
  const defs = vars.get(m[1] ?? '') ?? ['']
  return defs.flatMap((d) => expandVars(value.replace(m[0], d), vars, depth + 1))
}

/** Blur radius (px) of the most blurred shadow in a box-shadow / text-shadow value. */
function maxShadowBlurPx(value: string): number {
  let max = 0
  for (const shadow of splitTop(value, /,/)) {
    const lengths = splitTop(shadow, /\s/)
      .map(lengthPx)
      .filter((v): v is number => v !== null)
    max = Math.max(max, lengths[2] ?? 0)
  }
  return max
}

function transitionsOk(prop: string, value: string): boolean {
  const items = splitTop(value, /,/)
  return items.every((item) => {
    const first = (splitTop(item, /\s/)[0] ?? '').toLowerCase()
    // A leading duration means `all`.
    if (prop === 'transition' && /^-?\d*\.?\d+m?s$/.test(first)) return false
    return TRANSITION_OK.has(first)
  })
}

function minTextFloorPx(value: string): number | null {
  let min: number | null = null
  for (const m of value.matchAll(/max\(\s*(\d*\.?\d+)px/g)) {
    const n = Number(m[1])
    min = min === null ? n : Math.min(min, n)
  }
  return min
}

function scan(file: string, source: string, vars: ReadonlyMap<string, string[]>): Violation[] {
  const overlay = !file.startsWith('settings/')
  const out: Violation[] = []
  const bad = (rule: string, text: string): void => void out.push({ file, rule, text })
  for (const { prop, value } of declarations(cssOf(file, source))) {
    const text = `${prop}: ${value}`
    if (prop === 'filter' || prop === '-webkit-filter') bad('filter', text)
    if (prop.endsWith('backdrop-filter')) bad('backdrop-filter', text)
    if (prop === 'box-shadow' || prop === 'text-shadow') {
      const blur = Math.max(...expandVars(value, vars).map(maxShadowBlurPx))
      if (blur > MAX_BLUR_PX) bad('shadow-blur', text)
    }
    if (
      (prop === 'animation' || prop === 'animation-iteration-count') &&
      /\binfinite\b/.test(value)
    ) {
      bad('infinite-animation', text)
    }
    if (!overlay) continue
    if ((prop === 'transition' || prop === 'transition-property') && !transitionsOk(prop, value)) {
      bad('transition', text)
    }
    if (prop === 'will-change' && !WILL_CHANGE_DIRS.some((d) => file.startsWith(d))) {
      bad('will-change', text)
    }
    const floor = prop === 'font-size' || prop === 'font' ? minTextFloorPx(value) : null
    if (floor !== null && floor < MIN_TEXT_PX) {
      bad('text-floor', text)
    }
  }
  if (overlay && file.endsWith('.vue') && /<filter[\s>]|\sfilter="/.test(templateOf(source))) {
    bad('svg-filter', '<filter>')
  }
  return out
}

/** Every custom property declaration of the renderer, by name. */
function customProperties(): Map<string, string[]> {
  const vars = new Map<string, string[]>()
  for (const [file, source] of Object.entries(SOURCES)) {
    for (const { prop, value } of declarations(cssOf(file, source))) {
      if (!prop.startsWith('--')) continue
      const list = vars.get(prop) ?? []
      list.push(value)
      vars.set(prop, list)
    }
  }
  return vars
}

describe('style budget scanner', () => {
  const vars = new Map([['--glow', ['0 0 12px red']]])
  const check = (css: string, file = 'widgets/x/X.vue'): string[] =>
    scan(file, `<template><div /></template><style scoped>${css}</style>`, vars).map((v) => v.rule)

  it('flags filters, blurred shadows and infinite animations', () => {
    expect(check('.a { filter: blur(2px) }')).toEqual(['filter'])
    expect(check('.a { backdrop-filter: blur(4px); }')).toEqual(['backdrop-filter'])
    expect(check('.a { box-shadow: 0 2px 8px rgba(0,0,0,.5) }')).toEqual(['shadow-blur'])
    expect(check('.a { box-shadow: var(--glow) }')).toEqual(['shadow-blur'])
    expect(check('.a { animation: pulse 1s ease infinite }')).toEqual(['infinite-animation'])
  })

  it('allows hairlines, rings, small halos and finite animations', () => {
    expect(check('.a { box-shadow: inset 0 0 0 max(1px, 0.09em) var(--cls) }')).toEqual([])
    expect(check('.a { text-shadow: 0 0 2px #000, 0 0 1px #000 }')).toEqual([])
    expect(check('.a { animation: pulse 1.4s ease-in-out 4 }')).toEqual([])
  })

  it('limits transitions and will-change in overlay windows', () => {
    expect(check('.a { transition: opacity 250ms ease, visibility 0s linear 250ms }')).toEqual([])
    expect(check('.a { transition: background-color 0.12s }')).toEqual(['transition'])
    expect(check('.a { transition: 0.2s }')).toEqual(['transition'])
    expect(check('.a { will-change: transform }')).toEqual(['will-change'])
    expect(check('.a { will-change: transform }', 'widgets/inputs/I.vue')).toEqual([])
    expect(check('.a { transition: color 1s }', 'settings/S.vue')).toEqual([])
  })

  it('flags text floors below 9 px', () => {
    expect(check('.a { font-size: max(7px, 0.6em) }')).toEqual(['text-floor'])
    expect(check('.a { font-size: max(var(--ov-min-text), 0.6em) }')).toEqual([])
  })

  it('flags SVG filters in overlay templates', () => {
    const svg = '<template><svg><filter id="g"><feGaussianBlur /></filter></svg></template>'
    expect(scan('widgets/x/X.vue', svg, vars).map((v) => v.rule)).toEqual(['svg-filter'])
  })
})

describe('renderer CSS', () => {
  it('finds the sources', () => {
    expect(Object.keys(SOURCES)).toContain('styles/theme.css')
    expect(Object.keys(SOURCES)).toContain('ui/WidgetPanel.vue')
  })

  it('stays within the GPU and legibility budget', () => {
    const vars = customProperties()
    const violations = Object.entries(SOURCES).flatMap(([file, source]) => scan(file, source, vars))
    expect(violations).toEqual([])
  })

  it('keeps the text floor at 9 px or more, 10 px with «Texto mínimo de 10 px» (R15)', () => {
    const floor = customProperties().get('--ov-min-text')
    expect(floor).toEqual([`${MIN_TEXT_PX}px`, `${LARGE_MIN_PX}px`])
  })
})
