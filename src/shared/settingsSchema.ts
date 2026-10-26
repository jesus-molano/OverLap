/**
 * Single source of truth for every option: type, range, default and whether
 * only the renderer reads it. Defaults, normalisation and patching
 * (settings/), the providers' defensive clamps, main's telemetry-config diff
 * and the settings UI's control ranges are all derived from this table, so a
 * new option is added here (plus its type in types.ts) and nowhere else.
 */
import { DEFAULT_LANGUAGE, LANGUAGES } from './i18n/language'
import { clamp, isFiniteNumber, roundTo } from './num'
import type {
  ConditionsFooterOptions,
  NameFormat,
  OverlaySettings,
  ShowInSessions,
  StandingsColumn,
  StandingsColumnId,
  TelemetryConfig,
  WidgetSettings
} from './types'

/** Option sections of OverlaySettings (everything but version and widgets). */
export type OptionSection = Exclude<keyof OverlaySettings, 'version' | 'widgets'>
/** Option sections the telemetry process receives. */
export type ConfigSection = Exclude<keyof TelemetryConfig, 'enabledWidgets' | 'rules'>

interface SpecBase {
  /** Only the renderer reads it: changing it needs no new telemetry config. */
  readonly displayOnly?: true
}
export interface IntSpec extends SpecBase {
  readonly kind: 'int'
  readonly min: number
  readonly max: number
  readonly default: number
  /** Suggested UI step (default 1). */
  readonly step?: number
}
export interface NumberSpec extends SpecBase {
  readonly kind: 'number'
  readonly min: number
  readonly max: number
  /** Stored rounded to this many decimals, null for no rounding. */
  readonly decimals: number | null
  readonly default: number
  readonly step?: number
}
export interface BoolSpec extends SpecBase {
  readonly kind: 'bool'
  readonly default: boolean
}
export interface EnumSpec<T extends string = string> extends SpecBase {
  readonly kind: 'enum'
  readonly values: readonly T[]
  readonly default: T
}
/** '#rrggbb', lowercase. */
export interface ColorSpec extends SpecBase {
  readonly kind: 'color'
  readonly default: string
}
/** Fixed set of named colours. */
export interface ColorsSpec<K extends string = string> extends SpecBase {
  readonly kind: 'colors'
  readonly default: { readonly [P in K]: string }
}
/** Standings column list: every id exactly once, in display order. */
export interface ColumnsSpec extends SpecBase {
  readonly kind: 'columns'
  readonly default: readonly Readonly<StandingsColumn>[]
}
/**
 * A global shortcut: an assignable combination in its canonical spelling (accelerator.ts), or
 * '' when turned off. The accelerator fields of a section never share a combination.
 */
export interface AcceleratorSpec extends SpecBase {
  readonly kind: 'accelerator'
  readonly default: string
}
export type NumericSpec = IntSpec | NumberSpec
export type OptionSpec =
  NumericSpec | BoolSpec | EnumSpec | ColorSpec | ColorsSpec | ColumnsSpec | AcceleratorSpec

/** The spec kinds allowed for a field of type T (non-distributive on purpose). */
export type SpecFor<T> = [T] extends [boolean]
  ? BoolSpec
  : [T] extends [number]
    ? NumericSpec
    : [T] extends [readonly StandingsColumn[]]
      ? ColumnsSpec
      : [T] extends [string]
        ? string extends T
          ? ColorSpec | AcceleratorSpec
          : EnumSpec<T>
        : [T] extends [Readonly<Record<string, string>>]
          ? ColorsSpec<Extract<keyof T, string>>
          : never

export type OptionSchema = {
  readonly [S in OptionSection]: {
    readonly [F in keyof OverlaySettings[S]]-?: SpecFor<OverlaySettings[S][F]>
  }
}

const NAME_FORMATS = ['full', 'abbr', 'surname', 'tv'] as const satisfies readonly NameFormat[]
const NAME_FORMATS_INHERIT = ['inherit', ...NAME_FORMATS] as const

