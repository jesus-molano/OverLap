import { describe, expect, it } from 'vitest'
import { WIDGET_IDS, WIDGET_LIST_ORDER } from './widgets'
import { NO_WIDGET_MORE, NO_WIDGET_SHORTCUTS } from './testing/shortcuts'
import { acceleratorText, keyLabel, keycaps, messagesFor } from './i18n'
import { OPTION_SCHEMA } from './settingsSchema'
import { DEFAULT_SETTINGS } from './settings'
import {
  MAX_BINDINGS,
  SHORTCUT_ACTIONS,
  checkShortcut,
  emptyMoreShortcuts,
  everyBinding,
  firstCombination,
  isShortcutAction,
  settleBindings,
  shortcutBindings,
  splitBindings,
  withBinding,
  type ShortcutSettings,
  WIDGET_SHORTCUT_ACTIONS,
  actionOfWidget,
  widgetOfAction
} from './shortcuts'

const defaults = DEFAULT_SETTINGS.shortcuts
/** Each action's bindings: the first ones of `first` alone. */
const only = (first: ShortcutSettings): ReturnType<typeof shortcutBindings> =>
  shortcutBindings(first)
const bindings = only(defaults)

describe('shortcut actions', () => {
  it('are the schema fields, in the same (priority) order', () => {
    expect(Object.keys(OPTION_SCHEMA.shortcuts)).toEqual([...SHORTCUT_ACTIONS])
    expect(SHORTCUT_ACTIONS).toEqual([
      'toggleOverlay',
      'toggleEditMode',
      'cycleDeltaReference',
      'nextLayout',
      'openSettings',
      // «Más acciones» (R52): after the main ones, one per widget in the sidebar's order.
      ...WIDGET_LIST_ORDER.map((id) => actionOfWidget(id))
    ])
  })

  it('gives every widget one «Más acciones» shortcut, unbound, and knows its widget (R52)', () => {
    expect(WIDGET_SHORTCUT_ACTIONS).toHaveLength(WIDGET_IDS.length)
    for (const id of WIDGET_IDS) {
      const action = actionOfWidget(id)
      expect(widgetOfAction(action)).toBe(id)
      expect(OPTION_SCHEMA.shortcuts[action].default).toBe('')
    }
    expect(widgetOfAction('toggleOverlay')).toBeNull()
    // A file that gives one the combination of a main action loses it: the main one keeps it.
    const settled = settleBindings({
      toggleOverlay: ['Ctrl+Shift+H'],
      toggleRelative: ['Ctrl+Shift+H', 'F14']
    })
    expect(settled.toggleOverlay).toEqual(['Ctrl+Shift+H'])
    expect(settled.toggleRelative).toEqual(['F14'])
  })

  it('default to Ctrl+Shift+H (show / hide), Ctrl+Shift+E (edit mode) and Ctrl+Shift+O (settings)', () => {
    expect(defaults).toEqual({
      toggleOverlay: 'Ctrl+Shift+H',
      toggleEditMode: 'Ctrl+Shift+E',
      cycleDeltaReference: '',
      nextLayout: '',
      openSettings: 'Ctrl+Shift+O',
      ...NO_WIDGET_SHORTCUTS
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
    expect(checkShortcut('toggleOverlay', 'ctrl+alt+shift+o', bindings)).toEqual({
      ok: true,
      accelerator: 'Ctrl+Alt+Shift+O'
    })
  })

  it('refuses the combination of another action and names it', () => {
    expect(checkShortcut('toggleOverlay', 'CommandOrControl+Shift+E', bindings)).toEqual({
      ok: false,
      accelerator: 'Ctrl+Shift+E',
      error: 'duplicate',
      conflict: 'toggleEditMode'
    })
  })

  it("accepts the action's own combination again in its own slot", () => {
    expect(checkShortcut('toggleEditMode', 'Ctrl+Shift+E', bindings, 0).ok).toBe(true)
  })

  it('refuses one more binding that the action already has in another slot', () => {
    // An addition (the next free slot by default).
    expect(checkShortcut('toggleEditMode', 'Ctrl+Shift+E', bindings)).toMatchObject({
      ok: false,
      error: 'duplicate',
      conflict: 'toggleEditMode'
    })
    const two = { ...bindings, toggleEditMode: ['Ctrl+Shift+E', 'F13'] }
    expect(checkShortcut('toggleEditMode', 'F13', two, 0)).toMatchObject({
      ok: false,
      conflict: 'toggleEditMode'
    })
    expect(checkShortcut('toggleEditMode', 'F13', two, 1).ok).toBe(true)
  })

  it('refuses a binding another action has in any of its slots', () => {
    const more = { ...bindings, toggleOverlay: ['Ctrl+Shift+H', 'joy:046d:c24f:0:24', 'F14'] }
    expect(checkShortcut('nextLayout', 'F14', more)).toMatchObject({
      ok: false,
      conflict: 'toggleOverlay'
    })
    expect(checkShortcut('nextLayout', 'joy:046d:c24f:0:24', more)).toMatchObject({
      ok: false,
      conflict: 'toggleOverlay'
    })
  })

  it('always lets a binding be removed', () => {
    expect(checkShortcut('toggleEditMode', '', bindings, 0)).toEqual({
      ok: true,
      accelerator: ''
    })
  })

  it('passes on the accelerator check: errors and the AltGr warning', () => {
    expect(checkShortcut('toggleOverlay', 'Ctrl+C', bindings).error).toBe('reserved')
    expect(checkShortcut('toggleOverlay', 'Shift+H', bindings).error).toBe('needs-modifier')
    expect(checkShortcut('toggleOverlay', 'Ctrl+Alt+H', bindings)).toEqual({
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
      nextLayout: '',
      openSettings: '',
      ...NO_WIDGET_SHORTCUTS
    }
    expect(checkShortcut('toggleOverlay', 'Ctrl+Shift+H', only(off)).ok).toBe(true)
  })
})

describe('several bindings per action', () => {
  const G29 = 'joy:046d:c24f:0'

  it('joins the first ones and the others, and splits them back', () => {
    const more = { ...emptyMoreShortcuts(), toggleOverlay: [`${G29}:24`, 'F13'] }
    const all = shortcutBindings(defaults, more)
    expect(all.toggleOverlay).toEqual(['Ctrl+Shift+H', `${G29}:24`, 'F13'])
    expect(all.cycleDeltaReference).toEqual([])
    expect(splitBindings(all)).toEqual({ shortcuts: defaults, more })
    expect(everyBinding(all)).toEqual([
      'Ctrl+Shift+H',
      `${G29}:24`,
      'F13',
      'Ctrl+Shift+E',
      'Ctrl+Shift+O'
    ])
  })

  it('settles anything into valid, canonical, unique lists of at most three', () => {
    expect(MAX_BINDINGS).toBe(3)
    const out = settleBindings({
      toggleOverlay: ['ctrl+shift+h', 'Shift+H', 7, '', `${G29}:24`, 'F13', 'F14'],
      // Repeats an earlier action's binding: the earlier one keeps it, the next one moves up.
      toggleEditMode: ['Ctrl+Shift+H', 'Ctrl+Shift+E', 'Ctrl+Shift+E'],
      nextLayout: [`${G29}:24`]
    })
    expect(out).toEqual({
      toggleOverlay: ['Ctrl+Shift+H', `${G29}:24`, 'F13'],
      toggleEditMode: ['Ctrl+Shift+E'],
      cycleDeltaReference: [],
      nextLayout: [],
      openSettings: [],
      ...NO_WIDGET_MORE()
    })
  })

  it('puts a binding in a slot, adds one after the last, and removes one (the next move up)', () => {
    const list = ['Ctrl+Shift+H', `${G29}:24`]
    expect(withBinding(list, 0, 'F13')).toEqual(['F13', `${G29}:24`])
    expect(withBinding(list, 2, 'F13')).toEqual(['Ctrl+Shift+H', `${G29}:24`, 'F13'])
    expect(withBinding(list, 0, '')).toEqual([`${G29}:24`])
    expect(withBinding(list, 5, '')).toEqual(list)
    // No fourth one.
    expect(withBinding([...list, 'F13'], 3, 'F14')).toEqual([...list, 'F13'])
  })

  it('finds the first key combination (what a menu can show)', () => {
    expect(firstCombination([`${G29}:24`, 'Ctrl+Shift+H'])).toBe('Ctrl+Shift+H')
    expect(firstCombination([`${G29}:24`])).toBe('')
    expect(firstCombination([])).toBe('')
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

describe('checkShortcut: controller buttons', () => {
  it('accepts a button no other action has, refuses a duplicate', () => {
    expect(checkShortcut('nextLayout', 'joy:046d:c24f:0:7', bindings)).toEqual({
      ok: true,
      accelerator: 'joy:046d:c24f:0:7'
    })
    expect(
      checkShortcut(
        'nextLayout',
        'joy:046d:c24f:0:7',
        only({ ...defaults, toggleOverlay: 'joy:046d:c24f:0:7' })
      )
    ).toMatchObject({ ok: false, error: 'duplicate', conflict: 'toggleOverlay' })
    // The same button on another controller is another binding.
    expect(
      checkShortcut(
        'nextLayout',
        'joy:046d:c24f:0:7',
        only({ ...defaults, toggleOverlay: 'joy:1dd2:2201:0:7' })
      ).ok
    ).toBe(true)
    expect(checkShortcut('nextLayout', 'joy:046d:c24f:0:0', bindings).ok).toBe(false)
  })
})
