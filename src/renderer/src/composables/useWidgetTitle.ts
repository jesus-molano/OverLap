import { computed, type ComputedRef } from 'vue'
import type { WidgetId } from '@shared/widgets'
import { widgetCaption } from '../view/caption'
import { useI18n, useLocale } from './useI18n'

/**
 * The widget's caps header caption in the current language ('POSICIONES'). Changes only when
 * the language does.
 */
export function useWidgetTitle(id: WidgetId): ComputedRef<string> {
  const t = useI18n()
  const locale = useLocale()
  return computed(() => widgetCaption(t.value, id, locale.value))
}
