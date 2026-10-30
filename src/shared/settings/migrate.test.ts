import { describe, expect, it } from 'vitest'
import { setElementVisible } from '../elements'
import { OPTION_SCHEMA } from '../settingsSchema'
import type { OverlaySettings, Rect } from '../types'
import { ALERTS_DEFAULT_ROOM, WIDGET_DEFS, WIDGET_IDS, type WidgetId } from '../widgets'
import { createDefaultSettings, normalizeSettings } from '.'
import {
  DEFAULT_AREA,
  HIDDEN_WHEN_ADDED,
  REMOVED_WIDGETS,
  SHOWN_WHEN_ADDED,
  freeSpot,
  migrateCustomizeOpen,
  keepBeforeFewerDefaults,
  migrateOldBars,
  migrateRelativeColumns,
  migrateRelativeDensity,
  migrateSection
} from './migrate'

/** Visibility of `id` in an element list. */
function shown(list: readonly { id: string; visible: boolean }[], id: string): boolean {
  return list.some((e) => e.id === id && e.visible)
}

/** The warning lights shown on the strip, in order. */
function lightsOn(s: OverlaySettings): string[] {
  return s.lights.icons.filter((e) => e.visible).map((e) => e.id)
}

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

/**
 * A layout like the one raced at Lime Rock (report Q5), with the old conditions widget placed
 * where its edit-mode fix put it, from before the fuel widget: the relative moved to the bottom
 * right, right where the fuel default (1200,840 320x190) is.
 */
const RACE_LAYOUT: Partial<Record<WidgetId, Rect>> = {
  relative: { x: 1431, y: 796, width: 417, height: 229 },
  radar: { x: 883, y: 234, width: 220, height: 260 },
  standings: { x: 18, y: 21, width: 540, height: 261 },
  battle: { x: 18, y: 570, width: 380, height: 179 },
  inputs: { x: 814, y: 733, width: 269, height: 90 },
  traffic: { x: 1404, y: 588, width: 444, height: 208 },
  alerts: { x: 802, y: 349, width: 400, height: 70 },
  delta: { x: 778, y: 184, width: 347, height: 69 }
}

/** What a file of v2.3-v2.4 kept for the conditions widget, now the tables' footer. */
const OLD_CONDITIONS = {
  widget: { visible: true, bounds: { x: 60, y: 300, width: 320, height: 130 }, scale: 120 },
  options: { showHeader: true, showWind: false, showSkies: false, showRubber: true }
}

/** A saved file with every widget of RACE_LAYOUT and nothing for the fuel widget. */
function fileBeforeFuel(): Record<string, unknown> {
  const widgets: Record<string, unknown> = {}
  for (const [id, bounds] of Object.entries(RACE_LAYOUT)) widgets[id] = { visible: true, bounds }
  return { version: 4, widgets }
}

