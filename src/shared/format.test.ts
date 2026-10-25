import { describe, it, expect } from 'vitest'
import {
  MINUS,
  NBSP,
  formatBestLapGap,
  formatClassPosition,
  formatClock,
  formatDriverName,
  formatGained,
  formatGapValue,
  formatIRatingDelta,
  formatLapTime,
  formatLaps,
  formatMetres,
  formatRemaining,
  formatSafetyRating,
  formatSpeed,
  formatTrend,
  formatGap,
  formatIRating,
  formatLicense,
  formatLicenseShort,
  formatSessionType,
  isKnownName,
  shownDriverName,
  signAt,
  speedUnit
} from './format'
import { messagesFor } from './i18n'
import type { NameFormat } from './types'

/** The typographic minus every signed value takes. */
const M = MINUS
const ES = messagesFor('es')
const EN = messagesFor('en')

describe('formatGap', () => {
  it('shows cars ahead without sign and cars behind with a minus', () => {
    expect(formatGap(1.2)).toBe('1.2')
    expect(formatGap(-0.8)).toBe(`${M}0.8`)
    expect(formatGap(12.345)).toBe('12.3')
    expect(formatGap(-12.36)).toBe(`${M}12.4`)
  })

  it('shows zero as "0.0", never a signed zero', () => {
    expect(formatGap(0)).toBe('0.0')
    expect(formatGap(-0)).toBe('0.0')
    expect(formatGap(0.04)).toBe('0.0')
    expect(formatGap(-0.04)).toBe('0.0')
    expect(formatGap(-0.05)).toBe(`${M}0.1`)
  })

  it('switches to m:ss from one minute, rounding first', () => {
    expect(formatGap(59.94)).toBe('59.9')
    expect(formatGap(59.96)).toBe('1:00')
    expect(formatGap(-59.96)).toBe(`${M}1:00`)
    expect(formatGap(60)).toBe('1:00')
    expect(formatGap(65.4)).toBe('1:05')
    expect(formatGap(-65)).toBe(`${M}1:05`)
    expect(formatGap(119.6)).toBe('2:00')
    expect(formatGap(754)).toBe('12:34')
  })

  it('shows a dash when unknown', () => {
    expect(formatGap(null)).toBe('—')
    expect(formatGap(Number.NaN)).toBe('—')
    expect(formatGap(Number.POSITIVE_INFINITY)).toBe('—')
  })
})

describe('formatIRating', () => {
  it('is empty when unknown', () => {
    expect(formatIRating(null)).toBe('')
    expect(formatIRating(0)).toBe('')
    expect(formatIRating(-5)).toBe('')
    expect(formatIRating(Number.NaN)).toBe('')
  })

  it('shows raw values below 1000', () => {
    expect(formatIRating(980)).toBe('980')
    expect(formatIRating(1)).toBe('1')
    expect(formatIRating(999.4)).toBe('999')
  })

  it('shows thousands with one decimal', () => {
    expect(formatIRating(999.6)).toBe('1.0k')
    expect(formatIRating(1000)).toBe('1.0k')
    expect(formatIRating(2349)).toBe('2.3k')
    expect(formatIRating(2350)).toBe('2.4k')
    expect(formatIRating(10449)).toBe('10.4k')
    expect(formatIRating(9960)).toBe('10.0k')
  })
})

describe('license', () => {
  it('formatLicense normalises whitespace', () => {
    expect(formatLicense('A 4.99')).toBe('A 4.99')
    expect(formatLicense('  B   3.10 ')).toBe('B 3.10')
    expect(formatLicense(null)).toBe('')
    expect(formatLicense('')).toBe('')
  })

  it('formatLicenseShort truncates the safety rating to one decimal', () => {
    expect(formatLicenseShort('A 4.99')).toBe('A 4.9')
    expect(formatLicenseShort('A 4.60')).toBe('A 4.6')
    expect(formatLicenseShort('D 0.05')).toBe('D 0.0')
    expect(formatLicenseShort('B4.25')).toBe('B 4.2')
    expect(formatLicenseShort('C 3')).toBe('C 3.0')
    expect(formatLicenseShort('Pro')).toBe('Pro')
    expect(formatLicenseShort(null)).toBe('')
  })
})

