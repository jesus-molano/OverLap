import { describe, expect, it } from 'vitest'
import { deepEqual } from '@shared/equal'
import { reuseView, reuseViews, shallowEqual } from './reuse'

describe('shallowEqual', () => {
  it('compares own keys by identity', () => {
    const style = { a: '1' }
    expect(shallowEqual({ x: 1, s: style }, { x: 1, s: style })).toBe(true)
    expect(shallowEqual({ x: 1, s: style }, { x: 1, s: { a: '1' } })).toBe(false)
    expect(shallowEqual({ x: 1 }, { x: 1, y: 2 })).toBe(false)
    expect(shallowEqual({ x: undefined }, { y: undefined })).toBe(false)
  })
})

describe('reuseView', () => {
  it('keeps the previous object while equal', () => {
    const prev = { a: 1 }
    expect(reuseView(prev, { a: 1 })).toBe(prev)
    const next = { a: 2 }
    expect(reuseView(prev, next)).toBe(next)
  })

  it('handles the first run and null views', () => {
    const next = { a: 1 }
    expect(reuseView(undefined, next)).toBe(next)
    expect(reuseView<{ a: number } | null>(null, null)).toBeNull()
    expect(reuseView<{ a: number } | null>({ a: 1 }, null)).toBeNull()
    expect(reuseView<{ a: number } | null>(null, next)).toBe(next)
  })

  it('takes a custom equality for nested views', () => {
    const prev = { laps: [1, 2] }
    expect(reuseView(prev, { laps: [1, 2] })).not.toBe(prev)
    expect(reuseView(prev, { laps: [1, 2] }, deepEqual)).toBe(prev)
  })
})

describe('reuseViews', () => {
  it('returns prev itself when nothing changed', () => {
    const prev = [{ a: 1 }, { a: 2 }]
    expect(reuseViews(prev, [{ a: 1 }, { a: 2 }])).toBe(prev)
  })

  it('keeps unchanged slots and replaces changed ones', () => {
    const prev = [{ a: 1 }, { a: 2 }, { a: 3 }]
    const out = reuseViews(prev, [{ a: 1 }, { a: 9 }, { a: 3 }])
    expect(out).not.toBe(prev)
    expect(out[0]).toBe(prev[0])
    expect(out[1]).toEqual({ a: 9 })
    expect(out[2]).toBe(prev[2])
  })

  it('treats a length change as a change', () => {
    const prev = [{ a: 1 }]
    const out = reuseViews(prev, [{ a: 1 }, { a: 2 }])
    expect(out).not.toBe(prev)
    expect(out[0]).toBe(prev[0])
  })
})
