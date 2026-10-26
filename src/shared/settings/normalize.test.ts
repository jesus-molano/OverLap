import { describe, expect, it } from 'vitest'
import type {
  AlertsOptions,
  AppearanceSettings,
  BattleOptions,
  DeltaOptions,
  FuelOptions,
  InputsOptions,
  LightsOptions,
  OverlaySettings,
  RadarOptions,
  RelativeOptions,
  StandingsColumn,
  StandingsOptions,
  TrafficOptions,
  VisibilityOptions,
  WidgetSettings
} from '../types'
import type { ShortcutSettings } from '../shortcuts'
import { WIDGET_DEFS, WIDGET_IDS, type WidgetId } from '../widgets'
import {
  ALERTS_HOLD_MAX_S,
  ALERTS_HOLD_MIN_S,
  BACKGROUND_OPACITY_MAX,
  BACKGROUND_OPACITY_MIN,
  BATTLE_THRESHOLD_MAX_S,
  BATTLE_THRESHOLD_MIN_S,
  DEFAULT_SETTINGS,
  DELTA_RANGE_MAX_S,
  DELTA_RANGE_MIN_S,
  DELTA_REFERENCES,
  INPUTS_TRACE_MAX_S,
  INPUTS_TRACE_MIN_S,
  STANDINGS_GAP_MODES,
  STANDINGS_MODES,
  STANDINGS_ROWS_MAX,
  STANDINGS_ROWS_MIN,
  TRAFFIC_ENTRIES_MAX,
  TRAFFIC_ENTRIES_MIN,
  TRAFFIC_HAZARD_MAX_S,
  TRAFFIC_HAZARD_MIN_S,
  TRAFFIC_WINDOW_MAX_S,
  TRAFFIC_WINDOW_MIN_S,
  WIDGET_SCALE_MAX,
  WIDGET_SCALE_MIN,
  createDefaultSettings,
  normalizeColumns,
  normalizeSettings
} from '.'

// Literal v4 defaults: a change to the schema must show up here on purpose.
const DEFAULT_APPEARANCE: AppearanceSettings = {
  accent: '#ffc400',
  fontScale: 100,
  density: 'comfortable',
  nameFormat: 'abbr',
  licenseStyle: 'soft',
  numberStyle: 'chip',
  colorBlind: false,
  units: 'metric',
  stripes: true,
  textHalo: 'auto',
  showSimPill: true,
  language: 'es'
}
const DEFAULT_VISIBILITY: VisibilityOptions = {
  hideWithSimUi: true,
  hideInGarage: true,
  hideOnSessionScreen: true,
  replays: 'follow',
  showWhileWaiting: false
}
const DEFAULT_RELATIVE: RelativeOptions = {
  carsAhead: 3,
  carsBehind: 3,
  showClassPosition: true,
  showLicense: true,
  showIRating: true,
  showStint: false,
  showTyre: false,
  showFlags: true,
  nameFormat: 'inherit',
  showIncidents: true,
  // The conditions footer: off in the relative (a free-size window), every reading on.
  conditionsFooter: false,
  conditionsTrackTemp: true,
  conditionsTrend: true,
  conditionsWet: true,
  conditionsWind: true,
  conditionsWindDirection: true,
  conditionsAirTemp: true,
  conditionsRubber: true
}
const DEFAULT_RADAR: RadarOptions = { rangeM: 20, showRangeLabels: true }
const DEFAULT_COLUMNS: StandingsColumn[] = [
  { id: 'gained', visible: true },
  { id: 'ir', visible: true },
  { id: 'lic', visible: true },
  { id: 'delta', visible: false },
  { id: 'gap', visible: true },
  { id: 'gapLeader', visible: false },
  { id: 'last', visible: true },
  { id: 'best', visible: true },
  { id: 'pit', visible: true },
  { id: 'pitLap', visible: false },
  { id: 'stint', visible: false },
  { id: 'tyre', visible: false }
]
const DEFAULT_STANDINGS: StandingsOptions = {
  mode: 'compact',
  topRows: 3,
  aroundRows: 3,
  otherClassLeaders: true,
  gapMode: 'interval',
  columns: DEFAULT_COLUMNS,
  nameFormat: 'inherit',
  iRatingDeltaAll: false,
  headerIRating: true,
  headerSafetyRating: true,
  headerIncidents: true,
  showSof: true,
  showCarCount: true,
  showFlags: true,
  density: 'inherit',
  // The conditions footer: on in the standings (it grows by the line), every reading on.
  conditionsFooter: true,
  conditionsTrackTemp: true,
  conditionsTrend: true,
  conditionsWet: true,
  conditionsWind: true,
  conditionsWindDirection: true,
  conditionsAirTemp: true,
  conditionsRubber: true
}
const DEFAULT_BATTLE: BattleOptions = {
  thresholdS: 1.5,
  showAhead: true,
  showBehind: true,
  layout: 'stacked',
  detail: 'sectors',
  holdS: 3,
  showPrediction: true,
  showIRatingAtStake: true,
  nameFormat: 'inherit'
}
const DEFAULT_INPUTS: InputsOptions = {
  traceSeconds: 5,
  showClutch: true,
  showSteering: true,
  showGearSpeed: true,
  clutchInTrace: true,
  traceWidth: 2,
  colors: { throttle: '#3ddc84', brake: '#ff4545', clutch: '#4aa3ff' },
  steeringStyle: 'bar',
  layout: 'trace-bars-info'
}
const DEFAULT_TRAFFIC: TrafficOptions = {
  behindS: 12,
  aheadS: 8,
  hazardS: 8,
  maxEntries: 3,
  showFaster: true,
  showSlower: true,
  showHazards: true,
  onlyMulticlass: true,
  nameFormat: 'inherit'
}
const DEFAULT_ALERTS: AlertsOptions = {
  showFlags: true,
  showBlue: true,
  showFurled: true,
  showPitLimiter: true,
  showPitOverspeed: true,
  showPitEntry: true,
  showLapsToGo: true,
  showTow: true,
  showWrongWay: true,
  showIncidents: true,
  showStalled: true,
  showOilPressure: true,
  showDamage: true,
  showBoxThisLap: true,
  showFuelLow: true,
  holdS: 3
}
const DEFAULT_SHORTCUTS: ShortcutSettings = {
  toggleOverlay: 'Ctrl+Shift+H',
  toggleEditMode: 'Ctrl+Shift+E'
}
const DEFAULT_DELTA: DeltaOptions = {
  reference: 'pb',
  fallback: true,
  rangeS: 1,
  showPredicted: true,
  showSectors: true,
  showTrend: true
}
const DEFAULT_FUEL: FuelOptions = {
  showHeader: false,
  showGauge: true,
  showPerLap: true,
  showFinish: true,
  showBox: true,
  showWindow: true,
  showSave: true,
  showTyres: true,
  showLimits: true,
  avgLaps: 5,
  marginLaps: 0.5
}
const DEFAULT_LIGHTS: LightsOptions = {
  layout: 'row',
  onlyWhenLit: false,
  showCaptions: false,
  showTemps: false,
  showRepairTime: true,
  showOilPressure: true,
  showFuelPressure: true,
  showStalled: true,
  showRepair: true,
  showRepairOptional: true,
  showWater: true,
  showOilTemp: true,
  showTrend: true,
  showPitLimiter: false,
  showRevLimiter: false
}

