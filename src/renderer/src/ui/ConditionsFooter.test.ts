/**
 * ConditionsFooter rendered for real: the SFC is compiled here with Vue's own compiler (the test
 * runner has no Vue plugin), its TypeScript stripped, and rendered to HTML with stand-ins for
 * Badge and Icon (their own tests are theirs).
 */
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import * as vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'
import { messagesFor } from '@shared/i18n'
import type { ConditionsData, ConditionsFooterOptions } from '@shared/types'
import * as inlineStyle from '../directives/inlineStyle'
import * as conditions from '../view/conditions'
import { FOOTER_EM, PREVIEW_CONDITIONS, footerView, type FooterView } from '../view/conditions'
import SOURCE from './ConditionsFooter.vue?raw'

const Badge = vue.defineComponent({
  setup(_, { slots }) {
    return () => vue.h('span', { class: 'badge' }, slots.default?.())
  }
})
const Icon = vue.defineComponent({
  props: { name: { type: String, required: true } },
  setup(props) {
    return () => vue.h('i', { 'data-icon': props.name })
  }
})

const MODULES: Readonly<Record<string, unknown>> = {
  vue,
  '../directives/inlineStyle': inlineStyle,
  '../view/conditions': conditions,
  './Badge.vue': { default: Badge },
  './Icon.vue': { default: Icon }
}

function compileFooter(): vue.Component {
  const { descriptor, errors } = parse(SOURCE, { filename: 'ConditionsFooter.vue' })
  if (errors.length > 0) throw errors[0]
  const script = compileScript(descriptor, { id: 'conditions-footer', inlineTemplate: true })
  const js = ts.transpileModule(script.content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: false
    }
  }).outputText
  const exports: { default?: vue.Component } = {}
  const require = (id: string): unknown => {
    if (!(id in MODULES)) throw new Error(`ConditionsFooter imports ${id}`)
    return MODULES[id]
  }
  new Function('exports', 'require', js)(exports, require)
  if (!exports.default) throw new Error('ConditionsFooter has no default export')
  return exports.default
}

const Footer = compileFooter()
const ES = messagesFor('es')

const ON: ConditionsFooterOptions = {
  conditionsFooter: true,
  conditionsTrackTemp: true,
  conditionsTrend: true,
  conditionsWet: true,
  conditionsWind: true,
  conditionsWindDirection: true,
  conditionsAirTemp: true,
  conditionsRubber: true
}

function viewOf(
  d: Partial<ConditionsData> = {},
  o: Partial<ConditionsFooterOptions> = {}
): FooterView {
  return footerView({ ...PREVIEW_CONDITIONS, ...d }, { ...ON, ...o }, 'metric', ES)
}

function render(view: FooterView): Promise<string> {
  return renderToString(vue.createSSRApp(Footer, { view }))
}

/** The visible text, whitespace collapsed. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('ConditionsFooter', () => {
  it('draws the readings in the line order, the wet ones after the track temperature', async () => {
    const html = await render(
      viewOf({ wetness: 4, precipPct: 40, declaredWet: true, trackTempTrend: 'up' })
    )
    expect(text(html)).toBe(
      'Pista 24 °C DECLARADA MOJADA Agua Poco mojado Lluvia 40 % 14 km/h Aire 17 °C Goma Moderada'
    )
    expect(html).toContain('data-icon="arrow-up"')
    expect(html.match(/cf-meter__cell/g)).toHaveLength(6)
    expect(html.match(/cf-meter__cell is-on/g)).toHaveLength(3)
  })

  it('leaves the water out on a dry track', async () => {
    const html = await render(viewOf({ wetness: 1, precipPct: 0, declaredWet: false }))
    expect(text(html)).toBe('Pista 24 °C 14 km/h Aire 17 °C Goma Moderada')
    expect(html).not.toContain('cf-meter')
    expect(html).not.toContain('badge')
  })

  it('draws the dial with its arrow, or the caption without a direction', async () => {
    const withDial = await render(viewOf())
    expect(withDial).toContain('class="cf-dial"')
    expect(withDial).toContain('cf-dial__arrow')
    expect(text(withDial)).not.toContain('Viento')
    // Calm, out of the car (the session screen) or the direction off: no empty ring, the caption.
    for (const v of [
      viewOf({ windKmh: 1 }),
      viewOf({ windFromDeg: null }),
      viewOf({}, { conditionsWindDirection: false })
    ]) {
      const caption = await render(v)
      expect(caption).not.toContain('cf-dial')
      expect(text(caption)).toContain('Viento')
    }
    expect(text(await render(viewOf({ windFromDeg: null })))).toContain('Viento 14 km/h')
  })

  it('keeps a caption for the wetness meter where a narrow table drops its word', async () => {
    const html = await render(viewOf({ wetness: 4 }))
    expect(html).toContain('cf-label cf-wet-label')
    expect(text(html)).toContain('Agua Poco mojado')
    // Hidden while the word is there; the narrow rule swaps the word for it.
    expect(SOURCE).toMatch(/\.cf-wet-label \{\s*display: none;/)
    expect(SOURCE).toMatch(
      /@container cfoot \(max-width: 26em\) \{\s*\.cf-wet-word \{\s*display: none;\s*\}\s*\.cf-wet-label \{\s*display: inline;/
    )
  })

  it('draws nothing but its band for an empty view', async () => {
    const html = await render(conditions.NO_FOOTER)
    expect(text(html)).toBe('')
    expect(html).toContain('ov-cfoot')
  })

  it('is FOOTER_EM high, the height the tables count', () => {
    expect(FOOTER_EM).toBe(1.6)
    expect(SOURCE).toContain('height: calc(var(--cf-h) + var(--cf-rule))')
    expect(SOURCE).toContain('flex-wrap: wrap')
    expect(SOURCE).toContain('contain: strict')
  })
})
