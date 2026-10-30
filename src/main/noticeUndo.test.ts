import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { NOTICE_UNDO_MS, NoticeUndo } from './noticeUndo'

const es = messagesFor('es')

describe('NoticeUndo (R26, R51)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('undoes the kept action once, by its id or from the tray', () => {
    const changed = vi.fn()
    const slot = new NoticeUndo(changed)
    const undo = vi.fn()
    const id = slot.keep(() => 'Widgets traídos', undo)
    expect(slot.label(es)).toBe('Widgets traídos')
    expect(slot.run(id + 1)).toBe(false)
    expect(slot.run(id)).toBe(true)
    expect(undo).toHaveBeenCalledTimes(1)
    expect(slot.run(id)).toBe(false)
    expect(slot.label(es)).toBeNull()
    expect(changed).toHaveBeenCalledTimes(2)

    const again = vi.fn()
    slot.keep(() => 'x', again)
    expect(slot.run()).toBe(true)
    expect(again).toHaveBeenCalledTimes(1)
  })

  it('keeps only the latest one', () => {
    const slot = new NoticeUndo()
    const first = vi.fn()
    const a = slot.keep(() => 'a', first)
    const b = slot.keep(() => 'b', vi.fn())
    expect(slot.run(a)).toBe(false)
    expect(first).not.toHaveBeenCalled()
    expect(slot.run(b)).toBe(true)
  })

  it('goes with the first change after it when it says it no longer may (an import, R40)', () => {
    const changed = vi.fn()
    const slot = new NoticeUndo(changed)
    let untouched = true
    const undo = vi.fn()
    const id = slot.keep(
      () => 'Ajustes importados',
      undo,
      () => untouched
    )
    // Nothing since: it stays.
    slot.prune()
    expect(slot.label(es)).toBe('Ajustes importados')
    // A layout saved, a widget moved: undoing would lose it, so it goes (the tray too).
    untouched = false
    slot.prune()
    expect(slot.label(es)).toBeNull()
    expect(slot.run(id)).toBe(false)
    expect(undo).not.toHaveBeenCalled()
    expect(changed).toHaveBeenCalledTimes(2)
    // And if asked before any prune: nothing undone either.
    const again = vi.fn()
    let ok = true
    const b = slot.keep(
      () => 'x',
      again,
      () => ok
    )
    ok = false
    expect(slot.run(b)).toBe(false)
    expect(again).not.toHaveBeenCalled()
    expect(slot.label(es)).toBeNull()
  })

  it('goes after a minute, and says so', () => {
    const changed = vi.fn()
    const slot = new NoticeUndo(changed)
    const id = slot.keep(() => 'a', vi.fn())
    vi.advanceTimersByTime(NOTICE_UNDO_MS)
    expect(slot.label(es)).toBeNull()
    expect(slot.run(id)).toBe(false)
    expect(changed).toHaveBeenCalledTimes(2)
  })
})
