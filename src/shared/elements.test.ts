import { describe, expect, it } from 'vitest'
import {
  copyElements,
  elementOrder,
  isElementVisible,
  moveElement,
  sameElements,
  sameOrder,
  setElementVisible,
  visibleCount,
  visibleIds
} from './elements'
import { normalizeElements } from './settings'
import { elements } from './settingsSchema'
import type { ElementEntry } from './types'

type Id = 'a' | 'b' | 'c' | 'd'
const LIST: ElementEntry<Id>[] = [
  { id: 'b', visible: true },
  { id: 'a', visible: false },
  { id: 'c', visible: true },
  { id: 'd', visible: true }
]

describe('reading a list', () => {
  it('isElementVisible: its entry; a missing id is hidden, a malformed list shows everything', () => {
    expect(isElementVisible(LIST, 'b')).toBe(true)
    expect(isElementVisible(LIST, 'a')).toBe(false)
    expect(isElementVisible(LIST.slice(0, 1), 'c')).toBe(false)
    expect(isElementVisible(undefined, 'a')).toBe(true)
    expect(isElementVisible('x' as unknown as ElementEntry<Id>[], 'a')).toBe(true)
  })

  it('visibleIds and elementOrder keep the order, each id once', () => {
    expect(visibleIds(LIST)).toEqual(['b', 'c', 'd'])
    expect(visibleIds(null, ['a', 'b'])).toEqual(['a', 'b'])
    expect(elementOrder([...LIST, { id: 'b', visible: false }])).toEqual(['b', 'a', 'c', 'd'])
    expect(visibleCount(LIST)).toBe(3)
  })
})

describe('changing a list', () => {
  it('setElementVisible copies every entry', () => {
    const out = setElementVisible(LIST, 'a', true)
    expect(out.map((e) => e.visible)).toEqual([true, true, true, true])
    expect(LIST[1]?.visible).toBe(false)
    expect(out[0]).not.toBe(LIST[0])
  })

  it('moveElement clamps both ends and always copies', () => {
    expect(moveElement(LIST, 0, 2).map((e) => e.id)).toEqual(['a', 'c', 'b', 'd'])
    expect(moveElement(LIST, 3, -5).map((e) => e.id)).toEqual(['d', 'b', 'a', 'c'])
    expect(moveElement(LIST, 1.7, 99).map((e) => e.id)).toEqual(['b', 'c', 'd', 'a'])
    const same = moveElement(LIST, 1, 1)
    expect(same).toEqual(LIST)
    expect(same).not.toBe(LIST)
    expect(moveElement(LIST, Number.NaN, 1)).toEqual(LIST)
    expect(moveElement([], 0, 1)).toEqual([])
  })

  it('compares orders and whole lists; copies', () => {
    expect(sameOrder(LIST, setElementVisible(LIST, 'a', true))).toBe(true)
    expect(sameElements(LIST, setElementVisible(LIST, 'a', true))).toBe(false)
    expect(sameOrder(LIST, moveElement(LIST, 0, 1))).toBe(false)
    expect(sameElements(LIST, copyElements(LIST))).toBe(true)
    expect(copyElements(LIST)[0]).not.toBe(LIST[0])
  })
})

describe('normalizeElements', () => {
  const spec = elements<Id>(['a', 'b', 'c', 'd'], { hidden: ['d'], required: ['c'] })

  it('keeps the given order and appends the missing ids hidden', () => {
    const out = normalizeElements(
      [
        { id: 'd', visible: true },
        { id: 'b', visible: false }
      ],
      spec.default,
      spec
    )
    expect(out).toEqual([
      { id: 'd', visible: true },
      { id: 'b', visible: false },
      { id: 'a', visible: false },
      // Required: shown whatever the file says.
      { id: 'c', visible: true }
    ])
  })

  it('drops duplicates (first wins), unknown ids and malformed entries; a bad flag keeps the default', () => {
    const out = normalizeElements(
      [
        { id: 'b', visible: false },
        { id: 'b', visible: true },
        { id: 'zz', visible: true },
        'a',
        null,
        { visible: true },
        { id: 'a', visible: 'yes' },
        { id: 'c', visible: false }
      ],
      spec.default,
      spec
    )
    expect(out).toEqual([
      { id: 'b', visible: false },
      { id: 'a', visible: true },
      { id: 'c', visible: true },
      { id: 'd', visible: false }
    ])
  })

  it('gives a copy of the fallback for a non-array or a list without one valid entry', () => {
    for (const raw of [undefined, null, 'a', {}, [], [{ id: 'nope' }], [7]]) {
      const out = normalizeElements(raw, spec.default, spec)
      expect(out).toEqual(spec.default)
      expect(out[0]).not.toBe(spec.default[0])
    }
  })

  it('sorts a fixed-order list by its ids, keeping each visibility', () => {
    const fixed = elements<Id>(['a', 'b', 'c', 'd'], { fixedOrder: true })
    const out = normalizeElements(
      [
        { id: 'c', visible: false },
        { id: 'a', visible: true }
      ],
      fixed.default,
      fixed
    )
    expect(out).toEqual([
      { id: 'a', visible: true },
      { id: 'b', visible: false },
      { id: 'c', visible: false },
      { id: 'd', visible: false }
    ])
  })

  it('shares no object with its inputs', () => {
    const raw = [{ id: 'a', visible: true }]
    const out = normalizeElements(raw, spec.default, spec)
    expect(out[0]).not.toBe(raw[0])
    expect(out.every((e) => !spec.default.includes(e))).toBe(true)
  })
})
