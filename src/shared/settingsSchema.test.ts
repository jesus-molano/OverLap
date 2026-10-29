import { describe, expect, it } from 'vitest'
import { canonicalAccelerator } from './accelerator'
import { normalizeHexColor } from './colors'
import { LANGUAGES, messagesFor } from './i18n'
import { COMPUTED_INFO_ITEMS, INFO_BAR_ENTRY_IDS, INFO_BARS, INFO_ITEM_IDS } from './infoBar'
import {
  ACCENT_PRESETS,
  DELTA_REFERENCE_VALUES,
  LICENSE_STYLES,
  OPTION_SCHEMA,
  PEDAL_COLOR_PRESETS,
  STANDINGS_COLUMN_IDS,
  WIDGET_FIELD_SCHEMA,
  clampOption,
  displayOnlyFields,
  elementFields,
  elementsSpec,
  type ElementsSpec,
  type OptionSpec
} from './settingsSchema'

const allSpecs = (): [string, OptionSpec][] =>
  Object.entries(OPTION_SCHEMA).flatMap(([section, fields]) =>
    Object.entries(fields as Record<string, OptionSpec>).map(
      ([f, spec]) => [`${section}.${f}`, spec] as [string, OptionSpec]
    )
  )

describe('OPTION_SCHEMA', () => {
  it('has every default inside its own spec', () => {
    for (const [name, spec] of [
      ...allSpecs(),
      ...Object.entries(WIDGET_FIELD_SCHEMA as Record<string, OptionSpec>)
    ]) {
      switch (spec.kind) {
        case 'int':
          expect(Number.isInteger(spec.default), name).toBe(true)
          expect(spec.default, name).toBeGreaterThanOrEqual(spec.min)
          expect(spec.default, name).toBeLessThanOrEqual(spec.max)
          break
        case 'number':
          expect(spec.default, name).toBeGreaterThanOrEqual(spec.min)
          expect(spec.default, name).toBeLessThanOrEqual(spec.max)
          break
        case 'enum':
          expect(spec.values, name).toContain(spec.default)
          expect(new Set(spec.values).size, name).toBe(spec.values.length)
          break
        case 'color':
          expect(normalizeHexColor(spec.default), name).toBe(spec.default)
          break
        case 'colors':
          for (const c of Object.values(spec.default)) expect(normalizeHexColor(c), name).toBe(c)
          break
        case 'elements': {
          // Every id once, the default in the ids' order, required ids shown, parents and
          // computed ids among the ids.
          expect(new Set(spec.ids).size, name).toBe(spec.ids.length)
          expect(
            spec.default.map((e) => e.id),
            name
          ).toEqual([...spec.ids])
          for (const id of spec.required) {
            expect(spec.ids, name).toContain(id)
            expect(spec.default.find((e) => e.id === id)?.visible, `${name} ${id}`).toBe(true)
          }
          for (const [child, parent] of Object.entries(spec.parents)) {
            expect(spec.ids, name).toContain(child)
            expect(spec.ids, name).toContain(parent)
          }
          for (const id of spec.computed ?? []) expect(spec.ids, name).toContain(id)
          break
        }
        case 'bool':
          expect(typeof spec.default, name).toBe('boolean')
          break
        case 'accelerator':
          // '' is an action with no combination until the user gives it one.
          if (spec.default !== '') {
            expect(canonicalAccelerator(spec.default), name).toBe(spec.default)
          }
      }
    }
  })

  it('has the standings column defaults (Δ iRating, gap to leader and the stint extras off)', () => {
    const hidden = OPTION_SCHEMA.standings.columns.default
      .filter((c) => !c.visible)
      .map((c) => c.id)
    expect(hidden).toEqual(['delta', 'gapLeader', 'pitLap', 'stint', 'tyre'])
    // The best lap goes right after the last one, the stint extras after the pit column.
    expect(STANDINGS_COLUMN_IDS.slice(6)).toEqual([
      'last',
      'best',
      'pit',
      'pitLap',
      'stint',
      'tyre'
    ])
  })

  it('labels every column and offers valid, named presets in every language', () => {
    for (const lang of LANGUAGES) {
      const m = messagesFor(lang).settings
      for (const id of STANDINGS_COLUMN_IDS) expect(m.columns.labels[id], lang).toBeTruthy()
      for (const p of ACCENT_PRESETS) expect(m.appearance.color.accentNames[p.name]).toBeTruthy()
    }
    expect(new Set(ACCENT_PRESETS.map((p) => p.name)).size).toBe(ACCENT_PRESETS.length)
    for (const p of ACCENT_PRESETS) expect(normalizeHexColor(p.value)).toBe(p.value)
    for (const list of Object.values(PEDAL_COLOR_PRESETS)) {
      for (const c of list) expect(normalizeHexColor(c)).toBe(c)
    }
  })
})

