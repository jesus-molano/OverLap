import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef, type ShallowRef } from 'vue'
import { useReveal } from './useReveal'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

/** Lets the post-flush watcher and the awaited promise run. */
async function settle(): Promise<void> {
  await nextTick()
  for (let i = 0; i < 3; i++) await Promise.resolve()
}

/** The default wait outside an overlay panel (a settings sample). */
function waitOut(): void {
  vi.advanceTimersByTime(50)
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

describe('useReveal in a settings sample', () => {
  it('waits for the timeout before the first fade-in', async () => {
    const r = setup()
    r.want.value = true
    await settle()
    vi.advanceTimersByTime(49)
    await settle()
    expect(r.shown.value).toBe(false)
    vi.advanceTimersByTime(1)
    await settle()
    expect(r.shown.value).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    r.stop()
  })

  it('shows at once with the same layout, and after a wait with another one', async () => {
    const r = setup()
    r.want.value = true
    await settle()
    waitOut()
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
    waitOut()
    await settle()
    expect(r.shown.value).toBe(true)
    r.stop()
  })

  it('a layout change while shown stays shown', async () => {
    const r = setup()
    r.want.value = true
    await settle()
    waitOut()
    await settle()
    r.key.value = '2'
    await settle()
    expect(r.shown.value).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    r.stop()
  })

  it('without the auto height it never waits', async () => {
    const r = setup(false)
    r.want.value = true
    await settle()
    expect(r.shown.value).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    r.stop()
  })

  it('a hide during the wait wins, and nothing shows after dispose', async () => {
    const r = setup()
    r.want.value = true
    await settle()
    r.want.value = false
    await settle()
    waitOut()
    await settle()
    expect(r.shown.value).toBe(false)

    r.want.value = true
    await settle()
    r.stop()
    vi.advanceTimersByTime(100)
    await settle()
    expect(r.shown.value).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('useReveal in an overlay panel', () => {
  it('waits for the panel to be fitted, not for a timeout', async () => {
    const waits: number[] = []
    const fit = { done: (): void => undefined }
    vi.resetModules()
    vi.doMock('./widgetContext', () => ({
      injectPanelHost: () => ({
        waitForFit: (ms: number) => {
          waits.push(ms)
          return new Promise<void>((resolve) => (fit.done = resolve))
        }
      })
    }))
    const { useReveal: inPanel } = await import('./useReveal')
    const scope = effectScope()
    const want = shallowRef(false)
    const shown = scope.run(() =>
      inPanel(
        () => want.value,
        () => 'a',
        { fit: () => true, timeoutMs: 80 }
      )
    )!
    want.value = true
    await settle()
    expect(waits).toEqual([80])
    expect(vi.getTimerCount()).toBe(0)
    expect(shown.value).toBe(false)
    fit.done()
    await settle()
    expect(shown.value).toBe(true)
    scope.stop()
    vi.doUnmock('./widgetContext')
  })
})
