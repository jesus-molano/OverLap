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

  it('gives each row a polite live region and cancels when the recording button loses the focus', () => {
    const t = templateOf(ROW)
    expect(t).toMatch(/<p :id="msgId" class="sc-msg" aria-live="polite">/)
    // Two ways to record (over a chip, or one more), each cancelling on blur and on a second click.
    expect(t.match(/@blur="onRecorderBlur"/g)).toHaveLength(2)
    expect(t).toMatch(/@click="capture\.toggle\(row\.action, b\.slot\)"/)
    expect(t).toMatch(/@click="capture\.toggle\(row\.action, row\.bindings\.length\)"/)
    expect(t.match(/capture\.toggle/g)).toHaveLength(2)
  })

  it('shows the bindings as chips, each with its own ×, and "add" only while there is room', () => {
    const t = templateOf(ROW)
    expect(t).toMatch(/<li\s+v-for="b in row\.bindings"[\s\S]*?class="sc-chip"/)
    expect(t).toMatch(/class="sc-chip-x"[\s\S]*?@click="capture\.remove\(row\.action, b\.slot\)"/)
    expect(t).toMatch(/v-if="row\.canAdd"/)
    // The "in use" badge sits by the name, not in a chip, so the chips stay one size.
    const chips = /<ul class="sc-chips"[\s\S]*?<\/ul>/.exec(t)?.[0] ?? ''
    expect(chips).toContain('<Keycaps')
    expect(chips).not.toMatch(/sc-badge/)
    expect(t).toMatch(/<span class="sc-title">[\s\S]*class="sc-badge-unavailable"[\s\S]*?<\/span>/)
    // No coloured rail on a chip: a warning outline at most.
    expect(ROW).not.toMatch(/border-left:/)
  })

  it('lists the configured keys in the sidebar instead of fixed ones', () => {
    expect(templateOf(SIDEBAR)).not.toMatch(/<kbd>[^{<]/)
    expect(SIDEBAR).toContain('sidebarKeys(t.value, shortcuts.value, deviceNames.value)')
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