describe('formatClassPosition', () => {
  it('formats known positions', () => {
    expect(formatClassPosition(3)).toBe('P3')
    expect(formatClassPosition(12)).toBe('P12')
  })

  it('is empty when unknown', () => {
    expect(formatClassPosition(null)).toBe('')
    expect(formatClassPosition(0)).toBe('')
    expect(formatClassPosition(-1)).toBe('')
    expect(formatClassPosition(Number.NaN)).toBe('')
  })
})

describe('formatSessionType', () => {
  it('translates known session types', () => {
    expect(formatSessionType('Race', ES)).toBe('CARRERA')
    expect(formatSessionType('Practice', ES)).toBe('PRÁCTICA')
    expect(formatSessionType('Lone Qualify', ES)).toBe('CLASIF.')
    expect(formatSessionType('Open Qualify', ES)).toBe('CLASIF.')
  })

  it('labels warmup and testing sessions', () => {
    expect(formatSessionType('Warmup', ES)).toBe('WARMUP')
    expect(formatSessionType('Offline Testing', ES)).toBe('PRUEBAS')
  })

  it('passes unknown types through', () => {
    expect(formatSessionType(' Time Attack ', ES)).toBe('Time Attack')
    expect(formatSessionType(null, ES)).toBe('')
  })

  it('says them in English', () => {
    expect(formatSessionType('Race', EN)).toBe('RACE')
    expect(formatSessionType('Lone Qualify', EN)).toBe('QUALIFY')
    expect(formatSessionType('Practice', EN)).toBe('PRACTICE')
    expect(formatSessionType('Offline Testing', EN)).toBe('TESTING')
    expect(formatSessionType(' Time Attack ', EN)).toBe('Time Attack')
  })
})

describe('v2 formatters', () => {
  it('formats lap times', () => {
    expect(formatLapTime(98.4521)).toBe('1:38.452')
    expect(formatLapTime(59.9996)).toBe('1:00.000')
    expect(formatLapTime(45.1)).toBe('45.100')
    expect(formatLapTime(null)).toBe('—')
    expect(formatLapTime(-1)).toBe('—')
  })
  it('formats standings gaps', () => {
    expect(formatGapValue({ kind: 'time', seconds: 1.24 })).toBe('+1.2')
    expect(formatGapValue({ kind: 'time', seconds: 65 })).toBe('+1:05')
    expect(formatGapValue({ kind: 'laps', laps: 2 })).toBe('+2L')
    expect(formatGapValue(null)).toBe('')
  })
  it('formats trends and iRating deltas', () => {
    expect(formatTrend(0.184)).toBe('+0.18')
    expect(formatTrend(-0.051)).toBe(`${M}0.05`)
    expect(formatTrend(0.001)).toBe('0.00')
    expect(formatTrend(null)).toBe('—')
    expect(formatIRatingDelta(23.4)).toBe('+23')
    expect(formatIRatingDelta(-6.6)).toBe(`${M}7`)
    expect(formatIRatingDelta(null)).toBe('')
  })
  it('signs every negative with the typographic minus (as wide as +), never a hyphen', () => {
    expect(MINUS).toBe('−')
    expect(formatGapValue({ kind: 'time', seconds: -0.44 })).toBe(`${M}0.4`)
    // Zero has no sign, whichever side it rounds from.
    expect(formatIRatingDelta(-0.4)).toBe('0')
    expect(formatIRatingDelta(0)).toBe('0')
    const negatives = [
      formatGap(-3),
      formatGap(-75),
      formatGapValue({ kind: 'time', seconds: -75 }),
      formatBestLapGap(-75),
      formatTrend(-3),
      formatIRatingDelta(-3)
    ]
    for (const s of negatives) {
      expect(s.startsWith(M)).toBe(true)
      expect(s).not.toContain('-')
    }
  })
})

describe('signAt', () => {
  it('is the sign of the value as displayed', () => {
    expect(signAt(0.004, 2)).toBe(0)
    expect(signAt(0.005, 2)).toBe(1)
    expect(signAt(-0.006, 2)).toBe(-1)
    expect(signAt(-0.4, 0)).toBe(0)
    expect(signAt(3, 0)).toBe(1)
    expect(signAt(null, 2)).toBeNull()
    expect(signAt(Number.NaN, 2)).toBeNull()
    expect(signAt(Infinity, 1)).toBeNull()
  })
})

