/**
 * Contract of the shortcuts page and of everything that shows a shortcut: the page follows the
 * other pages' frame, each row speaks politely and cancels a recording when its button loses
 * the focus, and no window hard-codes a combination (they all come from settings.shortcuts).
 */
import { describe, expect, it } from 'vitest'
import APP from './SettingsApp.vue?raw'
import ROW from './layout/ShortcutRow.vue?raw'
import SIDEBAR from './layout/SettingsSidebar.vue?raw'
import PAGE from './pages/ShortcutsPage.vue?raw'

const RENDERER = import.meta.glob(['../**/*.vue', '../**/*.ts', '!../**/*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

const DICTIONARIES = import.meta.glob('../../../shared/i18n/messages/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

const templateOf = (sfc: string): string => /<template>([\s\S]*)<\/template>/.exec(sfc)?.[1] ?? ''

describe('shortcuts page', () => {
  it('is framed like the other pages, named by its title', () => {
    const t = templateOf(PAGE)
    expect(t).toMatch(/<PageFrame :labelledby="titleId">/)
    expect(t).toMatch(/<h1 :id="titleId"/)
    expect(t).toContain('<template #foot>')
    expect(templateOf(APP)).toMatch(/<ShortcutsPage v-else-if="page === 'shortcuts'">/)
  })

  it('records in the scope of the page, so leaving it releases the capture', () => {
    expect(PAGE).toContain('useShortcutCapture(windowCaptureDeps())')
  })

  it('gives each row a polite live region and cancels when its button loses the focus', () => {
    const t = templateOf(ROW)
    expect(t).toMatch(/<p :id="msgId" class="sc-msg" aria-live="polite">/)
    expect(t).toMatch(/@blur="onChangeBlur"/)
    expect(t).toMatch(/@click="capture\.toggle\(row\.action\)"/)
    // One button for change and cancel: the focus stays on it while recording.
    expect(t.match(/capture\.toggle/g)).toHaveLength(1)
  })

  it('keeps the keys field one width in every row: the "in use" badge sits by the name', () => {
    const t = templateOf(ROW)
    const field = /<div class="sc-keys"[\s\S]*?<\/div>/.exec(t)?.[0] ?? ''
    expect(field).toContain('<Keycaps')
    expect(field).not.toMatch(/sc-badge/)
    expect(t).toMatch(/<span class="sc-title">[\s\S]*class="sc-badge-unavailable"[\s\S]*?<\/span>/)
    expect(ROW).toMatch(/\.sc-keys \{[^}]*min-width: 15em;/)
  })

  it('lists the configured keys in the sidebar instead of fixed ones', () => {
    expect(templateOf(SIDEBAR)).not.toMatch(/<kbd>[^{<]/)
    expect(SIDEBAR).toContain('sidebarKeys(t.value, shortcuts.value)')
  })
})

/** The code of a source, without its comments (examples there are fine). */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('no hard-coded combination', () => {
  it('in any renderer source or dictionary', () => {
    const sources = { ...RENDERER, ...DICTIONARIES }
    expect(Object.keys(RENDERER).length).toBeGreaterThan(50)
    expect(Object.keys(DICTIONARIES)).toHaveLength(3)
    const hits = Object.entries(sources)
      .filter(([, src]) => /Ctrl\+Shift\+[EH]\b|CommandOrControl/.test(code(src)))
      .map(([file]) => file)
    expect(hits).toEqual([])
  })
})
