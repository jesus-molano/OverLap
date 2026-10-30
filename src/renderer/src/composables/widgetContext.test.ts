/**
 * useNoRoomReport as a widget in the settings sample uses it: what it has no room for goes to the
 * host whenever it changes, and nothing once it is unmounted; over the game (no host) nothing.
 * Outside a component here, so inject and the unmount hook are stubbed.
 */
import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'

let host: unknown = null
const unmounts: (() => void)[] = []
vi.mock('vue', async (original) => ({
  ...(await original<typeof import('vue')>()),
  hasInjectionContext: () => true,
  inject: () => host,
  onBeforeUnmount: (fn: () => void) => unmounts.push(fn)
}))

const { useNoRoomReport } = await import('./widgetContext')

describe('useNoRoomReport', () => {
  it('reports to the sample host on every change, and [] when unmounted', async () => {
    const calls: (readonly string[])[] = []
    host = { reportNoRoom: (_source: object, els: readonly string[]) => calls.push(els) }
    const dropped = shallowRef<readonly string[]>(['relative.footerBar.rubber'])
    effectScope().run(() => useNoRoomReport(() => dropped.value))
    expect(calls).toEqual([['relative.footerBar.rubber']])
    dropped.value = []
    await nextTick()
    expect(calls.at(-1)).toEqual([])
    dropped.value = ['relative.footerBar.carCount']
    await nextTick()
    expect(calls.at(-1)).toEqual(['relative.footerBar.carCount'])
    for (const fn of unmounts.splice(0)) fn()
    expect(calls.at(-1)).toEqual([])
  })

  it('does nothing over the game, where there is no sample host', () => {
    host = null
    const read = vi.fn(() => ['x'])
    effectScope().run(() => useNoRoomReport(read))
    expect(read).not.toHaveBeenCalled()
    expect(unmounts).toEqual([])
  })
})