describe('moved renderer formatters', () => {
  it('formats positions gained or lost as the count alone, nothing for none', () => {
    expect(formatGained(4)).toBe('4')
    expect(formatGained(-2.4)).toBe('2')
    expect(formatGained(0)).toBe('')
    expect(formatGained(0.4)).toBe('')
    expect(formatGained(-0.4)).toBe('')
    expect(formatGained(null)).toBe('')
    expect(formatGained(Number.NaN)).toBe('')
  })

  it('formats the safety rating', () => {
    expect(formatSafetyRating(3.274)).toBe('3.27')
    expect(formatSafetyRating(2)).toBe('2.00')
    expect(formatSafetyRating(Number.NaN)).toBe('—')
  })

  it('formats countdowns, rounding down', () => {
    expect(formatClock(2299.9)).toBe('38:19')
    expect(formatClock(59)).toBe('0:59')
    expect(formatClock(3725)).toBe('1:02:05')
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(-1)).toBe('')
    expect(formatClock(null)).toBe('')
    expect(formatClock(604800)).toBe('')
  })

  it('formats what is left of the session', () => {
    // The estimate after an en space, no separator glyph.
    expect(formatRemaining(18.6, 2299, ES)).toBe(`38:19\u2002≈19${NBSP}v`)
    expect(formatRemaining(null, 2299, ES)).toBe('38:19')
    expect(formatRemaining(12, null, ES)).toBe(`Quedan 12${NBSP}v`)
    expect(formatRemaining(1, null, ES)).toBe(`Queda 1${NBSP}v`)
    expect(formatRemaining(-2, null, ES)).toBe(`Quedan 0${NBSP}v`)
    expect(formatRemaining(null, null, ES)).toBe('')
  })

  it('says what is left in English', () => {
    expect(formatRemaining(18.6, 2299, EN)).toBe(`38:19\u2002≈19${NBSP}L`)
    expect(formatRemaining(12, null, EN)).toBe(`12${NBSP}laps left`)
    expect(formatRemaining(1, null, EN)).toBe(`1${NBSP}lap left`)
    expect(formatLaps(5.6, EN)).toBe(`~6${NBSP}L`)
    expect(formatLaps(0.4, EN)).toBe(`<${NBSP}1${NBSP}L`)
  })

  it('formats gaps to a best lap with three decimals, m:ss.sss from a minute', () => {
    expect(formatBestLapGap(0)).toBe('+0.000')
    expect(formatBestLapGap(0.4126)).toBe('+0.413')
    expect(formatBestLapGap(62.345)).toBe('+1:02.345')
    expect(formatBestLapGap(-0.2)).toBe(`${M}0.200`)
    expect(formatBestLapGap(Number.NaN)).toBe('')
  })

  it('formats lap counts', () => {
    expect(formatLaps(5.6, ES)).toBe(`~6${NBSP}v`)
    expect(formatLaps(0.4, ES)).toBe(`<${NBSP}1${NBSP}v`)
    expect(formatLaps(null, ES)).toBe('—')
    expect(formatLaps(Infinity, ES)).toBe('—')
  })

  it('formats metres with a dot and at most one decimal', () => {
    expect(formatMetres(12.5)).toBe(`12.5${NBSP}m`)
    expect(formatMetres(20)).toBe(`20${NBSP}m`)
    expect(formatMetres(7.46, false)).toBe('7.5')
    expect(formatMetres(-0.01, false)).toBe('0')
    expect(formatMetres(Number.NaN)).toBe('—')
  })
})

describe('formatSpeed', () => {
  it('shows whole km/h or mph', () => {
    expect(formatSpeed(166.4, 'metric')).toBe('166')
    expect(formatSpeed(166.4, 'imperial')).toBe('103')
    expect(formatSpeed(0, 'metric')).toBe('0')
    expect(formatSpeed(-3, 'imperial')).toBe('0')
    expect(formatSpeed(Number.NaN, 'metric')).toBe('0')
    expect(speedUnit('metric')).toBe('km/h')
    expect(speedUnit('imperial')).toBe('mph')
  })
})

