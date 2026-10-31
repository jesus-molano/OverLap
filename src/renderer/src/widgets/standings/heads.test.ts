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

/** Today's row: the position and the name's cell (the number in it), then `cells`. */
const T = (cells: readonly StandingsColumnId[]): { tracks: StandingsColumnId[] } => ({
  tracks: ['pos', 'driver', ...cells]
})

const labels = (cells: readonly StandingsColumnId[], c = RACE, m = ES): string[] =>
  toHeadsView(T(cells), c, m).map((h) => h.label)

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
    const v = toHeadsView(T(['ir', 'lic', 'gap', 'tyre']), RACE, ES)
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
    expect(toHeadsView(wide, RACE, ES)).toHaveLength(wide.tracks.length)
    expect(toHeadsView(narrow, RACE, ES)).toHaveLength(narrow.tracks.length)
    expect(narrow.tracks.length).toBeLessThan(wide.tracks.length)
  })

  it('has no position head when the position is hidden (its eye)', () => {
    const v = toHeadsView({ tracks: ['driver', 'gap'] }, RACE, ES)
    expect(v.map((h) => h.id)).toEqual(['driver', 'gap'])
  })

  it('heads the row’s start where the list puts it (request 11)', () => {
    // The number set apart from the name: '#' over its track; the make and the flags: glyphs.
    const v = toHeadsView({ tracks: ['pos', 'gained', 'number', 'driver', 'brand'] }, RACE, ES)
    expect(v.map((h) => h.label)).toEqual(['POS', '±', '#', 'PILOTO', ''])
    // From the fitted columns: one head per track, the parts in the name's cell under 'PILOTO'.
    const cols = fitColumns(prefs({ brand: true, flag: true }), 900, 13)
    expect(toHeadsView(cols, RACE, ES).map((h) => h.id)).toEqual(cols.tracks)
  })
})

describe('reuseHeads', () => {
  it('keeps the previous heads while they read the same', () => {
    const a = toHeadsView(T(['gap']), RACE, ES)
    expect(reuseHeads(a, toHeadsView(T(['gap']), RACE, ES))).toBe(a)
    const b = toHeadsView(T(['gap']), { ...RACE, gapMode: 'leader' }, ES)
    expect(reuseHeads(a, b)).toBe(b)
    expect(reuseHeads(a, toHeadsView(T(['gap', 'pit']), RACE, ES))).not.toBe(a)
    expect(reuseHeads(undefined, a)).toBe(a)
  })
})

describe('the heads of the columns', () => {
  it('carry their data-el, the row’s start too (request 11)', () => {
    const v = toHeadsView(T(['ir', 'gap']), RACE, ES)
    expect(v.map((h) => h.el)).toEqual([
      'standings.columns.pos',
      'standings.columns.driver',
      'standings.columns.ir',
      'standings.columns.gap'
    ])
  })
})
