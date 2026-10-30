/** Words of Apariencia that depend on which widgets an option reaches. Pure. */
import type { Messages } from '@shared/i18n'
import { WIDGET_DEFS, WIDGET_IDS, type WidgetId } from '@shared/widgets'
import { widgetList } from './replayWidgets'

/**
 * How the global text size reaches each widget: the auto-height ones' font is 13 px x their
 * scale x the text size (useWidgetSurface); the free-size ones fill their window with their
 * text, so their window grows by it (scaleFreeWindows in settings/patch.ts).
 */
export function fontScaleWidgets(): { scaled: WidgetId[]; free: WidgetId[] } {
  const scaled = WIDGET_IDS.filter((id) => WIDGET_DEFS[id].sizeModel === 'auto-height')
  const free = WIDGET_IDS.filter((id) => WIDGET_DEFS[id].sizeModel !== 'auto-height')
  return { scaled, free }
}

/**
 * The help of "Tamaño del texto": it changes every widget (the line), and how it does it in the
 * free-size ones (behind its ⓘ).
 */
export function fontScaleHelp(m: Messages, locale: string): { help: string; more: string } {
  const { free } = fontScaleWidgets()
  const text = m.settings.appearance.text
  return {
    help: text.fontScaleHelp,
    more: text.fontScaleMore(widgetList(m, locale, free))
  }
}