describe('clampOption', () => {
  it('rounds integers and clamps', () => {
    const spec = OPTION_SCHEMA.relative.carsAhead
    expect(clampOption(spec, 2.6)).toBe(3)
    expect(clampOption(spec, 42)).toBe(10)
    expect(clampOption(spec, -1)).toBe(0)
  })

  it('rounds numbers to their decimals', () => {
    expect(clampOption(OPTION_SCHEMA.battle.thresholdS, 1.26)).toBe(1.3)
    expect(clampOption(OPTION_SCHEMA.battle.thresholdS, 0.1)).toBe(0.3)
    expect(clampOption(OPTION_SCHEMA.radar.rangeM, 12.345)).toBe(12.345)
  })

  it('gives the default for non-finite values and non-numbers', () => {
    for (const v of [Number.NaN, Infinity, -Infinity, '5', null, undefined]) {
      expect(clampOption(OPTION_SCHEMA.radar.rangeM, v)).toBe(20)
    }
  })
})

describe('displayOnlyFields', () => {
  it('lists the renderer-only fields of each telemetry section', () => {
    expect(displayOnlyFields('relative')).toEqual([
      'columns',
      'conditionsTrend',
      'conditionsWindDirection',
      'columnHeads',
      'brandMarks',
      'countryFlags',
      'showFlags',
      'nameFormat'
    ])
    expect(displayOnlyFields('radar')).toEqual(['parts'])
    // The columns and the info bars decide what the provider computes.
    expect(displayOnlyFields('standings')).toEqual([
      'gapMode',
      'conditionsTrend',
      'conditionsWindDirection',
      'classLine',
      'columnHeads',
      'brandMarks',
      'countryFlags',
      'nameFormat',
      'showFlags',
      'density'
    ])
    expect(displayOnlyFields('battle')).toEqual([
      'layout',
      'brandMarks',
      'countryFlags',
      'nameFormat'
    ])
    expect(displayOnlyFields('inputs')).toEqual(Object.keys(OPTION_SCHEMA.inputs))
    // Windows, groups and the hold decide what the providers compute.
    expect(displayOnlyFields('traffic')).toEqual(['parts', 'header', 'nameFormat'])
    expect(displayOnlyFields('alerts')).toEqual(['parts'])
    // The references (and the fallback) are what the provider computes against.
    expect(displayOnlyFields('delta')).toEqual(['rangeS', 'rows', 'top', 'laps'])
    // The fuel provider sends every line; the average, the margin and the header bar's data
    // are what it plans with.
    expect(displayOnlyFields('fuel')).toEqual([
      'conditionsTrend',
      'conditionsWindDirection',
      'lines',
      'showBox'
    ])
    // The lights provider leaves out what is not shown; layout, side and captions are drawing.
    expect(displayOnlyFields('lights')).toEqual([
      'layout',
      'labelSide',
      'showCaptions',
      'repairCrewTag'
    ])
  })
})

