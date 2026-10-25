/** Languages of the interface (settings.appearance.language). */
export const LANGUAGES = ['es', 'en'] as const

export type Language = (typeof LANGUAGES)[number]

export const DEFAULT_LANGUAGE: Language = 'es'

export function isLanguage(v: unknown): v is Language {
  return typeof v === 'string' && (LANGUAGES as readonly string[]).includes(v)
}

/** BCP 47 locale for Intl (dates) and locale-aware case changes. */
export const LOCALES: Readonly<Record<Language, string>> = { es: 'es-ES', en: 'en-GB' }

/** Each language's name in itself, for the selector. */
export const LANGUAGE_NAMES: Readonly<Record<Language, string>> = { es: 'Español', en: 'English' }
