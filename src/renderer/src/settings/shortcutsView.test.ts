import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { DEFAULT_SETTINGS } from '@shared/settings'
import type { ShortcutSettings } from '@shared/shortcuts'
import {
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
  nextLayout: ''
}
const OK = {
  toggleOverlay: 'ok',
  toggleEditMode: 'ok',
  cycleDeltaReference: 'ok',
  nextLayout: 'ok'
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
      'nextLayout'
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
      { id: 'toggleEditMode', keys: 'Ctrl+Shift+E', label: 'modo edición' },
      { id: 'toggleOverlay', keys: 'Ctrl+Shift+H', label: 'mostrar u ocultar' },
      { id: 'exit', keys: 'Esc', label: 'salir de edición' }
    ])
  })

  it('leaves a turned-off shortcut out', () => {
    expect(sidebarKeys(en, custom)).toEqual([
      { id: 'toggleOverlay', keys: 'Ctrl+Alt+PgDn', label: 'show or hide' },
      { id: 'exit', keys: 'Esc', label: 'leave editing' }
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
    expect(refusalText(es, 'duplicate', 'toggleEditMode')).toBe('Ya la usa «Modo edición»')
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
      { text: 'Retroceso o Supr lo desactivan', tone: 'info' }
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
