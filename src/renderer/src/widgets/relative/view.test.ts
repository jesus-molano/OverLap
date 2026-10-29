import { describe, expect, it } from 'vitest'
import { moveElement, setElementVisible } from '@shared/elements'
import { MINUS } from '@shared/format'
import { messagesFor } from '@shared/i18n'
import { DEFAULT_SETTINGS, normalizeSettings } from '@shared/settings'
import type { RelativeData, RelativeRow } from '@shared/types'
import { reuseViews } from '@renderer/view/reuse'
import { createDriverStyles } from '@renderer/view/styles'
import { previewRelative } from './preview'
import {
  BRAND_FIT_EM,
  CHROME_BASE_EM,
  FLAG_FIT_EM,
  HEADS_EM,
  RELATIVE_FIT_EM,
  RELATIVE_ROW_EM,
  chromeEm,
  layoutSlots,
  relativeColumns,
  relativeHeads,
  relativeRowEm,
  toSlotView,
  toSlotViews,
  type RelativeSlotView,
  type SlotView
} from './view'

const M = MINUS
const ES = messagesFor('es')
const EN = messagesFor('en')

function row(carIdx: number, over: Partial<RelativeRow> = {}): RelativeRow {
  return {
    carIdx,
    isPlayer: false,
    classPosition: carIdx + 1,
    carNumber: String(carIdx),
    driverName: `Driver Number${carIdx}`,
    classShortName: 'GT3',
    classColor: '#33ceff',
    iRating: 2000,
    licString: 'A 3.41',
    licColor: '#0153db',
    brand: 'porsche',
    country: 'ES',
    gapS: 1.5,
    lapRelation: 'same',
    inPits: false,
    towed: false,
    stintLaps: null,
    tyre: null,
    penalty: null,
    ...over
  }
}

/** Rows ahead (closest last), the player, then rows behind. */
function data(ahead: number, behind: number, slots = 3): RelativeData {
  const rows: RelativeRow[] = []
  for (let i = 0; i < ahead; i++) rows.push(row(10 + i))
  rows.push(row(0, { isPlayer: true, gapS: 0 }))
  for (let i = 0; i < behind; i++) rows.push(row(20 + i, { gapS: -1 - i }))
  return {
    rows,
    playerRow: ahead,
    slotsAhead: slots,
    slotsBehind: slots,
    sessionType: 'Race',
    incidents: null,
    info: null,
    multiBrand: false
  }
}

const ids = (slots: readonly (RelativeRow | null)[]): (number | null)[] =>
  slots.map((r) => r?.carIdx ?? null)

describe('layoutSlots', () => {
  it('keeps the player in the centre slot', () => {
    expect(ids(layoutSlots(data(3, 3), 3, 3))).toEqual([10, 11, 12, 0, 20, 21, 22])
  })

  it('pads above with fewer cars ahead and below with fewer behind', () => {
    expect(ids(layoutSlots(data(1, 3), 3, 3))).toEqual([null, null, 10, 0, 20, 21, 22])
    expect(ids(layoutSlots(data(3, 0), 3, 3))).toEqual([10, 11, 12, 0, null, null, null])
    expect(ids(layoutSlots(data(0, 0), 2, 1))).toEqual([null, null, 0, null])
  })

  it('clamps to the slots when the payload has more cars than slots', () => {
    expect(ids(layoutSlots(data(5, 5), 2, 1))).toEqual([13, 14, 0, 20])
  })

  it('lists from the top without a player row, and pads an empty payload', () => {
    const d = { ...data(3, 3), playerRow: -1 }
    expect(ids(layoutSlots(d, 1, 1))).toEqual([10, 11, 12])
    expect(ids(layoutSlots(null, 1, 2))).toEqual([null, null, null, null])
    expect(ids(layoutSlots({ ...d, rows: [] }, 1, 1))).toEqual([null, null, null])
  })
})

