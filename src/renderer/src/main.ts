import './styles/theme.css'

import { createApp, watch, type ComputedRef } from 'vue'
import { DEFAULT_LANGUAGE, messagesFor, type Language, type Messages } from '@shared/i18n'
import { startAppearance } from './composables/useAppearance'
import { useLanguage } from './composables/useI18n'
import OverlayApp from './overlay/OverlayApp.vue'
import { startPerfProbe } from './overlay/perfProbe'

// Every window loads this entry; main picks the page with `?view=overlay` (one window per
// display, every widget of it), `?view=settings` or `?view=osd` (the shortcut confirmation).
const params = new URLSearchParams(location.search)
const view = params.get('view')

/**
 * The document title follows settings.appearance.language for the window's whole life
 * (Spanish until the initial state arrives). <html lang> is startAppearance's
 * (view/appearance.ts), with the rest of the root attributes.
 */
function followLanguage(title: (m: Messages) => string): ComputedRef<Language> {
  const lang = useLanguage()
  watch(lang, (l) => (document.title = title(messagesFor(l))), { immediate: true })
  return lang
}

/** In the window's language when it is known (it follows it), in Spanish otherwise. */
function showBootError(
  text: (m: Messages) => string,
  lang: ComputedRef<Language> | null = null
): void {
  const error = document.createElement('div')
  error.className = 'ov-boot-error'
  document.getElementById('app')?.append(error)
  if (!lang) {
    error.textContent = text(messagesFor(DEFAULT_LANGUAGE))
    return
  }
  watch(lang, (l) => (error.textContent = text(messagesFor(l))), { immediate: true })
}

if (view === 'overlay') {
  // Once per window; re-applied only when a value of settings.appearance changes. Main owns
  // the window title ('Pantalla 1 · OverLap', what OBS window capture lists).
  startAppearance(document.documentElement)
  const app = createApp(OverlayApp)
  // Last resort: a widget's own errors stop at its slot (WidgetSlot), never here.
  app.config.errorHandler = (err, _instance, info) => console.error('[overlay]', info, err)
  app.mount('#app')
  if (params.get('perf') === '1') startPerfProbe()
} else if (view === 'settings') {
  // Set before the chunk loads: its stylesheet only applies under .ov-settings.
  document.documentElement.classList.add('ov-settings')
  // Accent, palette and density on <html>, so the sample rows in Ajustes look like the widgets.
  startAppearance(document.documentElement)
  const lang = followLanguage((m) => m.core.windowTitles.settingsPage)
  // Own chunk, so overlay windows never load the settings UI or its styles.
  void import('./settings/SettingsApp.vue').then(
    ({ default: SettingsApp }) => createApp(SettingsApp).mount('#app'),
    (err: unknown) => {
      console.error('[renderer] could not load the settings view', err)
      showBootError((m) => m.core.boot.settingsFailed, lang)
    }
  )
} else if (view === 'osd') {
  // The confirmation over the game when a shortcut runs (main/osdWindow.ts): no Vue, no state.
  document.documentElement.classList.add('ov-osd')
  void import('./osd/osd').then(({ startOsd }) => {
    const root = document.getElementById('app')
    if (root) startOsd(root)
  })
} else if (view !== null) {
  showBootError((m) => m.core.boot.unknownView(view))
} else {
  showBootError((m) => m.core.boot.missingParam)
}
