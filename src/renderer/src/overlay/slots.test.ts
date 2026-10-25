import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createRenderer,
  defineComponent,
  effectScope,
  h,
  nextTick,
  shallowRef,
  type EffectScope,
  type PropType,
  type VNode
} from 'vue'
import type { BoundsCommit, InitialState, OverlayLayout, OverlayPanel } from '@shared/ipc'
import { SHRINK_DELAY_MS } from '@shared/panelGeometry'
import { createDefaultSettings } from '@shared/settings'
import type { OverlaySettings, Rect } from '@shared/types'
import type { WidgetId } from '@shared/widgets'
import {
  createFakeOverlay,
  flush,
  settingsWith,
  type FakeOverlay
} from '../composables/testing/fakeOverlay'
import { COMMIT_EXPIRY_MS } from './commitTracker'
import type { Frames } from './timers'

type SlotsModule = typeof import('./slots')

/** requestAnimationFrame stand-in: frames run when the test says so. */
class TestFrames implements Frames {
  private next = 1
  readonly pending = new Map<number, () => void>()
  request(cb: () => void): number {
    const id = this.next++
    this.pending.set(id, cb)
    return id
  }
  cancel(id: number): void {
    this.pending.delete(id)
  }
  run(): void {
    const cbs = [...this.pending.values()]
    this.pending.clear()
    for (const cb of cbs) cb()
  }
}

const STANDINGS_RECT: Rect = { x: 100, y: 100, width: 540, height: 470 }
const RADAR_RECT: Rect = { x: 600, y: 300, width: 220, height: 260 }

function panel(widget: WidgetId, rect: Rect, placement = 0): OverlayPanel {
  return { widget, rect, placement }
}

function layoutOf(
  revision: number,
  panels: OverlayPanel[],
  o: { ackSeq?: number; scaleFactor?: number } = {}
): OverlayLayout {
  return {
    revision,
    session: 3,
    ackSeq: o.ackSeq ?? 0,
    display: {
      id: 11,
      index: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
      scaleFactor: o.scaleFactor ?? 1
    },
    panels
  }
}

const BASE_PANELS = [panel('radar', RADAR_RECT), panel('standings', STANDINGS_RECT)]

let fake: FakeOverlay
let frames: TestFrames
let sent: BoundsCommit[]
let warnings: string[]
let mod: SlotsModule
let scope: EffectScope
let registry: ReturnType<SlotsModule['createSlotRegistry']>
let settings: OverlaySettings

async function setup(init: Partial<InitialState> = {}): Promise<void> {
  vi.resetModules()
  settings = createDefaultSettings()
  fake = createFakeOverlay({
    view: { kind: 'overlay' },
    layout: layoutOf(1, BASE_PANELS),
    settings,
    ...init
  })
  vi.stubGlobal('window', { overlay: fake })
  frames = new TestFrames()
  sent = []
  warnings = []
  mod = await import('./slots')
  const overlay = await import('../composables/useOverlay')
  overlay.useOverlayState()
  await flush()
  scope = effectScope()
  registry = scope.run(() =>
    mod.createSlotRegistry({
      commitBounds: (msg) => void sent.push(msg),
      frames,
      timers: {
        setTimeout: (cb, ms) => setTimeout(cb, ms),
        clearTimeout: (t) => clearTimeout(t as ReturnType<typeof setTimeout>)
      },
      now: () => Date.now(),
      warn: (m) => void warnings.push(m)
    })
  )!
}

function mountSlot(id: WidgetId): { view: ReturnType<SlotsModule['useSlot']>; stop: () => void } {
  const s = effectScope()
  const view = s.run(() => mod.useSlot(registry, id))!
  return { view, stop: () => s.stop() }
}

function pushLayout(l: OverlayLayout): void {
  fake.layout.emit(l)
}

function changeSettings(change: (s: OverlaySettings) => void): void {
  settings = settingsWith(settings, change)
  fake.settings.emit(settings)
}

beforeEach(async () => {
  vi.useFakeTimers()
  await setup()
})

