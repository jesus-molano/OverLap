/**
 * «Acerca de y ayuda» (R40): one page with the version, quick help, a backup of everything, the
 * folder, the log and the diagnostics, the welcome again and «Restablecer todo»; the folder button
 * leaves the sidebar's foot and the narrow footer (the tray keeps it).
 */
import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import APP from './SettingsApp.vue?raw'
import FOOTER from './layout/SettingsFooter.vue?raw'
import SIDEBAR from './layout/SettingsSidebar.vue?raw'
import ABOUT from './pages/AboutPage.vue?raw'
import SEARCH from './search/SettingsSearch.vue?raw'
import { pageTitle } from './nav'

describe('«Acerca de y ayuda» (R40)', () => {
  it('runs every command it offers through main', () => {
    for (const type of [
      'backup-export',
      'backup-import',
      'open-settings-folder',
      'open-log',
      'copy-diagnostics',
      'reset-all'
    ]) {
      expect(ABOUT, type).toContain(`sendCommand({ type: '${type}' })`)
    }
    expect(ABOUT).toContain("sendCommand({ type: 'open-help', page })")
    // The welcome again: the same setting a first run sets.
    expect(ABOUT).toContain('updateSettings({ settingsWindow: { welcome: true } })')
    // «Restablecer todo» asks twice, and offers «Deshacer» as main keeps it.
    expect(ABOUT).toMatch(
      /<ConfirmButton[\s\S]*?:action="\(\) => sendCommand\(\{ type: 'reset-all' \}\)"/
    )
    expect(ABOUT).toMatch(/offerRestore\([\s\S]*?type: 'undo-notice', id/)
  })

  it('sits at the foot of the sidebar, and the folder button leaves the foot and the footer', () => {
    expect(SIDEBAR).toMatch(/v-for="item in footItems"/)
    expect(SIDEBAR).not.toContain('open-settings-folder')
    expect(FOOTER).not.toContain('open-settings-folder')
    expect(APP).toContain(`<AboutPage v-else-if="page === 'about'">`)
  })

  it('is named in both languages', () => {
    expect(pageTitle(messagesFor('es'), 'about')).toBe('Acerca de y ayuda')
    expect(pageTitle(messagesFor('en'), 'about')).toBe('About and help')
  })
})

describe('«Ayuda rápida» (R40, R49)', () => {
  it('gives every question a button, and words that hold at any window width', () => {
    // Visibility and layouts go to their page; edit mode and the search are the controls.
    expect(ABOUT).toMatch(/<EditModeButton\s+v-else-if="h.key === 'edit'"/)
    expect(ABOUT).toMatch(/v-else-if="h.key === 'search'"[\s\S]*?@click="requestSearchFocus"/)
    expect(SEARCH).toContain('window.addEventListener(FOCUS_SEARCH_EVENT, focusField)')
    expect(SEARCH).toContain('window.removeEventListener(FOCUS_SEARCH_EVENT, focusField)')
    // The narrow window (R49) moves both to its top bar: no side named.
    for (const lang of ['es', 'en'] as const) {
      for (const item of Object.values(messagesFor(lang).settings.about.help.items)) {
        expect(item.a).not.toMatch(/izquierda|derecha|abajo|arriba|left|right|bottom|top/i)
      }
    }
  })
})
