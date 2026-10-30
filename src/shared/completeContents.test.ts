import { describe, expect, it } from 'vitest'
import {
  COMPLETE_LEAVES,
  COMPLETE_SWITCHES,
  completePatch,
  completeSection,
  defaultContentsPatch,
  isComplete,
  isDefaultContents
} from './completeContents'
import { isElementVisible } from './elements'
import { applySettingsPatch, createDefaultSettings } from './settings'
import { LAYOUT_SECTIONS, OPTION_SCHEMA, type OptionSpec } from './settingsSchema'
import { WIDGET_DEFS } from './widgets'

const RULED = new Set(['conditionsTrend', 'conditionsWindDirection', 'countryFlags', 'showFlags'])
RULED.add('brandMarks').add('gapMode')

describe('«Completo»: everything on in the ten widgets', () => {
  it('classifies every field of every widget section: set by a rule, or left on purpose', () => {
    for (const section of LAYOUT_SECTIONS) {
      const specs = OPTION_SCHEMA[section] as Readonly<Record<string, OptionSpec>>
      for (const [field, spec] of Object.entries(specs)) {
        const ruled =
          spec.kind === 'elements' ||
          field.endsWith('BarSize') ||
          RULED.has(field) ||
          field in COMPLETE_SWITCHES[section]
        expect(ruled || COMPLETE_LEAVES.includes(field), `${section}.${field}`).toBe(true)
        expect(ruled && COMPLETE_LEAVES.includes(field), `${section}.${field} twice`).toBe(false)
      }
    }
  })

  it('shows every column and element, turns the bars on, keeps your order', () => {
    const s = createDefaultSettings()
    s.relative.columns = [...s.relative.columns].reverse()
    const after = applySettingsPatch(s, completePatch(s))
    expect(after.relative.columns.map((c) => c.id)).toEqual(s.relative.columns.map((c) => c.id))
    expect(after.relative.columns.every((c) => c.visible)).toBe(true)
    expect(after.standings.columns.every((c) => c.visible)).toBe(true)
    expect(after.fuel.lines.every((c) => c.visible)).toBe(true)
    expect(after.lights.icons.every((c) => c.visible)).toBe(true)
    expect(after.delta.laps.every((c) => c.visible)).toBe(true)
    expect(after.battle.rows.every((c) => c.visible)).toBe(true)
    for (const section of LAYOUT_SECTIONS) {
      const o = after[section] as unknown as Record<string, unknown>
      for (const [k, v] of Object.entries(o)) {
        if (k.endsWith('BarSize')) expect(v, `${section}.${k}`).not.toBe('off')
      }
    }
    expect(after.relative.columnHeads).toBe(true)
    expect(after.lights).toMatchObject({ showCaptions: true, showTemps: true, onlyWhenLit: false })
  })

  it('keeps the standings’ gap mode and its «Ambos» column in step', () => {
    const s = createDefaultSettings()
    const after = applySettingsPatch(s, completePatch(s))
    expect(after.standings.gapMode).toBe('both')
    expect(isElementVisible(after.standings.columns, 'gapLeader')).toBe(true)
    expect(after.standings.iRatingDeltaAll).toBe(true)
    expect(isElementVisible(after.standings.columns, 'delta')).toBe(true)
  })

  it('a bar gets its widget’s own items and the full conditions, never every datum', () => {
    const s = createDefaultSettings()
    const after = applySettingsPatch(s, completePatch(s))
    const footer = after.standings.footerBar
    for (const id of ['trackTemp', 'wet', 'wind', 'airTemp', 'rubber', 'carCount'] as const) {
      expect(isElementVisible(footer, id), id).toBe(true)
    }
    // The relative's header names it; it does not repeat the standings' session data.
    expect(isElementVisible(after.relative.headerBar, 'title')).toBe(true)
    expect(isElementVisible(after.relative.headerBar, 'sof')).toBe(false)
    // An item you had on stays on.
    s.battle.footerBar = s.battle.footerBar.map((e) =>
      e.id === 'clock' ? { ...e, visible: true } : e
    )
    const mine = applySettingsPatch(s, completePatch(s))
    expect(isElementVisible(mine.battle.footerBar, 'clock')).toBe(true)
  })

  it('the «Piloto» block’s own «No» goes back to «Global»; your own «Sí» stays', () => {
    const s = createDefaultSettings()
    s.relative.countryFlags = false
    s.traffic.brandMarks = 'off'
    s.battle.countryFlags = true
    const after = applySettingsPatch(s, completePatch(s))
    expect(after.relative.countryFlags).toBe('inherit')
    expect(after.traffic.brandMarks).toBe('inherit')
    expect(after.battle.countryFlags).toBe(true)
  })

  it('the height follows the content where it can; free widgets keep theirs', () => {
    const s = createDefaultSettings()
    for (const id of LAYOUT_SECTIONS) s.widgets[id].autoHeight = false
    const after = applySettingsPatch(s, completePatch(s))
    for (const id of LAYOUT_SECTIONS) {
      expect(after.widgets[id].autoHeight, id).toBe(WIDGET_DEFS[id].sizeModel === 'auto-height')
    }
  })

  it('never touches behaviour, drawing, numbers, places or which widgets show', () => {
    const s = createDefaultSettings()
    s.relative.carsAhead = 5
    s.standings.mode = 'full'
    s.battle.layout = 'side'
    s.delta.referenceRace = 'pb'
    s.widgets.radar.visible = false
    const after = applySettingsPatch(s, completePatch(s))
    expect(after.relative.carsAhead).toBe(5)
    expect(after.standings.mode).toBe('full')
    expect(after.battle.layout).toBe('side')
    expect(after.delta.referenceRace).toBe('pb')
    expect(after.widgets.radar.visible).toBe(false)
    expect(after.widgets.relative.bounds).toEqual(s.widgets.relative.bounds)
  })

  it('is idempotent: once applied it changes nothing', () => {
    const s = createDefaultSettings()
    expect(isComplete(s)).toBe(false)
    const after = applySettingsPatch(s, completePatch(s))
    expect(completePatch(after)).toEqual({})
    expect(isComplete(after)).toBe(true)
    for (const section of LAYOUT_SECTIONS) {
      expect(completeSection(section, after[section] as never), section).toEqual({})
    }
  })
})

