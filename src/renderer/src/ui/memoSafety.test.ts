/**
 * `v-memo` and content that comes and goes inside another component's slot.
 *
 * Vue (3.5.44) clears an element's memo on unmount only when the component unmounting it is the
 * one that rendered it (`vnode.ctx === parentComponent` in runtime-core's unmount). A widget's
 * rows are slot content of WidgetPanel: rendered by the widget, unmounted by the panel, so the
 * memo outlives the element. When its `v-if` comes back with the same inputs, Vue reuses the old
 * vnode, whose children still point at the detached DOM: later updates go nowhere (a frozen line)
 * or throw (insertBefore NotFoundError, then a broken component tree). A `v-memo` on a `v-for`
 * element is cached per list render and is not affected.
 *
 * Here: the real WidgetPanel in a small in-memory renderer (the test runner has no DOM), the
 * hazard itself, the rule the widgets follow, and a scan of every renderer template for that
 * rule.
 */
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import * as vue from 'vue'
import {
  ElementTypes,
  NodeTypes,
  type ElementNode,
  type TemplateChildNode
} from '@vue/compiler-core'
import { compileScript, parse } from 'vue/compiler-sfc'
import * as inlineStyle from '../directives/inlineStyle'
import PANEL_SOURCE from './WidgetPanel.vue?raw'

// ---- A tiny DOM: enough for the renderer, strict about anchors like the real one ----

interface FakeNode {
  readonly tag: string
  text: string
  parent: FakeNode | null
  children: FakeNode[]
  readonly style: { setProperty: () => void; removeProperty: () => void }
}

function fakeNode(tag: string, text = ''): FakeNode {
  return {
    tag,
    text,
    parent: null,
    children: [],
    style: { setProperty: () => undefined, removeProperty: () => undefined }
  }
}

function detach(n: FakeNode): void {
  const p = n.parent
  if (!p) return
  p.children.splice(p.children.indexOf(n), 1)
  n.parent = null
}

const renderer = vue.createRenderer<FakeNode, FakeNode>({
  createElement: (tag) => fakeNode(tag),
  createText: (text) => fakeNode('#text', text),
  createComment: (text) => fakeNode('#comment', text),
  setText: (n, text) => {
    n.text = text
  },
  setElementText: (n, text) => {
    for (const c of n.children) c.parent = null
    n.children = []
    if (text) {
      const t = fakeNode('#text', text)
      t.parent = n
      n.children.push(t)
    }
  },
  insert: (child, parent, anchor) => {
    detach(child)
    const at = anchor ? parent.children.indexOf(anchor) : parent.children.length
    if (at < 0) throw new Error('NotFoundError: the anchor is not a child of this node')
    parent.children.splice(at, 0, child)
    child.parent = parent
  },
  remove: detach,
  parentNode: (n) => n.parent,
  nextSibling: (n) => {
    const p = n.parent
    return p ? (p.children[p.children.indexOf(n) + 1] ?? null) : null
  },
  patchProp: () => undefined
})

const textOf = (n: FakeNode): string =>
  n.tag === '#comment' ? '' : n.tag === '#text' ? n.text : n.children.map(textOf).join('')

// ---- The real WidgetPanel, compiled here (no Vue plugin in the test runner) ----

