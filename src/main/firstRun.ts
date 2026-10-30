import { LANGUAGES, type Language } from '@shared/i18n'
import type { OverlaySettings } from '@shared/types'

/**
 * The interface language of a new install (R07): the first of the system's preferred languages
 * that OverLap speaks ('es-MX' → es, 'en-US' → en), so the notification and the welcome are
 * already in it; English when none is (a German or French Windows reads English better than
 * Spanish). `preferred` is app.getPreferredSystemLanguages(), most preferred first.
 */
export function systemLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split(/[-_]/)[0]
    const hit = LANGUAGES.find((l) => l === base)
    if (hit) return hit
  }
  return 'en'
}

/**
 * What a first run changes before any window or the tray exists: the system's language and the
 * welcome on. Only for a new install (`fresh`: there was no settings file); an existing file
 * keeps its language and never sees the welcome. Returns whether it changed anything.
 */
export function applyFirstRun(
  s: OverlaySettings,
  fresh: boolean,
  preferred: readonly string[]
): boolean {
  if (!fresh) return false
  s.appearance.language = systemLanguage(preferred)
  s.settingsWindow.welcome = true
  return true
}
