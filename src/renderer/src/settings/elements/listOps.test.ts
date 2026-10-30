import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { OPTION_SCHEMA, elements } from '@shared/settingsSchema'
import {
  blockedBy,
  boxBounds,
  boxPosition,
  defaults,
  dropIndex,
  isDefault,
  isRequired,
  keyAction,
  movedAcross,
  movedBy,
  movedMessage,
  movedTo,
  shownCount,
  sideMessage,
  sideOf,
  barRows,
  barStop,
  movedPast,
  placeOfSlot,
  placedAt,
  addedToSide,
  shownAtSideEnd,
  sides,
  toggled,
  visibilityMessage
} from './listOps'

type Id = 'a' | 'b' | 'c'
const SPEC = elements<Id>(['a', 'b', 'c'], { required: ['b'], hidden: ['c'] })
const FIXED = elements<Id>(['a', 'b', 'c'], { fixedOrder: true, parents: { c: 'a' } })
const ES = messagesFor('es')
const EN = messagesFor('en')

describe('toggles', () => {
  it('shows and hides, never hides a required element', () => {
    const list = defaults(SPEC)
    expect(toggled(SPEC, list, 'c', true).map((e) => e.visible)).toEqual([true, true, true])
    expect(toggled(SPEC, list, 'b', false)).toEqual(list)
    expect(toggled(SPEC, list, 'b', false)).not.toBe(list)
    expect(isRequired(SPEC, 'b')).toBe(true)
    expect(isRequired(SPEC, 'a')).toBe(false)
  })

  it('a child is blocked while its parent is hidden (the radar’s distances)', () => {
    const list = defaults(FIXED)
    expect(blockedBy(FIXED, list, 'c')).toBeNull()
    expect(blockedBy(FIXED, toggled(FIXED, list, 'a', false), 'c')).toBe('a')
    expect(blockedBy(FIXED, list, 'a')).toBeNull()
    expect(OPTION_SCHEMA.radar.parts.parents.rangeLabels).toBe('guides')
  })
})

describe('moves', () => {
  it('by places and to an index, clamped; never in a fixed order', () => {
    const list = defaults(SPEC)
    expect(movedBy(SPEC, list, 'a', 1).map((e) => e.id)).toEqual(['b', 'a', 'c'])
    expect(movedBy(SPEC, list, 'a', -3).map((e) => e.id)).toEqual(['a', 'b', 'c'])
    expect(movedTo(SPEC, list, 'c', 0).map((e) => e.id)).toEqual(['c', 'a', 'b'])
    expect(movedTo(SPEC, list, 'zz' as Id, 0)).toEqual(list)
    expect(movedBy(FIXED, defaults(FIXED), 'a', 1).map((e) => e.id)).toEqual(['a', 'b', 'c'])
  })

  it('dropIndex counts the other rows above the pointer', () => {
    const centres = [10, 30, 50, 70]
    expect(dropIndex(centres, 0, 5)).toBe(0)
    expect(dropIndex(centres, 0, 40)).toBe(1)
    expect(dropIndex(centres, 3, 60)).toBe(3)
    expect(dropIndex(centres, 1, 100)).toBe(3)
  })

  it('the keys on a handle: arrows by one, Home and End to the ends, nothing past them', () => {
    expect(keyAction('ArrowUp', 2, 4)).toEqual({ kind: 'by', delta: -1 })
    expect(keyAction('ArrowDown', 2, 4)).toEqual({ kind: 'by', delta: 1 })
    expect(keyAction('Home', 2, 4)).toEqual({ kind: 'to', index: 0 })
    expect(keyAction('End', 2, 4)).toEqual({ kind: 'to', index: 3 })
    expect(keyAction('ArrowUp', 0, 4)).toBeNull()
    expect(keyAction('End', 3, 4)).toBeNull()
    expect(keyAction('Enter', 1, 4)).toBeNull()
  })
})

describe('reset and counts', () => {
  it('defaults is a copy of the spec default; isDefault ignores nothing', () => {
    const d = defaults(SPEC)
    expect(d).toEqual(SPEC.default)
    expect(d[0]).not.toBe(SPEC.default[0])
    expect(isDefault(SPEC, d)).toBe(true)
    expect(isDefault(SPEC, movedBy(SPEC, d, 'a', 1))).toBe(false)
    expect(isDefault(SPEC, toggled(SPEC, d, 'c', true))).toBe(false)
    expect(shownCount(d)).toBe(2)
  })
})

describe('announcements', () => {
  it('say where a row went and what it shows, in each language', () => {
    expect(movedMessage(ES, 'iRating', 2, 8)).toBe('iRating: posición 3 de 8.')
    expect(movedMessage(EN, 'iRating', 0, 8)).toBe('iRating: position 1 of 8.')
    expect(visibilityMessage(ES, 'Goma', false)).toBe('Goma oculto.')
    expect(visibilityMessage(EN, 'Rubber', true)).toBe('Rubber shown.')
  })
})

