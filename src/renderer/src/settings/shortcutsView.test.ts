import { describe, expect, it } from 'vitest'
import { WIDGET_SHORTCUT_ACTIONS } from '@shared/shortcuts'
import { NO_WIDGET_SHORTCUTS, NO_WIDGET_STATUS } from '@shared/testing/shortcuts'
import { messagesFor } from '@shared/i18n'
import { DEFAULT_SETTINGS } from '@shared/settings'
import {
  shortcutBindings,
  type ShortcutAction,
  type ShortcutSettings,
  type ShortcutStatusReport
} from '@shared/shortcuts'
import {
  bindingsText,
  buttonBindingCount,
  editModeTooltip,
  focusAfter,
  refusalText,
  rowAnnouncement,
  rowCells,
  rowMessages,
  shortcutRows,
  sidebarKeys,
  type ShortcutRowView
} from './shortcutsView'

const es = messagesFor('es')
const en = messagesFor('en')
/** Each action's bindings: `first`'s, and `more` after them. */
const B = (
  first: ShortcutSettings,
  more: Partial<Record<ShortcutAction, string[]>> = {}
): ReturnType<typeof shortcutBindings> => shortcutBindings(first, more)
const defaults = B(DEFAULT_SETTINGS.shortcuts)
const custom: ShortcutSettings = {
  toggleOverlay: 'Ctrl+Alt+PageDown',
  toggleEditMode: '',
  cycleDeltaReference: 'Ctrl+Alt+D',
  nextLayout: '',
  openSettings: '',
  ...NO_WIDGET_SHORTCUTS
}
/** What main reports when `unavailable` (bindings) do not work; the per-action part unused. */
const report = (...unavailable: string[]): ShortcutStatusReport => ({
  actions: {
    toggleOverlay: 'ok',
    toggleEditMode: 'ok',
    cycleDeltaReference: 'ok',
    nextLayout: 'ok',
    openSettings: 'ok',
    ...NO_WIDGET_STATUS
  },
  unavailable
})
const OK = report()

function row(bindings: ReturnType<typeof B>, i: number): ShortcutRowView {
  const r = shortcutRows(es, bindings, null)[i]
  if (!r) throw new Error(`no row ${i}`)
  return r
}

describe('shortcutRows', () => {
  it('has one row per action, worded, with its bindings and what can be done', () => {
    const rows = shortcutRows(es, defaults, OK)
    expect(rows.map((r) => r.action)).toEqual([
      'toggleOverlay',
      'toggleEditMode',
      'cycleDeltaReference',
      'nextLayout',
      'openSettings',
      ...WIDGET_SHORTCUT_ACTIONS
    ])
    // «Más acciones» (R52): said with the widget's name, unbound, nothing to reset.
    expect(rows.find((r) => r.action === 'toggleRelative')).toMatchObject({
      label: 'Mostrar u ocultar Relativo',
      help: '',
      bindings: [],
      status: 'disabled',
      canReset: false
    })
    // The fold's help says what they do, once: no row repeats it.
    for (const a of WIDGET_SHORTCUT_ACTIONS) {
      expect(rows.find((r) => r.action === a)?.help).toBe('')
    }
    expect(rows[0]).toMatchObject({
      label: 'Mostrar u ocultar el overlay',
      bindings: [
        {
          accelerator: 'Ctrl+Shift+H',
          slot: 0,
          keys: ['Ctrl', 'Shift', 'H'],
          button: null,
          text: 'Ctrl+Shift+H',
          off: false
        }
      ],
      status: 'ok',
      badge: '',
      canAdd: true,
      canReset: false
    })
    expect(rows[1]?.label).toBe('Modo edición')
    // The delta's cycle comes without a combination: nothing to reset.
    expect(rows[2]).toMatchObject({
      label: 'Cambiar la referencia del delta',
      bindings: [],
      status: 'disabled',
      canAdd: true,
      canReset: false
    })
    // Given one, it is removed with its × (no factory combination to reset to).
    expect(row(B(custom), 2)).toMatchObject({ canReset: false })
  })

  it('offers a reset only away from the factory binding alone, and words the keys of the layout', () => {
    const r = row(B(custom), 0)
    expect(r.bindings[0]?.keys).toEqual(['Ctrl', 'Alt', 'Av Pág'])
    expect(r.canReset).toBe(true)
    expect(r.defaultAccelerator).toBe('Ctrl+Shift+H')
    expect(r.defaultKeys).toBe('Ctrl+Shift+H')
    // The factory one with another beside it: a reset removes the other.
    const more = row(B(DEFAULT_SETTINGS.shortcuts, { toggleOverlay: ['F13'] }), 0)
    expect(more.canReset).toBe(true)
  })

  it('shows up to three bindings side by side, in their slots, and no "add" with three', () => {
    const G29 = 'joy:046d:c24f:0'
    const three = B(DEFAULT_SETTINGS.shortcuts, { toggleOverlay: [`${G29}:24`, 'F13'] })
    const r = shortcutRows(es, three, OK, { [G29]: 'G29' })[0]
    expect(r?.bindings.map((b) => [b.slot, b.text])).toEqual([
      [0, 'Ctrl+Shift+H'],
      [1, 'Botón 24 · G29'],
      [2, 'F13']
    ])
    expect(r?.canAdd).toBe(false)
    expect(shortcutRows(es, three, OK)[1]?.canAdd).toBe(true)
  })

  it('badges a turned-off shortcut from the settings, whatever main last said', () => {
    const off = shortcutRows(es, B(custom), OK)[1]
    expect(off).toMatchObject({
      status: 'disabled',
      badge: 'Desactivado',
      bindings: [],
      canReset: true
    })
  })

  it('badges a combination another application holds, and marks its chip', () => {
    const taken = shortcutRows(en, defaults, report('Ctrl+Shift+H'))[0]
    expect(taken).toMatchObject({ status: 'unavailable', badge: 'Used by another app' })
    expect(taken?.bindings[0]?.off).toBe(true)
    expect(shortcutRows(es, defaults, report('Ctrl+Shift+H'))[0]?.badge).toBe(
      'En uso por otra aplicación'
    )
  })
})

