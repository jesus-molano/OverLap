import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { applyLayout, linkCar, noteSeenCar, saveLayoutAs, setLayoutMode } from '@shared/layouts'
import { createDefaultSettings } from '@shared/settings'
import type { LayoutSort, OverlaySettings } from '@shared/types'
import {
  LAYOUT_LIST_ROWS,
  carRows,
  layoutList,
  layoutMatches,
  linkOptions,
  isFileNotice,
  noticeText,
  optionsTarget,
  revealOffset,
  rowToReveal,
  targetShown,
  type LayoutListOptions
} from './layoutsView'

const es = messagesFor('es')
const en = messagesFor('en')
const MAZDA = { carId: 67, carName: 'Mazda MX-5 Cup' }

function opts(sort: LayoutSort = 'custom', query = ''): LayoutListOptions {
  return { sort, query, locale: 'es-ES' }
}

/** 'Principal' and `names` after it, saved one a second apart; `active` (an index) in use. */
function library(names: readonly string[], active = 0): OverlaySettings {
  const s = createDefaultSettings()
  names.forEach((n, i) => saveLayoutAs(s, n, 1_000 * (i + 1)))
  applyLayout(s, s.savedLayouts.list[active]?.id ?? 'layout-1', 100_000)
  return s
}

const MANY = [
  'Mazda',
  'GT3 Sprint',
  'Ñürburgring 24 h — Resistencia nocturna',
  'Óvalo',
  'Fórmula',
  'Rally',
  'Lluvia',
  'GT4'
]