function defaultWidget(id: WidgetId): WidgetSettings {
  const def = WIDGET_DEFS[id]
  return {
    visible: def.defaultVisible,
    bounds: { ...def.defaultBounds },
    locked: false,
    backgroundOpacity: def.defaultBackgroundOpacity,
    scale: 100,
    autoHeight: def.sizeModel === 'auto-height',
    anchor: 'top',
    showIn: { ...def.defaultShowIn },
    hideInPits: false,
    showOnSessionScreen: id === 'standings'
  }
}

const cols = (s: OverlaySettings): string[] =>
  s.standings.columns.map((c) => `${c.visible ? '+' : '-'}${c.id}`)

describe('DEFAULT_SETTINGS', () => {
  it('is the documented v4 defaults, built from WIDGET_DEFS', () => {
    expect(DEFAULT_SETTINGS).toEqual<OverlaySettings>({
      version: 4,
      appearance: DEFAULT_APPEARANCE,
      visibility: DEFAULT_VISIBILITY,
      widgets: Object.fromEntries(WIDGET_IDS.map((id) => [id, defaultWidget(id)])) as Record<
        WidgetId,
        WidgetSettings
      >,
      relative: DEFAULT_RELATIVE,
      radar: DEFAULT_RADAR,
      standings: DEFAULT_STANDINGS,
      battle: DEFAULT_BATTLE,
      inputs: DEFAULT_INPUTS,
      traffic: DEFAULT_TRAFFIC,
      alerts: DEFAULT_ALERTS,
      delta: DEFAULT_DELTA,
      fuel: DEFAULT_FUEL,
      lights: DEFAULT_LIGHTS,
      shortcuts: DEFAULT_SHORTCUTS
    })
  })

  it('makes standings, battle, traffic, alerts and fuel auto-height and battle race-only', () => {
    expect(DEFAULT_SETTINGS.widgets.standings.autoHeight).toBe(true)
    expect(DEFAULT_SETTINGS.widgets.battle.autoHeight).toBe(true)
    expect(DEFAULT_SETTINGS.widgets.traffic.autoHeight).toBe(true)
    expect(DEFAULT_SETTINGS.widgets.alerts.autoHeight).toBe(true)
    expect(DEFAULT_SETTINGS.widgets.fuel.autoHeight).toBe(true)
    expect(DEFAULT_SETTINGS.widgets.relative.autoHeight).toBe(false)
    expect(DEFAULT_SETTINGS.widgets.battle.showIn).toEqual({
      practice: false,
      qualify: false,
      race: true
    })
  })

  it('makes the warning lights small, auto-height and shown in every session', () => {
    const w = DEFAULT_SETTINGS.widgets.lights
    expect(w.visible).toBe(true)
    expect(w.autoHeight).toBe(true)
    expect(w.showIn).toEqual({ practice: true, qualify: true, race: true })
    expect(w.bounds.width).toBeLessThanOrEqual(300)
    expect(w.bounds.height).toBeLessThanOrEqual(60)
  })

  it('makes the fuel widget auto-height and race-only', () => {
    expect(DEFAULT_SETTINGS.widgets.fuel.autoHeight).toBe(true)
    expect(DEFAULT_SETTINGS.widgets.fuel.showIn).toEqual({
      practice: false,
      qualify: false,
      race: true
    })
  })

  it('takes the traffic, alerts and delta windows from WIDGET_DEFS', () => {
    for (const id of ['traffic', 'alerts', 'delta'] as const) {
      const w = DEFAULT_SETTINGS.widgets[id]
      const def = WIDGET_DEFS[id]
      expect(w.bounds).toEqual(def.defaultBounds)
      expect(w.visible).toBe(def.defaultVisible)
      expect(w.backgroundOpacity).toBe(def.defaultBackgroundOpacity)
      expect(w.showIn).toEqual(def.defaultShowIn)
    }
  })

  it('has default options inside their ranges', () => {
    const { standings, battle, inputs, traffic, alerts, widgets } = DEFAULT_SETTINGS
    for (const s of [traffic.behindS, traffic.aheadS]) {
      expect(s).toBeGreaterThanOrEqual(TRAFFIC_WINDOW_MIN_S)
      expect(s).toBeLessThanOrEqual(TRAFFIC_WINDOW_MAX_S)
    }
    expect(traffic.hazardS).toBeGreaterThanOrEqual(TRAFFIC_HAZARD_MIN_S)
    expect(traffic.hazardS).toBeLessThanOrEqual(TRAFFIC_HAZARD_MAX_S)
    expect(traffic.maxEntries).toBeGreaterThanOrEqual(TRAFFIC_ENTRIES_MIN)
    expect(traffic.maxEntries).toBeLessThanOrEqual(TRAFFIC_ENTRIES_MAX)
    expect(alerts.holdS).toBeGreaterThanOrEqual(ALERTS_HOLD_MIN_S)
    expect(alerts.holdS).toBeLessThanOrEqual(ALERTS_HOLD_MAX_S)
    expect(DEFAULT_SETTINGS.delta.rangeS).toBeGreaterThanOrEqual(DELTA_RANGE_MIN_S)
    expect(DEFAULT_SETTINGS.delta.rangeS).toBeLessThanOrEqual(DELTA_RANGE_MAX_S)
    expect(DELTA_REFERENCES).toContain(DEFAULT_SETTINGS.delta.reference)
    // The delta bar sizes freely: its height is the user's.
    expect(widgets.delta.autoHeight).toBe(false)
    for (const rows of [standings.topRows, standings.aroundRows]) {
      expect(rows).toBeGreaterThanOrEqual(STANDINGS_ROWS_MIN)
      expect(rows).toBeLessThanOrEqual(STANDINGS_ROWS_MAX)
    }
    expect(STANDINGS_MODES).toContain(standings.mode)
    expect(STANDINGS_GAP_MODES).toContain(standings.gapMode)
    expect(battle.thresholdS).toBeGreaterThanOrEqual(BATTLE_THRESHOLD_MIN_S)
    expect(battle.thresholdS).toBeLessThanOrEqual(BATTLE_THRESHOLD_MAX_S)
    expect(inputs.traceSeconds).toBeGreaterThanOrEqual(INPUTS_TRACE_MIN_S)
    expect(inputs.traceSeconds).toBeLessThanOrEqual(INPUTS_TRACE_MAX_S)
    for (const id of WIDGET_IDS) {
      const w = widgets[id]
      expect(w.backgroundOpacity).toBeGreaterThanOrEqual(BACKGROUND_OPACITY_MIN)
      expect(w.backgroundOpacity).toBeLessThanOrEqual(BACKGROUND_OPACITY_MAX)
      expect(w.scale).toBeGreaterThanOrEqual(WIDGET_SCALE_MIN)
      expect(w.scale).toBeLessThanOrEqual(WIDGET_SCALE_MAX)
    }
  })

  it('is frozen, while createDefaultSettings returns independent copies', () => {
    expect(Object.isFrozen(DEFAULT_SETTINGS.widgets.relative.bounds)).toBe(true)
    expect(Object.isFrozen(DEFAULT_SETTINGS.standings.columns[0])).toBe(true)
    expect(Object.isFrozen(DEFAULT_SETTINGS.inputs.colors)).toBe(true)
    const a = createDefaultSettings()
    a.widgets.relative.bounds.x = 999
    a.widgets.battle.showIn.practice = true
    a.standings.columns[0]!.visible = false
    a.inputs.colors.brake = '#000000'
    a.appearance.accent = '#123456'
    const b = createDefaultSettings()
    expect(b.widgets.relative.bounds.x).toBe(WIDGET_DEFS.relative.defaultBounds.x)
    expect(b.widgets.battle.showIn.practice).toBe(false)
    expect(b.standings.columns[0]!.visible).toBe(true)
    expect(b.inputs.colors.brake).toBe('#ff4545')
    expect(b.appearance.accent).toBe('#ffc400')
    expect(WIDGET_DEFS.battle.defaultShowIn.practice).toBe(false)
  })
})

