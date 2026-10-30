import { describe, expect, it } from 'vitest'
import { NO_WIDGET_MORE, NO_WIDGET_SHORTCUTS } from '../testing/shortcuts'
import type {
  AlertsOptions,
  AppearanceSettings,
  CustomizeZoneId,
  ElementEntry,
  InfoBarEntryId,
  InfoItemId,
  SettingsWindowOptions,
  BattleOptions,
  DeltaOptions,
  FuelOptions,
  InputsOptions,
  LayoutOptionSet,
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
import { syncActiveLayout } from './layouts'
import {
  ALERTS_HOLD_MAX_S,
  SETTINGS_VERSION,
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

/** An element list: every id in order, shown unless hidden. */
function list<Id extends string>(
  ids: readonly Id[],
  hidden: readonly Id[] = []
): ElementEntry<Id>[] {
  return ids.map((id) => ({ id, visible: !hidden.includes(id) }))
}

/** Every info item in the catalog's order: a bar lists its hidden ones in it, after its own. */
const CATALOG: readonly InfoItemId[] = [
  'title',
  'session',
  'remaining',
  'clock',
  'sof',
  'carCount',
  'incidents',
  'iRating',
  'safetyRating',
  'fastestLap',
  'fuelLaps',
  'trackTemp',
  'wet',
  'wind',
  'airTemp',
  'rubber'
]

/** An info bar showing `shown` in that order (the split marker among them), the rest hidden. */
function bar(
  shown: readonly InfoBarEntryId[],
  without: readonly InfoBarEntryId[] = []
): ElementEntry<InfoBarEntryId>[] {
  const rest = CATALOG.filter((id) => !shown.includes(id) && !without.includes(id))
  return [
    ...shown.map((id) => ({ id, visible: true })),
    ...rest.map((id) => ({ id, visible: false }))
  ]
}

// Literal v5 defaults: a change to the schema must show up here on purpose.
const DEFAULT_APPEARANCE: AppearanceSettings = {
  accent: '#ffc400',
  fontScale: 100,
  backgroundOpacity: 0.8,
  density: 'comfortable',
  nameFormat: 'abbr',
  licenseStyle: 'outline',
  numberStyle: 'chip',
  brandLogos: 'color',
  brandMarks: 'auto',
  countryFlags: true,
  penaltyFlags: true,
  colorBlind: false,
  units: 'metric',
  stripes: true,
  textHalo: 'auto',
  showSimPill: true,
  language: 'es'
}
const DEFAULT_VISIBILITY: VisibilityOptions = {
  showWhen: 'car',
  hideWithSimUi: true,
  hideInGarage: true,
  hideOnSessionScreen: true,
  replays: 'hide',
  showWhileWaiting: false
}
const FOOTER: readonly InfoBarEntryId[] = ['trackTemp', 'wet', 'wind', 'airTemp', 'rubber', 'split']
const DEFAULT_RELATIVE: RelativeOptions = {
  carsAhead: 3,
  carsBehind: 3,
  // iRating then licence, and the PIT column hidden (its badge after the name), R10.
  columns: list(
    ['pos', 'driver', 'ir', 'lic', 'pit', 'tyre', 'stint', 'gap'],
    ['pit', 'tyre', 'stint']
  ),
  // One rule for the bars (R13): session data on by default in the standings only.
  headerBar: bar(['title', 'split']),
  headerBarSize: 'normal',
  // The conditions footer: off in the relative (a free-size window), every reading on.
  footerBar: bar(FOOTER),
  footerBarSize: 'off',
  conditionsTrend: true,
  conditionsWindDirection: true,
  columnHeads: false,
  brandMarks: 'inherit',
  countryFlags: 'inherit',
  showFlags: 'inherit',
  nameFormat: 'inherit',
  density: 'inherit'
}
const DEFAULT_RADAR: RadarOptions = {
  rangeM: 20,
  parts: list(['guides', 'sideAlerts', 'rangeLabels'])
}
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
  headerBar: bar(['title', 'session', 'sof', 'split', 'incidents', 'remaining']),
  headerBarSize: 'normal',
  subheaderBar: bar(['iRating', 'fastestLap', 'split', 'safetyRating']),
  subheaderBarSize: 'normal',
  // The conditions footer: on in the standings (it grows by the line), every reading on.
  footerBar: bar([...FOOTER, 'carCount']),
  footerBarSize: 'normal',
  conditionsTrend: true,
  conditionsWindDirection: true,
  classLine: list(['sof', 'carCount']),
  columnHeads: false,
  brandMarks: 'inherit',
  countryFlags: 'inherit',
  showFlags: 'inherit',
  nameFormat: 'inherit',
  iRatingDeltaAll: false,
  density: 'inherit'
}
const DEFAULT_BATTLE: BattleOptions = {
  headerBar: bar(['title', 'split', 'remaining']),
  headerBarSize: 'off',
  footerBar: bar(['split', 'fuelLaps']),
  footerBarSize: 'off',
  conditionsTrend: true,
  conditionsWindDirection: true,
  thresholdS: 1.5,
  lanes: list(['ahead', 'behind']),
  layout: 'stacked',
  rows: list(['prediction', 'sectors', 'laps'], ['laps']),
  parts: list(['rating', 'license', 'trendNote', 'stake']),
  holdS: 3,
  brandMarks: 'inherit',
  countryFlags: 'inherit',
  showFlags: 'inherit',
  nameFormat: 'inherit'
}
const DEFAULT_INPUTS: InputsOptions = {
  traceSeconds: 5,
  sections: list(['trace', 'bars', 'info', 'car']),
  bars: list(['clutch', 'brake', 'throttle']),
  info: list(['gear', 'speed', 'steering']),
  clutchInTrace: true,
  traceWidth: 2,
  colors: { throttle: '#3ddc84', brake: '#ff4545', clutch: '#4aa3ff' },
  steeringStyle: 'bar',
  wheelSize: 'medium',
  wheelColor: 'accent',
  steeringDegrees: false,
  shiftLights: true,
  car: list(['rpm', 'bias', 'tc', 'ffb'])
}
const DEFAULT_TRAFFIC: TrafficOptions = {
  behindS: 12,
  aheadS: 8,
  hazardS: 8,
  maxEntries: 3,
  groups: list(['hazard', 'slower', 'faster']),
  parts: list(['icon', 'cls', 'driver', 'lead', 'value', 'sector']),
  headerBar: bar(['title', 'split']),
  headerBarSize: 'normal',
  footerBar: bar(['split', 'carCount']),
  footerBarSize: 'off',
  conditionsTrend: true,
  conditionsWindDirection: true,
  captions: true,
  onlyMulticlass: true,
  brandMarks: 'inherit',
  countryFlags: 'inherit',
  showFlags: 'inherit',
  nameFormat: 'inherit'
}
/**
 * The bars a section saved before they were lists (a file of version 4 or older) keeps: those of
 * before 2.3 (migrateOldBars), not R13's new defaults.
 */
const OLD_RELATIVE_BARS = { headerBar: bar(['title', 'session', 'split', 'incidents']) }
const OLD_STANDINGS_BARS = {
  headerBar: bar(['session', 'sof', 'carCount', 'split', 'incidents', 'remaining']),
  footerBar: bar(FOOTER)
}
const OLD_BATTLE_BARS = {
  headerBar: bar(['title', 'split']),
  footerBar: bar(['remaining', 'split', 'fuelLaps'])
}
/** What a battle / traffic section saved before 2.3 gets (migrateDriverBlock): its old look. */
const OLD_BATTLE = { showFlags: false, countryFlags: false } as const
const OLD_TRAFFIC = { brandMarks: 'off', countryFlags: false, showFlags: false } as const
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
  holdS: 3,
  parts: list(['notes', 'chips'])
}
const DEFAULT_SHORTCUTS: ShortcutSettings = {
  toggleOverlay: 'Ctrl+Shift+H',
  toggleEditMode: 'Ctrl+Shift+E',
  cycleDeltaReference: '',
  nextLayout: '',
  openSettings: 'Ctrl+Shift+O',
  ...NO_WIDGET_SHORTCUTS
}
const DEFAULT_DELTA: DeltaOptions = {
  referencePractice: 'pb',
  referenceQualify: 'optimal',
  referenceRace: 'optimal',
  fallback: true,
  rangeS: 1,
  rows: list(['top', 'bar', 'sectors', 'laps'], ['laps']),
  top: list(['state', 'predicted', 'reference']),
  laps: list(['last', 'best', 'optimal', 'pb'], ['pb'])
}
const DEFAULT_FUEL: FuelOptions = {
  headerBar: bar(['title', 'split'], ['fuelLaps']),
  headerBarSize: 'off',
  footerBar: bar(['trackTemp', 'split'], ['fuelLaps']),
  footerBarSize: 'off',
  conditionsTrend: true,
  conditionsWindDirection: true,
  lines: list(['hero', 'gauge', 'perLap', 'finish', 'window', 'save', 'tyres', 'limits']),
  showBox: true,
  avgLaps: 5,
  marginLaps: 0.5
}
const DEFAULT_LIGHTS: LightsOptions = {
  layout: 'row',
  labelSide: 'right',
  onlyWhenLit: false,
  showCaptions: false,
  showTemps: false,
  showRepairTime: true,
  repairCrewTag: true,
  repairRealTime: false,
  icons: list(
    [
      'oilPressure',
      'fuelPressure',
      'stalled',
      'repair',
      'repairOptional',
      'water',
      'oilTemp',
      'pitLimiter',
      'revLimiter'
    ],
    ['pitLimiter', 'revLimiter']
  ),
  showTrend: true
}
/** Every page's "Personalizar" zones, in order: the first of each page open. */
const CUSTOMIZE_ZONES: readonly CustomizeZoneId[] = [
  'relative.columns',
  'relative.headerBar',
  'relative.footerBar',
  'radar.parts',
  'standings.columns',
  'standings.classLine',
  'standings.headerBar',
  'standings.subheaderBar',
  'standings.footerBar',
  'battle.lanes',
  'battle.rows',
  'battle.parts',
  'battle.headerBar',
  'battle.footerBar',
  'inputs.sections',
  'inputs.bars',
  'inputs.info',
  'inputs.car',
  'traffic.groups',
  'traffic.parts',
  'traffic.headerBar',
  'traffic.footerBar',
  'alerts.parts',
  'delta.rows',
  'delta.top',
  'delta.laps',
  'fuel.lines',
  'fuel.headerBar',
  'fuel.footerBar',
  'lights.icons'
]
const FIRST_ZONES: readonly CustomizeZoneId[] = [
  'relative.columns',
  'radar.parts',
  'standings.columns',
  'battle.lanes',
  'inputs.sections',
  'traffic.groups',
  'alerts.parts',
  'delta.rows',
  'fuel.lines',
  'lights.icons'
]
const DEFAULT_SETTINGS_WINDOW: SettingsWindowOptions = {
  stageScene: 'dark',
  customizeOpen: list(
    CUSTOMIZE_ZONES,
    CUSTOMIZE_ZONES.filter((id) => !FIRST_ZONES.includes(id))
  ),
  previewHint: true,
  shortcutToasts: true,
  previewFold: 'auto',
  welcome: false
}

