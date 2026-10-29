/**
 * The accordions of "Personalizar" mounted for real: AccordionSection (aria-expanded, inert, the
 * header's control of its body), CustomizeSection's "Expandir todo / Contraer todo" (only with
 * more than one zone; never disabled, so the focus stays) and ElementEditor joining and leaving
 * its page's registry. The components are compiled here with Vue's own compiler (the test
 * runner has no Vue plugin) and mounted through a minimal renderer (no DOM in the node
 * environment) that keeps each element's attributes; main is a stub that answers at once.
 */
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { messagesFor } from '@shared/i18n'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import type { CustomizeZoneId, ElementEntry, OverlaySettings } from '@shared/types'
import { overlayState } from '../../composables/useOverlay'
import * as listOps from '../elements/listOps'
import * as useOptimistic from '../useOptimistic'
import * as customize from './customize'
import * as zonesOpen from './zonesOpen'
import ACCORDION from './AccordionSection.vue?raw'
import SECTION from './CustomizeSection.vue?raw'
import EDITOR from '../elements/ElementEditor.vue?raw'

type OpenList = ElementEntry<CustomizeZoneId>[]
const sent: OpenList[] = []

vi.mock('../editor', () => ({
  listSetter: () => async (list: OpenList) => {
    sent.push(list)
    await Promise.resolve()
  }
}))

// ---- A renderer without a DOM, keeping attributes ------------------------------------------

interface TestNode {
  tag: string
  text: string
  props: Record<string, unknown>
  children: TestNode[]
  parent: TestNode | null
}

function node(tag: string, text = ''): TestNode {
  return { tag, text, props: {}, children: [], parent: null }
}

function detach(n: TestNode): void {
  const p = n.parent
  if (p === null) return
  p.children.splice(p.children.indexOf(n), 1)
  n.parent = null
}

const renderer = vue.createRenderer<TestNode, TestNode>({
  createElement: (tag) => node(tag),
  createText: (text) => node('#text', text),
  createComment: (text) => node('#comment', text),
  setText: (n, text) => void (n.text = text),
  setElementText: (el, text) => {
    el.children = []
    el.text = text
  },
  insert: (child, parent, anchor) => {
    detach(child)
    const i = anchor ? parent.children.indexOf(anchor) : -1
    if (i >= 0) parent.children.splice(i, 0, child)
    else parent.children.push(child)
    child.parent = parent
  },
  remove: detach,
  parentNode: (n) => n.parent,
  nextSibling: (n) => {
    const p = n.parent
    return p === null ? null : (p.children[p.children.indexOf(n) + 1] ?? null)
  },
  querySelector: () => null,
  patchProp: (el, key, _prev, next) => {
    if (next === null || next === undefined) delete el.props[key]
    else el.props[key] = next
  }
})

function all(n: TestNode, test: (n: TestNode) => boolean): TestNode[] {
  return [...(test(n) ? [n] : []), ...n.children.flatMap((c) => all(c, test))]
}

function textOf(n: TestNode): string {
  return n.tag === '#comment' ? '' : n.text + n.children.map(textOf).join('')
}

const byClass = (cls: string) => (n: TestNode) =>
  typeof n.props.class === 'string' && n.props.class.split(' ').includes(cls)

/** The handler Vue bound for `event` ('onClick'), called as a click would. */
function fire(n: TestNode | undefined, event = 'onClick'): void {
  const f = n?.props[event]
  if (typeof f !== 'function') throw new Error(`no ${event} on ${n?.tag}`)
  ;(f as (e: unknown) => void)({})
}

// ---- The components, compiled ---------------------------------------------------------------

const t = vue.computed(() => messagesFor('es'))
const Stub = vue.defineComponent({
  setup:
    (_p, { slots }) =>
    () =>
      vue.h('div', slots.default?.())
})

