import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import {
  IR_COMPACT_EM,
  IR_FULL_EM,
  IR_PLATE_EM,
  formatCarNumber,
  iRatingColumnEm,
  splitLicense,
  toDriverCell,
  type DriverCellInput
} from './driverCell'
import { createDriverStyles } from './styles'

const ES = messagesFor('es')
const EN = messagesFor('en')

const DRIVER: DriverCellInput = {
  carNumber: ' 7 ',
  driverName: 'Alejandro Ruiz',
  classColor: '#ffaa00',
  iRating: 2412,
  licString: 'B 3.27',
  licColor: '#00c702'
}

describe('formatCarNumber', () => {
  it('prefixes #, empty when unknown', () => {
    expect(formatCarNumber('23')).toBe('#23')
    expect(formatCarNumber(' ')).toBe('')
  })
})

describe('toDriverCell', () => {
  it('formats every field', () => {
    const cell = toDriverCell(DRIVER, createDriverStyles(), 'abbr', ES)
    expect(cell).toMatchObject({
      number: '7',
      name: 'A. Ruiz',
      nameUnknown: false,
      iRating: '2.4k',
      lic: 'B 3.2'
    })
    expect(cell.clsStyle['--cls']).toBe('#ffaa00')
    expect(cell.licStyle['--lic']).toBe('#00c702')
  })

  it('shares style objects between rows of the same colours', () => {
    const st = createDriverStyles()
    const a = toDriverCell(DRIVER, st, 'full', ES)
    const b = toDriverCell({ ...DRIVER, driverName: 'Otro Piloto' }, st, 'full', ES)
    expect(b.clsStyle).toBe(a.clsStyle)
    expect(b.licStyle).toBe(a.licStyle)
  })

  it('leaves unknown values empty', () => {
    const cell = toDriverCell(
      { ...DRIVER, carNumber: '', iRating: null, licString: null, licColor: null },
      createDriverStyles(),
      'full',
      ES
    )
    expect(cell).toMatchObject({ number: '', iRating: '', lic: '' })
  })

  it("names a driver iRacing wrote as '?' by the team, else by the car number, dim", () => {
    const st = createDriverStyles()
    const unknown = { ...DRIVER, driverName: '' }
    expect(toDriverCell(unknown, st, 'abbr', ES)).toMatchObject({
      name: 'Piloto #7',
      nameUnknown: true
    })
    expect(toDriverCell(unknown, st, 'abbr', EN).name).toBe('Driver #7')
    expect(toDriverCell({ ...unknown, carNumber: '' }, st, 'abbr', ES).name).toBe('Piloto')
    // A raw '?' name (a payload from before the provider cleared it) reads the same.
    expect(toDriverCell({ ...DRIVER, driverName: '?????? ?????' }, st, 'tv', ES).name).toBe(
      'Piloto #7'
    )
    // The team's name is shown whole, not restyled like a person's.
    const team = toDriverCell({ ...unknown, teamName: '  Équipe   Rouge ' }, st, 'abbr', ES)
    expect(team).toMatchObject({ name: 'Équipe Rouge', nameUnknown: false })
    expect(toDriverCell({ ...unknown, teamName: '??? ???' }, st, 'abbr', ES).name).toBe('Piloto #7')
  })
})

describe('splitLicense', () => {
  it('separates the class letter from the rating', () => {
    expect(splitLicense('A 4.9')).toEqual(['A', '4.9'])
    expect(splitLicense('R')).toEqual(['R', ''])
    expect(splitLicense('')).toEqual(['', ''])
  })
})

describe('the iRating’s format and column (request 10)', () => {
  it('writes the whole number in the language’s thousands when asked', () => {
    const st = createDriverStyles()
    expect(toDriverCell(DRIVER, st, 'abbr', ES).iRating).toBe('2.4k')
    expect(toDriverCell(DRIVER, st, 'abbr', ES, 'full').iRating).toBe('2.412')
    expect(toDriverCell(DRIVER, st, 'abbr', EN, 'full').iRating).toBe('2,412')
  })

  it('widens the column for the whole number and for a boxed licence plate only', () => {
    expect(iRatingColumnEm('compact', false, 'outline')).toBe(IR_COMPACT_EM)
    expect(IR_COMPACT_EM).toBe(2.4)
    expect(iRatingColumnEm('full', false, 'outline')).toBe(IR_FULL_EM)
    expect(iRatingColumnEm('compact', true, 'outline')).toBe(IR_COMPACT_EM + IR_PLATE_EM)
    expect(iRatingColumnEm('full', true, 'solid')).toBe(IR_FULL_EM + IR_PLATE_EM)
    // Suave and Solo letra colour the text: no box, no padding.
    expect(iRatingColumnEm('compact', true, 'soft')).toBe(IR_COMPACT_EM)
    expect(iRatingColumnEm('full', true, 'letter')).toBe(IR_FULL_EM)
  })
})