/** Visibility of `id` in a list (the tests read the lists through this). */
function shown(l: readonly ElementEntry[], id: string): boolean {
  return l.some((e) => e.id === id && e.visible)
}

function defaultWidget(id: WidgetId): WidgetSettings {
  const def = WIDGET_DEFS[id]
  return {
    visible: def.defaultVisible,
    bounds: { ...def.defaultBounds },
    locked: false,
    // Every widget follows the global background (Apariencia) on a fresh install.
    backgroundOpacity: 'inherit',
    scale: 100,
    autoHeight: def.sizeModel === 'auto-height',
    anchor: 'top',
    showIn: { ...def.defaultShowIn },
    hideInPits: false,
    showOnSessionScreen: id === 'standings'
  }
}

/** Every widget's options as a fresh install has them (a layout's, the shared ones). */
function defaultOptionSet(): LayoutOptionSet {
  const widgets = Object.fromEntries(
    WIDGET_IDS.map((id) => {
      const { backgroundOpacity, autoHeight, anchor, showIn, hideInPits, showOnSessionScreen } =
        defaultWidget(id)
      return [
        id,
        { backgroundOpacity, autoHeight, anchor, showIn, hideInPits, showOnSessionScreen }
      ]
    })
  ) as LayoutOptionSet['widgets']
  return {
    sections: {
      relative: DEFAULT_RELATIVE,
      radar: DEFAULT_RADAR,
      standings: DEFAULT_STANDINGS,
      battle: DEFAULT_BATTLE,
      inputs: DEFAULT_INPUTS,
      traffic: DEFAULT_TRAFFIC,
      alerts: DEFAULT_ALERTS,
      delta: DEFAULT_DELTA,
      fuel: DEFAULT_FUEL,
      lights: DEFAULT_LIGHTS
    },
    widgets
  }
}

