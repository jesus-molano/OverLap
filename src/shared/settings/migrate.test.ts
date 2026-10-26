import { describe, expect, it } from 'vitest'
import type { Rect } from '../types'
import { ALERTS_DEFAULT_ROOM, WIDGET_DEFS, WIDGET_IDS, type WidgetId } from '../widgets'
import { createDefaultSettings, normalizeSettings } from '.'
import {
  DEFAULT_AREA,
  HIDDEN_WHEN_ADDED,
  REMOVED_WIDGETS,
  SHOWN_WHEN_ADDED,
  freeSpot,
  migrateSection
} from './migrate'

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
    expect(s.standings.conditionsFooter).toBe(true)
    expect(s.relative.conditionsFooter).toBe(false)
    // The old widget's choices are not carried over: it showed a panel that no longer exists.
    expect(s.standings.conditionsWind).toBe(true)
    expect(s.relative.conditionsWind).toBe(true)
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
    expect(s.lights).toMatchObject({
      showOilPressure: false,
      showFuelPressure: false,
      showWater: false,
      showOilTemp: false,
      showTrend: false,
      showStalled: true,
      showRepair: true,
      showRepairOptional: true
    })
    expect(s.alerts.showOilPressure).toBe(false)
    // The damage off: both repair lights (the band said the optional ones too).
    const noDamage = normalizeSettings({ ...fileBeforeFuel(), alerts: { showDamage: false } })
    expect(noDamage.lights).toMatchObject({
      showRepair: false,
      showRepairOptional: false,
      showWater: true
    })
    expect(noDamage.alerts.showDamage).toBe(false)
    expect(noDamage.widgets.lights.visible).toBe(true)
    // The stall off in the band stays off in the strip too.
    expect(normalizeSettings({ alerts: { showStalled: false } }).lights.showStalled).toBe(false)
  })

  it('leaves the lights hidden for a band that showed none of what they took over', () => {
    // Every option that moved off: the strip would be new on screen.
    const raw = fileBeforeFuel()
    raw.alerts = { showEngineWarnings: false, showEngineTrend: false, showDamage: false }
    const s = normalizeSettings(raw)
    expect(s.widgets.lights.visible).toBe(false)
    // Still placed clear of the others, for the day it is turned on.
    expect(overlaps(s.widgets.lights.bounds, RACE_LAYOUT.radar as Rect)).toBe(false)
    expect(s.lights).toMatchObject({ showWater: false, showRepair: false, showTrend: false })

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
