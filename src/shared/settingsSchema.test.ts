import { describe, expect, it } from 'vitest'
import { normalizeHexColor } from './colors'
import { LANGUAGES, messagesFor } from './i18n'
import {
  ACCENT_PRESETS,
  OPTION_SCHEMA,
  PEDAL_COLOR_PRESETS,
  STANDINGS_COLUMN_IDS,
  WIDGET_FIELD_SCHEMA,
  clampOption,
  displayOnlyFields,
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
        case 'columns':
          expect(
            spec.default.map((c) => c.id),
            name
          ).toEqual([...STANDINGS_COLUMN_IDS])
          break
        case 'bool':
          expect(typeof spec.default, name).toBe('boolean')
      }
    }
  })

  it('has the v4 standings column defaults (Δ iRating and gap to leader off)', () => {
    const hidden = OPTION_SCHEMA.standings.columns.default
      .filter((c) => !c.visible)
      .map((c) => c.id)
    expect(hidden).toEqual(['delta', 'gapLeader'])
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
      'showClassPosition',
      'showLicense',
      'showIRating',
      'nameFormat'
    ])
    expect(displayOnlyFields('radar')).toEqual(['showRangeLabels'])
    expect(displayOnlyFields('standings')).toEqual([
      'gapMode',
      'nameFormat',
      'showSof',
      'showCarCount',
      'density'
    ])
    expect(displayOnlyFields('battle')).toEqual(['layout', 'nameFormat'])
    expect(displayOnlyFields('inputs')).toEqual(Object.keys(OPTION_SCHEMA.inputs))
    // Windows, groups and the hold decide what the providers compute.
    expect(displayOnlyFields('traffic')).toEqual(['nameFormat'])
    expect(displayOnlyFields('alerts')).toEqual([])
    // The reference (and its fallback) is what the provider computes against.
    expect(displayOnlyFields('delta')).toEqual([
      'rangeS',
      'showPredicted',
      'showSectors',
      'showTrend'
    ])
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
    expect(d.reference.values).toEqual(['pb', 'session', 'class'])
    expect(d.reference.default).toBe('pb')
    expect(d.fallback.default).toBe(true)
    expect([d.rangeS.min, d.rangeS.max, d.rangeS.step, d.rangeS.default]).toEqual([0.5, 3, 0.25, 1])
    expect([d.showPredicted, d.showSectors, d.showTrend].map((s) => s.default)).toEqual([
      true,
      true,
      true
    ])
  })

  it('clamps the range like normalisation', () => {
    expect(clampOption(OPTION_SCHEMA.delta.rangeS, 1.257)).toBe(1.26)
    expect(clampOption(OPTION_SCHEMA.delta.rangeS, 0)).toBe(0.5)
    expect(clampOption(OPTION_SCHEMA.delta.rangeS, 9)).toBe(3)
    expect(clampOption(OPTION_SCHEMA.delta.rangeS, null)).toBe(1)
  })

  it('names every reference in every language', () => {
    for (const lang of LANGUAGES) {
      for (const ref of OPTION_SCHEMA.delta.reference.values) {
        expect(messagesFor(lang).settings.delta.references[ref].label, lang).toBeTruthy()
      }
    }
    expect(messagesFor('es').settings.delta.references.pb.label).toBe('Récord personal')
    expect(messagesFor('en').settings.delta.references.pb.label).toBe('Personal best')
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
