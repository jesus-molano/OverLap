/**
 * BrandMark rendered for real: the SFC is compiled here with Vue's own compiler (the test runner
 * has no Vue plugin), its TypeScript stripped, and the component rendered to HTML. The global
 * appearance is a stand-in ref the tests set.
 */
import ts from 'typescript'
import { beforeEach, describe, expect, it } from 'vitest'
import * as vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'
import * as carBrands from '@shared/carBrands'
import type { BrandId } from '@shared/carBrands'
import SOURCE from './BrandMark.vue?raw'
import * as brandDrawingModule from './brandDrawing'
import type { BrandLogoStyle, BrandSurface } from './brandDrawing'
import { BRAND_LOGOS } from './brandLogos'
import { BADGE_ONLY, COLOR_LOGOS } from './brandLogosColor'

const appearance = vue.ref<{ brandLogos: BrandLogoStyle }>({ brandLogos: 'color' })

const MODULES: Readonly<Record<string, unknown>> = {
  vue,
  '@shared/carBrands': carBrands,
  '../composables/useAppearance': { useAppearance: () => appearance },
  './brandDrawing': brandDrawingModule
}

function compileBrandMark(): vue.Component {
  const { descriptor, errors } = parse(SOURCE, { filename: 'BrandMark.vue' })
  if (errors.length > 0) throw errors[0]
  const script = compileScript(descriptor, { id: 'brand-mark', inlineTemplate: true })
  const js = ts.transpileModule(script.content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: false
    }
  }).outputText
  const exports: { default?: vue.Component } = {}
  const require = (id: string): unknown => {
    if (!(id in MODULES)) throw new Error(`BrandMark imports ${id}`)
    return MODULES[id]
  }
  new Function('exports', 'require', js)(exports, require)
  if (!exports.default) throw new Error('BrandMark has no default export')
  return exports.default
}

const BrandMark = compileBrandMark()

function render(props: {
  brand: BrandId
  text?: boolean
  logos?: BrandLogoStyle
  surface?: BrandSurface
}): Promise<string> {
  return renderToString(vue.createSSRApp(BrandMark, props))
}

/** The fills of the rendered paths, in order. */
function fills(html: string): string[] {
  return [...html.matchAll(/<path d="[^"]*"(?: fill="([^"]*)")?/g)].map((m) => m[1] ?? '')
}

describe('BrandMark', () => {
  beforeEach(() => {
    appearance.value = { brandLogos: 'color' }
  })

  it('draws the colour logo by default, named for assistive tech', async () => {
    const html = await render({ brand: 'ferrari' })
    const logo = COLOR_LOGOS.ferrari
    expect(html).toMatch(/^<span class="ov-brand ov-brand--logo" role="img"/)
    expect(html).toContain('aria-label="Ferrari"')
    expect(html).toContain('title="Ferrari"')
    expect(html).toContain(`viewBox="${logo?.viewBox}"`)
    expect(fills(html)).toEqual(logo?.layers.map((l) => l.onDark ?? l.fill))
    expect(fills(html)).toContain('#fff100')
    // The svg itself is decoration: the slot carries the name.
    expect(html).toMatch(/<svg class="ov-brand__logo"[^>]* aria-hidden="true"/)
    expect(html).not.toContain('ov-brand__badge')
  })

  it('lightens dark inks on the glass, and keeps them on a light page', async () => {
    expect(fills(await render({ brand: 'audi' }))).toEqual([COLOR_LOGOS.audi?.layers[0]?.onDark])
    expect(fills(await render({ brand: 'audi', surface: 'light' }))).toEqual(['#000000'])
  })

  it('draws the monochrome Simple Icons path when the appearance says so', async () => {
    appearance.value = { brandLogos: 'mono' }
    const html = await render({ brand: 'porsche' })
    expect(html).toContain(`viewBox="${BRAND_LOGOS.porsche?.viewBox}"`)
    expect(html).toContain(`<path d="${BRAND_LOGOS.porsche?.d}">`)
    expect(fills(html)).toEqual([''])
  })

  it('takes the style from its prop over the appearance', async () => {
    appearance.value = { brandLogos: 'mono' }
    expect(await render({ brand: 'porsche', logos: 'color' })).toContain('fill="#')
    appearance.value = { brandLogos: 'color' }
    expect(await render({ brand: 'porsche', logos: 'mono' })).not.toContain('fill="#')
  })

  it('draws a make Simple Icons lacks in greys for monochrome', async () => {
    const html = await render({ brand: 'mclaren', logos: 'mono' })
    expect(html).toContain('ov-brand--logo')
    for (const f of fills(html)) expect(f).toMatch(/^#([0-9a-f]{2})\1\1$/)
  })

  it('draws the text badge for a badge-only brand, in either style', async () => {
    for (const logos of ['color', 'mono'] as const) {
      const html = await render({ brand: 'ray', logos })
      expect(html).toMatch(/^<span class="ov-brand ov-brand--badge" role="img"/)
      expect(html).toContain('aria-label="Ray"')
      expect(html).toContain('<span class="ov-brand__badge">RAY</span>')
      expect(html).not.toContain('<svg')
    }
  })

  it('draws the badge instead of the logo when asked', async () => {
    const html = await render({ brand: 'bmw', text: true })
    expect(html).toContain('ov-brand--badge')
    expect(html).toContain('<span class="ov-brand__badge">BMW</span>')
    expect(html).not.toContain('<svg')
  })

  it('keeps an empty, hidden slot for an unknown make', async () => {
    const html = await render({ brand: 'unknown' })
    // Nothing inside but Vue's placeholder comment for the v-if.
    expect(html).toMatch(
      /^<span class="ov-brand ov-brand--none" aria-hidden="true"><!--[^>]*--><\/span>$/
    )
  })

  it('names every brand of the table, logo or badge, in both styles', async () => {
    for (const logos of ['color', 'mono'] as const) {
      for (const id of carBrands.BRAND_IDS) {
        const html = await render({ brand: id, logos })
        const name = carBrands.BRANDS[id].name
        expect(html, id).toContain(`aria-label="${name}"`)
        expect(html, id).toContain(BADGE_ONLY[id] ? `>${carBrands.BRANDS[id].badge}<` : '<svg')
      }
    }
  })

  it('sizes the slot by the row: plate height, a fixed width never under a badge', () => {
    const css = /<style>([\s\S]*?)<\/style>/.exec(SOURCE)?.[1] ?? ''
    const slot = /\.ov-brand \{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(slot).toMatch(/height: var\(--ov-plate-h\)/)
    // The same for every row (the slots line up), wide enough for 'AMG' at the minimum text size.
    expect(slot).toMatch(/width: max\(\d*\.?\d+em, calc\(var\(--ov-min-text\) \* \d*\.?\d+\)\)/)
    expect(css).toMatch(/\.ov-brand__logo \{[^}]*fill: currentColor/)
  })
})