describe('toSlotViews', () => {
  const styles = createDriverStyles()

  it('formats a car slot', () => {
    const v = toSlotView(
      row(4, { gapS: -2.34, driverName: 'Pierre-Étienne Duvalier' }),
      1,
      styles,
      'abbr',
      ES
    )
    expect(v).toMatchObject({
      kind: 'car',
      css: 'rl-row is-alt',
      pos: 'P5',
      number: '4',
      name: 'P. Duvalier',
      iRating: '2.0k',
      lic: 'A 3.4',
      gap: `${M}2.3`,
      lap: null
    })
  })

  it("shows the team's name, then 'Piloto #7', for a name iRacing turned into '?'", () => {
    // driverName '' is how the provider sends '?????? ?????' (shared/driver.ts).
    const unknown = row(7, { driverName: '' })
    expect(toSlotView(unknown, 0, styles, 'abbr', ES)).toMatchObject({
      name: 'Piloto #7',
      nameUnknown: true
    })
    expect(toSlotView(unknown, 0, styles, 'abbr', EN).name).toBe('Driver #7')
    // The team's name as it is: not restyled like a person's.
    expect(
      toSlotView(row(7, { driverName: '', teamName: 'Apex Racing Team' }), 0, styles, 'tv', ES)
    ).toMatchObject({ name: 'Apex Racing Team', nameUnknown: false })
    // A style that keeps only the '?' part of a name falls back as well.
    expect(toSlotView(row(7, { driverName: 'Ivan ??????' }), 0, styles, 'surname', ES).name).toBe(
      'Piloto #7'
    )
    expect(toSlotView(row(7), 0, styles, 'abbr', ES).nameUnknown).toBe(false)
  })

  it('leaves your own gap blank and marks your row', () => {
    const v = toSlotView(row(0, { isPlayer: true, gapS: 0 }), 0, styles, 'full', ES)
    expect(v.gap).toBe('')
    expect(v.css).toBe('rl-row ov-player')
  })

  it('marks lap relations and pits', () => {
    expect(toSlotView(row(1, { lapRelation: 'ahead' }), 0, styles, 'full', ES)).toMatchObject({
      lap: 'ahead',
      css: 'rl-row is-lap-ahead'
    })
    expect(
      toSlotView(row(1, { lapRelation: 'behind', inPits: true }), 0, styles, 'full', ES).css
    ).toBe('rl-row is-pits is-lap-behind')
    // Your own row never has a lap relation.
    expect(
      toSlotView(row(0, { isPlayer: true, lapRelation: 'behind' }), 0, styles, 'full', ES).lap
    ).toBeNull()
  })

  it('uses shared empty slots, striped by index', () => {
    const views = toSlotViews(layoutSlots(data(0, 0), 2, 0), styles, 'full', ES)
    expect(views.map((v) => v.kind)).toEqual(['empty', 'empty', 'car'])
    expect(views[0]).toBe(toSlotViews([null], styles, 'full', ES)[0])
    expect(views[1]?.css).toBe('rl-row is-alt')
  })

  it('keeps unchanged slots as the same objects for v-memo', () => {
    const first = toSlotViews(layoutSlots(data(3, 3), 3, 3), styles, 'abbr', ES)
    const same = reuseViews<SlotView>(
      first,
      toSlotViews(layoutSlots(data(3, 3), 3, 3), styles, 'abbr', ES)
    )
    expect(same).toBe(first)
    const d = data(3, 3)
    d.rows[4] = { ...d.rows[4]!, gapS: -0.4 }
    const next = reuseViews<SlotView>(first, toSlotViews(layoutSlots(d, 3, 3), styles, 'abbr', ES))
    expect(next.filter((v, i) => v !== first[i])).toHaveLength(1)
    expect((next[4] as RelativeSlotView).gap).toBe(`${M}0.4`)
  })
})

