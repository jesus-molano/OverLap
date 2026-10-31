import { describe, expect, it } from 'vitest'
import {
  classListWith,
  classOfKey,
  classOrderKey,
  orderClasses,
  sameNames,
  sessionClassNames,
  type OrderableClass
} from './classOrder'
import type { DriverEntry, SessionMeta } from './types'

const GT3: OrderableClass = { classId: 1, name: 'GT3', relSpeed: 70 }
const LMP2: OrderableClass = { classId: 2, name: 'LMP2', relSpeed: 85 }
const GTP: OrderableClass = { classId: 3, name: 'GTP', relSpeed: 100 }
const GT4: OrderableClass = { classId: 4, name: 'GT4', relSpeed: 70 }
const ALL = [GT3, LMP2, GTP, GT4]
const names = (list: readonly OrderableClass[]): string[] => list.map((c) => c.name)

describe('orderClasses', () => {
  it('«Tu clase primero»: yours, then the faster ones (the same speed by class id)', () => {
    expect(names(orderClasses(ALL, GT4, 'player', []))).toEqual(['GT4', 'GTP', 'LMP2', 'GT3'])
    // Spectating: the fastest first.
    expect(names(orderClasses(ALL, undefined, 'player', []))).toEqual(['GTP', 'LMP2', 'GT3', 'GT4'])
  })

  it('«La más rápida primero»: by speed, yours in its place', () => {
    expect(names(orderClasses(ALL, GT4, 'speed', []))).toEqual(['GTP', 'LMP2', 'GT3', 'GT4'])
  })

  it('«A mano»: the list first, in its order and any case, then the others by speed', () => {
    expect(names(orderClasses(ALL, GT4, 'manual', ['gt4', 'GT3']))).toEqual([
      'GT4',
      'GT3',
      'GTP',
      'LMP2'
    ])
    // Names of other sessions are skipped; a repeated name keeps its first place.
    expect(names(orderClasses(ALL, GT3, 'manual', ['M2', 'LMP2', 'GTP', 'lmp2 ']))).toEqual([
      'LMP2',
      'GTP',
      'GT3',
      'GT4'
    ])
    expect(names(orderClasses(ALL, GT3, 'manual', []))).toEqual(['GTP', 'LMP2', 'GT3', 'GT4'])
  })

  it('never names a class without a name, and leaves its input as it was', () => {
    const unnamed: OrderableClass = { classId: 9, name: '', relSpeed: 200 }
    const input = [GT3, unnamed]
    expect(orderClasses(input, GT3, 'manual', ['', 'GT3'])).toEqual([GT3, unnamed])
    expect(input).toEqual([GT3, unnamed])
  })
})

describe('the list’s names', () => {
  it('lists the saved names, then the others not named yet, each once', () => {
    expect(classListWith(['LMP2', 'gt3'], ['GTP', 'GT3', ''], ['LMP2', 'GT4 '])).toEqual([
      'LMP2',
      'gt3',
      'GTP',
      'GT4'
    ])
    expect(sameNames(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(sameNames(['a', 'b'], ['b', 'a'])).toBe(false)
  })

  it('gives each name a plain id and reads it back (in lower case)', () => {
    for (const name of ['GT3', 'LMP2', 'Porsche 911 Cup', 'Fórmula Vee', 'GT3 Class']) {
      const key = classOrderKey(name)
      expect(key).toMatch(/^[a-p]+$/)
      expect(classOfKey(key)).toBe(name.toLowerCase())
    }
    expect(classOrderKey('GT3')).toBe('aaghaaheaadd')
    // One id for the spellings the list takes as one class: a drag on either finds its row.
    expect(classOrderKey(' gt3 ')).toBe(classOrderKey('GT3'))
    expect(classOrderKey('  ')).toBe('')
    for (const bad of ['', 'abc', 'aaeq', 'AAEH', 'standings']) expect(classOfKey(bad)).toBeNull()
  })
})

describe('sessionClassNames', () => {
  const driver = (carIdx: number, o: Partial<DriverEntry>): DriverEntry =>
    ({
      carIdx,
      classId: 1,
      classShortName: 'GT3',
      classRelSpeed: 70,
      isPaceCar: false,
      isSpectator: false,
      ...o
    }) as DriverEntry
  const session = (list: DriverEntry[], paceCarIdx = -1): SessionMeta =>
    ({ paceCarIdx, drivers: new Map(list.map((d) => [d.carIdx, d])) }) as unknown as SessionMeta

  it('names the classes of a multiclass session, the fastest first', () => {
    const s = session([
      driver(0, {}),
      driver(1, { classId: 2, classShortName: 'LMP2', classRelSpeed: 85 }),
      driver(2, { classId: 3, classShortName: '', classRelSpeed: 100 }),
      driver(3, { classId: 3, classShortName: 'GTP', classRelSpeed: 100 }),
      // The pace car and a spectator are no class.
      driver(4, { classId: 11, classShortName: 'Safety', classRelSpeed: 300, isPaceCar: true }),
      driver(5, { classId: 12, classShortName: 'Cam', isSpectator: true }),
      driver(6, { classId: 13, classShortName: 'Pace', classRelSpeed: 400 })
    ])
    expect(sessionClassNames(s)).toEqual(['Pace', 'GTP', 'LMP2', 'GT3'])
    expect(sessionClassNames({ ...s, paceCarIdx: 6 })).toEqual(['GTP', 'LMP2', 'GT3'])
  })

  it('names none with one class', () => {
    expect(sessionClassNames(session([driver(0, {}), driver(1, {})]))).toEqual([])
    expect(sessionClassNames(session([]))).toEqual([])
  })
})
