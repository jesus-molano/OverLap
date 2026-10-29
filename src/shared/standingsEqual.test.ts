import { describe, expect, it } from 'vitest'
import type {
  ConditionsData,
  SafetyRatingProjection,
  StandingsClassBlock,
  StandingsData
} from './types'
import { NO_INFO } from './infoFeed'
import { standingsEqual } from './standingsEqual'

type Row = StandingsClassBlock['rows'][number]

function row(carIdx: number, o: Partial<Row> = {}): Row {
  return {
    carIdx,
    isPlayer: carIdx === 0,
    classPosition: carIdx + 1,
    positionsGained: 1,
    carNumber: String(carIdx),
    driverName: `Piloto ${carIdx}`,
    classColor: '#ffda59',
    iRating: 2000,
    licString: 'B 3.12',
    licColor: '#00c702',
    brand: 'mazda',
    country: 'ES',
    interval: { kind: 'time', seconds: 1.5 },
    gapToLeader: { kind: 'time', seconds: 3 },
    lastLap: 90.1,
    lastLapKind: 'normal',
    bestLap: 89.9,
    bestLapKind: 'normal',
    pitStops: 1,
    lastPitLap: 3,
    outLap: false,
    towed: false,
    stintLaps: 5,
    tyre: 'Hard',
    status: 'running',
    penalty: null,
    iRatingDelta: 12,
    gapBefore: false,
    ...o
  }
}

function state(): StandingsData {
  return {
    header: {
      sessionType: 'Race',
      lapsRemaining: 5,
      timeRemainingS: 100,
      iRating: {
        iRatingDelta: 12,
        perPosition: 9.9,
        breakEvenPosition: 4,
        ifGainOne: 22,
        ifLoseOne: 2
      },
      safetyRating: {
        current: 3.12,
        projected: 3.1,
        licClass: 'B',
        projectedLicClass: 'B',
        incidents: 2,
        corners: 40,
        incidentBudget: 3
      },
      incidents: { mine: 2, team: 5, limit: { kind: 'penalty', at: 17 } }
    },
    classes: [
      {
        classId: 1,
        className: 'MX5',
        classColor: '#ffda59',
        sof: 2000,
        carCount: 6,
        isPlayerClass: true,
        rows: [row(0), row(1), row(2, { interval: { kind: 'laps', laps: 1 } })]
      },
      {
        classId: 2,
        className: 'GT3',
        classColor: '#ff5888',
        sof: null,
        carCount: 2,
        isPlayerClass: false,
        rows: [row(10)]
      }
    ],
    info: {
      ...NO_INFO,
      sessionType: 'Race',
      lapsRemaining: 5,
      sof: 2000,
      fastestLap: {
        lapTime: 89.9,
        carIdx: 0,
        carNumber: '0',
        driverName: 'Piloto 0',
        isPlayer: true
      },
      conditions: weather()
    },
    multiBrand: false
  }
}

function weather(): ConditionsData {
  return {
    visible: true,
    trackTempC: 31.2,
    trackTempTrend: 'up',
    airTempC: 22,
    windKmh: 14,
    windFromDeg: -60,
    wetness: 1,
    precipPct: 0,
    declaredWet: false,
    skies: 1,
    rubberState: 'moderate usage',
    rubberCarried: false
  }
}

/** A value of the same kind that differs from `v`. */
function changed(v: unknown): unknown {
  if (typeof v === 'number') return v + 1
  if (typeof v === 'string') return `${v}x`
  if (typeof v === 'boolean') return !v
  if (v === null) return 12345
  return { kind: 'time', seconds: 999 }
}

