import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import type { StandingsColumnId } from '@shared/types'
import { fitColumns, type ColumnPrefs } from './columns'
import type { StandingsHeadContext } from '@renderer/view/columnHeads'
import { reuseHeads, toHeadsView } from './heads'
import { allColumns, defaultColumns } from './testing/rows'

const ES = messagesFor('es')
const EN = messagesFor('en')
const RACE: StandingsHeadContext = { gapMode: 'interval', race: true, licenseStyle: 'outline' }

const labels = (cells: readonly StandingsColumnId[], c = RACE, m = ES): string[] =>
  toHeadsView({ cells }, c, m).map((h) => h.label)

function prefs(over: Partial<ColumnPrefs> = {}): ColumnPrefs {
  return {
    columns: defaultColumns(),
    gapMode: 'interval',
    iRatingDeltaAll: false,
    race: true,
    tyres: true,
    licenseStyle: 'outline',
    numberStyle: 'chip',
    brand: false,
    flag: false,
    ...over
  }
}

describe('toHeadsView', () => {
  it('heads every track: position, name, then the cells in their order', () => {
    expect(labels(['gained', 'ir', 'lic', 'gap', 'last', 'best', 'pit'])).toEqual([
      'POS',
      'PILOTO',
      '±',
      'iR',
      'SR',
      'INT.',
      'ÚLTIMA',
      'MEJOR',
      'BOX'
    ])
    expect(labels(['pit', 'gap'])).toEqual(['POS', 'PILOTO', 'BOX', 'INT.'])
  })

  it('aligns names left, figures right and chips centred', () => {
    const v = toHeadsView({ cells: ['ir', 'lic', 'gap', 'tyre'] }, RACE, ES)
    expect(v.map((h) => h.align)).toEqual(['start', 'start', 'end', 'center', 'end', 'center'])
    // The tyre ring is a glyph: no caption.
    expect(v.at(-1)?.label).toBe('')
  })

  it('follows the gap mode and the session like the cells', () => {
    expect(labels(['gap'], { ...RACE, gapMode: 'leader' })).toContain('LÍDER')
    expect(labels(['gap', 'gapLeader'], { ...RACE, gapMode: 'both' })).toEqual([
      'POS',
      'PILOTO',
      'INT.',
      'LÍDER'
    ])
    // Outside races the gap is to the fastest lap, and 'last' shows the best lap.
    const practice = { ...RACE, race: false }
    expect(labels(['gap', 'last'], practice)).toEqual(['POS', 'PILOTO', 'DIF.', 'MEJOR'])
  })

  it('words the licence by its style and speaks English', () => {
    expect(labels(['lic'], { ...RACE, licenseStyle: 'letter' })).toContain('LIC.')
    expect(labels(['gap', 'pit'], RACE, EN)).toEqual(['POS', 'DRIVER', 'INT', 'PIT'])
  })

  it('follows the narrow-width dropping (the same Columns as the rows)', () => {
    const p = prefs({ columns: allColumns() })
    const wide = fitColumns(p, 1200, 13)
    const narrow = fitColumns(p, 300, 13)
    expect(toHeadsView(wide, RACE, ES)).toHaveLength(2 + wide.cells.length)
    expect(toHeadsView(narrow, RACE, ES)).toHaveLength(2 + narrow.cells.length)
    expect(narrow.cells.length).toBeLessThan(wide.cells.length)
  })

  it('has no position head when the position is hidden (showPosition)', () => {
    const v = toHeadsView({ cells: ['gap'], pos: false }, RACE, ES)
    expect(v.map((h) => h.id)).toEqual(['name', 'gap'])
  })
})

describe('reuseHeads', () => {
  it('keeps the previous heads while they read the same', () => {
    const a = toHeadsView({ cells: ['gap'] }, RACE, ES)
    expect(reuseHeads(a, toHeadsView({ cells: ['gap'] }, RACE, ES))).toBe(a)
    const b = toHeadsView({ cells: ['gap'] }, { ...RACE, gapMode: 'leader' }, ES)
    expect(reuseHeads(a, b)).toBe(b)
    expect(reuseHeads(a, toHeadsView({ cells: ['gap', 'pit'] }, RACE, ES))).not.toBe(a)
    expect(reuseHeads(undefined, a)).toBe(a)
  })
})

describe('the heads of the columns', () => {
  it('carry their data-el, the fixed ones none', () => {
    const v = toHeadsView({ cells: ['ir', 'gap'] }, RACE, ES)
    expect(v.map((h) => h.el)).toEqual([
      undefined,
      undefined,
      'standings.columns.ir',
      'standings.columns.gap'
    ])
  })
})
