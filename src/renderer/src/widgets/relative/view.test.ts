import { describe, expect, it } from 'vitest'
import { MINUS } from '@shared/format'
import { messagesFor } from '@shared/i18n'
import type { RelativeData, RelativeRow } from '@shared/types'
import { reuseViews } from '@renderer/view/reuse'
import { createDriverStyles } from '@renderer/view/styles'
import { previewRelative } from './preview'
import {
  layoutSlots,
  relativeColumns,
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
    incidents: null
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
  it('lists the shown columns, the name taking the rest', () => {
    const all = relativeColumns({ showClassPosition: true, showLicense: true, showIRating: true })
    expect(all.template).toBe('1.9em minmax(0, 1fr) 2.8em 2.4em 3.1em')
    const none = relativeColumns({
      showClassPosition: false,
      showLicense: false,
      showIRating: false
    })
    expect(none.template).toBe('minmax(0, 1fr) 3.1em')
    expect(none.key).not.toBe(all.key)
  })

  it('adds the tyre and stint columns before the gap, widening what the font fits', () => {
    const base = { showClassPosition: true, showLicense: true, showIRating: true }
    const plain = relativeColumns(base)
    expect(plain).toMatchObject({ tyre: false, stint: false, flags: true, fitEm: 27 })
    const extras = relativeColumns({ ...base, showTyre: true, showStint: true })
    expect(extras.template).toBe('1.9em minmax(0, 1fr) 2.8em 2.4em 1.3em 2.3em 3.1em')
    expect(extras.fitEm).toBeCloseTo(27 + 1.3 + 2.3 + 0.8, 5)
    expect(relativeColumns({ ...base, showTyre: true }).template).toBe(
      '1.9em minmax(0, 1fr) 2.8em 2.4em 1.3em 3.1em'
    )
    // Flags change no track, only what the rows draw: still a new key for v-memo.
    const noFlags = relativeColumns({ ...base, showFlags: false })
    expect(noFlags.flags).toBe(false)
    expect(noFlags.template).toBe(plain.template)
    expect(new Set([plain.key, extras.key, noFlags.key]).size).toBe(3)
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
