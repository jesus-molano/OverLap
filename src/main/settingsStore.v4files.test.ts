/**
 * Whole settings files as v2.5 (settings version 4, before the customisation block) wrote them,
 * loaded by today's store: the untouched file every installation has (fixtures/
 * settings-v4-default.json, main's own defaults as saved) and a heavily customised one
 * (fixtures/settings-v4-customised.json; no personal data). Nothing the driver chose may be lost,
 * and only the changes of default the customisation block asked for (the outline licence, the
 * delta's reference per kind of session, the pedals fitting their content) may show.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { optionSetOf } from '@shared/layouts'
import { DEFAULT_SETTINGS, SETTINGS_VERSION, normalizeSettings } from '@shared/settings'
import { syncActiveLayout } from '@shared/settings/layouts'
import type { ElementEntry } from '@shared/types'
import { WIDGET_IDS, type WidgetId } from '@shared/widgets'
import DEFAULT_V4 from './fixtures/settings-v4-default.json'
import CUSTOM_V4 from './fixtures/settings-v4-customised.json'
import { SettingsStore } from './settingsStore'

let dir: string
let file: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'overlay-settings-v4-'))
  file = join(dir, 'settings.json')
})

afterEach(() => rmSync(dir, { recursive: true, force: true }))

function load(raw: unknown): SettingsStore {
  writeFileSync(file, JSON.stringify(raw))
  return SettingsStore.load(file)
}

/** The ids of a list in order, a hidden one with a leading '-'. */
const ids = (list: readonly ElementEntry[]): string[] =>
  list.map((e) => (e.visible ? e.id : `-${e.id}`))

/** The info bars a v4 section keeps (shared migrateOldBars, tested there): those of before 2.3. */
function oldBars(section: 'relative' | 'standings' | 'battle' | 'traffic' | 'fuel'): object {
  const s = normalizeSettings({ version: 4, [section]: {} })[section] as unknown as Record<
    string,
    unknown
  >
  // What it drew before R30 too: the standings' second header line, every fuel line.
  return {
    headerBar: s.headerBar,
    footerBar: s.footerBar,
    ...('subheaderBarSize' in s ? { subheaderBarSize: s.subheaderBarSize } : {}),
    ...(section === 'fuel' ? { lines: s.lines } : {})
  }
}

describe('the untouched v4 file', () => {
  it('loads as today’s defaults: the new defaults asked for, everything else as it was', () => {
    expect(DEFAULT_V4.version).toBe(4)
    expect(DEFAULT_V4.appearance.licenseStyle).toBe('soft')
    expect(DEFAULT_V4.delta.reference).toBe('pb')
    const s = load(DEFAULT_V4).settings
    // What came after it stays off: the pedals' car block and shift lights, the repair's
    // crew-time tag.
    const expected = structuredClone({
      ...DEFAULT_SETTINGS,
      inputs: {
        ...DEFAULT_SETTINGS.inputs,
        sections: DEFAULT_SETTINGS.inputs.sections.map((b) => ({ ...b, visible: b.id !== 'car' })),
        shiftLights: false
      },
      lights: { ...DEFAULT_SETTINGS.lights, repairCrewTag: false },
      // The «Piloto» block (R08): the penalty switch it saved stays its own; what the battle and
      // the traffic never drew stays off; the rest follows Apariencia, which draws the same.
      // The info bars it drew (before they were lists): those of before 2.3, not R13's.
      relative: { ...DEFAULT_SETTINGS.relative, ...oldBars('relative'), showFlags: true },
      standings: { ...DEFAULT_SETTINGS.standings, ...oldBars('standings'), showFlags: true },
      battle: {
        ...DEFAULT_SETTINGS.battle,
        ...oldBars('battle'),
        showFlags: false,
        countryFlags: false
      },
      fuel: { ...DEFAULT_SETTINGS.fuel, ...oldBars('fuel') },
      traffic: {
        ...DEFAULT_SETTINGS.traffic,
        ...oldBars('traffic'),
        brandMarks: 'off' as const,
        countryFlags: false,
        showFlags: false
      }
    })
    // Its own background opacities stay (the old per-widget defaults, saved): only a fresh
    // install follows the global one.
    const v4Widgets: Partial<Record<WidgetId, (typeof DEFAULT_V4.widgets)['relative']>> =
      DEFAULT_V4.widgets
    for (const id of WIDGET_IDS) {
      const v4 = v4Widgets[id]
      // A widget from after 2.5 (the spotter) has no entry: it comes hidden (below).
      if (v4 === undefined) continue
      // Its sessions too: the fuel stays race-only (R44 is for new installs).
      expected.widgets[id].showIn = { ...v4.showIn }
      expected.widgets[id].backgroundOpacity = v4.backgroundOpacity
    }
    // The spotter (2.4): hidden, its default size, in the free spot nearest its default place.
    expect(s.widgets.spotter.visible).toBe(false)
    expect(s.widgets.spotter.bounds).toMatchObject({ width: 400, height: 180 })
    expected.widgets.spotter.bounds = s.widgets.spotter.bounds
    // Its one layout, and the shared options, have the options as loaded.
    syncActiveLayout(expected)
    expected.savedLayouts.shared = optionSetOf(expected)
    expect(s).toEqual(expected)
    // The changes of default, applied once.
    expect(s.appearance.licenseStyle).toBe('outline')
    expect([s.delta.referencePractice, s.delta.referenceQualify, s.delta.referenceRace]).toEqual([
      'pb',
      'optimal',
      'optimal'
    ])
    expect(s.widgets.inputs.autoHeight).toBe(true)
  })

  it('saves as the current version, without the fields the lists replaced, and reloads equal', () => {
    const store = load(DEFAULT_V4)
    store.update((d) => {
      d.radar.rangeM = 25
    })
    expect(store.flush()).toBe(true)
    const saved = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Record<string, unknown>>
    expect(saved.version).toBe(SETTINGS_VERSION)
    expect(saved.relative).not.toHaveProperty('showLicense')
    expect(saved.delta).not.toHaveProperty('reference')
    expect(saved.fuel).not.toHaveProperty('showHeader')
    const again = SettingsStore.load(file).settings
    expect(again).toEqual(store.settings)
    // A file of today's version is not migrated again: 'soft' chosen now stays 'soft'.
    store.update((d) => {
      d.appearance.licenseStyle = 'soft'
    })
    expect(store.flush()).toBe(true)
    expect(SettingsStore.load(file).settings.appearance.licenseStyle).toBe('soft')
  })
})

