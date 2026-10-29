import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COUNTRY_CODES, countryName, countryOfFlair, flairKey, isCountryCode } from './countries'

describe('countryOfFlair', () => {
  it('maps the flairs as iRacing writes them', () => {
    expect(countryOfFlair('Spain')).toBe('ES')
    expect(countryOfFlair('United Kingdom')).toBe('GB')
    expect(countryOfFlair('Brazil')).toBe('BR')
    expect(countryOfFlair('United States')).toBe('US')
    expect(countryOfFlair('Germany')).toBe('DE')
    expect(countryOfFlair('Netherlands')).toBe('NL')
  })

  it('the home nations, Catalonia and the alternative names', () => {
    expect(countryOfFlair('England')).toBe('GB-ENG')
    expect(countryOfFlair('Scotland')).toBe('GB-SCT')
    expect(countryOfFlair('Wales')).toBe('GB-WLS')
    expect(countryOfFlair('Northern Ireland')).toBe('GB-NIR')
    expect(countryOfFlair('Catalonia')).toBe('ES-CT')
    expect(countryOfFlair('Czech Republic')).toBe('CZ')
    expect(countryOfFlair('Korea, Republic of')).toBe('KR')
    expect(countryOfFlair('Russian Federation')).toBe('RU')
    expect(countryOfFlair('Türkiye')).toBe('TR')
    expect(countryOfFlair('The Netherlands')).toBe('NL')
    expect(countryOfFlair('Bosnia & Herzegovina')).toBe('BA')
    expect(countryOfFlair("Côte d'Ivoire")).toBe('CI')
  })

  it('ignores case, accents, punctuation and spaces around', () => {
    expect(countryOfFlair('  spain ')).toBe('ES')
    expect(countryOfFlair('UNITED-KINGDOM')).toBe('GB')
    expect(countryOfFlair('Curaçao')).toBe('CW')
    expect(flairKey('  The Côte-d’Ivoire ')).toBe('cote d ivoire')
  })

  it('nothing for none, unknown or empty', () => {
    for (const none of ['-none-', 'None', 'none', '', '   ', 'Atlantis', 'Club 42', '-']) {
      expect(countryOfFlair(none), none).toBe('')
    }
  })
})

describe('the flag codes', () => {
  it('are unique, each a flag of country-flag-icons (3x2)', () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length)
    const dir = join(process.cwd(), 'node_modules', 'country-flag-icons', 'string', '3x2')
    for (const code of COUNTRY_CODES) expect(existsSync(join(dir, `${code}.js`)), code).toBe(true)
  })

  it('isCountryCode and countryName', () => {
    expect(isCountryCode('ES')).toBe(true)
    expect(isCountryCode('GB-SCT')).toBe(true)
    expect(isCountryCode('es')).toBe(false)
    expect(isCountryCode('')).toBe(false)
    expect(isCountryCode(7)).toBe(false)
    expect(countryName('ES')).toBe('Spain')
    expect(countryName('GB-WLS')).toBe('Wales')
    expect(countryName('ZZ')).toBe('')
  })
})
