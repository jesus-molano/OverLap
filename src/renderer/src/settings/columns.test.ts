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
  gapModePatch,
  linkedParts,
  isColumnVisible,
  matchSharedColumns,
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

describe('linkedParts (request 11)', () => {
  const globals = createDefaultSettings().appearance

  it('says where the logo and the flags are shown or hidden, and how they are now', () => {
    const es = linkedParts(messagesFor('es'), { brandMarks: 'inherit' }, globals)
    expect(Object.keys(es)).toEqual(['brand', 'country', 'flags'])
    expect(es.brand?.hint).toBe(`Se muestra u oculta en «Piloto»: Global (Auto)`)
    expect(es.brand?.on).toBe(true)
    expect(es.flags?.title).toBe('Se muestra u oculta en «Piloto»')
    const en = linkedParts(messagesFor('en'), {}, globals)
    expect(en.country?.hint.startsWith('Shown or hidden in “Driver”: ')).toBe(true)
  })

  it('follows the block: its own value, else Apariencia’s', () => {
    const off = linkedParts(
      messagesFor('es'),
      { brandMarks: 'off', countryFlags: false, showFlags: 'inherit' },
      { ...globals, penaltyFlags: false }
    )
    expect(off.brand).toMatchObject({ on: false, hint: 'Se muestra u oculta en «Piloto»: Nunca' })
    expect(off.country).toMatchObject({ on: false, hint: 'Se muestra u oculta en «Piloto»: No' })
    expect(off.flags).toMatchObject({
      on: false,
      hint: 'Se muestra u oculta en «Piloto»: Global (No)'
    })
    // Only the parts a list has (Tráfico: the penalty flags).
    expect(Object.keys(linkedParts(messagesFor('es'), {}, globals, ['flags']))).toEqual(['flags'])
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

  it('hiding the delta column turns "iRating en juego de todos" off', () => {
    const o = opts({
      iRatingDeltaAll: true,
      columns: setColumnVisible(opts().columns, 'delta', true)
    })
    const next = setColumnVisible(o.columns, 'delta', false)
    const p = columnsEditPatch(o, next, { kind: 'visible', id: 'delta', visible: false })
    expect(p.iRatingDeltaAll).toBe(false)
  })

  it('"Deshacer" after hiding the delta column turns "iRating en juego de todos" back on', () => {
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

  it('a reset brings the gap mode and "iRating en juego de todos" in line with the default list', () => {
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

  it('"iRating en juego de todos" shows the delta column, hiding it drops the option', () => {
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

describe('matchSharedColumns (R10: «Igualar con…»)', () => {
  const L = <T extends string>(spec: string): { id: T; visible: boolean }[] =>
    spec.split(' ').map((s) => ({ id: s.replace('-', '') as T, visible: !s.startsWith('-') }))

  it('gives the shared columns the other table’s order and eyes, the own ones keep their place', () => {
    const relative = L('pos driver ir lic -pit -tyre -stint gap')
    const standings = L('-gained lic ir -delta gap -gapLeader last best pit -pitLap stint -tyre')
    expect(matchSharedColumns(relative, standings)).toEqual(
      L('pos driver lic ir gap pit stint -tyre')
    )
    expect(matchSharedColumns(standings, relative)).toEqual(
      L('-gained ir lic -delta -pit -gapLeader last best -tyre -pitLap -stint gap')
    )
  })

  it('carries «Última vuelta» both ways, as any column both tables have (request 8)', () => {
    const relative = L('pos driver ir lic gap -last -pit -stint -tyre')
    const standings = L('-gained ir lic last -delta gap -gapLeader best pit -pitLap stint -tyre')
    // Its place and eye come from the standings: shown, before the gap.
    expect(matchSharedColumns(relative, standings)).toEqual(
      L('pos driver ir lic last gap pit stint -tyre')
    )
    expect(matchSharedColumns(standings, relative)).toEqual(
      L('-gained ir lic gap -delta -last -gapLeader best -pit -pitLap -stint -tyre')
    )
  })

  it('changes nothing when both already agree', () => {
    const a = L('pos driver ir lic -pit -tyre -stint gap')
    expect(matchSharedColumns(a, a)).toEqual(a)
  })
})

describe('«Igualar con…» carries the row’s start (request 11)', () => {
  const L = <T extends string>(spec: string): { id: T; visible: boolean }[] =>
    spec.split(' ').map((s) => ({ id: s.replace('-', '') as T, visible: !s.startsWith('-') }))

  it('places the position, the number, the make, the flags and the name as the other table', () => {
    // Posiciones: «Puestos ganados» between the position and the number, the flags after it.
    const standings = L('pos gained number flags brand country driver ir lic gap last best pit')
    const relative = L('pos number brand country driver flags ir lic gap -last -pit -stint -tyre')
    expect(matchSharedColumns(relative, standings)).toEqual(
      L('pos number flags brand country driver ir lic gap last pit -stint -tyre')
    )
    // And back: the relative's hidden position goes to the standings with its eye.
    const hidden = L('-pos country number brand driver flags ir lic gap -last -pit -stint -tyre')
    expect(matchSharedColumns(standings, hidden).slice(0, 7)).toEqual(
      L('-pos gained country number brand driver flags')
    )
  })
})
