import { computed, type ComputedRef } from 'vue'
import { LOCALES, messagesFor, type Language, type Messages } from '@shared/i18n'
import { useAppearance } from './useAppearance'

let language: ComputedRef<Language> | null = null
let messages: ComputedRef<Messages> | null = null

/** settings.appearance.language (Spanish until the initial state arrives). */
export function useLanguage(): ComputedRef<Language> {
  if (!language) {
    const appearance = useAppearance()
    language = computed(() => appearance.value.language)
  }
  return language
}

/**
 * The interface texts in the current language, for the whole window: in a
 * template, `t.widgets.relative.empty`; in code, `t.value...`. Switching
 * language swaps the dictionary object, so everything that reads it updates
 * at once. Module-level, like the appearance: one per window, for its life.
 */
export function useI18n(): ComputedRef<Messages> {
  if (!messages) {
    const lang = useLanguage()
    messages = computed(() => messagesFor(lang.value))
  }
  return messages
}

/** BCP 47 locale of the current language, for Intl and locale-aware case changes. */
export function useLocale(): ComputedRef<string> {
  const lang = useLanguage()
  return computed(() => LOCALES[lang.value])
}
