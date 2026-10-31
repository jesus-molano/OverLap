/**
 * The accordions of "Personalizar" mounted for real: AccordionSection (aria-expanded, inert, the
 * header's control of its body), CustomizeSection's "Expandir todo" / "Contraer todo" (only with
 * more than one zone; never disabled, so the focus stays) and ElementEditor joining and leaving
 * its page's registry. The components are compiled here with Vue's own compiler (the test
 * runner has no Vue plugin) and mounted through a minimal renderer (no DOM in the node
 * environment) that keeps each element's attributes; main is a stub that answers at once.
 */
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import * as elements from '@shared/elements'
import * as i18n from '@shared/i18n'
import { messagesFor } from '@shared/i18n'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import type { CustomizeZoneId, ElementEntry, OverlaySettings } from '@shared/types'
import { overlayState } from '../../composables/useOverlay'
import * as listOps from '../elements/listOps'
import * as undo from '../undo/undo'
import * as useOptimistic from '../useOptimistic'
import * as customize from './customize'
import * as zonesOpen from './zonesOpen'
import ACCORDION from './AccordionSection.vue?raw'
import SECTION from './CustomizeSection.vue?raw'
import EDITOR from '../elements/ElementEditor.vue?raw'
import NOTE from '../controls/PreviewNote.vue?raw'
import HELP from '../controls/HelpText.vue?raw'

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
  '@shared/i18n': i18n,
  './ResetIcon.vue': { default: Stub },
  '../../ui/Icon.vue': { default: Stub },
  '../undo/restore': {
    WIDGET_PAGE: Symbol('widget-page'),
    resetWidget: () => undefined,
    widgetPartAtDefault: () => false
  },
  '../../composables/useOverlay': { useOverlayState: () => ({ settings: vue.shallowRef(null) }) },
  '../../composables/useI18n': { useI18n: () => t }
})
/** What the page's sample has no room for (useNoRoom's stub reads it). */
const noRoomEls = vue.shallowRef<ReadonlySet<string>>(new Set())
const Note = compile(NOTE, 'PreviewNote.vue', { vue, '../../ui/Icon.vue': { default: Stub } })
const Help = compile(HELP, 'HelpText.vue', {
  vue,
  '../../ui/Icon.vue': { default: Stub },
  '../../composables/useI18n': { useI18n: () => t }
})
const Editor = compile(EDITOR, 'ElementEditor.vue', {
  vue,
  '../../composables/useI18n': { useI18n: () => t },
  '../../ui/Icon.vue': { default: Stub },
  '../layout/AccordionSection.vue': { default: Accordion },
  '../layout/PageSection.vue': { default: Stub },
  '../layout/zonesOpen': zonesOpen,
  '../preview/usePreviewEdit': { injectPreviewEdit: () => null },
  // A reset offers its "Deshacer" (none to show here: the editor announces it).
  '../undo/restore': { offerSectionRestore: () => () => false },
  '../search/reveal': { revealTarget: () => Promise.resolve(true) },
  '../undo/undo': undo,
  '../useOptimistic': useOptimistic,
  './listOps': listOps,
  '@shared/elements': elements,
  // The sample's report, as the test sets it (noRoomEls).
  '../preview/useNoRoom': {
    useNoRoom: () =>
      vue.computed(
        () => (el: string) =>
          noRoomEls.value.has(el) ? { kind: 'room', text: 'No cabe a 460 px' } : undefined
      )
  },
  '../controls/PreviewNote.vue': { default: Note },
  '../controls/HelpText.vue': { default: Help }
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
  it('has one "Expandir todo" / "Contraer todo" button only with more than one zone', async () => {
    const one = page(['columns'])
    await vue.nextTick()
    expect(one.zones()).toEqual(['relative.columns'])
    expect(allButtons(one.root)).toHaveLength(0)
    const three = page(['columns', 'headerBar', 'footerBar'])
    await vue.nextTick()
    expect(three.zones()).toEqual(['relative.columns', 'relative.headerBar', 'relative.footerBar'])
    expect(allButtons(three.root).map(textOf)).toEqual(['Expandir todo'])
  })

  it('opens every zone, then turns into "Contraer todo" and closes them (R47)', async () => {
    const { root } = page(['columns', 'headerBar', 'footerBar'])
    await vue.nextTick()
    const button = (): TestNode => {
      const b = allButtons(root)[0]
      if (b === undefined) throw new Error('no button')
      return b
    }
    // Only the first zone is open by default: the button opens the rest.
    expect(allButtons(root)).toHaveLength(1)
    expect(textOf(button())).toBe('Expandir todo')
    // Never dimmed: it always does something.
    expect(button().props['aria-disabled']).toBeUndefined()
    expect(button().props.disabled).toBeUndefined()
    fire(button())
    expect(sent).toHaveLength(1)
    // Shown at once, before main answers.
    expect(zonesOpen.isZoneOpen('relative.footerBar')).toBe(true)
    answer(sent[0] as OpenList)
    await vue.nextTick()
    expect(textOf(button())).toBe('Contraer todo')
    fire(button())
    answer(sent[1] as OpenList)
    await vue.nextTick()
    expect(textOf(button())).toBe('Expandir todo')
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

// ---- Undo -------------------------------------------------------------------------------------

describe('ElementEditor undo', () => {
  const spec = S.columns
  const labels = Object.fromEntries(spec.ids.map((id: string) => [id, { label: `L-${id}` }]))
  const target = spec.default.find((e) => e.visible && !spec.required.includes(e.id))

  function columns(apply: (next: unknown, change: unknown) => Promise<unknown>): {
    root: TestNode
    unmount: () => void
  } {
    return mount(() =>
      vue.h(Editor, { title: 'Columnas', items: spec.default, spec, labels, apply })
    )
  }
  const eyeOf = (root: TestNode, id: string): TestNode | undefined =>
    all(root, (n) => n.props['data-focus'] === 'eye').find((n) => rowId(n) === id)
  function rowId(n: TestNode): string | undefined {
    for (let p: TestNode | null = n; p !== null; p = p.parent) {
      if (typeof p.props['data-row'] === 'string') return p.props['data-row']
    }
    return undefined
  }

  it('offers to undo a hide from its eye, and undoes it through its own apply', async () => {
    expect(target).toBeDefined()
    const id = (target as ElementEntry<string>).id
    const detachToast = undo.undoSlot.attach()
    const apply = vi.fn((next: unknown, change: unknown) => Promise.resolve([next, change]))
    const { root, unmount } = columns(apply)
    fire(eyeOf(root, id))
    expect(undo.undoSlot.shown.value?.offer).toMatchObject({ kind: 'hide', id, label: `L-${id}` })
    expect(undo.undoSlot.undo()).toBe(true)
    expect(apply).toHaveBeenCalledTimes(2)
    expect(apply.mock.calls[1]).toEqual([
      spec.default.map((e) => ({ id: e.id, visible: e.visible })),
      { kind: 'visible', id, visible: true, undo: true }
    ])
    await vue.nextTick()
    unmount()
    detachToast()
  })

  it('announces the undo even when its words are the last ones it said', async () => {
    const id = (target as ElementEntry<string>).id
    const detachToast = undo.undoSlot.attach()
    // No toast first: the hide and the show are announced by the editor itself.
    detachToast()
    const { root, unmount } = columns(() => new Promise(() => {}))
    const region = (): string =>
      textOf(all(root, (n) => n.props['aria-live'] === 'polite')[0] as TestNode)
    fire(eyeOf(root, id))
    await vue.nextTick()
    fire(eyeOf(root, id))
    await vue.nextTick()
    const shownWords = region()
    expect(shownWords).toContain(`L-${id}`)
    // With the toast: the hide is its to announce, and the undo says the same words again.
    const detach2 = undo.undoSlot.attach()
    fire(eyeOf(root, id))
    await vue.nextTick()
    expect(region()).toBe(shownWords)
    expect(undo.undoSlot.undo()).toBe(true)
    await vue.nextTick()
    expect(region()).toBe('')
    await vue.nextTick()
    expect(region()).toBe(shownWords)
    unmount()
    detach2()
  })

  it('withdraws its offer when it goes', () => {
    const id = (target as ElementEntry<string>).id
    const detachToast = undo.undoSlot.attach()
    const { root, unmount } = columns(() => Promise.resolve())
    fire(eyeOf(root, id))
    expect(undo.undoSlot.shown.value).not.toBeNull()
    unmount()
    expect(undo.undoSlot.shown.value).toBeNull()
    detachToast()
  })
})

describe('ElementEditor and the room in the sample', () => {
  afterEach(() => {
    noRoomEls.value = new Set()
  })

  it('marks «No cabe» on a shown row the sample has no room for, and on no other row', async () => {
    noRoomEls.value = new Set(['relative.columns.ir', 'relative.columns.tyre'])
    const { root, unmount } = mount(() => editor('columns'))
    await vue.nextTick()
    const rowText = (id: string): string =>
      textOf(all(root, (n) => n.props['data-row'] === id)[0] as TestNode)
    expect(rowText('ir')).toContain('No cabe a 460 px')
    // Hidden (tyre): nothing to say, it is not drawn anyway.
    expect(rowText('tyre')).not.toContain('No cabe')
    expect(rowText('lic')).not.toContain('No cabe')
    noRoomEls.value = new Set()
    await vue.nextTick()
    expect(rowText('ir')).not.toContain('No cabe')
    unmount()
  })
})