describe('a customised v4 file', () => {
  it('keeps the appearance and the windows the driver set', () => {
    const s = load(CUSTOM_V4).settings
    expect(s.appearance).toMatchObject({
      language: 'en',
      licenseStyle: 'solid',
      accent: '#00e5ff',
      fontScale: 110,
      density: 'compact'
    })
    expect(s.widgets.relative).toMatchObject({
      bounds: { x: 40, y: 520, width: 420, height: 260 },
      backgroundOpacity: 0.6,
      locked: true
    })
    expect(s.widgets.fuel.visible).toBe(true)
    // The pedals fit their content from now on; where the window is stays.
    expect(s.widgets.inputs.autoHeight).toBe(true)
    expect(s.widgets.inputs.bounds).toMatchObject({ x: 900, y: 900, width: 420 })
    expect(s.shortcuts).toEqual({ ...DEFAULT_SETTINGS.shortcuts, ...CUSTOM_V4.shortcuts })
  })

  it('draws every widget as before: its own background, and the relative’s comfortable rows', () => {
    const store = load(CUSTOM_V4)
    const s = store.settings
    const saved = CUSTOM_V4.widgets as Record<string, { backgroundOpacity: number }>
    for (const id of WIDGET_IDS) {
      // A widget from after 2.5 (the spotter) follows the global one, as on a new install.
      const own = saved[id]?.backgroundOpacity ?? 'inherit'
      expect(s.widgets[id].backgroundOpacity, id).toBe(own)
    }
    // Before 2.3 the relative ignored the global density; with this file's 'compact' it would
    // follow it ('inherit') and tighten: it keeps the rows it had.
    expect(s.appearance.density).toBe('compact')
    expect(s.relative.density).toBe('comfortable')
    // So does the layout the file is given (its options are the file's own).
    const active = s.savedLayouts.list.find((l) => l.id === s.savedLayouts.activeId)
    expect(active?.options?.sections.relative.density).toBe('comfortable')
  })

  it('turns the relative’s switches into its columns and bars', () => {
    const r = load(CUSTOM_V4).settings.relative
    expect(ids(r.columns)).toEqual([
      '-pos',
      'driver',
      '-flags',
      'ir',
      '-lic',
      '-pit',
      'tyre',
      'stint',
      'gap'
    ])
    expect(r.headerBar.find((e) => e.id === 'incidents')?.visible).toBe(false)
    expect(r.footerBarSize).toBe('normal')
    expect(ids(r.footerBar).slice(0, 5)).toEqual([
      'trackTemp',
      '-wet',
      'wind',
      'airTemp',
      '-rubber'
    ])
    expect(r).toMatchObject({
      carsAhead: 4,
      carsBehind: 2,
      nameFormat: 'surname',
      conditionsTrend: false,
      conditionsWindDirection: true
    })
  })

  it('keeps the standings’ columns in their order and turns the header switches into bars', () => {
    const s = load(CUSTOM_V4).settings.standings
    expect(ids(s.columns).slice(0, 5)).toEqual(['-flags', 'gap', '-gained', 'ir', 'lic'])
    expect(s.columns.find((c) => c.id === 'delta')?.visible).toBe(true)
    expect(s.columns.find((c) => c.id === 'tyre')?.visible).toBe(true)
    const shown = (list: readonly ElementEntry[], id: string): boolean | undefined =>
      list.find((e) => e.id === id)?.visible
    expect(shown(s.headerBar, 'incidents')).toBe(false)
    expect(shown(s.headerBar, 'carCount')).toBe(false)
    expect(shown(s.headerBar, 'sof')).toBe(true)
    expect(shown(s.subheaderBar, 'iRating')).toBe(false)
    expect(shown(s.subheaderBar, 'safetyRating')).toBe(true)
    expect(ids(s.classLine)).toEqual(['sof', '-carCount'])
    expect(s.footerBarSize).toBe('off')
    expect(s).toMatchObject({ mode: 'full', gapMode: 'both', density: 'compact' })
  })

  it('turns the battle, pedals, radar, traffic, delta, fuel and lights switches into lists', () => {
    const s = load(CUSTOM_V4).settings
    expect(ids(s.battle.lanes)).toEqual(['ahead', '-behind'])
    expect(ids(s.battle.rows)).toEqual(['-prediction', '-sectors', 'laps'])
    expect(s.battle.parts.find((p) => p.id === 'stake')?.visible).toBe(false)
    expect(s.battle).toMatchObject({ layout: 'side', thresholdS: 1 })

    expect(ids(s.inputs.sections)).toEqual(['info', 'bars', 'trace', '-car'])
    expect(s.inputs.shiftLights).toBe(false)
    expect(ids(s.inputs.bars)).toEqual(['-clutch', 'brake', 'throttle'])
    expect(ids(s.inputs.info)).toEqual(['gear', 'speed', '-steering'])
    expect(s.inputs.traceSeconds).toBe(8)
    expect(s.inputs.colors).toEqual(CUSTOM_V4.inputs.colors)

    expect(ids(s.radar.parts)).toEqual(['guides', 'sideAlerts', '-rangeLabels'])
    expect(s.radar.rangeM).toBe(30)

    expect(ids(s.traffic.groups)).toEqual(['-hazard', 'slower', 'faster'])
    expect(s.traffic.maxEntries).toBe(2)

    expect(s.alerts).toMatchObject({ showBlue: false, showFuelLow: false, holdS: 2 })

    // A reference chosen by hand is kept for every kind of session.
    expect([s.delta.referencePractice, s.delta.referenceQualify, s.delta.referenceRace]).toEqual([
      'optimal',
      'optimal',
      'optimal'
    ])
    expect(s.delta.rows.find((r) => r.id === 'sectors')?.visible).toBe(false)
    expect(s.delta.top.find((r) => r.id === 'state')?.visible).toBe(false)
    expect(s.delta.rangeS).toBe(0.5)

    expect(s.fuel.headerBarSize).toBe('normal')
    expect(ids(s.fuel.lines)).toEqual([
      'hero',
      'gauge',
      'perLap',
      'finish',
      'window',
      '-save',
      '-tyres',
      'limits'
    ])
    expect(s.fuel.avgLaps).toBe(3)

    expect(s.lights).toMatchObject({ layout: 'column', showCaptions: true })
    expect(s.lights.icons.find((i) => i.id === 'water')?.visible).toBe(false)
    expect(s.lights.icons.find((i) => i.id === 'pitLimiter')?.visible).toBe(true)
  })

  it('saves and reloads the same settings', () => {
    const store = load(CUSTOM_V4)
    store.update((d) => {
      d.radar.rangeM = 35
    })
    expect(store.flush()).toBe(true)
    expect(SettingsStore.load(file).settings).toEqual(store.settings)
  })
})

