import { describe, expect, it } from 'vitest'
import type { OverlayStatus } from '../types'
import { WIDGET_IDS } from '../widgets'
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  hiddenText,
  isLanguage,
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
    expect(widgetTitle(es, 'standings')).toBe('Clasificación')
    expect(widgetTitle(en, 'standings')).toBe('Standings')
    expect(widgetTitle(es, 'inputs')).toBe('Pedales')
    expect(widgetTitle(en, 'inputs')).toBe('Inputs')
    for (const id of WIDGET_IDS) {
      expect(widgetTitle(es, id)).not.toBe('')
      expect(widgetTitle(en, id)).not.toBe('')
    }
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
    expect(hiddenText(es, null)).toBe('Oculto')
  })

  it('words each visibility rule in English', () => {
    expect(hiddenText(en, 'practice')).toBe('Hidden in practice')
    expect(hiddenText(en, 'qualify')).toBe('Hidden in qualifying')
    expect(hiddenText(en, 'race')).toBe('Hidden in races')
    expect(hiddenText(en, 'pits')).toBe('Hidden in the pits')
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