describe('normalizeSettings: basics', () => {
  it('returns defaults for non-object input', () => {
    for (const raw of [undefined, null, 42, 'x', [], true]) {
      expect(normalizeSettings(raw)).toEqual(DEFAULT_SETTINGS)
    }
  })

  it('never returns the frozen defaults', () => {
    const s = normalizeSettings({})
    expect(Object.isFrozen(s)).toBe(false)
    s.widgets.radar.visible = false
    expect(DEFAULT_SETTINGS.widgets.radar.visible).toBe(true)
  })

  it('keeps valid saved v4 values and is idempotent', () => {
    const s = createDefaultSettings()
    s.appearance = {
      ...DEFAULT_APPEARANCE,
      accent: '#22d3ee',
      fontScale: 120,
      nameFormat: 'tv',
      colorBlind: true,
      units: 'imperial',
      language: 'en'
    }
    s.widgets.standings = {
      ...s.widgets.standings,
      scale: 140,
      autoHeight: false,
      anchor: 'bottom',
      showIn: { practice: false, qualify: true, race: true },
      hideInPits: true
    }
    s.standings = {
      ...DEFAULT_STANDINGS,
      gapMode: 'both',
      columns: [...DEFAULT_COLUMNS].reverse(),
      nameFormat: 'surname',
      density: 'compact'
    }
    s.battle = { ...DEFAULT_BATTLE, layout: 'side', detail: 'both', holdS: 6.5 }
    s.inputs = {
      ...DEFAULT_INPUTS,
      traceWidth: 2.5,
      colors: { throttle: '#22c55e', brake: '#f43f5e', clutch: '#2f6db5' },
      layout: 'bars'
    }
    s.widgets.traffic = { ...s.widgets.traffic, anchor: 'bottom', scale: 90, hideInPits: true }
    s.widgets.alerts = { ...s.widgets.alerts, visible: false, backgroundOpacity: 0.5 }
    s.traffic = {
      ...DEFAULT_TRAFFIC,
      behindS: 20,
      aheadS: 4,
      hazardS: 15,
      maxEntries: 5,
      showSlower: false,
      onlyMulticlass: false,
      nameFormat: 'tv'
    }
    s.alerts = { ...DEFAULT_ALERTS, showBlue: false, holdS: 0.5 }
    s.widgets.delta = { ...s.widgets.delta, scale: 130, hideInPits: true }
    s.delta = {
      reference: 'class',
      fallback: false,
      rangeS: 2.25,
      showPredicted: false,
      showSectors: false,
      showTrend: false
    }
    const raw = JSON.parse(JSON.stringify(s))
    expect(normalizeSettings(raw)).toEqual(s)
    expect(normalizeSettings(normalizeSettings(raw))).toEqual(s)
  })

  it('drops unknown widget ids and keys', () => {
    const s = normalizeSettings({
      widgets: { pitboard: { visible: true }, radar: { color: 'red' } },
      appearance: { theme: 'dark' },
      battle: { extra: 1 },
      inputs: { color: 'red' },
      traffic: { rangeM: 50 },
      alerts: { sound: true },
      delta: { mode: 'bar' }
    })
    expect(Object.keys(s.widgets).sort()).toEqual([...WIDGET_IDS].sort())
    expect('pitboard' in s.widgets).toBe(false)
    expect('color' in s.widgets.radar).toBe(false)
    expect('theme' in s.appearance).toBe(false)
    expect('extra' in s.battle).toBe(false)
    expect('color' in s.inputs).toBe(false)
    expect('rangeM' in s.traffic).toBe(false)
    expect('sound' in s.alerts).toBe(false)
    expect('mode' in s.delta).toBe(false)
  })

  it('replaces garbage values field by field', () => {
    const s = normalizeSettings({
      version: 7,
      widgets: {
        relative: {
          visible: 'yes',
          bounds: { x: 'a', y: 12.6, width: Number.NaN, height: -5 }
        },
        radar: { bounds: [1, 2, 3, 4] }
      },
      relative: { carsAhead: '4', carsBehind: null },
      radar: { rangeM: Infinity }
    })
    const def = WIDGET_DEFS.relative.defaultBounds
    expect(s.version).toBe(4)
    expect(s.widgets.relative.visible).toBe(WIDGET_DEFS.relative.defaultVisible)
    expect(s.widgets.relative.bounds).toEqual({
      x: def.x,
      y: 13,
      width: def.width,
      height: def.height
    })
    expect(s.widgets.radar.bounds).toEqual(WIDGET_DEFS.radar.defaultBounds)
    expect(s.relative).toEqual(DEFAULT_RELATIVE)
    expect(s.radar).toEqual(DEFAULT_RADAR)
  })

  it('enforces the minimum widget size and rounds bounds', () => {
    const s = normalizeSettings({
      widgets: { radar: { bounds: { x: 10.4, y: -0.6, width: 10, height: 1e9 } } }
    })
    expect(s.widgets.radar.bounds).toEqual({
      x: 10,
      y: -1,
      width: WIDGET_DEFS.radar.minSize.width,
      height: 10_000
    })
  })
})

