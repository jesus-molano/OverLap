/**
 * The "Personalizar" part of a widget page: the order of a page's editors, and CustomizeSection
 * rendered for real (compiled here with Vue's own compiler, as the test runner has no Vue
 * plugin): on a widget page it moves into the page's place for it, anywhere else it stays put.
 */
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import * as vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { renderToString, type SSRContext } from 'vue/server-renderer'
import { messagesFor, type Language } from '@shared/i18n'
import { elementFields, type OptionSection } from '@shared/settingsSchema'
import * as customize from './customize'
import { LEADING_ZONES, customizeTargetId, customizeZones } from './customize'
import SOURCE from './CustomizeSection.vue?raw'
import WIDGET_PAGE from '../pages/WidgetPage.vue?raw'

describe('customizeZones', () => {
  it('leads with the columns and the info bars, in that order', () => {
    expect(customizeZones('standings')).toEqual([
      'columns',
      'headerBar',
      'subheaderBar',
      'footerBar',
      'classLine'
    ])
    expect(customizeZones('relative')).toEqual(['columns', 'headerBar', 'footerBar'])
    expect(customizeZones('fuel')).toEqual(['headerBar', 'lines'])
  })

  it("keeps the schema's order for every other list", () => {
    expect(customizeZones('battle')).toEqual(['lanes', 'rows', 'parts'])
    expect(customizeZones('delta')).toEqual(['rows', 'top', 'laps'])
    expect(customizeZones('inputs')).toEqual(['sections', 'bars', 'info'])
  })

  it('lists every element list of the section exactly once, and none of another', () => {
    const sections = new Set(elementFields().map(([s]) => s))
    for (const section of sections) {
      const own = elementFields()
        .filter(([s]) => s === section)
        .map(([, f]) => f)
      const zones: readonly string[] = customizeZones(section)
      expect([...zones].sort(), section).toEqual([...own].sort())
      // The leading zones a section has come first, in LEADING_ZONES order.
      const leading = zones.filter((z) => (LEADING_ZONES as readonly string[]).includes(z))
      expect(zones.slice(0, leading.length), section).toEqual(leading)
    }
  })

  it('gives nothing for a section without lists', () => {
    const none: OptionSection[] = ['appearance', 'shortcuts', 'settingsWindow', 'visibility']
    for (const section of none) expect(customizeZones(section)).toEqual([])
  })
})

describe('customizeTargetId', () => {
  it('is a plain #id selector whatever the base', () => {
    expect(customizeTargetId('v-0-3')).toBe('st-customize-v-0-3')
    expect(customizeTargetId('a:b c#d')).toBe('st-customize-abcd')
    expect(customizeTargetId('x')).toMatch(/^[a-z][\w-]*$/)
  })
})

// ---- CustomizeSection rendered -------------------------------------------------------------

function compileSection(lang: Language): vue.Component {
  const { descriptor, errors } = parse(SOURCE, { filename: 'CustomizeSection.vue' })
  if (errors.length > 0) throw errors[0]
  const script = compileScript(descriptor, { id: 'customize-section', inlineTemplate: true })
  const js = ts.transpileModule(script.content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const modules: Readonly<Record<string, unknown>> = {
    vue,
    './customize': customize,
    '../../composables/useI18n': { useI18n: () => vue.computed(() => messagesFor(lang)) }
  }
  const exports: { default?: vue.Component } = {}
  const require = (id: string): unknown => {
    if (!(id in modules)) throw new Error(`CustomizeSection imports ${id}`)
    return modules[id]
  }
  new Function('exports', 'require', js)(exports, require)
  if (!exports.default) throw new Error('no component')
  return exports.default
}

async function render(lang: Language, hosted: boolean): Promise<{ html: string; ctx: SSRContext }> {
  const Section = compileSection(lang)
  let host: customize.CustomizeHost | null = null
  const Page = vue.defineComponent({
    setup() {
      if (hosted) host = customize.provideCustomizeHost('page')
      return () =>
        vue.h('div', [
          vue.h(Section, null, { default: () => vue.h('p', { class: 'editor' }, 'COLUMNAS') }),
          hosted ? vue.h('div', { id: customizeTargetId('page') }) : null
        ])
    }
  })
  const ctx: SSRContext = {}
  const html = await renderToString(vue.createSSRApp(Page), ctx)
  if (hosted) expect(host).not.toBeNull()
  return { html, ctx }
}

describe('CustomizeSection', () => {
  it("moves the editors into the widget page's place for them", async () => {
    const { html, ctx } = await render('es', true)
    expect(html).not.toContain('COLUMNAS')
    const moved = ctx.teleports?.[`#${customizeTargetId('page')}`] ?? ''
    expect(moved).toContain('COLUMNAS')
    expect(moved).toContain('Personalizar')
    expect(moved).toContain('Orden y visibilidad de cada parte')
  })

  it('stays where it is outside a widget page, titled in the language', async () => {
    const { html } = await render('en', false)
    expect(html).toContain('COLUMNAS')
    expect(html).toContain('Customise')
    // A titled region: the heading names the section.
    const id = /<h2 id="([^"]+)"/.exec(html)?.[1]
    expect(id).toBeDefined()
    expect(html).toContain(`aria-labelledby="${id}"`)
  })

  it('is placed by WidgetPage after the window and content options, before the resets', () => {
    const template = /<template>([\s\S]*)<\/template>/.exec(WIDGET_PAGE)?.[1] ?? ''
    const opts = template.indexOf('<component :is="options"')
    const target = template.indexOf(':id="customize.targetId"')
    expect(template.indexOf('<WindowSection')).toBeLessThan(opts)
    expect(opts).toBeGreaterThan(-1)
    expect(target).toBeGreaterThan(opts)
    expect(target).toBeLessThan(template.indexOf('class="page-foot"'))
    expect(WIDGET_PAGE).toMatch(/provideCustomizeHost\(/)
  })
})