describe('a hand-edited v4 file', () => {
  it('fills what is missing, drops what it does not know and keeps what it can read', () => {
    const raw = {
      version: 4,
      appearance: { language: 'es', licenseStyle: 'neon', fontScale: 400 },
      relative: { showLicense: 'no', showTyre: true, carsAhead: 99, mystery: 1 },
      delta: { reference: 'classOptimal' },
      lights: { showRevLimiter: true },
      somethingElse: { a: 1 }
    }
    const s = load(raw).settings
    expect(s.version).toBe(SETTINGS_VERSION)
    expect(s.appearance.licenseStyle).toBe('outline')
    expect(s.appearance.fontScale).toBeLessThanOrEqual(150)
    // A non-boolean switch reads as unset: the column keeps its default.
    expect(ids(s.relative.columns)).toEqual([
      'pos',
      'driver',
      '-flags',
      'ir',
      'lic',
      '-pit',
      'tyre',
      '-stint',
      'gap'
    ])
    expect(s.relative.carsAhead).toBeLessThan(99)
    expect(s.relative).not.toHaveProperty('mystery')
    expect(s.delta.referenceRace).toBe('classOptimal')
    expect(s.lights.icons.find((i) => i.id === 'revLimiter')?.visible).toBe(true)
    expect(s).not.toHaveProperty('somethingElse')
    expect(s.standings).toEqual(DEFAULT_SETTINGS.standings)
  })
})