describe('normalizeSettings: widget fields', () => {
  const widget = (id: WidgetId, raw: Record<string, unknown>): WidgetSettings =>
    normalizeSettings({ widgets: { [id]: raw } }).widgets[id]

  it('clamps the background opacity, defaulting non-numbers', () => {
    const opacity = (value: unknown): number =>
      widget('radar', { backgroundOpacity: value }).backgroundOpacity
    expect(opacity(-1)).toBe(0)
    expect(opacity(2)).toBe(1)
    expect(opacity(0.35)).toBe(0.35)
    for (const bad of [Number.NaN, Infinity, '0.5', null, true, {}]) {
      expect(opacity(bad)).toBe(WIDGET_DEFS.radar.defaultBackgroundOpacity)
    }
  })

  it('rounds and clamps the scale to 60..200 %', () => {
    const scale = (value: unknown): number => widget('standings', { scale: value }).scale
    expect(scale(150)).toBe(150)
    expect(scale(104.6)).toBe(105)
    expect(scale(10)).toBe(60)
    expect(scale(900)).toBe(200)
    for (const bad of [Number.NaN, '120', null]) expect(scale(bad)).toBe(100)
  })

  it('allows auto height only on auto-height widgets', () => {
    expect(widget('standings', { autoHeight: false }).autoHeight).toBe(false)
    expect(widget('battle', { autoHeight: 'no' }).autoHeight).toBe(true)
    expect(widget('traffic', { autoHeight: false }).autoHeight).toBe(false)
    expect(widget('alerts', { autoHeight: 'no' }).autoHeight).toBe(true)
    expect(widget('relative', { autoHeight: true }).autoHeight).toBe(false)
    expect(widget('radar', { autoHeight: true }).autoHeight).toBe(false)
  })

  it('validates the anchor, the session rules and hide-in-pits', () => {
    expect(widget('battle', { anchor: 'bottom' }).anchor).toBe('bottom')
    expect(widget('battle', { anchor: 'left' }).anchor).toBe('top')
    expect(widget('battle', { showIn: { practice: true } }).showIn).toEqual({
      practice: true,
      qualify: false,
      race: true
    })
    expect(widget('relative', { showIn: { race: 'no', qualify: false } }).showIn).toEqual({
      practice: true,
      qualify: false,
      race: true
    })
    expect(widget('relative', { showIn: 'race' }).showIn).toEqual(
      WIDGET_DEFS.relative.defaultShowIn
    )
    expect(widget('inputs', { hideInPits: true }).hideInPits).toBe(true)
    expect(widget('inputs', { hideInPits: 1 }).hideInPits).toBe(false)
  })

  it('takes visible and locked only when they are booleans', () => {
    expect(widget('radar', { locked: true, visible: false })).toMatchObject({
      locked: true,
      visible: false
    })
    expect(widget('radar', { locked: 'true', visible: 0 })).toMatchObject({
      locked: false,
      visible: true
    })
  })
})

