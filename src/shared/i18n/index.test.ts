import { describe, expect, it } from 'vitest'
import type { OverlayStatus } from '../types'
import { WIDGET_IDS } from '../widgets'
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  acceleratorText,
  hiddenText,
  isLanguage,
  keycaps,
  messagesFor,
  statusText,
  widgetTitle,
  type Language
} from './index'

const es = messagesFor('es')
const en = messagesFor('en')

function status(o: Partial<OverlayStatus>): OverlayStatus {
  return { state: 'connected', source: 'iracing', note: 'none', detail: '', ...o }
}

describe('messagesFor', () => {
  it('has Spanish as the default and a dictionary per language', () => {
    expect(DEFAULT_LANGUAGE).toBe('es')
    for (const lang of LANGUAGES) expect(messagesFor(lang).core.appName).toBe('OverLap')
    expect(messagesFor('fr' as Language)).toBe(es)
    expect(isLanguage('en')).toBe(true)
    expect(isLanguage('fr')).toBe(false)
  })
})

describe('widgetTitle', () => {
  it('names every widget in both languages', () => {
    expect(widgetTitle(es, 'standings')).toBe('Posiciones')
    expect(widgetTitle(en, 'standings')).toBe('Standings')
    expect(widgetTitle(es, 'inputs')).toBe('Pedales')
    expect(widgetTitle(en, 'inputs')).toBe('Inputs')
    for (const id of WIDGET_IDS) {
      expect(widgetTitle(es, id)).not.toBe('')
      expect(widgetTitle(en, id)).not.toBe('')
    }
  })

  it('never names a widget like a session (the qualifying session keeps its name)', () => {
    for (const m of [es, en]) {
      const sessions = Object.values(m.settings.window.showInKinds).map((s) => s.toLowerCase())
      for (const id of WIDGET_IDS) {
        expect(sessions, id).not.toContain(widgetTitle(m, id).toLowerCase())
      }
    }
    expect(es.settings.window.showInKinds.qualify).toBe('Clasificación')
  })
})

describe('statusText', () => {
  it('words every state in Spanish, per source', () => {
    expect(statusText(es, status({ state: 'starting' }))).toBe('Iniciando telemetría…')
    expect(statusText(es, status({ state: 'starting', source: 'mock' }))).toBe(
      'Iniciando telemetría simulada…'
    )
    expect(statusText(es, status({ state: 'waiting' }))).toBe('Esperando a iRacing…')
    expect(statusText(es, status({ state: 'waiting', source: 'mock' }))).toBe(
      'Iniciando modo simulado…'
    )
    expect(statusText(es, status({ state: 'connected' }))).toBe('Conectado a iRacing')
    expect(statusText(es, status({ state: 'mock', source: 'mock' }))).toBe('Modo simulado (mock)')
  })

  it('words every state in English, per source', () => {
    expect(statusText(en, status({ state: 'starting' }))).toBe('Starting telemetry…')
    expect(statusText(en, status({ state: 'starting', source: 'mock' }))).toBe(
      'Starting simulated telemetry…'
    )
    expect(statusText(en, status({ state: 'waiting' }))).toBe('Waiting for iRacing…')
    expect(statusText(en, status({ state: 'connected' }))).toBe('Connected to iRacing')
    expect(statusText(en, status({ state: 'mock', source: 'mock' }))).toBe('Simulated mode (mock)')
  })

  it('shows an error with its untranslated detail, or what the note says', () => {
    const error = (o: Partial<OverlayStatus>): OverlayStatus => status({ state: 'error', ...o })
    expect(statusText(es, error({ detail: 'boom' }))).toBe('Error en la telemetría: boom')
    expect(statusText(en, error({ detail: 'boom' }))).toBe('Telemetry error: boom')
    expect(statusText(es, error({}))).toBe('Error en la telemetría')
    expect(statusText(en, error({}))).toBe('Telemetry error')
    expect(statusText(es, error({ note: 'restarting' }))).toBe('Telemetría reiniciándose…')
    expect(statusText(en, error({ note: 'restarting' }))).toBe('Telemetry restarting…')
    const missing = error({ note: 'native-missing', detail: 'The iRacing SDK native module...' })
    expect(statusText(es, missing)).toBe('No se pudo cargar el módulo nativo del SDK de iRacing')
    expect(statusText(en, missing)).toBe('Could not load the iRacing SDK native module')
  })
})

describe('hiddenText', () => {
  it('words each visibility rule in Spanish', () => {
    expect(hiddenText(es, 'practice')).toBe('Oculto en práctica')
    expect(hiddenText(es, 'qualify')).toBe('Oculto en clasificación')
    expect(hiddenText(es, 'race')).toBe('Oculto en carrera')
    expect(hiddenText(es, 'pits')).toBe('Oculto en boxes')
    expect(hiddenText(es, 'garage')).toBe('Oculto en el garaje')
    expect(hiddenText(es, 'ui-hidden')).toBe('Oculto: interfaz de iRacing oculta')
    expect(hiddenText(es, 'replay')).toBe('Oculto en repeticiones')
    expect(hiddenText(es, 'replay-player')).toBe('Oculto en repeticiones: solo en directo')
    expect(hiddenText(es, 'out-of-car')).toBe('Oculto: fuera del coche')
    expect(hiddenText(es, 'not-race')).toBe('Oculto: solo en carrera')
    expect(hiddenText(es, null)).toBe('Oculto')
  })

  it('words each visibility rule in English', () => {
    expect(hiddenText(en, 'practice')).toBe('Hidden in practice')
    expect(hiddenText(en, 'qualify')).toBe('Hidden in qualifying')
    expect(hiddenText(en, 'race')).toBe('Hidden in races')
    expect(hiddenText(en, 'pits')).toBe('Hidden in the pits')
    expect(hiddenText(en, 'garage')).toBe('Hidden in the garage')
    expect(hiddenText(en, 'ui-hidden')).toBe('Hidden: iRacing UI hidden')
    expect(hiddenText(en, 'replay')).toBe('Hidden in replays')
    expect(hiddenText(en, 'replay-player')).toBe('Hidden in replays: live only')
    expect(hiddenText(en, 'out-of-car')).toBe('Hidden: out of the car')
    expect(hiddenText(en, 'not-race')).toBe('Hidden: races only')
    expect(hiddenText(en, null)).toBe('Hidden')
  })
})