function compile(
  source: string,
  filename: string,
  modules: Record<string, unknown>
): vue.Component {
  const { descriptor, errors } = parse(source, { filename })
  if (errors.length > 0) throw errors[0]
  const script = compileScript(descriptor, { id: filename, inlineTemplate: true })
  const js = ts.transpileModule(script.content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const exports: { default?: vue.Component } = {}
  const require = (id: string): unknown => {
    if (!(id in modules)) throw new Error(`${filename} imports ${id}`)
    return modules[id]
  }
  new Function('exports', 'require', js)(exports, require)
  if (!exports.default) throw new Error(`no component in ${filename}`)
  return exports.default
}

const Accordion = compile(ACCORDION, 'AccordionSection.vue', {
  vue,
  '../../ui/Icon.vue': { default: Stub }
})
const Section = compile(SECTION, 'CustomizeSection.vue', {
  vue,
  './customize': customize,
  './zonesOpen': zonesOpen,
  '../../composables/useI18n': { useI18n: () => t }
})
const Editor = compile(EDITOR, 'ElementEditor.vue', {
  vue,
  '../../composables/useI18n': { useI18n: () => t },
  '../../ui/Icon.vue': { default: Stub },
  '../layout/AccordionSection.vue': { default: Accordion },
  '../layout/PageSection.vue': { default: Stub },
  '../layout/zonesOpen': zonesOpen,
  '../useOptimistic': useOptimistic,
  './listOps': listOps
})

function mount(render: () => vue.VNode): { root: TestNode; unmount: () => void } {
  const root = node('root')
  const app = renderer.createApp({ render })
  app.mount(root)
  return { root, unmount: () => app.unmount() }
}

/** Main's answer: the list it was sent, as the settings. */
function answer(list: OpenList): void {
  const s = overlayState.settings.value ?? DEFAULT_SETTINGS
  overlayState.settings.value = {
    ...s,
    settingsWindow: { ...s.settingsWindow, customizeOpen: list }
  } as OverlaySettings
}

beforeEach(() => {
  sent.length = 0
  overlayState.settings.value = DEFAULT_SETTINGS
})
afterEach(() => {
  overlayState.settings.value = null
})

// ---- AccordionSection -----------------------------------------------------------------------

describe('AccordionSection', () => {
  function accordion(open: boolean, onToggle = vi.fn()): TestNode {
    const { root } = mount(() =>
      vue.h(Accordion, { title: 'Cabecera', summary: '5 de 7 visibles', open, onToggle }, () =>
        vue.h('p', null, 'BODY')
      )
    )
    return root
  }

  it('says whether it is open, and its header controls its body', () => {
    for (const open of [true, false]) {
      const root = accordion(open)
      const button = all(root, (n) => n.tag === 'button')[0]
      const body = all(root, byClass('acc-body'))[0]
      expect(button?.props['aria-expanded']).toBe(open)
      expect(body?.props.id).toBe(button?.props['aria-controls'])
      expect(body?.props['aria-labelledby']).toBe(button?.props.id)
      // Closed, nothing in it can take the focus.
      expect(body?.props.inert).toBe(!open)
    }
  })

  it('is a heading under "Personalizar", its summary read after a pause', () => {
    const root = accordion(false)
    expect(all(root, (n) => n.tag === 'h3')).toHaveLength(1)
    expect(all(root, (n) => n.tag === 'h2')).toHaveLength(0)
    expect(textOf(all(root, (n) => n.tag === 'button')[0] as TestNode)).toBe(
      'Cabecera, 5 de 7 visibles'
    )
  })

  it('asks to toggle on a click', () => {
    const onToggle = vi.fn()
    fire(all(accordion(false, onToggle), (n) => n.tag === 'button')[0])
    expect(onToggle).toHaveBeenCalledWith(true)
  })
})

// ---- CustomizeSection and the editors -------------------------------------------------------

const S = OPTION_SCHEMA.relative

function editor(field: 'columns' | 'headerBar' | 'footerBar'): vue.VNode {
  const spec = S[field]
  const labels = Object.fromEntries(spec.ids.map((id: string) => [id, { label: id }]))
  return vue.h(Editor, {
    key: field,
    title: field,
    items: spec.default,
    spec,
    labels,
    apply: () => Promise.resolve()
  })
}

function page(fields: readonly ('columns' | 'headerBar' | 'footerBar')[]): {
  root: TestNode
  unmount: () => void
  zones: () => readonly CustomizeZoneId[]
} {
  let registry: zonesOpen.ZoneRegistry | null = null
  const Probe = vue.defineComponent({
    setup(_p, { slots }) {
      return () => {
        registry = zonesOpen.injectZoneRegistry()
        return slots.default?.()
      }
    }
  })
  const { root, unmount } = mount(() =>
    vue.h(Section, null, () => [vue.h(Probe, null, () => fields.map(editor))])
  )
  return { root, unmount, zones: () => registry?.zones.value ?? [] }
}

const allButtons = (root: TestNode): TestNode[] =>
  all(root, byClass('cz-all')).flatMap((n) => all(n, (c) => c.tag === 'button'))

describe('CustomizeSection', () => {
  it('has "Expandir todo / Contraer todo" only with more than one zone', async () => {
    const one = page(['columns'])
    await vue.nextTick()
    expect(one.zones()).toEqual(['relative.columns'])
    expect(allButtons(one.root)).toHaveLength(0)
    const three = page(['columns', 'headerBar', 'footerBar'])
    await vue.nextTick()
    expect(three.zones()).toEqual(['relative.columns', 'relative.headerBar', 'relative.footerBar'])
    expect(allButtons(three.root).map(textOf)).toEqual(['Expandir todo', 'Contraer todo'])
  })

  it('opens and closes every zone, and never disables a button (it keeps the focus)', async () => {
    const { root } = page(['columns', 'headerBar', 'footerBar'])
    await vue.nextTick()
    const [expand, collapse] = allButtons(root)
    // Only the first zone is open by default.
    expect(expand?.props['aria-disabled']).toBe(false)
    fire(expand)
    expect(sent).toHaveLength(1)
    // Shown at once, before main answers.
    expect(zonesOpen.isZoneOpen('relative.footerBar')).toBe(true)
    answer(sent[0] as OpenList)
    await vue.nextTick()
    expect(expand?.props['aria-disabled']).toBe(true)
    expect(expand?.props.disabled).toBeUndefined()
    // Nothing to do: nothing sent.
    fire(expand)
    expect(sent).toHaveLength(1)
    fire(collapse)
    answer(sent[1] as OpenList)
    await vue.nextTick()
    expect(collapse?.props['aria-disabled']).toBe(true)
    expect(
      ['columns', 'headerBar', 'footerBar'].some((f) =>
        zonesOpen.isZoneOpen(`relative.${f}` as CustomizeZoneId)
      )
    ).toBe(false)
    // Only these three changed.
    const before = DEFAULT_SETTINGS.settingsWindow.customizeOpen
    const after = sent[1] as OpenList
    expect(after.filter((e, i) => e.visible !== before[i]?.visible).map((e) => e.id)).toEqual([
      'relative.columns'
    ])
  })
})

describe('ElementEditor in "Personalizar"', () => {
  it('joins its page as an accordion and leaves it when it goes', async () => {
    const shown = vue.shallowRef<readonly ('columns' | 'headerBar' | 'footerBar')[]>([
      'columns',
      'headerBar'
    ])
    const probe: { registry: zonesOpen.ZoneRegistry | null } = { registry: null }
    const Probe = vue.defineComponent({
      setup(_p, { slots }) {
        probe.registry = zonesOpen.injectZoneRegistry()
        return () => slots.default?.()
      }
    })
    const { root, unmount } = mount(() =>
      vue.h(Section, null, () => [vue.h(Probe, null, () => shown.value.map(editor))])
    )
    await vue.nextTick()
    expect(probe.registry?.zones.value).toEqual(['relative.columns', 'relative.headerBar'])
    expect(all(root, byClass('acc'))).toHaveLength(2)
    shown.value = ['columns']
    await vue.nextTick()
    expect(probe.registry?.zones.value).toEqual(['relative.columns'])
    unmount()
    expect(probe.registry?.zones.value).toEqual([])
  })

  it('opens and closes its own zone from its header', async () => {
    const { root } = page(['columns', 'headerBar'])
    await vue.nextTick()
    const header = all(root, byClass('acc-btn'))[1]
    expect(header?.props['aria-expanded']).toBe(false)
    fire(header)
    expect(sent).toHaveLength(1)
    answer(sent[0] as OpenList)
    await vue.nextTick()
    expect(header?.props['aria-expanded']).toBe(true)
    expect(zonesOpen.isZoneOpen('relative.headerBar')).toBe(true)
    expect(zonesOpen.isZoneOpen('relative.columns')).toBe(true)
  })
})
