import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { RELATIVE_COLUMN_IDS, STANDINGS_COLUMN_IDS } from '@shared/settingsSchema'
import {
  gapShowsLeader,
  relativeHead,
  standingsHead,
  type StandingsHeadContext
} from './columnHeads'

const ES = messagesFor('es')
const EN = messagesFor('en')
const RACE: StandingsHeadContext = { gapMode: 'interval', race: true, licenseStyle: 'outline' }

describe('gapShowsLeader', () => {
  it('follows the gap mode and the session, as the column does', () => {
    expect(gapShowsLeader('interval', true)).toBe(false)
    expect(gapShowsLeader('both', true)).toBe(false)
    expect(gapShowsLeader('leader', true)).toBe(true)
    expect(gapShowsLeader('interval', false)).toBe(true)
    expect(gapShowsLeader('both', false)).toBe(false)
  })
})

describe('standingsHead', () => {
  it('the gap column: interval, leader, or the gap to the best outside races', () => {
    expect(standingsHead('gap', RACE, ES).label).toBe('INT.')
    expect(standingsHead('gap', { ...RACE, gapMode: 'leader' }, ES).label).toBe('LÍDER')
    expect(standingsHead('gap', { ...RACE, race: false }, ES).label).toBe('DIF.')
    expect(standingsHead('gapLeader', RACE, EN).label).toBe('LEADER')
  })

  it('the last lap reads the best outside races; the licence its SR, or LIC with the letter', () => {
    expect(standingsHead('last', RACE, ES).label).toBe('ÚLTIMA')
    expect(standingsHead('last', { ...RACE, race: false }, ES).label).toBe('MEJOR')
    expect(standingsHead('lic', RACE, ES).label).toBe('SR')
    expect(standingsHead('lic', { ...RACE, licenseStyle: 'letter' }, ES).label).toBe('LIC.')
  })

  it('aligns names left, figures right, chips centred; every column has a head', () => {
    expect(standingsHead('name', RACE, ES)).toEqual({ label: 'PILOTO', align: 'start' })
    expect(standingsHead('pos', RACE, EN)).toEqual({ label: 'POS', align: 'start' })
    expect(standingsHead('pit', RACE, ES).align).toBe('center')
    expect(standingsHead('ir', RACE, ES).align).toBe('end')
    for (const m of [ES, EN]) {
      for (const id of STANDINGS_COLUMN_IDS) {
        const h = standingsHead(id, RACE, m)
        // The tyre is a glyph; the rest a short caption.
        if (id === 'tyre') expect(h.label).toBe('')
        else expect(h.label.length, id).toBeGreaterThan(0)
        expect(h.label.length, id).toBeLessThanOrEqual(7)
      }
    }
  })
})

describe('relativeHead', () => {
  it('heads every cell of the row', () => {
    expect(relativeHead('driver', 'outline', ES)).toEqual({ label: 'PILOTO', align: 'start' })
    expect(relativeHead('gap', 'outline', EN)).toEqual({ label: 'GAP', align: 'end' })
    expect(relativeHead('lic', 'letter', EN).label).toBe('LIC')
    for (const id of RELATIVE_COLUMN_IDS) {
      expect(relativeHead(id, 'outline', ES).label.length, id).toBeLessThanOrEqual(7)
    }
  })
})