describe('sidebarKeys', () => {
  it('lists edit mode, show / hide and Esc with their configured keys', () => {
    expect(sidebarKeys(es, defaults)).toEqual([
      { id: 'toggleEditMode', keys: 'Ctrl+Shift+E', label: 'modo edición', button: false },
      { id: 'toggleOverlay', keys: 'Ctrl+Shift+H', label: 'mostrar u ocultar', button: false },
      { id: 'exit', keys: 'Esc', label: 'salir de edición', button: false }
    ])
  })

  it('leaves a turned-off shortcut out', () => {
    expect(sidebarKeys(en, B(custom))).toEqual([
      { id: 'toggleOverlay', keys: 'Ctrl+Alt+PgDn', label: 'show or hide', button: false },
      { id: 'exit', keys: 'Esc', label: 'leave editing', button: false }
    ])
  })

  it('shows the first binding only (the sidebar is narrow)', () => {
    const more = B(DEFAULT_SETTINGS.shortcuts, { toggleEditMode: ['joy:046d:c24f:0:3'] })
    expect(sidebarKeys(es, more)[0]?.keys).toBe('Ctrl+Shift+E')
  })

  it('prefers a key combination to a button, and draws a button without its controller', () => {
    const G29 = 'joy:046d:c24f:0'
    const names = { [G29]: 'G29 Driving Force Racing Wheel' }
    const keyLater = B(
      { ...DEFAULT_SETTINGS.shortcuts, toggleOverlay: `${G29}:24` },
      { toggleOverlay: ['F13'] }
    )
    expect(sidebarKeys(es, keyLater, names)[1]).toEqual({
      id: 'toggleOverlay',
      keys: 'F13',
      label: 'mostrar u ocultar',
      button: false
    })
    const buttonsOnly = B({ ...DEFAULT_SETTINGS.shortcuts, toggleOverlay: `${G29}:24` })
    expect(sidebarKeys(es, buttonsOnly, names)[1]).toEqual({
      id: 'toggleOverlay',
      keys: 'Botón 24',
      label: 'mostrar u ocultar',
      button: true,
      title: 'Botón 24 · G29 Driving Force Racing Wheel'
    })
  })
})

