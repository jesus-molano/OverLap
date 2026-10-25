import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SHRINK_DELAY_MS } from '@shared/panelGeometry'
import { createHeightGate, type HeightGate } from './heightGate'

let changes: (number | null)[]

function makeGate(): HeightGate {
  return createHeightGate({ onChange: (h) => changes.push(h) })
}

beforeEach(() => {
  vi.useFakeTimers()
  changes = []
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createHeightGate', () => {
  it('applies the first report at once, in either direction', () => {
    const g = makeGate()
    expect(g.applied).toBeNull()
    g.report(250, false)
    expect(g.applied).toBe(250)
    expect(changes).toEqual([250])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('grows immediately', () => {
    const g = makeGate()
    g.report(300, false)
    g.report(420, false)
    expect(changes).toEqual([300, 420])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('shrinks only after the content stayed smaller for the delay', () => {
    const g = makeGate()
    g.report(300, false)
    g.report(250, false)
    expect(g.applied).toBe(300)
    vi.advanceTimersByTime(SHRINK_DELAY_MS / 2)
    // Further shrinks do not push the deadline back; the latest height is the one applied.
    g.report(240, false)
    vi.advanceTimersByTime(SHRINK_DELAY_MS / 2 - 1)
    expect(changes).toEqual([300])
    vi.advanceTimersByTime(1)
    expect(changes).toEqual([300, 240])
    expect(g.applied).toBe(240)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('shrinks at once a panel that is not drawn', () => {
    const g = makeGate()
    g.report(300, false)
    g.report(250, true)
    expect(changes).toEqual([300, 250])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a growth or a return to the applied height cancels a pending shrink', () => {
    const g = makeGate()
    g.report(300, false)
    g.report(250, false)
    g.report(300, false)
    expect(vi.getTimerCount()).toBe(0)
    g.report(250, false)
    g.report(350, false)
    expect(changes).toEqual([300, 350])
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(SHRINK_DELAY_MS * 2)
    expect(changes).toEqual([300, 350])
  })

  it('reset forgets every height: the next report applies at once', () => {
    const g = makeGate()
    g.report(400, false)
    g.report(300, false) // pending shrink
    g.reset()
    expect(g.applied).toBeNull()
    expect(changes).toEqual([400, null])
    expect(vi.getTimerCount()).toBe(0)
    g.reset() // nothing to change: no call
    expect(changes).toEqual([400, null])
    g.report(300, false)
    expect(changes).toEqual([400, null, 300])
  })

  it('dispose leaves no timer behind and ignores later reports', () => {
    const g = makeGate()
    g.report(300, false)
    g.report(120, false)
    g.dispose()
    vi.advanceTimersByTime(SHRINK_DELAY_MS * 2)
    g.report(500, false)
    expect(vi.getTimerCount()).toBe(0)
    expect(changes).toEqual([300])
  })

  it('uses the injected timers', () => {
    const pending: (() => void)[] = []
    const g = createHeightGate({
      onChange: (h) => changes.push(h),
      delayMs: 10,
      timers: {
        setTimeout: (cb) => pending.push(cb),
        clearTimeout: () => undefined
      }
    })
    g.report(300, false)
    g.report(200, false)
    expect(pending).toHaveLength(1)
    pending[0]?.()
    expect(changes).toEqual([300, 200])
  })
})
