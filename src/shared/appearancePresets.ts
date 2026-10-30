/**
 * Apariencia's named styles (R56, redone on the user's word): four looks you can tell apart at a
 * glance, and Apariencia's controls below stay the fine tuning.
 *
 * - OverLap: the defaults, all of them: the look and what every widget of the layout in use shows
 *   (every column, element, bar and option «Completo» turns on, back to its default value and
 *   order: defaultContentsPatch), so it also undoes «Completo» («todo de serie»).
 * - Limpio: no panel at all, the text read straight over the game behind its outline; no stripes,
 *   logos or flags, the licence a letter and the number plain text by its class's stripe.
 * - Compacto: small but legible: tight rows, text at 85 % (never under the minimum text, which
 *   Accesibilidad's «Texto mínimo de 10 px» raises), surnames, no logos or country flags.
 * - Completo: everything on (completeContents.ts) in the widgets of the layout in use, and a look
 *   that holds it: comfortable rows, a more solid panel, logos always.
 *
 * Limpio and Compacto are looks alone. None ever changes the accent (yours), Accesibilidad (a
 * need, not a look: the colour-blind palette, the 10 px text, no flashing, the window's size),
 * the SIM tag (a data-state cue), the language, the units, places or which widgets show; what a
 * widget draws its own way (its rows' density, its names) keeps it, though OverLap puts each
 * widget's own logos and flags back to «Global». Choosing one that would change what you set
 * yourself asks first (planStyle). Nothing is stored about which one you
 * chose: the page shows the one your settings match, so a file from before (with the old «Como
 * iRacing» look, now gone) reads as «Personalizado», drawn as it was. Pure.
 */
import {
  completePatch,
  defaultContentsPatch,
  isComplete,
  isDefaultContents
} from './completeContents'
import { deepEqual } from './equal'
import { LAYOUT_SECTIONS, OPTION_SCHEMA, type LayoutSection } from './settingsSchema'
import type { AppearanceSettings, OverlaySettings, SettingsPatch } from './types'
import type { WidgetId } from './widgets'

/** In the page's order: OverLap's own look (the defaults) first. */
export const APPEARANCE_PRESETS = ['overlap', 'clean', 'compact', 'complete'] as const

export type AppearancePreset = (typeof APPEARANCE_PRESETS)[number]

/** What a style sets of the look. */
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
  // No panel: no glass, edges, header plates or stripes (they all scale with the background), the
  // text kept legible over the game by its outline, always on. Text first: no logos or flags.
  clean: {
    ...OVERLAP,
    backgroundOpacity: 0,
    textHalo: 'on',
    stripes: false,
    licenseStyle: 'letter',
    numberStyle: 'stripe',
    brandMarks: 'off',
    brandLogos: 'mono',
    countryFlags: false,
    penaltyFlags: false
  },
  // Smaller, still legible: the minimum text and the outline (auto under a see-through panel)
  // hold; the penalty flags stay (a black flag is not a decoration).
  compact: {
    ...OVERLAP,
    fontScale: 85,
    density: 'compact',
    licenseStyle: 'letter',
    numberStyle: 'stripe',
    nameFormat: 'surname',
    brandMarks: 'off',
    countryFlags: false
  },
  // Everything shown, comfortable rows, a more solid panel to read it over a bright sky.
  complete: {
    ...OVERLAP,
    backgroundOpacity: 0.9,
    brandMarks: 'on'
  }
}

/** A style's look, a copy. */
export function presetValues(id: AppearancePreset): PresetValues {
  return { ...VALUES[id] }
}

/** The look as it is now, the style fields only. */
export function presetFieldsOf(a: Readonly<AppearanceSettings>): PresetValues {
  const out = {} as Record<PresetField, unknown>
  for (const f of PRESET_FIELDS) out[f] = a[f]
  return out as PresetValues
}

/** Whether a style also sets the widgets' contents (of the layout in use). */
export function setsContents(id: AppearancePreset): boolean {
  return id === 'complete' || id === 'overlap'
}

/**
 * Whether going from style `from` (the one the settings match, or null) to `to` leaves
 * «Completo» for a look alone (Limpio, Compacto): what Completo added then stays, and the dialog
 * offers to take it away. Never for «OverLap», which puts every content back as it comes.
 */
export function leavesComplete(from: AppearancePreset | null, to: AppearancePreset): boolean {
  return from === 'complete' && !setsContents(to)
}

