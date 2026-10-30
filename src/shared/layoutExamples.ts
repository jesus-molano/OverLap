/**
 * The example layouts (R57): «Ligera» and «Completa», added from Disposiciones next to the ones
 * you have, never applied by themselves, so «Siguiente disposición» switches between a light and a
 * full overlay with nothing new to learn. Both start from the widgets as they are now (their
 * places, scale and options), and change only which widgets show and, in the light one, how many
 * cars the relative lists. Pure.
 */
import { addLayout } from './layouts'
import { optionSetOf, snapshotWidgets, syncActiveLayout } from './settings/layouts'
import type { OverlaySettings } from './types'
import { WIDGET_IDS, type WidgetId } from './widgets'

export const LAYOUT_EXAMPLES = ['light', 'full'] as const

export type LayoutExample = (typeof LAYOUT_EXAMPLES)[number]

export function isLayoutExample(v: unknown): v is LayoutExample {
  return (LAYOUT_EXAMPLES as readonly unknown[]).includes(v)
}

/**
 * The light one's widgets: the relative and the radar around you, your delta and fuel, and the
 * alerts; the others (standings, battle, traffic, pedals, lights) hidden.
 */
export const LIGHT_WIDGETS: readonly WidgetId[] = ['relative', 'radar', 'delta', 'fuel', 'alerts']

/** Cars ahead and behind in the light one's relative. */
export const LIGHT_RELATIVE_CARS = 2

/** Which widgets an example shows. */
export function exampleShows(kind: LayoutExample, id: WidgetId): boolean {
  return kind === 'full' || LIGHT_WIDGETS.includes(id)
}

/**
 * Adds example `kind` named `name` (made unique) at the end of the list, not applied: the widgets
 * now with the example's visibility, as a 'full' layout with the options in effect (the light
 * one's relative with two cars each side, never more than you have). Null: no name or no room.
 */
export function addExampleLayout(
  s: OverlaySettings,
  kind: LayoutExample,
  name: unknown
): string | null {
  syncActiveLayout(s)
  const widgets = snapshotWidgets(s.widgets)
  for (const id of WIDGET_IDS) widgets[id].visible = exampleShows(kind, id)
  // The options in effect (a 'position' layout in use runs on the shared ones: the same).
  const options = optionSetOf(s)
  if (kind === 'light') {
    const r = options.sections.relative
    r.carsAhead = Math.min(r.carsAhead, LIGHT_RELATIVE_CARS)
    r.carsBehind = Math.min(r.carsBehind, LIGHT_RELATIVE_CARS)
  }
  return addLayout(s, name, widgets, options)
}
