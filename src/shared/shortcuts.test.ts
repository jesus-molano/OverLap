import { describe, expect, it } from 'vitest'
import { acceleratorText, keyLabel, keycaps, messagesFor } from './i18n'
import { OPTION_SCHEMA } from './settingsSchema'
import { DEFAULT_SETTINGS } from './settings'
import { SHORTCUT_ACTIONS, checkShortcut, isShortcutAction } from './shortcuts'

const defaults = DEFAULT_SETTINGS.shortcuts

describe('shortcut actions', () => {
  it('are the schema fields, in the same (priority) order', () => {
    expect(Object.keys(OPTION_SCHEMA.shortcuts)).toEqual([...SHORTCUT_ACTIONS])
    expect(SHORTCUT_ACTIONS).toEqual([
      'toggleOverlay',
      'toggleEditMode',
      'cycleDeltaReference',
      'nextLayout'
    ])
  })

  it('default to Ctrl+Shift+H (show / hide) and Ctrl+Shift+E (edit mode); no delta cycle', () => {
    expect(defaults).toEqual({
      toggleOverlay: 'Ctrl+Shift+H',
      toggleEditMode: 'Ctrl+Shift+E',
      cycleDeltaReference: '',
      nextLayout: ''
    })
  })

  it('recognises only known actions', () => {
    expect(isShortcutAction('toggleOverlay')).toBe(true)
    expect(isShortcutAction('toggleEditMode')).toBe(true)
    expect(isShortcutAction('cycleDeltaReference')).toBe(true)
    expect(isShortcutAction('quit')).toBe(false)
    expect(isShortcutAction(null)).toBe(false)
  })
})

describe('checkShortcut', () => {
  it('accepts a free, assignable combination in its canonical spelling', () => {
    expect(checkShortcut('toggleOverlay', 'ctrl+alt+shift+o', defaults)).toEqual({
      ok: true,
      accelerator: 'Ctrl+Alt+Shift+O'
    })
  })

  it('refuses the combination of another action and names it', () => {
    expect(checkShortcut('toggleOverlay', 'CommandOrControl+Shift+E', defaults)).toEqual({
      ok: false,
      accelerator: 'Ctrl+Shift+E',
      error: 'duplicate',
      conflict: 'toggleEditMode'
    })
  })

  it("accepts the action's own combination again", () => {
    expect(checkShortcut('toggleEditMode', 'Ctrl+Shift+E', defaults).ok).toBe(true)
  })

  it('always lets an action be turned off', () => {
    expect(checkShortcut('toggleEditMode', '', defaults)).toEqual({ ok: true, accelerator: '' })
  })

  it('passes on the accelerator check: errors and the AltGr warning', () => {
    expect(checkShortcut('toggleOverlay', 'Ctrl+C', defaults).error).toBe('reserved')
    expect(checkShortcut('toggleOverlay', 'Shift+H', defaults).error).toBe('needs-modifier')
    expect(checkShortcut('toggleOverlay', 'Ctrl+Alt+H', defaults)).toEqual({
      ok: true,
      accelerator: 'Ctrl+Alt+H',
      warning: 'altgr'
    })
  })

  it('does not count a turned-off action as having a combination', () => {
    const off = {
      toggleOverlay: '',
      toggleEditMode: 'Ctrl+Shift+E',
      cycleDeltaReference: '',
      nextLayout: ''
    }
    expect(checkShortcut('toggleOverlay', 'Ctrl+Shift+H', off).ok).toBe(true)
  })
})

describe('keycaps', () => {
  const es = messagesFor('es')
  const en = messagesFor('en')

  it('keeps Ctrl, Alt, Shift, letters, digits and F-keys in every language', () => {
    for (const m of [es, en]) {
      expect(keycaps(m, 'Ctrl+Alt+Shift+E')).toEqual(['Ctrl', 'Alt', 'Shift', 'E'])
      expect(acceleratorText(m, 'Ctrl+Shift+H')).toBe('Ctrl+Shift+H')
      expect(acceleratorText(m, 'Alt+7')).toBe('Alt+7')
      expect(acceleratorText(m, 'F13')).toBe('F13')
    }
  })

  it('prints the keys Spanish keyboards label differently', () => {
    expect(keyLabel(es, 'Space')).toBe('Espacio')
    expect(keyLabel(es, 'Delete')).toBe('Supr')
    expect(keyLabel(es, 'PageUp')).toBe('Re Pág')
    expect(keyLabel(es, 'PageDown')).toBe('Av Pág')
    expect(keyLabel(es, 'Home')).toBe('Inicio')
    expect(keyLabel(es, 'End')).toBe('Fin')
    expect(keyLabel(es, 'num5')).toBe('Num 5')
    expect(keyLabel(es, 'numadd')).toBe('Num +')
    expect(keyLabel(es, 'numdec')).toBe('Num .')
    expect(keyLabel(es, 'Up')).toBe('↑')
    expect(keyLabel(es, 'Left')).toBe('←')
    expect(acceleratorText(es, 'Ctrl+Alt+PageDown')).toBe('Ctrl+Alt+Av Pág')
  })

  it('prints them the English way in English', () => {
    expect(keyLabel(en, 'Space')).toBe('Space')
    expect(keyLabel(en, 'Delete')).toBe('Delete')
    expect(keyLabel(en, 'PageUp')).toBe('PgUp')
    expect(keyLabel(en, 'Home')).toBe('Home')
    expect(keyLabel(en, 'num0')).toBe('Num 0')
    expect(keyLabel(en, 'Right')).toBe('→')
    expect(keyLabel(en, 'Escape')).toBe('Esc')
    expect(acceleratorText(en, 'Ctrl+Shift+Insert')).toBe('Ctrl+Shift+Ins')
  })

  it('has nothing to show for a turned-off shortcut', () => {
    expect(keycaps(es, '')).toEqual([])
    expect(acceleratorText(es, '')).toBe('')
  })
})
