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
    expect(s.relative).toEqual({ ...DEFAULT_SETTINGS.relative, ...v2.relative })
    expect(s.radar).toEqual(v2.radar)
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
      gapMode: 'leader',
      headerIRating: false,
      headerSafetyRating: false
    })
    const visible = Object.fromEntries(s.standings.columns.map((c) => [c.id, c.visible]))
    expect(visible).toMatchObject({ gained: false, ir: true, last: false, pit: true })
    expect(s.battle).toEqual({ ...DEFAULT_SETTINGS.battle, ...v3.battle })
    expect(s.inputs).toEqual({ ...DEFAULT_SETTINGS.inputs, ...v3.inputs })
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
