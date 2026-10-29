import { describe, expect, it } from 'vitest'
import { COUNTRY_CODES } from '@shared/countries'
import { messagesFor } from '@shared/i18n'
import { clockText } from '../composables/useClock'
import { countryLabel, flagUriNow, hasFlag, loadFlag, svgUri } from './flags'

const ES = messagesFor('es')
const EN = messagesFor('en')

describe('the country flags', () => {
  it('has a flag for every code countries.ts gives, none for anything else', () => {
    for (const code of COUNTRY_CODES) expect(hasFlag(code), code).toBe(true)
    for (const bad of ['', 'es', 'ZZ', 'index', 'GB-XYZ']) expect(hasFlag(bad), bad).toBe(false)
  })

  it('loads the SVG once per code, as a data URI', async () => {
    expect(flagUriNow('ES')).toBeNull()
    const uri = await loadFlag('ES')
    expect(uri?.startsWith('data:image/svg+xml,')).toBe(true)
    expect(decodeURIComponent(uri?.slice('data:image/svg+xml,'.length) ?? '')).toContain('<svg')
    expect(flagUriNow('ES')).toBe(uri)
    expect(await loadFlag('ES')).toBe(uri)
    expect(await loadFlag('ZZ')).toBeNull()
  })

  it('svgUri escapes the markup', () => {
    expect(svgUri('<svg a="#"/>')).toBe('data:image/svg+xml,%3Csvg%20a%3D%22%23%22%2F%3E')
  })

  it('names the country in the interface language', () => {
    expect(countryLabel('ES', 'es', ES)).toBe('España')
    expect(countryLabel('ES', 'en', EN)).toBe('Spain')
    expect(countryLabel('GB-SCT', 'es', ES)).toBe('Escocia')
    expect(countryLabel('GB-WLS', 'en', EN)).toBe('Wales')
    expect(countryLabel('XK', 'es', ES)).toBe('Kosovo')
  })
})

describe('clockText', () => {
  it('hours and minutes, 24-hour', () => {
    const at = new Date(2026, 9, 28, 21, 7, 42).getTime()
    expect(clockText(at, 'es-ES')).toBe('21:07')
    expect(clockText(at, 'en-GB')).toBe('21:07')
  })
})
