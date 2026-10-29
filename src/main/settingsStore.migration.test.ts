import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, SETTINGS_VERSION } from '@shared/settings'
import { SettingsStore } from './settingsStore'

let dir: string
let file: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'overlay-settings-migration-'))
  file = join(dir, 'settings.json')
})

afterEach(() => rmSync(dir, { recursive: true, force: true }))

const NEW_IN_V3 = ['standings', 'battle', 'inputs'] as const

/** Loads `raw` from disk, saves after a change and checks the file round-trips. */
function roundTrip(raw: unknown, mutate: Parameters<SettingsStore['update']>[0]): unknown {
  writeFileSync(file, JSON.stringify(raw))
  const store = SettingsStore.load(file)
  store.update(mutate)
  expect(store.flush()).toBe(true)
  const saved: unknown = JSON.parse(readFileSync(file, 'utf8'))
  expect(SettingsStore.load(file).settings).toEqual(store.settings)
  return saved
}

describe('SettingsStore with a v1 file', () => {
  const v1 = {
    version: 1,
    widgets: {
      relative: { visible: false, bounds: { x: 100, y: 200, width: 500, height: 300 } },
      radar: { visible: true, bounds: { x: 700, y: 200, width: 240, height: 280 } }
    },
    relative: { carsAhead: 4, carsBehind: 2 },
    radar: { rangeM: 30 }
  }

  it('keeps the saved values and adds every newer default', () => {
    writeFileSync(file, JSON.stringify(v1))
    const s = SettingsStore.load(file).settings
    expect(s.version).toBe(SETTINGS_VERSION)
    expect(s.widgets.relative).toEqual({
      ...DEFAULT_SETTINGS.widgets.relative,
      visible: false,
      bounds: { x: 100, y: 200, width: 500, height: 300 }
    })
    expect(s.relative).toEqual({ ...DEFAULT_SETTINGS.relative, carsAhead: 4, carsBehind: 2 })
    expect(s.radar).toEqual({ ...DEFAULT_SETTINGS.radar, rangeM: 30 })
    expect(s.appearance).toEqual(DEFAULT_SETTINGS.appearance)
    for (const id of NEW_IN_V3) {
      expect(s.widgets[id]).toEqual(DEFAULT_SETTINGS.widgets[id])
      expect(s[id]).toEqual(DEFAULT_SETTINGS[id])
    }
  })

  it('saves as the current version', () => {
    const saved = roundTrip(v1, (d) => {
      d.widgets.radar.locked = true
    }) as { version: number; widgets: { radar: { locked: boolean } } }
    expect(saved.version).toBe(SETTINGS_VERSION)
    expect(saved.widgets.radar.locked).toBe(true)
  })
})

describe('SettingsStore with a v2 file', () => {
  const v2 = {
    version: 2,
    widgets: {
      relative: {
        visible: true,
        bounds: { x: 100, y: 200, width: 500, height: 300 },
        locked: true,
        backgroundOpacity: 0.4
      },
      radar: {
        visible: false,
        bounds: { x: 700, y: 200, width: 240, height: 280 },
        locked: false,
        backgroundOpacity: 0.9
      }
    },
    relative: {
      carsAhead: 4,
      carsBehind: 2,
      showClassPosition: false,
      showLicense: true,
      showIRating: false
    },
    radar: { rangeM: 30, showRangeLabels: false }
  }

  it('keeps every v2 value and adds the newer widgets, fields and sections', () => {
    writeFileSync(file, JSON.stringify(v2))
    const s = SettingsStore.load(file).settings
    expect(s.version).toBe(SETTINGS_VERSION)
    expect(s.widgets.relative).toEqual({
      ...DEFAULT_SETTINGS.widgets.relative,
      ...v2.widgets.relative
    })
    expect(s.widgets.radar).toEqual({ ...DEFAULT_SETTINGS.widgets.radar, ...v2.widgets.radar })
    // Its column flags became the row's list, the labels flag the radar's parts.
    expect(s.relative).toEqual({
      ...DEFAULT_SETTINGS.relative,
      carsAhead: 4,
      carsBehind: 2,
      columns: DEFAULT_SETTINGS.relative.columns.map((c) => ({
        ...c,
        visible: c.visible && c.id !== 'pos' && c.id !== 'ir'
      }))
    })
    expect(s.radar).toEqual({
      rangeM: 30,
      parts: DEFAULT_SETTINGS.radar.parts.map((p) => ({ ...p, visible: p.id !== 'rangeLabels' }))
    })
    for (const id of NEW_IN_V3) {
      expect(s.widgets[id]).toEqual(DEFAULT_SETTINGS.widgets[id])
      expect(s[id]).toEqual(DEFAULT_SETTINGS[id])
    }
  })

  it('saves clamped values as the current version', () => {
    const saved = roundTrip(v2, (d) => {
      d.standings.mode = 'full'
      d.battle.thresholdS = 2.04
    }) as {
      version: number
      standings: { mode: string }
      battle: { thresholdS: number }
      widgets: { inputs: unknown }
    }
    expect(saved.version).toBe(SETTINGS_VERSION)
    expect(saved.standings.mode).toBe('full')
    expect(saved.battle.thresholdS).toBe(2)
    expect(saved.widgets.inputs).toEqual(DEFAULT_SETTINGS.widgets.inputs)
  })
})