/** Right-hand standings columns in their default order. */
export const STANDINGS_COLUMN_IDS = [
  'gained',
  'ir',
  'lic',
  'delta',
  'gap',
  'gapLeader',
  'last',
  'best',
  'pit',
  'pitLap',
  'stint',
  'tyre'
] as const satisfies readonly StandingsColumnId[]

// The best lap is the extra most asked for; stint, last stop and tyre are for longer races.
// Files saved before a column existed get it hidden, at the end (normalizeColumns).
const HIDDEN_BY_DEFAULT: ReadonlySet<StandingsColumnId> = new Set([
  'delta',
  'gapLeader',
  'pitLap',
  'stint',
  'tyre'
])

/**
 * The readings of a table's conditions footer (ConditionsFooterOptions), after its switch: the
 * feed sends every reading while the footer is on, so which ones are drawn is display only. The
 * sky is not offered (nothing a driver acts on), and the wet readings only show when relevant.
 */
const CONDITIONS_READINGS = {
  conditionsTrackTemp: { kind: 'bool', default: true, displayOnly: true },
  conditionsTrend: { kind: 'bool', default: true, displayOnly: true },
  conditionsWet: { kind: 'bool', default: true, displayOnly: true },
  conditionsWind: { kind: 'bool', default: true, displayOnly: true },
  conditionsWindDirection: { kind: 'bool', default: true, displayOnly: true },
  conditionsAirTemp: { kind: 'bool', default: true, displayOnly: true },
  conditionsRubber: { kind: 'bool', default: true, displayOnly: true }
} as const

/** Every field of ConditionsFooterOptions: the switch, then the readings in the line's order. */
export const CONDITIONS_FOOTER_FIELDS = Object.freeze([
  'conditionsFooter',
  ...(Object.keys(CONDITIONS_READINGS) as (keyof typeof CONDITIONS_READINGS)[])
]) satisfies readonly (keyof ConditionsFooterOptions)[]

