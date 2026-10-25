import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import { FakeElement, FakeResizeObserver } from './testing/fakeResizeObserver'
import { entrySize, sameSize, useElementSize, type ResizeEntryLike } from './useElementSize'

function entry(w: number, h: number, extra: Partial<ResizeEntryLike> = {}): ResizeEntryLike {
  return {
    contentRect: { width: w, height: h } as DOMRectReadOnly,
    borderBoxSize: [],
    devicePixelContentBoxSize: [],
    ...extra
  }
}

describe('entrySize', () => {
  it('reads the content box', () => {
    expect(entrySize(entry(200, 100), 'content-box', 1)).toEqual({ w: 200, h: 100, dpr: 1 })
  })

  it('reads the border box, falling back to the content box', () => {
    const e = entry(200, 100, {
      borderBoxSize: [{ inlineSize: 202, blockSize: 102 } as ResizeObserverSize]
    })
    expect(entrySize(e, 'border-box', 1)).toEqual({ w: 202, h: 102, dpr: 1 })
    expect(entrySize(entry(200, 100), 'border-box', 1)).toEqual({ w: 200, h: 100, dpr: 1 })
  })

  it('reads device pixels, or scales the CSS box', () => {
    const e = entry(200, 100, {
      devicePixelContentBoxSize: [{ inlineSize: 300, blockSize: 150 } as ResizeObserverSize]
    })
    expect(entrySize(e, 'device-pixel-content-box', 1.5)).toEqual({ w: 300, h: 150, dpr: 1.5 })
    expect(entrySize(entry(200.4, 100), 'device-pixel-content-box', 1.5)).toEqual({
      w: 301,
      h: 150,
      dpr: 1.5
    })
  })

  it('is null without area', () => {
    expect(entrySize(entry(0, 100), 'content-box', 1)).toBeNull()
  })

  it('compares sizes field by field', () => {
    expect(sameSize({ w: 1, h: 2, dpr: 1 }, { w: 1, h: 2, dpr: 1 })).toBe(true)
    expect(sameSize({ w: 1, h: 2, dpr: 1 }, { w: 1, h: 2, dpr: 2 })).toBe(false)
  })
})

describe('useElementSize', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    vi.stubGlobal('Element', FakeElement)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    FakeResizeObserver.live.clear()
  })

  it('updates on change only and follows a replaced element', async () => {
    const scope = effectScope()
    const a = new FakeElement()
    const b = new FakeElement()
    const target = shallowRef<FakeElement | null>(a)
    const onResize = vi.fn()
    const size = scope.run(() => useElementSize(target as never, { box: 'border-box', onResize }))!
    await nextTick()
    FakeResizeObserver.resizeAll(a, 100, 50, 2)
    expect(size.value).toEqual({ w: 102, h: 52, dpr: 1 })
    const first = size.value
    FakeResizeObserver.resizeAll(a, 100, 50, 2)
    expect(size.value).toBe(first)
    expect(onResize).toHaveBeenCalledTimes(1)

    target.value = b
    await nextTick()
    FakeResizeObserver.resizeAll(a, 300, 300)
    expect(size.value).toBe(first)
    FakeResizeObserver.resizeAll(b, 80, 40)
    expect(size.value).toEqual({ w: 80, h: 40, dpr: 1 })
    scope.stop()
  })

  it('disconnects its observer when the scope stops', async () => {
    const scope = effectScope()
    const el = new FakeElement()
    scope.run(() => useElementSize(shallowRef(el) as never))
    await nextTick()
    expect(FakeResizeObserver.live.size).toBe(1)
    scope.stop()
    expect(FakeResizeObserver.live.size).toBe(0)
  })

  it('measures the root element of a component instance', async () => {
    const scope = effectScope()
    const el = new FakeElement()
    const size = scope.run(() => useElementSize(shallowRef({ $el: el }) as never))!
    await nextTick()
    FakeResizeObserver.resizeAll(el, 10, 20)
    expect(size.value.h).toBe(20)
    scope.stop()
  })
})