describe('layoutList', () => {
  it('a short list in your order: as stored, the one in use in its place, every row movable', () => {
    const s = createDefaultSettings()
    saveLayoutAs(s, 'Mazda')
    linkCar(s, MAZDA, 'layout-2')
    linkCar(s, { carId: 9, carName: '' }, 'layout-2')
    const v = layoutList(es, s.savedLayouts, opts())
    expect(v).toMatchObject({
      pinned: null,
      many: false,
      total: 2,
      shown: 2,
      reorder: true,
      aroundActive: false
    })
    expect(v.rows).toEqual([
      {
        id: 'layout-1',
        name: 'Principal',
        active: false,
        canDelete: true,
        canMoveUp: false,
        canMoveDown: true,
        mode: 'full',
        cars: ''
      },
      {
        id: 'layout-2',
        name: 'Mazda',
        active: true,
        canDelete: false,
        canMoveUp: true,
        canMoveDown: false,
        mode: 'full',
        cars: 'Coches: Mazda MX-5 Cup, Coche 9'
      }
    ])
  })

  it('pins the one in use once the list is long, and moves the rest among themselves', () => {
    const s = library(MANY, 2)
    expect(s.savedLayouts.list).toHaveLength(LAYOUT_LIST_ROWS + 1)
    const v = layoutList(es, s.savedLayouts, opts())
    expect(v).toMatchObject({ many: true, reorder: true, aroundActive: true })
    expect(v.pinned).toMatchObject({ name: 'GT3 Sprint', active: true, canMoveUp: false })
    expect(v.pinned?.canMoveDown).toBe(false)
    expect(v.rows.map((r) => r.name)).toEqual(
      ['Principal', ...MANY].filter((n) => n !== 'GT3 Sprint')
    )
    expect(v.rows[0]).toMatchObject({ canMoveUp: false, canMoveDown: true })
    expect(v.rows.at(-1)).toMatchObject({ canMoveUp: true, canMoveDown: false })
  })

  it('pins the one in use in the other orders, which offer no chevrons', () => {
    const s = library(['Zeta', 'alfa', 'Ágata', 'beta'], 1)
    const byName = layoutList(es, s.savedLayouts, opts('name'))
    expect(byName.pinned?.name).toBe('Zeta')
    expect(byName.rows.map((r) => r.name)).toEqual(['Ágata', 'alfa', 'beta', 'Principal'])
    expect(byName).toMatchObject({ reorder: false, aroundActive: true })
    expect(byName.rows.some((r) => r.canMoveUp || r.canMoveDown)).toBe(false)
    // Saved at 1, 2, 3, 4 s; 'Zeta' applied last (pinned); Principal never used.
    const recent = layoutList(es, s.savedLayouts, opts('recent'))
    expect(recent.rows.map((r) => r.name)).toEqual(['beta', 'Ágata', 'alfa', 'Principal'])
    // The stored order is untouched.
    expect(s.savedLayouts.list.map((l) => l.name)).toEqual([
      'Principal',
      'Zeta',
      'alfa',
      'Ágata',
      'beta'
    ])
  })

  it('searches by name and by linked car, without case or accents, every word', () => {
    const s = library([...MANY, 'Porsche Cup'], 1)
    linkCar(s, { carId: 143, carName: 'Pórsche 911 GT3 R' }, 'layout-3')
    const lib = s.savedLayouts
    const names = (q: string): string[] =>
      layoutList(es, lib, opts('custom', q)).rows.map((r) => r.name)
    expect(names('porsche')).toEqual(['GT3 Sprint', 'Porsche Cup'])
    expect(names('  NURBURGRING  noct ')).toEqual(['Ñürburgring 24 h — Resistencia nocturna'])
    expect(names('formula')).toEqual(['Fórmula'])
    expect(names('gt3 911')).toEqual(['GT3 Sprint'])
    expect(layoutMatches(es, lib, lib.list[0]!, '')).toBe(true)
    const v = layoutList(es, lib, opts('custom', 'porsche'))
    expect(v).toMatchObject({ shown: 2, total: 10, query: 'porsche', reorder: false })
    expect(v.rows.every((r) => !r.canMoveUp && !r.canMoveDown)).toBe(true)
  })

  it('keeps the one in use pinned apart when the search leaves it out', () => {
    const s = library([...MANY, 'Porsche Cup'], 0)
    const v = layoutList(es, s.savedLayouts, opts('custom', 'porsche'))
    expect(v.pinned?.name).toBe('Principal')
    expect(v.pinnedMatches).toBe(false)
    expect(v.rows.map((r) => r.name)).toEqual(['Porsche Cup'])
    expect(v.shown).toBe(1)
    const none = layoutList(es, s.savedLayouts, opts('custom', 'zzz'))
    expect(none).toMatchObject({ rows: [], shown: 0, query: 'zzz' })
    expect(layoutList(es, s.savedLayouts, opts('custom', 'princ'))).toMatchObject({
      pinnedMatches: true,
      shown: 1
    })
  })

  it('ignores a search with too few layouts to offer one', () => {
    const s = library(['Mazda'])
    expect(layoutList(es, s.savedLayouts, opts('custom', 'zzz'))).toMatchObject({
      query: '',
      shown: 2,
      reorder: true
    })
  })
})

describe('linkOptions', () => {
  it('lists the layouts A to Z for the car selects', () => {
    const s = library(['Zeta', 'Ágata', 'GT3 (10)', 'GT3 (2)'])
    expect(linkOptions(s.savedLayouts, 'es-ES').map((l) => l.name)).toEqual([
      'Ágata',
      'GT3 (2)',
      'GT3 (10)',
      'Principal',
      'Zeta'
    ])
  })
})

describe('rowToReveal', () => {
  const at = (ids: string[], activeId: string): { ids: string[]; activeId: string } => ({
    ids,
    activeId
  })
  it('is a new layout, else the one put in use, else none', () => {
    expect(rowToReveal(at(['a', 'b'], 'a'), at(['a', 'b', 'c'], 'c'))).toBe('c')
    expect(rowToReveal(at(['a', 'b'], 'a'), at(['a', 'c', 'b'], 'a'))).toBe('c')
    expect(rowToReveal(at(['a', 'b'], 'a'), at(['a', 'b'], 'b'))).toBe('b')
    expect(rowToReveal(at(['a', 'b'], 'a'), at(['b', 'a'], 'a'))).toBeNull()
    expect(rowToReveal(at(['a', 'b'], 'a'), at(['a'], 'a'))).toBeNull()
  })
})