describe('normalizeSettings: options', () => {
  it('clamps options and rounds integers', () => {
    expect(normalizeSettings({ relative: { carsAhead: -2, carsBehind: 99 } }).relative).toEqual({
      ...DEFAULT_RELATIVE,
      carsAhead: 0,
      carsBehind: 10
    })
    expect(normalizeSettings({ relative: { carsAhead: 2.6, carsBehind: 0.4 } }).relative).toEqual({
      ...DEFAULT_RELATIVE,
      carsAhead: 3,
      carsBehind: 0
    })
    expect(normalizeSettings({ radar: { rangeM: 1 } }).radar.rangeM).toBe(5)
    expect(normalizeSettings({ radar: { rangeM: 500 } }).radar.rangeM).toBe(100)
    expect(normalizeSettings({ radar: { rangeM: 12.5 } }).radar.rangeM).toBe(12.5)
  })

  it('clamps the standings rows to 0..10 integers', () => {
    const rows = (topRows: unknown, aroundRows: unknown): number[] => {
      const s = normalizeSettings({ standings: { topRows, aroundRows } }).standings
      return [s.topRows, s.aroundRows]
    }
    expect(rows(-2, 99)).toEqual([0, 10])
    expect(rows(2.6, 0.4)).toEqual([3, 0])
    expect(rows(1e9, -Infinity)).toEqual([10, 3])
    for (const bad of [Number.NaN, '4', null, true, {}, []]) expect(rows(bad, bad)).toEqual([3, 3])
  })

  it('clamps the battle threshold and hold with one decimal', () => {
    const battle = (raw: Record<string, unknown>): BattleOptions =>
      normalizeSettings({ battle: raw }).battle
    expect(battle({ thresholdS: 0.26 }).thresholdS).toBe(0.3)
    expect(battle({ thresholdS: 9 }).thresholdS).toBe(5)
    expect(battle({ thresholdS: 1.25 }).thresholdS).toBe(1.3)
    expect(battle({ holdS: 12 }).holdS).toBe(10)
    expect(battle({ holdS: -1 }).holdS).toBe(0)
    expect(battle({ holdS: 2.26 }).holdS).toBe(2.3)
    for (const bad of [Number.NaN, Infinity, '1', null, false]) {
      expect(battle({ thresholdS: bad, holdS: bad })).toMatchObject({ thresholdS: 1.5, holdS: 3 })
    }
  })

  it('clamps the inputs trace length and width', () => {
    const inputs = (raw: Record<string, unknown>): InputsOptions =>
      normalizeSettings({ inputs: raw }).inputs
    expect(inputs({ traceSeconds: 1.6 }).traceSeconds).toBe(2)
    expect(inputs({ traceSeconds: 60 }).traceSeconds).toBe(10)
    expect(inputs({ traceSeconds: 6.5 }).traceSeconds).toBe(7)
    expect(inputs({ traceWidth: 0.2 }).traceWidth).toBe(1)
    expect(inputs({ traceWidth: 1.75 }).traceWidth).toBe(1.8)
    expect(inputs({ traceWidth: 'thick' }).traceWidth).toBe(2)
  })

  it('clamps the traffic windows and entries to whole numbers', () => {
    const traffic = (raw: Record<string, unknown>): TrafficOptions =>
      normalizeSettings({ traffic: raw }).traffic
    expect(traffic({ behindS: 1, aheadS: 99, hazardS: 0, maxEntries: 9 })).toEqual({
      ...DEFAULT_TRAFFIC,
      behindS: 2,
      aheadS: 30,
      hazardS: 2,
      maxEntries: 5
    })
    expect(traffic({ behindS: 14.6, aheadS: 5.4, hazardS: 25, maxEntries: 0.2 })).toEqual({
      ...DEFAULT_TRAFFIC,
      behindS: 15,
      aheadS: 5,
      hazardS: 20,
      maxEntries: 1
    })
    for (const bad of [Number.NaN, Infinity, '10', null, true, {}]) {
      expect(traffic({ behindS: bad, aheadS: bad, hazardS: bad, maxEntries: bad })).toEqual(
        DEFAULT_TRAFFIC
      )
    }
  })

  it('clamps the alerts hold to 0..10 s with one decimal', () => {
    const hold = (holdS: unknown): number => normalizeSettings({ alerts: { holdS } }).alerts.holdS
    expect(hold(-2)).toBe(0)
    expect(hold(42)).toBe(10)
    expect(hold(2.26)).toBe(2.3)
    expect(hold(0)).toBe(0)
    for (const bad of [Number.NaN, '3', null, false]) expect(hold(bad)).toBe(3)
  })

  it('clamps the delta range to 0.5..3 s with two decimals and validates the reference', () => {
    const range = (rangeS: unknown): number => normalizeSettings({ delta: { rangeS } }).delta.rangeS
    expect(range(0.1)).toBe(0.5)
    expect(range(10)).toBe(3)
    expect(range(1.254)).toBe(1.25)
    expect(range(2.75)).toBe(2.75)
    for (const bad of [Number.NaN, Infinity, '2', null, true]) expect(range(bad)).toBe(1)
    const ref = (reference: unknown): string =>
      normalizeSettings({ delta: { reference } }).delta.reference
    for (const ok of ['pb', 'session', 'optimal', 'class', 'classOptimal']) expect(ref(ok)).toBe(ok)
    for (const bad of ['PB', 'best', 'Optimal', 'sessionOptimal', '', null, 1]) {
      expect(ref(bad)).toBe('pb')
    }
    // A file from before the optimal references keeps its choice and its fallback.
    const old = normalizeSettings({ delta: { reference: 'session', fallback: false } }).delta
    expect(old).toMatchObject({ reference: 'session', fallback: false })
  })

  it('validates every enum', () => {
    const s = normalizeSettings({
      appearance: { density: 'tiny', nameFormat: 'inherit', licenseStyle: 'x', units: 'si' },
      standings: { mode: 'Full', gapMode: 'toString', nameFormat: 'nick', density: 'huge' },
      battle: { layout: 'grid', detail: 'all', nameFormat: 'TV' },
      inputs: { steeringStyle: 'yoke', layout: 'stacked' },
      traffic: { nameFormat: 'short' }
    })
    expect(s).toEqual(DEFAULT_SETTINGS)
    const ok = normalizeSettings({
      appearance: { density: 'compact', nameFormat: 'surname', textHalo: 'off' },
      standings: { mode: 'full', gapMode: 'both', nameFormat: 'full', density: 'comfortable' },
      battle: { layout: 'side', detail: 'none' },
      inputs: { steeringStyle: 'wheel', layout: 'info-bars-trace' },
      traffic: { nameFormat: 'surname' }
    })
    expect(ok.traffic.nameFormat).toBe('surname')
    expect(ok.appearance).toMatchObject({
      density: 'compact',
      nameFormat: 'surname',
      textHalo: 'off'
    })
    expect(ok.standings).toMatchObject({ mode: 'full', gapMode: 'both', nameFormat: 'full' })
    expect(ok.battle).toMatchObject({ layout: 'side', detail: 'none' })
    expect(ok.inputs).toMatchObject({ steeringStyle: 'wheel', layout: 'info-bars-trace' })
  })

  it('validates hex colours, normalising their spelling', () => {
    const s = normalizeSettings({
      appearance: { accent: '#F80' },
      inputs: { colors: { throttle: 'A3E635', brake: 'red', clutch: 12 } }
    })
    expect(s.appearance.accent).toBe('#ff8800')
    expect(s.inputs.colors).toEqual({ ...DEFAULT_INPUTS.colors, throttle: '#a3e635' })
    expect(normalizeSettings({ appearance: { accent: 'yellow' } }).appearance.accent).toBe(
      '#ffc400'
    )
    expect(normalizeSettings({ inputs: { colors: 'red' } }).inputs.colors).toEqual(
      DEFAULT_INPUTS.colors
    )
  })

  it('takes boolean toggles only when they are booleans', () => {
    const bad = normalizeSettings({
      appearance: { colorBlind: 1, stripes: 'no', showSimPill: null },
      standings: { iRatingDeltaAll: 'yes', headerIRating: 0, showSof: [] },
      battle: { showPrediction: 'false', showAhead: 0 },
      inputs: { clutchInTrace: {}, showClutch: 'off' },
      traffic: { showFaster: 0, showSlower: 'no', showHazards: null, onlyMulticlass: 'false' },
      alerts: { showFlags: 1, showBlue: 'off', showPitLimiter: [] },
      delta: { fallback: 0, showPredicted: 'no', showSectors: null, showTrend: {} }
    })
    expect(bad).toEqual(DEFAULT_SETTINGS)
    const ok = normalizeSettings({
      traffic: { showFaster: false, showHazards: false, onlyMulticlass: false },
      alerts: { showFlags: false, showPitLimiter: false }
    })
    expect(ok.traffic).toEqual({
      ...DEFAULT_TRAFFIC,
      showFaster: false,
      showHazards: false,
      onlyMulticlass: false
    })
    expect(ok.alerts).toEqual({ ...DEFAULT_ALERTS, showFlags: false, showPitLimiter: false })
  })
})

