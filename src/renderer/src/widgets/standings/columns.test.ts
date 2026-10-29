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
  type ColumnPrefs
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

/** Wanted columns missing at `widthPx`, listed in DROP_ORDER (anything else sorts first). */
function dropped(p: ColumnPrefs, widthPx: number, fontPx = 13): string[] {
  const all = fitColumns(p, 0, fontPx).cells
  const kept = fitColumns(p, widthPx, fontPx).cells
  const order: readonly string[] = DROP_ORDER
  return all.filter((id) => !kept.includes(id)).sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

describe('fitColumns', () => {
  it('gives the name at least 10 em at 460 px and 13 px, the best lap going first', () => {
    const c = fitColumns(prefs(), 460, 13)
    expect(c.cells).toEqual(['gained', 'ir', 'lic', 'gap', 'last', 'pit'])
    expect(c.nameEm).toBeGreaterThanOrEqual(10)
    expect(c.numberStyle).toBe('chip')
    expect(c.pitInline).toBe(false)
  })

  it('fits every default column, the best lap included, at the default 540 px', () => {
    const c = fitColumns(prefs(), 540, 13)
    expect(c.cells).toEqual(['gained', 'ir', 'lic', 'gap', 'last', 'best', 'pit'])
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
    expect(c.cells).toEqual(order)
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
      const p = prefs({ columns: allColumns(order), iRatingDeltaAll: true })
      let prev: string[] = []
      for (let w = 900; w >= 200; w -= 5) {
        const d = dropped(p, w)
        // Always a prefix of DROP_ORDER, growing as the width shrinks.
        expect(d).toEqual(DROP_ORDER.slice(0, d.length))
        expect(d.slice(0, prev.length)).toEqual(prev)
        prev = d
      }
      expect(prev).toEqual([...DROP_ORDER])
      expect(fitColumns(p, 200, 13).cells).toEqual(['gap'])
    }
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
    expect(c.cells).toHaveLength(12)
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
    const plain = fitColumns(prefs(), 540, 13).cells
    const c = fitColumns(prefs({ brand: true, flag: true }), 540, 13)
    expect(c.cells).toEqual(plain)
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