export const OPTION_SCHEMA = {
  appearance: {
    accent: { kind: 'color', default: '#ffc400', displayOnly: true },
    fontScale: { kind: 'int', min: 80, max: 150, default: 100, step: 5, displayOnly: true },
    density: {
      kind: 'enum',
      values: ['comfortable', 'compact'],
      default: 'comfortable',
      displayOnly: true
    },
    nameFormat: { kind: 'enum', values: NAME_FORMATS, default: 'abbr', displayOnly: true },
    licenseStyle: {
      kind: 'enum',
      values: ['soft', 'solid', 'letter'],
      default: 'soft',
      displayOnly: true
    },
    numberStyle: { kind: 'enum', values: ['chip', 'stripe'], default: 'chip', displayOnly: true },
    colorBlind: { kind: 'bool', default: false, displayOnly: true },
    units: { kind: 'enum', values: ['metric', 'imperial'], default: 'metric', displayOnly: true },
    stripes: { kind: 'bool', default: true, displayOnly: true },
    textHalo: { kind: 'enum', values: ['auto', 'on', 'off'], default: 'auto', displayOnly: true },
    showSimPill: { kind: 'bool', default: true, displayOnly: true },
    language: { kind: 'enum', values: LANGUAGES, default: DEFAULT_LANGUAGE, displayOnly: true }
  },
  // Evaluated by the telemetry process (a hidden widget is not computed), except the waiting
  // panels, which only the overlay windows draw.
  visibility: {
    hideWithSimUi: { kind: 'bool', default: true },
    hideInGarage: { kind: 'bool', default: true },
    hideOnSessionScreen: { kind: 'bool', default: true },
    replays: { kind: 'enum', values: ['follow', 'hide'], default: 'follow' },
    showWhileWaiting: { kind: 'bool', default: false, displayOnly: true }
  },
  relative: {
    carsAhead: { kind: 'int', min: 0, max: 10, default: 3 },
    carsBehind: { kind: 'int', min: 0, max: 10, default: 3 },
    showClassPosition: { kind: 'bool', default: true, displayOnly: true },
    showLicense: { kind: 'bool', default: true, displayOnly: true },
    showIRating: { kind: 'bool', default: true, displayOnly: true },
    // Every row carries them: the provider computes the same payload either way.
    showStint: { kind: 'bool', default: false, displayOnly: true },
    showTyre: { kind: 'bool', default: false, displayOnly: true },
    showFlags: { kind: 'bool', default: true, displayOnly: true },
    nameFormat: {
      kind: 'enum',
      values: NAME_FORMATS_INHERIT,
      default: 'inherit',
      displayOnly: true
    },
    // The count is in every payload: the header shows it or not.
    showIncidents: { kind: 'bool', default: true, displayOnly: true },
    // Off by default: the relative is a free-size window, so a footer line takes its height
    // from the rows (the standings grows by it instead). Computed: the feed runs only while on.
    conditionsFooter: { kind: 'bool', default: false },
    ...CONDITIONS_READINGS
  },
  radar: {
    rangeM: { kind: 'number', min: 5, max: 100, decimals: null, default: 20, step: 5 },
    showRangeLabels: { kind: 'bool', default: true, displayOnly: true }
  },
  standings: {
    mode: { kind: 'enum', values: ['compact', 'full'], default: 'compact' },
    topRows: { kind: 'int', min: 0, max: 10, default: 3 },
    aroundRows: { kind: 'int', min: 0, max: 10, default: 3 },
    otherClassLeaders: { kind: 'bool', default: true },
    gapMode: {
      kind: 'enum',
      values: ['interval', 'leader', 'both'],
      default: 'interval',
      displayOnly: true
    },
    // Not display-only: the provider may skip what no visible column shows.
    columns: {
      kind: 'columns',
      default: STANDINGS_COLUMN_IDS.map((id) => ({ id, visible: !HIDDEN_BY_DEFAULT.has(id) }))
    },
    nameFormat: {
      kind: 'enum',
      values: NAME_FORMATS_INHERIT,
      default: 'inherit',
      displayOnly: true
    },
    iRatingDeltaAll: { kind: 'bool', default: false },
    headerIRating: { kind: 'bool', default: true },
    headerSafetyRating: { kind: 'bool', default: true },
    headerIncidents: { kind: 'bool', default: true, displayOnly: true },
    showSof: { kind: 'bool', default: true, displayOnly: true },
    showCarCount: { kind: 'bool', default: true, displayOnly: true },
    // Every row carries its badge: the provider computes the same payload either way.
    showFlags: { kind: 'bool', default: true, displayOnly: true },
    density: {
      kind: 'enum',
      values: ['inherit', 'comfortable', 'compact'],
      default: 'inherit',
      displayOnly: true
    },
    // On by default: the standings grows by the line (auto height), and it is the table you
    // look at between sessions too. Computed: the feed runs only while a footer is on.
    conditionsFooter: { kind: 'bool', default: true },
    ...CONDITIONS_READINGS
  },
  battle: {
    thresholdS: { kind: 'number', min: 0.3, max: 5, decimals: 1, default: 1.5, step: 0.1 },
    showAhead: { kind: 'bool', default: true },
    showBehind: { kind: 'bool', default: true },
    layout: { kind: 'enum', values: ['stacked', 'side'], default: 'stacked', displayOnly: true },
    detail: { kind: 'enum', values: ['none', 'sectors', 'laps', 'both'], default: 'sectors' },
    holdS: { kind: 'number', min: 0, max: 10, decimals: 1, default: 3, step: 0.5 },
    showPrediction: { kind: 'bool', default: true },
    showIRatingAtStake: { kind: 'bool', default: true },
    nameFormat: {
      kind: 'enum',
      values: NAME_FORMATS_INHERIT,
      default: 'inherit',
      displayOnly: true
    }
  },
  // The inputs payload ignores its options: the trace is drawn by the renderer.
  inputs: {
    traceSeconds: { kind: 'int', min: 2, max: 10, default: 5, displayOnly: true },
    showClutch: { kind: 'bool', default: true, displayOnly: true },
    showSteering: { kind: 'bool', default: true, displayOnly: true },
    showGearSpeed: { kind: 'bool', default: true, displayOnly: true },
    clutchInTrace: { kind: 'bool', default: true, displayOnly: true },
    traceWidth: {
      kind: 'number',
      min: 1,
      max: 3,
      decimals: 1,
      default: 2,
      step: 0.5,
      displayOnly: true
    },
    // Same as the widget's current TRACE_COLORS, so v3 users see no change.
    colors: {
      kind: 'colors',
      default: { throttle: '#3ddc84', brake: '#ff4545', clutch: '#4aa3ff' },
      displayOnly: true
    },
    steeringStyle: { kind: 'enum', values: ['bar', 'wheel'], default: 'bar', displayOnly: true },
    layout: {
      kind: 'enum',
      values: ['trace-bars-info', 'info-bars-trace', 'bars'],
      default: 'trace-bars-info',
      displayOnly: true
    }
  },
  // Windows and groups decide what the provider looks for, so they are computed.
  traffic: {
    behindS: { kind: 'int', min: 2, max: 30, default: 12 },
    aheadS: { kind: 'int', min: 2, max: 30, default: 8 },
    hazardS: { kind: 'int', min: 2, max: 20, default: 8 },
    maxEntries: { kind: 'int', min: 1, max: 5, default: 3 },
    showFaster: { kind: 'bool', default: true },
    showSlower: { kind: 'bool', default: true },
    showHazards: { kind: 'bool', default: true },
    onlyMulticlass: { kind: 'bool', default: true },
    nameFormat: {
      kind: 'enum',
      values: NAME_FORMATS_INHERIT,
      default: 'inherit',
      displayOnly: true
    }
  },
  // The provider filters and holds the alerts itself: nothing here is display-only. In UI order:
  // flags, pit lane, race, engine, fuel.
  alerts: {
    showFlags: { kind: 'bool', default: true },
    showBlue: { kind: 'bool', default: true },
    showFurled: { kind: 'bool', default: true },
    showPitLimiter: { kind: 'bool', default: true },
    showPitOverspeed: { kind: 'bool', default: true },
    showPitEntry: { kind: 'bool', default: true },
    showLapsToGo: { kind: 'bool', default: true },
    showTow: { kind: 'bool', default: true },
    showDamage: { kind: 'bool', default: true },
    showWrongWay: { kind: 'bool', default: true },
    showIncidents: { kind: 'bool', default: true },
    showStalled: { kind: 'bool', default: true },
    showEngineWarnings: { kind: 'bool', default: true },
    showEngineTrend: { kind: 'bool', default: true },
    showBoxThisLap: { kind: 'bool', default: true },
    showFuelLow: { kind: 'bool', default: true },
    holdS: { kind: 'number', min: 0, max: 10, decimals: 1, default: 3, step: 0.5 }
  },
  // The reference choice changes what the provider computes; the rest is drawing. References in
  // UI order: yours (record, session best, optimal), then your class's (best, optimal).
  delta: {
    reference: {
      kind: 'enum',
      values: ['pb', 'session', 'optimal', 'class', 'classOptimal'],
      default: 'pb'
    },
    fallback: { kind: 'bool', default: true },
    rangeS: {
      kind: 'number',
      min: 0.5,
      max: 3,
      decimals: 2,
      default: 1,
      step: 0.25,
      displayOnly: true
    },
    showPredicted: { kind: 'bool', default: true, displayOnly: true },
    showSectors: { kind: 'bool', default: true, displayOnly: true },
    showTrend: { kind: 'bool', default: true, displayOnly: true }
  },
  // The provider sends every line: each is drawn or not. The average and the margin change what
  // it computes (the average also the alerts band's fuel alerts).
  fuel: {
    showHeader: { kind: 'bool', default: false, displayOnly: true },
    showGauge: { kind: 'bool', default: true, displayOnly: true },
    showPerLap: { kind: 'bool', default: true, displayOnly: true },
    showFinish: { kind: 'bool', default: true, displayOnly: true },
    showBox: { kind: 'bool', default: true, displayOnly: true },
    showWindow: { kind: 'bool', default: true, displayOnly: true },
    showSave: { kind: 'bool', default: true, displayOnly: true },
    showTyres: { kind: 'bool', default: true, displayOnly: true },
    showLimits: { kind: 'bool', default: true, displayOnly: true },
    avgLaps: { kind: 'int', min: 2, max: 10, default: 5 },
    marginLaps: { kind: 'number', min: 0, max: 3, decimals: 1, default: 0.5, step: 0.1 }
  },
  // Registered by main (SHORTCUT_ACTIONS order); the telemetry process never sees them.
  shortcuts: {
    toggleOverlay: { kind: 'accelerator', default: 'Ctrl+Shift+H', displayOnly: true },
    toggleEditMode: { kind: 'accelerator', default: 'Ctrl+Shift+E', displayOnly: true }
  }
} as const satisfies OptionSchema

