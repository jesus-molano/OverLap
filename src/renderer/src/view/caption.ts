/** Header captions of the widgets. Pure. */
import { widgetTitle, type Messages } from '@shared/i18n'
import type { WidgetId } from '@shared/widgets'

/**
 * A widget's name as its caps header caption ('POSICIONES', 'STANDINGS'), upper-cased with
 * the language's own rules (`locale`: LOCALES[lang]).
 */
export function widgetCaption(m: Messages, id: WidgetId, locale: string): string {
  return widgetTitle(m, id).toLocaleUpperCase(locale)
}
