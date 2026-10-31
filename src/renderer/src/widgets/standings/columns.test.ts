import { describe, expect, it } from 'vitest'
import type { StandingsColumnId } from '@shared/types'
import {
  BRAND_EM,
  DECORATIONS_BEFORE,
  DROP_ORDER,
  NAME_MIN_EM,
  NARROW_EM,
  columnWanted,
  fitColumns,
  reuseColumns,
  flagEm,
  rowWidthEm,
  withoutRoom,
  type ColumnPrefs,
  type Columns
} from './columns'
import { allColumns, defaultColumns } from './testing/rows'

function prefs(over: Partial<ColumnPrefs> = {}): ColumnPrefs {
  return {
    columns: defaultColumns(),
    gapMode: 'interval',
    iRatingDeltaAll: false,
    race: true,
    tyres: true,
    licenseStyle: 'soft',
    numberStyle: 'chip',
    brand: false,
    flag: false,
    ...over
  }
}

describe('the 10 px text floor (R15)', () => {
  it('changes nothing until it is chosen', () => {
    expect(fitColumns(prefs({ minText: 9 }), 540, 13)).toEqual(fitColumns(prefs(), 540, 13))
    expect(flagEm(9, 9)).toBe(flagEm(9))
  })

  it('gives small cells more room at a small font, so the same width keeps fewer columns', () => {
    const at9 = fitColumns(prefs({ columns: allColumns() }), 540, 10)
    const at10 = fitColumns(prefs({ columns: allColumns(), minText: 10 }), 540, 10)
    expect(at10.cells.length).toBeLessThanOrEqual(at9.cells.length)
    expect(at10.template).not.toBe(at9.template)
    expect(flagEm(9, 10)).toBeGreaterThan(flagEm(9, 9))
  })
})

/** The row's start (request 11): never dropped, only the decorations among it go. */
const HEAD: readonly string[] = ['pos', 'number', 'brand', 'country', 'driver']

/** The columns after the row's start, in tracks of their own: what `cells` was before request 11. */
function right(c: Columns): StandingsColumnId[] {
  return c.tracks.filter((id) => !HEAD.includes(id))
}

/** The columns placed anywhere but after the name: what the width can take away (or move). */
function placed(c: Columns): StandingsColumnId[] {
  return [...c.before, ...c.tracks].filter((id) => !HEAD.includes(id)) as StandingsColumnId[]
}

