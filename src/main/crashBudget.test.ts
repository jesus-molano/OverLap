import { describe, expect, it } from 'vitest'
import { CRASH_WINDOW_MS, CrashBudget, MAX_CRASHES } from './crashBudget'

describe('CrashBudget', () => {
  it('allows MAX_CRASHES within the window and gives up on the next one', () => {
    const b = new CrashBudget<number>()
    for (let n = 0; n < MAX_CRASHES; n++) expect(b.record(1, n * 1_000)).toBe(true)
    expect(b.record(1, 10_000)).toBe(false)
    // Another key has its own budget.
    expect(b.record(2, 10_000)).toBe(true)
  })

  it('forgets crashes older than the window', () => {
    const b = new CrashBudget<number>(2, 1_000)
    expect(b.record(1, 0)).toBe(true)
    expect(b.record(1, 500)).toBe(true)
    expect(b.record(1, 999)).toBe(false)
    expect(b.record(1, 2_000)).toBe(true)
    expect(CRASH_WINDOW_MS).toBe(60_000)
  })

  it('reset and clear start over', () => {
    const b = new CrashBudget<string>(1, 1_000)
    b.record('a', 0)
    b.record('b', 0)
    b.reset('a')
    expect(b.record('a', 1)).toBe(true)
    expect(b.record('b', 1)).toBe(false)
    b.clear()
    expect(b.record('b', 2)).toBe(true)
  })
})
