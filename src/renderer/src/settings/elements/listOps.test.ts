import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { OPTION_SCHEMA, elements } from '@shared/settingsSchema'
import {
  blockedBy,
  defaults,
  dropIndex,
  isDefault,
  isRequired,
  keyAction,
  movedBy,
  movedMessage,
  movedTo,
  shownCount,
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
