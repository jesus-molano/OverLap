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
    expect(t).toMatch(/<PageFrame class="sc-page" :labelledby="titleId">/)
    expect(t).toMatch(/<h1 :id="titleId"/)
    expect(t).toContain('<template #foot>')
    expect(templateOf(APP)).toMatch(/<ShortcutsPage v-else-if="page === 'shortcuts'">/)
  })

  it('records in the scope of the page, so leaving it releases the capture', () => {
    expect(PAGE).toContain('useShortcutCapture(windowCaptureDeps())')
  })

  it('gives each row a polite live region and cancels when the recording cell loses the focus', () => {
    const t = templateOf(ROW)
    expect(t).toMatch(/<span :id="liveId" class="st-sr-only" aria-live="polite">/)
    // One button per cell, the same element whether it holds a binding, the recording or
    // "+ Asignar" (the focus stays on it), cancelling on blur and on a second click.
    expect(t.match(/class="sc-cell-main"/g)).toHaveLength(1)
    expect(t.match(/@blur="onRecorderBlur"/g)).toHaveLength(1)
    expect(t).toMatch(/@click="record\(cell\.slot\)"/)
    expect(ROW).toMatch(/function record[\s\S]*?props\.capture\.toggle\(props\.row\.action, slot\)/)
  })

  it('is a table: a column per binding, Reset in a column kept for it, Esc a row like the others', () => {
    const t = templateOf(ROW)
    expect(t).toMatch(/v-for="cell in cells"\s+:key="cell\.slot"/)
    expect(ROW).toContain('rowCells(props.row, recording.value)')
    // The ×, and Delete / Backspace on the cell, empty it.
    expect(t).toMatch(/class="sc-x"[\s\S]*?@click="capture\.remove\(row\.action, cell\.slot\)"/)
    expect(ROW).toMatch(/e.key !== 'Delete' && e.key !== 'Backspace'/)
    // Reset: an icon in its own cell, there even when it has nothing to reset.
    expect(t).toMatch(/<div class="sc-reset-cell" role="cell">\s*<button\s+v-if="row\.canReset"/)
    expect(t).toMatch(/sc-reset"\s+:disabled="recording !== null"/)
    // A line about a cell starts under it.
    expect(t).toContain(':class="[`at-${line.slot ?? 0}`')
    // No badge by the name: the cell says what is wrong.
    expect(t).not.toMatch(/sc-badge/)
    const page = templateOf(PAGE)
    expect(page).toMatch(/<div class="sc-table" role="table"/)
    expect(page).toMatch(/v-for="n in MAX_BINDINGS"/)
    expect(page).toMatch(/<div class="sc-item sc-fixed" role="row">/)
    expect(page).toMatch(/<details class="sc-notes">/)
    // No second column of notes beside the table.
    expect(page).not.toContain('st-cols')
    // No coloured rail on a cell: a warning outline at most.
    expect(ROW + PAGE).not.toMatch(/border-left:/)
  })

  it('folds the widgets’ shortcuts under «Más acciones», a row of the same table (R52)', () => {
    const page = templateOf(PAGE)
    // The main rows first, then the fold's row and the widgets' rows, inside the table.
    expect(page).toMatch(/v-for="row in mainRows"/)
    expect(page).toMatch(
      /<div class="sc-more" role="row">[\s\S]*?:aria-expanded="moreOpen"[\s\S]*?<div v-show="moreOpen"[^>]*role="rowgroup">\s*<ShortcutRow\s+v-for="row in widgetRows"/
    )
    // It opens by itself while one of them records, or when one is assigned.
    expect(PAGE).toMatch(/widgetOfAction\(active\.action\) !== null\) return true/)
    expect(PAGE).toMatch(/moreToggled\.value \?\? assignedMore\.value > 0/)
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
