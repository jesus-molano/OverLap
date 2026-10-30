import { describe, expect, it } from 'vitest'
import { createDefaultSettings } from '@shared/settings'
import { applyFirstRun, systemLanguage } from './firstRun'

describe('systemLanguage (R07)', () => {
  it('takes the first preferred language OverLap speaks', () => {
    expect(systemLanguage(['es-MX', 'en-US'])).toBe('es')
    expect(systemLanguage(['en-GB', 'es-ES'])).toBe('en')
    expect(systemLanguage(['de-DE', 'es_ES'])).toBe('es')
    expect(systemLanguage(['ES'])).toBe('es')
  })

  it('falls back to English when none is spoken', () => {
    expect(systemLanguage(['de-DE', 'fr-FR'])).toBe('en')
    expect(systemLanguage([])).toBe('en')
  })
})

describe('applyFirstRun (R07)', () => {
  it('sets the language and the welcome on a new install', () => {
    const s = createDefaultSettings()
    expect(applyFirstRun(s, true, ['en-US'])).toBe(true)
    expect(s.appearance.language).toBe('en')
    expect(s.settingsWindow.welcome).toBe(true)
  })

  it('leaves an existing file alone: its language, no welcome', () => {
    const s = createDefaultSettings()
    s.appearance.language = 'es'
    expect(applyFirstRun(s, false, ['en-US'])).toBe(false)
    expect(s.appearance.language).toBe('es')
    expect(s.settingsWindow.welcome).toBe(false)
  })
})
