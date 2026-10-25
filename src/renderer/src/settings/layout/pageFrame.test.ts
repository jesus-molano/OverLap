/**
 * Contract of the settings page frame: the window never scrolls, each page's options are the
 * only scroller, and every band reserves the scrollbar's gutter, so the live preview's width
 * (and so its scale and height) never depends on whether the options scroll, which fed back.
 * The scroller stays reachable from the keyboard.
 */
import { describe, expect, it } from 'vitest'
import SETTINGS_CSS from '../settings.css?raw'
import APP from '../SettingsApp.vue?raw'
import APPEARANCE_PAGE from '../pages/AppearancePage.vue?raw'
import WIDGET_PAGE from '../pages/WidgetPage.vue?raw'
import PAGE_FRAME from './PageFrame.vue?raw'
import SAMPLE_STAGE from './SampleStage.vue?raw'

/** Declarations of every rule with exactly this selector (media queries included), merged. */
function declarations(css: string, selector: string): Map<string, string> {
  const out = new Map<string, string>()
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if ((m[1] ?? '').replace(/\s+/g, ' ').trim() !== selector) continue
    for (const d of (m[2] ?? '').matchAll(/([-\w]+)\s*:\s*([^;]+)/g)) {
      out.set((d[1] ?? '').trim(), (d[2] ?? '').replace(/\s+/g, ' ').trim())
    }
  }
  return out
}

const templateOf = (sfc: string): string => /<template>([\s\S]*)<\/template>/.exec(sfc)?.[1] ?? ''

/** Opening tags of the elements carrying `cls` in a template. */
const tagsWith = (template: string, cls: string): string[] =>
  [...template.matchAll(/<[a-z][^>]*>/gis)]
    .map((m) => m[0])
    .filter((tag) => new RegExp(`class="[^"]*\\b${cls}\\b`).test(tag))

describe('settings page frame', () => {
  it('leaves the document unscrolled (theme.css keeps it at the window height)', () => {
    const root = declarations(SETTINGS_CSS, 'html.ov-settings')
    for (const prop of ['height', 'min-height', 'overflow', 'overflow-x', 'overflow-y']) {
      expect(root.has(prop), prop).toBe(false)
    }
    const body = declarations(SETTINGS_CSS, 'html.ov-settings body, html.ov-settings #app')
    expect([...body.keys()]).toEqual(['background'])
  })

  it('reserves the scrollbar gutter in every band, clipping instead of scrolling', () => {
    const band = declarations(SETTINGS_CSS, 'html.ov-settings .st-band')
    expect(band.get('scrollbar-gutter')).toBe('stable')
    expect(band.get('overflow')).toBe('hidden')
    expect(band.get('flex')).toBe('none')
  })

  it('scrolls only the options, which take what is left of the height', () => {
    const scroll = declarations(SETTINGS_CSS, 'html.ov-settings .st-scroll')
    expect(scroll.get('overflow-y')).toBe('auto')
    expect(scroll.get('min-height')).toBe('0')
    expect(scroll.get('flex')).toBe('1 1 auto')
    const scrollers = tagsWith(templateOf(PAGE_FRAME), 'st-scroll')
    expect(scrollers).toHaveLength(1)
    expect(scrollers[0]).toMatch(/class="st-band st-scroll"/)
  })

  it('keeps the options reachable with Tab and named by the page title', () => {
    const [scroller = ''] = tagsWith(templateOf(PAGE_FRAME), 'st-scroll')
    expect(scroller).toContain('tabindex="0"')
    expect(scroller).toContain('role="region"')
    expect(scroller).toContain(':aria-labelledby="labelledby"')
    for (const page of [WIDGET_PAGE, APPEARANCE_PAGE]) {
      const t = templateOf(page)
      expect(t).toMatch(/<PageFrame :labelledby="titleId">/)
      expect(t).toMatch(/<h1 :id="titleId"/)
      // The preview stays in the fixed part, above the options.
      expect(t.indexOf('<SampleStage')).toBeGreaterThan(t.indexOf('<template #top>'))
      expect(t.indexOf('<SampleStage')).toBeLessThan(t.indexOf('</template>'))
    }
  })

  it('puts the window chrome above the pages in a band of its own', () => {
    const t = templateOf(APP)
    expect(t.indexOf('class="st-band"')).toBeGreaterThan(-1)
    expect(t.indexOf('class="st-band"')).toBeLessThan(t.indexOf('class="topbar"'))
  })

  it('caps the preview stage at a share of the window height', () => {
    const css = /<style scoped>([\s\S]*?)<\/style>/.exec(SAMPLE_STAGE)?.[1] ?? ''
    const stage = declarations(css, '.stage')
    expect(stage.get('--stage-max')).toBe('max(160px, 40vh)')
    expect(stage.get('max-height')).toBe('var(--stage-max)')
  })
})