const cols = (s: OverlaySettings): string[] =>
  s.standings.columns.map((c) => `${c.visible ? '+' : '-'}${c.id}`)

describe('DEFAULT_SETTINGS', () => {
  it('is the documented v6 defaults, built from WIDGET_DEFS', () => {
    expect(DEFAULT_SETTINGS).toEqual<OverlaySettings>({
      version: 6,
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
      shortcuts: DEFAULT_SHORTCUTS,
      settingsWindow: DEFAULT_SETTINGS_WINDOW,
      layouts: { autoSwitch: false, sort: 'custom' },
      savedLayouts: {
        activeId: 'layout-1',
        list: [
          {
            id: 'layout-1',
            name: 'Principal',
            mode: 'full',
            widgets: Object.fromEntries(
              WIDGET_IDS.map((id) => {
                const { bounds, scale, visible, locked } = defaultWidget(id)
                return [id, { bounds, scale, visible, locked }]
              })
            ) as OverlaySettings['savedLayouts']['list'][number]['widgets'],
            options: defaultOptionSet()
          }
        ],
        links: [],
        seenCars: [],
        shared: defaultOptionSet()
      },
      shortcutsMore: {
        toggleOverlay: [],
        toggleEditMode: [],
        cycleDeltaReference: [],
        nextLayout: [],
        openSettings: [],
        ...NO_WIDGET_MORE()
      },
      buttonDeviceNames: {}
    })
  })

  it('makes standings, battle, traffic, alerts, fuel and pedals auto-height, battle race-only', () => {
    expect(DEFAULT_SETTINGS.widgets.standings.autoHeight).toBe(true)
    expect(DEFAULT_SETTINGS.widgets.battle.autoHeight).toBe(true)
    expect(DEFAULT_SETTINGS.widgets.traffic.autoHeight).toBe(true)
    expect(DEFAULT_SETTINGS.widgets.alerts.autoHeight).toBe(true)
    expect(DEFAULT_SETTINGS.widgets.fuel.autoHeight).toBe(true)
    // The pedals fit their content (v2.6).
    expect(DEFAULT_SETTINGS.widgets.inputs.autoHeight).toBe(true)
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

  it('makes the fuel widget auto-height, in practice and races (R44)', () => {
    expect(DEFAULT_SETTINGS.widgets.fuel.autoHeight).toBe(true)
    expect(DEFAULT_SETTINGS.widgets.fuel.showIn).toEqual({
      practice: true,
      qualify: false,
      race: true
    })
  })

  it('keeps a saved fuel widget race-only (R44 changes the default of new installs only)', () => {
    const s = normalizeSettings({
      widgets: { fuel: { showIn: { practice: false, qualify: false, race: true } } }
    })
    expect(s.widgets.fuel.showIn).toEqual({ practice: false, qualify: false, race: true })
  })

  it('takes the traffic, alerts and delta windows from WIDGET_DEFS', () => {
    for (const id of ['traffic', 'alerts', 'delta'] as const) {
      const w = DEFAULT_SETTINGS.widgets[id]
      const def = WIDGET_DEFS[id]
      expect(w.bounds).toEqual(def.defaultBounds)
      expect(w.visible).toBe(def.defaultVisible)
      expect(w.backgroundOpacity).toBe('inherit')
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
    const d = DEFAULT_SETTINGS.delta
    for (const r of [d.referencePractice, d.referenceQualify, d.referenceRace]) {
      expect(DELTA_REFERENCES).toContain(r)
    }
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
    const bg = DEFAULT_SETTINGS.appearance.backgroundOpacity
    expect(bg).toBe(0.8)
    expect(bg).toBeGreaterThanOrEqual(BACKGROUND_OPACITY_MIN)
    expect(bg).toBeLessThanOrEqual(BACKGROUND_OPACITY_MAX)
    for (const id of WIDGET_IDS) {
      const w = widgets[id]
      expect(w.backgroundOpacity).toBe('inherit')
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

  it("follows the accent with the wheel's mark: new installs, and a file that chose it (R46)", () => {
    expect(DEFAULT_SETTINGS.inputs.wheelColor).toBe('accent')
    expect(normalizeSettings({ inputs: { wheelColor: 'accent' } }).inputs.wheelColor).toBe('accent')
    // A saved colour (the old default, the yellow accent) stays its own.
    expect(normalizeSettings({ inputs: { wheelColor: '#FFC400' } }).inputs.wheelColor).toBe(
      '#ffc400'
    )
    // Only where the schema allows it: the accent itself is a colour.
    expect(normalizeSettings({ appearance: { accent: 'accent' } }).appearance.accent).toBe(
      DEFAULT_SETTINGS.appearance.accent
    )
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
    s.battle = {
      ...DEFAULT_BATTLE,
      layout: 'side',
      rows: list(['laps', 'sectors', 'prediction']),
      holdS: 6.5,
      brandMarks: 'off',
      countryFlags: true
    }
    s.inputs = {
      ...DEFAULT_INPUTS,
      traceWidth: 2.5,
      colors: { throttle: '#22c55e', brake: '#f43f5e', clutch: '#2f6db5' },
      sections: list(['info', 'bars', 'trace', 'car'], ['trace', 'car'])
    }
    s.relative = {
      ...DEFAULT_RELATIVE,
      columns: list(['gap', 'driver', 'pos', 'lic', 'ir', 'tyre', 'stint', 'pit'], ['ir', 'pit']),
      headerBar: bar(['clock', 'split', 'remaining', 'incidents']),
      headerBarSize: 'large',
      footerBarSize: 'small',
      columnHeads: true,
      brandMarks: 'on',
      countryFlags: false
    }
    s.lights = { ...DEFAULT_LIGHTS, layout: 'column', labelSide: 'left' }
    s.settingsWindow = {
      stageScene: 'light',
      customizeOpen: list(CUSTOMIZE_ZONES, ['relative.columns', 'fuel.lines']),
      previewHint: false,
      shortcutToasts: false,
      previewFold: 'small',
      welcome: true
    }
    s.shortcuts = { ...DEFAULT_SHORTCUTS, cycleDeltaReference: 'Ctrl+Alt+D' }
    s.widgets.traffic = { ...s.widgets.traffic, anchor: 'bottom', scale: 90, hideInPits: true }
    s.widgets.alerts = { ...s.widgets.alerts, visible: false, backgroundOpacity: 0.5 }
    s.traffic = {
      ...DEFAULT_TRAFFIC,
      behindS: 20,
      aheadS: 4,
      hazardS: 15,
      maxEntries: 5,
      groups: list(['faster', 'hazard', 'slower'], ['slower']),
      onlyMulticlass: false,
      nameFormat: 'tv'
    }
    s.alerts = { ...DEFAULT_ALERTS, showBlue: false, holdS: 0.5 }
    s.widgets.delta = { ...s.widgets.delta, scale: 130, hideInPits: true }
    s.delta = {
      referencePractice: 'class',
      referenceQualify: 'session',
      referenceRace: 'classOptimal',
      fallback: false,
      rangeS: 2.25,
      rows: list(['laps', 'top', 'bar', 'sectors'], ['sectors']),
      top: list(['state', 'predicted', 'reference'], ['predicted', 'state']),
      laps: list(['optimal', 'pb', 'last', 'best'])
    }
    // The layout in use is the widgets (layouts.ts).
    syncActiveLayout(s)
    const raw = JSON.parse(JSON.stringify(s))
    expect(normalizeSettings(raw)).toEqual(s)
    expect(normalizeSettings(normalizeSettings(raw))).toEqual(s)
  })

  it("opens each page's first accordion for a file from before them, keeps a file's own", () => {
    expect(normalizeSettings({ settingsWindow: { stageScene: 'light' } }).settingsWindow).toEqual({
      ...DEFAULT_SETTINGS_WINDOW,
      stageScene: 'light'
    })
    // A zone the file does not know yet starts closed; an unknown one is dropped.
    const own = normalizeSettings({
      settingsWindow: {
        customizeOpen: [
          { id: 'fuel.lines', visible: true },
          { id: 'relative.columns', visible: false },
          { id: 'gone.zone', visible: true }
        ]
      }
    }).settingsWindow.customizeOpen
    expect(own.map((e) => e.id)).toEqual(CUSTOMIZE_ZONES)
    expect(own.filter((e) => e.visible).map((e) => e.id)).toEqual(['fuel.lines'])
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
    expect(s.version).toBe(SETTINGS_VERSION)
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

  it('clamps the background opacity, keeps "inherit", defaulting anything else to it', () => {
    const opacity = (value: unknown): number | 'inherit' =>
      widget('radar', { backgroundOpacity: value }).backgroundOpacity
    expect(opacity(-1)).toBe(0)
    expect(opacity(2)).toBe(1)
    expect(opacity(0.35)).toBe(0.35)
    // A file's own number stays, the old per-widget defaults included (lossless).
    expect(opacity(0.78)).toBe(0.78)
    expect(opacity('inherit')).toBe('inherit')
    for (const bad of [Number.NaN, Infinity, '0.5', null, true, {}]) {
      expect(opacity(bad)).toBe('inherit')
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
    expect(
      normalizeSettings({ version: SETTINGS_VERSION, relative: { carsAhead: -2, carsBehind: 99 } })
        .relative
    ).toEqual({
      ...DEFAULT_RELATIVE,
      carsAhead: 0,
      carsBehind: 10
    })
    expect(
      normalizeSettings({
        version: SETTINGS_VERSION,
        relative: { carsAhead: 2.6, carsBehind: 0.4 }
      }).relative
    ).toEqual({
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
      normalizeSettings({ version: SETTINGS_VERSION, traffic: raw }).traffic
    expect(traffic({ behindS: 1, aheadS: 99, hazardS: 0, maxEntries: 9 })).toEqual({
      ...DEFAULT_TRAFFIC,
      ...OLD_TRAFFIC,
      behindS: 2,
      aheadS: 30,
      hazardS: 2,
      maxEntries: 5
    })
    expect(traffic({ behindS: 14.6, aheadS: 5.4, hazardS: 25, maxEntries: 0.2 })).toEqual({
      ...DEFAULT_TRAFFIC,
      ...OLD_TRAFFIC,
      behindS: 15,
      aheadS: 5,
      hazardS: 20,
      maxEntries: 1
    })
    for (const bad of [Number.NaN, Infinity, '10', null, true, {}]) {
      expect(traffic({ behindS: bad, aheadS: bad, hazardS: bad, maxEntries: bad })).toEqual({
        ...DEFAULT_TRAFFIC,
        ...OLD_TRAFFIC
      })
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
    const ref = (referenceRace: unknown): string =>
      normalizeSettings({ delta: { referenceRace } }).delta.referenceRace
    for (const ok of ['pb', 'session', 'optimal', 'class', 'classOptimal']) expect(ref(ok)).toBe(ok)
    for (const bad of ['PB', 'best', 'Optimal', 'sessionOptimal', '', null, 1]) {
      expect(ref(bad)).toBe('optimal')
    }
    // A file from before the references per session keeps a choice of its own everywhere...
    const old = normalizeSettings({ delta: { reference: 'session', fallback: false } }).delta
    expect(old).toMatchObject({
      referencePractice: 'session',
      referenceQualify: 'session',
      referenceRace: 'session',
      fallback: false
    })
    // ...and the old default ('pb', every file had it) becomes the new defaults.
    expect(normalizeSettings({ delta: { reference: 'pb' } }).delta).toEqual(DEFAULT_DELTA)
    // Once it has them, the old field is ignored.
    expect(
      normalizeSettings({ delta: { reference: 'class', referenceRace: 'pb' } }).delta
    ).toMatchObject({ referencePractice: 'pb', referenceQualify: 'optimal', referenceRace: 'pb' })
  })

  it('gives a file from before the brand logo setting colour logos, keeping the rest', () => {
    const old = normalizeSettings({
      appearance: { accent: '#a3e635', numberStyle: 'stripe', showSimPill: false }
    }).appearance
    expect(old).toEqual({
      ...DEFAULT_APPEARANCE,
      accent: '#a3e635',
      numberStyle: 'stripe',
      showSimPill: false,
      brandLogos: 'color'
    })
  })

  it('validates every enum', () => {
    const s = normalizeSettings({
      version: SETTINGS_VERSION,
      appearance: {
        density: 'tiny',
        nameFormat: 'inherit',
        licenseStyle: 'x',
        units: 'si',
        brandLogos: 'grey'
      },
      standings: { mode: 'Full', gapMode: 'toString', nameFormat: 'nick', density: 'huge' },
      battle: { layout: 'grid', detail: 'all', nameFormat: 'TV' },
      // A saved section has the shift lights (without them it is from before: off).
      inputs: {
        steeringStyle: 'yoke',
        layout: 'stacked',
        shiftLights: true,
        sections: DEFAULT_INPUTS.sections
      },
      traffic: { nameFormat: 'short' }
    })
    expect(s).toEqual(withOldDriverBlocks(DEFAULT_SETTINGS))
    const ok = normalizeSettings({
      appearance: {
        density: 'compact',
        nameFormat: 'surname',
        textHalo: 'off',
        brandLogos: 'mono'
      },
      standings: { mode: 'full', gapMode: 'both', nameFormat: 'full', density: 'comfortable' },
      battle: { layout: 'side', detail: 'none' },
      inputs: { steeringStyle: 'wheel', layout: 'info-bars-trace' },
      traffic: { nameFormat: 'surname' }
    })
    expect(ok.traffic.nameFormat).toBe('surname')
    expect(ok.appearance).toMatchObject({
      density: 'compact',
      nameFormat: 'surname',
      textHalo: 'off',
      brandLogos: 'mono'
    })
    expect(ok.standings).toMatchObject({ mode: 'full', gapMode: 'both', nameFormat: 'full' })
    // The old detail and layout choices become the battle's rows and the pedals' blocks.
    expect(ok.battle).toMatchObject({
      layout: 'side',
      rows: list(['prediction', 'sectors', 'laps'], ['sectors', 'laps'])
    })
    // The one wheel of before is the realistic one; the car block, new, comes hidden.
    expect(ok.inputs).toMatchObject({
      steeringStyle: 'realistic',
      sections: list(['info', 'bars', 'trace', 'car'], ['car'])
    })
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
      version: SETTINGS_VERSION,
      appearance: { colorBlind: 1, stripes: 'no', showSimPill: null },
      standings: { iRatingDeltaAll: 'yes', headerIRating: 0, showSof: [] },
      battle: { showPrediction: 'false', showAhead: 0 },
      inputs: {
        clutchInTrace: {},
        showClutch: 'off',
        shiftLights: 'on',
        sections: DEFAULT_INPUTS.sections
      },
      traffic: { showFaster: 0, showSlower: 'no', showHazards: null, onlyMulticlass: 'false' },
      alerts: { showFlags: 1, showBlue: 'off', showPitLimiter: [] },
      delta: { fallback: 0, showPredicted: 'no', showSectors: null, showTrend: {} }
    })
    expect(bad).toEqual(withOldDriverBlocks(DEFAULT_SETTINGS))
    const ok = normalizeSettings({
      version: SETTINGS_VERSION,
      traffic: { showFaster: false, showHazards: false, onlyMulticlass: false },
      alerts: { showFlags: false, showPitLimiter: false }
    })
    expect(ok.traffic).toEqual({
      ...DEFAULT_TRAFFIC,
      ...OLD_TRAFFIC,
      groups: list(['hazard', 'slower', 'faster'], ['hazard', 'faster']),
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
    expect(s.version).toBe(SETTINGS_VERSION)
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
    expect(s.relative).toEqual({
      ...DEFAULT_RELATIVE,
      ...OLD_RELATIVE_BARS,
      carsAhead: 5,
      carsBehind: 2
    })
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
    syncActiveLayout(before)
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
    syncActiveLayout(before)
    const raw = JSON.parse(JSON.stringify(before)) as Record<string, unknown>
    delete raw.traffic
    delete raw.alerts
    const widgets = raw.widgets as Record<string, unknown>
    delete widgets.traffic
    delete widgets.alerts
    const s = normalizeSettings(raw)
    expect(s).toEqual(before)
    expect(s.version).toBe(SETTINGS_VERSION)
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
      relative: {
        carsAhead: 3,
        carsBehind: 3,
        showClassPosition: true,
        showLicense: false,
        showIRating: true
      },
      radar: { rangeM: 50, showRangeLabels: false }
    }
    const s = normalizeSettings(v2)
    expect(s.widgets.relative).toEqual({ ...defaultWidget('relative'), ...v2.widgets.relative })
    expect(s.relative).toEqual({
      ...DEFAULT_RELATIVE,
      ...OLD_RELATIVE_BARS,
      // Its old toggles on today's list: iRating, licence (off), the PIT column hidden.
      columns: list(
        ['pos', 'driver', 'ir', 'lic', 'pit', 'tyre', 'stint', 'gap'],
        ['lic', 'pit', 'tyre', 'stint']
      )
    })
    expect(s.radar).toEqual({
      rangeM: 50,
      parts: list(['guides', 'sideAlerts', 'rangeLabels'], ['rangeLabels'])
    })
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
      ...OLD_STANDINGS_BARS,
      mode: 'full',
      topRows: 5,
      aroundRows: 2,
      otherClassLeaders: false,
      gapMode: 'leader',
      columns: s.standings.columns,
      // The ratings header toggle: both projections off, on the header's second line.
      subheaderBar: DEFAULT_STANDINGS.subheaderBar.map((e) =>
        e.id === 'iRating' || e.id === 'safetyRating' ? { ...e, visible: false } : e
      )
    })
    // The old per-row iRating delta (on by default in v3) is not carried over.
    expect(s.standings.iRatingDeltaAll).toBe(false)
    expect('showPositionsGained' in s.standings).toBe(false)
    expect('showRatingsHeader' in s.standings).toBe(false)
    expect(s.battle).toEqual({
      ...DEFAULT_BATTLE,
      ...OLD_BATTLE,
      ...OLD_BATTLE_BARS,
      thresholdS: 2.5,
      lanes: list(['ahead', 'behind'], ['behind'])
    })
    expect(s.inputs).toEqual({
      ...DEFAULT_INPUTS,
      traceSeconds: 8,
      bars: list(['clutch', 'brake', 'throttle'], ['clutch']),
      info: list(['gear', 'speed', 'steering'], ['gear', 'speed']),
      // A file from before the car block and the shift lights: they stay off.
      sections: list(['trace', 'bars', 'info', 'car'], ['car']),
      shiftLights: false
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
    // A file with no version reads as old: the bars it drew then (migrateOldBars).
    expect(bad.standings).toEqual({ ...DEFAULT_STANDINGS, ...OLD_STANDINGS_BARS })

    const mixed = normalizeSettings({
      standings: {
        showRatingsHeader: false,
        headerSafetyRating: true,
        showLastLap: false,
        columns: DEFAULT_COLUMNS
      }
    })
    expect(shown(mixed.standings.subheaderBar, 'safetyRating')).toBe(true)
    expect(mixed.standings.columns).toEqual(DEFAULT_COLUMNS)
    // A file with v4 columns is not migrated: the stale header flag is ignored too.
    expect(shown(mixed.standings.subheaderBar, 'iRating')).toBe(true)
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
    expect(s.shortcuts).toEqual({
      toggleOverlay: 'Ctrl+Alt+Shift+O',
      toggleEditMode: '',
      cycleDeltaReference: '',
      nextLayout: '',
      openSettings: 'Ctrl+Shift+O',
      ...NO_WIDGET_SHORTCUTS
    })
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
    ).toEqual({
      toggleOverlay: 'Ctrl+Alt+F9',
      toggleEditMode: '',
      cycleDeltaReference: '',
      nextLayout: '',
      openSettings: 'Ctrl+Shift+O',
      ...NO_WIDGET_SHORTCUTS
    })
    // A default counts: an edited first action that takes the second's default wins it.
    expect(normalizeSettings({ shortcuts: { toggleOverlay: 'Ctrl+Shift+E' } }).shortcuts).toEqual({
      toggleOverlay: 'Ctrl+Shift+E',
      toggleEditMode: '',
      cycleDeltaReference: '',
      nextLayout: '',
      openSettings: 'Ctrl+Shift+O',
      ...NO_WIDGET_SHORTCUTS
    })
    expect(
      normalizeSettings({ shortcuts: { toggleOverlay: '', toggleEditMode: '' } }).shortcuts
    ).toEqual({
      toggleOverlay: '',
      toggleEditMode: '',
      cycleDeltaReference: '',
      nextLayout: '',
      openSettings: 'Ctrl+Shift+O',
      ...NO_WIDGET_SHORTCUTS
    })
  })

  it('round-trips through the file', () => {
    const saved = createDefaultSettings()
    saved.shortcuts = {
      toggleOverlay: 'F13',
      toggleEditMode: 'Ctrl+Alt+PageUp',
      cycleDeltaReference: 'Ctrl+Alt+D',
      nextLayout: '',
      openSettings: '',
      ...NO_WIDGET_SHORTCUTS
    }
    expect(normalizeSettings(JSON.parse(JSON.stringify(saved)))).toEqual(saved)
  })
})

describe('normalizeSettings: visibility', () => {
  it('gives an older file without the section the defaults: only in the car, no replays', () => {
    expect(normalizeSettings({ version: 4 }).visibility).toEqual(DEFAULT_VISIBILITY)
    expect(normalizeSettings({ visibility: 'hide' }).visibility).toEqual(DEFAULT_VISIBILITY)
  })

  it('keeps valid values and replaces invalid ones field by field', () => {
    const v = {
      showWhen: 'always',
      hideWithSimUi: false,
      hideInGarage: false,
      hideOnSessionScreen: false,
      replays: 'follow',
      showWhileWaiting: true
    }
    expect(normalizeSettings({ visibility: v }).visibility).toEqual(v)
    expect(normalizeSettings({ visibility: { ...v, showWhen: 'race' } }).visibility).toEqual({
      ...v,
      showWhen: 'race'
    })
    expect(
      normalizeSettings({
        visibility: {
          showWhen: 'sometimes',
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
      showWhen: 'car',
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

  it('hides replays for a file from before “when to show the overlay”, keeps later choices', () => {
    // Saved with the old default ('follow' = keep the standings), chosen or not.
    const before = { hideWithSimUi: true, hideInGarage: true, replays: 'follow' }
    expect(normalizeSettings({ visibility: before }).visibility).toMatchObject({
      showWhen: 'car',
      replays: 'hide'
    })
    // Chosen with the new option there: kept, through every later load.
    const chosen = { ...before, showWhen: 'car', replays: 'follow' }
    const loaded = normalizeSettings({ visibility: chosen })
    expect(loaded.visibility).toMatchObject({ showWhen: 'car', replays: 'follow' })
    expect(normalizeSettings(loaded).visibility.replays).toBe('follow')
    // An invalid showWhen is still a file with the option: its replays stay.
    const broken = normalizeSettings({ visibility: { ...chosen, showWhen: 1 } })
    expect(broken.visibility).toMatchObject({ showWhen: 'car', replays: 'follow' })
  })
})

describe('normalizeSettings: controller buttons', () => {
  const G29 = 'joy:046d:c24f:0'

  it('keeps a button binding and the names of the controllers bound', () => {
    const s = normalizeSettings({
      shortcuts: { toggleOverlay: `${G29}:7`, nextLayout: 'joy:1dd2:2201:0:40' },
      buttonDeviceNames: {
        [G29]: 'G29 Driving Force Racing Wheel',
        'joy:1dd2:2201:0': 'BU0836X Interface',
        // Not bound any more: forgotten.
        'joy:0eb7:0e05:0': 'Podium'
      }
    })
    expect(s.shortcuts).toEqual({
      toggleOverlay: `${G29}:7`,
      toggleEditMode: 'Ctrl+Shift+E',
      cycleDeltaReference: '',
      nextLayout: 'joy:1dd2:2201:0:40',
      openSettings: 'Ctrl+Shift+O',
      ...NO_WIDGET_SHORTCUTS
    })
    expect(s.buttonDeviceNames).toEqual({
      [G29]: 'G29 Driving Force Racing Wheel',
      'joy:1dd2:2201:0': 'BU0836X Interface'
    })
  })

  it('loads a file from before (no buttons, no names) unchanged: no version bump', () => {
    const before = normalizeSettings({
      version: 6,
      shortcuts: { toggleOverlay: 'Ctrl+Alt+F9', cycleDeltaReference: 'Ctrl+Alt+D' }
    })
    expect(before.version).toBe(6)
    expect(SETTINGS_VERSION).toBe(6)
    expect(before.buttonDeviceNames).toEqual({})
    expect(before.shortcuts).toEqual({
      toggleOverlay: 'Ctrl+Alt+F9',
      toggleEditMode: 'Ctrl+Shift+E',
      cycleDeltaReference: 'Ctrl+Alt+D',
      nextLayout: '',
      openSettings: 'Ctrl+Shift+O',
      ...NO_WIDGET_SHORTCUTS
    })
    // Saved and read again: the same.
    expect(normalizeSettings(JSON.parse(JSON.stringify(before)))).toEqual(before)
  })

  it('round-trips a file with buttons', () => {
    const s = normalizeSettings({
      shortcuts: { toggleEditMode: `${G29}:3` },
      buttonDeviceNames: { [G29]: 'G29' }
    })
    expect(normalizeSettings(JSON.parse(JSON.stringify(s)))).toEqual(s)
  })

  it('gives a button repeated on disk to the first action only', () => {
    expect(
      normalizeSettings({ shortcuts: { toggleOverlay: `${G29}:7`, openSettings: `${G29}:7` } })
        .shortcuts
    ).toMatchObject({ toggleOverlay: `${G29}:7`, openSettings: '' })
  })

  it('replaces a malformed button binding with the default', () => {
    for (const bad of ['joy:046d:c24f:0:0', 'joy:046D:C24F:0:7', 'joy:046d:c24f:7', 'joy:']) {
      expect(normalizeSettings({ shortcuts: { toggleOverlay: bad } }).shortcuts.toggleOverlay).toBe(
        'Ctrl+Shift+H'
      )
    }
    expect(normalizeSettings({ buttonDeviceNames: 'G29' }).buttonDeviceNames).toEqual({})
  })
})

describe('normalizeSettings: several bindings per action', () => {
  const G29 = 'joy:046d:c24f:0'
  const BOX = 'joy:1dd2:2201:0'
  const NONE = {
    toggleOverlay: [],
    toggleEditMode: [],
    cycleDeltaReference: [],
    nextLayout: [],
    openSettings: [],
    ...NO_WIDGET_MORE()
  }

  it('gives a file without extra bindings (every file before 2.2) none, its shortcuts as they are', () => {
    const s = normalizeSettings({ shortcuts: { toggleOverlay: 'F13', openSettings: '' } })
    expect(s.shortcutsMore).toEqual(NONE)
    expect(s.shortcuts).toMatchObject({ toggleOverlay: 'F13', openSettings: '' })
    expect(normalizeSettings({ shortcutsMore: 'F13' }).shortcutsMore).toEqual(NONE)
  })

  it('keeps up to two more per action, valid and in their canonical spelling', () => {
    const s = normalizeSettings({
      shortcuts: { toggleOverlay: 'Ctrl+Shift+H' },
      shortcutsMore: {
        toggleOverlay: [`${G29}:24`, 'ctrl+alt+f9', 'F14'],
        toggleEditMode: ['Shift+E', 7, null, '', `${BOX}:3`],
        nextLayout: 'F15',
        quit: ['F16']
      },
      buttonDeviceNames: { [G29]: 'G29', [BOX]: 'Box' }
    })
    expect(s.shortcuts.toggleOverlay).toBe('Ctrl+Shift+H')
    expect(s.shortcutsMore).toEqual({
      ...NONE,
      // A third one past the limit is dropped.
      toggleOverlay: [`${G29}:24`, 'Ctrl+Alt+F9'],
      toggleEditMode: [`${BOX}:3`]
    })
    // The controllers of the extra bindings keep their names.
    expect(s.buttonDeviceNames).toEqual({ [G29]: 'G29', [BOX]: 'Box' })
    expect(normalizeSettings(JSON.parse(JSON.stringify(s)))).toEqual(s)
  })

  it('drops a binding repeated across actions and slots: the earlier action, or slot, keeps it', () => {
    const s = normalizeSettings({
      shortcuts: {
        toggleOverlay: 'Ctrl+Shift+H',
        toggleEditMode: 'Ctrl+Shift+E',
        nextLayout: 'F13'
      },
      shortcutsMore: {
        toggleOverlay: ['Ctrl+Shift+H', 'F13', `${G29}:1`],
        toggleEditMode: [`${G29}:1`, 'F14'],
        nextLayout: ['F14', 'F15']
      }
    })
    expect(s.shortcuts).toMatchObject({
      toggleOverlay: 'Ctrl+Shift+H',
      toggleEditMode: 'Ctrl+Shift+E',
      // Its first one went to an earlier action: the next one moved up.
      nextLayout: 'F15'
    })
    expect(s.shortcutsMore).toMatchObject({
      toggleOverlay: ['F13', `${G29}:1`],
      toggleEditMode: ['F14'],
      nextLayout: []
    })
  })

  it('moves an extra binding up when the first one is off', () => {
    const s = normalizeSettings({
      shortcuts: { cycleDeltaReference: '' },
      shortcutsMore: { cycleDeltaReference: [`${G29}:9`, 'Ctrl+Alt+D'] }
    })
    expect(s.shortcuts.cycleDeltaReference).toBe(`${G29}:9`)
    expect(s.shortcutsMore.cycleDeltaReference).toEqual(['Ctrl+Alt+D'])
  })
})

/** `settings` as a file with a battle and a traffic section from before 2.3 loads. */
function withOldDriverBlocks(settings: OverlaySettings): OverlaySettings {
  const out = structuredClone(settings)
  // Every copy of the sections: the file's, and each layout's and the shared options' own.
  const walk = (node: unknown): void => {
    if (typeof node !== 'object' || node === null) return
    const rec = node as Record<string, unknown>
    for (const [k, v] of Object.entries(rec)) {
      if (k === 'battle' && typeof v === 'object' && v !== null && 'thresholdS' in v) {
        Object.assign(v, OLD_BATTLE)
      } else if (k === 'traffic' && typeof v === 'object' && v !== null && 'behindS' in v) {
        Object.assign(v, OLD_TRAFFIC)
      } else walk(v)
    }
  }
  walk(out)
  return out
}

describe('the «Piloto» block (R08)', () => {
  it('follows Apariencia on a new install, and keeps a file’s own switches', () => {
    expect(DEFAULT_SETTINGS.relative).toMatchObject({
      brandMarks: 'inherit',
      countryFlags: 'inherit',
      showFlags: 'inherit'
    })
    const s = normalizeSettings({
      relative: { countryFlags: false, showFlags: true, brandMarks: 'off' },
      standings: { countryFlags: 'inherit', showFlags: 'maybe' }
    })
    expect(s.relative).toMatchObject({ countryFlags: false, showFlags: true, brandMarks: 'off' })
    expect(s.standings).toMatchObject({ countryFlags: 'inherit', showFlags: 'inherit' })
  })

  it('draws an old battle and traffic section as before: what they never drew is off', () => {
    const s = normalizeSettings({ battle: { countryFlags: true }, traffic: {} })
    expect(s.battle).toMatchObject({ countryFlags: true, showFlags: false, brandMarks: 'inherit' })
    expect(normalizeSettings({ battle: {} }).battle).toMatchObject(OLD_BATTLE)
    expect(s.traffic).toMatchObject(OLD_TRAFFIC)
    // A file saved since has them: they stay as they are.
    const now = normalizeSettings({
      battle: { showFlags: 'inherit' },
      traffic: { showFlags: true }
    })
    expect(now.battle.showFlags).toBe('inherit')
    expect(now.traffic).toMatchObject({ showFlags: true, brandMarks: 'off', countryFlags: false })
  })
})
