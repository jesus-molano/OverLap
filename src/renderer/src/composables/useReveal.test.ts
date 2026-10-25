import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef, type ShallowRef } from 'vue'
import { useReveal } from './useReveal'

const listeners = new Set<() => void>()

beforeEach(() => {
  vi.useFakeTimers()
  listeners.clear()
  vi.stubGlobal('window', {
    addEventListener: (_type: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_type: string, cb: () => void) => listeners.delete(cb)
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

/** Lets the post-flush watcher and the awaited promise run. */
async function settle(): Promise<void> {
  await nextTick()
  for (let i = 0; i < 3; i++) await Promise.resolve()
}

function resizeWindow(): void {
  for (const cb of [...listeners]) cb()
}

function setup(fit = true): {
  want: ShallowRef<boolean>
  key: ShallowRef<string>
  shown: { readonly value: boolean }
  stop: () => void
} {
  const scope = effectScope()
  const want = shallowRef(false)
  const key = shallowRef('1')
  const shown = scope.run(() =>
    useReveal(
      () => want.value,
      () => key.value,
      { fit: () => fit }
    )
  )
  if (!shown) throw new Error('no scope')
  return { want, key, shown, stop: () => scope.stop() }
}

describe('useReveal', () => {
  it('waits for the window resize before the first fade-in', async () => {
    const r = setup()
    r.want.value = true
    await settle()
    expect(r.shown.value).toBe(false)
    expect(listeners.size).toBe(1)
    resizeWindow()
    await settle()
    expect(r.shown.value).toBe(true)
    expect(listeners.size).toBe(0)
    r.stop()
  })

  it('or for the timeout when the window does not change', async () => {
    const r = setup()
    r.want.value = true
    await settle()
    vi.advanceTimersByTime(49)
    await settle()
    expect(r.shown.value).toBe(false)
    vi.advanceTimersByTime(1)
    await settle()
    expect(r.shown.value).toBe(true)
    expect(listeners.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
    r.stop()
  })

  it('shows at once with the same layout, and after a wait with another one', async () => {
    const r = setup()
    r.want.value = true
    await settle()
    resizeWindow()
    await settle()
    r.want.value = false
    await settle()
    expect(r.shown.value).toBe(false)
    r.want.value = true
    await settle()
    expect(r.shown.value).toBe(true)
    // Hidden, then back with two lanes instead of one.
    r.want.value = false
    await settle()
    r.key.value = '2'
    r.want.value = true
    await settle()
    expect(r.shown.value).toBe(false)
    resizeWindow()
    await settle()
    expect(r.shown.value).toBe(true)
    r.stop()
  })

  it('a layout change while shown stays shown', async () => {
    const r = setup()
    r.want.value = true
    await settle()
    resizeWindow()
    await settle()
    r.key.value = '2'
    await settle()
    expect(r.shown.value).toBe(true)
    expect(listeners.size).toBe(0)
    r.stop()
  })

  it('without the auto height it never waits', async () => {
    const r = setup(false)
    r.want.value = true
    await settle()
    expect(r.shown.value).toBe(true)
    expect(listeners.size).toBe(0)
    r.stop()
  })

  it('a hide during the wait wins, and nothing shows after dispose', async () => {
    const r = setup()
    r.want.value = true
    await settle()
    r.want.value = false
    await settle()
    resizeWindow()
    await settle()
    expect(r.shown.value).toBe(false)

    r.want.value = true
    await settle()
    r.stop()
    vi.advanceTimersByTime(100)
    await settle()
    expect(r.shown.value).toBe(false)
    expect(listeners.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
})