/** The widgets' contents a style sets, as a patch of what it changes in `s` ({} for a look). */
function contentsPatch(s: Readonly<OverlaySettings>, id: AppearancePreset): SettingsPatch {
  if (id === 'complete') return completePatch(s)
  if (id === 'overlap') return defaultContentsPatch(s)
  return {}
}

/** Whether the widgets show what style `id` sets (always, for a look alone). */
function contentsMatch(s: Readonly<OverlaySettings>, id: AppearancePreset): boolean {
  if (id === 'complete') return isComplete(s)
  if (id === 'overlap') return isDefaultContents(s)
  return true
}

/**
 * The style the settings are now, or null when tuned by hand («Personalizado»): its look, and
 * for OverLap and Completo what the widgets show too (OverLap: everything at its default).
 */
export function matchingPreset(s: Readonly<OverlaySettings>): AppearancePreset | null {
  const a = s.appearance
  const id = APPEARANCE_PRESETS.find((p) => PRESET_FIELDS.every((f) => VALUES[p][f] === a[f]))
  if (id === undefined) return null
  return contentsMatch(s, id) ? id : null
}

/** What choosing a style changes, said in the confirmation (worded by the settings window). */
export type StyleChange =
  | {
      readonly kind: 'look'
      readonly field: PresetField
      readonly from: PresetValues[PresetField]
      readonly to: PresetValues[PresetField]
    }
  | {
      readonly kind: 'widget'
      readonly widget: WidgetId
      /**
       * columns: the tables' columns shown; elements: the other lists' items shown; bars: info
       * bars turned on; barItems: data added to the bars; options: switches and choices turned on
       * (the auto height too). Back to the defaults (OverLap): columnsHidden, elementsHidden,
       * barsOff and barItemsHidden what goes away, order the lists put back in their own order,
       * optionsDefault the switches and choices back to their values.
       */
      readonly what: StyleWidgetChange
      readonly count: number
    }

export const STYLE_WIDGET_CHANGES = [
  'columns',
  'columnsHidden',
  'elements',
  'elementsHidden',
  'bars',
  'barsOff',
  'barItems',
  'barItemsHidden',
  'order',
  'options',
  'optionsDefault'
] as const

export type StyleWidgetChange = (typeof STYLE_WIDGET_CHANGES)[number]

/** What choosing `id` would do: its patch, what changes, and whether to ask first. */
export interface StylePlan {
  readonly patch: SettingsPatch
  readonly changes: readonly StyleChange[]
  /**
   * Ask before applying: it changes something you set yourself (the look tuned by hand, or the
   * widgets' contents, which are always yours). From one style to another of the look alone it
   * applies at once (with "Deshacer"); with nothing to change, there is nothing to do.
   */
  readonly confirm: boolean
  /** It changes the widgets' contents (saved in the layout, not the global look: styleWhere). */
  readonly contents: boolean
}

type Entry = { readonly id: string; readonly visible: boolean }

/** How many entries a list shows that `other` does not. */
function shownBeyond(list: readonly Entry[], other: readonly Entry[]): number {
  const was = new Set(other.filter((e) => e.visible).map((e) => e.id))
  return list.filter((e) => e.visible && !was.has(e.id)).length
}

/** A list's change: entries shown, hidden, and whether its order changed. */
function listChange(
  before: unknown,
  after: unknown
): { more: number; less: number; order: boolean } {
  if (!Array.isArray(before) || !Array.isArray(after)) return { more: 0, less: 0, order: false }
  const b = before as Entry[]
  const a = after as Entry[]
  const order = b.length !== a.length || b.some((e, i) => e.id !== a[i]?.id)
  return { more: shownBeyond(a, b), less: shownBeyond(b, a), order }
}