describe('normalizeSettings: language', () => {
  it('loads a stored settings.json without a language as Spanish', () => {
    const saved = createDefaultSettings()
    saved.appearance = { ...saved.appearance, accent: '#22d3ee', density: 'compact' }
    const raw = JSON.parse(JSON.stringify(saved)) as { appearance: Record<string, unknown> }
    delete raw.appearance.language
    const s = normalizeSettings(raw)
    expect(s.appearance.language).toBe('es')
    expect(s.appearance).toEqual({ ...DEFAULT_APPEARANCE, accent: '#22d3ee', density: 'compact' })
    expect(normalizeSettings({}).appearance.language).toBe('es')
  })

  it('round-trips English through the file', () => {
    const saved = createDefaultSettings()
    saved.appearance.language = 'en'
    const s = normalizeSettings(JSON.parse(JSON.stringify(saved)))
    expect(s.appearance.language).toBe('en')
    expect(s).toEqual(saved)
    expect(normalizeSettings(JSON.parse(JSON.stringify(s)))).toEqual(saved)
  })

  it('falls back to Spanish for an unknown or mistyped language', () => {
    for (const bad of ['fr', 'EN', 'English', 'en-GB', '', null, 1, true, {}, ['en']]) {
      expect(normalizeSettings({ appearance: { language: bad } }).appearance.language).toBe('es')
    }
  })
})

describe('normalizeColumns', () => {
  it('keeps the given order and appends missing ids hidden', () => {
    const out = normalizeColumns(
      [
        { id: 'last', visible: true },
        { id: 'gap', visible: false }
      ],
      DEFAULT_COLUMNS
    )
    expect(out.map((c) => [c.id, c.visible])).toEqual([
      ['last', true],
      ['gap', false],
      ['gained', false],
      ['ir', false],
      ['lic', false],
      ['delta', false],
      ['gapLeader', false],
      ['best', false],
      ['pit', false],
      ['pitLap', false],
      ['stint', false],
      ['tyre', false]
    ])
  })

  it('adds the columns a file saved before them lacks, hidden, at the end', () => {
    const before = DEFAULT_COLUMNS.filter(
      (c) => !['best', 'pitLap', 'stint', 'tyre'].includes(c.id)
    )
    const out = normalizeColumns(before, DEFAULT_COLUMNS)
    expect(out.slice(0, before.length)).toEqual(before)
    expect(out.slice(before.length)).toEqual([
      { id: 'best', visible: false },
      { id: 'pitLap', visible: false },
      { id: 'stint', visible: false },
      { id: 'tyre', visible: false }
    ])
  })

  it('drops unknown ids, duplicates and malformed entries', () => {
    const out = normalizeColumns(
      [
        { id: 'ir', visible: false },
        { id: 'pos', visible: true },
        { id: 'ir', visible: true },
        'gap',
        null,
        { visible: true },
        { id: 'pit', visible: 'yes' }
      ],
      DEFAULT_COLUMNS
    )
    expect(out.slice(0, 2)).toEqual([
      { id: 'ir', visible: false },
      // Non-boolean visible keeps the fallback's (pit is on by default).
      { id: 'pit', visible: true }
    ])
    expect(out.map((c) => c.id).sort()).toEqual(DEFAULT_COLUMNS.map((c) => c.id).sort())
  })

  it('falls back for a non-array or a list without one valid entry', () => {
    for (const raw of [undefined, 'gap', {}, [], ['pos'], [{ id: 'nope' }]]) {
      expect(normalizeColumns(raw, DEFAULT_COLUMNS)).toEqual(DEFAULT_COLUMNS)
    }
    expect(normalizeColumns(undefined, DEFAULT_COLUMNS)).not.toBe(DEFAULT_COLUMNS)
  })
})

