/**
 * R24: each reset of a widget page resets the part whose head carries it. The parts are named in
 * shared/settings/optionParts.ts; here they are checked against where each page's component
 * actually places its options.
 */
import { describe, expect, it } from 'vitest'
import {
  APPEARANCE_PARTS,
  APPEARANCE_PART_FIELDS,
  OPTION_PARTS,
  appearancePartDefaults,
  optionPartDefaults,
  optionPartFields,
  optionPartOf
} from '@shared/settings'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import { WIDGET_IDS, type WidgetId } from '@shared/widgets'
import APPEARANCE_PAGE from './pages/AppearancePage.vue?raw'
import VISIBILITY_PAGE from './pages/VisibilityPage.vue?raw'

/** «Cuándo se ve el overlay» is on the «Visibilidad» page (R34): the two pages' sections. */
const APPEARANCE = APPEARANCE_PAGE + VISIBILITY_PAGE

const RAW = import.meta.glob('./options/*Settings.vue', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

/** 'relative' → RelativeSettings.vue's source. */
function sourceOf(id: WidgetId): string {
  const name = `./options/${id.charAt(0).toUpperCase()}${id.slice(1)}Settings.vue`
  const src = RAW[name]
  if (src === undefined) throw new Error(`no ${name}`)
  return src
}

/** The fields a template sets with `set('field')`, inside and outside «Personalizar». */
function setFields(src: string): { inside: string[]; outside: string[] } {
  const template = src.slice(src.indexOf('<template>'))
  const start = template.indexOf('<CustomizeSection')
  const end = template.indexOf('</CustomizeSection>')
  const custom = start >= 0 && end > start ? template.slice(start, end) : ''
  const rest = start >= 0 && end > start ? template.slice(0, start) + template.slice(end) : template
  const fields = (s: string): string[] => [...s.matchAll(/set\('([a-zA-Z]+)'\)/g)].map((m) => m[1]!)
  return { inside: fields(custom), outside: fields(rest) }
}

describe('the parts of a widget page (R24)', () => {
  it('put every option of a widget in exactly one part', () => {
    for (const id of WIDGET_IDS) {
      const all = Object.keys(OPTION_SCHEMA[id]).sort()
      const parted = OPTION_PARTS.flatMap((p) => optionPartFields(id, p)).sort()
      expect(parted, id).toEqual(all)
    }
  })

  it('match where each page places its options', () => {
    for (const id of WIDGET_IDS) {
      const { inside, outside } = setFields(sourceOf(id))
      for (const f of inside)
        expect(`${id}.${f}: ${optionPartOf(id, f)}`).toBe(`${id}.${f}: customize`)
      for (const f of outside)
        expect(`${id}.${f}: ${optionPartOf(id, f)}`).toBe(`${id}.${f}: content`)
    }
  })

  it('give the «Piloto» block to the four driver widgets only', () => {
    expect(WIDGET_IDS.filter((id) => optionPartFields(id, 'driver').length > 0)).toEqual([
      'relative',
      'standings',
      'battle',
      'traffic'
    ])
    expect(optionPartFields('standings', 'driver')).toEqual([
      'brandMarks',
      'countryFlags',
      'showFlags',
      'iRatingFormat',
      'iRatingColor',
      'nameFormat'
    ])
    // The alerts' penalty-free «showFlags» is an alert of its list, not a driver option.
    expect(optionPartOf('alerts', 'showFlags')).toBe('customize')
  })

  it('reset a part to its defaults, as fresh copies', () => {
    const d = optionPartDefaults('relative', 'customize')
    expect(d.columns).toEqual(DEFAULT_SETTINGS.relative.columns)
    expect(d.columns).not.toBe(DEFAULT_SETTINGS.relative.columns)
    expect(d.headerBarSize).toBe(DEFAULT_SETTINGS.relative.headerBarSize)
    expect('carsAhead' in d).toBe(false)
    expect(optionPartDefaults('relative', 'content')).toEqual({
      carsAhead: DEFAULT_SETTINGS.relative.carsAhead,
      carsBehind: DEFAULT_SETTINGS.relative.carsBehind,
      density: DEFAULT_SETTINGS.relative.density
    })
  })
})

describe('the sections of Apariencia (R24)', () => {
  it('cover the look and the screen rules, the language apart', () => {
    const look = APPEARANCE_PARTS.filter((p) => APPEARANCE_PART_FIELDS[p].section === 'appearance')
    const fields = look.flatMap((p) => APPEARANCE_PART_FIELDS[p].fields).sort()
    expect(fields).toEqual(
      Object.keys(OPTION_SCHEMA.appearance)
        .filter((f) => f !== 'language')
        .sort()
    )
    expect([...APPEARANCE_PART_FIELDS.screen.fields].sort()).toEqual(
      Object.keys(OPTION_SCHEMA.visibility).sort()
    )
  })

  it('match the page: each section sets its own fields', () => {
    const sections = [...APPEARANCE.matchAll(/<PageSection[\s\S]*?<\/PageSection>/g)].map(
      (m) => m[0]
    )
    for (const part of APPEARANCE_PARTS) {
      const { fields } = APPEARANCE_PART_FIELDS[part]
      const own = sections.find((sec) => sec.includes(`appearance.${part}.title`))
      if (own === undefined) throw new Error(part)
      const set = [...own.matchAll(/(?:set|setVisibility)\('([a-zA-Z]+)'\)/g)].map((m) => m[1])
      expect(set.length, part).toBeGreaterThan(0)
      for (const f of set) expect(`${part}: ${f}`).toBe(`${part}: ${fields.includes(f!) ? f : '?'}`)
    }
  })

  it('reset a section to its defaults', () => {
    expect(appearancePartDefaults('text')).toEqual({
      section: 'appearance',
      fields: {
        fontScale: DEFAULT_SETTINGS.appearance.fontScale,
        textHalo: DEFAULT_SETTINGS.appearance.textHalo
      }
    })
    expect(appearancePartDefaults('screen').fields).toEqual(DEFAULT_SETTINGS.visibility)
  })
})
