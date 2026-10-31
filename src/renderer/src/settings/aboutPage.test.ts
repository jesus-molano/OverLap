/**
 * «Acerca de y ayuda» (R40): one page with the version, quick help, a backup of everything, the
 * folder, the log and the diagnostics, the welcome again and «Restablecer todo»; the folder button
 * leaves the sidebar's foot and the narrow footer (the tray keeps it).
 */
import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { COPYRIGHT } from '@shared/projectLinks'
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

describe('«Licencia» (GPL-3.0-or-later, 31-oct-2026)', () => {
  it('gives the legal notices of the GPL in both languages', () => {
    for (const lang of ['es', 'en'] as const) {
      const l = messagesFor(lang).settings.about.licence
      // GPLv3 §5(d): the copyright, the licence and that there is no warranty.
      expect(l.help, lang).not.toContain('©')
      expect(l.label, lang).toMatch(/GPL-3\.0/)
      expect(l.help, lang).toMatch(/GNU GPL, vers(ión|ion) 3/)
      expect(l.help, lang).toMatch(lang === 'es' ? /sin ninguna garantía/ : /no warranty/)
      // The colour logos are not under it; the free set is a setting away.
      expect(l.logosHelp, lang).toMatch(/GPL/)
      expect(l.logosHelp, lang).toMatch(/Simple Icons, CC0/)
    }
    expect(messagesFor('es').settings.about.licence.title).toBe('Licencia')
    expect(messagesFor('en').settings.about.licence.title).toBe('Licence')
  })

  it('opens the source, the licence and the notices through main, by name', () => {
    expect(ABOUT).toMatch(/<PageSection :title="t\.settings\.about\.licence\.title">/)
    for (const page of ['source', 'licence', 'notices']) {
      expect(ABOUT, page).toMatch(new RegExp(`@click="help\\('${page}'\\)"`))
    }
    expect(ABOUT).toContain('{{ t.settings.about.licence.label }}')
    // The copyright, in every language the same, before the licence's words.
    expect(COPYRIGHT).toBe('© 2026 Jesús Molano')
    expect(ABOUT).toContain('{{ COPYRIGHT }}. {{ t.settings.about.licence.help }}')
    expect(ABOUT).toContain('{{ t.settings.about.licence.logosHelp }}')
    // No address in the page: main has them (projectLinks.ts).
    expect(ABOUT).not.toMatch(/https?:\/\//)
  })

  it('shows «Apoyar OverLap» only once the donations page is filled in', () => {
    expect(ABOUT).toContain('const support = hasSupportLink()')
    expect(ABOUT).toMatch(/v-if="support"[\s\S]*?@click="help\('support'\)"/)
    expect(messagesFor('es').settings.about.app.support).toBe('Apoyar OverLap')
    expect(messagesFor('en').settings.about.app.support).toBe('Support OverLap')
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