describe('editModeTooltip', () => {
  it('names the configured shortcut, or none, and says this window frees the cursor', () => {
    expect(editModeTooltip(es, defaults)).toBe(
      'Mover y redimensionar los widgets (Ctrl+Shift+E). En el coche iRacing oculta el cursor: entra desde aquí, esta ventana lo libera'
    )
    expect(editModeTooltip(en, B({ ...DEFAULT_SETTINGS.shortcuts, toggleEditMode: 'F13' }))).toBe(
      'Move and resize the widgets (F13). In the car iRacing hides the cursor: start here, this window frees it'
    )
    expect(editModeTooltip(es, B(custom))).toBe(
      'Mover y redimensionar los widgets. En el coche iRacing oculta el cursor: entra desde aquí, esta ventana lo libera'
    )
  })

  it('names every binding, compactly, when there are several', () => {
    const more = B(DEFAULT_SETTINGS.shortcuts, { toggleEditMode: ['joy:046d:c24f:0:24'] })
    expect(editModeTooltip(es, more, { 'joy:046d:c24f:0': 'G29' })).toContain(
      '(Ctrl+Shift+E o Botón 24)'
    )
  })
})

describe('bindingsText', () => {
  const G29 = 'joy:046d:c24f:0'
  it('gives one binding in full, several without their controllers, none as nothing', () => {
    const names = { [G29]: 'G29' }
    expect(bindingsText(es, [`${G29}:7`], names)).toBe('Botón 7 de G29')
    expect(bindingsText(en, ['Ctrl+Shift+H', `${G29}:24`, 'F13'], names)).toBe(
      'Ctrl+Shift+H, Button 24 or F13'
    )
    expect(bindingsText(es, ['Ctrl+Alt+D', `${G29}:7`], names)).toBe('Ctrl+Alt+D o Botón 7')
    expect(bindingsText(es, [], names)).toBe('')
  })

  it('never uses the dot, which the sentences around it use between their parts', () => {
    const names = { [G29]: 'G29' }
    for (const lang of [es, en]) {
      expect(bindingsText(lang, [`${G29}:24`], names)).not.toContain('·')
      expect(bindingsText(lang, ['Ctrl+Shift+H', `${G29}:24`], names)).not.toContain('·')
      expect(bindingsText(lang, ['Ctrl+Shift+H', `${G29}:24`, 'F13'], names)).not.toContain('·')
    }
  })
})

describe('refusalText', () => {
  it('words every refusal, naming the action that has a duplicate', () => {
    expect(refusalText(es, 'duplicate', 'toggleEditMode')).toBe('Ya lo usa «Modo edición»')
    expect(refusalText(en, 'duplicate', 'toggleOverlay')).toBe(
      'Already used by “Show or hide the overlay”'
    )
    for (const error of [
      'invalid',
      'unsupported-key',
      'meta',
      'needs-modifier',
      'reserved'
    ] as const) {
      expect(refusalText(es, error, undefined).length, error).toBeGreaterThan(10)
      expect(refusalText(en, error, undefined)).not.toBe(refusalText(es, error, undefined))
    }
    expect(refusalText(es, 'needs-modifier', undefined)).toContain('F13–F24')
  })

  it('says so when the action itself already has it in another slot', () => {
    expect(refusalText(es, 'duplicate', 'toggleEditMode', undefined, 'toggleEditMode')).toBe(
      'Esta acción ya tiene esa combinación'
    )
    expect(refusalText(en, 'duplicate', 'nextLayout', 'Button 3 · G29', 'nextLayout')).toBe(
      'Button 3 · G29 is already a shortcut of this action'
    )
  })
})