/**
 * Per-widget fields that are not option sections (bounds are handled apart).
 * The real background opacity default is per widget (WIDGET_DEFS); `autoHeight`,
 * `showIn` and `showOnSessionScreen` defaults come from WIDGET_DEFS too.
 */
export const WIDGET_FIELD_SCHEMA = {
  backgroundOpacity: { kind: 'number', min: 0, max: 1, decimals: null, default: 0.78, step: 0.01 },
  scale: { kind: 'int', min: 60, max: 200, default: 100, step: 5 },
  anchor: { kind: 'enum', values: ['top', 'bottom'], default: 'top' },
  hideInPits: { kind: 'bool', default: false }
} as const satisfies {
  readonly [F in 'backgroundOpacity' | 'scale' | 'anchor' | 'hideInPits']: SpecFor<
    WidgetSettings[F]
  >
}

/** Session kinds of the "Mostrar en" rule, in UI order. */
export const SHOW_IN_KINDS = [
  'practice',
  'qualify',
  'race'
] as const satisfies readonly (keyof ShowInSessions)[]

/**
 * Defensive clamp for providers and widgets, with the same rules as
 * normalisation: a number inside the spec's range (rounded for 'int', to
 * `decimals` for 'number'); non-finite numbers and non-numbers give the default.
 */
