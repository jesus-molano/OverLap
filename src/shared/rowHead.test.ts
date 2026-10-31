import { describe, expect, it } from 'vitest'
import { OPTION_SCHEMA } from './settingsSchema'
import {
  BLOCK_PARTS,
  DRIVER_PARTS,
  ROW_HEAD_IDS,
  isBlockPart,
  isDriverPart,
  moveAfterName,
  nameGroup
} from './rowHead'

describe('nameGroup (request 11)', () => {
  it('draws today’s row: the number, the make and the flag before the name, the flags after it', () => {
    const g = nameGroup(
      ['pos', 'number', 'brand', 'country', 'driver', 'flags', 'ir', 'gap'],
      'driver'
    )
    expect(g.tracks).toEqual(['pos', 'driver', 'ir', 'gap'])
    expect(g.before).toEqual(['number', 'brand', 'country'])
    expect(g.after).toEqual(['flags'])
  })

  it('keeps with the name only the parts that touch it', () => {
    // «Puestos ganados» between the position and the number, the flags between the number and
    // the make: the number still touches the name through the flags and the make.
    const g = nameGroup(
      ['pos', 'gained', 'number', 'flags', 'brand', 'country', 'driver', 'gap'],
      'driver'
    )
    expect(g.tracks).toEqual(['pos', 'gained', 'driver', 'gap'])
    expect(g.before).toEqual(['number', 'flags', 'brand', 'country'])
    // A column between the number and the name: the number is a column of its own.
    const apart = nameGroup(['number', 'gained', 'country', 'driver', 'brand', 'gap'], 'driver')
    expect(apart.tracks).toEqual(['number', 'gained', 'driver', 'gap'])
    expect(apart.before).toEqual(['country'])
    expect(apart.after).toEqual(['brand'])
  })

  it('never takes the position into the name’s cell, and leaves a row without the name alone', () => {
    const g = nameGroup(['number', 'pos', 'driver'], 'driver')
    expect(g.tracks).toEqual(['number', 'pos', 'driver'])
    expect(g.before).toEqual([])
    const none = nameGroup(['pos', 'number', 'gap'], 'driver')
    expect(none).toEqual({ tracks: ['pos', 'number', 'gap'], before: [], after: [] })
  })
})

describe('moveAfterName', () => {
  it('moves a part right after the name, and nothing without one of them', () => {
    expect(moveAfterName(['flags', 'pos', 'driver', 'gap'], 'flags', 'driver')).toEqual([
      'pos',
      'driver',
      'flags',
      'gap'
    ])
    const cells = ['pos', 'driver', 'gap']
    expect(moveAfterName(cells, 'flags', 'driver')).toBe(cells)
  })
})

describe('the row’s start in the tables’ lists', () => {
  it('starts both lists in today’s order, the penalty flags right after the name', () => {
    for (const spec of [OPTION_SCHEMA.relative.columns, OPTION_SCHEMA.standings.columns]) {
      expect(spec.ids.slice(0, 6)).toEqual([...ROW_HEAD_IDS, 'flags'])
      // The «Piloto» block's parts and the name: always in the list, the list only places them.
      for (const id of [...BLOCK_PARTS, 'driver']) expect(spec.required).toContain(id)
      expect(spec.required).not.toContain('pos')
      expect(spec.required).not.toContain('number')
    }
  })

  it('names the driver’s parts and the block’s', () => {
    expect(DRIVER_PARTS.every(isDriverPart)).toBe(true)
    expect(isDriverPart('pos')).toBe(false)
    expect(isDriverPart('driver')).toBe(false)
    expect(BLOCK_PARTS.every(isBlockPart)).toBe(true)
    expect(isBlockPart('number')).toBe(false)
  })
})
