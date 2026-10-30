/**
 * A list drawn inside another list's element (Pedales' «Coche», Delta's lap times): while that
 * parent is hidden the list says so, and showing one of its elements shows the parent too; hiding
 * or reordering never does. The settings are a stand-in ref; the setters record what they get.
 */
import { describe, expect, it, vi } from 'vitest'
import { computed, shallowRef } from 'vue'
import { messagesFor } from '@shared/i18n'
import type { ElementEntry } from '@shared/types'

vi.mock('../../composables/useI18n', () => ({ useI18n: () => computed(() => messagesFor('es')) }))

const { showsMore, useParentGate } = await import('./parentGate')

type E = ElementEntry<string>
const list = (spec: string): E[] =>
  spec.split(' ').map((s) => ({ id: s.replace(/[()]/g, ''), visible: !s.startsWith('(') }))

function gate(
  parents: string,
  items: string
): {
  g: ReturnType<typeof useParentGate<string, string>>
  sentParents: E[][]
  sentItems: E[][]
} {
  const p = shallowRef(list(parents))
  const i = shallowRef(list(items))
  const sentParents: E[][] = []
  const sentItems: E[][] = []
  const g = useParentGate<string, string>({
    parents: () => p.value,
    parent: 'car',
    setParents: (next) => {
      sentParents.push(next)
      p.value = next
      return Promise.resolve()
    },
    items: () => i.value,
    set: (next) => {
      sentItems.push(next)
      i.value = next
      return Promise.resolve()
    },
    parentLabel: () => 'Coche',
    zoneLabel: () => 'Bloques'
  })
  return { g, sentParents, sentItems }
}

describe('showsMore', () => {
  it('is true only when the change shows an element that was hidden', () => {
    expect(showsMore(list('a (b)'), list('a b'))).toBe(true)
    expect(showsMore(list('a b'), list('a (b)'))).toBe(false)
    expect(showsMore(list('a b'), list('b a'))).toBe(false)
    expect(showsMore(list('(a) (b)'), list('(a) (b)'))).toBe(false)
  })
})

describe('useParentGate', () => {
  it('says the parent is hidden, in the same words on every page', () => {
    expect(gate('trace (car)', 'rpm bias').g.note.value).toBe(
      '«Coche» no se ve (su ojo en «Bloques» está cerrado): al mostrar aquí un elemento, vuelve a verse'
    )
    expect(gate('trace car', 'rpm bias').g.note.value).toBeUndefined()
  })

  it('shows the parent when an element is shown while it is hidden', async () => {
    const { g, sentParents, sentItems } = gate('trace (car)', 'rpm (bias)')
    await g.apply(list('rpm bias'))
    expect(sentItems).toEqual([list('rpm bias')])
    expect(sentParents).toEqual([list('trace car')])
    expect(g.note.value).toBeUndefined()
  })

  it('leaves the parent alone on a hide, a move, or while it is shown', async () => {
    const hidden = gate('trace (car)', 'rpm bias')
    await hidden.g.apply(list('rpm (bias)'))
    await hidden.g.apply(list('(bias) rpm'))
    expect(hidden.sentParents).toEqual([])
    const shown = gate('trace car', 'rpm (bias)')
    await shown.g.apply(list('rpm bias'))
    expect(shown.sentParents).toEqual([])
  })
})
