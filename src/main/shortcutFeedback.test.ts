import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { createDefaultSettings, normalizeSettings } from '@shared/settings'
import { saveLayoutAs } from '@shared/layouts'
import {
  shortcutConfirmation,
  shortcutFeedback,
  type FeedbackState,
  type LiveState
} from './shortcutFeedback'

const es = messagesFor('es')
const en = messagesFor('en')

const BASE: FeedbackState = {
  overlayHidden: false,
  editMode: false,
  allHiddenBy: undefined,
  inSession: true,
  deltaShowing: true,
  layoutCount: 2,
  layoutName: 'GT3'
}

describe('shortcutFeedback (R37)', () => {
  it('says what the overlay shortcut did, and when a rule still hides everything', () => {
    expect(shortcutFeedback(es, 'toggleOverlay', { ...BASE, overlayHidden: true })?.text).toBe(
      'Overlay oculto'
    )
    expect(shortcutFeedback(es, 'toggleOverlay', BASE)?.text).toBe('Overlay visible')
    expect(
      shortcutFeedback(es, 'toggleOverlay', { ...BASE, allHiddenBy: 'out-of-car' })?.text
    ).toBe('Overlay visible · Oculto: fuera del coche')
  })

  it('says edit mode on and off', () => {
    expect(shortcutFeedback(es, 'toggleEditMode', { ...BASE, editMode: true })?.text).toBe(
      'Modo edición'
    )
    expect(shortcutFeedback(en, 'toggleEditMode', BASE)?.text).toBe('Edit mode: done')
  })

  it('says why the delta cycle shows nothing: no session, or the delta hidden', () => {
    expect(shortcutFeedback(es, 'cycleDeltaReference', { ...BASE, inSession: false })).toEqual({
      text: 'Delta: no hay sesión',
      detail: 'La referencia se cambia en pista'
    })
    expect(
      shortcutFeedback(es, 'cycleDeltaReference', { ...BASE, deltaShowing: false })?.text
    ).toBe('Delta oculto')
    expect(shortcutFeedback(es, 'cycleDeltaReference', BASE)).toEqual({
      text: 'Delta: siguiente referencia',
      detail: 'Desde la próxima vuelta, solo en esta sesión'
    })
  })

  it('names the next layout, or says there is only one', () => {
    expect(shortcutFeedback(es, 'nextLayout', BASE)?.text).toBe('Disposición: GT3')
    expect(shortcutFeedback(en, 'nextLayout', { ...BASE, layoutCount: 1 })?.text).toBe(
      'There is only one layout'
    )
  })

  it('says nothing for opening the settings (the window shows)', () => {
    expect(shortcutFeedback(es, 'openSettings', BASE)).toBeNull()
  })
})

describe('shortcutConfirmation (R37)', () => {
  const LIVE: LiveState = {
    overlayHidden: false,
    editMode: false,
    allHiddenBy: undefined,
    deltaHeld: false,
    inSession: true
  }

  it('says nothing with «Confirmar sobre el juego» off', () => {
    const s = createDefaultSettings()
    s.settingsWindow.shortcutToasts = false
    expect(shortcutConfirmation(es, 'toggleOverlay', s, LIVE)).toBeNull()
  })

  it('names the layout in use after the shortcut', () => {
    const s = createDefaultSettings()
    saveLayoutAs(s, 'GT3')
    const n = normalizeSettings(s)
    expect(shortcutConfirmation(es, 'nextLayout', n, LIVE)?.text).toBe('Disposición: GT3')
  })

  it('says a «Más acciones» shortcut by its widget, and what still keeps it off (R52)', () => {
    const s = createDefaultSettings()
    expect(shortcutConfirmation(es, 'toggleRelative', s, LIVE)).toEqual({
      text: 'Relativo visible',
      detail: ''
    })
    s.widgets.fuel.visible = false
    expect(shortcutConfirmation(en, 'toggleFuel', s, LIVE)?.text).toBe('Fuel hidden')
    // Shown, but a rule holds it, or the overlay is hidden by you.
    const held = shortcutConfirmation(es, 'toggleBattle', s, {
      ...LIVE,
      autoHidden: { battle: 'practice' }
    })
    expect(held?.text).toBe('Batalla visible')
    expect(held?.detail).toMatch(/práctica/i)
    expect(
      shortcutConfirmation(es, 'toggleBattle', s, { ...LIVE, overlayHidden: true })?.detail
    ).toBe(es.core.osd.widgetHeldByYou)
  })

  it('says Esc leaving edit mode as the edit-mode shortcut off', () => {
    const s = createDefaultSettings()
    expect(shortcutConfirmation(es, 'exitEdit', s, LIVE)?.text).toBe('Modo edición: terminado')
    expect(shortcutConfirmation(en, 'exitEdit', s, LIVE)?.text).toBe('Edit mode: done')
  })

  it('reads a rule hiding the delta as not showing', () => {
    const s = createDefaultSettings()
    expect(
      shortcutConfirmation(es, 'cycleDeltaReference', s, { ...LIVE, deltaHeld: true })?.text
    ).toBe('Delta oculto')
  })
})
