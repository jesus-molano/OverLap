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
import SHORTCUTS_PAGE from '../pages/ShortcutsPage.vue?raw'
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
    const css = styleOf(SAMPLE_STAGE)
    const stage = declarations(outsideMedia(css), '.stage')
    expect(stage.get('--stage-share')).toBe('40vh')
    expect(stage.get('--stage-max')).toBe('max(160px, var(--stage-share))')
    expect(stage.get('max-height')).toBe('var(--stage-max)')
    // A wide window gives it a little more, still a share of the height.
    expect(declarations(media(css, WIDE), '.stage').get('--stage-share')).toBe('46vh')
  })
})

/** The scoped style block of an SFC. */
function styleOf(sfc: string): string {
  return /<style scoped>([\s\S]*?)<\/style>/.exec(sfc)?.[1] ?? ''
}

const WIDE = '@media (min-width: 1100px)'

const uncommented = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** The body of the first `@media` block with exactly this condition. */
function media(css: string, condition: string): string {
  const flat = uncommented(css)
  const at = flat.indexOf(`${condition} {`)
  if (at < 0) return ''
  const open = flat.indexOf('{', at)
  let depth = 0
  for (let i = open; i < flat.length; i++) {
    if (flat[i] === '{') depth++
    else if (flat[i] === '}' && --depth === 0) return flat.slice(open + 1, i)
  }
  return ''
}

/** Everything outside media blocks (one level of rules inside them). */
function outsideMedia(css: string): string {
  return uncommented(css).replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
}

describe('settings window: wide and ultrawide', () => {
  it('keeps one 780 px column below 1100 px, as before', () => {
    const root = declarations(outsideMedia(SETTINGS_CSS), 'html.ov-settings')
    expect(root.get('--st-page-max')).toBe('780px')
    expect(outsideMedia(SETTINGS_CSS)).not.toMatch(/columns:/)
  })

  it('spreads the options over two columns from 1100 px (R14), a section never split', () => {
    const css = media(SETTINGS_CSS, WIDE)
    expect(declarations(css, 'html.ov-settings').get('--st-page-max')).toBe('1480px')
    const cols = declarations(css, 'html.ov-settings .st-cols')
    expect(cols.get('columns')).toBe('2')
    expect(cols.get('column-gap')).toBe('var(--st-col-gap)')
    const section = declarations(css, 'html.ov-settings .st-cols .st-section')
    expect(section.get('break-inside')).toBe('avoid')
  })

  it('keeps each column near the one-column width (lines of about 90 characters)', () => {
    const wide = declarations(media(SETTINGS_CSS, WIDE), 'html.ov-settings')
    const root = declarations(outsideMedia(SETTINGS_CSS), 'html.ov-settings')
    const page = Number.parseFloat(wide.get('--st-page-max') ?? '')
    const gap = Number.parseFloat(root.get('--st-col-gap') ?? '')
    const column = (page - gap) / 2
    expect(column).toBeGreaterThanOrEqual(680)
    expect(column).toBeLessThanOrEqual(780)
  })

  it('wraps the options of every page in the columns, below the fixed top', () => {
    for (const page of [APPEARANCE_PAGE, SHORTCUTS_PAGE, WIDGET_PAGE]) {
      const t = templateOf(page)
      // A widget page: one block, in the columns when it has no editors (R14). The shortcuts
      // are one table over the whole width (its own maximum, ShortcutsPage .sc-page).
      expect(tagsWith(t, 'st-cols')).toHaveLength(page === SHORTCUTS_PAGE ? 0 : 1)
      if (page === SHORTCUTS_PAGE) continue
      expect(t.indexOf('st-cols')).toBeGreaterThan(t.indexOf('<template #top>'))
      expect(t.indexOf('st-cols')).toBeGreaterThan(t.indexOf('</template>'))
    }
  })

  it('gives the editors the second column of a wide widget page, the rest stacked left (R14)', () => {
    const css = media(styleOf(WIDGET_PAGE), WIDE)
    const grid = declarations(css, '.opts.has-custom')
    expect(grid.get('display')).toBe('grid')
    expect(grid.get('grid-template-columns')).toBe('minmax(0, 1fr) minmax(0, 1fr)')
    // The left rows are as tall as their own content; the last takes what the editors have more.
    expect(grid.get('grid-template-rows')).toBe('auto auto auto 1fr')
    expect(declarations(css, '.has-custom .opts-main').get('grid-area')).toBe('1 / 1')
    expect(declarations(css, '.has-custom .opts-window').get('grid-area')).toBe('2 / 1')
    expect(declarations(css, '.has-custom .opts-appendix').get('grid-area')).toBe('3 / 1')
    expect(declarations(css, '.has-custom .opts-custom').get('grid-area')).toBe('1 / 2 / -1 / 3')
    // One column: the DOM order is the page's order (R04): Contenido, Personalizar, Ventana.
    const t = templateOf(WIDGET_PAGE)
    const at = (cls: string): number => t.indexOf(`class="${cls}"`)
    expect(at('opts-main')).toBeLessThan(at('opts-custom'))
    expect(at('opts-custom')).toBeLessThan(at('opts-appendix'))
    expect(at('opts-appendix')).toBeLessThan(at('opts-window'))
  })

  it('caps and centres the whole window content on an ultrawide screen', () => {
    const css = media(styleOf(APP), '@media (min-width: 2200px)')
    const app = declarations(css, '.app')
    expect(app.get('max-width')).toBe('var(--st-app-max)')
    expect(app.get('margin-inline')).toBe('auto')
    const own = declarations(outsideMedia(styleOf(APP)), '.app')
    expect(own.get('--st-app-max')).toContain('var(--st-page-max)')
  })
})

