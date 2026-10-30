import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useMediaQuery } from './useMediaQuery'

describe('useMediaQuery (R49)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('follows the query, and lets go of it with its scope', () => {
    const h: { listener: ((e: { matches: boolean }) => void) | null } = { listener: null }
    const list = {
      matches: true,
      addEventListener: vi.fn((_: string, cb: (e: { matches: boolean }) => void) => {
        h.listener = cb
      }),
      removeEventListener: vi.fn()
    }
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => list)
    )
    const scope = effectScope()
    const narrow = scope.run(() => useMediaQuery('(max-width: 639px)'))
    expect(narrow?.value).toBe(true)
    h.listener?.({ matches: false })
    expect(narrow?.value).toBe(false)
    scope.stop()
    expect(list.removeEventListener).toHaveBeenCalledWith('change', h.listener)
  })

  it('is false where there is no matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined)
    const scope = effectScope()
    expect(scope.run(() => useMediaQuery('(max-width: 639px)'))?.value).toBe(false)
    scope.stop()
  })
})