describe('a widget newer than the settings file (Q5)', () => {
  it('starts the fuel widget hidden, in a free spot near its default, covering nothing', () => {
    expect(HIDDEN_WHEN_ADDED).toEqual(['fuel'])
    const def = WIDGET_DEFS.fuel.defaultBounds
    expect(overlaps(def, RACE_LAYOUT.relative as Rect)).toBe(true)

    const s = normalizeSettings(fileBeforeFuel())
    const f = s.widgets.fuel
    expect(f.visible).toBe(false)
    expect(f.bounds).toMatchObject({ width: def.width, height: def.height })
    for (const id of WIDGET_IDS) {
      if (id === 'fuel') continue
      const b = s.widgets[id].bounds
      const room = id === 'alerts' ? { ...b, height: Math.max(b.height, ALERTS_DEFAULT_ROOM) } : b
      expect(overlaps(f.bounds, room), id).toBe(false)
    }
    // The others keep what the file says.
    expect(s.widgets.relative.bounds).toEqual(RACE_LAYOUT.relative)
    expect(s.widgets.relative.visible).toBe(true)
  })

  it('keeps what a file that has it says, and leaves a fresh start alone', () => {
    const raw = fileBeforeFuel()
    const saved = { x: 18, y: 469, width: 320, height: 101 }
    ;(raw.widgets as Record<string, unknown>).fuel = { visible: true, bounds: saved }
    const s = normalizeSettings(raw)
    expect(s.widgets.fuel.visible).toBe(true)
    expect(s.widgets.fuel.bounds).toEqual(saved)

    // No file, an empty one, or one without any widget saved: the defaults (shown).
    const defaults = createDefaultSettings().widgets.fuel
    for (const r of [undefined, {}, { version: 4 }, { widgets: {} }, { widgets: { nope: {} } }]) {
      expect(normalizeSettings(r).widgets.fuel, JSON.stringify(r)).toEqual(defaults)
    }
  })

  it('keeps the default place when no spot is free', () => {
    const wall = { x: 0, y: 0, width: 1920, height: 1080 }
    expect(
      freeSpot({ width: 320, height: 190 }, { x: 1200, y: 840 }, [wall], DEFAULT_AREA)
    ).toBeNull()
    const s = normalizeSettings({ widgets: { standings: { visible: true, bounds: wall } } })
    expect(s.widgets.fuel.visible).toBe(false)
    expect(s.widgets.fuel.bounds).toEqual(WIDGET_DEFS.fuel.defaultBounds)
  })

  it('shows the warning lights of a file from before them, in a free spot near their default', () => {
    expect(SHOWN_WHEN_ADDED).toEqual(['lights'])
    // Their default (under the delta) sits on the radar and the alerts moved there.
    const def = WIDGET_DEFS.lights.defaultBounds
    expect(overlaps(def, RACE_LAYOUT.radar as Rect)).toBe(true)

    const s = normalizeSettings(fileBeforeFuel())
    const l = s.widgets.lights
    // Shown: the temperature lights left the alerts band for them.
    expect(l.visible).toBe(true)
    expect(l.bounds).toMatchObject({ width: def.width, height: def.height })
    for (const id of WIDGET_IDS) {
      if (id === 'lights') continue
      const b = s.widgets[id].bounds
      const room = id === 'alerts' ? { ...b, height: Math.max(b.height, ALERTS_DEFAULT_ROOM) } : b
      expect(overlaps(l.bounds, room), id).toBe(false)
    }
    // With no free spot they wait hidden at their default, like the hidden ones.
    const wall = { x: 0, y: 0, width: 1920, height: 1080 }
    const full = normalizeSettings({ widgets: { standings: { visible: true, bounds: wall } } })
    expect(full.widgets.lights).toMatchObject({ visible: false, bounds: def })
    // A file that has them, and a fresh start, keep theirs.
    const raw = fileBeforeFuel()
    const saved = { x: 100, y: 900, width: 200, height: 40 }
    ;(raw.widgets as Record<string, unknown>).lights = { visible: false, bounds: saved }
    expect(normalizeSettings(raw).widgets.lights).toMatchObject({ visible: false, bounds: saved })
    expect(normalizeSettings({}).widgets.lights).toEqual(createDefaultSettings().widgets.lights)
  })

  it('places both newcomers of a file from the last release clear of the others and each other', () => {
    // The conditions widget still in the file, neither the fuel widget nor the warning lights.
    const raw = fileBeforeFuel()
    ;(raw.widgets as Record<string, unknown>).conditions = OLD_CONDITIONS.widget
    raw.conditions = OLD_CONDITIONS.options
    raw.alerts = { showEngineWarnings: true, showEngineTrend: true }
    const s = normalizeSettings(raw)
    expect('conditions' in s.widgets).toBe(false)
    expect(s.widgets.fuel.visible).toBe(false)
    expect(s.widgets.lights.visible).toBe(true)
    const room = (id: WidgetId): Rect => {
      const b = s.widgets[id].bounds
      return id === 'alerts' ? { ...b, height: Math.max(b.height, ALERTS_DEFAULT_ROOM) } : b
    }
    for (const id of ['fuel', 'lights'] as const) {
      const b = s.widgets[id].bounds
      expect(b.x >= 0 && b.y >= 0, id).toBe(true)
      expect(b.x + b.width <= DEFAULT_AREA.width && b.y + b.height <= DEFAULT_AREA.height, id).toBe(
        true
      )
      for (const other of WIDGET_IDS) {
        if (other !== id) expect(overlaps(b, room(other)), `${id} / ${other}`).toBe(false)
      }
    }
    // The band keeps its oil pressure, the lights their trend.
    expect(s.alerts.showOilPressure).toBe(true)
    expect(s.lights.showTrend).toBe(true)
  })
})

describe('the conditions widget, now the footer of the relative and the standings', () => {
  it('is no widget any more', () => {
    expect(REMOVED_WIDGETS).toEqual(['conditions'])
    for (const id of REMOVED_WIDGETS) {
      expect((WIDGET_IDS as readonly string[]).includes(id)).toBe(false)
      expect(id in createDefaultSettings()).toBe(false)
    }
  })

  it('drops what a file saved for it and changes nothing else', () => {
    const raw = fileBeforeFuel()
    ;(raw.widgets as Record<string, unknown>).conditions = OLD_CONDITIONS.widget
    raw.conditions = OLD_CONDITIONS.options
    raw.standings = { topRows: 5 }
    const s = normalizeSettings(raw)
    expect('conditions' in s.widgets).toBe(false)
    expect('conditions' in s).toBe(false)
    expect(JSON.stringify(s)).not.toContain('showSkies')
    // Exactly what the same file without it gives: its spot is free, nothing else moves.
    const without = fileBeforeFuel()
    without.standings = { topRows: 5 }
    expect(s).toEqual(normalizeSettings(without))
    expect(s.standings.topRows).toBe(5)
  })

  it('leaves the footers at their defaults: on under the standings, off under the relative', () => {
    const raw = fileBeforeFuel()
    ;(raw.widgets as Record<string, unknown>).conditions = OLD_CONDITIONS.widget
    raw.conditions = OLD_CONDITIONS.options
    const s = normalizeSettings(raw)
    expect(s.standings.footerBarSize).toBe('normal')
    expect(s.relative.footerBarSize).toBe('off')
    // The old widget's choices are not carried over: it showed a panel that no longer exists.
    expect(shown(s.standings.footerBar, 'wind')).toBe(true)
    expect(shown(s.relative.footerBar, 'wind')).toBe(true)
  })

  it('survives a corrupt entry of the old widget', () => {
    for (const bad of [null, 7, 'x', [], { bounds: 'nope' }]) {
      const raw = fileBeforeFuel()
      ;(raw.widgets as Record<string, unknown>).conditions = bad
      raw.conditions = bad
      const s = normalizeSettings(raw)
      expect('conditions' in s.widgets, JSON.stringify(bad)).toBe(false)
      expect(s.widgets.standings.bounds).toEqual(RACE_LAYOUT.standings)
    }
  })
})