describe('element lists (v2.6)', () => {
  it('replaces the standings column kind, with the same stored shape', () => {
    const spec = OPTION_SCHEMA.standings.columns
    expect(spec.kind).toBe('elements')
    expect(spec.ids).toEqual([...STANDINGS_COLUMN_IDS])
    expect(spec.default[0]).toEqual({ id: 'gained', visible: true })
    expect(spec.fixedOrder).toBe(false)
  })

  it('elementsSpec reads a list by section and field; elementFields lists them all', () => {
    expect(elementsSpec('relative', 'columns')).toBe(OPTION_SCHEMA.relative.columns)
    const fields = elementFields().map(([s, f]) => `${s}.${f}`)
    for (const f of [
      'relative.columns',
      'relative.headerBar',
      'standings.columns',
      'standings.subheaderBar',
      'battle.lanes',
      'inputs.sections',
      'traffic.groups',
      'delta.laps',
      'fuel.lines',
      'lights.icons',
      'radar.parts',
      'alerts.parts'
    ]) {
      expect(fields).toContain(f)
    }
    expect(() => elementsSpec('relative', 'nope' as never)).toThrow()
  })

  it("keeps today's look by default: hidden only what was off", () => {
    const hidden = (spec: ElementsSpec): string[] =>
      spec.default.filter((e) => !e.visible).map((e) => e.id)
    expect(hidden(OPTION_SCHEMA.relative.columns)).toEqual(['tyre', 'stint'])
    expect(hidden(OPTION_SCHEMA.battle.rows)).toEqual(['laps'])
    expect(hidden(OPTION_SCHEMA.delta.rows)).toEqual(['laps'])
    expect(hidden(OPTION_SCHEMA.delta.laps)).toEqual(['pb'])
    expect(hidden(OPTION_SCHEMA.lights.icons)).toEqual(['pitLimiter', 'revLimiter'])
    for (const spec of [
      OPTION_SCHEMA.radar.parts,
      OPTION_SCHEMA.standings.classLine,
      OPTION_SCHEMA.battle.lanes,
      OPTION_SCHEMA.battle.parts,
      OPTION_SCHEMA.inputs.sections,
      OPTION_SCHEMA.inputs.bars,
      OPTION_SCHEMA.inputs.info,
      OPTION_SCHEMA.traffic.groups,
      OPTION_SCHEMA.traffic.parts,
      OPTION_SCHEMA.traffic.header,
      OPTION_SCHEMA.alerts.parts,
      OPTION_SCHEMA.delta.top,
      OPTION_SCHEMA.fuel.lines
    ] as ElementsSpec[]) {
      expect(hidden(spec)).toEqual([])
    }
  })

  it('makes the cores required and the small fixed groups fixed in order', () => {
    expect(OPTION_SCHEMA.relative.columns.required).toEqual(['driver', 'gap'])
    expect(OPTION_SCHEMA.traffic.parts.required).toEqual(['driver', 'value'])
    expect(OPTION_SCHEMA.delta.rows.required).toEqual(['top'])
    expect(OPTION_SCHEMA.fuel.lines.required).toEqual(['hero'])
    expect(OPTION_SCHEMA.inputs.sections.required).toEqual(['bars'])
    expect(OPTION_SCHEMA.inputs.bars.required).toEqual(['brake', 'throttle'])
    expect(OPTION_SCHEMA.radar.parts.fixedOrder).toBe(true)
    expect(OPTION_SCHEMA.radar.parts.parents).toEqual({ rangeLabels: 'guides' })
    expect(OPTION_SCHEMA.delta.top.fixedOrder).toBe(true)
    expect(OPTION_SCHEMA.battle.parts.fixedOrder).toBe(true)
  })
})

