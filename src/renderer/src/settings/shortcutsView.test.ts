import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { DEFAULT_SETTINGS } from '@shared/settings'
import type { ShortcutSettings } from '@shared/shortcuts'
import {
  buttonBindingCount,
  editModeTooltip,
  refusalText,
  rowMessages,
  shortcutRows,
  sidebarKeys,
  type ShortcutRowView
} from './shortcutsView'

const es = messagesFor('es')
const en = messagesFor('en')
const defaults = DEFAULT_SETTINGS.shortcuts
const custom: ShortcutSettings = {
  toggleOverlay: 'Ctrl+Alt+PageDown',
  toggleEditMode: '',
  cycleDeltaReference: 'Ctrl+Alt+D',
  nextLayout: '',
  openSettings: ''
}
const OK = {
  toggleOverlay: 'ok',
  toggleEditMode: 'ok',
  cycleDeltaReference: 'ok',
  nextLayout: 'ok',
  openSettings: 'ok'
} as const

function row(shortcuts: ShortcutSettings, i: number): ShortcutRowView {
  const r = shortcutRows(es, shortcuts, null)[i]
  if (!r) throw new Error(`no row ${i}`)
  return r
}

describe('shortcutRows', () => {
  it('has one row per action, worded, with its keycaps and what can be done', () => {
    const rows = shortcutRows(es, defaults, OK)
    expect(rows.map((r) => r.action)).toEqual([
      'toggleOverlay',
      'toggleEditMode',
      'cycleDeltaReference',
      'nextLayout',
      'openSettings'
    ])
    expect(rows[0]).toMatchObject({
      label: 'Mostrar u ocultar el overlay',
      accelerator: 'Ctrl+Shift+H',
      keys: ['Ctrl', 'Shift', 'H'],
      status: 'ok',
      badge: '',
      canDisable: true,
      canReset: false
    })
    expect(rows[1]?.label).toBe('Modo edición')
    // The delta's cycle comes without a combination: nothing to turn off or reset.
    expect(rows[2]).toMatchObject({
      label: 'Cambiar la referencia del delta',
      accelerator: '',
      status: 'disabled',
      canDisable: false,
      canReset: false
    })
    // Given one, it is turned off (no factory combination to reset to).
    expect(row(custom, 2)).toMatchObject({ canDisable: true, canReset: false })
  })

  it('offers a reset only away from the default, and words the keys of the layout', () => {
    const r = row(custom, 0)
    expect(r.keys).toEqual(['Ctrl', 'Alt', 'Av Pág'])
    expect(r.canReset).toBe(true)
    expect(r.defaultAccelerator).toBe('Ctrl+Shift+H')
    expect(r.defaultKeys).toBe('Ctrl+Shift+H')
  })

  it('badges a turned-off shortcut from the settings, whatever main last said', () => {
    const off = shortcutRows(es, custom, OK)[1]
    expect(off).toMatchObject({
      status: 'disabled',
      badge: 'Desactivado',
      keys: [],
      canDisable: false,
      canReset: true
    })
  })

  it('badges a combination another application holds', () => {
    const taken = shortcutRows(en, defaults, { ...OK, toggleOverlay: 'unavailable' })[0]
    expect(taken).toMatchObject({ status: 'unavailable', badge: 'Used by another app' })
    expect(shortcutRows(es, defaults, { ...OK, toggleOverlay: 'unavailable' })[0]?.badge).toBe(
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
    expect(sidebarKeys(en, custom)).toEqual([
      { id: 'toggleOverlay', keys: 'Ctrl+Alt+PgDn', label: 'show or hide', button: false },
      { id: 'exit', keys: 'Esc', label: 'leave editing', button: false }
    ])
  })
})

describe('editModeTooltip', () => {
  it('names the configured shortcut, or none, and says this window frees the cursor', () => {
    expect(editModeTooltip(es, defaults)).toBe(
      'Mover y redimensionar los widgets (Ctrl+Shift+E). En el coche iRacing oculta el cursor: entra desde aquí, esta ventana lo libera'
    )
    expect(editModeTooltip(en, { ...defaults, toggleEditMode: 'F13' })).toBe(
      'Move and resize the widgets (F13). In the car iRacing hides the cursor: start here, this window frees it'
    )
    expect(editModeTooltip(es, custom)).toBe(
      'Mover y redimensionar los widgets. En el coche iRacing oculta el cursor: entra desde aquí, esta ventana lo libera'
    )
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
})

describe('rowMessages', () => {
  const overlay = row(defaults, 0)

  it('while recording: how to turn it off, or why the last combination was refused', () => {
    expect(rowMessages(es, overlay, null, true)).toEqual([
      { text: 'Esc cancela · Retroceso o Supr lo desactivan', tone: 'info' }
    ])
    // A button from a controller's first report: asked for again.
    expect(rowMessages(es, overlay, { action: 'toggleOverlay', kind: 'again' }, true)).toEqual([
      { text: 'Mando detectado: pulsa el botón otra vez', tone: 'info' }
    ])
    expect(
      rowMessages(
        es,
        overlay,
        { action: 'toggleOverlay', kind: 'refused', error: 'reserved' },
        true
      )
    ).toEqual([{ text: 'Windows o los programas ya usan esa combinación', tone: 'error' }])
  })

  it('after saving: the new keys, and the AltGr warning when it applies', () => {
    const altgr = row({ ...defaults, toggleOverlay: 'Ctrl+Alt+H' }, 0)
    expect(
      rowMessages(
        es,
        altgr,
        { action: 'toggleOverlay', kind: 'saved', accelerator: 'Ctrl+Alt+H', warning: 'altgr' },
        false
      )
    ).toEqual([
      { text: 'Guardado: Ctrl+Alt+H', tone: 'info' },
      { text: es.settings.shortcuts.warnings.altgr, tone: 'warn' }
    ])
    const off = shortcutRows(en, { ...defaults, toggleOverlay: '' }, null)[0] as ShortcutRowView
    expect(rowMessages(en, off, { action: 'toggleOverlay', kind: 'disabled' }, false)).toEqual([
      { text: 'Off: this action has no shortcut now', tone: 'info' }
    ])
  })

  it('drops a "saved" or "turned off" the shortcut no longer matches (reset elsewhere)', () => {
    const saved = { action: 'toggleOverlay', kind: 'saved', accelerator: 'Ctrl+Alt+H' } as const
    expect(rowMessages(es, overlay, saved, false)).toEqual([])
    expect(rowMessages(es, overlay, { action: 'toggleOverlay', kind: 'disabled' }, false)).toEqual(
      []
    )
  })

  it("ignores another row's feedback, and explains a combination another app holds", () => {
    const fb = { action: 'toggleEditMode', kind: 'disabled' } as const
    expect(rowMessages(es, overlay, fb, false)).toEqual([])
    const taken = shortcutRows(es, defaults, {
      ...OK,
      toggleOverlay: 'unavailable'
    })[0] as ShortcutRowView
    expect(rowMessages(es, taken, null, false)).toEqual([
      { text: es.settings.shortcuts.unavailableHelp, tone: 'warn' }
    ])
  })
})

describe('controller buttons', () => {
  const G29 = 'joy:046d:c24f:0'
  const withButton: ShortcutSettings = { ...defaults, toggleOverlay: `${G29}:12` }
  const names = { [G29]: 'G29 Driving Force Racing Wheel' }

  it('shows a button and its controller instead of keycaps', () => {
    const [r] = shortcutRows(es, withButton, OK, names)
    expect(r).toMatchObject({
      accelerator: `${G29}:12`,
      keys: [],
      button: { button: 'Botón 12', device: 'G29 Driving Force Racing Wheel' },
      status: 'ok',
      badge: '',
      canDisable: true,
      canReset: true
    })
    expect(shortcutRows(en, withButton, OK, names)[0]?.button?.button).toBe('Button 12')
    // A combination has none.
    expect(shortcutRows(es, defaults, OK, names)[0]?.button).toBeNull()
  })

  it('names a controller it never saw by its ids', () => {
    expect(shortcutRows(es, withButton, OK)[0]?.button?.device).toBe('VID 046D PID C24F')
  })

  it('tells two controllers with the same name apart', () => {
    const twins = { 'joy:1dd2:2201:0': 'BU0836X Interface', 'joy:1dd2:2202:0': 'BU0836X Interface' }
    const rows = shortcutRows(
      es,
      { ...defaults, toggleOverlay: 'joy:1dd2:2201:0:4', nextLayout: 'joy:1dd2:2202:0:4' },
      OK,
      twins
    )
    expect(rows[0]?.button?.device).toBe('BU0836X Interface (1dd2:2201)')
    expect(rows[3]?.button?.device).toBe('BU0836X Interface (1dd2:2202)')
  })

  it('says "Desconectado" when the controller is unplugged, and keeps the binding', () => {
    const r = shortcutRows(es, withButton, { ...OK, toggleOverlay: 'unavailable' }, names)[0]
    if (!r) throw new Error('no row')
    expect(r).toMatchObject({
      status: 'unavailable',
      badge: 'Desconectado',
      accelerator: `${G29}:12`
    })
    expect(rowMessages(es, r, null, false, names)).toEqual([
      { text: es.settings.shortcuts.disconnectedHelp, tone: 'warn' }
    ])
    // A combination another app holds keeps its own words.
    const keys = shortcutRows(es, defaults, { ...OK, toggleOverlay: 'unavailable' })[0]
    expect(keys?.badge).toBe('En uso por otra aplicación')
  })

  it('words a saved button with its controller', () => {
    const r = shortcutRows(es, withButton, OK, names)[0]
    if (!r) throw new Error('no row')
    expect(
      rowMessages(
        es,
        r,
        { action: 'toggleOverlay', kind: 'saved', accelerator: `${G29}:12` },
        false,
        names
      )
    ).toEqual([{ text: 'Guardado: Botón 12 · G29 Driving Force Racing Wheel', tone: 'info' }])
  })

  it('shows the button and its controller in the sidebar keys and the edit-mode tooltip', () => {
    const s = { ...defaults, toggleEditMode: `${G29}:3` }
    expect(sidebarKeys(es, s, names)[0]).toEqual({
      id: 'toggleEditMode',
      keys: 'Botón 3 · G29 Driving Force Racing Wheel',
      label: 'modo edición',
      button: true
    })
    expect(editModeTooltip(es, s, names)).toContain('(Botón 3 · G29 Driving Force Racing Wheel)')
    // Its name not known yet: its ids.
    expect(sidebarKeys(es, s)[0]?.keys).toBe('Botón 3 · VID 046D PID C24F')
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
    expect(rowMessages(es, r, refused, true, names)).toEqual([
      {
        text: 'Botón 12 · G29 Driving Force Racing Wheel ya lo usa «Mostrar u ocultar el overlay»',
        tone: 'error'
      }
    ])
    expect(refusalText(en, 'duplicate', 'toggleOverlay', 'Button 12 · G29')).toBe(
      'Button 12 · G29 is already used by “Show or hide the overlay”'
    )
  })

  it('counts the actions on a button (the reset removes them)', () => {
    expect(buttonBindingCount(defaults)).toBe(0)
    expect(buttonBindingCount({ ...withButton, nextLayout: `${G29}:4` })).toBe(2)
  })
})