export function clampOption(spec: NumericSpec, value: unknown): number {
  if (!isFiniteNumber(value)) return spec.default
  const decimals = spec.kind === 'int' ? 0 : spec.decimals
  return clamp(decimals === null ? value : roundTo(value, decimals), spec.min, spec.max)
}

/** Fields of a telemetry section that only the renderer reads. */
export function displayOnlyFields<S extends ConfigSection>(
  section: S
): readonly (keyof OverlaySettings[S])[] {
  const specs = OPTION_SCHEMA[section] as Record<string, OptionSpec>
  return Object.keys(specs).filter(
    (f) => specs[f]?.displayOnly === true
  ) as (keyof OverlaySettings[S])[]
}

// ---------------------------------------------------------------------------
// UI presets (values only: their names are in the i18n dictionaries)
// ---------------------------------------------------------------------------

/** Radar range choices offered in the tray menu and the settings window. */
export const RADAR_RANGE_PRESETS_M = [10, 20, 30, 50] as const

/** Accent swatches; `name` keys settings.appearance.color.accentNames. */
export const ACCENT_PRESETS = [
  { value: '#ffc400', name: 'yellow' },
  { value: '#ff8a1f', name: 'orange' },
  { value: '#22d3ee', name: 'cyan' },
  { value: '#a3e635', name: 'lime' },
  { value: '#f472b6', name: 'pink' },
  { value: '#e6e9ef', name: 'white' }
] as const

export type AccentPresetName = (typeof ACCENT_PRESETS)[number]['name']

/** Opaque colours only: the inputs trace draws overlapping segment caps. */
export const PEDAL_COLOR_PRESETS = {
  throttle: ['#3ddc84', '#22c55e', '#a3e635', '#22d3ee'],
  brake: ['#ff4545', '#f43f5e', '#ff8a1f', '#e879f9'],
  clutch: ['#4aa3ff', '#2f6db5', '#a78bfa', '#94a3b8']
} as const