describe('info bars (v2.6)', () => {
  it('every bar lists every item once and the split marker, required', () => {
    for (const [section, bars] of Object.entries(INFO_BARS)) {
      for (const [field, size] of bars) {
        const specs = OPTION_SCHEMA[section as keyof typeof INFO_BARS] as Record<string, OptionSpec>
        const spec = specs[field] as ElementsSpec
        expect(spec.kind, `${section}.${field}`).toBe('elements')
        expect([...spec.ids].sort(), `${section}.${field}`).toEqual([...INFO_BAR_ENTRY_IDS].sort())
        expect(spec.required).toEqual(['split'])
        expect(spec.computed).toEqual(COMPUTED_INFO_ITEMS)
        expect(specs[size]?.kind, `${section}.${size}`).toBe('enum')
        expect(specs[size]?.displayOnly, `${section}.${size}`).toBeUndefined()
      }
    }
    // The renderer's own items are never computed.
    expect(COMPUTED_INFO_ITEMS).not.toContain('title')
    expect(COMPUTED_INFO_ITEMS).not.toContain('clock')
    expect(COMPUTED_INFO_ITEMS.length).toBe(INFO_ITEM_IDS.length - 2)
  })

  it("draws today's headers and footers by default", () => {
    const shown = (spec: ElementsSpec): string[] =>
      spec.default.filter((e) => e.visible).map((e) => e.id)
    const o = OPTION_SCHEMA
    expect(shown(o.relative.headerBar)).toEqual(['title', 'session', 'split', 'incidents'])
    expect(o.relative.headerBarSize.default).toBe('normal')
    const weather = ['trackTemp', 'wet', 'wind', 'airTemp', 'rubber', 'split']
    // The relative's footer is off (its readings preset), the standings' on.
    expect(shown(o.relative.footerBar)).toEqual(weather)
    expect(o.relative.footerBarSize.default).toBe('off')
    expect(shown(o.standings.footerBar)).toEqual(weather)
    expect(o.standings.footerBarSize.default).toBe('normal')
    expect(shown(o.standings.headerBar)).toEqual([
      'session',
      'sof',
      'carCount',
      'split',
      'incidents',
      'remaining'
    ])
    expect(shown(o.standings.subheaderBar)).toEqual([
      'iRating',
      'fastestLap',
      'split',
      'safetyRating'
    ])
    expect(shown(o.fuel.headerBar)).toEqual(['title', 'split'])
    expect(o.fuel.headerBarSize.default).toBe('off')
  })

  it('names every item, the marker and the sizes in every language', () => {
    for (const lang of LANGUAGES) {
      const b = messagesFor(lang).settings.infoBar
      for (const id of INFO_ITEM_IDS) expect(b.items[id], `${lang} ${id}`).toBeTruthy()
      expect(b.split).toBeTruthy()
      for (const size of ['off', 'small', 'normal', 'large'] as const) {
        expect(b.sizeChoices[size].label, `${lang} ${size}`).toBeTruthy()
      }
    }
  })

  it('has no conditions section any more', () => {
    expect('conditions' in OPTION_SCHEMA).toBe(false)
  })
})

describe('driver cell extras and the outline licence (v2.6)', () => {
  it('brand marks auto, flags on in the tables and off in the battle, no column heads', () => {
    for (const s of ['relative', 'standings', 'battle'] as const) {
      expect(OPTION_SCHEMA[s].brandMarks.default, s).toBe('auto')
      expect(OPTION_SCHEMA[s].brandMarks.values, s).toEqual(['auto', 'on', 'off'])
    }
    expect(OPTION_SCHEMA.relative.countryFlags.default).toBe(true)
    expect(OPTION_SCHEMA.standings.countryFlags.default).toBe(true)
    expect(OPTION_SCHEMA.battle.countryFlags.default).toBe(false)
    expect(OPTION_SCHEMA.relative.columnHeads.default).toBe(false)
    expect(OPTION_SCHEMA.standings.columnHeads.default).toBe(false)
  })

  it('offers the outline licence first, as the default', () => {
    expect(LICENSE_STYLES).toEqual(['outline', 'soft', 'solid', 'letter'])
    expect(OPTION_SCHEMA.appearance.licenseStyle.default).toBe('outline')
    for (const lang of LANGUAGES) {
      const c = messagesFor(lang).settings.appearance.rows.licenseChoices
      for (const v of LICENSE_STYLES) expect(c[v].label, `${lang} ${v}`).toBeTruthy()
    }
  })

  it("the lights' side, the settings window's scene", () => {
    expect(OPTION_SCHEMA.lights.labelSide.values).toEqual(['right', 'left'])
    expect(OPTION_SCHEMA.lights.labelSide.default).toBe('right')
    expect(OPTION_SCHEMA.settingsWindow.stageScene.values).toEqual(['dark', 'light'])
    expect(OPTION_SCHEMA.settingsWindow.stageScene.default).toBe('dark')
  })
})

