import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { createDefaultSettings } from '@shared/settings'
import { STANDINGS_COLUMN_IDS } from '@shared/settingsSchema'
import type { StandingsColumn, StandingsOptions } from '@shared/types'
import {
  columnHint,
  columnLabel,
  columnVisiblePatch,
  deltaAllPatch,
  dropIndex,
  fixedColumns,
  gapModePatch,
  isColumnVisible,
  moveColumn,
  movedMessage,
  defaultOrder,
  sameOrder,
  setColumnVisible,
  visibilityMessage
} from './columns'

const ids = (cols: readonly StandingsColumn[]): string[] => cols.map((c) => c.id)

function opts(change: Partial<StandingsOptions> = {}): StandingsOptions {
  return { ...createDefaultSettings().standings, ...change }
}

describe('moveColumn', () => {
  const cols = opts().columns

  it('moves an item down and up', () => {
    expect(ids(moveColumn(cols, 0, 2)).slice(0, 3)).toEqual(['ir', 'lic', 'gained'])
    expect(ids(moveColumn(cols, 3, 0)).slice(0, 4)).toEqual(['delta', 'gained', 'ir', 'lic'])
  })

  it('clamps out-of-range indices and keeps every id once', () => {
    const moved = moveColumn(cols, 1, 99)
    expect(ids(moved).at(-1)).toBe('ir')
    expect([...ids(moved)].sort()).toEqual([...STANDINGS_COLUMN_IDS].sort())
    expect(ids(moveColumn(cols, -4, 1)).slice(0, 2)).toEqual(['ir', 'gained'])
  })

  it('returns an equal copy for no-ops and never mutates the input', () => {
    const before = structuredClone(cols)
    const same = moveColumn(cols, 2, 2)
    expect(same).toEqual(cols)
    expect(same).not.toBe(cols)
    expect(moveColumn(cols, Number.NaN, 1)).toEqual(cols)
    expect(moveColumn([], 0, 1)).toEqual([])
    moveColumn(cols, 0, 5)
    expect(cols).toEqual(before)
  })
})

describe('visibility', () => {
  it('sets one column and reads it back', () => {
    const cols = setColumnVisible(opts().columns, 'delta', true)
    expect(isColumnVisible(cols, 'delta')).toBe(true)
    expect(isColumnVisible(opts().columns, 'delta')).toBe(false)
    expect(ids(cols)).toEqual(ids(opts().columns))
  })

  it('compares the order only', () => {
    const cols = opts().columns
    expect(sameOrder(cols, structuredClone(cols))).toBe(true)
    expect(sameOrder(cols, setColumnVisible(cols, 'ir', false))).toBe(true)
    expect(sameOrder(cols, moveColumn(cols, 0, 1))).toBe(false)
    expect(sameOrder(cols, cols.slice(1))).toBe(false)
  })

  it('restores the default order and keeps each visibility', () => {
    const custom = setColumnVisible(moveColumn(opts().columns, 7, 0), 'gapLeader', true)
    const back = defaultOrder(custom)
    expect(ids(back)).toEqual([...STANDINGS_COLUMN_IDS])
    expect(isColumnVisible(back, 'gapLeader')).toBe(true)
    expect(back[0]).not.toBe(custom[1])
    expect(ids(defaultOrder(custom.slice(2)))).not.toContain('pit')
  })
})

describe('dropIndex', () => {
  // Five 30 px rows starting at y = 100: centres 115, 145, 175, 205, 235.
  const centres = [115, 145, 175, 205, 235]

  it('lands where the pointer is, ignoring the dragged item', () => {
    expect(dropIndex(centres, 0, 110)).toBe(0)
    expect(dropIndex(centres, 0, 150)).toBe(1)
    expect(dropIndex(centres, 0, 400)).toBe(4)
    expect(dropIndex(centres, 4, 0)).toBe(0)
    expect(dropIndex(centres, 4, 180)).toBe(3)
    expect(dropIndex(centres, 2, 170)).toBe(2)
  })

  it('agrees with moveColumn for every start and slot', () => {
    const cols = opts().columns.slice(0, 5)
    for (let from = 0; from < 5; from++) {
      for (let slot = 0; slot < 5; slot++) {
        const y = 100 + slot * 30 + 15
        const to = dropIndex(centres, from, y + (slot > from ? 1 : -1))
        expect(ids(moveColumn(cols, from, to)).indexOf(cols[from]!.id)).toBe(slot)
      }
    }
  })
})

describe('messages and labels', () => {
  const es = messagesFor('es')
  const en = messagesFor('en')

  it('announces moves and visibility in Spanish', () => {
    expect(movedMessage(es, 'ir', 2, 8)).toBe('iRating movida a la posición 3 de 8.')
    expect(visibilityMessage(es, 'last', false)).toBe('Última vuelta oculta.')
    expect(visibilityMessage(es, 'pit', true)).toBe('Boxes visible.')
  })

  it('labels every column and the fixed block', () => {
    for (const m of [es, en]) {
      for (const id of STANDINGS_COLUMN_IDS) expect(columnLabel(m, id)).not.toBe('')
    }
    expect(columnLabel(es, 'gapLeader')).toBe('Hueco al líder')
    expect(fixedColumns(es).map((c) => c.label)).toEqual(['Posición', 'Número', 'Nombre'])
    expect(fixedColumns(es).map((c) => c.key)).toEqual(['pos', 'num', 'name'])
  })

  it('gives a hint only to the columns that have one', () => {
    expect(columnHint(es, 'gapLeader')).toBe('Con «Hueco: Ambos»')
    expect(columnHint(es, 'ir')).toBeUndefined()
    expect(columnHint(en, 'lic')).toBeUndefined()
    expect(columnHint(en, 'last')).toBe('Outside races, the best lap')
  })

  it('speaks English with the English dictionary', () => {
    expect(columnLabel(en, 'last')).toBe('Last lap')
    expect(columnLabel(en, 'gap')).toBe('Gap')
    expect(movedMessage(en, 'ir', 2, 8)).toBe('iRating moved to position 3 of 8.')
    expect(visibilityMessage(en, 'pit', true)).toBe('Pit shown.')
    expect(visibilityMessage(en, 'last', false)).toBe('Last lap hidden.')
    expect(fixedColumns(en).map((c) => c.label)).toEqual(['Position', 'Number', 'Name'])
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