describe('freeSpot', () => {
  it('finds the free spot nearest the default, on its grid and with room around', () => {
    const near = { x: 60, y: 90 }
    expect(freeSpot({ width: 100, height: 50 }, near, [], DEFAULT_AREA)).toEqual(near)
    const block = { x: 0, y: 0, width: 400, height: 200 }
    const spot = freeSpot({ width: 100, height: 50 }, near, [block], DEFAULT_AREA)
    // Below the block (y 210, 10 px clear of it) is nearer to (60,90) than right of it (x 410).
    expect(spot).toEqual({ x: 60, y: 210 })
  })
})

describe('the alerts band before the warning lights', () => {
  it('turns its engine warnings into the oil pressure it keeps', () => {
    const off = normalizeSettings({ alerts: { showEngineWarnings: false } }).alerts
    expect(off.showOilPressure).toBe(false)
    expect('showEngineWarnings' in off).toBe(false)
    expect(normalizeSettings({ alerts: { showEngineWarnings: true } }).alerts.showOilPressure).toBe(
      true
    )
    // A file with the new option keeps it; one without either gets the default.
    const both = { alerts: { showEngineWarnings: false, showOilPressure: true } }
    expect(normalizeSettings(both).alerts.showOilPressure).toBe(true)
    expect(normalizeSettings({ alerts: { showStalled: false } }).alerts.showOilPressure).toBe(true)
  })

  it('carries a trend turned off in the band to the lights, where it went', () => {
    const s = normalizeSettings({ alerts: { showEngineTrend: false } })
    expect(s.lights.showTrend).toBe(false)
    expect('showEngineTrend' in s.alerts).toBe(false)
    expect(normalizeSettings({ alerts: { showEngineTrend: true } }).lights.showTrend).toBe(true)
    // A file with the lights says what it wants of them.
    const both = { alerts: { showEngineTrend: false }, lights: { showTrend: true } }
    expect(normalizeSettings(both).lights.showTrend).toBe(true)
    expect(migrateSection('lights', undefined, { alerts: 'junk' })).toBeUndefined()
    expect(migrateSection('lights', undefined)).toBeUndefined()
  })

  it('keeps off in the lights every engine warning the band was told not to say', () => {
    // A file of the last release with the engine warnings and the trend off: the band still said
    // the damage, so the strip comes, with only the repairs (and the stall) of its engine lights.
    const raw = fileBeforeFuel()
    raw.alerts = { showEngineWarnings: false, showEngineTrend: false }
    const s = normalizeSettings(raw)
    expect(s.widgets.lights.visible).toBe(true)
    expect(s.lights.showTrend).toBe(false)
    expect(lightsOn(s)).toEqual(['stalled', 'repair', 'repairOptional'])
    expect(s.alerts.showOilPressure).toBe(false)
    // The damage off: both repair lights (the band said the optional ones too).
    const noDamage = normalizeSettings({ ...fileBeforeFuel(), alerts: { showDamage: false } })
    expect(lightsOn(noDamage)).not.toContain('repair')
    expect(lightsOn(noDamage)).not.toContain('repairOptional')
    expect(lightsOn(noDamage)).toContain('water')
    expect(noDamage.alerts.showDamage).toBe(false)
    expect(noDamage.widgets.lights.visible).toBe(true)
    // The stall off in the band stays off in the strip too.
    expect(lightsOn(normalizeSettings({ alerts: { showStalled: false } }))).not.toContain('stalled')
  })

  it('leaves the lights hidden for a band that showed none of what they took over', () => {
    // Every option that moved off: the strip would be new on screen.
    const raw = fileBeforeFuel()
    raw.alerts = { showEngineWarnings: false, showEngineTrend: false, showDamage: false }
    const s = normalizeSettings(raw)
    expect(s.widgets.lights.visible).toBe(false)
    // Still placed clear of the others, for the day it is turned on.
    expect(overlaps(s.widgets.lights.bounds, RACE_LAYOUT.radar as Rect)).toBe(false)
    expect(lightsOn(s)).not.toContain('water')
    expect(lightsOn(s)).not.toContain('repair')
    expect(s.lights.showTrend).toBe(false)

    // The whole band hidden: none of it was on screen, whatever its options.
    const hidden = fileBeforeFuel()
    ;(hidden.widgets as Record<string, Record<string, unknown>>).alerts = {
      visible: false,
      bounds: RACE_LAYOUT.alerts
    }
    const h = normalizeSettings(hidden)
    expect(h.widgets.alerts.visible).toBe(false)
    expect(h.widgets.lights.visible).toBe(false)
    expect(h.lights).toEqual(createDefaultSettings().lights)

    // A band shown with one of them on keeps the strip coming; a file with the lights, its own.
    hidden.alerts = { showEngineWarnings: false, showEngineTrend: true, showDamage: false }
    ;(hidden.widgets as Record<string, Record<string, unknown>>).alerts = {
      visible: true,
      bounds: RACE_LAYOUT.alerts
    }
    expect(normalizeSettings(hidden).widgets.lights.visible).toBe(true)
    ;(hidden.widgets as Record<string, unknown>).lights = { visible: true }
    hidden.alerts = { showEngineWarnings: false, showEngineTrend: false, showDamage: false }
    expect(normalizeSettings(hidden).widgets.lights.visible).toBe(true)
  })
})

