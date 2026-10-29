import { describe, expect, it } from 'vitest'
import { orderStyle, placesOf } from './orderStyle'

describe('orderStyle / placesOf', () => {
  it('places count from 1, so a part outside the list (a header) stays first', () => {
    expect(orderStyle(0)).toEqual({ order: '1' })
    expect(orderStyle(3)).toEqual({ order: '4' })
    expect(orderStyle(-1)).toEqual({ order: '1' })
    expect(orderStyle(Number.NaN)).toEqual({ order: '1' })
  })

  it('the same frozen object per place: v-inline-style writes nothing while it stays', () => {
    expect(orderStyle(2)).toBe(orderStyle(2))
    expect(Object.isFrozen(orderStyle(2))).toBe(true)
  })

  it('each id at its index', () => {
    expect(placesOf(['laps', 'top', 'bar'])).toEqual({ laps: 0, top: 1, bar: 2 })
    expect(placesOf([])).toEqual({})
  })
})
