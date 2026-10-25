import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useConfirm } from './useConfirm'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

function setup(ms = 1000): {
  action: ReturnType<typeof vi.fn>
  c: ReturnType<typeof useConfirm>
  stop: () => void
} {
  const action = vi.fn()
  const scope = effectScope()
  const c = scope.run(() => useConfirm(action, ms))!
  return { action, c, stop: () => scope.stop() }
}

describe('useConfirm', () => {
  it('runs the action on the second trigger only', () => {
    const { action, c, stop } = setup()
    c.trigger()
    expect(c.armed.value).toBe(true)
    expect(action).not.toHaveBeenCalled()
    c.trigger()
    expect(action).toHaveBeenCalledTimes(1)
    expect(c.armed.value).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    stop()
  })

  it('disarms by itself after the timeout', () => {
    const { action, c, stop } = setup(1000)
    c.trigger()
    vi.advanceTimersByTime(999)
    expect(c.armed.value).toBe(true)
    vi.advanceTimersByTime(1)
    expect(c.armed.value).toBe(false)
    c.trigger()
    expect(action).not.toHaveBeenCalled()
    stop()
  })

  it('cancels, and clears its timer when the scope is disposed', () => {
    const { action, c, stop } = setup()
    c.trigger()
    c.cancel()
    expect(c.armed.value).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    c.trigger()
    expect(vi.getTimerCount()).toBe(1)
    stop()
    expect(vi.getTimerCount()).toBe(0)
    expect(action).not.toHaveBeenCalled()
  })
})