describe('v2.1 traffic and alerts specs', () => {
  it('has the documented ranges and defaults', () => {
    const t = OPTION_SCHEMA.traffic
    for (const spec of [t.behindS, t.aheadS]) expect([spec.min, spec.max]).toEqual([2, 30])
    expect([t.behindS.default, t.aheadS.default]).toEqual([12, 8])
    expect([t.hazardS.min, t.hazardS.max, t.hazardS.default]).toEqual([2, 20, 8])
    expect([t.maxEntries.kind, t.maxEntries.min, t.maxEntries.max]).toEqual(['int', 1, 5])
    const hold = OPTION_SCHEMA.alerts.holdS
    expect([hold.min, hold.max, hold.default]).toEqual([0, 10, 3])
  })

  it('clamps like normalisation', () => {
    expect(clampOption(OPTION_SCHEMA.traffic.behindS, 12.4)).toBe(12)
    expect(clampOption(OPTION_SCHEMA.traffic.hazardS, 99)).toBe(20)
    expect(clampOption(OPTION_SCHEMA.traffic.maxEntries, 0)).toBe(1)
    expect(clampOption(OPTION_SCHEMA.alerts.holdS, 1.26)).toBe(1.3)
    expect(clampOption(OPTION_SCHEMA.alerts.holdS, '2')).toBe(3)
  })
})

describe('v2.2 delta specs', () => {
  it('has the documented ranges and defaults', () => {
    const d = OPTION_SCHEMA.delta
    // Yours first (record, session best, optimal), then your class's (best, optimal).
    expect(DELTA_REFERENCE_VALUES).toEqual(['pb', 'session', 'optimal', 'class', 'classOptimal'])
    for (const spec of [d.referencePractice, d.referenceQualify, d.referenceRace]) {
      expect(spec.values).toEqual(DELTA_REFERENCE_VALUES)
      expect('displayOnly' in spec).toBe(false)
    }
    // Your record in practice, your optimal of the session in qualifying and races.
    expect(d.referencePractice.default).toBe('pb')
    expect(d.referenceQualify.default).toBe('optimal')
    expect(d.referenceRace.default).toBe('optimal')
    expect(d.fallback.default).toBe(true)
    expect([d.rangeS.min, d.rangeS.max, d.rangeS.step, d.rangeS.default]).toEqual([0.5, 3, 0.25, 1])
  })

  it('clamps the range like normalisation', () => {
    expect(clampOption(OPTION_SCHEMA.delta.rangeS, 1.257)).toBe(1.26)
    expect(clampOption(OPTION_SCHEMA.delta.rangeS, 0)).toBe(0.5)
    expect(clampOption(OPTION_SCHEMA.delta.rangeS, 9)).toBe(3)
    expect(clampOption(OPTION_SCHEMA.delta.rangeS, null)).toBe(1)
  })

  it('names and explains every reference in every language', () => {
    for (const lang of LANGUAGES) {
      const s = messagesFor(lang).settings.delta
      for (const ref of DELTA_REFERENCE_VALUES) {
        expect(s.references[ref].label, `${lang} ${ref}`).toBeTruthy()
        expect(s.references[ref].hint, `${lang} ${ref}`).toBeTruthy()
        expect(s.referenceHelp[ref], `${lang} ${ref}`).toBeTruthy()
        expect(s.referencesShort[ref], `${lang} ${ref}`).toBeTruthy()
      }
    }
    expect(messagesFor('es').settings.delta.references.pb.label).toBe('Récord personal')
    expect(messagesFor('en').settings.delta.references.pb.label).toBe('Personal best')
    expect(messagesFor('es').settings.delta.references.optimal.label).toBe('Vuelta óptima')
    expect(messagesFor('en').settings.delta.references.classOptimal.label).toBe('Class optimal')
  })
})

describe('language spec', () => {
  it('offers every language, Spanish by default, without a new telemetry config', () => {
    const spec = OPTION_SCHEMA.appearance.language
    expect(spec.values).toEqual(['es', 'en'])
    expect(spec.default).toBe('es')
    expect(spec.displayOnly).toBe(true)
  })
})

describe('shortcut specs', () => {
  it('are display-only accelerators with distinct defaults (none for the delta cycle)', () => {
    const specs = Object.values(OPTION_SCHEMA.shortcuts)
    for (const spec of specs) {
      expect(spec.kind).toBe('accelerator')
      expect(spec.displayOnly).toBe(true)
    }
    const given = specs.map((s) => s.default).filter((d) => d !== '')
    expect(new Set(given).size).toBe(given.length)
    expect(OPTION_SCHEMA.shortcuts.cycleDeltaReference.default).toBe('')
  })
})