describe('the element lists from the options they replaced (v2.6)', () => {
  const ids = (list: readonly { id: string; visible: boolean }[]): string[] =>
    list.filter((e) => e.visible).map((e) => e.id)

  it('a file with every old toggle at its default draws exactly the new defaults', () => {
    const d = createDefaultSettings()
    const old = {
      relative: {
        showClassPosition: true,
        showLicense: true,
        showIRating: true,
        showStint: false,
        showTyre: false,
        showIncidents: true,
        conditionsFooter: false,
        conditionsTrackTemp: true,
        conditionsWet: true,
        conditionsWind: true,
        conditionsAirTemp: true,
        conditionsRubber: true
      },
      radar: { showRangeLabels: true },
      standings: {
        headerIRating: true,
        headerSafetyRating: true,
        headerIncidents: true,
        showSof: true,
        showCarCount: true,
        conditionsFooter: true,
        conditionsTrackTemp: true
      },
      battle: {
        showAhead: true,
        showBehind: true,
        detail: 'sectors',
        showPrediction: true,
        showIRatingAtStake: true
      },
      inputs: {
        layout: 'trace-bars-info',
        showClutch: true,
        showSteering: true,
        showGearSpeed: true
      },
      traffic: { showFaster: true, showSlower: true, showHazards: true },
      delta: { reference: 'pb', showPredicted: true, showSectors: true, showTrend: true },
      fuel: { showHeader: false, showGauge: true, showPerLap: true, showWindow: true },
      lights: { showOilPressure: true, showPitLimiter: false, showRevLimiter: false }
    }
    const s = normalizeSettings({ ...old, version: 5 })
    // What came after those toggles stays off: the pedals' car block and shift lights, the
    // repair's crew-time tag.
    const expected = {
      ...d,
      inputs: {
        ...d.inputs,
        sections: setElementVisible(d.inputs.sections, 'car', false),
        shiftLights: false
      },
      lights: { ...d.lights, repairCrewTag: false },
      // Their old switches draw the bars they drew then (migrateOldBars), not R13's defaults.
      relative: {
        ...d.relative,
        ...(keepBeforeFewerDefaults(
          'relative',
          migrateOldBars('relative', {}, { version: 4 })
        ) as object)
      },
      standings: {
        ...d.standings,
        ...(keepBeforeFewerDefaults(
          'standings',
          migrateOldBars('standings', {}, { version: 4 })
        ) as object)
      },
      // R30 is for a new install only: a fuel section of before keeps every line.
      fuel: { ...d.fuel, ...(keepBeforeFewerDefaults('fuel', {}) as object) },
      // What the «Piloto» block added stays off (migrateDriverBlock).
      battle: { ...d.battle, showFlags: false, countryFlags: false },
      traffic: { ...d.traffic, brandMarks: 'off', countryFlags: false, showFlags: false }
    }
    for (const section of Object.keys(old) as (keyof typeof old)[]) {
      expect(s[section], section).toEqual(expected[section])
    }
  })

  it('carries every old toggle into its list', () => {
    const s = normalizeSettings({
      relative: { showClassPosition: false, showStint: true, showIncidents: false },
      radar: { showRangeLabels: false },
      standings: { headerIRating: false, headerIncidents: false, showSof: false },
      battle: { showBehind: false, showIRatingAtStake: false },
      traffic: { showHazards: false },
      delta: { showSectors: false, showTrend: false },
      fuel: { showGauge: false, showLimits: false },
      lights: { showWater: false, showPitLimiter: true }
    })
    expect(ids(s.relative.columns)).toEqual(['driver', 'ir', 'lic', 'stint', 'gap'])
    expect(ids(s.relative.headerBar)).toEqual(['title', 'session', 'split'])
    expect(ids(s.radar.parts)).toEqual(['guides', 'sideAlerts'])
    expect(ids(s.standings.headerBar)).toEqual(['session', 'carCount', 'split', 'remaining'])
    expect(ids(s.standings.classLine)).toEqual(['carCount'])
    expect(ids(s.standings.subheaderBar)).toEqual(['fastestLap', 'split', 'safetyRating'])
    expect(ids(s.battle.lanes)).toEqual(['ahead'])
    expect(ids(s.battle.parts)).toEqual(['rating', 'license', 'trendNote'])
    expect(ids(s.traffic.groups)).toEqual(['slower', 'faster'])
    expect(ids(s.delta.rows)).toEqual(['top', 'bar'])
    expect(ids(s.delta.top)).toEqual(['predicted', 'reference'])
    expect(ids(s.fuel.lines)).toEqual(['hero', 'perLap', 'finish', 'window', 'save', 'tyres'])
    expect(ids(s.lights.icons)).not.toContain('water')
    expect(ids(s.lights.icons)).toContain('pitLimiter')
  })

  it('the conditions footers become the footer bars, the switch their size', () => {
    const s = normalizeSettings({
      relative: { conditionsFooter: true, conditionsWind: false, conditionsTrend: false },
      standings: { conditionsFooter: false, conditionsRubber: false }
    })
    expect(s.relative.footerBarSize).toBe('normal')
    expect(ids(s.relative.footerBar)).toEqual(['trackTemp', 'wet', 'airTemp', 'rubber', 'split'])
    expect(s.relative.conditionsTrend).toBe(false)
    expect(s.standings.footerBarSize).toBe('off')
    expect(ids(s.standings.footerBar)).toEqual(['trackTemp', 'wet', 'wind', 'airTemp', 'split'])
    // The fuel's header switch, its bar's size.
    expect(normalizeSettings({ fuel: { showHeader: true } }).fuel.headerBarSize).toBe('normal')
  })

  it('the three layouts of the pedals, the four details of the battle, with the prediction', () => {
    const order = (layout: string): string[] =>
      normalizeSettings({ inputs: { layout } }).inputs.sections.map(
        (e) => `${e.visible ? '+' : '-'}${e.id}`
      )
    // The car block came later: hidden in a file of then.
    expect(order('trace-bars-info')).toEqual(['+trace', '+bars', '+info', '-car'])
    expect(order('info-bars-trace')).toEqual(['+info', '+bars', '+trace', '-car'])
    expect(order('bars')).toEqual(['-trace', '+bars', '+info', '-car'])
    // No old layout (and no list): the default blocks, the car block hidden all the same.
    expect(order('sideways')).toEqual(['+trace', '+bars', '+info', '-car'])
    for (const [detail, sectors, laps] of [
      ['none', false, false],
      ['sectors', true, false],
      ['laps', false, true],
      ['both', true, true]
    ] as const) {
      for (const showPrediction of [true, false]) {
        const rows = normalizeSettings({ battle: { detail, showPrediction } }).battle.rows
        expect(rows, `${detail} ${showPrediction}`).toEqual([
          { id: 'prediction', visible: showPrediction },
          { id: 'sectors', visible: sectors },
          { id: 'laps', visible: laps }
        ])
      }
    }
    // Gear and speed were one toggle.
    expect(ids(normalizeSettings({ inputs: { showGearSpeed: false } }).inputs.info)).toEqual([
      'steering'
    ])
  })

  it("the traffic's title band and captions (2.1.1's header list): its header bar and a switch", () => {
    const traffic = (header: unknown): OverlaySettings['traffic'] =>
      normalizeSettings({ traffic: { header } }).traffic
    const both = traffic([
      { id: 'title', visible: true },
      { id: 'captions', visible: true }
    ])
    expect(both.headerBarSize).toBe('normal')
    expect(both.captions).toBe(true)
    expect(both.headerBar).toEqual(createDefaultSettings().traffic.headerBar)
    expect(both.footerBarSize).toBe('off')
    const none = traffic([
      { id: 'captions', visible: false },
      { id: 'title', visible: false }
    ])
    expect(none.headerBarSize).toBe('off')
    expect(none.captions).toBe(false)
    // Read as that version read its list: a missing id was hidden, junk was the default.
    expect(traffic([{ id: 'captions', visible: true }]).headerBarSize).toBe('off')
    expect(traffic([{ id: 'nope', visible: false }]).headerBarSize).toBe('normal')
    expect(traffic('junk').headerBarSize).toBe('normal')
    // A file written since has the new fields: the old list, a leftover, is ignored.
    const since = normalizeSettings({
      traffic: {
        header: [{ id: 'title', visible: false }],
        headerBarSize: 'small',
        captions: true
      }
    }).traffic
    expect(since.headerBarSize).toBe('small')
    expect(since.captions).toBe(true)
    expect('header' in since).toBe(false)
  })

  it("keeps the traffic's old Cabecera accordion open or closed under its header bar", () => {
    const open = (list: unknown): string[] =>
      normalizeSettings({ settingsWindow: { customizeOpen: list } })
        .settingsWindow.customizeOpen.filter((e) => e.visible)
        .map((e) => e.id)
    expect(open([{ id: 'traffic.header', visible: true }])).toEqual(['traffic.headerBar'])
    expect(open([{ id: 'traffic.header', visible: false }])).toEqual([])
    // Written since: the new id wins, the old one is a leftover.
    expect(
      open([
        { id: 'traffic.header', visible: true },
        { id: 'traffic.headerBar', visible: false }
      ])
    ).toEqual([])
    expect(migrateCustomizeOpen({ customizeOpen: 'junk' })).toEqual({ customizeOpen: 'junk' })
  })

  it('a file from before the new bars draws the battle, the traffic and the fuel as it did', () => {
    const s = normalizeSettings({ battle: { thresholdS: 2 }, traffic: {}, fuel: { avgLaps: 4 } })
    expect(s.battle.headerBarSize).toBe('off')
    expect(s.battle.footerBarSize).toBe('off')
    expect(s.fuel.headerBarSize).toBe('off')
    expect(s.fuel.footerBarSize).toBe('off')
    expect(s.traffic.headerBarSize).toBe('normal')
    expect(s.traffic.footerBarSize).toBe('off')
    expect(s.traffic.captions).toBe(true)
  })

  it('a file that has the list keeps it: the old fields are ignored', () => {
    const columns = [{ id: 'gap', visible: true }]
    const s = normalizeSettings({ relative: { columns, showClassPosition: true } })
    expect(s.relative.columns[0]).toEqual({ id: 'gap', visible: true })
    expect(s.relative.columns.find((e) => e.id === 'pos')?.visible).toBe(false)
  })
})

