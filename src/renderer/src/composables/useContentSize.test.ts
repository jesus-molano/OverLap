import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import { createFakeOverlay, type FakeOverlay } from './testing/fakeOverlay'
import { FakeElement, FakeResizeObserver } from './testing/fakeResizeObserver'
import { useContentHeight, useContentSize, waitForWindowResize } from './useContentSize'

let fake: FakeOverlay
const listeners = new Set<() => void>()

beforeEach(() => {
  fake = createFakeOverlay()
  listeners.clear()
  vi.stubGlobal('window', {
    overlay: fake,
    addEventListener: (_type: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_type: string, cb: () => void) => listeners.delete(cb)
  })
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  vi.stubGlobal('Element', FakeElement)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  FakeResizeObserver.live.clear()
})

describe('useContentSize', () => {
  it('reports the border-box height, only when it changes', async () => {
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
    expect(fake.sent.contentSize).toEqual([{ height: 202 }, { height: 233 }])
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
    expect(fake.sent.contentSize).toEqual([{ height: 100 }])
    on.value = true
    await nextTick()
    expect(fake.sent.contentSize).toEqual([{ height: 100 }, { height: 150 }])
    scope.stop()
  })
})

describe('useContentHeight', () => {
  it('reports a computed height plus the extra chrome', async () => {
    const scope = effectScope()
    const h = shallowRef<number | null>(null)
    scope.run(() => useContentHeight(h, { extraPx: 2 }))
    await nextTick()
    expect(fake.sent.contentSize).toEqual([])
    h.value = 294
    await nextTick()
    h.value = 294
    await nextTick()
    h.value = 120
    await nextTick()
    expect(fake.sent.contentSize).toEqual([{ height: 296 }, { height: 122 }])
    scope.stop()
    h.value = 500
    await nextTick()
    expect(fake.sent.contentSize).toHaveLength(2)
  })
})

describe('waitForWindowResize', () => {
  it('resolves on resize and removes its listener', async () => {
    const p = waitForWindowResize(1000)
    expect(listeners.size).toBe(1)
    for (const cb of [...listeners]) cb()
    await p
    expect(listeners.size).toBe(0)
  })

  it('resolves after the timeout without a resize', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const p = waitForWindowResize(50)
    vi.advanceTimersByTime(50)
    await p
    expect(listeners.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('in a settings sample', () => {
  it('reports to the sample box instead of main', async () => {
    const heights: number[] = []
    vi.resetModules()
    vi.doMock('./widgetContext', () => ({
      injectSampleHost: () => ({ reportHeight: (px: number) => heights.push(px) })
    }))
    const { useContentHeight: inSample } = await import('./useContentSize')
    const scope = effectScope()
    const h = shallowRef(180)
    scope.run(() => inSample(h))
    await nextTick()
    h.value = 210.2
    await nextTick()
    expect(heights).toEqual([180, 211])
    expect(fake.sent.contentSize).toEqual([])
    scope.stop()
    vi.doUnmock('./widgetContext')
  })
})
