import { describe, expect, it } from 'vitest'
import { EMPTY_SESSION, parseSessionMeta } from './session'
import { MAX_CARS, TELEMETRY_VAR_NAMES } from './telemetry'
import type { TelemetryFrame } from './telemetry'
import { tyreCompoundOf, tyreLetter, tyreModelOf, tyresVary } from './tyres'
import type { DriverEntry, SessionMeta } from './types'

const MISSING_VARS = Object.fromEntries(
  TELEMETRY_VAR_NAMES.map((n) => [n, []])
) as unknown as TelemetryFrame

function frame(compounds: Record<number, number> | null): TelemetryFrame {
  if (compounds === null) return MISSING_VARS
  const arr = new Array<number>(MAX_CARS).fill(-1)
  for (const [k, v] of Object.entries(compounds)) arr[Number(k)] = v
  return { ...MISSING_VARS, CarIdxTireCompound: arr }
}

function driver(carIdx: number, carId: number): DriverEntry {
  return {
    carIdx,
    userName: `Piloto ${carIdx}`,
    teamName: '',
    carNumber: String(carIdx),
    iRating: 1500,
    licString: 'B 3.00',
    licColor: null,
    classId: 1,
    classShortName: 'GT3',
    classColor: '#ffffff',
    classEstLapTime: 100,
    isPaceCar: false,
    isSpectator: false,
    licLevel: 12,
    licSubLevel: 300,
    classRelSpeed: 0,
    userId: 100 + carIdx,
    teamId: 0,
    carId,
    carName: '',
    isAI: false
  }
}

function session(o: Partial<SessionMeta> = {}): SessionMeta {
  return {
    ...EMPTY_SESSION,
    playerCarIdx: 0,
    drivers: new Map([
      [0, driver(0, 67)],
      [1, driver(1, 67)],
      [2, driver(2, 128)]
    ]),
    tyreCompounds: new Map([
      [0, 'Hard'],
      [1, 'Wet']
    ]),
    ...o
  }
}

describe('tyreCompoundOf', () => {
  it('names the compound of every car of your model', () => {
    const s = session()
    const f = frame({ 0: 0, 1: 1, 2: 0 })
    const model = tyreModelOf(s)
    expect(model).toEqual({ carIdx: 0, carId: 67 })
    expect(tyreCompoundOf(f, s, model, 0)).toBe('Hard')
    expect(tyreCompoundOf(f, s, model, 1)).toBe('Wet')
  })

  it('names nothing for another model, whose indices mean other tyres', () => {
    const s = session()
    expect(tyreCompoundOf(frame({ 2: 0 }), s, tyreModelOf(s), 2)).toBeNull()
  })

  it('names nothing without a compound, a list or the variable', () => {
    const s = session()
    const model = tyreModelOf(s)
    expect(tyreCompoundOf(frame({ 0: -1 }), s, model, 0)).toBeNull()
    expect(tyreCompoundOf(frame({ 0: 5 }), s, model, 0)).toBeNull()
    expect(tyreCompoundOf(frame(null), s, model, 0)).toBeNull()
    const noList = session({ tyreCompounds: new Map() })
    expect(tyreCompoundOf(frame({ 0: 0 }), noList, tyreModelOf(noList), 0)).toBeNull()
  })

  it('without a known model, still names your own car', () => {
    const s = session({
      drivers: new Map([
        [0, driver(0, 0)],
        [1, driver(1, 0)]
      ])
    })
    const model = tyreModelOf(s)
    expect(model.carId).toBe(0)
    const f = frame({ 0: 1, 1: 1 })
    expect(tyreCompoundOf(f, s, model, 0)).toBe('Wet')
    // Car 1 may well be another model: no name.
    expect(tyreCompoundOf(f, s, model, 1)).toBeNull()
    expect(tyreModelOf(session({ playerCarIdx: -1 }))).toEqual({ carIdx: -1, carId: 0 })
  })
})

// Lime Rock MX-5: compound 0 (Hard) on every car, a column of 'H' on every row (Q10).
describe('tyresVary', () => {
  it('is false while every named car runs TireIndex 0, true once one does not', () => {
    const s = session()
    const model = tyreModelOf(s)
    expect(tyresVary(frame({ 0: 0, 1: 0 }), s, model)).toBe(false)
    expect(tyresVary(frame({ 0: 0, 1: 1 }), s, model)).toBe(true)
    // Everyone on wets: it says something too.
    expect(tyresVary(frame({ 0: 1, 1: 1 }), s, model)).toBe(true)
  })

  it('ignores cars it cannot name and missing data', () => {
    const s = session()
    const model = tyreModelOf(s)
    // Car 2 is another model: its 1 is not a known compound.
    expect(tyresVary(frame({ 0: 0, 1: 0, 2: 1 }), s, model)).toBe(false)
    expect(tyresVary(frame({ 0: -1, 1: -1 }), s, model)).toBe(false)
    expect(tyresVary(frame(null), s, model)).toBe(false)
    const noList = session({ tyreCompounds: new Map() })
    expect(tyresVary(frame({ 0: 1 }), noList, tyreModelOf(noList))).toBe(false)
  })
})

describe('tyreLetter', () => {
  it('is the upper-case initial, empty for no name', () => {
    expect(tyreLetter('Hard')).toBe('H')
    expect(tyreLetter(' wet ')).toBe('W')
    expect(tyreLetter('')).toBe('')
    expect(tyreLetter(null)).toBe('')
  })
})

describe('DriverTires in the session info', () => {
  it('maps TireIndex to TireCompoundType, skipping broken entries', () => {
    const meta = parseSessionMeta({
      DriverInfo: {
        DriverCarIdx: 3,
        DriverTires: [
          { TireIndex: 0, TireCompoundType: 'Hard' },
          { TireIndex: '1', TireCompoundType: 'Wet' },
          { TireIndex: 1, TireCompoundType: 'Soft' },
          { TireIndex: -1, TireCompoundType: 'Bad' },
          { TireIndex: 2.5, TireCompoundType: 'Bad' },
          { TireIndex: 3, TireCompoundType: '  ' },
          'junk'
        ]
      }
    })
    expect([...meta.tyreCompounds]).toEqual([
      [0, 'Hard'],
      [1, 'Wet']
    ])
  })

  it('is empty when the session info has no list', () => {
    expect(parseSessionMeta({ DriverInfo: { DriverCarIdx: 0 } }).tyreCompounds.size).toBe(0)
    expect(parseSessionMeta({ DriverInfo: { DriverTires: 'none' } }).tyreCompounds.size).toBe(0)
    expect(EMPTY_SESSION.tyreCompounds.size).toBe(0)
  })
})
