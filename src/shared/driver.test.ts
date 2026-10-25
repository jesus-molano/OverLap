import { describe, expect, it } from 'vitest'
import { driverIdentity, identityEqual } from './driver'
import type { DriverEntry } from './types'

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
      licColor: '#00c702'
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
      { licColor: null }
    ]) {
      expect(identityEqual(a, { ...a, ...change })).toBe(false)
    }
  })
})