describe('SettingsStore with a v3 file', () => {
  const v3 = {
    version: 3,
    widgets: {
      standings: {
        visible: true,
        bounds: { x: 1300, y: 100, width: 480, height: 500 },
        locked: false,
        backgroundOpacity: 0.6
      }
    },
    standings: {
      mode: 'full',
      topRows: 2,
      aroundRows: 4,
      otherClassLeaders: false,
      gapMode: 'leader',
      showPositionsGained: false,
      showIRating: true,
      showIRatingDelta: true,
      showLastLap: false,
      showPits: true,
      showRatingsHeader: false
    },
    battle: { thresholdS: 2.5, showAhead: true, showBehind: false },
    inputs: { traceSeconds: 8, showClutch: false, showSteering: true, showGearSpeed: true }
  }

  it('keeps the v3 choices: column flags become the column list, the header toggle both lines', () => {
    writeFileSync(file, JSON.stringify(v3))
    const s = SettingsStore.load(file).settings
    expect(s.version).toBe(SETTINGS_VERSION)
    expect(s.widgets.standings).toEqual({
      ...DEFAULT_SETTINGS.widgets.standings,
      ...v3.widgets.standings
    })
    expect(s.standings).toMatchObject({
      mode: 'full',
      topRows: 2,
      aroundRows: 4,
      otherClassLeaders: false,
      gapMode: 'leader'
    })
    const sub = Object.fromEntries(s.standings.subheaderBar.map((e) => [e.id, e.visible]))
    expect(sub).toMatchObject({ iRating: false, safetyRating: false, fastestLap: true })
    const visible = Object.fromEntries(s.standings.columns.map((c) => [c.id, c.visible]))
    expect(visible).toMatchObject({ gained: false, ir: true, last: false, pit: true })
    expect(s.battle).toEqual({
      ...DEFAULT_SETTINGS.battle,
      thresholdS: 2.5,
      lanes: [
        { id: 'ahead', visible: true },
        { id: 'behind', visible: false }
      ]
    })
    expect(s.inputs).toEqual({
      ...DEFAULT_SETTINGS.inputs,
      traceSeconds: 8,
      bars: DEFAULT_SETTINGS.inputs.bars.map((b) => ({ ...b, visible: b.id !== 'clutch' }))
    })
    // A file from before v5: the pedals fit their content, the licence takes the outline.
    expect(s.appearance.licenseStyle).toBe('outline')
  })

  it('drops the v3-only fields when it saves', () => {
    const saved = roundTrip(v3, (d) => {
      d.widgets.standings.scale = 120
    }) as {
      version: number
      standings: Record<string, unknown>
      widgets: { standings: { scale: number } }
    }
    expect(saved.version).toBe(SETTINGS_VERSION)
    expect(saved.widgets.standings.scale).toBe(120)
    for (const flag of ['showPositionsGained', 'showIRating', 'showRatingsHeader', 'showPits']) {
      expect(saved.standings, flag).not.toHaveProperty(flag)
    }
  })
})

describe('SettingsStore with a file that has the old conditions widget (v2.3-v2.4)', () => {
  const v24 = {
    version: 4,
    widgets: {
      relative: { visible: true, bounds: { x: 1431, y: 796, width: 417, height: 229 } },
      standings: { visible: true, bounds: { x: 18, y: 21, width: 540, height: 261 } },
      conditions: {
        visible: true,
        locked: true,
        scale: 120,
        bounds: { x: 60, y: 300, width: 320, height: 130 }
      },
      fuel: { visible: false, bounds: { x: 1200, y: 600, width: 320, height: 170 } }
    },
    relative: { carsAhead: 4 },
    standings: { topRows: 5 },
    conditions: { showHeader: true, showWind: false, showSkies: false }
  }

  it('loads without it: the footers get their defaults, the rest of the file is kept', () => {
    writeFileSync(file, JSON.stringify(v24))
    const s = SettingsStore.load(file).settings
    expect(s.widgets).not.toHaveProperty('conditions')
    expect(s).not.toHaveProperty('conditions')
    expect(s.relative).toEqual({ ...DEFAULT_SETTINGS.relative, carsAhead: 4 })
    expect(s.standings).toEqual({ ...DEFAULT_SETTINGS.standings, topRows: 5 })
    expect(s.standings.footerBarSize).toBe('normal')
    expect(s.relative.footerBarSize).toBe('off')
    expect(s.widgets.standings.bounds).toEqual(v24.widgets.standings.bounds)
    expect(s.widgets.fuel.visible).toBe(false)
  })

  it('does not write it back', () => {
    const saved = roundTrip(v24, (d) => {
      d.standings.conditionsTrend = false
    }) as { widgets: Record<string, unknown>; standings: Record<string, unknown> }
    expect(saved).not.toHaveProperty('conditions')
    expect(saved.widgets).not.toHaveProperty('conditions')
    expect(saved.standings.conditionsTrend).toBe(false)
  })
})
