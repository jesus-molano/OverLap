import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import { FakeElement, FakeResizeObserver } from './testing/fakeResizeObserver'
import { useContentHeight, useContentSize } from './useContentSize'

interface Host {
  reportHeight(px: number): void
}

/** What `widgetContext` provides to the widget under test (null: not provided). */
const hosts = vi.hoisted(() => ({ sample: null as Host | null, panel: null as Host | null }))

vi.mock('./widgetContext', () => ({
  injectSampleHost: () => hosts.sample,
  injectPanelHost: () => hosts.panel
}))

/** A host that records every height it gets. */
function recorder(): Host & { heights: number[] } {
  const heights: number[] = []
  return { heights, reportHeight: (px) => void heights.push(px) }
}

let panel: ReturnType<typeof recorder>

beforeEach(() => {
  panel = recorder()
  hosts.sample = null
  hosts.panel = panel
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  vi.stubGlobal('Element', FakeElement)
})

afterEach(() => {
  vi.unstubAllGlobals()
  FakeResizeObserver.live.clear()
})

describe('useContentSize', () => {
  it('reports the border-box height to its panel, only when it changes', async () => {
    const scope = effectScope()
    const el = new FakeElement()
    scope.run(() => useContentSize(shallowRef(el) as never))
    await nextTick()
    FakeResizeObserver.resizeAll(el, 300, 200, 2)
    await nextTick()
    FakeResizeObserver.resizeAll(el, 320, 200, 2) // width only: same height
    await nextTick()
    FakeResizeObserver.resizeAll(el, 320, 230.4, 2)
    await nextTick()
    expect(panel.heights).toEqual([202, 233])
    scope.stop()
    expect(FakeResizeObserver.live.size).toBe(0)
  })

  it('keeps quiet while disabled and re-sends when enabled again', async () => {
    const scope = effectScope()
    const el = new FakeElement()
    const on = shallowRef(true)
    scope.run(() => useContentSize(shallowRef(el) as never, { enabled: on }))
    await nextTick()
    FakeResizeObserver.resizeAll(el, 300, 100)
    await nextTick()
    on.value = false
    await nextTick()
    FakeResizeObserver.resizeAll(el, 300, 150)
    await nextTick()
    expect(panel.heights).toEqual([100])
    on.value = true
    await nextTick()
    expect(panel.heights).toEqual([100, 150])
    scope.stop()
  })

  it('measures nothing outside a panel or a settings sample', async () => {
    hosts.panel = null
    const scope = effectScope()
    const el = new FakeElement()
    scope.run(() => useContentSize(shallowRef(el) as never))
    await nextTick()
    expect(FakeResizeObserver.live.size).toBe(0)
    scope.stop()
  })
})

describe('useContentHeight', () => {
  it('reports a computed height plus the extra chrome', async () => {
    const scope = effectScope()
    const h = shallowRef<number | null>(null)
    scope.run(() => useContentHeight(h, { extraPx: 2 }))
    await nextTick()
    expect(panel.heights).toEqual([])
    h.value = 294
    await nextTick()
    h.value = 294
    await nextTick()
    h.value = 120
    await nextTick()
    expect(panel.heights).toEqual([296, 122])
    scope.stop()
    h.value = 500
    await nextTick()
    expect(panel.heights).toHaveLength(2)
  })

  it('rounds to whole pixels and re-sends after being re-enabled', async () => {
    const scope = effectScope()
    const h = shallowRef(180)
    const on = shallowRef(true)
    scope.run(() => useContentHeight(h, { enabled: on, extraPx: 2 }))
    await nextTick()
    h.value = 180.004
    await nextTick()
    on.value = false
    await nextTick()
    h.value = 240
    await nextTick()
    on.value = true
    await nextTick()
    expect(panel.heights).toEqual([182, 242])
    scope.stop()
  })
})

describe('in a settings sample', () => {
  it('reports to the sample box, never to a panel', async () => {
    const sample = recorder()
    hosts.sample = sample
    const scope = effectScope()
    const h = shallowRef(180)
    scope.run(() => useContentHeight(h))
    await nextTick()
    h.value = 210.2
    await nextTick()
    expect(sample.heights).toEqual([180, 211])
    expect(panel.heights).toEqual([])
    scope.stop()
  })
})
