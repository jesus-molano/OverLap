import { describe, expect, it } from 'vitest'
import type { Rect } from '../types'
import { ALERTS_DEFAULT_ROOM, WIDGET_DEFS, WIDGET_IDS, type WidgetId } from '../widgets'
import { createDefaultSettings, normalizeSettings } from '.'
import {
  DEFAULT_AREA,
  HIDDEN_WHEN_ADDED,
  SHOWN_WHEN_ADDED,
  freeSpot,
  migrateSection
} from './migrate'

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

/**
 * A layout like the one raced at Lime Rock (report Q5), from before the conditions widget:
 * the standings moved to the top left, right where the conditions default (60,90 320x130) is.
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

/** A saved file with every widget of RACE_LAYOUT and nothing for the conditions widget. */
function fileBeforeConditions(): Record<string, unknown> {
  const widgets: Record<string, unknown> = {}
  for (const [id, bounds] of Object.entries(RACE_LAYOUT)) widgets[id] = { visible: true, bounds }
  return { version: 4, widgets }
}

describe('a widget newer than the settings file (Q5)', () => {
  it('starts the conditions widget hidden, in a free spot near its default, covering nothing', () => {
    expect(HIDDEN_WHEN_ADDED).toEqual(['conditions', 'fuel'])
    const def = WIDGET_DEFS.conditions.defaultBounds
    expect(overlaps(def, RACE_LAYOUT.standings as Rect)).toBe(true)

    const s = normalizeSettings(fileBeforeConditions())
    const c = s.widgets.conditions
    expect(c.visible).toBe(false)
    expect(c.bounds).toEqual({ x: 60, y: 300, width: def.width, height: def.height })
    for (const id of WIDGET_IDS) {
      if (id === 'conditions') continue
      const b = s.widgets[id].bounds
      const room = id === 'alerts' ? { ...b, height: Math.max(b.height, ALERTS_DEFAULT_ROOM) } : b
      expect(overlaps(c.bounds, room), id).toBe(false)
    }
    // The others keep what the file says.
    expect(s.widgets.standings.bounds).toEqual(RACE_LAYOUT.standings)
    expect(s.widgets.standings.visible).toBe(true)
  })

  it('keeps what a file that has it says, and leaves a fresh start alone', () => {
    const raw = fileBeforeConditions()
    const saved = { x: 18, y: 469, width: 320, height: 101 }
    ;(raw.widgets as Record<string, unknown>).conditions = { visible: true, bounds: saved }
    const s = normalizeSettings(raw)
    expect(s.widgets.conditions.visible).toBe(true)
    expect(s.widgets.conditions.bounds).toEqual(saved)

    // No file, an empty one, or one without any widget saved: the defaults (shown).
    const defaults = createDefaultSettings().widgets.conditions
    for (const r of [undefined, {}, { version: 4 }, { widgets: {} }, { widgets: { nope: {} } }]) {
      expect(normalizeSettings(r).widgets.conditions, JSON.stringify(r)).toEqual(defaults)
    }
  })

  it('keeps the default place when no spot is free', () => {
    const wall = { x: 0, y: 0, width: 1920, height: 1080 }
    expect(freeSpot({ width: 320, height: 130 }, { x: 60, y: 90 }, [wall], DEFAULT_AREA)).toBeNull()
    const s = normalizeSettings({ widgets: { standings: { visible: true, bounds: wall } } })
    expect(s.widgets.conditions.visible).toBe(false)
    expect(s.widgets.conditions.bounds).toEqual(WIDGET_DEFS.conditions.defaultBounds)
  })

  it('places the fuel widget of a file from before it the same way', () => {
    // The same layout once the conditions widget was placed, saved before the fuel widget: its
    // default (bottom right) sits on the relative moved there.
    const raw = fileBeforeConditions()
    const conditions = { x: 60, y: 300, width: 320, height: 130 }
    ;(raw.widgets as Record<string, unknown>).conditions = { visible: true, bounds: conditions }
    const def = WIDGET_DEFS.fuel.defaultBounds
    expect(overlaps(def, RACE_LAYOUT.relative as Rect)).toBe(true)

    const s = normalizeSettings(raw)
    const f = s.widgets.fuel
    expect(f.visible).toBe(false)
    expect(f.bounds).toMatchObject({ width: def.width, height: def.height })
    for (const id of WIDGET_IDS) {
      if (id === 'fuel') continue
      const b = s.widgets[id].bounds
      const room = id === 'alerts' ? { ...b, height: Math.max(b.height, ALERTS_DEFAULT_ROOM) } : b
      expect(overlaps(f.bounds, room), id).toBe(false)
    }
    // The conditions widget the file has stays as it was.
    expect(s.widgets.conditions).toMatchObject({ visible: true, bounds: conditions })
    // A fresh start shows it where it belongs.
    expect(normalizeSettings({}).widgets.fuel).toEqual(createDefaultSettings().widgets.fuel)
  })

  it('shows the warning lights of a file from before them, in a free spot near their default', () => {
    expect(SHOWN_WHEN_ADDED).toEqual(['lights'])
    // Their default (under the delta) sits on the radar and the alerts moved there.
    const def = WIDGET_DEFS.lights.defaultBounds
    expect(overlaps(def, RACE_LAYOUT.radar as Rect)).toBe(true)

    const s = normalizeSettings(fileBeforeConditions())
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
    const raw = fileBeforeConditions()
    const saved = { x: 100, y: 900, width: 200, height: 40 }
    ;(raw.widgets as Record<string, unknown>).lights = { visible: false, bounds: saved }
    expect(normalizeSettings(raw).widgets.lights).toMatchObject({ visible: false, bounds: saved })
    expect(normalizeSettings({}).widgets.lights).toEqual(createDefaultSettings().widgets.lights)
  })

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
})
