import { describe, expect, it } from 'vitest'
import { EDIT_KEYS } from '@shared/nudge'
import { forwardsEditKey } from './editKeys'

/** Edit mode's keys with the settings window in front (R38). */
describe('forwardsEditKey', () => {
  const calm = { aimed: false, undoShown: false }
  const aimed = { aimed: true, undoShown: false }

  it('passes the arrows on from free focus or a plain button, never from a control', () => {
    for (const key of ['Left', 'Shift+Up', 'Ctrl+Right', 'Ctrl+Shift+Down']) {
      expect(forwardsEditKey(key, 'free', calm), key).toBe(true)
      expect(forwardsEditKey(key, 'button', calm), key).toBe(true)
      expect(forwardsEditKey(key, 'control', aimed), key).toBe(false)
    }
  })

  it('passes Tab on only just after «Editar posición»: moving through the page stays yours', () => {
    expect(forwardsEditKey('Tab', 'free', aimed)).toBe(true)
    expect(forwardsEditKey('Shift+Tab', 'free', aimed)).toBe(true)
    expect(forwardsEditKey('Tab', 'free', calm)).toBe(false)
    expect(forwardsEditKey('Tab', 'button', aimed)).toBe(false)
  })

  it('leaves Ctrl+Z to this window’s «Deshacer» while one is shown', () => {
    expect(forwardsEditKey('Ctrl+Z', 'free', calm)).toBe(true)
    expect(forwardsEditKey('Ctrl+Z', 'button', calm)).toBe(true)
    expect(forwardsEditKey('Ctrl+Z', 'free', { aimed: true, undoShown: true })).toBe(false)
  })

  it('passes nothing but edit mode’s keys', () => {
    expect(forwardsEditKey('Ctrl+Shift+E', 'free', aimed)).toBe(false)
    expect(forwardsEditKey('Escape', 'free', aimed)).toBe(false)
    expect(forwardsEditKey('A', 'free', aimed)).toBe(false)
    // Every key of the banner has a way through.
    for (const key of EDIT_KEYS) expect(forwardsEditKey(key, 'free', aimed), key).toBe(true)
  })
})
