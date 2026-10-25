/**
 * Typed, stable reads of the settings. Settings are replaced whole on every change (bounds
 * included, 60 times a second while dragging), so each read keeps its previous object while
 * its value is equal: a drag re-renders nothing that only reads options.
 */
import { computed, type ComputedRef } from 'vue'
import { deepEqual } from '@shared/equal'
import { DEFAULT_SETTINGS } from '@shared/settings'
import type { OptionSection } from '@shared/settingsSchema'
import type { NameFormat, OverlaySettings, WidgetSettings } from '@shared/types'
import { WIDGET_DEFS, type WidgetId } from '@shared/widgets'
import { inherit, type Density } from '../view/appearance'
import { useAppearance } from './useAppearance'
import { useOverlayState } from './useOverlay'
import { injectSampleHost, injectWidgetId } from './widgetContext'

export type { OptionSection }

/** A widget's settings without its bounds (which change on every drag). */
export type WidgetPrefs = Readonly<Omit<WidgetSettings, 'bounds'>>

/** Sections with their own name format / density option ('inherit' = the global one). */
export type NameFormatSection = {
  [K in OptionSection]: OverlaySettings[K] extends { nameFormat: unknown } ? K : never
}[OptionSection]
export type DensitySection = {
  [K in OptionSection]: OverlaySettings[K] extends { density: unknown } ? K : never
}[OptionSection]

/** `next`, or `prev` when it holds the same data. */
function stable<T>(prev: T | undefined, next: T): T {
  return prev !== undefined && deepEqual(prev, next) ? prev : next
}

/** Every field but `bounds`. */
export function widgetPrefs(w: WidgetSettings): WidgetPrefs {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(w)) if (k !== 'bounds') out[k] = v
  return out as unknown as WidgetPrefs
}

/** This widget's settings (no bounds); defaults until the initial state arrives. */
export function useWidgetSettings(id: WidgetId = injectWidgetId()): ComputedRef<WidgetPrefs> {
  const { settings } = useOverlayState()
  return computed((prev) =>
    stable(prev, widgetPrefs(settings.value?.widgets[id] ?? DEFAULT_SETTINGS.widgets[id]))
  )
}

/** True when the widget's height follows its content (auto-height model and option on). */
export function useAutoHeight(id: WidgetId = injectWidgetId()): ComputedRef<boolean> {
  const prefs = useWidgetSettings(id)
  return computed(() => WIDGET_DEFS[id].sizeModel === 'auto-height' && prefs.value.autoHeight)
}

/** One option section, e.g. `useOptions('standings')`. */
export function useOptions<K extends OptionSection>(section: K): ComputedRef<OverlaySettings[K]> {
  const { settings } = useOverlayState()
  return computed((prev) => stable(prev, settings.value?.[section] ?? DEFAULT_SETTINGS[section]))
}

/** One option, e.g. `useOption('battle', 'thresholdS')`. */
export function useOption<K extends OptionSection, F extends keyof OverlaySettings[K]>(
  section: K,
  field: F
): ComputedRef<OverlaySettings[K][F]> {
  const options = useOptions(section)
  return computed((prev) => stable(prev, options.value[field]))
}

/** A sample of the Apariencia page shows the global values, whatever the widget's own. */
function ownOptionsApply(): boolean {
  return injectSampleHost()?.globalAppearance !== true
}

/** The name format a widget uses: its own option, or the global one. */
export function useNameFormat(section?: NameFormatSection): ComputedRef<NameFormat> {
  const appearance = useAppearance()
  const own = section !== undefined && ownOptionsApply() ? useOption(section, 'nameFormat') : null
  return computed(() => inherit(own?.value, appearance.value.nameFormat))
}

/** The density a widget uses: its own option, or the global one. */
export function useDensity(section?: DensitySection): ComputedRef<Density> {
  const appearance = useAppearance()
  const own = section !== undefined && ownOptionsApply() ? useOption(section, 'density') : null
  return computed(() => inherit(own?.value, appearance.value.density))
}
