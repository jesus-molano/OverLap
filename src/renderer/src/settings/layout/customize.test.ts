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
import { NO_BAR_SECTIONS } from '@shared/infoBar'
import {
  CUSTOMIZE_FIRST_ZONES,
  CUSTOMIZE_ZONE_IDS,
  OPTION_SCHEMA,
  elementFields,
  isLayoutSection,
  type OptionSection
} from '@shared/settingsSchema'
import { WIDGET_IDS } from '@shared/widgets'
import * as customize from './customize'
import { LEADING_ZONES, customizeAppendixId, customizeTargetId, customizeZones } from './customize'
import * as zonesOpen from './zonesOpen'
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
    expect(customizeZones('fuel')).toEqual(['headerBar', 'footerBar', 'lines'])
    expect(customizeZones('traffic')).toEqual(['headerBar', 'footerBar', 'groups', 'parts'])
    expect(customizeZones('battle')).toEqual(['headerBar', 'footerBar', 'lanes', 'rows', 'parts'])
  })

  it("keeps the schema's order for every other list", () => {
    expect(customizeZones('delta')).toEqual(['rows', 'top', 'laps'])
    expect(customizeZones('inputs')).toEqual(['sections', 'bars', 'info', 'car'])
  })

  it('lists every element list of the section exactly once, and none of another', () => {
    const sections = new Set(elementFields().map(([s]) => s))
    for (const section of sections) {
      if (!isLayoutSection(section)) continue
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
    const none: OptionSection[] = ['appearance', 'shortcuts', 'visibility', 'layouts']
    for (const section of none) expect(customizeZones(section)).toEqual([])
  })

  it("gives nothing for the settings window's own list (the accordions' state is no zone)", () => {
    expect(elementFields().some(([s, f]) => s === 'settingsWindow' && f === 'customizeOpen')).toBe(
      true
    )
    expect(customizeZones('settingsWindow')).toEqual([])
  })
})

describe('the accordions of "Personalizar"', () => {
  it("are every widget page's zones, page by page in its editors' order", () => {
    const zones = WIDGET_IDS.flatMap((id) => customizeZones(id).map((f) => `${id}.${f}`))
    expect([...CUSTOMIZE_ZONE_IDS].sort()).toEqual([...zones].sort())
    for (const id of WIDGET_IDS) {
      const own = CUSTOMIZE_ZONE_IDS.filter((z) => z.startsWith(`${id}.`))
      expect(own, id).toEqual(customizeZones(id).map((f) => `${id}.${f}`))
    }
  })

  it('open on the first zone of each page only', () => {
    const firsts = WIDGET_IDS.filter((id) => customizeZones(id).length > 0).map(
      (id) => `${id}.${customizeZones(id)[0]}`
    )
    expect([...CUSTOMIZE_FIRST_ZONES].sort()).toEqual(firsts.sort())
    const open = OPTION_SCHEMA.settingsWindow.customizeOpen.default.filter((e) => e.visible)
    expect(open.map((e) => e.id)).toEqual(CUSTOMIZE_FIRST_ZONES)
  })

  it("find an editor's zone by its spec, none for a list no page has", () => {
    expect(zonesOpen.zoneOfSpec(OPTION_SCHEMA.standings.footerBar)).toBe('standings.footerBar')
    expect(zonesOpen.zoneOfSpec(OPTION_SCHEMA.relative.footerBar)).toBe('relative.footerBar')
    expect(zonesOpen.zoneOfSpec(OPTION_SCHEMA.traffic.headerBar)).toBe('traffic.headerBar')
    expect(zonesOpen.zoneOfSpec(OPTION_SCHEMA.settingsWindow.customizeOpen)).toBeNull()
    expect(zonesOpen.zoneOfSpec({})).toBeNull()
  })

  it('open or close several at once, leaving the others as they were', () => {
    const list = OPTION_SCHEMA.settingsWindow.customizeOpen.default
    const next = zonesOpen.withZonesOpen(list, ['fuel.lines', 'relative.columns'], false)
    expect(next.find((e) => e.id === 'relative.columns')?.visible).toBe(false)
    expect(next.find((e) => e.id === 'fuel.lines')?.visible).toBe(false)
    expect(next.find((e) => e.id === 'radar.parts')?.visible).toBe(true)
    expect(next.map((e) => e.id)).toEqual(list.map((e) => e.id))
    const all = zonesOpen.withZonesOpen(list, CUSTOMIZE_ZONE_IDS, true)
    expect(all.every((e) => e.visible)).toBe(true)
    expect(list.filter((e) => e.visible).length).toBe(CUSTOMIZE_FIRST_ZONES.length)
  })
})

describe('customizeTargetId', () => {
  it('is a plain #id selector whatever the base', () => {
    expect(customizeTargetId('v-0-3')).toBe('st-customize-v-0-3')
    expect(customizeTargetId('a:b c#d')).toBe('st-customize-abcd')
    expect(customizeTargetId('x')).toMatch(/^[a-z][\w-]*$/)
    expect(customizeAppendixId('a:b c#d')).toBe('st-appendix-abcd')
  })
})

describe('the widget pages', () => {
  const PAGES = import.meta.glob<string>('../options/*Settings.vue', {
    query: '?raw',
    import: 'default',
    eager: true
  })

  it('put every editor of theirs in "Personalizar", in the order of customizeZones', () => {
    expect(Object.keys(PAGES).length).toBe(10)
    for (const [path, source] of Object.entries(PAGES)) {
      const template = source.slice(source.indexOf('<template>'))
      const open = template.search(/<CustomizeSection[\s>]/)
      const close = template.indexOf('</CustomizeSection>')
      expect(open, path).toBeGreaterThan(0)
      const editors = [...template.matchAll(/<(ElementEditor|InfoBarEditor)\b/g)].map(
        (m) => m.index
      )
      expect(editors.length, path).toBeGreaterThan(0)
      for (const at of editors) {
        expect(at > open && at < close, `${path}: an editor outside Personalizar`).toBe(true)
      }
    }
  })

  it('say on the pages of the widgets without bars that they have none, and only there', () => {
    const PAGE_OF: Readonly<Record<string, string>> = {
      delta: 'Delta',
      inputs: 'Inputs',
      radar: 'Radar',
      lights: 'Lights',
      alerts: 'Alerts'
    }
    const noBars = Object.entries(PAGES)
      .filter(([, source]) => source.includes('<CustomizeSection no-bars>'))
      .map(([path]) => path)
      .sort()
    expect(noBars).toEqual(
      NO_BAR_SECTIONS.map((s) => `../options/${PAGE_OF[s] ?? s}Settings.vue`).sort()
    )
    for (const [path, source] of Object.entries(PAGES)) {
      const bars = source.includes('<InfoBarEditor')
      expect(bars, path).toBe(!noBars.includes(path))
    }
  })

  it('give the zone options to the editor (one look on every page), not a wrapper of their own', () => {
    for (const [path, source] of Object.entries(PAGES)) {
      expect(source, path).not.toMatch(/<template #footer>\s*<div/)
    }
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
    './zonesOpen': zonesOpen,
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
