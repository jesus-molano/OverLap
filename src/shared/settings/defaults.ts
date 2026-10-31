/** Default settings, built from WIDGET_DEFS and OPTION_SCHEMA. */
import {
  OPTION_SCHEMA,
  WIDGET_FIELD_SCHEMA,
  type OptionSection,
  type OptionSpec
} from '../settingsSchema'
import { emptyMoreShortcuts } from '../shortcuts'
import type { OverlaySettings, WidgetSettings } from '../types'
import { WIDGET_DEFS, WIDGET_IDS, shownOnSessionScreen, type WidgetId } from '../widgets'
import { defaultLayoutLibrary, type LiveSettings } from './layouts'

/**
 * 6: the layouts carry their options (SavedLayout.mode, options; LayoutLibrary.shared). An older
 * version reads such a file without them, so a file from before 6 is backed up once before this
 * one rewrites it (SettingsStore, `settings.json.v5.bak`): going back to that version keeps it.
 */
export const SETTINGS_VERSION = 6

export const OPTION_SECTIONS = Object.keys(OPTION_SCHEMA) as OptionSection[]

/** The specs of a section, as a plain record for the generic merge loops. */
export function sectionSpecs(section: OptionSection): Readonly<Record<string, OptionSpec>> {
  return OPTION_SCHEMA[section]
}

/** A fresh copy of a spec's default (element lists and colour sets are objects). */
export function specDefault(spec: OptionSpec): unknown {
  if (spec.kind === 'elements') return spec.default.map((e) => ({ ...e }))
  if (spec.kind === 'colors') return { ...spec.default }
  return spec.default
}

export function defaultOptions<S extends OptionSection>(section: S): OverlaySettings[S] {
  const out: Record<string, unknown> = {}
  for (const [field, spec] of Object.entries(sectionSpecs(section))) out[field] = specDefault(spec)
  // Built from the section's own specs (OptionSchema ties each spec to its field type).
  return out as unknown as OverlaySettings[S]
}

export function defaultWidgetSettings(id: WidgetId): WidgetSettings {
  const def = WIDGET_DEFS[id]
  return {
    visible: def.defaultVisible,
    bounds: { ...def.defaultBounds },
    locked: false,
    backgroundOpacity: 'inherit',
    scale: WIDGET_FIELD_SCHEMA.scale.default,
    autoHeight: def.sizeModel === 'auto-height',
    anchor: WIDGET_FIELD_SCHEMA.anchor.default,
    showIn: { ...def.defaultShowIn },
    hideInPits: WIDGET_FIELD_SCHEMA.hideInPits.default,
    showOnSessionScreen: shownOnSessionScreen(id)
  }
}

export function createDefaultSettings(): OverlaySettings {
  const widgets = {} as Record<WidgetId, WidgetSettings>
  for (const id of WIDGET_IDS) widgets[id] = defaultWidgetSettings(id)
  const appearance = defaultOptions('appearance')
  const live: LiveSettings = {
    version: SETTINGS_VERSION,
    appearance,
    visibility: defaultOptions('visibility'),
    widgets,
    relative: defaultOptions('relative'),
    radar: defaultOptions('radar'),
    standings: defaultOptions('standings'),
    battle: defaultOptions('battle'),
    inputs: defaultOptions('inputs'),
    traffic: defaultOptions('traffic'),
    alerts: defaultOptions('alerts'),
    delta: defaultOptions('delta'),
    fuel: defaultOptions('fuel'),
    lights: defaultOptions('lights'),
    spotter: defaultOptions('spotter'),
    shortcuts: defaultOptions('shortcuts'),
    settingsWindow: defaultOptions('settingsWindow'),
    layouts: defaultOptions('layouts'),
    shortcutsMore: emptyMoreShortcuts(),
    buttonDeviceNames: {}
  }
  return { ...live, savedLayouts: defaultLayoutLibrary(live, appearance.language) }
}

/** Frozen: use `createDefaultSettings()` for a mutable copy. */
export const DEFAULT_SETTINGS: OverlaySettings = deepFreeze(createDefaultSettings())

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const v of Object.values(value)) deepFreeze(v)
    Object.freeze(value)
  }
  return value
}