describe('version 5: new defaults over old saved ones, once', () => {
  const licence = (raw: Record<string, unknown>): string =>
    normalizeSettings(raw).appearance.licenseStyle

  it('the old default licence becomes the outline; a choice stays; a v5 file keeps soft', () => {
    expect(licence({ version: 4, appearance: { licenseStyle: 'soft' } })).toBe('outline')
    expect(licence({ appearance: { licenseStyle: 'soft' } })).toBe('outline')
    expect(licence({ version: 4, appearance: { licenseStyle: 'solid' } })).toBe('solid')
    expect(licence({ version: 5, appearance: { licenseStyle: 'soft' } })).toBe('soft')
  })

  it('the pedals fit their content: a v4 file had no auto height to give them', () => {
    const bounds = { x: 820, y: 860, width: 360, height: 120 }
    const v4 = normalizeSettings({
      version: 4,
      widgets: { inputs: { visible: true, bounds, autoHeight: false } }
    })
    expect(v4.widgets.inputs.autoHeight).toBe(true)
    expect(v4.widgets.inputs.bounds).toEqual(bounds)
    const v5 = normalizeSettings({
      version: 5,
      widgets: { inputs: { visible: true, bounds, autoHeight: false } }
    })
    expect(v5.widgets.inputs.autoHeight).toBe(false)
  })

  it('the delta: the old single default gives the per-session defaults, a choice every kind', () => {
    expect(normalizeSettings({ delta: { reference: 'pb' } }).delta).toMatchObject({
      referencePractice: 'pb',
      referenceQualify: 'optimal',
      referenceRace: 'optimal'
    })
    expect(normalizeSettings({ delta: { reference: 'classOptimal' } }).delta).toMatchObject({
      referencePractice: 'classOptimal',
      referenceQualify: 'classOptimal',
      referenceRace: 'classOptimal'
    })
    // A bad old value: the defaults.
    expect(normalizeSettings({ delta: { reference: 'fastest' } }).delta.referenceRace).toBe(
      'optimal'
    )
  })
})