describe('two sides of an info bar', () => {
  type B = 'x' | 'y' | 'split' | 'z' | 'w'
  const BAR = elements<B>(['x', 'y', 'split', 'z', 'w'], { required: ['split'], hidden: ['w'] })
  const ids = (l: readonly { id: string }[]): string[] => l.map((e) => e.id)

  it('puts what is before the marker on the left, what follows on the right, with indexes', () => {
    const { left, right } = sides(defaults(BAR), 'split')
    expect(left.map((r) => [r.entry.id, r.index])).toEqual([
      ['x', 0],
      ['y', 1]
    ])
    expect(right.map((r) => [r.entry.id, r.index])).toEqual([
      ['z', 3],
      ['w', 4]
    ])
    // Without the marker everything is on the left.
    const none = sides(defaults(SPEC), 'split' as Id)
    expect(none.left.length).toBe(3)
    expect(none.right).toEqual([])
  })

  it('says the side of an element', () => {
    const list = defaults(BAR)
    expect(sideOf(list, 'y', 'split')).toBe('left')
    expect(sideOf(list, 'z', 'split')).toBe('right')
  })

  it('moves an element over the marker to the nearest end of the other side', () => {
    const list = defaults(BAR)
    expect(ids(movedAcross(BAR, list, 'y', 'split'))).toEqual(['x', 'split', 'y', 'z', 'w'])
    expect(ids(movedAcross(BAR, list, 'x', 'split'))).toEqual(['y', 'split', 'x', 'z', 'w'])
    expect(ids(movedAcross(BAR, list, 'z', 'split'))).toEqual(['x', 'y', 'z', 'split', 'w'])
    expect(ids(movedAcross(BAR, list, 'w', 'split'))).toEqual(['x', 'y', 'w', 'split', 'z'])
    // Its visibility goes with it; the marker itself does not move.
    expect(movedAcross(BAR, list, 'w', 'split').find((e) => e.id === 'w')?.visible).toBe(false)
    expect(movedAcross(BAR, list, 'split', 'split')).toEqual(list)
    // There and back is where it was.
    const back = movedAcross(BAR, movedAcross(BAR, list, 'y', 'split'), 'y', 'split')
    expect(back).toEqual(list)
  })

  it('crosses the marker one step at a time with the arrows too', () => {
    const list = defaults(BAR)
    expect(sideOf(movedBy(BAR, list, 'y', 1), 'y', 'split')).toBe('right')
    expect(sideOf(movedBy(BAR, list, 'z', -1), 'z', 'split')).toBe('left')
  })

  it('announces the new side in each language', () => {
    expect(sideMessage(ES, 'Incidentes', 'right')).toBe('Incidentes: a la derecha.')
    expect(sideMessage(ES, 'SoF', 'left')).toBe('SoF: a la izquierda.')
    expect(sideMessage(EN, 'SoF', 'right')).toBe('SoF: on the right.')
  })

  it('keeps Home and End inside the box of the row', () => {
    // x, y | split | z, w: the left box is 0..1, the right one 3..4.
    const list = defaults(BAR)
    expect(boxBounds(list, 0, 'split')).toEqual({ first: 0, last: 1 })
    expect(boxBounds(list, 4, 'split')).toEqual({ first: 3, last: 4 })
    expect(boxBounds(list, 2, undefined)).toEqual({ first: 0, last: 4 })
    // End on the left's first row: to its last, never past the marker.
    expect(keyAction('End', 0, 5, boxBounds(list, 0, 'split'))).toEqual({ kind: 'to', index: 1 })
    expect(keyAction('End', 1, 5, boxBounds(list, 1, 'split'))).toBeNull()
    // Home on the right's first row stays put; on its last, to its first.
    expect(keyAction('Home', 3, 5, boxBounds(list, 3, 'split'))).toBeNull()
    expect(keyAction('Home', 4, 5, boxBounds(list, 4, 'split'))).toEqual({ kind: 'to', index: 3 })
    for (const [key, i] of [
      ['End', 0],
      ['Home', 4]
    ] as const) {
      const a = keyAction(key, i, 5, boxBounds(list, i, 'split'))
      if (a?.kind !== 'to') throw new Error(key)
      const id = list[i]?.id as B
      expect(sideOf(movedTo(BAR, list, id, a.index), id, 'split')).toBe(sideOf(list, id, 'split'))
    }
    // The arrows still cross the marker.
    expect(keyAction('ArrowDown', 1, 5, boxBounds(list, 1, 'split'))).toEqual({
      kind: 'by',
      delta: 1
    })
  })

  it('numbers a row within its box, as the box shows it', () => {
    const list = defaults(BAR)
    // w is hidden: it waits in the Ocultos group, not in the right box.
    expect(boxPosition(list, 'z', 'split')).toEqual({ index: 0, total: 1 })
    expect(boxPosition(list, 'y', 'split')).toEqual({ index: 1, total: 2 })
    const leftHidden = list.map((e) => (e.id === 'x' ? { ...e, visible: false } : e))
    expect(boxPosition(leftHidden, 'y', 'split')).toEqual({ index: 0, total: 1 })
    expect(boxPosition(list, 'z', undefined)).toEqual({ index: 3, total: 5 })
  })

  it('lands a drag on the other side through the marker slot (the right box heading)', () => {
    // Slots: x, y, [Derecha heading = split], z, w.
    const centres = [10, 60, 110, 160, 210]
    const list = defaults(BAR)
    const to = dropIndex(centres, 1, 170)
    expect(ids(movedTo(BAR, list, 'y', to))).toEqual(['x', 'split', 'z', 'y', 'w'])
    expect(sideOf(movedTo(BAR, list, 'z', dropIndex(centres, 3, 50)), 'z', 'split')).toBe('left')
  })
})

