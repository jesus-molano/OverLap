import { describe, expect, it } from 'vitest'
import { arrayEqual, deepEqual, sameNumber } from './equal'

describe('sameNumber', () => {
  it('is === with NaN equal to itself', () => {
    expect(sameNumber(1, 1)).toBe(true)
    expect(sameNumber(0, -0)).toBe(true)
    expect(sameNumber(Number.NaN, Number.NaN)).toBe(true)
    expect(sameNumber(Number.NaN, 0)).toBe(false)
    expect(sameNumber(1, 2)).toBe(false)
  })
})

describe('deepEqual', () => {
  it('compares JSON-like data independent of key order', () => {
    expect(deepEqual({ a: 1, b: [1, { c: 'x' }] }, { b: [1, { c: 'x' }], a: 1 })).toBe(true)
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false)
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false)
    expect(deepEqual({ a: undefined }, { b: undefined })).toBe(false)
    expect(deepEqual([1, 2], [2, 1])).toBe(false)
    expect(deepEqual([1, 2], { 0: 1, 1: 2 })).toBe(false)
    expect(deepEqual(null, null)).toBe(true)
    expect(deepEqual(null, {})).toBe(false)
    expect(deepEqual('a', 'a')).toBe(true)
  })

  it('treats NaN as equal to NaN and 0 as equal to -0', () => {
    expect(deepEqual({ g: Number.NaN }, { g: Number.NaN })).toBe(true)
    expect(deepEqual([0], [-0])).toBe(true)
    expect(deepEqual(Number.NaN, 1)).toBe(false)
  })
})

describe('arrayEqual', () => {
  it('compares element-wise, NaN-safe by default', () => {
    expect(arrayEqual([1, Number.NaN], [1, Number.NaN])).toBe(true)
    expect(arrayEqual([1, 2], [1, 2, 3])).toBe(false)
    expect(arrayEqual(null, null)).toBe(true)
    expect(arrayEqual(null, [])).toBe(false)
    expect(arrayEqual([{ a: 1 }], [{ a: 1 }])).toBe(false)
    expect(arrayEqual([{ a: 1 }], [{ a: 1 }], deepEqual)).toBe(true)
  })
})