describe('the warning lights before the crew-time tag', () => {
  it('keeps the tag off for a saved lights section of before, on when new or chosen', () => {
    const old = normalizeSettings({ version: 5, lights: { repairRealTime: false } })
    expect(old.lights.repairCrewTag).toBe(false)
    expect(normalizeSettings({ lights: { repairCrewTag: true } }).lights.repairCrewTag).toBe(true)
    // A new install, and a file from before the lights (its strip is new anyway).
    expect(normalizeSettings({}).lights.repairCrewTag).toBe(true)
    expect(normalizeSettings({ version: 5, alerts: {} }).lights.repairCrewTag).toBe(true)
    // Lossless: what a load writes loads the same.
    expect(normalizeSettings(JSON.parse(JSON.stringify(old))).lights).toEqual(old.lights)
  })
})

describe('the pedals before the wheel styles and the shift lights', () => {
  it('the old wheel is the realistic one; the shift lights stay off for a file of before', () => {
    const old = normalizeSettings({
      version: 5,
      inputs: { steeringStyle: 'wheel', traceSeconds: 6 }
    })
    expect(old.inputs).toMatchObject({ steeringStyle: 'realistic', shiftLights: false })
    expect(normalizeSettings({ inputs: { steeringStyle: 'bar' } }).inputs.steeringStyle).toBe('bar')
    // Written since: kept as chosen.
    const now = normalizeSettings({ inputs: { steeringStyle: 'formula', shiftLights: true } })
    expect(now.inputs).toMatchObject({ steeringStyle: 'formula', shiftLights: true })
    // No pedals section at all: the defaults (a new install).
    expect(normalizeSettings({}).inputs.shiftLights).toBe(true)
  })

  it('the car block and its readouts come hidden in a saved list of before, shown when new', () => {
    const before = normalizeSettings({
      inputs: {
        sections: [
          { id: 'trace', visible: true },
          { id: 'bars', visible: true },
          { id: 'info', visible: true }
        ],
        shiftLights: false
      }
    })
    expect(before.inputs.sections.at(-1)).toEqual({ id: 'car', visible: false })
    expect(normalizeSettings({}).inputs.sections.map((e) => e.visible)).toEqual([
      true,
      true,
      true,
      true
    ])
    expect(normalizeSettings({}).inputs.car.every((e) => e.visible)).toBe(true)
  })

  it('reads the same twice (one-way)', () => {
    const once = normalizeSettings({ inputs: { steeringStyle: 'wheel' } })
    expect(normalizeSettings(JSON.parse(JSON.stringify(once)))).toEqual(once)
  })
})