function compilePanel(): vue.Component {
  const { descriptor, errors } = parse(PANEL_SOURCE, { filename: 'WidgetPanel.vue' })
  if (errors.length > 0) throw errors[0]
  const script = compileScript(descriptor, { id: 'widget-panel', inlineTemplate: true })
  const js = ts.transpileModule(script.content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const modules: Readonly<Record<string, unknown>> = {
    vue,
    '../directives/inlineStyle': inlineStyle
  }
  const exports: { default?: vue.Component } = {}
  const require = (id: string): unknown => {
    if (!(id in modules)) throw new Error(`WidgetPanel imports ${id}`)
    return modules[id]
  }
  new Function('exports', 'require', js)(exports, require)
  if (!exports.default) throw new Error('WidgetPanel has no default export')
  return exports.default
}

const WidgetPanel = compilePanel()
const Chip = vue.defineComponent({ props: { text: String }, template: '<i>{{ text }}</i>' })

interface Line {
  readonly id: number
  readonly text: string
}

/**
 * A widget-like host: `template` over `shown` (the option), `line` (an identity-stable view, as
 * the widgets' reuseView gives) and `list` (reuseViews). Returns the panel's text after each step.
 */
async function drive(template: string): Promise<string[]> {
  const shown = vue.ref(true)
  const line = vue.shallowRef<Line>({ id: 0, text: 'a1' })
  const list = vue.shallowRef<readonly Line[]>([
    { id: 1, text: 'x' },
    { id: 2, text: 'y' }
  ])
  const Host = vue.defineComponent({
    components: { WidgetPanel, Chip },
    setup: () => ({ shown, line, list }),
    template
  })
  const root = fakeNode('root')
  const seen: string[] = []
  const step = async (change: () => void): Promise<void> => {
    change()
    await vue.nextTick()
    seen.push(textOf(root))
  }
  const app = renderer.createApp(Host)
  app.config.errorHandler = (err) => {
    throw err
  }
  app.mount(root)
  seen.push(textOf(root))
  await step(() => (shown.value = false)) // the option off: unmounted by the panel
  await step(() => (shown.value = true)) // back on, same inputs
  await step(() => {
    line.value = { id: 0, text: 'a2' }
    list.value = [{ id: 2, text: 'Y' }, ...list.value.slice(0, 1), { id: 3, text: 'z' }]
  })
  app.unmount()
  return seen
}

describe('v-memo in a WidgetPanel slot', () => {
  it('is a hazard on an element shown by a v-if (why the rule below exists)', async () => {
    // If this starts to pass through (a2), Vue clears slot memos now: the rule could be relaxed.
    const seen = await drive(
      '<WidgetPanel><p v-if="shown" v-memo="[line]"><b>{{ line.text }}</b></p></WidgetPanel>'
    )
    expect(seen).toEqual(['a1', '', 'a1', 'a1'])
  })

  it('is a hazard under a v-if ancestor too', async () => {
    const seen = await drive(
      '<WidgetPanel><template v-if="shown"><p v-memo="[line]"><b>{{ line.text }}</b></p></template></WidgetPanel>'
    )
    expect(seen).toEqual(['a1', '', 'a1', 'a1'])
  })

  it('a v-if line without v-memo follows its data after being hidden and shown again', async () => {
    const seen = await drive(
      '<WidgetPanel><p v-if="shown"><b>{{ line.text }}</b><Chip :text="line.text" /></p></WidgetPanel>'
    )
    expect(seen).toEqual(['a1a1', '', 'a1a1', 'a2a2'])
  })

  it('a v-for v-memo under a v-if follows its data (cached per list render)', async () => {
    const seen = await drive(
      '<WidgetPanel><div v-if="shown"><span v-for="l in list" :key="l.id" v-memo="[l]"><Chip :text="l.text" /></span></div></WidgetPanel>'
    )
    expect(seen).toEqual(['xy', '', 'xy', 'Yxz'])
  })

  it("is safe in the widget's own template (not slot content)", async () => {
    const seen = await drive(
      '<div><template v-if="shown"><p v-memo="[line]"><b>{{ line.text }}</b></p></template></div>'
    )
    expect(seen).toEqual(['a1', '', 'a1', 'a2'])
  })
})

// ---- The rule, over every renderer template ----

const SOURCES = import.meta.glob<string>('../**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true
})

const CONDITIONAL = new Set(['if', 'else-if', 'else'])

/** `v-memo` misuses in one SFC: on a v-if element, or (without v-for) in a component's slot. */
function memoMisuses(source: string, file: string): string[] {
  const { descriptor, errors } = parse(source, { filename: file })
  if (errors.length > 0) throw errors[0]
  const found: string[] = []
  const visit = (n: TemplateChildNode, inSlot: boolean): void => {
    if (n.type !== NodeTypes.ELEMENT) return
    const el: ElementNode = n
    const dirs = el.props.filter((p) => p.type === NodeTypes.DIRECTIVE).map((p) => p.name)
    if (dirs.includes('memo')) {
      const where = `${file}:${el.loc.start.line} <${el.tag}>`
      if (dirs.some((d) => CONDITIONAL.has(d))) found.push(`${where}: v-memo with v-if`)
      else if (inSlot && !dirs.includes('for')) found.push(`${where}: v-memo in a slot`)
    }
    const slot = inSlot || el.tagType === ElementTypes.COMPONENT
    for (const c of el.children) visit(c, slot)
  }
  for (const c of descriptor.template?.ast?.children ?? []) visit(c, false)
  return found
}

describe('v-memo rule in the renderer templates', () => {
  it('reads the templates', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(50)
    expect(memoMisuses('<template><X><p v-if="a" v-memo="[a]" /></X></template>', 't')).toEqual([
      't:1 <p>: v-memo with v-if'
    ])
    expect(
      memoMisuses('<template><X><div v-if="a"><p v-memo="[a]" /></div></X></template>', 't')
    ).toEqual(['t:1 <p>: v-memo in a slot'])
    expect(
      memoMisuses('<template><X><p v-for="i in a" :key="i" v-memo="[i]" /></X></template>', 't')
    ).toEqual([])
  })

  it('never puts v-memo on a v-if element, nor (outside a v-for) in a slot', () => {
    const found = Object.entries(SOURCES).flatMap(([file, source]) => memoMisuses(source, file))
    expect(found).toEqual([])
  })
})