describe('rowMessages and rowAnnouncement', () => {
  const overlay = row(defaults, 0)

  it('while recording: nothing drawn but a refusal or "press again", under the cell recorded', () => {
    // How to cancel is in the cell and the legend: only said to screen readers.
    expect(rowMessages(es, overlay, null, 0)).toEqual([])
    expect(rowAnnouncement(es, overlay, null, 0)).toBe('Esc cancela · Retroceso o Supr lo quitan')
    expect(rowAnnouncement(es, overlay, null, 1)).toBe('Esc cancela')
    // A button from a controller's first report: asked for again.
    expect(rowMessages(es, overlay, { action: 'toggleOverlay', kind: 'again' }, 1)).toEqual([
      { text: 'Mando detectado: pulsa el botón otra vez', tone: 'info', slot: 1 }
    ])
    const refused = { action: 'toggleOverlay', kind: 'refused', error: 'reserved' } as const
    expect(rowMessages(es, overlay, refused, 2)).toEqual([
      { text: 'Windows o los programas ya usan esa combinación', tone: 'error', slot: 2 }
    ])
  })

  it('after saving: the cell shows it (said, not drawn); the AltGr warning under its cell', () => {
    const altgr = row(
      B(
        { ...DEFAULT_SETTINGS.shortcuts, toggleOverlay: 'Ctrl+Shift+H' },
        { toggleOverlay: ['Ctrl+Alt+H'] }
      ),
      0
    )
    const saved = {
      action: 'toggleOverlay',
      kind: 'saved',
      accelerator: 'Ctrl+Alt+H',
      warning: 'altgr',
      slot: 1
    } as const
    expect(rowMessages(es, altgr, saved, null)).toEqual([
      { text: es.settings.shortcuts.warnings.altgr, tone: 'warn', slot: 1 }
    ])
    expect(rowAnnouncement(es, altgr, saved, null)).toBe(
      `Guardado: Ctrl+Alt+H. ${es.settings.shortcuts.warnings.altgr}`
    )
  })

  it('after removing: said, not drawn', () => {
    const off = shortcutRows(en, B({ ...DEFAULT_SETTINGS.shortcuts, toggleOverlay: '' }), null)[0]
    const removed = { action: 'toggleOverlay', kind: 'removed', accelerator: 'F13' } as const
    expect(rowMessages(en, off as ShortcutRowView, removed, null)).toEqual([])
    expect(rowAnnouncement(en, off as ShortcutRowView, removed, null)).toBe(
      'Off: this action has no shortcut now'
    )
    expect(rowAnnouncement(es, overlay, removed, null)).toBe('Quitado: F13')
  })

  it('drops a "saved" or "removed" the bindings no longer match (reset elsewhere)', () => {
    const saved = { action: 'toggleOverlay', kind: 'saved', accelerator: 'Ctrl+Alt+H' } as const
    expect(rowAnnouncement(es, overlay, saved, null)).toBe('')
    const removed = {
      action: 'toggleOverlay',
      kind: 'removed',
      accelerator: 'Ctrl+Shift+H'
    } as const
    expect(rowAnnouncement(es, overlay, removed, null)).toBe('')
  })

  it("ignores another row's feedback, and explains a combination another app holds under it", () => {
    const fb = { action: 'toggleEditMode', kind: 'removed', accelerator: 'F13' } as const
    expect(rowMessages(es, overlay, fb, null)).toEqual([])
    expect(rowAnnouncement(es, overlay, fb, null)).toBe('')
    const taken = shortcutRows(
      es,
      B(DEFAULT_SETTINGS.shortcuts, { toggleOverlay: ['F13', 'Ctrl+Alt+K'] }),
      report('Ctrl+Alt+K')
    )[0] as ShortcutRowView
    expect(rowMessages(es, taken, null, null)).toEqual([
      { text: es.settings.shortcuts.unavailableHelp, tone: 'warn', slot: 2 }
    ])
  })
})

describe('rowCells', () => {
  it('gives every row three cells: its bindings, "assign" in the first empty one, then "—"', () => {
    const one = row(defaults, 0)
    expect(rowCells(one, null).map((c) => c.kind)).toEqual(['binding', 'assign', 'empty'])
    const none = row(defaults, 2)
    expect(rowCells(none, null).map((c) => c.kind)).toEqual(['assign', 'empty', 'empty'])
    const three = row(B(DEFAULT_SETTINGS.shortcuts, { toggleOverlay: ['F13', 'F14'] }), 0)
    expect(rowCells(three, null).map((c) => c.kind)).toEqual(['binding', 'binding', 'binding'])
  })

  it('marks the cell recorded, over a binding or in the first empty one', () => {
    const one = row(defaults, 0)
    const over = rowCells(one, 0)
    expect(over.map((c) => c.kind)).toEqual(['recording', 'assign', 'empty'])
    expect(over[0]).toMatchObject({ kind: 'recording', binding: { accelerator: 'Ctrl+Shift+H' } })
    expect(rowCells(one, 1).map((c) => c.kind)).toEqual(['binding', 'recording', 'empty'])
    expect(rowCells(one, 1)[1]).toMatchObject({ binding: null })
    expect(rowCells(one, null).map((c) => c.slot)).toEqual([0, 1, 2])
  })
})