describe('the relative before it followed the density (2.3, R05)', () => {
  it('keeps its comfortable rows in a file whose global density is compact', () => {
    const file = { version: 6, appearance: { density: 'compact' }, relative: { carsAhead: 3 } }
    expect(migrateRelativeDensity(file.relative, file)).toEqual({
      carsAhead: 3,
      density: 'comfortable'
    })
    expect(migrateRelativeDensity(undefined, file)).toEqual({ density: 'comfortable' })
    const s = normalizeSettings(file)
    expect(s.relative.density).toBe('comfortable')
    expect(s.relative.carsAhead).toBe(3)
  })

  it('changes nothing with the comfortable density, or a density the file chose', () => {
    const comfortable = { appearance: { density: 'comfortable' }, relative: {} }
    expect(migrateRelativeDensity(comfortable.relative, comfortable)).toBe(comfortable.relative)
    expect(normalizeSettings(comfortable).relative.density).toBe('inherit')
    const chosen = { appearance: { density: 'compact' }, relative: { density: 'inherit' } }
    expect(migrateRelativeDensity(chosen.relative, chosen)).toBe(chosen.relative)
    expect(normalizeSettings(chosen).relative.density).toBe('inherit')
    // A new install writes the density: it loads as it was saved.
    const fresh = createDefaultSettings()
    fresh.appearance.density = 'compact'
    expect(normalizeSettings(JSON.parse(JSON.stringify(fresh))).relative.density).toBe('inherit')
  })
})

describe('migrateRelativeColumns (R10)', () => {
  const L = (spec: string): { id: string; visible: boolean }[] =>
    spec.split(' ').map((s) => ({ id: s.replace('-', ''), visible: !s.startsWith('-') }))

  it('gives an untouched list today’s default (iRating before the licence)', () => {
    const s = normalizeSettings({ relative: { columns: L('pos driver lic ir -tyre -stint gap') } })
    expect(s.relative.columns.map((e) => e.id).slice(0, 4)).toEqual(['pos', 'driver', 'ir', 'lic'])
  })

  it('keeps a list of its own, the new PIT column hidden at its end', () => {
    const own = L('pos driver lic ir tyre -stint gap')
    const s = normalizeSettings({ relative: { columns: own } })
    expect(s.relative.columns).toEqual([...own, { id: 'pit', visible: false }])
  })

  it('gives each saved layout its own columns, never the options in effect', () => {
    type Cols = OverlaySettings['relative']['columns']
    const custom = L('gap driver -pos lic ir tyre stint') as Cols
    const base = JSON.parse(JSON.stringify(createDefaultSettings())) as OverlaySettings
    base.relative.columns = custom
    const a = base.savedLayouts.list[0]
    if (a?.options === undefined) throw new Error('a full layout')
    a.options.sections.relative.columns = custom
    const b = JSON.parse(JSON.stringify(a)) as typeof a
    b.id = 'bbbbbbbb-0000-4000-8000-000000000000'
    b.name = 'B'
    if (b.options === undefined) throw new Error('a full layout')
    b.options.sections.relative.columns = L('pos driver lic ir -tyre -stint gap') as Cols
    base.savedLayouts.list.push(b)
    const s = normalizeSettings(JSON.parse(JSON.stringify(base)))
    const ids = (cols: readonly { id: string; visible: boolean }[] | undefined): string[] =>
      (cols ?? []).map((e) => `${e.visible ? '' : '-'}${e.id}`)
    const lb = s.savedLayouts.list.find((l) => l.name === 'B')
    expect(ids(lb?.options?.sections.relative.columns)).toEqual(
      ids(OPTION_SCHEMA.relative.columns.default)
    )
    expect(ids(s.relative.columns)).toEqual([...ids(custom), '-pit'])
  })

  it('puts the gap before the pit, stint and tyre of an untouched list, as the standings', () => {
    const s = normalizeSettings({
      relative: { columns: L('pos driver ir lic -pit -tyre -stint gap') }
    })
    expect(s.relative.columns).toEqual(L('pos driver ir lic gap -pit -stint -tyre'))
    // One with a column shown keeps its order (it is what it draws).
    const own = L('pos driver ir lic -pit tyre -stint gap')
    expect(normalizeSettings({ relative: { columns: own } }).relative.columns).toEqual(own)
    // An old file's switches too: its tyre stays before the gap.
    const old = normalizeSettings({ version: 4, relative: { showTyre: true } }).relative.columns
    expect(old.filter((e) => e.visible).map((e) => e.id)).toEqual([
      'pos',
      'driver',
      'ir',
      'lic',
      'tyre',
      'gap'
    ])
  })

  it('orders the columns both tables have the same way by default (R10)', () => {
    const relative = OPTION_SCHEMA.relative.columns.default.map((e) => e.id as string)
    const standings = OPTION_SCHEMA.standings.columns.default.map((e) => e.id as string)
    const shared = (a: string[], b: string[]): string[] => a.filter((id) => b.includes(id))
    expect(shared(relative, standings)).toEqual(shared(standings, relative))
  })

  it('writes the new default out, so no fallback can stand in for it', () => {
    const out = migrateRelativeColumns({
      carsAhead: 2,
      columns: L('pos driver lic ir -tyre -stint gap')
    }) as Record<string, unknown>
    expect(out.carsAhead).toBe(2)
    expect(out.columns).toEqual(OPTION_SCHEMA.relative.columns.default)
  })
})

