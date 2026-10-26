/**
 * BrandMark rendered for real: the SFC is compiled here with Vue's own compiler (the test runner
 * has no Vue plugin), its TypeScript stripped, and the component rendered to HTML.
 */
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import * as vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'
import * as carBrands from '@shared/carBrands'
import type { BrandId } from '@shared/carBrands'
import SOURCE from './BrandMark.vue?raw'
import * as brandLogos from './brandLogos'
import { BRAND_LOGOS } from './brandLogos'

const MODULES: Readonly<Record<string, unknown>> = {
  vue,
  '@shared/carBrands': carBrands,
  './brandLogos': brandLogos
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

function render(props: { brand: BrandId; text?: boolean }): Promise<string> {
  return renderToString(vue.createSSRApp(BrandMark, props))
}

describe('BrandMark', () => {
  it('draws a logo in currentColor, named for assistive tech', async () => {
    const html = await render({ brand: 'porsche' })
    expect(html).toMatch(/^<span class="ov-brand ov-brand--logo" role="img"/)
    expect(html).toContain('aria-label="Porsche"')
    expect(html).toContain('title="Porsche"')
    expect(html).toContain(`viewBox="${BRAND_LOGOS.porsche?.viewBox}"`)
    expect(html).toContain(`<path d="${BRAND_LOGOS.porsche?.d}">`)
    // The svg itself is decoration: the slot carries the name.
    expect(html).toMatch(/<svg class="ov-brand__logo"[^>]* aria-hidden="true"/)
    expect(html).not.toContain('ov-brand__badge')
  })

  it('draws the text badge for a brand without a logo', async () => {
    const html = await render({ brand: 'dallara' })
    expect(html).toMatch(/^<span class="ov-brand ov-brand--badge" role="img"/)
    expect(html).toContain('aria-label="Dallara"')
    expect(html).toContain('<span class="ov-brand__badge">DAL</span>')
    expect(html).not.toContain('<svg')
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

  it('names every brand of the table, logo or badge', async () => {
    for (const id of carBrands.BRAND_IDS) {
      const html = await render({ brand: id })
      const name = carBrands.BRANDS[id].name
      expect(html, id).toContain(`aria-label="${name}"`)
      expect(html, id).toContain(BRAND_LOGOS[id] ? '<svg' : `>${carBrands.BRANDS[id].badge}<`)
    }
  })

  it('sizes the slot by the row: plate height, fixed width', () => {
    const css = /<style>([\s\S]*?)<\/style>/.exec(SOURCE)?.[1] ?? ''
    const slot = /\.ov-brand \{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(slot).toMatch(/height: var\(--ov-plate-h\)/)
    expect(slot).toMatch(/width: \d*\.?\d+em/)
    expect(css).toMatch(/\.ov-brand__logo \{[^}]*fill: currentColor/)
  })
})