/** Wanted columns missing at `widthPx`, listed in DROP_ORDER (anything else sorts first). */
function dropped(p: ColumnPrefs, widthPx: number, fontPx = 13): string[] {
  const all = placed(fitColumns(p, 0, fontPx))
  const kept = placed(fitColumns(p, widthPx, fontPx))
  const order: readonly string[] = DROP_ORDER
  return all.filter((id) => !kept.includes(id)).sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

describe('fitColumns', () => {
  it('gives the name at least 10 em at 460 px and 13 px, the best lap going first', () => {
    const c = fitColumns(prefs(), 460, 13)
    expect(right(c)).toEqual(['gained', 'ir', 'lic', 'gap', 'last', 'pit'])
    expect(c.nameEm).toBeGreaterThanOrEqual(10)
    expect(c.numberStyle).toBe('chip')
    expect(c.pitInline).toBe(false)
  })

  it('fits every default column, the best lap included, at the default 540 px', () => {
    const c = fitColumns(prefs(), 540, 13)
    expect(right(c)).toEqual(['gained', 'ir', 'lic', 'gap', 'last', 'best', 'pit'])
    expect(c.nameEm).toBeGreaterThanOrEqual(NAME_MIN_EM)
  })

  it('drops the stint extras before the best lap, and that before anything older', () => {
    const p = prefs({ columns: allColumns() })
    let w = 900
    while (fitColumns(p, w, 13).cells.includes('best')) w -= 1
    expect(dropped(p, w)).toEqual(['delta', 'gapLeader', 'pitLap', 'stint', 'tyre', 'best'])
  })

  it('keeps the user order and builds the grid from it', () => {
    const order: StandingsColumnId[] = ['gap', 'last', 'best', 'pit', 'lic', 'ir', 'gained']
    const columns = defaultColumns().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
    const c = fitColumns(prefs({ columns }), 600, 13)
    expect(right(c)).toEqual(order)
    // Position, name (1fr), then one fixed track per cell.
    expect(c.template.startsWith('1.7em minmax(0, 1fr) ')).toBe(true)
    expect(c.template.split(' ').filter((t) => t.endsWith('em'))).toHaveLength(1 + order.length)
  })

  it('drops columns in DROP_ORDER as the window narrows, whatever the user order', () => {
    const ids = defaultColumns().map((c) => c.id)
    const orders: StandingsColumnId[][] = [
      ids,
      [...ids].reverse(),
      [
        'tyre',
        'flags',
        'last',
        'gained',
        'stint',
        'pit',
        'ir',
        'best',
        'gap',
        'lic',
        'pitLap',
        'gapLeader',
        'delta'
      ]
    ]
    for (const order of orders) {
      const p = prefs({ columns: allColumns(order), iRatingDeltaAll: true, penalties: true })
      // The penalty flags after the name are where they go anyway: only placed ones move there.
      const drops = DROP_ORDER.filter((id) => placed(fitColumns(p, 0, 13)).includes(id))
      let prev: string[] = []
      for (let w = 900; w >= 200; w -= 5) {
        const d = dropped(p, w)
        // Always a prefix of DROP_ORDER, growing as the width shrinks.
        expect(d).toEqual(drops.slice(0, d.length))
        expect(d.slice(0, prev.length)).toEqual(prev)
        prev = d
      }
      expect(prev).toEqual(drops)
      expect(right(fitColumns(p, 200, 13))).toEqual(['gap'])
    }
  })

  it('draws the penalty flags where the list puts them: after the name by default', () => {
    // Right after the name (the default): after its text, as before request 11.
    const off = fitColumns(prefs({ penalties: true }), 900, 13)
    expect(off.after).toEqual(['flags'])
    expect(off.tracks).not.toContain('flags')
    expect(off.flagsInline).toBe(true)
    // Set apart from the name (after the gap here): a column of their own.
    const apart = order(['gap', 'flags'])
    const on = fitColumns(prefs({ columns: apart, penalties: true }), 900, 13)
    expect(right(on).indexOf('flags')).toBe(right(on).indexOf('gap') + 1)
    expect(on.flagsInline).toBe(false)
    expect(off.key).not.toBe(on.key)
    // The «Piloto» block's switch off: nowhere.
    const none = fitColumns(prefs({ columns: apart, penalties: false }), 900, 13)
    expect(none.cells).not.toContain('flags')
    expect(none.flagsInline).toBe(false)
    // Too narrow for their column: they go after the name, never lost.
    const narrow = fitColumns(prefs({ columns: apart, penalties: true }), 300, 13)
    expect(narrow.tracks).not.toContain('flags')
    expect(narrow.flagsInline).toBe(true)
    expect(withoutRoom(prefs({ columns: apart, penalties: true }), narrow).columns).not.toContain(
      'flags'
    )
  })

  it('never drops the gap and keeps the name at NAME_MIN_EM while anything can go', () => {
    const p = prefs({ columns: allColumns(), iRatingDeltaAll: true })
    for (let w = 900; w >= 240; w -= 10) {
      const c = fitColumns(p, w, 13)
      expect(c.cells).toContain('gap')
      if (c.cells.length > 1) expect(c.nameEm).toBeGreaterThanOrEqual(NAME_MIN_EM)
    }
  })

  it('turning off a column frees room for the ones before it in the drop order', () => {
    const p = prefs()
    // Find the widest width at which the default set loses 'gained'.
    let w = 700
    while (fitColumns(p, w, 13).cells.includes('gained')) w -= 1
    expect(dropped(p, w)).toEqual(['best', 'gained'])
    const noLast = prefs({
      columns: defaultColumns().map((c) => (c.id === 'last' ? { ...c, visible: false } : c))
    })
    expect(fitColumns(noLast, w, 13).cells).toContain('gained')
  })

  it('turns the number chip into a bare stripe below NARROW_EM', () => {
    const font = 13
    let w = 400
    while (rowWidthEm(w, font) >= NARROW_EM) w -= 1
    expect(fitColumns(prefs(), w, font).numberStyle).toBe('bare')
    expect(fitColumns(prefs(), w + 1, font).numberStyle).toBe('chip')
    expect(fitColumns(prefs({ numberStyle: 'stripe' }), w + 1, font).numberStyle).toBe('stripe')
  })

  it('moves the pit state next to the name when the pit column is gone', () => {
    expect(fitColumns(prefs(), 460, 13).pitInline).toBe(false)
    expect(fitColumns(prefs(), 250, 13).pitInline).toBe(true)
    const noPit = prefs({
      columns: defaultColumns().map((c) => (c.id === 'pit' ? { ...c, visible: false } : c))
    })
    expect(fitColumns(noPit, 900, 13).pitInline).toBe(true)
  })

  it('keeps every wanted column before the window is measured', () => {
    const c = fitColumns(prefs({ columns: allColumns(), iRatingDeltaAll: true }), 0, 13)
    expect(right(c)).toHaveLength(12)
    expect(c.numberStyle).toBe('chip')
  })

  it('widens cells whose text hits the 9 px floor at small sizes', () => {
    const at = (font: number): number[] =>
      fitColumns(prefs(), 0, font)
        .template.split(' ')
        .filter((t) => t.endsWith('em'))
        .map((t) => parseFloat(t))
    const big = at(13)
    const small = at(9)
    // The gap (1 em text) never needs it; the licence (0.72 em) does.
    expect(small[0]).toBeGreaterThan(big[0] ?? 0)
    expect(small).not.toEqual(big)
  })

  it('makes the licence column narrow for the letter style', () => {
    const soft = fitColumns(prefs(), 0, 13).template
    const letter = fitColumns(prefs({ licenseStyle: 'letter' }), 0, 13).template
    expect(letter).not.toBe(soft)
    expect(fitColumns(prefs({ licenseStyle: 'letter' }), 0, 13).key).not.toBe(
      fitColumns(prefs(), 0, 13).key
    )
  })

  it('ignores duplicated ids', () => {
    const cols = [...defaultColumns(), { id: 'gap' as const, visible: true }]
    expect(
      fitColumns(prefs({ columns: cols }), 0, 13).cells.filter((c) => c === 'gap')
    ).toHaveLength(1)
  })
})

describe('fitColumns: the make and the flag', () => {
  const both = prefs({ brand: true, flag: true })

  it('draws them when wanted and there is room, and keys the columns on them', () => {
    const c = fitColumns(both, 700, 13)
    expect(c.brand).toBe(true)
    expect(c.flag).toBe(true)
    const none = fitColumns(prefs(), 700, 13)
    expect(none.brand).toBe(false)
    expect(none.flag).toBe(false)
    expect(c.key).not.toBe(none.key)
    expect(fitColumns(prefs({ flag: true }), 700, 13).key).not.toBe(
      fitColumns(prefs({ brand: true }), 700, 13).key
    )
  })

  it('takes their width from the name', () => {
    const plain = fitColumns(prefs(), 700, 13).nameEm
    const c = fitColumns(both, 700, 13).nameEm
    expect(plain - c).toBeCloseTo(BRAND_EM + flagEm(13), 1)
    // The flag is 3:2 at the plate height, which never goes below 13 px.
    expect(flagEm(8)).toBeGreaterThan(flagEm(13))
    expect(flagEm(26)).toBeCloseTo(1.5 * 1.15 + 0.35, 9)
  })

  it('drops after the extra columns, before any the table had: the flag first, then the make', () => {
    const p = prefs({ columns: allColumns(), brand: true, flag: true })
    const extras = DROP_ORDER.slice(0, DROP_ORDER.indexOf(DECORATIONS_BEFORE))
    const states: string[] = []
    for (let w = 900; w > 150; w -= 2) {
      const c = fitColumns(p, w, 13)
      // While an extra column is drawn, both decorations are too.
      if (extras.some((id) => c.cells.includes(id))) expect(c.brand && c.flag).toBe(true)
      // A column the table had before them is only dropped once both are gone.
      if (!c.cells.includes(DECORATIONS_BEFORE)) expect(c.brand || c.flag).toBe(false)
      const s = `${c.flag ? 'F' : ''}${c.brand ? 'B' : ''}${c.numberStyle}`
      if (states.at(-1) !== s) states.push(s)
    }
    expect(states.slice(0, 3)).toEqual(['FBchip', 'Bchip', 'chip'])
    expect(states.at(-1)).toBe('bare')
  })

  it('keeps today’s default columns at the default width with both on', () => {
    // 540 px at 13 px: the default standings window; every default column stays.
    const plain = right(fitColumns(prefs(), 540, 13))
    const c = fitColumns(prefs({ brand: true, flag: true }), 540, 13)
    expect(right(c)).toEqual(plain)
    expect(c.before[0]).toBe('number')
  })

  it('never draws them on a bare stripe, nor before the window is measured if not wanted', () => {
    const narrow = fitColumns(both, 200, 13)
    expect(narrow.numberStyle).toBe('bare')
    expect(narrow.brand).toBe(false)
    expect(narrow.flag).toBe(false)
    expect(fitColumns(both, 0, 13)).toMatchObject({ brand: true, flag: true })
    expect(fitColumns(prefs(), 0, 13)).toMatchObject({ brand: false, flag: false })
  })
})

describe('columnWanted', () => {
  it('shows positions gained and iRating changes in races only', () => {
    expect(columnWanted('gained', true, prefs())).toBe(true)
    expect(columnWanted('gained', true, prefs({ race: false }))).toBe(false)
    expect(columnWanted('delta', false, prefs())).toBe(false)
    expect(columnWanted('delta', true, prefs())).toBe(true)
    expect(columnWanted('delta', false, prefs({ iRatingDeltaAll: true }))).toBe(true)
    expect(columnWanted('delta', true, prefs({ race: false }))).toBe(false)
  })

  it("adds the leader gap in 'both' mode and never duplicates it in 'leader' mode", () => {
    expect(columnWanted('gapLeader', false, prefs({ gapMode: 'both' }))).toBe(true)
    expect(columnWanted('gapLeader', false, prefs({ gapMode: 'interval' }))).toBe(false)
    expect(columnWanted('gapLeader', true, prefs({ gapMode: 'interval' }))).toBe(true)
    expect(columnWanted('gapLeader', true, prefs({ gapMode: 'leader' }))).toBe(false)
  })

  it('shows the best lap and the last stop in races only (elsewhere the last lap is the best)', () => {
    for (const id of ['best', 'pitLap'] as const) {
      expect(columnWanted(id, true, prefs())).toBe(true)
      expect(columnWanted(id, false, prefs())).toBe(false)
      expect(columnWanted(id, true, prefs({ race: false }))).toBe(false)
    }
  })

  it('follows the visibility flag for the rest, stint and tyre in every session', () => {
    for (const id of ['ir', 'lic', 'gap', 'last', 'pit', 'stint', 'tyre'] as const) {
      expect(columnWanted(id, true, prefs())).toBe(true)
      expect(columnWanted(id, false, prefs())).toBe(false)
    }
    expect(columnWanted('stint', true, prefs({ race: false }))).toBe(true)
    expect(columnWanted('tyre', true, prefs({ race: false }))).toBe(true)
  })

  it('drops the tyre column while no row has a compound (the whole field on one: Q10)', () => {
    expect(columnWanted('tyre', true, prefs({ tyres: false }))).toBe(false)
    const all = allColumns()
    expect(fitColumns(prefs({ columns: all, tyres: false }), 0, 13).cells).not.toContain('tyre')
    expect(fitColumns(prefs({ columns: all }), 0, 13).cells).toContain('tyre')
  })
})

describe('reuseColumns', () => {
  it('keeps the previous object while nothing rendered changes', () => {
    const a = fitColumns(prefs(), 460, 13)
    const b = fitColumns(prefs(), 462, 13)
    expect(b).not.toBe(a)
    expect(reuseColumns(a, b)).toBe(a)
    const c = fitColumns(prefs(), 250, 13)
    expect(reuseColumns(a, c)).toBe(c)
    expect(reuseColumns(undefined, a)).toBe(a)
  })
})

describe('withoutRoom', () => {
  it('names the wanted columns the width dropped, in the list order, and nothing that fits', () => {
    const p = prefs({ columns: allColumns() })
    const wide = fitColumns(p, 2000, 13)
    expect(withoutRoom(p, wide)).toEqual({ columns: [], brand: false, flag: false })
    const narrow = fitColumns(p, 460, 13)
    const out = withoutRoom(p, narrow)
    expect(out.columns.length).toBeGreaterThan(0)
    for (const id of out.columns) expect(narrow.cells).not.toContain(id)
    const listed = p.columns.map((c) => c.id)
    expect([...out.columns]).toEqual(listed.filter((id) => out.columns.includes(id)))
  })

  it('never names a column that is off for the options (not wanted), only for the width', () => {
    const p = prefs({ columns: allColumns(), race: false })
    const out = withoutRoom(p, fitColumns(p, 300, 13))
    expect(out.columns).not.toContain('gained')
    expect(out.columns).not.toContain('best')
  })

  it('says when the mark and the flag went for the width', () => {
    const p = prefs({ brand: true, flag: true })
    expect(withoutRoom(p, fitColumns(p, 2000, 13))).toMatchObject({ brand: false, flag: false })
    expect(withoutRoom(p, fitColumns(p, 200, 13))).toMatchObject({ brand: true, flag: true })
  })

  it('says nothing before the width is measured', () => {
    const p = prefs({ columns: allColumns(), brand: true })
    expect(withoutRoom(p, fitColumns(p, 0, 13))).toEqual({ columns: [], brand: false, flag: false })
  })
})

describe('the position track (R10: its eye in the list since request 11)', () => {
  it('drops the position track and gives its width to the name', () => {
    // Wide enough for every column either way.
    const on = fitColumns(prefs(), 1200, 13)
    const hidden = defaultColumns().map((c) => (c.id === 'pos' ? { ...c, visible: false } : c))
    const off = fitColumns(prefs({ columns: hidden }), 1200, 13)
    expect(on.pos).toBe(true)
    expect(off.pos).toBe(false)
    expect(off.template.startsWith('minmax(0, 1fr)')).toBe(true)
    expect(on.template.startsWith('minmax(0, 1fr)')).toBe(false)
    expect(off.template).toBe(on.template.slice(on.template.indexOf(' ') + 1))
    expect(off.nameEm).toBeGreaterThan(on.nameEm)
    expect(off.key).not.toBe(on.key)
  })
})

describe('the iRating column’s width (request 10)', () => {
  it('is today’s without one, and the one given otherwise', () => {
    const today = fitColumns(prefs(), 0, 13)
    expect(fitColumns(prefs({ irEm: 2.4 }), 0, 13).template).toBe(today.template)
    const wide = fitColumns(prefs({ irEm: 3.4 }), 0, 13)
    expect(wide.template).not.toBe(today.template)
    expect(wide.template).toContain('3.4em')
    expect(wide.key).not.toBe(today.key)
  })
})

/** The default list with `ids` moved to the end, in that order. */
function order(ids: readonly StandingsColumnId[]): ReturnType<typeof defaultColumns> {
  const rest = defaultColumns().filter((c) => !ids.includes(c.id))
  const moved = ids.map((id) => ({ id, visible: true }))
  return [...rest, ...moved]
}

describe('the row’s start as columns (request 11)', () => {
  const at = (ids: readonly StandingsColumnId[]): ReturnType<typeof defaultColumns> =>
    ids.map((id) => ({ id, visible: true }))

  it('draws today’s row from the default list: the number, the make and the flag with the name', () => {
    const c = fitColumns(prefs({ brand: true, flag: true, penalties: true }), 900, 13)
    expect(c.tracks.slice(0, 3)).toEqual(['pos', 'driver', 'gained'])
    expect(c.before).toEqual(['number', 'brand', 'country'])
    expect(c.after).toEqual(['flags'])
    expect(c.template.startsWith('1.7em minmax(0, 1fr) ')).toBe(true)
  })

  it('puts a column between the position and the number: the number starts the name’s cell', () => {
    const cols = at(['pos', 'gained', 'number', 'flags', 'brand', 'country', 'driver', 'gap'])
    const c = fitColumns(
      prefs({ columns: cols, brand: true, flag: true, penalties: true }),
      900,
      13
    )
    expect(c.tracks).toEqual(['pos', 'gained', 'driver', 'gap'])
    // The penalty flags between the number and the make: their slot in the name's cell.
    expect(c.before).toEqual(['number', 'flags', 'brand', 'country'])
    expect(c.flagsInline).toBe(false)
  })

  it('gives a part set apart from the name a track of its own, as wide as its slot', () => {
    const cols = at(['number', 'pos', 'gained', 'driver', 'country', 'gap'])
    const c = fitColumns(prefs({ columns: cols, flag: true }), 900, 13)
    expect(c.tracks).toEqual(['number', 'pos', 'gained', 'driver', 'gap'])
    // The flag right after the name follows it, in its cell.
    expect(c.after).toEqual(['country'])
    expect(c.template.split(' ')[0]).toBe('1.85em')
    // The same parts, the name keeps the same room within a column's gap.
    const today = fitColumns(
      prefs({ columns: at(['pos', 'number', 'driver', 'gained', 'country', 'gap']), flag: true }),
      900,
      13
    )
    expect(Math.abs(today.nameEm - c.nameEm)).toBeLessThan(0.2)
  })

  it('hides the number and the position by their eye; the make and the flag by the block', () => {
    const cols = at(['pos', 'number', 'brand', 'country', 'driver', 'gap']).map((e) =>
      e.id === 'number' || e.id === 'pos' ? { ...e, visible: false } : e
    )
    const c = fitColumns(prefs({ columns: cols, brand: false, flag: true }), 900, 13)
    expect(c.cells).toEqual(['country', 'driver', 'gap'])
    expect(c.pos).toBe(false)
    // The name is always drawn, even from a list without it.
    expect(fitColumns(prefs({ columns: at(['gap']) }), 900, 13).cells).toEqual(['driver', 'gap'])
  })

  it('drops the make and the flag wherever they are, the number staying', () => {
    const cols = at(['pos', 'brand', 'gained', 'number', 'driver', 'country', 'gap', 'last'])
    const p = prefs({ columns: cols, brand: true, flag: true })
    const narrow = fitColumns(p, 220, 13)
    expect(narrow.cells).not.toContain('brand')
    expect(narrow.cells).not.toContain('country')
    expect(narrow.cells).toContain('number')
    expect(withoutRoom(p, narrow).columns).toEqual(expect.arrayContaining(['brand', 'country']))
  })
})
