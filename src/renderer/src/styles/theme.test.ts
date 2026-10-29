/**
 * Contract and legibility of the design tokens (theme.css): every token the widgets are written
 * against exists (and every token it declares is used), the colour-blind palette covers
 * everything that carries meaning, the radar ramp warms from grey to the alert colour without
 * passing through yellow, and the text tiers keep their contrast on the glass over a bright sky
 * and over dark asphalt.
 */
import { describe, expect, it } from 'vitest'
import { relativeLuminance } from '@shared/colors'
import THEME from './theme.css?raw'

/** Every renderer source but the tests: components, stylesheets and the TS that sets tokens. */
const SOURCES = import.meta.glob(['../**/*.vue', '../**/*.css', '../**/*.ts', '!../**/*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

/** Code without its comments, which may name tokens freely. */
const uncommented = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const CODE = Object.values(SOURCES).map(uncommented).join('\n')

/** Declarations of every rule, by selector (whitespace collapsed); later rules win. */
function rulesOf(css: string): Map<string, Map<string, string>> {
  const rules = new Map<string, Map<string, string>>()
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = (m[1] ?? '').replace(/\s+/g, ' ').trim()
    const decls = rules.get(selector) ?? new Map<string, string>()
    for (const d of (m[2] ?? '').matchAll(/([-\w]+)\s*:\s*([^;]+)/g)) {
      decls.set((d[1] ?? '').trim(), (d[2] ?? '').replace(/\s+/g, ' ').trim())
    }
    rules.set(selector, decls)
  }
  return rules
}

const RULES = rulesOf(THEME)
const rule = (selector: string): Map<string, string> => RULES.get(selector) ?? new Map()
const ROOT = rule(':root')
const CVD = rule(":root[data-cvd='on']")
const SURFACE = rule(':root, .ov-surface')

const PROX = Array.from({ length: 12 }, (_, i) => `--ov-prox-${i}`)

/** Tokens other components are written against (spec §2.1). */
const ROOT_TOKENS = [
  '--ov-accent',
  '--ov-accent-fg',
  '--ov-good',
  '--ov-bad',
  '--ov-danger',
  '--ov-best',
  '--ov-best-fill',
  '--ov-warn',
  '--ov-info',
  '--ov-alert',
  '--ov-lap-ahead',
  '--ov-lap-behind',
  '--ov-on-solid',
  '--ov-o-dim',
  '--ov-o-soft',
  '--ov-throttle',
  '--ov-brake',
  '--ov-clutch',
  '--ov-abs',
  '--ov-flag-black',
  '--ov-flag-white',
  '--ov-flag-yellow',
  '--ov-flag-red',
  '--ov-flag-blue',
  '--ov-flag-green',
  '--ov-flag-orange',
  ...PROX,
  '--ov-fg',
  '--ov-fg-muted',
  '--ov-fg-dim',
  '--ov-font',
  '--ov-font-small',
  '--ov-font-num',
  '--ov-font-hero',
  '--ov-min-text',
  '--ov-w-text',
  '--ov-w-name',
  '--ov-w-you',
  '--ov-w-strong',
  '--ov-w-solid',
  '--ov-track-caps',
  '--ov-track-tag',
  '--ov-track-hero',
  '--ov-t-hero',
  '--ov-t-display',
  '--ov-t-lead',
  '--ov-t-body',
  '--ov-t-secondary',
  '--ov-t-plate',
  '--ov-t-caption',
  '--ov-t-chip',
  '--ov-t-tag',
  '--ov-t-unit-hero',
  '--ov-t-unit',
  '--ov-radius',
  '--ov-radius-inner',
  '--ov-radius-chip',
  '--ov-bar-w',
  '--ov-key-w',
  '--ov-row-h',
  '--ov-fade-in',
  '--ov-fade-out',
  '--ov-bg-alpha',
  '--ov-text-halo',
  '--ov-edit',
  '--ov-edit-line',
  '--ov-edit-backdrop',
  '--ov-locked'
]

/** Scaled by each widget's opacity, so declared on :root and on every .ov-surface. */
const SURFACE_TOKENS = [
  '--ov-bg',
  '--ov-bg-head',
  '--ov-bg-row',
  '--ov-bg-row-alt',
  '--ov-row-rule',
  '--ov-lift',
  '--ov-well',
  '--ov-edge-out',
  '--ov-edge-in',
  '--ov-edge-top',
  '--ov-rule',
  '--ov-sep',
  '--ov-chip-faint',
  '--ov-tick',
  '--ov-tick-major'
]

const HEX = /^#[0-9a-f]{6}$/i

function rgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

function hexOf(c: readonly number[]): string {
  return '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}

/** A token's '#rrggbb' value in `decls`, resolving one level of var(). */
function color(decls: Map<string, string>, name: string): string {
  const v = decls.get(name) ?? ROOT.get(name) ?? ''
  const ref = /^var\((--[\w-]+)\)$/.exec(v)
  const out = ref ? (decls.get(ref[1] ?? '') ?? ROOT.get(ref[1] ?? '') ?? '') : v
  if (!HEX.test(out)) throw new Error(`${name} is not a hex colour: ${v}`)
  return out
}

const lum = (hex: string): number => relativeLuminance(hex) ?? Number.NaN
const contrast = (a: string, b: string): number => {
  const [x, y] = [lum(a), lum(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** The panel glass (--ov-bg at the default --ov-bg-alpha) composited over a backdrop. */
function glassOver(backdrop: string): string {
  const m = /rgba\((\d+),\s*(\d+),\s*(\d+),/.exec(SURFACE.get('--ov-bg') ?? '')
  const a = Number(ROOT.get('--ov-bg-alpha'))
  if (!m || !(a > 0)) throw new Error('unexpected --ov-bg / --ov-bg-alpha')
  const glass = [Number(m[1]), Number(m[2]), Number(m[3])]
  const back = rgb(backdrop)
  return hexOf(glass.map((g, i) => g * a + (back[i] ?? 0) * (1 - a)))
}

const SKY = glassOver('#ffffff')
const ASPHALT = glassOver('#2a2f37')

/** `base` under a surface token's faint white layer (header band, stripe) at the default alpha. */
function liftedBy(base: string, token: string): string {
  const v = SURFACE.get(token) ?? ''
  const m = /^rgba\(255, 255, 255, calc\((\d*\.?\d+) \* var\(--ov-bg-alpha\)\)\)$/.exec(v)
  const a = Number(ROOT.get('--ov-bg-alpha'))
  if (!m || !(a > 0)) throw new Error(`unexpected ${token}: ${v}`)
  const w = Number(m[1]) * a
  return hexOf(rgb(base).map((c) => c + (255 - c) * w))
}

/** The lightest places text sits on over the sky: the header band and the alternate stripes. */
const BAND = liftedBy(SKY, '--ov-bg-head')
const STRIPE = liftedBy(SKY, '--ov-bg-row-alt')

function hue(hex: string): { h: number; s: number } {
  const [r, g, b] = rgb(hex).map((v) => v / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6)
    else if (max === g) h = 60 * ((b - r) / d + 2)
    else h = 60 * ((r - g) / d + 4)
  }
  return { h: (h + 360) % 360, s }
}

describe('theme tokens', () => {
  it('declares every token the widgets are written against', () => {
    expect(ROOT_TOKENS.filter((t) => !ROOT.has(t))).toEqual([])
    expect(SURFACE_TOKENS.filter((t) => !SURFACE.has(t))).toEqual([])
  })

  it('declares every --ov- token the renderer reads, and nothing it does not', () => {
    const read = new Set([...CODE.matchAll(/var\(\s*(--ov-[\w-]+)/g)].map((m) => m[1]))
    // Declared in CSS, as an @property, or set from code ('--ov-accent': …).
    const declared = new Set(
      [
        ...CODE.matchAll(/(--ov-[\w-]+)\s*:|@property\s+(--ov-[\w-]+)|['"`](--ov-[\w-]+)['"`]/g)
      ].map((m) => m[1] ?? m[2] ?? m[3])
    )
    expect([...read].filter((t) => !declared.has(t)).sort()).toEqual([])
    const theme = new Set([...uncommented(THEME).matchAll(/(--ov-[\w-]+)\s*:/g)].map((m) => m[1]))
    expect([...theme].filter((t) => !read.has(t)).sort()).toEqual([])
  })

  it('never washes anything in the accent (it reads olive on the glass)', () => {
    expect(CODE).not.toMatch(/color-mix\([^;{}]*--ov-accent/)
  })

  it('drops the retired chrome', () => {
    expect(THEME).not.toMatch(/--ov-sheen|--ov-hairline|ov-panel--flat|data-ab-|data-look/)
    // No index notch on the panel's top edge.
    expect(RULES.has('.ov-panel::after')).toBe(false)
  })

  it('resolves the plate height once per panel', () => {
    const prop = rule('@property --ov-plate-h')
    expect(prop.get('syntax')).toBe("'<length>'")
    expect(prop.get('inherits')).toBe('true')
    // In em of the panel's font, floored a few px above the 9 px text floor.
    expect(rule('.ov-panel').get('--ov-plate-h')).toMatch(
      /^max\(\d*\.?\d+em, calc\(var\(--ov-min-text\) \+ \d+px\)\)$/
    )
  })

  it('switches every meaning colour in the colour-blind palette', () => {
    const needed = ['--ov-good', '--ov-bad', '--ov-warn', '--ov-alert', '--ov-lap-behind', ...PROX]
    expect(needed.filter((t) => !CVD.has(t))).toEqual([])
    // Distinguishable pairs: lapped vs gaining, warn vs bad.
    expect(color(CVD, '--ov-lap-behind')).not.toBe(color(CVD, '--ov-good'))
    expect(color(CVD, '--ov-warn')).not.toBe(color(CVD, '--ov-bad'))
    expect(color(ROOT, '--ov-warn')).not.toBe(color(ROOT, '--ov-bad'))
  })

  it('draws you as a bracket of light, with no accent fill', () => {
    const before = rule('.ov-player::before')
    const layers = before.get('background') ?? ''
    expect(layers).toMatch(/var\(--ov-lift\)$/)
    // The accent only in the two 1 px hairlines.
    expect(layers.match(/var\(--ov-accent\)/g)).toHaveLength(2)
    expect(layers.match(/100% 1px no-repeat/g)).toHaveLength(2)
    expect(before.has('opacity')).toBe(false)
    // No rail on the left edge (B13).
    expect(RULES.has('.ov-player::after')).toBe(false)
  })

  it('shows a state as a tint of its panel or band, never as a left rail (B13)', () => {
    const tint = rule('.ov-state::before').get('background') ?? ''
    // The lit top edge across the width, and a wash down: no narrow left-edge layer.
    expect(tint).toMatch(/left top \/ 100% var\(--ov-key-w\) no-repeat/)
    expect(tint).toMatch(/linear-gradient\(180deg, color-mix\(in srgb, var\(--ov-state\)/)
    expect(rule('.ov-state').get('--ov-state')).toBe('transparent')
    // No component paints a coloured strip of the rail's width on a left edge any more, except
    // the warning lights' info tile (a tile's own shape, theme "key" and "ring" siblings).
    const rails = Object.entries(SOURCES).filter(
      ([file, src]) =>
        !file.includes('LightTile') &&
        /inset:\s*0 auto 0 0;[^}]*width:\s*var\(--ov-bar-w\)/.test(uncommented(src))
    )
    expect(rails.map(([file]) => file)).toEqual([])
  })

  it('lights the glass and the header band with static gradients only', () => {
    expect(rule('.ov-panel').get('background')).toBe('var(--ov-glass-grad), var(--ov-bg)')
    for (const t of ['--ov-glass-grad', '--ov-head-grad']) {
      expect(SURFACE.get(t), t).toMatch(/^linear-gradient\( ?180deg, rgba\(255, 255, 255, calc\(/)
    }
  })
})

describe('radar proximity ramp', () => {
  for (const [name, decls] of [
    ['default', ROOT],
    ['colour-blind', CVD]
  ] as const) {
    it(`${name}: warms steadily from a neutral grey to the alert colour`, () => {
      const ramp = PROX.map((t) => rgb(color(decls, t)))
      expect(hue(color(decls, '--ov-prox-0')).s).toBeLessThan(0.15)
      expect(color(decls, '--ov-prox-11')).toBe(color(decls, '--ov-alert'))
      for (let i = 1; i < ramp.length; i++) {
        const [r0, , b0] = ramp[i - 1] ?? [0, 0, 0]
        const [r1, , b1] = ramp[i] ?? [0, 0, 0]
        expect(r1).toBeGreaterThan(r0)
        expect(b1).toBeLessThan(b0)
      }
    })
  }

  it('default: never passes through yellow (or green)', () => {
    for (const t of PROX) {
      const { h, s } = hue(color(ROOT, t))
      if (s > 0.1) expect(h < 20 || h > 180).toBe(true)
    }
  })
})

describe('legibility on the glass (default opacity)', () => {
  it('composites like the spec: sky #414346, asphalt #13151a', () => {
    expect(SKY).toBe('#414346')
    expect(ASPHALT).toBe('#13151a')
  })

  /** Minimum contrast over the sky and over asphalt (spec §7.3, rounded down). */
  const FLOORS: ReadonlyArray<readonly [string, number, number]> = [
    ['--ov-fg', 9, 16],
    ['--ov-fg-muted', 4.5, 8.5],
    ['--ov-fg-dim', 3.3, 6],
    ['--ov-warn', 4.5, 8.5],
    ['--ov-good', 5, 10],
    ['--ov-bad', 3.5, 6.5],
    ['--ov-info', 4, 7.5],
    ['--ov-best', 3.4, 6]
  ]

  for (const [token, sky, asphalt] of FLOORS) {
    it(`${token} reads over a bright sky and over dark asphalt`, () => {
      expect(contrast(color(ROOT, token), SKY)).toBeGreaterThanOrEqual(sky)
      expect(contrast(color(ROOT, token), ASPHALT)).toBeGreaterThanOrEqual(asphalt)
    })
  }

  it('keeps every text tier at 3:1 on the header band and the stripes over the sky', () => {
    expect(BAND).not.toBe(SKY)
    for (const [token] of FLOORS) {
      expect(contrast(color(ROOT, token), BAND), token).toBeGreaterThanOrEqual(3)
      expect(contrast(color(ROOT, token), STRIPE), token).toBeGreaterThanOrEqual(3)
    }
  })

  it('keeps the colour-blind meaning colours above 3:1 over the sky', () => {
    for (const t of ['--ov-good', '--ov-bad', '--ov-warn', '--ov-lap-behind']) {
      expect(contrast(color(CVD, t), SKY)).toBeGreaterThanOrEqual(3)
    }
  })

  it('puts white text on the fastest-lap plate at 4.5:1 or more', () => {
    expect(contrast('#ffffff', color(ROOT, '--ov-best-fill'))).toBeGreaterThanOrEqual(4.5)
  })
})
