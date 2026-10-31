import { describe, expect, it } from 'vitest'
import { NO_WIDGET_STATUS } from '@shared/testing/shortcuts'
import { messagesFor } from '@shared/i18n'
import { createDefaultSettings } from '@shared/settings'
import type { ShortcutStatusReport } from '@shared/shortcuts'
import type { OverlayStatus } from '@shared/types'
import { WIDGET_IDS } from '@shared/widgets'
import { heldCaption, statusSummary, type StatusSummaryInput } from './statusSummary'

const es = messagesFor('es')
const en = messagesFor('en')
const MOCK: OverlayStatus = { state: 'mock', source: 'mock', note: 'none', detail: '' }
const OK_SHORTCUTS: ShortcutStatusReport = {
  actions: {
    toggleOverlay: 'ok',
    toggleEditMode: 'ok',
    cycleDeltaReference: 'disabled',
    nextLayout: 'disabled',
    openSettings: 'ok',
    ...NO_WIDGET_STATUS
  },
  unavailable: []
}

function input(over: Partial<StatusSummaryInput> = {}): StatusSummaryInput {
  return {
    status: MOCK,
    overlayHidden: false,
    settings: createDefaultSettings(),
    hidden: {},
    shortcuts: OK_SHORTCUTS,
    saveFailing: false,
    ...over
  }
}

describe('statusSummary (R35)', () => {
  it('says the connection with nothing under it when all is well', () => {
    const s = statusSummary(es, input())
    expect(s.label).toBe('Simulación')
    expect(s.sub).toBeNull()
    expect(s.tone).toBe('sim')
    // A new install: every widget but the spotter, off until you turn it on.
    expect(s.enabled).toBe('10 de 11 widgets activados')
    expect(s.hiddenLines).toEqual([])
  })

  it('says once the rule that hides every enabled widget', () => {
    const settings = createDefaultSettings()
    const hidden = Object.fromEntries(WIDGET_IDS.map((id) => [id, 'out-of-car' as const]))
    const s = statusSummary(es, input({ settings, hidden }))
    expect(s.sub).toBe('Oculto: fuera del coche')
    expect(s.hiddenLines).toEqual(['Todos los activados · Oculto: fuera del coche'])
  })

  it('lists each hidden widget, in the groups order, with its reason', () => {
    const s = statusSummary(es, input({ hidden: { fuel: 'practice', battle: 'practice' } }))
    expect(s.sub).toBe('2 widgets ocultos ahora')
    expect(s.hiddenLines).toEqual([
      'Batalla · Oculto en práctica',
      'Combustible · Oculto en práctica'
    ])
    // A widget the user turned off is not "hidden by a rule".
    const settings = createDefaultSettings()
    settings.widgets.battle.visible = false
    const off = statusSummary(es, input({ settings, hidden: { battle: 'practice' } }))
    expect(off.sub).toBeNull()
    expect(off.enabled).toBe('9 de 11 widgets activados')
  })

  it('puts the user hiding the overlay and a failing save first', () => {
    expect(statusSummary(es, input({ overlayHidden: true })).sub).toBe('Overlay oculto')
    const failing = statusSummary(es, input({ overlayHidden: true, saveFailing: true }))
    expect(failing.sub).toBe('Los cambios no se están guardando en el disco')
    expect(failing.tone).toBe('warn')
  })

  it('counts the shortcuts that do not work', () => {
    const shortcuts: ShortcutStatusReport = {
      actions: { ...OK_SHORTCUTS.actions, toggleOverlay: 'unavailable', nextLayout: 'unavailable' },
      unavailable: ['F13', 'joy:1:2:0:3']
    }
    const s = statusSummary(es, input({ shortcuts }))
    expect(s.shortcutsFailing).toBe(2)
    expect(s.sub).toBe('2 atajos no funcionan')
    expect(s.tone).toBe('warn')
  })

  it('says what a missing native module means, in English too', () => {
    const status: OverlayStatus = {
      state: 'error',
      source: 'iracing',
      note: 'native-missing',
      detail: ''
    }
    const s = statusSummary(en, input({ status }))
    expect(s.nativeMissing).toBe(true)
    expect(s.tone).toBe('error')
    expect(s.label).toBe(en.core.statusChip.error)
    expect(s.connection).toBe(en.core.status.nativeMissing)
    expect(s.advice).toBe('Without it there is no iRacing data. Download OverLap again.')
    expect(statusSummary(en, input({ settings: null, status: null })).sub).toBeNull()
  })
})

describe('heldCaption (R35)', () => {
  const shown = { hidden: false, reason: null }
  it('is null while the widget shows', () => {
    expect(heldCaption(es, 'es', false, shown)).toBeNull()
  })
  it('says the rule, in lower case', () => {
    expect(heldCaption(es, 'es', false, { hidden: true, reason: 'practice' })).toMatch(/^oculto/)
  })
  it('says the overlay hidden by you before any rule, in both languages', () => {
    expect(heldCaption(es, 'es', true, shown)).toBe('overlay oculto')
    expect(heldCaption(en, 'en', true, { hidden: true, reason: 'practice' })).toBe('overlay hidden')
  })
})