describe('relativeColumns', () => {
  const DEF = DEFAULT_SETTINGS.relative.columns
  const plain = { tyres: true, flags: true, brand: false, country: false }
  type Legacy = {
    showClassPosition: boolean
    showLicense: boolean
    showIRating: boolean
    showTyre: boolean
    showStint: boolean
  }
  /** What the row drew before the list (the old relativeColumns), from its five toggles. */
  function legacyTemplate(o: Legacy): string {
    const tracks: string[] = []
    if (o.showClassPosition) tracks.push('1.9em')
    tracks.push('minmax(0, 1fr)')
    if (o.showLicense) tracks.push('2.8em')
    if (o.showIRating) tracks.push('2.4em')
    if (o.showTyre) tracks.push('1.3em')
    if (o.showStint) tracks.push('2.3em')
    tracks.push('3.1em')
    return tracks.join(' ')
  }
  function legacyFit(o: Legacy): number {
    return 27 + (o.showTyre ? 1.7 : 0) + (o.showStint ? 2.7 : 0)
  }

  it('draws today’s row from the default list', () => {
    const c = relativeColumns(DEF, plain)
    expect(c.cells).toEqual(['pos', 'driver', 'lic', 'ir', 'gap'])
    expect(c.template).toBe('1.9em minmax(0, 1fr) 2.8em 2.4em 3.1em')
    expect(c.fitEm).toBe(RELATIVE_FIT_EM)
    expect(c.fitEm).toBe(27)
  })

  it('reads every old combination of toggles into the same row', () => {
    const keys = new Set<string>()
    for (let bits = 0; bits < 32; bits++) {
      const o: Legacy = {
        showClassPosition: (bits & 1) !== 0,
        showLicense: (bits & 2) !== 0,
        showIRating: (bits & 4) !== 0,
        showTyre: (bits & 8) !== 0,
        showStint: (bits & 16) !== 0
      }
      const list = normalizeSettings({ version: 4, relative: o }).relative.columns
      const c = relativeColumns(list, plain)
      expect(c.template, JSON.stringify(o)).toBe(legacyTemplate(o))
      expect(c.fitEm).toBeCloseTo(legacyFit(o), 5)
      keys.add(c.key)
    }
    expect(keys.size).toBe(32)
  })

  it('follows the list’s order, cells before the driver on its left', () => {
    // [pos driver lic ir tyre stint gap] → [gap ir pos driver lic tyre stint]
    let list = moveElement(DEF, 6, 0)
    list = moveElement(list, 4, 1)
    expect(list.map((e) => e.id)).toEqual(['gap', 'ir', 'pos', 'driver', 'lic', 'tyre', 'stint'])
    const c = relativeColumns(list, plain)
    expect(c.cells).toEqual(['gap', 'ir', 'pos', 'driver', 'lic'])
    expect(c.template).toBe('3.1em 2.4em 1.9em minmax(0, 1fr) 2.8em')
    expect(c.key).not.toBe(relativeColumns(DEF, plain).key)
  })

  it('puts back a required cell a hand-edited list lost', () => {
    const c = relativeColumns(
      [
        { id: 'pos', visible: true },
        { id: 'ir', visible: true }
      ],
      plain
    )
    expect(c.cells).toEqual(['pos', 'driver', 'ir', 'gap'])
  })

  it('shows the tyre column only while some row names a compound', () => {
    const list = setElementVisible(DEF, 'tyre', true)
    expect(relativeColumns(list, plain).cells).toContain('tyre')
    const none = relativeColumns(list, { ...plain, tyres: false })
    expect(none.cells).not.toContain('tyre')
    expect(none.fitEm).toBe(27)
  })

  it('widens the fit for the make and the flag in the driver cell, not the tracks', () => {
    const base = relativeColumns(DEF, plain)
    const brand = relativeColumns(DEF, { ...plain, brand: true })
    const both = relativeColumns(DEF, { ...plain, brand: true, country: true })
    expect(brand.template).toBe(base.template)
    expect(brand.fitEm).toBeCloseTo(27 + BRAND_FIT_EM, 5)
    expect(both.fitEm).toBeCloseTo(27 + BRAND_FIT_EM + FLAG_FIT_EM, 5)
    expect(BRAND_FIT_EM).toBeCloseTo(2.1, 5)
    expect(FLAG_FIT_EM).toBeCloseTo(2.08, 5)
    // Flags (penalty badges), makes and country flags change no track: still new v-memo keys.
    const noFlags = relativeColumns(DEF, { ...plain, flags: false })
    expect(noFlags.template).toBe(base.template)
    expect(new Set([base.key, brand.key, both.key, noFlags.key]).size).toBe(4)
  })
})

describe('relativeHeads', () => {
  it('names each cell in its order, aligned like it, in each language', () => {
    const cells = ['gap', 'pos', 'driver', 'lic', 'ir', 'tyre', 'stint'] as const
    expect(relativeHeads(cells, 'outline', ES).map((h) => [h.id, h.label, h.align])).toEqual([
      ['gap', ES.widgets.heads.gap, 'end'],
      ['pos', ES.widgets.heads.pos, 'start'],
      ['driver', ES.widgets.heads.driver, 'start'],
      ['lic', ES.widgets.heads.sr, 'center'],
      ['ir', ES.widgets.heads.ir, 'end'],
      ['tyre', '', 'center'],
      ['stint', ES.widgets.heads.stint, 'end']
    ])
    expect(relativeHeads(['lic'], 'letter', EN)[0]?.label).toBe(EN.widgets.heads.lic)
    expect(ES.widgets.heads.driver).not.toBe(EN.widgets.heads.driver)
  })
})