describe('preview stage fold (R14)', () => {
  const css = styleOf(SAMPLE_STAGE)

  it('folds into a strip of about 120 px, its foot controls out of the way', () => {
    const folded = declarations(css, '.stage[data-folded]')
    expect(folded.get('--stage-max')).toBe('120px')
    expect(
      declarations(css, '.stage[data-folded] .stage-foot, .stage[data-folded] .caption').get(
        'display'
      )
    ).toBe('none')
    const t = templateOf(SAMPLE_STAGE)
    expect(t).toContain(':data-folded="folded || undefined"')
    expect(t).toContain('fold.unfold()')
    expect(SAMPLE_STAGE).toContain("optionSetter('settingsWindow')('previewFold')")
  })

  it('is folded by the page frame from its scroller', () => {
    expect(templateOf(PAGE_FRAME)).toContain('@scroll.passive="onScroll"')
    expect(PAGE_FRAME).toContain('providePreviewFold(')
  })
})

describe('preview stage scenes', () => {
  const css = styleOf(SAMPLE_STAGE)

  it('draws both scenes, never from an image file, each with its own caption ink', () => {
    for (const scene of ['dark', 'light']) {
      const bg = declarations(css, `.stage[data-scene='${scene}'] .scene`).get('background')
      expect(bg, scene).toMatch(/gradient/)
      expect(bg, scene).not.toMatch(/url\(/)
    }
    expect(declarations(css, ".stage[data-scene='light']").get('--scene-ink')).toBeDefined()
    expect(declarations(css, '.caption').get('color')).toBe('var(--scene-ink)')
  })

  it('switches the scene on the stage: a labelled radio group, outside the hidden sample', () => {
    const t = templateOf(SAMPLE_STAGE)
    expect(t).toContain('<figure')
    expect(t).toContain(':data-scene="sceneNow"')
    expect(t).toContain('role="radiogroup" :aria-labelledby="sceneLabelId"')
    expect(t).toContain('type="radio"')
    expect(t.indexOf('class="scene-switch"')).toBeGreaterThan(t.indexOf('<slot />'))
    expect(SAMPLE_STAGE).toContain("optionSetter('settingsWindow')('stageScene')")
  })
})
