import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef, type EffectScope } from 'vue'
import type { InfoItemId } from '@shared/types'
import { FakeElement, FakeResizeObserver } from '../composables/testing/fakeResizeObserver'
import { useInfoBarRoom } from './useInfoBarRoom'

/** A bar element whose computed font size the test sets (what --ib-scale and the scale give). */
class Bar extends FakeElement {
  fontPx = 12
}

describe('useInfoBarRoom', () => {
  let scope: EffectScope

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    vi.stubGlobal('Element', FakeElement)
    vi.stubGlobal('getComputedStyle', (el: Bar) => ({ fontSize: `${el.fontPx}px` }))
  })

  afterEach(() => {
    scope.stop()
    vi.unstubAllGlobals()
  })

  async function mount(): Promise<{
    bar: Bar
    size: ReturnType<typeof shallowRef<'small' | 'normal' | 'large'>>
    ids: ReturnType<typeof shallowRef<readonly InfoItemId[]>>
    room: ReturnType<typeof useInfoBarRoom>
  }> {
    const bar = new Bar()
    const root = shallowRef<HTMLElement | null>(bar as unknown as HTMLElement)
    const size = shallowRef<'small' | 'normal' | 'large'>('large')
    const ids = shallowRef<readonly InfoItemId[]>(['sof', 'clock'])
    scope = effectScope()
    const room = scope.run(() => useInfoBarRoom(root, () => size.value, ids))
    if (!room) throw new Error('no room')
    await nextTick()
    FakeResizeObserver.resizeAll(bar, 300, 18)
    await nextTick()
    return { bar, size, ids, room }
  }

  it('measures the room in em of the bar font', async () => {
    const { room } = await mount()
    expect(room.widthEm.value).toBe(25)
  })

  it('reads the font again on a new size choice, the width unchanged', async () => {
    // Grande then Pequeña: the old code kept 12 px and so dropped items for the larger font.
    const { bar, size, room } = await mount()
    room.extra.value = 2
    bar.fontPx = 10
    size.value = 'small'
    await nextTick()
    expect(room.widthEm.value).toBe(30)
    expect(room.extra.value).toBe(0)
  })

  it('reads the font again when a new scale changes the bar height', async () => {
    const { bar, room } = await mount()
    room.extra.value = 1
    bar.fontPx = 15
    FakeResizeObserver.resizeAll(bar, 300, 22.5)
    await nextTick()
    expect(room.widthEm.value).toBe(20)
    expect(room.extra.value).toBe(0)
  })

  it('starts the extra drops again with other items, and keeps them otherwise', async () => {
    const { ids, room } = await mount()
    room.extra.value = 1
    await nextTick()
    expect(room.extra.value).toBe(1)
    ids.value = ['sof']
    await nextTick()
    expect(room.extra.value).toBe(0)
  })
})