/** The widget changes of one section's patch, counted. */
function sectionChanges(
  section: LayoutSection,
  before: Readonly<Record<string, unknown>>,
  fields: Readonly<Record<string, unknown>>,
  autoHeight: boolean,
  reset: boolean
): StyleChange[] {
  const n = Object.fromEntries(STYLE_WIDGET_CHANGES.map((w) => [w, 0])) as Record<
    StyleWidgetChange,
    number
  >
  const option: StyleWidgetChange = reset ? 'optionsDefault' : 'options'
  if (autoHeight) n[option]++
  for (const [field, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      const { more, less, order } = listChange(before[field], value)
      const [shown, hidden]: readonly [StyleWidgetChange, StyleWidgetChange] =
        field === 'columns'
          ? ['columns', 'columnsHidden']
          : `${field}Size` in before
            ? ['barItems', 'barItemsHidden']
            : ['elements', 'elementsHidden']
      n[shown] += more
      n[hidden] += less
      if (order) n.order++
    } else if (field.endsWith('BarSize') && (before[field] === 'off') !== (value === 'off')) {
      n[value === 'off' ? 'barsOff' : 'bars']++
    } else n[option]++
  }
  return STYLE_WIDGET_CHANGES.filter((what) => n[what] > 0).map((what) => ({
    kind: 'widget' as const,
    widget: section,
    what,
    count: n[what]
  }))
}

/** What choosing style `id` does to settings `s`. */
export function planStyle(s: Readonly<OverlaySettings>, id: AppearancePreset): StylePlan {
  const look = VALUES[id]
  const changes: StyleChange[] = []
  const appearance: Record<string, unknown> = {}
  for (const field of PRESET_FIELDS) {
    if (s.appearance[field] === look[field]) continue
    appearance[field] = look[field]
    changes.push({ kind: 'look', field, from: s.appearance[field], to: look[field] })
  }
  const patch: Record<string, unknown> = {}
  if (Object.keys(appearance).length > 0) patch.appearance = appearance
  let contents = false
  if (setsContents(id)) {
    const more = contentsPatch(s, id) as Record<string, unknown>
    const widgets = (more.widgets ?? {}) as Record<string, unknown>
    for (const section of LAYOUT_SECTIONS) {
      const fields = (more[section] ?? {}) as Readonly<Record<string, unknown>>
      const before = s[section] as unknown as Readonly<Record<string, unknown>>
      const found = sectionChanges(section, before, fields, section in widgets, id === 'overlap')
      changes.push(...found)
      if (found.length > 0) contents = true
    }
    Object.assign(patch, more)
  }
  const confirm = contents || (changes.length > 0 && matchingPreset(s) === null)
  return { patch: patch as SettingsPatch, changes, confirm, contents }
}

/** The patch that puts back what `patch` changes in `s` (the "Deshacer" after a style). */
export function undoPatch(s: Readonly<OverlaySettings>, patch: SettingsPatch): SettingsPatch {
  const out: Record<string, unknown> = {}
  const now = s as unknown as Readonly<Record<string, Readonly<Record<string, unknown>>>>
  for (const [key, fields] of Object.entries(patch as Record<string, unknown>)) {
    const section = now[key]
    if (section === undefined || typeof fields !== 'object' || fields === null) continue
    const back: Record<string, unknown> = {}
    for (const [field, value] of Object.entries(fields as Record<string, unknown>)) {
      if (key === 'widgets') {
        const w = (section[field] ?? {}) as Readonly<Record<string, unknown>>
        const was: Record<string, unknown> = {}
        for (const k of Object.keys(value as Record<string, unknown>)) was[k] = w[k]
        back[field] = was
      } else if (!deepEqual(section[field], value)) back[field] = section[field]
    }
    if (Object.keys(back).length > 0) out[key] = back
  }
  return out as SettingsPatch
}

/**
 * The contents part of a "Deshacer" patch of «Completo» (undoPatch): what each widget showed
 * before it, without the look. Kept to offer it back when another style is chosen. Pure.
 */
export function contentsBack(back: SettingsPatch): SettingsPatch {
  const out: Record<string, unknown> = {}
  for (const [key, fields] of Object.entries(back as Record<string, unknown>)) {
    if (key !== 'appearance') out[key] = fields
  }
  return out as SettingsPatch
}

/** `a` then `b`, section by section (and widget by widget): `b`'s fields win. Pure. */
export function mergePatches(a: SettingsPatch, b: SettingsPatch): SettingsPatch {
  const out: Record<string, Record<string, unknown>> = {}
  for (const p of [a, b] as Record<string, unknown>[]) {
    for (const [key, fields] of Object.entries(p)) {
      if (typeof fields !== 'object' || fields === null) continue
      const into = (out[key] ??= {})
      for (const [field, value] of Object.entries(fields as Record<string, unknown>)) {
        const was = into[field]
        into[field] =
          key === 'widgets' && typeof was === 'object' && was !== null
            ? { ...(was as object), ...(value as object) }
            : value
      }
    }
  }
  return out as SettingsPatch
}
