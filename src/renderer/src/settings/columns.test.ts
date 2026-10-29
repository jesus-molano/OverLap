import { describe, expect, it } from 'vitest'
import { moveElement } from '@shared/elements'
import { messagesFor } from '@shared/i18n'
import { createDefaultSettings } from '@shared/settings'
import type { StandingsColumn, StandingsOptions } from '@shared/types'
import {
  columnVisiblePatch,
  columnsEditPatch,
  deltaAllDroppedAfter,
  deltaAllPatch,
  fixedColumns,
  gapModePatch,
  isColumnVisible,
  setColumnVisible
} from './columns'

const ids = (cols: readonly StandingsColumn[]): string[] => cols.map((c) => c.id)

function opts(change: Partial<StandingsOptions> = {}): StandingsOptions {
  return { ...createDefaultSettings().standings, ...change }
}

describe('visibility', () => {
  it('shows and hides one column, a copy each time', () => {
    const cols = opts().columns
    const off = setColumnVisible(cols, 'ir', false)
    expect(isColumnVisible(off, 'ir')).toBe(false)
    expect(isColumnVisible(cols, 'ir')).toBe(true)
    expect(ids(off)).toEqual(ids(cols))
    expect(off[0]).not.toBe(cols[0])
  })
})

describe('fixedColumns', () => {
  it('lists the fixed left block in both languages', () => {
    expect(fixedColumns(messagesFor('es')).map((c) => c.label)).toEqual([
      'Posición',
      'Número',
      'Nombre'
    ])
    expect(fixedColumns(messagesFor('en')).map((c) => c.label)).toEqual([
      'Position',
      'Number',
      'Name'
    ])
    expect(fixedColumns(messagesFor('es')).map((c) => c.key)).toEqual(['pos', 'num', 'name'])
  })
})

describe('columnsEditPatch', () => {
  it('a move sends the new order only', () => {
    const o = opts()
    const next = moveElement(o.columns, 0, 3)
    const p = columnsEditPatch(o, next, { kind: 'move', id: 'gained', to: 3 })
    expect(Object.keys(p)).toEqual(['columns'])
    expect(ids(p.columns!)).toEqual(ids(next))
  })

  it('showing the gapLeader column switches to "Ambos", hiding it goes back', () => {
    const o = opts()
    const shown = setColumnVisible(o.columns, 'gapLeader', true)
    const on = columnsEditPatch(o, shown, { kind: 'visible', id: 'gapLeader', visible: true })
    expect(on.gapMode).toBe('both')
    const both = opts({ gapMode: 'both', columns: on.columns! })
    const hidden = setColumnVisible(both.columns, 'gapLeader', false)
    const off = columnsEditPatch(both, hidden, { kind: 'visible', id: 'gapLeader', visible: false })
    expect(off.gapMode).toBe('interval')
    expect(isColumnVisible(off.columns!, 'gapLeader')).toBe(false)
  })

  it('hiding the delta column turns "Δ iRating de todos" off', () => {
    const o = opts({
      iRatingDeltaAll: true,
      columns: setColumnVisible(opts().columns, 'delta', true)
    })
    const next = setColumnVisible(o.columns, 'delta', false)
    const p = columnsEditPatch(o, next, { kind: 'visible', id: 'delta', visible: false })
    expect(p.iRatingDeltaAll).toBe(false)
  })

  it('"Deshacer" after hiding the delta column turns "Δ iRating de todos" back on', () => {
    const o = opts({
      iRatingDeltaAll: true,
      columns: setColumnVisible(opts().columns, 'delta', true)
    })
    const hidden = setColumnVisible(o.columns, 'delta', false)
    const hide = { kind: 'visible', id: 'delta', visible: false } as const
    const p = columnsEditPatch(o, hidden, hide)
    const dropped = deltaAllDroppedAfter(false, hide, p)
    expect(dropped).toBe(true)
    // A move in between keeps it.
    const moved = deltaAllDroppedAfter(dropped, { kind: 'move', id: 'ir', to: 1 }, {})
    expect(moved).toBe(true)
    const off = opts({ ...o, ...p })
    const undo = { kind: 'visible', id: 'delta', visible: true, undo: true } as const
    const back = columnsEditPatch(off, o.columns, undo, moved)
    expect(back.iRatingDeltaAll).toBe(true)
    expect(isColumnVisible(back.columns ?? [], 'delta')).toBe(true)
    // Showing it by hand never does, nor an undo when the hide left the option alone.
    const show = { kind: 'visible', id: 'delta', visible: true } as const
    expect(columnsEditPatch(off, o.columns, show, true).iRatingDeltaAll).toBeUndefined()
    expect(columnsEditPatch(off, o.columns, undo, false).iRatingDeltaAll).toBeUndefined()
    // The column's visibility changed another way, or a reset: over.
    expect(deltaAllDroppedAfter(true, show, {})).toBe(false)
    expect(deltaAllDroppedAfter(true, { kind: 'reset' }, {})).toBe(false)
    const quiet = columnsEditPatch(opts(), hidden, hide)
    expect(deltaAllDroppedAfter(false, hide, quiet)).toBe(false)
  })

  it('a reset brings the gap mode and "Δ iRating de todos" in line with the default list', () => {
    const o = opts({
      gapMode: 'both',
      iRatingDeltaAll: true,
      columns: setColumnVisible(setColumnVisible(opts().columns, 'gapLeader', true), 'delta', true)
    })
    const defaults = opts().columns
    const p = columnsEditPatch(o, defaults, { kind: 'reset' })
    expect(p).toEqual({ columns: defaults, gapMode: 'interval', iRatingDeltaAll: false })
    // Already in line: the list alone.
    expect(columnsEditPatch(opts(), defaults, { kind: 'reset' })).toEqual({ columns: defaults })
    // A 'leader' mode with the gapLeader column hidden is in line too.
    expect(columnsEditPatch(opts({ gapMode: 'leader' }), defaults, { kind: 'reset' })).toEqual({
      columns: defaults
    })
  })

  it('sends plain entries, never the editor’s own objects', () => {
    const o = opts()
    const next = o.columns.map((c) => Object.freeze({ ...c }))
    const p = columnsEditPatch(o, next, { kind: 'move', id: 'ir', to: 1 })
    expect(p.columns?.[0]).not.toBe(next[0])
    expect(Object.isFrozen(p.columns?.[0])).toBe(false)
  })
})

