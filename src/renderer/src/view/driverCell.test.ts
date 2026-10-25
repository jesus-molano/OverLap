import { describe, expect, it } from 'vitest'
import { formatCarNumber, splitLicense, toDriverCell, type DriverCellInput } from './driverCell'
import { createDriverStyles } from './styles'

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
    const cell = toDriverCell(DRIVER, createDriverStyles(), 'abbr')
    expect(cell).toMatchObject({ number: '7', name: 'A. Ruiz', iRating: '2.4k', lic: 'B 3.2' })
    expect(cell.clsStyle['--cls']).toBe('#ffaa00')
    expect(cell.licStyle['--lic']).toBe('#00c702')
  })

  it('defaults to the full name', () => {
    expect(toDriverCell(DRIVER, createDriverStyles()).name).toBe('Alejandro Ruiz')
  })

  it('shares style objects between rows of the same colours', () => {
    const st = createDriverStyles()
    const a = toDriverCell(DRIVER, st)
    const b = toDriverCell({ ...DRIVER, driverName: 'Otro Piloto' }, st)
    expect(b.clsStyle).toBe(a.clsStyle)
    expect(b.licStyle).toBe(a.licStyle)
  })

  it('leaves unknown values empty', () => {
    const cell = toDriverCell(
      { ...DRIVER, carNumber: '', iRating: null, licString: null, licColor: null },
      createDriverStyles()
    )
    expect(cell).toMatchObject({ number: '', iRating: '', lic: '' })
  })
})

describe('splitLicense', () => {
  it('separates the class letter from the rating', () => {
    expect(splitLicense('A 4.9')).toEqual(['A', '4.9'])
    expect(splitLicense('R')).toEqual(['R', ''])
    expect(splitLicense('')).toEqual(['', ''])
  })
})
