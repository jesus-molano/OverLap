import { describe, expect, it } from 'vitest'
import {
  DRIVER_BLOCK_SECTIONS,
  driverBlock,
  inheritDriverBlocks,
  ownDriverBlocks,
  type DriverBlockOptions
} from './driverBlock'
import { createDefaultSettings } from './settings'

const GLOBAL = {
  brandMarks: 'auto',
  countryFlags: true,
  penaltyFlags: true,
  nameFormat: 'abbr'
} as const

const INHERIT: DriverBlockOptions = {
  brandMarks: 'inherit',
  countryFlags: 'inherit',
  showFlags: 'inherit',
  nameFormat: 'inherit'
}

describe('the «Piloto» block (R08)', () => {
  it('takes Apariencia’s value where a widget says Global, its own elsewhere', () => {
    expect(driverBlock(INHERIT, GLOBAL)).toEqual({
      brandMarks: 'auto',
      countryFlags: true,
      showFlags: true,
      nameFormat: 'abbr'
    })
    expect(
      driverBlock(
        { brandMarks: 'off', countryFlags: false, showFlags: 'inherit' },
        {
          ...GLOBAL,
          penaltyFlags: false
        }
      )
    ).toEqual({ brandMarks: 'off', countryFlags: false, showFlags: false, nameFormat: 'abbr' })
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