describe('coupled patches', () => {
  it('"Ambos" shows the gapLeader column, the other modes hide it', () => {
    const both = gapModePatch(opts(), 'both')
    expect(both.gapMode).toBe('both')
    expect(isColumnVisible(both.columns, 'gapLeader')).toBe(true)
    const back = gapModePatch(opts({ gapMode: 'both', columns: both.columns }), 'leader')
    expect(back.gapMode).toBe('leader')
    expect(isColumnVisible(back.columns, 'gapLeader')).toBe(false)
  })

  it('the gapLeader checkbox switches the gap mode', () => {
    const on = columnVisiblePatch(opts({ gapMode: 'leader' }), 'gapLeader', true)
    expect(on.gapMode).toBe('both')
    expect(isColumnVisible(on.columns!, 'gapLeader')).toBe(true)
    const off = columnVisiblePatch(opts({ gapMode: 'both' }), 'gapLeader', false)
    expect(off.gapMode).toBe('interval')
    const offLeader = columnVisiblePatch(opts({ gapMode: 'leader' }), 'gapLeader', false)
    expect(offLeader.gapMode).toBe('leader')
  })

  it('other columns only change their own visibility', () => {
    const p = columnVisiblePatch(opts(), 'ir', false)
    expect(Object.keys(p)).toEqual(['columns'])
    expect(isColumnVisible(p.columns!, 'ir')).toBe(false)
  })

  it('"Δ iRating de todos" shows the delta column, hiding it drops the option', () => {
    const on = deltaAllPatch(opts(), true)
    expect(on.iRatingDeltaAll).toBe(true)
    expect(isColumnVisible(on.columns!, 'delta')).toBe(true)
    const visible = opts({ columns: on.columns!, iRatingDeltaAll: true })
    expect(deltaAllPatch(visible, false)).toEqual({ iRatingDeltaAll: false })
    expect(deltaAllPatch(visible, true)).toEqual({ iRatingDeltaAll: true })
    const hidden = columnVisiblePatch(visible, 'delta', false)
    expect(hidden.iRatingDeltaAll).toBe(false)
    expect(isColumnVisible(hidden.columns!, 'delta')).toBe(false)
  })
})
