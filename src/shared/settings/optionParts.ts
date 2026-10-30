/**
 * Which part of a widget page each of its options sits in (R24: a reset says what and where, and
 * resets only that): «Contenido» (what the widget does), «Piloto» (the driver cell's block, R08)
 * and «Personalizar» (what is drawn: the element lists and the options beside them). Every field
 * of a widget's section is in exactly one part. Pure.
 */
import { ALERT_TOGGLES } from '../alerts'
import { copyData } from '../copy'
import { DRIVER_BLOCK_FIELDS, DRIVER_BLOCK_SECTIONS } from '../driverBlock'
import { INFO_BARS } from '../infoBar'
import { OPTION_SCHEMA, type OptionSection } from '../settingsSchema'
import type { OverlaySettings } from '../types'
import type { WidgetId } from '../widgets'
import { defaultOptions } from './defaults'

export type OptionPart = 'content' | 'driver' | 'customize'

export const OPTION_PARTS: readonly OptionPart[] = ['content', 'driver', 'customize']

/** The track temperature's trend arrow and the wind's dial: options of their info bar items. */
const BAR_EXTRAS = ['conditionsTrend', 'conditionsWindDirection'] as const

/**
 * The options that are not lists but sit beside one in «Personalizar» (a zone's footer or row):
 * each page's own, as its settings component places them.
 */
const CUSTOMIZE_EXTRAS: Readonly<Partial<Record<WidgetId, readonly string[]>>> = {
  relative: ['columnHeads'],
  standings: ['columnHeads', 'iRatingDeltaAll', 'showPosition', 'gapMode'],
  traffic: ['captions'],
  // The shift lights' row, the trace's and the wheel's options in their rows, the pedals'
  // colours (R12): Pedales has no «Contenido».
  inputs: [
    'shiftLights',
    'traceSeconds',
    'traceWidth',
    'clutchInTrace',
    'colors',
    'steeringStyle',
    'wheelSize',
    'wheelColor',
    'steeringDegrees'
  ],
  fuel: ['showBox'],
  lights: [
    'showCaptions',
    'labelSide',
    'showTemps',
    'showRepairTime',
    'repairCrewTag',
    'repairRealTime',
    'showTrend'
  ],
  // Its alerts are eye lists in «Personalizar» (R12), stored as their switches.
  alerts: ALERT_TOGGLES
}

function fieldsOf(section: OptionSection): readonly string[] {
  return Object.keys(OPTION_SCHEMA[section])
}

/** The part `field` of `id`'s options is in. */
export function optionPartOf(id: WidgetId, field: string): OptionPart {
  if ((DRIVER_BLOCK_SECTIONS as readonly string[]).includes(id)) {
    if ((DRIVER_BLOCK_FIELDS as readonly string[]).includes(field)) return 'driver'
  }
  const spec = (OPTION_SCHEMA[id] as Readonly<Record<string, { readonly kind: string }>>)[field]
  if (spec?.kind === 'elements') return 'customize'
  const bars = (INFO_BARS as Readonly<Record<string, readonly (readonly [string, string])[]>>)[id]
  if (bars !== undefined) {
    if (bars.some(([, size]) => size === field)) return 'customize'
    if ((BAR_EXTRAS as readonly string[]).includes(field)) return 'customize'
  }
  if (CUSTOMIZE_EXTRAS[id]?.includes(field) === true) return 'customize'
  return 'content'
}

/** The fields of `id`'s options in `part`, in the schema's order. */
export function optionPartFields(id: WidgetId, part: OptionPart): string[] {
  return fieldsOf(id).filter((f) => optionPartOf(id, f) === part)
}

/** Whether `id`'s page has `part` (only the four driver widgets have a «Piloto» block). */
export function hasOptionPart(id: WidgetId, part: OptionPart): boolean {
  return optionPartFields(id, part).length > 0
}

/** `part` of `id`'s options at its defaults (fresh copies), to patch the section with. */
export function optionPartDefaults<S extends WidgetId>(
  id: S,
  part: OptionPart
): Partial<OverlaySettings[S]> {
  const all = defaultOptions(id) as unknown as Readonly<Record<string, unknown>>
  const out: Record<string, unknown> = {}
  for (const f of optionPartFields(id, part)) out[f] = copyData(all[f])
  return out as Partial<OverlaySettings[S]>
}

/**
 * Apariencia's sections, each with its ↺ and its item in the page's "Restablecer…" (R24): the
 * global look (`appearance`) by section, «Accesibilidad» (the colour-blind palette and the other
 * needs, all in one place) and «Pantalla» (`visibility`). The language has none: it is not a look,
 * and a reset never changes it.
 */
export type AppearancePart = 'color' | 'text' | 'rows' | 'screen' | 'other' | 'access'

export const APPEARANCE_PARTS: readonly AppearancePart[] = [
  'color',
  'text',
  'rows',
  'screen',
  'other',
  'access'
]

export const APPEARANCE_PART_FIELDS: Readonly<
  Record<
    AppearancePart,
    { readonly section: 'appearance' | 'visibility'; readonly fields: readonly string[] }
  >
> = {
  color: { section: 'appearance', fields: ['accent', 'backgroundOpacity'] },
  text: { section: 'appearance', fields: ['fontScale', 'textHalo'] },
  rows: {
    section: 'appearance',
    fields: [
      'density',
      'stripes',
      'licenseStyle',
      'numberStyle',
      'nameFormat',
      'brandMarks',
      'countryFlags',
      'penaltyFlags',
      'brandLogos'
    ]
  },
  screen: { section: 'visibility', fields: fieldsOf('visibility') },
  other: { section: 'appearance', fields: ['units', 'showSimPill'] },
  access: {
    section: 'appearance',
    fields: ['colorBlind', 'largeLabels', 'noFlashing', 'settingsZoom']
  }
}

/** `part` of Apariencia at its defaults: { section, fields } to patch it with. */
export function appearancePartDefaults(part: AppearancePart): {
  readonly section: 'appearance' | 'visibility'
  readonly fields: Record<string, unknown>
} {
  const { section, fields } = APPEARANCE_PART_FIELDS[part]
  const all = defaultOptions(section) as unknown as Readonly<Record<string, unknown>>
  const out: Record<string, unknown> = {}
  for (const f of fields) out[f] = copyData(all[f])
  return { section, fields: out }
}