describe('migrateOldBars (R13: new defaults for new installs only)', () => {
  const shown = (l: unknown): string[] =>
    (l as { id: string; visible: boolean }[]).filter((e) => e.visible).map((e) => e.id)

  it('gives a section of a file from before the bars were lists the bars it drew then', () => {
    const r = migrateOldBars('relative', { carsAhead: 4 }, { version: 4 })
    expect(shown(r.headerBar)).toEqual(['title', 'session', 'split', 'incidents'])
    const st = migrateOldBars('standings', {}, { version: 3 })
    expect(shown(st.headerBar)).toEqual([
      'session',
      'sof',
      'carCount',
      'split',
      'incidents',
      'remaining'
    ])
    // Its old switch on top: the incidents off.
    const off = migrateOldBars('relative', { showIncidents: false }, { version: 5 })
    expect(shown(off.headerBar)).toEqual(['title', 'session', 'split'])
  })

  it('leaves a list of its own, a file of today and a section without bars alone', () => {
    const own = [{ id: 'clock', visible: true }]
    const raw = { headerBar: own }
    expect(migrateOldBars('relative', raw, { version: 4 })).toBe(raw)
    const today = { carsAhead: 3 }
    expect(migrateOldBars('relative', today, { version: 6 })).toBe(today)
    expect(migrateOldBars('radar', today, { version: 4 })).toBe(today)
  })

  it('reads a file with no version as old, as the rest of the migrations do', () => {
    const r = migrateOldBars('relative', { carsAhead: 4 }, {})
    expect(shown(r.headerBar)).toEqual(['title', 'session', 'split', 'incidents'])
    const odd = migrateOldBars('relative', {}, { version: 'x' })
    expect(shown(odd.headerBar)).toEqual(['title', 'session', 'split', 'incidents'])
  })
})

describe('fewer figures by default, for a new install only (R30)', () => {
  const visible = (l: readonly { id: string; visible: boolean }[]): string[] =>
    l.filter((e) => e.visible).map((e) => e.id)

  it('a new install: no second header line, no air or rubber, no tyres or limits', () => {
    const d = createDefaultSettings()
    expect(d.standings.subheaderBarSize).toBe('off')
    expect(visible(d.standings.footerBar)).toEqual([
      'trackTemp',
      'wet',
      'wind',
      'split',
      'carCount'
    ])
    expect(visible(d.relative.footerBar)).toEqual(['trackTemp', 'wet', 'wind', 'split'])
    expect(visible(d.fuel.lines)).toEqual(['hero', 'gauge', 'perLap', 'finish', 'window', 'save'])
    // Still in the lists, one click away.
    expect(d.fuel.lines.map((e) => e.id)).toContain('tyres')
    expect(d.standings.footerBar.map((e) => e.id)).toContain('airTemp')
  })

  it('a file keeps what it saved, the old defaults included', () => {
    const before = normalizeSettings({
      version: 6,
      standings: {
        subheaderBarSize: 'normal',
        footerBar: createDefaultSettings().standings.footerBar
      },
      fuel: { lines: [{ id: 'tyres', visible: true }] }
    })
    expect(before.standings.subheaderBarSize).toBe('normal')
    expect(visible(before.fuel.lines)).toContain('tyres')
    // An explicit choice of the new look stays too.
    expect(
      normalizeSettings({ standings: { subheaderBarSize: 'off' } }).standings.subheaderBarSize
    ).toBe('off')
  })

  it('a section saved without those fields draws as that version did', () => {
    const s = normalizeSettings({ version: 6, standings: { topRows: 4 }, fuel: { avgLaps: 3 } })
    expect(s.standings.subheaderBarSize).toBe('normal')
    expect(visible(s.standings.footerBar)).toEqual([
      'trackTemp',
      'wet',
      'wind',
      'airTemp',
      'rubber',
      'split',
      'carCount'
    ])
    expect(visible(s.fuel.lines)).toHaveLength(8)
    // A section the file never saved takes the new defaults.
    expect(normalizeSettings({ version: 6, radar: {} }).standings.subheaderBarSize).toBe('off')
    // Not a layout's section: a field it lacks follows the options in effect.
    expect(keepBeforeFewerDefaults('battle', { holdS: 2 })).toEqual({ holdS: 2 })
  })

  it('reads the old switches over the list that version drew', () => {
    const s = normalizeSettings({ fuel: { showLimits: false } })
    expect(visible(s.fuel.lines)).toContain('tyres')
    expect(visible(s.fuel.lines)).not.toContain('limits')
  })
})
