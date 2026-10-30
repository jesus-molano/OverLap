/**
 * A narrow window (R49): the sidebar becomes a rail of icons that keeps each widget's eye,
 * instead of a select that lost them; the search, the status and edit mode go to a bar on top.
 */
import { describe, expect, it } from 'vitest'
import APP from './SettingsApp.vue?raw'
import SIDEBAR from './layout/SettingsSidebar.vue?raw'
import { RAIL_QUERY } from './nav'

describe('the narrow window\u2019s rail (R49)', () => {
  it('keeps the sidebar, as a rail, below the width the query names', () => {
    expect(APP).toContain('const rail = useMediaQuery(RAIL_QUERY)')
    expect(APP).toContain(':rail="rail"')
    expect(APP).not.toMatch(/<select/)
    expect(RAIL_QUERY).toBe('(max-width: 639px)')
    expect(APP).toMatch(
      /@media \(max-width: 639px\)[\s\S]*?grid-template-columns: var\(--st-rail-w\)/
    )
  })

  it('keeps each widget\u2019s eye and names every icon (a tooltip, and for screen readers)', () => {
    // The eye is not behind the rail flag.
    expect(SIDEBAR).toMatch(/<VisibilityDot\s/)
    expect(SIDEBAR).not.toMatch(/<VisibilityDot[^>]*v-if/)
    expect((SIDEBAR.match(/:title="rail \? item\.title : undefined"/g) ?? []).length).toBe(3)
    // The names are hidden visually, not removed.
    expect(SIDEBAR).toMatch(/\.is-rail \.nav-text,[\s\S]*?clip-path: inset\(50%\)/)
    expect(SIDEBAR).not.toMatch(/\.is-rail \.nav-text[^{]*\{\s*display: none/)
  })
})