describe('controller buttons', () => {
  const G29 = 'joy:046d:c24f:0'
  const BOX = 'joy:1dd2:2201:0'
  const withButton = B({ ...DEFAULT_SETTINGS.shortcuts, toggleOverlay: `${G29}:12` })
  const names = { [G29]: 'G29 Driving Force Racing Wheel' }

  it('shows a button and its controller instead of keycaps', () => {
    const [r] = shortcutRows(es, withButton, OK, names)
    expect(r).toMatchObject({
      bindings: [
        {
          accelerator: `${G29}:12`,
          keys: [],
          button: { button: 'Botón 12', device: 'G29 Driving Force Racing Wheel' },
          off: false
        }
      ],
      status: 'ok',
      badge: '',
      canReset: true
    })
    expect(shortcutRows(en, withButton, OK, names)[0]?.bindings[0]?.button?.button).toBe(
      'Button 12'
    )
    // A combination has none.
    expect(shortcutRows(es, defaults, OK, names)[0]?.bindings[0]?.button).toBeNull()
  })

  it('names a controller it never saw by its ids', () => {
    expect(shortcutRows(es, withButton, OK)[0]?.bindings[0]?.button?.device).toBe(
      'VID 046D PID C24F'
    )
  })

  it('tells two controllers with the same name apart', () => {
    const twins = { 'joy:1dd2:2201:0': 'BU0836X Interface', 'joy:1dd2:2202:0': 'BU0836X Interface' }
    const rows = shortcutRows(
      es,
      B({
        ...DEFAULT_SETTINGS.shortcuts,
        toggleOverlay: 'joy:1dd2:2201:0:4',
        nextLayout: 'joy:1dd2:2202:0:4'
      }),
      OK,
      twins
    )
    expect(rows[0]?.bindings[0]?.button?.device).toBe('BU0836X Interface (1dd2:2201)')
    expect(rows[3]?.bindings[0]?.button?.device).toBe('BU0836X Interface (1dd2:2202)')
  })

  it('says "Desconectado" when the controller is unplugged, and keeps the binding', () => {
    const r = shortcutRows(es, withButton, report(`${G29}:12`), names)[0]
    if (!r) throw new Error('no row')
    expect(r).toMatchObject({ status: 'unavailable', badge: 'Desconectado' })
    expect(r.bindings[0]).toMatchObject({ accelerator: `${G29}:12`, off: true })
    // The cell says "Desconectado" (only its icon when narrow): what it means, under it (R58).
    expect(rowMessages(es, r, null, null)).toEqual([
      { text: es.settings.shortcuts.disconnectedHelp, tone: 'warn', slot: 0 }
    ])
    expect(rowAnnouncement(es, r, null, null, names)).toBe(es.settings.shortcuts.disconnectedHelp)
  })

  it('marks only the binding that does not work among several', () => {
    const three = B(DEFAULT_SETTINGS.shortcuts, { toggleOverlay: [`${G29}:24`, `${BOX}:3`] })
    const r = shortcutRows(es, three, report(`${BOX}:3`), names)[0]
    if (!r) throw new Error('no row')
    expect(r.bindings.map((b) => b.off)).toEqual([false, false, true])
    expect(r).toMatchObject({ status: 'unavailable', badge: 'Desconectado' })
    // A refused combination and an unplugged button: both explained, the badge the general one.
    const both = shortcutRows(es, three, report('Ctrl+Shift+H', `${BOX}:3`), names)[0]
    if (!both) throw new Error('no row')
    expect(both.badge).toBe('En uso por otra aplicación')
    expect(rowMessages(es, both, null, null)).toEqual([
      { text: es.settings.shortcuts.disconnectedHelp, tone: 'warn', slot: 2 },
      { text: es.settings.shortcuts.unavailableHelp, tone: 'warn', slot: 0 }
    ])
    expect(rowAnnouncement(es, both, null, null, names)).toBe(
      `${es.settings.shortcuts.disconnectedHelp}. ${es.settings.shortcuts.unavailableHelp}`
    )
  })

  it('words a saved button with its controller', () => {
    const r = shortcutRows(es, withButton, OK, names)[0]
    if (!r) throw new Error('no row')
    expect(
      rowAnnouncement(
        es,
        r,
        { action: 'toggleOverlay', kind: 'saved', accelerator: `${G29}:12` },
        null,
        names
      )
    ).toBe('Guardado: Botón 12 · G29 Driving Force Racing Wheel')
  })

  it('shows the button and its controller in the sidebar keys and the edit-mode tooltip', () => {
    const s = B({ ...DEFAULT_SETTINGS.shortcuts, toggleEditMode: `${G29}:3` })
    expect(sidebarKeys(es, s, names)[0]).toEqual({
      id: 'toggleEditMode',
      keys: 'Botón 3',
      label: 'modo edición',
      button: true,
      title: 'Botón 3 · G29 Driving Force Racing Wheel'
    })
    expect(editModeTooltip(es, s, names)).toContain('(Botón 3 de G29 Driving Force Racing Wheel)')
    // Its name not known yet: its ids.
    expect(sidebarKeys(es, s)[0]?.title).toBe('Botón 3 · VID 046D PID C24F')
  })

  it('names the button pressed when another action has it', () => {
    const r = shortcutRows(es, withButton, OK, names)[1]
    if (!r) throw new Error('no row')
    const refused = {
      action: r.action,
      kind: 'refused',
      error: 'duplicate',
      conflict: 'toggleOverlay',
      button: `${G29}:12`
    } as const
    // Drawn under the cell without the controller; said in full.
    expect(rowMessages(es, r, refused, 1)).toEqual([
      { text: 'Botón 12 ya lo usa «Mostrar u ocultar el overlay»', tone: 'error', slot: 1 }
    ])
    expect(rowAnnouncement(es, r, refused, 1, names)).toBe(
      'Botón 12 · G29 Driving Force Racing Wheel ya lo usa «Mostrar u ocultar el overlay»'
    )
    expect(refusalText(en, 'duplicate', 'toggleOverlay', 'Button 12 · G29')).toBe(
      'Button 12 · G29 is already used by “Show or hide the overlay”'
    )
  })

  it('counts every button binding (the reset removes them), extra ones too', () => {
    expect(buttonBindingCount(defaults)).toBe(0)
    expect(
      buttonBindingCount(
        B(
          { ...DEFAULT_SETTINGS.shortcuts, toggleOverlay: `${G29}:12`, nextLayout: `${G29}:4` },
          { toggleEditMode: [`${BOX}:1`] }
        )
      )
    ).toBe(3)
  })
})