describe('relativeRowEm', () => {
  it('draws the comfortable rows as the relative always was (text half a row high)', () => {
    expect(relativeRowEm('comfortable')).toBe(2)
    expect(relativeRowEm(undefined)).toBe(2)
  })

  it('tightens the compact rows by the same step as the standings', () => {
    expect(relativeRowEm('compact')).toBe(RELATIVE_ROW_EM.compact)
    expect(RELATIVE_ROW_EM.comfortable / RELATIVE_ROW_EM.compact).toBeCloseTo(1.8 / 1.5, 1)
  })
})

describe('chromeEm', () => {
  it('is today’s 1.8 with the header at its normal size and no footer', () => {
    expect(chromeEm({ header: 1, heads: false, footer: null })).toBe(1.8)
  })

  it('adds each bar at its scale and the heads row', () => {
    expect(chromeEm({ header: null, heads: false, footer: null })).toBe(CHROME_BASE_EM)
    expect(chromeEm({ header: 1, heads: true, footer: null })).toBeCloseTo(1.8 + HEADS_EM, 5)
    expect(chromeEm({ header: 1, heads: false, footer: 1 })).toBeCloseTo(3.4, 5)
    expect(chromeEm({ header: 0.85, heads: true, footer: 1.2 })).toBeCloseTo(
      0.2 + 1.36 + 1.1 + 1.92,
      5
    )
  })
})

describe('stint, tyre and flag cells', () => {
  const styles = createDriverStyles()

  it('writes the stint as its laps and unit, in each language', () => {
    expect(toSlotView(row(1, { stintLaps: 7 }), 0, styles, 'full', ES)).toMatchObject({
      stint: '7',
      stintUnit: 'v'
    })
    expect(toSlotView(row(1, { stintLaps: 0 }), 0, styles, 'full', EN)).toMatchObject({
      stint: '0',
      stintUnit: 'L'
    })
    expect(toSlotView(row(1), 0, styles, 'full', ES)).toMatchObject({ stint: '', stintUnit: '' })
  })

  it('shows the compound letter, a dash when nobody can name it', () => {
    expect(toSlotView(row(1, { tyre: 'Hard' }), 0, styles, 'full', ES).tyre).toBe('H')
    expect(toSlotView(row(1, { tyre: 'wet' }), 0, styles, 'full', EN).tyre).toBe('W')
    expect(toSlotView(row(1, { tyre: null }), 0, styles, 'full', ES).tyre).toBe('—')
    expect(toSlotView(row(1, { tyre: '  ' }), 0, styles, 'full', ES).tyre).toBe('—')
  })

  it('passes the make and the country flag on', () => {
    expect(
      toSlotView(row(1, { brand: 'porsche', country: 'ES' }), 0, styles, 'full', ES)
    ).toMatchObject({ brand: 'porsche', country: 'ES' })
  })

  it('passes the flag badge on', () => {
    expect(toSlotView(row(1, { penalty: 'furled' }), 0, styles, 'full', ES).penalty).toBe('furled')
    expect(toSlotView(row(1), 0, styles, 'full', ES).penalty).toBeNull()
  })
})

describe('previewRelative', () => {
  it('has as many cars as the options ask for, the player centred', () => {
    const d = previewRelative(3, 2)
    expect(d.rows).toHaveLength(6)
    expect(d.playerRow).toBe(3)
    expect(d.rows[3]?.isPlayer).toBe(true)
    expect(ids(layoutSlots(d, 3, 2))[3]).toBe(0)
    expect(previewRelative(10, 10).rows).toHaveLength(21)
    expect(previewRelative(0, 0).rows).toHaveLength(1)
  })

  it('shows a car lapping you, a lapped car and one in the pits close to you', () => {
    const rows = previewRelative(3, 3).rows
    expect(rows.some((r) => r.lapRelation === 'ahead')).toBe(true)
    expect(rows.some((r) => r.lapRelation === 'behind')).toBe(true)
    expect(rows.some((r) => r.inPits)).toBe(true)
    // Gaps: positive ahead, negative behind, ordered top to bottom.
    const gaps = rows.map((r) => r.gapS ?? 0)
    expect([...gaps].sort((a, b) => b - a)).toEqual(gaps)
  })

  it('shows every flag badge, stints and both a named and an unnamed compound close to you', () => {
    const rows = previewRelative(3, 3).rows
    const flags = rows.map((r) => r.penalty).filter((p) => p !== null)
    expect([...flags].sort()).toEqual(['black', 'furled', 'meatball'])
    expect(rows.every((r) => r.stintLaps !== null)).toBe(true)
    expect(new Set(rows.map((r) => r.tyre))).toEqual(new Set(['Hard', 'Wet', null]))
  })
})
