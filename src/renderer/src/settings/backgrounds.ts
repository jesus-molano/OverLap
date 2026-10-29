/**
 * A widget's background against the global one (Apariencia › «Fondo de los widgets», R16): what
 * the page's «Global / Propio» choice stores, and the widgets that keep their own number (every
 * widget of a file saved before 2.3: its look stays until it is set to «Global»). Pure.
 */
import type { SettingsPatch, WidgetSettings } from '@shared/types'
import { WIDGET_IDS, type WidgetId } from '@shared/widgets'

/** «Global» follows Apariencia; «Propio» is the widget's own number. */
export type BgChoice = 'inherit' | 'own'

/** The page's choice for a stored value. */
export function bgChoiceOf(stored: WidgetSettings['backgroundOpacity']): BgChoice {
  return stored === 'inherit' ? 'inherit' : 'own'
}

/**
 * What a choice stores: 'inherit', or for «Propio» the opacity it showed until then (the global
 * one), so the widget looks the same until its slider moves.
 */
export function storedBackground(
  choice: BgChoice,
  globalAlpha: number
): WidgetSettings['backgroundOpacity'] {
  return choice === 'inherit' ? 'inherit' : globalAlpha
}

/** The widgets with their own background, in the sidebar's order. */
export function ownBackgrounds(
  widgets: Readonly<Record<WidgetId, Pick<WidgetSettings, 'backgroundOpacity'>>>
): WidgetId[] {
  return WIDGET_IDS.filter((id) => widgets[id].backgroundOpacity !== 'inherit')
}

/** One patch that sets `ids` back to «Global». */
export function followGlobalPatch(ids: readonly WidgetId[]): SettingsPatch {
  const widgets: NonNullable<SettingsPatch['widgets']> = {}
  for (const id of ids) widgets[id] = { backgroundOpacity: 'inherit' }
  return { widgets }
}
