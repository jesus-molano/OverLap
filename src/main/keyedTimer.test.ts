import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KeyedTimer } from './keyedTimer'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('KeyedTimer', () => {
  it('keeps at most one timer per key, restarted from each call', () => {
    const fired: string[] = []
    const t = new KeyedTimer<string>(100, (k) => fired.push(k))
    t.restart('a')
    vi.advanceTimersByTime(60)
    t.restart('b')
    vi.advanceTimersByTime(60)
    t.restart('b')
    expect(vi.getTimerCount()).toBe(1)
    expect(fired).toEqual(['a'])
    vi.advanceTimersByTime(100)
    expect(fired).toEqual(['a', 'b'])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels, flushes and disposes', () => {
    const fired: string[] = []
    const t = new KeyedTimer<string>(100, (k) => fired.push(k))
    t.restart('a')
    t.restart('b')
    t.cancel('a')
    expect(t.has('a')).toBe(false)
    t.flush()
    expect(fired).toEqual(['b'])
    expect(vi.getTimerCount()).toBe(0)
    t.restart('c')
    t.dispose()
    vi.advanceTimersByTime(1_000)
    expect(fired).toEqual(['b'])
    expect(vi.getTimerCount()).toBe(0)
  })
})