describe('formatDriverName', () => {
  const all = (name: string): Record<NameFormat, string> => ({
    full: formatDriverName(name, 'full'),
    abbr: formatDriverName(name, 'abbr'),
    surname: formatDriverName(name, 'surname'),
    tv: formatDriverName(name, 'tv')
  })

  it('handles hyphenated given names and accents', () => {
    expect(all('Pierre-Étienne Duvalier')).toEqual({
      full: 'Pierre-Étienne Duvalier',
      abbr: 'P. Duvalier',
      surname: 'Duvalier',
      tv: 'DUV'
    })
  })

  it('pulls lowercase particles into the surname, not into the TV code', () => {
    expect(all('Zoë van der Berg')).toEqual({
      full: 'Zoë van der Berg',
      abbr: 'Z. van der Berg',
      surname: 'van der Berg',
      tv: 'BER'
    })
    expect(formatDriverName('Pedro de la Rosa', 'abbr')).toBe('P. de la Rosa')
    // Capitalised particles are part of the name; the given name is never pulled in.
    expect(formatDriverName('Eddie Van Halen', 'surname')).toBe('Halen')
    expect(formatDriverName('de Silva', 'surname')).toBe('Silva')
  })

  it('keeps suffixes after the surname', () => {
    expect(all('John Smith Jr')).toEqual({
      full: 'John Smith Jr',
      abbr: 'J. Smith Jr',
      surname: 'Smith Jr',
      tv: 'SMI'
    })
    expect(formatDriverName('Graham Hill III', 'abbr')).toBe('G. Hill III')
    expect(formatDriverName('Bob Jones sr.', 'surname')).toBe('Jones sr.')
  })

  it('uses the last word as surname with middle names', () => {
    expect(formatDriverName('Juan Pablo Montoya', 'abbr')).toBe('J. Montoya')
    expect(formatDriverName('Alejandro Ruiz', 'abbr')).toBe('A. Ruiz')
  })

  it('strips diacritics and non-letters from the TV code', () => {
    expect(formatDriverName('Mateo Échevarría', 'tv')).toBe('ECH')
    expect(formatDriverName('Shane O’Neil', 'tv')).toBe('ONE')
    expect(formatDriverName('Li Wu', 'tv')).toBe('WU')
    expect(formatDriverName('John Smith2', 'tv')).toBe('SMI')
  })

  it('upper-cases the initial of a lowercase given name', () => {
    expect(formatDriverName('jesús molano', 'abbr')).toBe('J. molano')
  })

  it('returns single names, name + suffix and empty names unchanged', () => {
    for (const style of ['full', 'abbr', 'surname', 'tv'] as const) {
      expect(formatDriverName('Pelé', style)).toBe('Pelé')
      expect(formatDriverName('John Jr', style)).toBe('John Jr')
      expect(formatDriverName('', style)).toBe('')
      expect(formatDriverName('   ', style)).toBe('')
    }
  })

  it('collapses whitespace', () => {
    expect(formatDriverName('  Ana   María  López ', 'full')).toBe('Ana María López')
    expect(formatDriverName('  Ana   María  López ', 'abbr')).toBe('A. López')
  })
})

describe('isKnownName', () => {
  it("is false for what iRacing leaves of a name outside Windows-1252: '?', spaces, punctuation", () => {
    for (const name of ['?????? ?????', '?. ?????', '???', ' ?? - ?, ', '', '   ', '\uFFFD']) {
      expect(isKnownName(name), name).toBe(false)
    }
  })

  it('is true with any letter or digit, of any script', () => {
    for (const name of ['Zoë Ångström', 'Ivan ??????', '?? 77', 'Ж', '李', 'Lucía']) {
      expect(isKnownName(name), name).toBe(true)
    }
  })
})

describe('shownDriverName', () => {
  it('keeps a formatted name that says something', () => {
    expect(shownDriverName('L. Peñalver', 'Team', '11', ES)).toEqual({
      text: 'L. Peñalver',
      unknown: false
    })
  })

  it("falls back to the team's name as it is, then to 'Piloto #7'", () => {
    expect(shownDriverName('', '  Équipe   Rouge ', '7', ES)).toEqual({
      text: 'Équipe Rouge',
      unknown: false
    })
    expect(shownDriverName('?. ?????', '?????? ?????', ' 7 ', ES)).toEqual({
      text: 'Piloto #7',
      unknown: true
    })
    expect(shownDriverName('', undefined, '7', EN)).toEqual({ text: 'Driver #7', unknown: true })
    expect(shownDriverName('', undefined, '', ES).text).toBe('Piloto')
    expect(shownDriverName('', undefined, '', EN).text).toBe('Driver')
  })
})
