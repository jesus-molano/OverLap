/**
 * Named looks for Apariencia (R56): one click sets the global look as a whole, and Apariencia's
 * controls below stay the fine tuning. They set only the look: the accent (yours), the
 * colour-blind palette (a need, not a look), the SIM tag (a data-state cue, beside the units),
 * the language and the units never change. Widgets
 * with values of their own keep them (no per-widget themes). Pure.
 */
import { OPTION_SCHEMA } from './settingsSchema'
import type { AppearanceSettings } from './types'

/** In the page's order: OverLap's own look (the defaults) first. */
export const APPEARANCE_PRESETS = ['overlap', 'iracing', 'clean', 'compact'] as const

export type AppearancePreset = (typeof APPEARANCE_PRESETS)[number]

/** What a preset sets. */
export const PRESET_FIELDS = [
  'backgroundOpacity',
  'fontScale',
  'textHalo',
  'density',
  'stripes',
  'licenseStyle',
  'numberStyle',
  'nameFormat',
  'brandMarks',
  'brandLogos',
  'countryFlags',
  'penaltyFlags'
] as const satisfies readonly (keyof AppearanceSettings)[]

export type PresetField = (typeof PRESET_FIELDS)[number]

export type PresetValues = Pick<AppearanceSettings, PresetField>

const A = OPTION_SCHEMA.appearance

/** OverLap's look: every field at its default. */
const OVERLAP: PresetValues = {
  backgroundOpacity: A.backgroundOpacity.default,
  fontScale: A.fontScale.default,
  textHalo: A.textHalo.default,
  density: A.density.default,
  stripes: A.stripes.default,
  licenseStyle: A.licenseStyle.default,
  numberStyle: A.numberStyle.default,
  nameFormat: A.nameFormat.default,
  brandMarks: A.brandMarks.default,
  brandLogos: A.brandLogos.default,
  countryFlags: A.countryFlags.default,
  penaltyFlags: A.penaltyFlags.default
}

const VALUES: Readonly<Record<AppearancePreset, PresetValues>> = {
  overlap: OVERLAP,
  // iRacing's own boxes: dark, tight rows, full names, solid licences, no marks or flags.
  iracing: {
    ...OVERLAP,
    backgroundOpacity: 0.9,
    density: 'compact',
    licenseStyle: 'solid',
    nameFormat: 'full',
    brandMarks: 'off',
    countryFlags: false
  },
  // Fewer things drawn: more see-through glass, no alternating rows, the number as a stripe,
  // letters for licences, no marks or flags.
  clean: {
    ...OVERLAP,
    backgroundOpacity: 0.6,
    stripes: false,
    licenseStyle: 'letter',
    numberStyle: 'stripe',
    brandMarks: 'off',
    brandLogos: 'mono',
    countryFlags: false,
    penaltyFlags: false
  },
  // Most in least room: tight rows, smaller text, surnames, numbers as a stripe.
  compact: {
    ...OVERLAP,
    fontScale: 90,
    density: 'compact',
    licenseStyle: 'letter',
    numberStyle: 'stripe',
    nameFormat: 'surname',
    countryFlags: false
  }
}

/** A preset's values, a copy. */
export function presetValues(id: AppearancePreset): PresetValues {
  return { ...VALUES[id] }
}

/** The look as it is now, the preset fields only. */
export function presetFieldsOf(a: Readonly<AppearanceSettings>): PresetValues {
  const out = {} as Record<PresetField, unknown>
  for (const f of PRESET_FIELDS) out[f] = a[f]
  return out as PresetValues
}

/** The preset the look is now, or null when it has been tuned by hand («Personalizado»). */
export function matchingPreset(a: Readonly<AppearanceSettings>): AppearancePreset | null {
  return APPEARANCE_PRESETS.find((id) => PRESET_FIELDS.every((f) => VALUES[id][f] === a[f])) ?? null
}