describe('normalizeSettings: migration', () => {
  it('migrates a v1 file, keeping bounds, visibility and options', () => {
    const v1 = {
      version: 1,
      widgets: {
        relative: { visible: false, bounds: { x: -1800, y: 40, width: 500, height: 300 } },
        radar: { visible: true, bounds: { x: 100, y: 200, width: 200, height: 220 } }
      },
      relative: { carsAhead: 5, carsBehind: 2 },
      radar: { rangeM: 30 }
    }
    const s = normalizeSettings(v1)
    expect(s.version).toBe(4)
    expect(s.widgets.relative).toEqual({
      ...defaultWidget('relative'),
      visible: false,
      bounds: { x: -1800, y: 40, width: 500, height: 300 }
    })
    expect(s.widgets.radar).toEqual({
      ...defaultWidget('radar'),
      bounds: { x: 100, y: 200, width: 200, height: 220 }
    })
    for (const id of ['standings', 'battle', 'inputs', 'traffic', 'alerts', 'delta'] as const) {
      expect(s.widgets[id]).toEqual(defaultWidget(id))
    }
    expect(s.relative).toEqual({ ...DEFAULT_RELATIVE, carsAhead: 5, carsBehind: 2 })
    expect(s.radar).toEqual({ ...DEFAULT_RADAR, rangeM: 30 })
    expect(s.appearance).toEqual(DEFAULT_APPEARANCE)
    expect(s.standings).toEqual(DEFAULT_STANDINGS)
    expect(s.traffic).toEqual(DEFAULT_TRAFFIC)
    expect(s.alerts).toEqual(DEFAULT_ALERTS)
    expect(s.delta).toEqual(DEFAULT_DELTA)
  })

  it('gives a v4 file from before v2.2 the delta defaults, keeping the rest', () => {
    const before = createDefaultSettings()
    before.widgets.alerts = { ...before.widgets.alerts, scale: 120, anchor: 'bottom' }
    before.alerts = { ...before.alerts, holdS: 5 }
    const raw = JSON.parse(JSON.stringify(before)) as Record<string, unknown>
    delete raw.delta
    delete (raw.widgets as Record<string, unknown>).delta
    const s = normalizeSettings(raw)
    expect(s).toEqual(before)
    expect(s.widgets.delta).toEqual(defaultWidget('delta'))
    expect(s.delta).toEqual(DEFAULT_DELTA)
  })

  it('gives a v4 file from before v2.1 the traffic and alerts defaults, keeping the rest', () => {
    const before = createDefaultSettings()
    before.widgets.standings = { ...before.widgets.standings, scale: 120, locked: true }
    before.battle = { ...before.battle, thresholdS: 2.5 }
    const raw = JSON.parse(JSON.stringify(before)) as Record<string, unknown>
    delete raw.traffic
    delete raw.alerts
    const widgets = raw.widgets as Record<string, unknown>
    delete widgets.traffic
    delete widgets.alerts
    const s = normalizeSettings(raw)
    expect(s).toEqual(before)
    expect(s.version).toBe(4)
    expect(s.widgets.traffic).toEqual(defaultWidget('traffic'))
    expect(s.widgets.alerts).toEqual(defaultWidget('alerts'))
    expect(s.traffic).toEqual(DEFAULT_TRAFFIC)
    expect(s.alerts).toEqual(DEFAULT_ALERTS)
  })

  it('ignores mistyped traffic, alerts and delta sections', () => {
    for (const bad of [null, 'x', 5, [], true]) {
      const s = normalizeSettings({
        traffic: bad,
        alerts: bad,
        delta: bad,
        widgets: { traffic: bad, delta: bad }
      })
      expect(s.traffic).toEqual(DEFAULT_TRAFFIC)
      expect(s.alerts).toEqual(DEFAULT_ALERTS)
      expect(s.delta).toEqual(DEFAULT_DELTA)
      expect(s.widgets.delta).toEqual(defaultWidget('delta'))
      expect(s.widgets.traffic).toEqual(defaultWidget('traffic'))
    }
  })

  it('migrates a v2 file: new widgets, fields and sections get their defaults', () => {
    const v2 = {
      version: 2,
      widgets: {
        relative: {
          visible: true,
          bounds: { x: 10, y: 20, width: 480, height: 260 },
          locked: true,
          backgroundOpacity: 0.5
        }
      },
      relative: { ...DEFAULT_RELATIVE, showLicense: false },
      radar: { rangeM: 50, showRangeLabels: false }
    }
    const s = normalizeSettings(v2)
    expect(s.widgets.relative).toEqual({ ...defaultWidget('relative'), ...v2.widgets.relative })
    expect(s.relative.showLicense).toBe(false)
    expect(s.radar).toEqual({ rangeM: 50, showRangeLabels: false })
    expect(s.battle).toEqual(DEFAULT_BATTLE)
    expect(s.inputs).toEqual(DEFAULT_INPUTS)
    expect(s.traffic).toEqual(DEFAULT_TRAFFIC)
    expect(s.alerts).toEqual(DEFAULT_ALERTS)
  })

  it('maps the v3 standings show* flags onto the columns and header toggles', () => {
    const v3 = {
      version: 3,
      widgets: {
        standings: {
          visible: true,
          bounds: { x: 1200, y: 100, width: 600, height: 500 },
          locked: false,
          backgroundOpacity: 0.6
        }
      },
      standings: {
        mode: 'full',
        topRows: 5,
        aroundRows: 2,
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
      inputs: { traceSeconds: 8, showClutch: false, showSteering: true, showGearSpeed: false }
    }
    const s = normalizeSettings(v3)
    expect(cols(s)).toEqual([
      '-gained',
      '+ir',
      '+lic',
      '-delta',
      '+gap',
      '-gapLeader',
      '-last',
      '-best',
      '+pit',
      '-pitLap',
      '-stint',
      '-tyre'
    ])
    expect(s.standings).toEqual({
      ...DEFAULT_STANDINGS,
      mode: 'full',
      topRows: 5,
      aroundRows: 2,
      otherClassLeaders: false,
      gapMode: 'leader',
      columns: s.standings.columns,
      headerIRating: false,
      headerSafetyRating: false
    })
    // The old per-row iRating delta (on by default in v3) is not carried over.
    expect(s.standings.iRatingDeltaAll).toBe(false)
    expect('showPositionsGained' in s.standings).toBe(false)
    expect('showRatingsHeader' in s.standings).toBe(false)
    expect(s.battle).toEqual({ ...DEFAULT_BATTLE, thresholdS: 2.5, showBehind: false })
    expect(s.inputs).toEqual({
      ...DEFAULT_INPUTS,
      traceSeconds: 8,
      showClutch: false,
      showGearSpeed: false
    })
    expect(s.widgets.standings).toEqual({
      ...defaultWidget('standings'),
      ...v3.widgets.standings
    })
  })

  it('ignores mistyped v3 flags and lets v4 fields win over them', () => {
    const bad = normalizeSettings({
      standings: { showPositionsGained: 'false', showIRating: null, showRatingsHeader: 0 }
    })
    expect(bad.standings).toEqual(DEFAULT_STANDINGS)

    const mixed = normalizeSettings({
      standings: {
        showRatingsHeader: false,
        headerSafetyRating: true,
        showLastLap: false,
        columns: DEFAULT_COLUMNS
      }
    })
    expect(mixed.standings.headerSafetyRating).toBe(true)
    expect(mixed.standings.columns).toEqual(DEFAULT_COLUMNS)
    // A file with v4 columns is not migrated: the stale header flag is ignored too.
    expect(mixed.standings.headerIRating).toBe(true)
  })
})

describe('normalizeSettings: shortcuts', () => {
  it('gives an older file without the section the default shortcuts', () => {
    expect(normalizeSettings({ version: 4 }).shortcuts).toEqual(DEFAULT_SHORTCUTS)
    expect(normalizeSettings({ shortcuts: 'Ctrl+Shift+H' }).shortcuts).toEqual(DEFAULT_SHORTCUTS)
  })

  it('stores each combination in its canonical spelling, and keeps a turned-off one', () => {
    const s = normalizeSettings({
      shortcuts: { toggleOverlay: 'commandorcontrol+alt+shift+o', toggleEditMode: '' }
    })
    expect(s.shortcuts).toEqual({ toggleOverlay: 'Ctrl+Alt+Shift+O', toggleEditMode: '' })
  })

  it('replaces invalid, reserved or modifier-less combinations with the default', () => {
    for (const bad of [
      'Ctrl+C',
      'Alt+F4',
      'Ctrl+Shift+Escape',
      'Escape',
      'F5',
      'Shift+A',
      'Win+H',
      'Ctrl+ñ',
      'Ctrl+Tab',
      'nonsense',
      null,
      7,
      true,
      { key: 'H' },
      ['Ctrl+Shift+H']
    ]) {
      expect(
        normalizeSettings({ shortcuts: { toggleOverlay: bad } }).shortcuts.toggleOverlay,
        JSON.stringify(bad)
      ).toBe('Ctrl+Shift+H')
    }
  })

  it('keeps an AltGr-like combination (only a warning when assigning it)', () => {
    expect(
      normalizeSettings({ shortcuts: { toggleEditMode: 'Ctrl+Alt+E' } }).shortcuts.toggleEditMode
    ).toBe('Ctrl+Alt+E')
  })

  it('gives a combination repeated on disk to the first action only, the later is turned off', () => {
    expect(
      normalizeSettings({
        shortcuts: { toggleOverlay: 'Ctrl+Alt+F9', toggleEditMode: 'ctrl+alt+f9' }
      }).shortcuts
    ).toEqual({ toggleOverlay: 'Ctrl+Alt+F9', toggleEditMode: '' })
    // A default counts: an edited first action that takes the second's default wins it.
    expect(normalizeSettings({ shortcuts: { toggleOverlay: 'Ctrl+Shift+E' } }).shortcuts).toEqual({
      toggleOverlay: 'Ctrl+Shift+E',
      toggleEditMode: ''
    })
    expect(
      normalizeSettings({ shortcuts: { toggleOverlay: '', toggleEditMode: '' } }).shortcuts
    ).toEqual({ toggleOverlay: '', toggleEditMode: '' })
  })

  it('round-trips through the file', () => {
    const saved = createDefaultSettings()
    saved.shortcuts = { toggleOverlay: 'F13', toggleEditMode: 'Ctrl+Alt+PageUp' }
    expect(normalizeSettings(JSON.parse(JSON.stringify(saved)))).toEqual(saved)
  })
})

describe('normalizeSettings: visibility', () => {
  it('gives an older file without the section the defaults: hide with the UI and in the garage, follow replays', () => {
    expect(normalizeSettings({ version: 4 }).visibility).toEqual(DEFAULT_VISIBILITY)
    expect(normalizeSettings({ visibility: 'hide' }).visibility).toEqual(DEFAULT_VISIBILITY)
  })

  it('keeps valid values and replaces invalid ones field by field', () => {
    const v = {
      hideWithSimUi: false,
      hideInGarage: false,
      hideOnSessionScreen: false,
      replays: 'hide',
      showWhileWaiting: true
    }
    expect(normalizeSettings({ visibility: v }).visibility).toEqual(v)
    expect(
      normalizeSettings({
        visibility: {
          hideWithSimUi: 'no',
          hideInGarage: 0,
          hideOnSessionScreen: 'yes',
          replays: 'skip',
          showWhileWaiting: 1
        }
      }).visibility
    ).toEqual(DEFAULT_VISIBILITY)
  })

  it('gives a file from before the session-screen and waiting options their defaults (B06, B21)', () => {
    const old = { hideWithSimUi: false, hideInGarage: true, replays: 'hide' }
    expect(normalizeSettings({ visibility: old }).visibility).toEqual({
      ...old,
      hideOnSessionScreen: true,
      showWhileWaiting: false
    })
    // Each widget's exception: only the standings stay on the session screen by default.
    const widgets = normalizeSettings({ version: 4, widgets: { radar: { visible: true } } }).widgets
    expect(WIDGET_IDS.filter((id) => widgets[id].showOnSessionScreen)).toEqual(['standings'])
    const kept = normalizeSettings({ widgets: { radar: { showOnSessionScreen: true } } }).widgets
    expect(kept.radar.showOnSessionScreen).toBe(true)
    const bad = normalizeSettings({ widgets: { standings: { showOnSessionScreen: 'no' } } })
    expect(bad.widgets.standings.showOnSessionScreen).toBe(true)
  })
})
