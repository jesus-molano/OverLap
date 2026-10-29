import { describe, expect, it } from 'vitest'
import { driverIdentity, fieldHasMultipleBrands, identityEqual } from './driver'
import { makeDriver, makeSession } from './race/testing/raceSim'
import type { DriverEntry, SessionMeta } from './types'

function entry(o: Partial<DriverEntry> = {}): DriverEntry {
  return {
    carIdx: 4,
    userName: 'Alejandro Ruiz',
    teamName: '',
    carNumber: '07',
    iRating: 2412,
    licString: 'B 3.21',
    licColor: '#00c702',
    classId: 1,
    classShortName: 'GT3',
    classColor: '#ffda59',
    classEstLapTime: 100,
    isPaceCar: false,
    isSpectator: false,
    licLevel: 14,
    licSubLevel: 321,
    classRelSpeed: 0,
    userId: 123,
    teamId: 0,
    carId: 67,
    carName: 'Porsche 911 GT3 R',
    isAI: false,
    brand: 'unknown',
    country: '',
    ...o
  }
}

describe('driverIdentity', () => {
  it('maps the display fields of a DriverEntry', () => {
    expect(driverIdentity(entry())).toEqual({
      carIdx: 4,
      carNumber: '07',
      driverName: 'Alejandro Ruiz',
      classColor: '#ffda59',
      iRating: 2412,
      licString: 'B 3.21',
      licColor: '#00c702',
      brand: 'unknown',
      country: ''
    })
  })

  it('turns unknown iRating and licence into null', () => {
    const id = driverIdentity(entry({ iRating: 0, licString: '', licColor: null }))
    expect(id.iRating).toBeNull()
    expect(id.licString).toBeNull()
    expect(id.licColor).toBeNull()
    expect(driverIdentity(entry({ iRating: -1 })).iRating).toBeNull()
  })

  it("leaves out a name iRacing turned into '?', with the team's when that one is known", () => {
    // Outside team races TeamName is the same '?' name: nothing to stand in.
    const solo = driverIdentity(entry({ userName: '?????? ?????', teamName: '?????? ?????' }))
    expect(solo.driverName).toBe('')
    expect('teamName' in solo).toBe(false)
    expect(driverIdentity(entry({ userName: ' ?? - ?. ', teamName: '' })).driverName).toBe('')
    // Team races: the team stands in for the driver in the car.
    const team = driverIdentity(entry({ userName: '???? ??????', teamName: 'Équipe Rouge' }))
    expect(team).toMatchObject({ driverName: '', teamName: 'Équipe Rouge' })
    // A name with any letter or digit is the driver's own, whatever the team.
    expect(driverIdentity(entry({ userName: 'Ivan ??????', teamName: 'Équipe Rouge' }))).toEqual(
      driverIdentity(entry({ userName: 'Ivan ??????' }))
    )
    expect(driverIdentity(entry({ userName: '?? 77' })).driverName).toBe('?? 77')
  })
})

describe('identityEqual', () => {
  it('compares every identity field', () => {
    const a = driverIdentity(entry())
    expect(identityEqual(a, { ...a })).toBe(true)
    for (const change of [
      { carIdx: 5 },
      { carNumber: '7' },
      { driverName: 'X' },
      { teamName: 'Équipe Rouge' },
      { classColor: '#ffffff' },
      { iRating: null },
      { licString: 'A 1.00' },
      { licColor: null },
      { brand: 'bmw' as const },
      { country: 'ES' }
    ]) {
      expect(identityEqual(a, { ...a, ...change })).toBe(false)
    }
  })
})

describe('the make and the country on every row', () => {
  it('come from the entry', () => {
    const id = driverIdentity(entry({ brand: 'ferrari', country: 'IT' }))
    expect(id).toMatchObject({ brand: 'ferrari', country: 'IT' })
  })
})

describe('fieldHasMultipleBrands', () => {
  const field = (brands: DriverEntry['brand'][], o: Partial<SessionMeta> = {}): SessionMeta =>
    makeSession(
      brands.length,
      o,
      brands.map((brand, i) => makeDriver(i, { brand }))
    )

  it('counts the known makes of the field', () => {
    expect(fieldHasMultipleBrands(field(['porsche', 'porsche']))).toBe(false)
    expect(fieldHasMultipleBrands(field(['porsche', 'bmw']))).toBe(true)
    expect(fieldHasMultipleBrands(field(['porsche', 'unknown', 'unknown']))).toBe(false)
  })

  it('leaves out the pace car and spectators', () => {
    const s = makeSession(3, { paceCarIdx: 2 }, [
      makeDriver(0, { brand: 'mazda' }),
      makeDriver(1, { brand: 'toyota', isSpectator: true }),
      makeDriver(2, { brand: 'bmw', isPaceCar: true })
    ])
    expect(fieldHasMultipleBrands(s)).toBe(false)
  })

  it('is memoised per session object', () => {
    const s = field(['porsche', 'bmw'])
    expect(fieldHasMultipleBrands(s)).toBe(true)
    // The same object: the cached answer (sessions are replaced, never edited).
    ;(s.drivers as Map<number, DriverEntry>).clear()
    expect(fieldHasMultipleBrands(s)).toBe(true)
  })
})