describe('core texts', () => {
  it('titles the windows in both languages', () => {
    expect(es.core.windowTitles.settings).toBe('OverLap — Ajustes')
    expect(en.core.windowTitles.settings).toBe('OverLap — Settings')
    expect(es.core.windowTitles.overlay(1)).toBe('Pantalla 1 · OverLap')
    expect(en.core.windowTitles.overlay(2)).toBe('Display 2 · OverLap')
  })

  it('writes a percentage in the typography of each language', () => {
    expect(es.core.percent(110)).toBe('110\u00a0%')
    expect(en.core.percent(110)).toBe('110%')
  })
})

describe('shortcut texts', () => {
  it('word the edit-mode hints with the configured keys, or without any', () => {
    expect(es.core.editFrame.hintShort('Ctrl+Shift+E')).toBe('Rueda: tamaño · Ctrl+Shift+E salir')
    expect(en.core.editFrame.hintLong('F13')).toBe('Scroll: size · Alt: no snap · F13 exit')
    expect(es.core.editFrame.hintLongNoKey).toBe('Rueda: tamaño · Alt: sin imán')
    expect(en.core.editFrame.hintShortNoKey).toBe('Scroll: size')
  })

  it('name the show item and the hidden tooltip in both languages', () => {
    expect(es.core.tray.showOverlay).toBe('Mostrar el overlay')
    expect(en.core.tray.showOverlay).toBe('Show the overlay')
    expect(es.core.tray.showWhen).toBe('Cuándo mostrar')
    expect(es.core.tray.radarRange).toBe('Alcance del radar')
    expect(es.core.tray.tooltipHidden('Conectado a iRacing')).toBe(
      'OverLap · Overlay oculto · Conectado a iRacing'
    )
  })

  it('word the shortcuts page in both languages', () => {
    const s = es.settings.shortcuts
    expect(es.settings.nav.shortcuts).toBe('Atajos')
    expect(en.settings.nav.shortcuts).toBe('Shortcuts')
    // Short (a cell of the table), and not only the wheel's buttons; how to cancel under it.
    expect(s.capture.prompt).toBe('Pulsa tecla o botón…')
    expect(en.settings.shortcuts.capture.prompt).toBe('Press a key or button…')
    expect(s.capture.escHint).toBe('Esc cancela')
    expect(s.capture.clearHint).toBe('Esc cancela · Retroceso o Supr lo quitan')
    expect(s.capture.pressAgain).toBe('Mando detectado: pulsa el botón otra vez')
    expect(en.settings.shortcuts.capture.pressAgain).toBe(
      'Controller found: press the button again'
    )
    expect(s.resetAll.descriptionButtons(1)).toContain('quita el botón asignado')
    expect(s.resetAll.confirmButtons(3)).toBe('¿Quitar 3 botones asignados? Pulsa otra vez')
    expect(en.settings.shortcuts.resetAll.confirmButtons(1)).toBe(
      'Remove the assigned button? Click again'
    )
    expect(s.status).toEqual({
      disabled: 'Desactivado',
      unavailable: 'En uso por otra aplicación',
      unavailableShort: 'En uso por otra app',
      disconnected: 'Desconectado'
    })
    expect(es.core.keys.button(12)).toBe('Botón 12')
    expect(en.core.keys.button(12)).toBe('Button 12')
    expect(acceleratorText(es, 'joy:046d:c24f:0:7')).toBe('Botón 7')
    expect(keycaps(en, 'joy:046d:c24f:0:7')).toEqual(['Button 7'])
    expect([s.assign, s.cancel, s.reset]).toEqual(['Asignar', 'Cancelar', 'Restablecer'])
    expect([en.settings.shortcuts.assign, en.settings.shortcuts.cancel]).toEqual([
      'Assign',
      'Cancel'
    ])
    expect(s.addLabel(2, 'Modo edición')).toBe('Asignar el atajo 2: Modo edición')
    expect(s.columns.slot(3)).toBe('Atajo 3')
    expect(s.removeLabel('Ctrl+Shift+E', 'Modo edición')).toBe(
      'Quitar Ctrl+Shift+E de Modo edición'
    )
    expect(s.removed('Botón 24 · G29')).toBe('Quitado: Botón 24 · G29')
    expect(s.errors.duplicateSame).toBe('Esta acción ya tiene esa combinación')
    expect(s.resetAll.label).toBe('Restablecer atajos')
    expect(es.settings.nav.hidden.press('Ctrl+Shift+H')).toBe('Ctrl+Shift+H lo muestra')
  })
})