describe('standingsEqual', () => {
  it('is true for the same state built twice and for itself', () => {
    const a = state()
    expect(standingsEqual(a, state())).toBe(true)
    expect(standingsEqual(a, a)).toBe(true)
  })

  it('treats NaN as equal to NaN', () => {
    const a = state()
    const b = state()
    const ra = a.classes[0]?.rows[0]
    const rb = b.classes[0]?.rows[0]
    if (!ra || !rb) throw new Error('no row')
    ra.lastLap = NaN
    rb.lastLap = NaN
    expect(standingsEqual(a, b)).toBe(true)
  })

  it('detects a change in any row field', () => {
    const a = state()
    const keys = Object.keys(row(1)) as (keyof Row)[]
    expect(keys.length).toBeGreaterThan(20)
    for (const key of keys) {
      const b = state()
      const r = b.classes[0]?.rows[1] as unknown as Record<string, unknown>
      r[key] = changed(r[key])
      expect(standingsEqual(a, b), key).toBe(false)
    }
  })

  it('detects gap kind and value changes', () => {
    const a = state()
    const b = state()
    const c = state()
    const rb = b.classes[0]?.rows[2]
    const rc = c.classes[0]?.rows[2]
    if (!rb || !rc) throw new Error('no row')
    rb.interval = { kind: 'time', seconds: 1 }
    rc.interval = { kind: 'laps', laps: 2 }
    expect(standingsEqual(a, b)).toBe(false)
    expect(standingsEqual(a, c)).toBe(false)
  })

  it('detects header and class changes', () => {
    const a = state()
    for (const key of Object.keys(a.header) as (keyof StandingsData['header'])[]) {
      const b = state()
      const h = b.header as unknown as Record<string, unknown>
      h[key] = key === 'iRating' || key === 'safetyRating' ? null : changed(h[key])
      expect(standingsEqual(a, b), key).toBe(false)
    }
    const ir = a.header.iRating
    if (!ir) throw new Error('no projection')
    for (const key of Object.keys(ir) as (keyof typeof ir)[]) {
      const b = state()
      b.header.iRating = { ...ir, [key]: changed(ir[key]) }
      expect(standingsEqual(a, b), key).toBe(false)
    }
    const sr = a.header.safetyRating
    if (!sr) throw new Error('no SR')
    for (const key of Object.keys(sr) as (keyof SafetyRatingProjection)[]) {
      const b = state()
      b.header.safetyRating = { ...sr, [key]: changed(sr[key]) }
      expect(standingsEqual(a, b), key).toBe(false)
    }
    const first = a.classes[0]
    if (!first) throw new Error('no class')
    for (const key of Object.keys(first).filter((k) => k !== 'rows')) {
      const b = state()
      const blk = b.classes[0] as unknown as Record<string, unknown>
      blk[key] = changed(blk[key])
      expect(standingsEqual(a, b), key).toBe(false)
    }
    const fewerRows = state()
    fewerRows.classes[0]?.rows.pop()
    expect(standingsEqual(a, fewerRows)).toBe(false)
    const fewerClasses = state()
    fewerClasses.classes.pop()
    expect(standingsEqual(a, fewerClasses)).toBe(false)
  })

  it('detects a change of the info bars data, and the bars turned on or off', () => {
    const a = state()
    for (const key of Object.keys(weather()) as (keyof ConditionsData)[]) {
      const b = state()
      const c = b.info?.conditions as unknown as Record<string, unknown>
      c[key] = key === 'trackTempTrend' ? 'down' : changed(c[key])
      expect(standingsEqual(a, b), key).toBe(false)
    }
    for (const key of Object.keys(NO_INFO).filter((k) => k !== 'conditions')) {
      const b = state()
      const i = b.info as unknown as Record<string, unknown>
      i[key] = changed(i[key])
      expect(standingsEqual(a, b), key).toBe(false)
    }
    const off = { ...state(), info: null }
    expect(standingsEqual(a, off)).toBe(false)
    expect(standingsEqual(off, a)).toBe(false)
    expect(standingsEqual(off, { ...state(), info: null })).toBe(true)
    // The field's makes turn the brand marks on in 'auto'.
    expect(standingsEqual(a, { ...state(), multiBrand: true })).toBe(false)
  })
})
