/** Words of Apariencia that depend on which widgets an option reaches. Pure. */
import type { Messages } from '@shared/i18n'
import { WIDGET_DEFS, WIDGET_IDS, type WidgetId } from '@shared/widgets'
import { widgetList } from './replayWidgets'

/**
 * The widgets the global text size changes: the auto-height ones (their font is 13 px x their
 * scale x the text size, useWidgetSurface); the free-size ones fit their text to their window.
 */
export function fontScaleWidgets(): { scaled: WidgetId[]; free: WidgetId[] } {
  const scaled = WIDGET_IDS.filter((id) => WIDGET_DEFS[id].sizeModel === 'auto-height')
  const free = WIDGET_IDS.filter((id) => WIDGET_DEFS[id].sizeModel !== 'auto-height')
  return { scaled, free }
}

/** The help of "Tamaño del texto": exactly which widgets it changes and which it does not. */
export function fontScaleHelp(m: Messages, locale: string): string {
  const { scaled, free } = fontScaleWidgets()
  return m.settings.appearance.text.fontScaleHelp(
    widgetList(m, locale, scaled),
    widgetList(m, locale, free)
  )
}
