import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import type { Rect } from '@shared/types'
import { EDIT_GATHER_MS, EDIT_HISTORY_MAX, EditHistory, editStepText } from './editHistory'

const rect = (x: number): Rect => ({ x, y: 0, width: 100, height: 50 })

describe('EditHistory (R38)', () => {
  it('puts back the last change first, then the one before', () => {
    const h = new EditHistory()
    h.record({ kind: 'rect', id: 'relative', rect: rect(1) }, 'drag', 0)
    h.record({ kind: 'scale', id: 'standings', scale: 100 }, 'scale', 10)
    expect(h.pop()).toEqual({ kind: 'scale', id: 'standings', scale: 100 })
    expect(h.pop()).toEqual({ kind: 'rect', id: 'relative', rect: rect(1) })
    expect(h.pop()).toBeUndefined()
  })

  it('takes a held arrow or a run of wheel steps on one widget as one change', () => {
    const h = new EditHistory()
    expect(h.record({ kind: 'rect', id: 'radar', rect: rect(1) }, 'nudge', 0)).toBe(true)
    expect(h.record({ kind: 'rect', id: 'radar', rect: rect(2) }, 'nudge', 100)).toBe(false)
    expect(h.record({ kind: 'rect', id: 'radar', rect: rect(3) }, 'nudge', 200)).toBe(false)
    // The place before the first press comes back.
    expect(h.peek()).toEqual({ kind: 'rect', id: 'radar', rect: rect(1) })
    // A pause, another widget or two drags are changes of their own.
    expect(
      h.record({ kind: 'rect', id: 'radar', rect: rect(4) }, 'nudge', 300 + EDIT_GATHER_MS)
    ).toBe(true)
    expect(h.record({ kind: 'rect', id: 'delta', rect: rect(5) }, 'nudge', 1)).toBe(true)
    h.record({ kind: 'rect', id: 'delta', rect: rect(6) }, 'drag', 2)
    expect(h.record({ kind: 'rect', id: 'delta', rect: rect(7) }, 'drag', 3)).toBe(true)
    expect(h.size).toBe(5)
  })

  it('keeps the last EDIT_HISTORY_MAX changes and forgets all of them on clear', () => {
    const h = new EditHistory()
    for (let i = 0; i < EDIT_HISTORY_MAX + 5; i++) {
      h.record({ kind: 'rect', id: 'relative', rect: rect(i) }, 'drag', i)
    }
    expect(h.size).toBe(EDIT_HISTORY_MAX)
    h.clear()
    expect(h.pop()).toBeUndefined()
  })
})

describe('editStepText', () => {
  it('says what comes back, in both languages', () => {
    const es = messagesFor('es')
    const en = messagesFor('en')
    expect(editStepText(es, { kind: 'rect', id: 'relative', rect: rect(0) })).toBe('mover Relativo')
    expect(editStepText(en, { kind: 'scale', id: 'standings', scale: 100 })).toBe(
      'change the scale of Standings'
    )
    expect(editStepText(es, { kind: 'toggle', id: 'radar', field: 'locked', value: false })).toBe(
      'bloquear Radar'
    )
  })

  it('tells a move from a resize by the place and size now', () => {
    const es = messagesFor('es')
    const en = messagesFor('en')
    const before = rect(0)
    const step = { kind: 'rect', id: 'relative', rect: before } as const
    const moved = { ...before, x: before.x + 20 }
    const wider = { ...before, x: before.x - 10, width: before.width + 10 }
    expect(editStepText(es, step, moved)).toBe('mover Relativo')
    expect(editStepText(es, step, wider)).toBe('cambiar el tamaño de Relativo')
    expect(editStepText(en, step, wider)).toBe('resize Relative')
  })

  it('says the way a toggle went: it kept the value before', () => {
    const es = messagesFor('es')
    const en = messagesFor('en')
    const shown = { kind: 'toggle', id: 'battle', field: 'visible', value: true } as const
    expect(editStepText(es, shown)).toBe('ocultar Batalla')
    expect(editStepText(es, { ...shown, value: false })).toBe('mostrar Batalla')
    expect(editStepText(en, shown)).toBe('hide Battle')
    const locked = { kind: 'toggle', id: 'radar', field: 'locked', value: true } as const
    expect(editStepText(es, locked)).toBe('desbloquear Radar')
    expect(editStepText(en, locked)).toBe('unlock Radar')
  })
})
