import { describe, expect, it } from 'vitest'
import {
  DRIVER_BLOCK_FIELDS,
  DRIVER_BLOCK_SECTIONS,
  driverBlock,
  inheritDriverBlocks,
  ownDriverBlocks,
  type DriverBlockOptions
} from './driverBlock'
import { createDefaultSettings } from './settings'
import { APPEARANCE_PART_FIELDS } from './settings/optionParts'

const GLOBAL = {
  brandMarks: 'auto',
  countryFlags: true,
  penaltyFlags: true,
  nameFormat: 'abbr',
  iRatingFormat: 'compact',
  iRatingColor: false
} as const

const INHERIT: DriverBlockOptions = {
  brandMarks: 'inherit',
  countryFlags: 'inherit',
  showFlags: 'inherit',
  nameFormat: 'inherit',
  iRatingFormat: 'inherit',
  iRatingColor: 'inherit'
}

const DRAWN = {
  brandMarks: 'auto',
  countryFlags: true,
  showFlags: true,
  nameFormat: 'abbr',
  iRatingFormat: 'compact',
  iRatingColor: false
} as const

describe('the «Piloto» block (R08)', () => {
  it('takes Apariencia’s value where a widget says Global, its own elsewhere', () => {
    expect(driverBlock(INHERIT, GLOBAL)).toEqual(DRAWN)
    expect(
      driverBlock(
        { brandMarks: 'off', countryFlags: false, showFlags: 'inherit' },
        {
          ...GLOBAL,
          penaltyFlags: false
        }
      )
    ).toEqual({ ...DRAWN, brandMarks: 'off', countryFlags: false, showFlags: false })
    // A section without the field (none in the settings) follows Apariencia.
    expect(driverBlock({}, GLOBAL)).toEqual(driverBlock(INHERIT, GLOBAL))
  })

  it('is in the four driver widgets with the same fields, Global on a new install', () => {
    const s = createDefaultSettings()
    for (const id of DRIVER_BLOCK_SECTIONS) {
      expect(s[id], id).toMatchObject(INHERIT)
    }
    expect(ownDriverBlocks(s)).toEqual([])
  })

  it('lists the widgets with a value of their own, and puts them back on Global', () => {
    const s = createDefaultSettings()
    s.battle.countryFlags = false
    s.traffic.brandMarks = 'off'
    expect(ownDriverBlocks(s)).toEqual(['battle', 'traffic'])
    expect(inheritDriverBlocks(['battle'])).toEqual({ battle: INHERIT })
  })
})

describe('the iRating’s format and licence colours (request 10)', () => {
  it('are today’s on a new install: «2.5k» in grey, every widget on Global', () => {
    const s = createDefaultSettings()
    expect(s.appearance).toMatchObject({ iRatingFormat: 'compact', iRatingColor: false })
    for (const id of DRIVER_BLOCK_SECTIONS) {
      expect(driverBlock(s[id], s.appearance), id).toMatchObject({
        iRatingFormat: 'compact',
        iRatingColor: false
      })
    }
  })

  it('follow Apariencia unless a widget has its own', () => {
    const g = { ...GLOBAL, iRatingFormat: 'full', iRatingColor: true } as const
    expect(driverBlock(INHERIT, g)).toMatchObject({ iRatingFormat: 'full', iRatingColor: true })
    expect(
      driverBlock({ ...INHERIT, iRatingFormat: 'compact', iRatingColor: false }, g)
    ).toMatchObject({ iRatingFormat: 'compact', iRatingColor: false })
  })

  it('are fields of the block: «Usar global» and the ↺ of «Piloto» and of «Filas y pilotos»', () => {
    expect(DRIVER_BLOCK_FIELDS).toEqual(expect.arrayContaining(['iRatingFormat', 'iRatingColor']))
    const s = createDefaultSettings()
    s.relative.iRatingColor = true
    s.standings.iRatingFormat = 'full'
    expect(ownDriverBlocks(s)).toEqual(['relative', 'standings'])
    expect(APPEARANCE_PART_FIELDS.rows.fields).toEqual(
      expect.arrayContaining(['iRatingFormat', 'iRatingColor'])
    )
  })
})
