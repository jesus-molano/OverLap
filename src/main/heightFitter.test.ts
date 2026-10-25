import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Rect } from '@shared/types'
import { HeightFitter } from './heightFitter'
import { KeyedTimer } from './keyedTimer'
import { SHRINK_DELAY_MS, fitHeight } from './windowMath'

const WORK = { x: 0, y: 0, width: 1920, height: 1040 }

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('KeyedTimer', () => {
  it('keeps at most one timer per key; start does not restart, restart does', () => {
    const fired: string[] = []
    const t = new KeyedTimer<string>(100, (k) => fired.push(k))
    t.start('a')
    vi.advanceTimersByTime(60)
    t.start('a')
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
    t.start('a')
    t.start('b')
    t.cancel('a')
    expect(t.has('a')).toBe(false)
    t.flush()
    expect(fired).toEqual(['b'])
    expect(vi.getTimerCount()).toBe(0)
    t.start('c')
    t.dispose()
    vi.advanceTimersByTime(1_000)
    expect(fired).toEqual(['b'])
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('HeightFitter', () => {
  let rect: Rect
  let active: boolean
  let offscreen: boolean
  let applied: number[]

  function makeFitter(): HeightFitter<'w'> {
    return new HeightFitter<'w'>({
      active: () => active,
      offscreen: () => offscreen,
      target: (_id, desired) => fitHeight(rect, desired, 'top', WORK, 60),
      current: () => rect,
      apply: (_id, r) => {
        rect = r
        applied.push(r.height)
      }
    })
  }

  beforeEach(() => {
    rect = { x: 0, y: 100, width: 460, height: 300 }
    active = true
    offscreen = false
    applied = []
  })

  it('grows immediately', () => {
    const f = makeFitter()
    f.report('w', 420)
    expect(applied).toEqual([420])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('applies the first report at once in either direction (nothing to protect yet)', () => {
    const f = makeFitter()
    f.report('w', 250)
    expect(applied).toEqual([250])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('shrinks only after the content stayed smaller for the delay', () => {
    const f = makeFitter()
    f.report('w', 300) // already fitted
    f.report('w', 250)
    expect(applied).toEqual([])
    vi.advanceTimersByTime(SHRINK_DELAY_MS / 2)
    // Further shrinks do not push the deadline back.
    f.report('w', 240)
    vi.advanceTimersByTime(SHRINK_DELAY_MS / 2 - 1)
    expect(applied).toEqual([])
    vi.advanceTimersByTime(1)
    expect(applied).toEqual([240])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('shrinks at once a window that is not on screen', () => {
    offscreen = true
    const f = makeFitter()
    f.report('w', 250)
    expect(applied).toEqual([250])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a growth or a return to the current height cancels a pending shrink', () => {
    const f = makeFitter()
    f.report('w', 300) // already fitted
    f.report('w', 250)
    f.report('w', 300)
    expect(vi.getTimerCount()).toBe(0)
    f.report('w', 250)
    f.report('w', 350)
    expect(applied).toEqual([350])
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(SHRINK_DELAY_MS * 2)
    expect(applied).toEqual([350])
  })

  it('only remembers heights while inactive, and refit applies the latest one', () => {
    active = false
    const f = makeFitter()
    f.report('w', 500)
    f.report('w', 200)
    expect(applied).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
    active = true
    f.refit('w')
    expect(applied).toEqual([200])
  })

  it('auto height off then on: no jump to an old height, the next report fits at once', () => {
    const f = makeFitter()
    f.report('w', 400) // fitted to 400
    f.pause('w') // auto height turned off; the user may resize by hand
    rect = { ...rect, height: 470 }
    f.refit('w') // turned back on: nothing remembered, so nothing applied
    expect(applied).toEqual([400])
    f.report('w', 300) // smaller than the window, but the first report: at once
    expect(applied).toEqual([400, 300])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('pause, forget and dispose leave no timer behind', () => {
    const f = makeFitter()
    f.report('w', 300) // already fitted
    f.report('w', 250) // pending shrink
    f.pause('w')
    expect(vi.getTimerCount()).toBe(0)
    f.refit('w')
    expect(applied).toEqual([])

    f.report('w', 300)
    f.report('w', 100)
    f.forget('w')
    expect(vi.getTimerCount()).toBe(0)
    f.refit('w')
    expect(applied).toEqual([])

    f.report('w', 300)
    f.report('w', 120)
    f.dispose()
    vi.advanceTimersByTime(SHRINK_DELAY_MS * 2)
    expect(vi.getTimerCount()).toBe(0)
    expect(applied).toEqual([])
  })
})
