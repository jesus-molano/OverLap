import { describe, expect, it } from 'vitest'
import { copyData } from './copy'

describe('copyData', () => {
  it('copies JSON-like data deeply, frozen parts unfrozen, primitives as they are', () => {
    const src = Object.freeze({ a: [1, { b: 'x' }], c: null, d: Object.freeze({ e: true }) })
    const out = copyData(src)
    expect(out).toEqual(src)
    expect(out).not.toBe(src)
    expect(out.a).not.toBe(src.a)
    expect(out.a[1]).not.toBe(src.a[1])
    expect(Object.isFrozen(out.d)).toBe(false)
    expect(copyData(3)).toBe(3)
    expect(copyData(null)).toBeNull()
  })
})