afterEach(() => {
  scope.stop()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('createSlotRegistry', () => {
  it('lists the hosted widgets in WIDGET_IDS order, the same array while equal', () => {
    expect(registry.widgets.value).toEqual(['radar', 'standings'])
    const first = registry.widgets.value
    pushLayout(
      layoutOf(2, [panel('standings', STANDINGS_RECT), panel('radar', { ...RADAR_RECT, x: 5 })])
    )
    expect(registry.widgets.value).toBe(first)
    pushLayout(layoutOf(3, [panel('inputs', RADAR_RECT), panel('relative', RADAR_RECT)]))
    expect(registry.widgets.value).toEqual(['relative', 'inputs'])
  })

  it('keeps the display object while its values are equal', () => {
    const d = registry.display.value
    expect(d?.index).toBe(1)
    pushLayout(layoutOf(2, BASE_PANELS))
    expect(registry.display.value).toBe(d)
    pushLayout(layoutOf(3, BASE_PANELS, { scaleFactor: 1.5 }))
    expect(registry.display.value?.scaleFactor).toBe(1.5)
  })

  it('registers mounted slots in WIDGET_IDS order and removes them on unmount', () => {
    const standings = mountSlot('standings')
    const radar = mountSlot('radar')
    expect(registry.slots.value.map((s) => s.id)).toEqual(['radar', 'standings'])
    expect(registry.slot('radar')).toBe(radar.view.handle)
    radar.stop()
    expect(registry.slots.value.map((s) => s.id)).toEqual(['standings'])
    expect(registry.slot('radar')).toBeUndefined()
    standings.stop()
    expect(registry.slots.value).toEqual([])
  })
})

describe('useSlot geometry', () => {
  it('draws the layout rect with both edges on device pixels', async () => {
    const { view } = mountSlot('radar')
    expect(view.handle.rect.value).toEqual(RADAR_RECT)
    expect(view.style.value).toEqual({
      left: '600px',
      top: '300px',
      width: '220px',
      height: '260px'
    })
    pushLayout(layoutOf(2, [panel('radar', { x: 3, y: 1, width: 461, height: 81 })], {}))
    pushLayout(
      layoutOf(3, [panel('radar', { x: 3, y: 1, width: 461, height: 81 })], { scaleFactor: 1.25 })
    )
    await nextTick()
    expect(view.style.value).toEqual({
      left: '3.2px',
      top: '0.8px',
      width: '460.8px',
      height: '81.6px'
    })
  })

  it('keeps the rect and style objects while main sends the same rect', () => {
    const { view } = mountSlot('radar')
    const rect = view.handle.rect.value
    const style = view.style.value
    pushLayout(layoutOf(2, [panel('radar', { ...RADAR_RECT })]))
    expect(view.handle.rect.value).toBe(rect)
    expect(view.style.value).toBe(style)
  })

  it('draws a drag rect while an interaction is in progress, then the layout again', () => {
    const { view } = mountSlot('radar')
    const r = { ...RADAR_RECT, x: 700 }
    view.handle.setDragRect(r)
    expect(view.handle.rect.value).toEqual(r)
    expect(view.dragging.value).toBe(true)
    view.handle.setDragRect(null)
    expect(view.handle.rect.value).toEqual(RADAR_RECT)
    expect(view.dragging.value).toBe(false)
    expect(sent).toEqual([])
  })

  it('takes placement from the layout only', () => {
    const { view } = mountSlot('radar')
    expect(view.handle.placement.value).toBe(0)
    // A new rect (another window's drop, a commit) is not a placement change by itself.
    pushLayout(layoutOf(2, [panel('radar', { ...RADAR_RECT, x: 10 })]))
    expect(view.handle.placement.value).toBe(0)
    pushLayout(layoutOf(3, [panel('radar', RADAR_RECT, 4)]))
    expect(view.handle.placement.value).toBe(4)
  })

  it('follows the lock and auto-height options', () => {
    const radar = mountSlot('radar').view
    const standings = mountSlot('standings').view
    expect(radar.handle.autoHeight.value).toBe(false)
    expect(standings.handle.autoHeight.value).toBe(true)
    expect(radar.handle.locked.value).toBe(false)
    changeSettings((s) => {
      s.widgets.radar.locked = true
      s.widgets.standings.autoHeight = false
    })
    expect(radar.handle.locked.value).toBe(true)
    expect(standings.handle.autoHeight.value).toBe(false)
  })
})

describe('useSlot shown and mounted', () => {
  it('hides a rule-hidden panel outside edit mode, previews it in edit mode', () => {
    const { view } = mountSlot('radar')
    expect(view.shown.value).toBe(true)
    fake.autoHidden.emit({ widget: 'radar', hidden: true, reason: 'pits' })
    expect(view.shown.value).toBe(false)
    expect(view.handle.autoHidden.value).toEqual({ hidden: true, reason: 'pits' })
    fake.editMode.emit(true)
    expect(view.shown.value).toBe(true)
  })

  it('creates the widget the first time it is shown and keeps it', async () => {
    await setup({ autoHidden: { battle: { hidden: true, reason: 'practice' } } })
    const { view } = mountSlot('battle')
    expect(view.shown.value).toBe(false)
    expect(view.mounted.value).toBe(false)
    fake.editMode.emit(true)
    expect(view.mounted.value).toBe(true)
    fake.editMode.emit(false)
    expect(view.shown.value).toBe(false)
    expect(view.mounted.value).toBe(true)
  })
})

describe('useSlot commits', () => {
  it('sends a drag with session, seq and revision, and draws it until acknowledged', () => {
    const { view } = mountSlot('radar')
    const r = { x: 700, y: 320, width: 220, height: 260 }
    view.handle.setDragRect(r)
    view.handle.commit('drag')
    expect(sent).toEqual([
      { session: 3, seq: 1, widget: 'radar', kind: 'drag', revision: 1, rect: r }
    ])
    expect(view.dragging.value).toBe(false)
    expect(view.handle.rect.value).toEqual(r)
    // Another layout before main processed it: still drawn where it was dropped.
    pushLayout(layoutOf(2, BASE_PANELS))
    expect(view.handle.rect.value).toEqual(r)
    // Accepted: the same layout acknowledges it and carries the new rect.
    pushLayout(layoutOf(3, [panel('radar', r)], { ackSeq: 1 }))
    expect(view.handle.rect.value).toEqual(r)
    expect(registry.tracker.isPending('radar')).toBe(false)
  })

  it('snaps back to the layout rect when main rejects a commit', () => {
    const { view } = mountSlot('radar')
    view.handle.setDragRect({ ...RADAR_RECT, x: 900 })
    view.handle.commit('wheel')
    expect(sent[0]?.kind).toBe('wheel')
    pushLayout(layoutOf(2, BASE_PANELS, { ackSeq: 1 }))
    expect(view.handle.rect.value).toEqual(RADAR_RECT)
  })

  it('commits nothing without a drag rect', () => {
    const { view } = mountSlot('radar')
    view.handle.commit('drag')
    view.handle.commit('wheel')
    expect(sent).toEqual([])
  })

  it('drops a commit main never acknowledges, with a warning', () => {
    const { view } = mountSlot('radar')
    view.handle.setDragRect({ ...RADAR_RECT, y: 10 })
    view.handle.commit('drag')
    vi.advanceTimersByTime(COMMIT_EXPIRY_MS)
    expect(view.handle.rect.value).toEqual(RADAR_RECT)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('[overlay] radar')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('sends a drop outside the display with the grab clamped into the drawn size', () => {
    const { view } = mountSlot('radar')
    const r = { ...RADAR_RECT, x: 1700 }
    view.handle.setDragRect(r)
    view.handle.dropOutside({ x: -5, y: 900.4 })
    expect(sent).toEqual([
      {
        session: 3,
        seq: 1,
        widget: 'radar',
        kind: 'drop-outside',
        grab: { x: 0, y: 260 },
        size: { width: 220, height: 260 }
      }
    ])
    expect(view.handle.rect.value).toEqual(r)
  })

  it('numbers every commit of the window in one sequence', () => {
    const radar = mountSlot('radar').view
    const inputs = (() => {
      pushLayout(layoutOf(2, [...BASE_PANELS, panel('inputs', { ...RADAR_RECT, y: 700 })]))
      return mountSlot('inputs').view
    })()
    radar.handle.setDragRect({ ...RADAR_RECT, x: 1 })
    radar.handle.commit('drag')
    inputs.handle.setDragRect({ ...RADAR_RECT, x: 2, y: 700 })
    inputs.handle.commit('drag')
    expect(sent.map((m) => m.seq)).toEqual([1, 2])
    expect(sent.map((m) => (m.kind === 'drag' ? m.revision : null))).toEqual([2, 2])
  })
})

describe('useSlot auto height', () => {
  it('applies a reported height on the next frame and tells main', async () => {
    const { view } = mountSlot('standings')
    view.host.reportHeight(300.2)
    expect(view.handle.rect.value.height).toBe(470)
    expect(frames.pending.size).toBe(1)
    frames.run()
    expect(view.handle.rect.value).toEqual({ ...STANDINGS_RECT, height: 301 })
    expect(view.host.size.value).toEqual({ width: 540, height: 301 })
    await nextTick()
    expect(sent).toEqual([{ session: 3, seq: 1, widget: 'standings', kind: 'fit', height: 301 }])
    // The same height again: nothing new.
    view.host.reportHeight(301)
    frames.run()
    await nextTick()
    expect(sent).toHaveLength(1)
  })

  it('grows at once and shrinks after the delay', async () => {
    const { view } = mountSlot('standings')
    view.host.reportHeight(300)
    frames.run()
    await nextTick()
    view.host.reportHeight(250)
    frames.run()
    expect(view.handle.rect.value.height).toBe(300)
    vi.advanceTimersByTime(SHRINK_DELAY_MS)
    frames.run()
    expect(view.handle.rect.value.height).toBe(250)
    await nextTick()
    expect(sent.map((m) => (m.kind === 'fit' ? m.height : null))).toEqual([300, 250])
  })

  it('keeps the bottom edge with a bottom anchor, and stays inside the work area', () => {
    changeSettings((s) => (s.widgets.standings.anchor = 'bottom'))
    const { view } = mountSlot('standings')
    view.host.reportHeight(300)
    frames.run()
    expect(view.handle.rect.value).toEqual({ x: 100, y: 270, width: 540, height: 300 })
    view.host.reportHeight(5_000)
    frames.run()
    expect(view.handle.rect.value).toEqual({ x: 100, y: 0, width: 540, height: 570 })
  })

  it('sends no fit for a height main already has', async () => {
    const { view } = mountSlot('standings')
    view.host.reportHeight(300)
    frames.run()
    await nextTick()
    expect(sent).toHaveLength(1)
    // Main's next layout carries the fitted height: nothing to tell.
    pushLayout(layoutOf(2, [panel('standings', { ...STANDINGS_RECT, height: 300 })]))
    await nextTick()
    expect(sent).toHaveLength(1)
    // A reset puts the saved height back: main is told the fitted one again.
    pushLayout(layoutOf(3, [panel('standings', STANDINGS_RECT, 1)]))
    await nextTick()
    expect(view.handle.rect.value.height).toBe(300)
    expect(sent.map((m) => (m.kind === 'fit' ? m.height : null))).toEqual([300, 300])
  })

  it('sends no fit while an interaction owns the rect', async () => {
    const { view } = mountSlot('standings')
    view.host.reportHeight(300)
    frames.run()
    await nextTick()
    view.handle.setDragRect({ x: 200, y: 900, width: 540, height: 300 })
    // Near the bottom of the work area the drawn height is clamped (140): main is not told.
    expect(view.handle.rect.value.height).toBe(140)
    await nextTick()
    expect(sent).toHaveLength(1)
    view.handle.commit('drag')
    await nextTick()
    expect(sent.map((m) => m.kind)).toEqual(['fit', 'drag'])
  })

  it('ignores heights while auto height is off and forgets them when it turns off', async () => {
    const { view } = mountSlot('standings')
    view.host.reportHeight(300)
    frames.run()
    await nextTick()
    changeSettings((s) => (s.widgets.standings.autoHeight = false))
    frames.run()
    expect(view.handle.rect.value).toEqual(STANDINGS_RECT)
    view.host.reportHeight(200)
    expect(frames.pending.size).toBe(0)
    await nextTick()
    expect(sent).toHaveLength(1)
    // Back on: the next report applies at once (no jump to the old height first).
    changeSettings((s) => (s.widgets.standings.autoHeight = true))
    expect(view.handle.rect.value).toEqual(STANDINGS_RECT)
    view.host.reportHeight(200)
    frames.run()
    expect(view.handle.rect.value.height).toBe(200)
  })

  it('tells main a fit again after auto height was off, even the height it rejected', async () => {
    const { view } = mountSlot('standings')
    // Sent just as main turned auto height off: main rejects it (acknowledged, no new rect).
    view.host.reportHeight(300)
    frames.run()
    await nextTick()
    expect(sent).toHaveLength(1)
    pushLayout(layoutOf(2, [panel('standings', STANDINGS_RECT)], { ackSeq: 1 }))
    changeSettings((s) => (s.widgets.standings.autoHeight = false))
    await nextTick()
    expect(view.handle.rect.value).toEqual(STANDINGS_RECT)
    // Back on with the same content: main still has 470, so the 300 must be sent.
    changeSettings((s) => (s.widgets.standings.autoHeight = true))
    view.host.reportHeight(300)
    frames.run()
    await nextTick()
    expect(view.handle.rect.value.height).toBe(300)
    expect(sent.map((m) => (m.kind === 'fit' ? m.height : null))).toEqual([300, 300])
  })

  it('ignores reports of free widgets and unusable heights', () => {
    const radar = mountSlot('radar').view
    radar.host.reportHeight(100)
    const standings = mountSlot('standings').view
    standings.host.reportHeight(Number.NaN)
    standings.host.reportHeight(-1)
    expect(frames.pending.size).toBe(0)
  })

  it('waitForFit resolves after the next fit, or at the timeout', async () => {
    const { view } = mountSlot('standings')
    let done = false
    void view.host.waitForFit(50).then(() => (done = true))
    vi.advanceTimersByTime(49)
    await flush()
    expect(done).toBe(false)
    vi.advanceTimersByTime(1)
    await flush()
    expect(done).toBe(true)

    done = false
    void view.host.waitForFit(50).then(() => (done = true))
    view.host.reportHeight(320)
    frames.run()
    await flush()
    expect(done).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('useSlot dispose', () => {
  it('leaves no timer, frame, waiter or registration behind', async () => {
    const { view, stop } = mountSlot('standings')
    const listeners = fake.listenerCount()
    view.host.reportHeight(300)
    frames.run()
    view.host.reportHeight(200) // pending shrink
    view.host.reportHeight(200)
    view.handle.setDragRect({ ...STANDINGS_RECT, x: 5 })
    view.handle.commit('drag') // pending commit
    view.host.reportHeight(400) // pending frame
    let resolved = false
    void view.host.waitForFit(1_000).then(() => (resolved = true))
    stop()
    await flush()
    expect(resolved).toBe(true)
    expect(frames.pending.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
    expect(registry.slots.value).toEqual([])
    expect(registry.tracker.isPending('standings')).toBe(false)
    expect(fake.listenerCount()).toBe(listeners)
    // Nothing reaches main from a disposed slot.
    const count = sent.length
    view.handle.setDragRect({ ...STANDINGS_RECT, x: 9 })
    view.handle.commit('drag')
    view.handle.dropOutside({ x: 0, y: 0 })
    expect(sent).toHaveLength(count)
  })

  it('stopping the registry stops its tracker', () => {
    const { view } = mountSlot('radar')
    view.handle.setDragRect({ ...RADAR_RECT, x: 5 })
    view.handle.commit('drag')
    expect(vi.getTimerCount()).toBe(1)
    scope.stop()
    expect(vi.getTimerCount()).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Error boundary, through a minimal custom renderer (no DOM in the node environment)
// ---------------------------------------------------------------------------

interface TestNode {
  tag: string
  text: string
  children: TestNode[]
  parent: TestNode | null
}

function node(tag: string, text = ''): TestNode {
  return { tag, text, children: [], parent: null }
}

function detach(n: TestNode): void {
  const p = n.parent
  if (p === null) return
  p.children.splice(p.children.indexOf(n), 1)
  n.parent = null
}

const renderer = createRenderer<TestNode, TestNode>({
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
  patchProp: () => undefined
})

function textOf(n: TestNode): string {
  return n.tag === '#comment' ? '' : n.text + n.children.map(textOf).join('')
}

describe('slot error boundary', () => {
  it('stops a widget error at its slot: the other slots keep rendering and updating', async () => {
    const logs: unknown[][] = []
    const fail = shallowRef(false)
    const tick = shallowRef(0)
    const Boundary = defineComponent({
      props: { id: { type: String as PropType<WidgetId>, required: true } },
      setup(props, { slots }) {
        mod.useSlotErrorBoundary(props.id, (...args) => void logs.push(args))
        return () => h('div', null, slots.default?.())
      }
    })
    // Functional components: each still renders in its own tracked effect.
    const Broken = (): VNode => {
      if (fail.value) throw new Error('boom')
      return h('span', null, `radar ${tick.value};`)
    }
    const Fine = (): VNode => h('span', null, `inputs ${tick.value};`)
    const Root = (): VNode[] => [
      h(Boundary, { id: 'radar' }, () => h(Broken)),
      h(Boundary, { id: 'inputs' }, () => h(Fine))
    ]
    const appError = vi.fn()
    const app = renderer.createApp(Root)
    app.config.errorHandler = appError
    const root = node('root')
    app.mount(root)
    expect(textOf(root)).toBe('radar 0;inputs 0;')

    fail.value = true
    tick.value = 1
    await nextTick()
    expect(textOf(root)).toBe('inputs 1;')
    tick.value = 2
    await nextTick()
    expect(textOf(root)).toBe('inputs 2;')
    expect(logs).toHaveLength(1)
    expect(logs[0]?.[0]).toBe('[overlay] radar:')
    expect(appError).not.toHaveBeenCalled()
    app.unmount()
  })

  it('slotErrorHandler logs with the widget id and stops propagation', () => {
    const log = vi.fn()
    const err = new Error('x')
    expect(mod.slotErrorHandler('delta', log)(err, null, 'render function')).toBe(false)
    expect(log).toHaveBeenCalledWith('[overlay] delta:', 'render function', err)
  })
})