describe('«OverLap» puts every widget back as it comes («todo de serie»)', () => {
  it('a new install is already there', () => {
    expect(defaultContentsPatch(createDefaultSettings())).toEqual({})
    expect(isDefaultContents(createDefaultSettings())).toBe(true)
  })

  it('undoes «Completo» field by field: columns, order, bars, switches, auto height', () => {
    const s = createDefaultSettings()
    const complete = applySettingsPatch(s, completePatch(s))
    complete.relative.columns = [...complete.relative.columns].reverse()
    complete.widgets.fuel.autoHeight = false
    expect(isDefaultContents(complete)).toBe(false)
    const back = applySettingsPatch(complete, defaultContentsPatch(complete))
    for (const section of LAYOUT_SECTIONS) expect(back[section], section).toEqual(s[section])
    expect(back.widgets.fuel.autoHeight).toBe(true)
    expect(isDefaultContents(back)).toBe(true)
    expect(defaultContentsPatch(back)).toEqual({})
  })

  it('leaves what «Completo» leaves: behaviour, drawing, numbers, places, which widgets show', () => {
    const s = createDefaultSettings()
    s.relative.carsAhead = 5
    s.standings.mode = 'full'
    s.battle.layout = 'side'
    s.delta.referenceRace = 'pb'
    s.relative.density = 'compact'
    s.widgets.radar.visible = false
    s.widgets.relative.bounds = { x: 10, y: 20, width: 700, height: 400 }
    s.standings.columnHeads = !s.standings.columnHeads
    const patch = defaultContentsPatch(s) as Record<string, Record<string, unknown>>
    expect(Object.keys(patch)).toEqual(['standings'])
    expect(Object.keys(patch.standings ?? {})).toEqual(['columnHeads'])
    const after = applySettingsPatch(s, patch)
    expect(after.relative).toMatchObject({ carsAhead: 5, density: 'compact' })
    expect(after.standings.mode).toBe('full')
    expect(after.battle.layout).toBe('side')
    expect(after.delta.referenceRace).toBe('pb')
    expect(after.widgets.radar.visible).toBe(false)
    expect(after.widgets.relative.bounds).toEqual(s.widgets.relative.bounds)
  })
})
