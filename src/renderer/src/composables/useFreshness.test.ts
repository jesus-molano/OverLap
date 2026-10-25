import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, shallowRef } from 'vue'
import { createStaleTimer, useFreshness } from './useFreshness'

/** Manual clock and timer queue: shows exactly how many timers are pending. */
function fakeClock(): {
  now: () => number
  advance: (ms: number) => void
  pending: () => number
  setTimer: (cb: () => void, ms: number) => ReturnType<typeof setTimeout>
  clearTimer: (id: ReturnType<typeof setTimeout>) => void
} {
  let t = 0
  let nextId = 1
  const timers = new Map<number, { at: number; cb: () => void }>()
  const advance = (ms: number): void => {
    const end = t + ms
    for (;;) {
      let due: [number, { at: number; cb: () => void }] | undefined
      for (const e of timers) if (e[1].at <= end && (!due || e[1].at < due[1].at)) due = e
      if (!due) break
      timers.delete(due[0])
      t = due[1].at
      due[1].cb()
    }
    t = end
  }
  return {
    now: () => t,
    advance,
    pending: () => timers.size,
    setTimer: (cb, ms) => {
      const id = nextId++
      timers.set(id, { at: t + ms, cb })
      return id as unknown as ReturnType<typeof setTimeout>
    },
    clearTimer: (id) => void timers.delete(id as unknown as number)
  }
}

describe('createStaleTimer', () => {
  it('goes stale after staleMs without a touch', () => {
    const c = fakeClock()
    const onStale = vi.fn()
    const timer = createStaleTimer({ staleMs: 300, ...c, onStale })
    timer.touch(c.now())
    c.advance(299)
    expect(onStale).not.toHaveBeenCalled()
    c.advance(1)
    expect(onStale).toHaveBeenCalledTimes(1)
  })

  it('keeps one pending timer through a touch storm', () => {
    const c = fakeClock()
    const onStale = vi.fn()
    const timer = createStaleTimer({ staleMs: 300, ...c, onStale })
    for (let i = 0; i < 1000; i++) {
      timer.touch(c.now())
      c.advance(16)
      expect(c.pending()).toBeLessThanOrEqual(1)
    }
    expect(onStale).not.toHaveBeenCalled()
    c.advance(300)
    expect(onStale).toHaveBeenCalledTimes(1)
  })

  it('schedules nothing while stale', () => {
    const c = fakeClock()
    const timer = createStaleTimer({ staleMs: 300, ...c, onStale: () => {} })
    timer.touch(c.now())
    c.advance(1000)
    expect(c.pending()).toBe(0)
  })

  it('cancel drops the pending check; dispose also ignores later touches', () => {
    const c = fakeClock()
    const onStale = vi.fn()
    const timer = createStaleTimer({ staleMs: 300, ...c, onStale })
    timer.touch(c.now())
    timer.cancel()
    expect(c.pending()).toBe(0)
    timer.touch(c.now())
    timer.dispose()
    timer.touch(c.now())
    expect(c.pending()).toBe(0)
    c.advance(1000)
    expect(onStale).not.toHaveBeenCalled()
  })
})

describe('useFreshness', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('follows a payload stream and expires on silence', () => {
    const scope = effectScope()
    const data = shallowRef<{ active: boolean } | null>(null)
    const f = scope.run(() => useFreshness(data, 500, (d) => d.active))!
    expect(f.fresh.value).toBe(false)
    data.value = { active: true }
    expect(f.fresh.value).toBe(true)
    vi.advanceTimersByTime(400)
    data.value = { active: true }
    vi.advanceTimersByTime(400)
    expect(f.fresh.value).toBe(true)
    vi.advanceTimersByTime(100)
    expect(f.fresh.value).toBe(false)
    scope.stop()
  })

  it('expires at once on an inactive or dropped payload', () => {
    const scope = effectScope()
    const data = shallowRef<{ active: boolean } | null>({ active: true })
    const f = scope.run(() => useFreshness(data, 500, (d) => d.active))!
    expect(f.fresh.value).toBe(true)
    data.value = { active: false }
    expect(f.fresh.value).toBe(false)
    data.value = { active: true }
    data.value = null
    expect(f.fresh.value).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    scope.stop()
  })

  it('leaves no timer behind when its scope stops', () => {
    const scope = effectScope()
    const data = shallowRef<number | null>(null)
    scope.run(() => useFreshness(data, 500))
    data.value = 1
    expect(vi.getTimerCount()).toBe(1)
    scope.stop()
    expect(vi.getTimerCount()).toBe(0)
    // The watcher is gone too: new payloads schedule nothing.
    data.value = 2
    expect(vi.getTimerCount()).toBe(0)
  })

  it('can be driven by hand', () => {
    const scope = effectScope()
    const f = scope.run(() => useFreshness(null, 200))!
    f.touch()
    expect(f.fresh.value).toBe(true)
    f.expire()
    expect(f.fresh.value).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    scope.stop()
  })
})