describe('revealOffset', () => {
  const box = { top: 100, bottom: 400 }
  it('scrolls just enough for the row to be whole, never past its top', () => {
    expect(revealOffset(box, { top: 150, bottom: 200 })).toBe(0)
    expect(revealOffset(box, { top: 80, bottom: 130 })).toBe(-20)
    expect(revealOffset(box, { top: 380, bottom: 430 })).toBe(30)
    expect(revealOffset(box, { top: 120, bottom: 600 })).toBe(20)
  })
})

describe('carRows', () => {
  it('puts the car you are in first, with its link', () => {
    const s = createDefaultSettings()
    noteSeenCar(s, { carId: 132, carName: 'GT3' })
    linkCar(s, MAZDA, 'layout-1')
    const rows = carRows(es, s.savedLayouts, MAZDA)
    expect(rows.map((r) => [r.label, r.layoutId, r.current])).toEqual([
      ['Mazda MX-5 Cup', 'layout-1', true],
      ['GT3', '', false]
    ])
  })
})

describe('noticeText', () => {
  it('words every export and import result in both languages', () => {
    expect(noticeText(es, { kind: 'exported', name: 'Mazda' })).toEqual({
      text: 'Exportada: Mazda',
      error: false
    })
    expect(noticeText(en, { kind: 'imported', name: 'GT3' }).text).toBe(
      'Imported: GT3. Apply it whenever you like'
    )
    expect(noticeText(es, { kind: 'export-failed', name: 'X' }).error).toBe(true)
    for (const error of [
      'json',
      'format',
      'version',
      'empty',
      'too-big',
      'read',
      'full'
    ] as const) {
      const n = noticeText(es, { kind: 'import-failed', error })
      expect(n.error).toBe(true)
      expect(n.text.length, error).toBeGreaterThan(0)
    }
  })

  it('leaves a widget page’s copy to that page', () => {
    expect(isFileNotice({ kind: 'imported', name: 'GT3' })).toBe(true)
    const copied = { kind: 'options-copied', widgetId: 'radar', result: 'stale' } as const
    expect(isFileNotice(copied)).toBe(false)
    for (const m of [es, en]) {
      const done = m.settings.widgetPage.target.toAll.done
      for (const r of ['copied', 'unchanged', 'stale'] as const) expect(done[r]).not.toBe('')
    }
  })
})

describe('optionsTarget', () => {
  it('names the layout in use, or says the shared options for a "Solo posición" one', () => {
    const s = createDefaultSettings()
    expect(optionsTarget(s.savedLayouts)).toEqual({
      id: 'layout-1',
      name: 'Principal',
      shared: false,
      canApplyToAll: false
    })
    saveLayoutAs(s, 'Óvalo', 1, 'position')
    expect(optionsTarget(s.savedLayouts)).toEqual({
      id: 'layout-2',
      name: 'Óvalo',
      shared: true,
      canApplyToAll: true
    })
  })

  it('offers the copy only when it reaches another layout', () => {
    const s = createDefaultSettings()
    saveLayoutAs(s, 'Óvalo', 1, 'position')
    saveLayoutAs(s, 'Rally', 2, 'position')
    // Principal is the one full layout besides.
    expect(optionsTarget(s.savedLayouts).canApplyToAll).toBe(true)
    setLayoutMode(s, 'layout-1', 'position')
    // Every layout uses the shared options: those already are the ones in effect.
    expect(optionsTarget(s.savedLayouts).canApplyToAll).toBe(false)
    // From a full one, the position-only ones are reached through the shared options.
    setLayoutMode(s, 'layout-3', 'full')
    expect(optionsTarget(s.savedLayouts).canApplyToAll).toBe(true)
  })
})

describe('targetShown', () => {
  it('says where changes go only with two layouts or more, or a "Solo posición" one in use', () => {
    expect(targetShown(1, false)).toBe(false)
    expect(targetShown(2, false)).toBe(true)
    expect(targetShown(1, true)).toBe(true)
  })
})