describe('focusAfter', () => {
  const rowOf = (more: string[]): ShortcutRowView => {
    const r = shortcutRows(es, B(DEFAULT_SETTINGS.shortcuts, { toggleOverlay: more }), null)[0]
    if (!r) throw new Error('no row')
    return r
  }

  it('goes to the chip now in the slot changed, else "add", else the last chip', () => {
    const removed = (slot: number) =>
      ({ action: 'toggleOverlay', kind: 'removed', accelerator: 'X', slot }) as const
    // The first of three removed: the one that moved up.
    expect(focusAfter(removed(0), rowOf(['F13']))).toEqual({ slot: 0 })
    // The last one removed: "add".
    expect(focusAfter(removed(2), rowOf(['F13']))).toBe('add')
    // A third one added: the row is full and "add" gone, so the new chip.
    const saved = { action: 'toggleOverlay', kind: 'saved', accelerator: 'F14', slot: 2 } as const
    expect(focusAfter(saved, rowOf(['F13', 'F14']))).toEqual({ slot: 2 })
  })

  it('does nothing for another row, a refusal or no feedback', () => {
    const row = rowOf([])
    expect(focusAfter(null, row)).toBeNull()
    const other = { action: 'nextLayout', kind: 'removed', accelerator: 'F13', slot: 0 } as const
    expect(focusAfter(other, row)).toBeNull()
    const refused = { action: 'toggleOverlay', kind: 'refused', error: 'invalid' } as const
    expect(focusAfter(refused, row)).toBeNull()
  })
})