describe('places by neighbour, an info bar with its hidden items apart', () => {
  type B = 'a' | 'b' | 'split' | 'c' | 'd'
  const BAR = elements<B>(['a', 'b', 'split', 'c', 'd'], {})
  const L = (hidden: B[] = []): { id: B; visible: boolean }[] =>
    (['a', 'b', 'split', 'c', 'd'] as B[]).map((id) => ({ id, visible: !hidden.includes(id) }))
  const order = (l: readonly { id: string; visible: boolean }[]): string =>
    l.map((e) => (e.visible ? e.id : `(${e.id})`)).join(' ')

  it('puts an element just before or after a neighbour', () => {
    expect(order(placedAt(BAR, L(), 'd', { kind: 'before', id: 'a' }))).toBe('d a b split c')
    expect(order(placedAt(BAR, L(), 'a', { kind: 'after', id: 'c' }))).toBe('b split c a d')
    expect(order(placedAt(BAR, L(), 'a', { kind: 'after', id: 'a' }))).toBe('a b split c d')
    const fixed = placedAt(FIXED, defaults(FIXED), 'c', { kind: 'before', id: 'a' })
    expect(fixed.map((e) => e.id)).toEqual(['a', 'b', 'c'])
  })

  it('maps a drag slot among the rows drawn to a place', () => {
    expect(placeOfSlot(['a', 'b', 'c'], 'a', 0)).toEqual({ kind: 'before', id: 'b' })
    expect(placeOfSlot(['a', 'b', 'c'], 'a', 2)).toEqual({ kind: 'after', id: 'c' })
    expect(placeOfSlot(['a', 'b', 'c'], 'c', 1)).toEqual({ kind: 'before', id: 'b' })
    expect(placeOfSlot(['a'], 'a', 0)).toBeNull()
  })

  it('steps past the next shown row (or the marker), whatever is hidden between', () => {
    const l = L(['b', 'c'])
    const stop = barStop<B>('split')
    // 'a' down: past the marker (b is hidden): the start of the right side.
    expect(order(movedPast(BAR, l, 'a', 1, stop) ?? [])).toBe('(b) split a (c) d')
    // 'd' up: past the marker too (c is hidden): the end of the left side.
    expect(order(movedPast(BAR, l, 'd', -1, stop) ?? [])).toBe('a (b) d split (c)')
    expect(movedPast(BAR, l, 'a', -1, stop)).toBeNull()
    expect(movedPast(BAR, l, 'd', 1, stop)).toBeNull()
    expect(movedPast(FIXED, defaults(FIXED), 'a', 1, () => true)).toBeNull()
  })

  it('draws the shown items in their boxes and the hidden ones apart, with their side', () => {
    const rows = barRows(L(['b', 'd']), 'split')
    expect(rows.left.map((r) => r.entry.id)).toEqual(['a'])
    expect(rows.right.map((r) => r.entry.id)).toEqual(['c'])
    expect(rows.hidden.map((r) => [r.entry.id, r.side, r.index])).toEqual([
      ['b', 'left', 1],
      ['d', 'right', 4]
    ])
  })

  it('adds a hidden item to the side you pick, at its end (R33)', () => {
    const l = (['b', 'a', 'split', 'd', 'c'] as B[]).map((id) => ({
      id,
      visible: id !== 'b' && id !== 'd'
    }))
    expect(order(addedToSide(BAR, l, 'b', 'split', 'right'))).toBe('a split (d) c b')
    expect(order(addedToSide(BAR, l, 'd', 'split', 'left'))).toBe('(b) a d split c')
    expect(order(addedToSide(BAR, l, 'b', 'split', 'left'))).toBe('a b split (d) c')
  })

  it('shows a hidden item at the end of its side, the marker kept', () => {
    const l = (['b', 'a', 'split', 'd', 'c'] as B[]).map((id) => ({
      id,
      visible: id !== 'b' && id !== 'd'
    }))
    expect(order(shownAtSideEnd(BAR, l, 'b', 'split'))).toBe('a b split (d) c')
    expect(order(shownAtSideEnd(BAR, l, 'd', 'split'))).toBe('(b) a split c d')
    // No marker: shown where it is.
    const flat = elements<string>(['x', 'y'], {})
    const hiddenX = [
      { id: 'x', visible: false },
      { id: 'y', visible: true }
    ]
    expect(order(shownAtSideEnd(flat, hiddenX, 'x', 'split'))).toBe('x y')
  })
})
