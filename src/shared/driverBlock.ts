/**
 * The «Piloto» block (R08): the options that change the driver cell, the same in Relativo,
 * Posiciones, Batalla and Tráfico, each one its own value or 'inherit' (Apariencia's). Pure.
 */
import type { BrandMarkMode } from './carBrands'
import type { AppearanceSettings, NameFormat } from './types'

/** As a driver widget stores them. */
export interface DriverBlockOptions {
  readonly brandMarks: BrandMarkMode | 'inherit'
  readonly countryFlags: boolean | 'inherit'
  readonly showFlags: boolean | 'inherit'
  readonly nameFormat: NameFormat | 'inherit'
}

/** As the widget draws them. */
export interface DriverBlock {
  readonly brandMarks: BrandMarkMode
  readonly countryFlags: boolean
  readonly showFlags: boolean
  readonly nameFormat: NameFormat
}

export type DriverBlockGlobals = Pick<
  AppearanceSettings,
  'brandMarks' | 'countryFlags' | 'penaltyFlags' | 'nameFormat'
>

/** The driver widgets, in the sidebar's order: the four with a «Piloto» block. */
export const DRIVER_BLOCK_SECTIONS = ['relative', 'standings', 'battle', 'traffic'] as const
export type DriverBlockSection = (typeof DRIVER_BLOCK_SECTIONS)[number]

/** The fields of the block, in the order of the page (and of DriverBlock). */
export const DRIVER_BLOCK_FIELDS = [
  'nameFormat',
  'brandMarks',
  'countryFlags',
  'showFlags'
] as const

/** Each of `own`'s values, or Apariencia's where it says 'inherit' (or has none). */
export function driverBlock(
  own: Partial<DriverBlockOptions>,
  global: DriverBlockGlobals
): DriverBlock {
  const pick = <T>(v: T | 'inherit' | undefined, g: T): T =>
    v === undefined || v === 'inherit' ? g : v
  return {
    brandMarks: pick(own.brandMarks, global.brandMarks),
    countryFlags: pick(own.countryFlags, global.countryFlags),
    showFlags: pick(own.showFlags, global.penaltyFlags),
    nameFormat: pick(own.nameFormat, global.nameFormat)
  }
}

/** The driver widgets with a value of their own in the block (not 'inherit'), for Apariencia. */
export function ownDriverBlocks(
  sections: Readonly<Record<DriverBlockSection, Partial<DriverBlockOptions>>>
): DriverBlockSection[] {
  return DRIVER_BLOCK_SECTIONS.filter((id) =>
    DRIVER_BLOCK_FIELDS.some((f) => {
      const v = sections[id][f]
      return v !== undefined && v !== 'inherit'
    })
  )
}

/** The patch that puts every field of the block back on 'inherit' in `ids`. */
export function inheritDriverBlocks(
  ids: readonly DriverBlockSection[]
): Partial<Record<DriverBlockSection, DriverBlockOptions>> {
  const all: DriverBlockOptions = {
    brandMarks: 'inherit',
    countryFlags: 'inherit',
    showFlags: 'inherit',
    nameFormat: 'inherit'
  }
  const out: Partial<Record<DriverBlockSection, DriverBlockOptions>> = {}
  for (const id of ids) out[id] = { ...all }
  return out
}
