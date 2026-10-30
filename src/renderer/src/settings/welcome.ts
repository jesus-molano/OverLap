/**
 * The welcome of a first run (R07): what it starts with and what it changes. Pure.
 */
import type { SettingsPatch } from '@shared/types'
import { WIDGET_IDS, type WidgetId } from '@shared/widgets'

/**
 * The widgets the welcome starts ticked: the core of an overlay (the cars around you, the
 * standings, your lap against a reference, the fuel, the race's alerts, your pedals). The others
 * are one tick away there, and in the sidebar and the tray afterwards.
 */
export const WELCOME_WIDGETS: readonly WidgetId[] = Object.freeze([
  'relative',
  'standings',
  'delta',
  'fuel',
  'alerts',
  'inputs'
])

/** The welcome's three steps. */
export const WELCOME_STEPS = ['start', 'widgets', 'where'] as const

export type WelcomeStep = (typeof WELCOME_STEPS)[number]

/** Every widget on or off as ticked (one patch: one change, one save). */
export function welcomeWidgetsPatch(on: ReadonlySet<WidgetId>): SettingsPatch {
  const widgets: NonNullable<SettingsPatch['widgets']> = {}
  for (const id of WIDGET_IDS) widgets[id] = { visible: on.has(id) }
  return { widgets }
}
