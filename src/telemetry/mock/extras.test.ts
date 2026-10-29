/**
 * The standings' and the relative's stint, stop, tyre and flag extras in mock mode: the real
 * mock race through the real RaceModel and providers, every extra turned on.
 */
import { describe, expect, it } from 'vitest'
import { RaceModel } from '@shared/race/raceModel'
import { computeRelative } from '@shared/relative'
import { parseSessionMeta } from '@shared/session'
import { createDefaultSettings } from '@shared/settings'
import { StandingsProvider } from '@shared/standings'
import type { RelativeOptions, StandingsData, StandingsOptions } from '@shared/types'
import { MOCK_CLASSES } from './drivers'
import { MockRace } from './simulation'
import { at, run } from './testUtils'
import { HARD, MOCK_DRIVER_TIRES, WET, mockTyreCompound } from './tyres'
import { MOCK_WARNING } from './warnings'

const DEFAULTS = createDefaultSettings()
const STANDINGS: StandingsOptions = {
  ...DEFAULTS.standings,
  mode: 'full',
  columns: DEFAULTS.standings.columns.map((c) => ({ ...c, visible: true }))
}
const RELATIVE: RelativeOptions = {
  ...DEFAULTS.relative,
  columns: DEFAULTS.relative.columns.map((c) => ({ ...c, visible: true })),
  showFlags: true
}

const rowsOf = (d: StandingsData): StandingsData['classes'][number]['rows'] =>
  d.classes.flatMap((c) => c.rows)

describe('mock tyres', () => {
  it('names the GT3 compounds only, hards with a few wets', () => {
    const race = new MockRace()
    const info = race.sessionInfo()
    expect(info.DriverInfo.DriverTires).toEqual(MOCK_DRIVER_TIRES.map((t) => ({ ...t })))
    const session = parseSessionMeta(info)
    expect([...session.tyreCompounds]).toEqual([
      [HARD, 'Hard'],
      [WET, 'Wet']
    ])
    const f = race.frame()
    const racers = info.DriverInfo.Drivers.filter((d) => !d.CarIsPaceCar && !d.IsSpectator)
    const compounds = racers.map((d) => at(f.CarIdxTireCompound, d.CarIdx))
    expect(new Set(compounds)).toEqual(new Set([HARD, WET]))
    expect(compounds.filter((c) => c === WET).length).toBeLessThan(compounds.length / 3)
    // Deterministic: the car battling the player from behind is one of them.
    expect(mockTyreCompound(race.cast.battleBehind, race.cast)).toBe(WET)
    // The pace car and the spectator have none.
    for (const d of info.DriverInfo.Drivers.filter((x) => x.CarIsPaceCar || x.IsSpectator)) {
      expect(at(f.CarIdxTireCompound, d.CarIdx)).toBe(-1)
    }
  })
})

describe('mock extras through the providers', () => {
  const race = new MockRace()
  const session = parseSessionMeta(race.sessionInfo())
  const model = new RaceModel()
  const standings = new StandingsProvider()
  const { battleAhead, meatball } = race.cast
  const samples: { t: number; table: StandingsData; rel: ReturnType<typeof computeRelative> }[] = []
  run(race, 400, 1 / 20, (f, t) => {
    model.update(f, session)
    if (Math.round(t * 20) % 100 !== 0) return
    samples.push({
      t,
      table: standings.compute(f, session, model.view, STANDINGS),
      rel: computeRelative(f, session, RELATIVE, model.view)
    })
  })
  const sampleAt = (t: number): (typeof samples)[number] => {
    const s = samples.find((x) => x.t >= t)
    if (!s) throw new Error(`no sample at ${t}`)
    return s
  }

  it('gives every car a stint from the start of the race (joined after the green)', () => {
    const rows = rowsOf(at(samples, 0).table)
    expect(rows.every((r) => r.stintLaps !== null && r.stintLaps > 10)).toBe(true)
  })

  it('shows a stop: the lap it was on, a fresh stint', () => {
    const last = rowsOf(at(samples, samples.length - 1).table)
    const stopped = last.filter((r) => (r.pitStops ?? 0) > 0 && r.lastPitLap !== null)
    expect(stopped.length).toBeGreaterThan(0)
    for (const r of stopped) expect(r.stintLaps).toBeLessThan(5)
  })

  it('names the tyres of the GT3s and of nobody else', () => {
    const rows = rowsOf(at(samples, 0).table)
    const gt3 = MOCK_CLASSES.GT3.id
    const classOf = new Map([...session.drivers].map(([i, d]) => [i, d.classId]))
    for (const r of rows) {
      if (classOf.get(r.carIdx) === gt3) expect(['Hard', 'Wet']).toContain(r.tyre)
      else expect(r.tyre).toBeNull()
    }
    expect(at(samples, 0).rel.rows.some((r) => r.tyre === 'Wet')).toBe(true)
  })

  it('badges the warning on the battle car ahead while it is out, the meatball before it', () => {
    const { atS, forS } = MOCK_WARNING
    const before = sampleAt(60)
    expect(rowsOf(before.table).find((r) => r.carIdx === meatball)?.penalty).toBe('meatball')
    expect(rowsOf(before.table).find((r) => r.carIdx === battleAhead)?.penalty).toBeNull()
    const during = sampleAt(atS + forS / 2)
    const rowAhead = rowsOf(during.table).find((r) => r.carIdx === battleAhead)
    expect(rowAhead?.penalty).toBe('furled')
    // The relative shows it too: the battle car is the car right ahead of you.
    expect(during.rel.rows.find((r) => r.carIdx === battleAhead)?.penalty).toBe('furled')
    const after = sampleAt(atS + forS + 10)
    expect(rowsOf(after.table).find((r) => r.carIdx === battleAhead)?.penalty).toBeNull()
  })
})
