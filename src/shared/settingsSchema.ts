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
export type NumericSpec = IntSpec | NumberSpec
export type OptionSpec = NumericSpec | BoolSpec | EnumSpec | ColorSpec | ColorsSpec | ColumnsSpec

/** The spec kinds allowed for a field of type T (non-distributive on purpose). */
export type SpecFor<T> = [T] extends [boolean]
  ? BoolSpec
  : [T] extends [number]
    ? NumericSpec
    : [T] extends [readonly StandingsColumn[]]
      ? ColumnsSpec
      : [T] extends [string]
        ? string extends T
          ? ColorSpec
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
  'pit'
] as const satisfies readonly StandingsColumnId[]

const HIDDEN_BY_DEFAULT: ReadonlySet<StandingsColumnId> = new Set(['delta', 'gapLeader'])

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
  relative: {
    carsAhead: { kind: 'int', min: 0, max: 10, default: 3 },
    carsBehind: { kind: 'int', min: 0, max: 10, default: 3 },
    showClassPosition: { kind: 'bool', default: true, displayOnly: true },
    showLicense: { kind: 'bool', default: true, displayOnly: true },
    showIRating: { kind: 'bool', default: true, displayOnly: true },
    nameFormat: {
      kind: 'enum',
      values: NAME_FORMATS_INHERIT,
      default: 'inherit',
      displayOnly: true
    }
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
    showSof: { kind: 'bool', default: true, displayOnly: true },
    showCarCount: { kind: 'bool', default: true, displayOnly: true },
    density: {
      kind: 'enum',
      values: ['inherit', 'comfortable', 'compact'],
      default: 'inherit',
      displayOnly: true
    }
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
  // The provider filters and holds the flags itself: nothing here is display-only.
  alerts: {
    showFlags: { kind: 'bool', default: true },
    showBlue: { kind: 'bool', default: true },
    showPitLimiter: { kind: 'bool', default: true },
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
  }
} as const satisfies OptionSchema

/**
 * Per-widget fields that are not option sections (bounds are handled apart).
 * The real background opacity default is per widget (WIDGET_DEFS); `autoHeight`
 * and `showIn` defaults come from WIDGET_DEFS too.
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
