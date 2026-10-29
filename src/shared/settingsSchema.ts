/**
 * Single source of truth for every option: type, range, default and whether
 * only the renderer reads it. Defaults, normalisation and patching
 * (settings/), the providers' defensive clamps, main's telemetry-config diff
 * and the settings UI's control ranges are all derived from this table, so a
 * new option is added here (plus its type in types.ts) and nowhere else.
 */
import type { BrandMarkMode } from './carBrands'
import { DEFAULT_LANGUAGE, LANGUAGES } from './i18n/language'
import { COMPUTED_INFO_ITEMS, INFO_BAR_SIZES, INFO_ITEM_IDS } from './infoBar'
import { clamp, isFiniteNumber, roundTo } from './num'
import type {
  AlertsPartId,
  BattleLaneId,
  BattlePartId,
  BattleRowId,
  DeltaLapId,
  DeltaReference,
  DeltaRowId,
  DeltaTopId,
  ElementEntry,
  FuelLineId,
  InfoBarEntryId,
  InfoBarSize,
  InputsBarId,
  InputsCarId,
  InputsInfoId,
  InputsSectionId,
  LayoutSort,
  LicenseStyle,
  LightKind,
  NameFormat,
  OverlaySettings,
  RadarPartId,
  RelativeColumnId,
  ShowInSessions,
  ShowWhen,
  StandingsClassLineId,
  StandingsColumnId,
  SteeringStyle,
  TelemetryConfig,
  TrafficGroupId,
  TrafficHeaderId,
  TrafficPartId,
  WheelSize,
  WidgetSettings
} from './types'

/**
 * Option sections of OverlaySettings (everything but version, widgets, the saved layouts and
 * the controllers' names).
 */
export type OptionSection = Exclude<
  keyof OverlaySettings,
  'version' | 'widgets' | 'savedLayouts' | 'buttonDeviceNames'
>
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
/**
 * A widget zone (columns, rows, an info bar...): every id exactly once, in display order, each
 * shown or hidden (ElementList). Normalised by fields.ts normalizeElements; a patch replaces the
 * whole list, a reset gives `default`. Not display-only: main resends the telemetry config when
 * the visibility of a `computed` id changes (never on a reorder: the order is the renderer's).
 * The standings' columns are one too, stored as they always were ({ id, visible }).
 */
export interface ElementsSpec<Id extends string = string> extends SpecBase {
  readonly kind: 'elements'
  /** Every id, in the default order. */
  readonly ids: readonly Id[]
  /** `ids` in order, each shown unless the spec hides it by default. */
  readonly default: readonly Readonly<ElementEntry<Id>>[]
  /** Always drawn: forced visible, and the editor shows a lock instead of the eye. */
  readonly required: readonly Id[]
  /** Visibility only: the order is always `ids` (normalisation sorts it), no drag handle. */
  readonly fixedOrder: boolean
  /**
   * Child -> parent: a child is drawn only while its parent is, and the editor greys its eye out
   * while the parent is hidden. Its own visibility is kept.
   */
  readonly parents: Readonly<Partial<Record<Id, Id>>>
  /**
   * Not display-only: the ids whose visibility the provider reads (every id when absent). The
   * others are drawing, so toggling them sends the telemetry process nothing new.
   */
  readonly computed?: readonly Id[]
}
/**
 * A global shortcut: an assignable combination in its canonical spelling (accelerator.ts), a
 * controller's button (controllers.ts), or '' when turned off. The accelerator fields of a
 * section never share a binding.
 */
export interface AcceleratorSpec extends SpecBase {
  readonly kind: 'accelerator'
  readonly default: string
}
export type NumericSpec = IntSpec | NumberSpec
export type OptionSpec =
  NumericSpec | BoolSpec | EnumSpec | ColorSpec | ColorsSpec | ElementsSpec | AcceleratorSpec

/** The spec kinds allowed for a field of type T (non-distributive on purpose). */
export type SpecFor<T> = [T] extends [boolean]
  ? BoolSpec
  : [T] extends [number]
    ? NumericSpec
    : [T] extends [readonly ElementEntry<infer Id extends string>[]]
      ? ElementsSpec<Id>
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

/** When the overlay is shown (VisibilityOptions.showWhen), in UI order: the default first. */
export const SHOW_WHEN = ['car', 'race', 'always'] as const satisfies readonly ShowWhen[]

/** How the settings window orders the saved layouts (LayoutOptions.sort), the default first. */
export const LAYOUT_SORTS = ['custom', 'name', 'recent'] as const satisfies readonly LayoutSort[]

/**
 * The ids of a zone in their default order, every member of `Id` listed (the compiler rejects a
 * list that misses one; duplicates are caught by the schema tests):
 * `idsOf<RelativeColumnId>()(['pos', ...])`.
 */
export function idsOf<Id extends string>() {
  return <const L extends readonly Id[]>(
    ids: L & (Exclude<Id, L[number]> extends never ? unknown : never)
  ): L => ids
}

interface ElementsOptions<Id extends string> {
  /** Hidden by default (files saved before an id existed get it hidden too, at the end). */
  readonly hidden?: readonly Id[]
  readonly required?: readonly Id[]
  readonly fixedOrder?: true
  readonly parents?: Readonly<Partial<Record<Id, Id>>>
  readonly computed?: readonly Id[]
  readonly displayOnly?: true
}

/** An 'elements' spec: `ids` in order, shown unless hidden by default. */
export function elements<const Id extends string>(
  ids: readonly Id[],
  o: ElementsOptions<Id> = {}
): ElementsSpec<Id> {
  const hidden = new Set<Id>(o.hidden ?? [])
  const spec: ElementsSpec<Id> = {
    kind: 'elements',
    ids: Object.freeze([...ids]),
    default: Object.freeze(ids.map((id) => Object.freeze({ id, visible: !hidden.has(id) }))),
    required: Object.freeze([...(o.required ?? [])]),
    fixedOrder: o.fixedOrder === true,
    parents: Object.freeze({ ...o.parents }),
    ...(o.computed !== undefined ? { computed: Object.freeze([...o.computed]) } : {}),
    ...(o.displayOnly === true ? { displayOnly: true } : {})
  }
  return spec
}

/**
 * An info bar's list: `shown` in that order (`split` among them: what follows lines up at the
 * far end), then every other item, hidden, in catalog order (turned on, it lands at the end).
 * The marker is required; the provider computes the items it draws (COMPUTED_INFO_ITEMS).
 */
export function infoBar(shown: readonly InfoBarEntryId[]): ElementsSpec<InfoBarEntryId> {
  const rest = INFO_ITEM_IDS.filter((id) => !shown.includes(id))
  const ids: InfoBarEntryId[] = [...shown, ...rest]
  if (!ids.includes('split')) ids.push('split')
  return elements<InfoBarEntryId>(ids, {
    hidden: rest,
    required: ['split'],
    computed: COMPUTED_INFO_ITEMS
  })
}

/**
 * An info bar's size. Computed ('off' turns the bar's data off), though a change between the
 * other sizes is only drawing: it is rare, and one config resend is nothing.
 */
function barSize(def: InfoBarSize): EnumSpec<InfoBarSize> {
  return { kind: 'enum', values: INFO_BAR_SIZES, default: def }
}

/** Right-hand standings columns in their default order. */
export const STANDINGS_COLUMN_IDS = idsOf<StandingsColumnId>()([
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
])

/**
 * The cells of a relative row, left to right (`driver` is the plate, the brand mark, the flag,
 * the name and its badges).
 */
export const RELATIVE_COLUMN_IDS = idsOf<RelativeColumnId>()([
  'pos',
  'driver',
  'lic',
  'ir',
  'tyre',
  'stint',
  'gap'
])

/** The warning lights in the strip's default order (the provider's LIGHT_ORDER). */
export const LIGHT_IDS = idsOf<LightKind>()([
  'oilPressure',
  'fuelPressure',
  'stalled',
  'repair',
  'repairOptional',
  'water',
  'oilTemp',
  'pitLimiter',
  'revLimiter'
])

/** Brand marks in Relative, Standings and Battle, in UI order: the default first. */
export const BRAND_MARK_CHOICES = ['auto', 'on', 'off'] as const satisfies readonly BrandMarkMode[]

/** Licence styles in UI order: the default first. */
export const LICENSE_STYLES = [
  'outline',
  'soft',
  'solid',
  'letter'
] as const satisfies readonly LicenseStyle[]

/**
 * Delta references in UI order: yours (record, session best, optimal), then your class's (best,
 * optimal). The cycle shortcut walks them in this order.
 */
export const DELTA_REFERENCE_VALUES = [
  'pb',
  'session',
  'optimal',
  'class',
  'classOptimal'
] as const satisfies readonly DeltaReference[]

/** Brand marks: drawing only (every row carries its make), 'auto' as the user asked. */
const BRAND_MARKS = {
  kind: 'enum',
  values: BRAND_MARK_CHOICES,
  default: 'auto',
  displayOnly: true
} as const

/** The track temperature's trend arrow and the wind's dial, options of their info items. */
const CONDITIONS_EXTRAS = {
  conditionsTrend: { kind: 'bool', default: true, displayOnly: true },
  conditionsWindDirection: { kind: 'bool', default: true, displayOnly: true }
} as const

/** A table's footer: the track conditions, in the order of the footer it replaced. */
const CONDITIONS_FOOTER: readonly InfoBarEntryId[] = [
  'trackTemp',
  'wet',
  'wind',
  'airTemp',
  'rubber',
  'split'
]

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
      values: LICENSE_STYLES,
      default: 'outline',
      displayOnly: true
    },
    numberStyle: { kind: 'enum', values: ['chip', 'stripe'], default: 'chip', displayOnly: true },
    // Older files have none: they get colour, the look every brand mark has by default.
    brandLogos: { kind: 'enum', values: ['color', 'mono'], default: 'color', displayOnly: true },
    colorBlind: { kind: 'bool', default: false, displayOnly: true },
    units: { kind: 'enum', values: ['metric', 'imperial'], default: 'metric', displayOnly: true },
    stripes: { kind: 'bool', default: true, displayOnly: true },
    textHalo: { kind: 'enum', values: ['auto', 'on', 'off'], default: 'auto', displayOnly: true },
    showSimPill: { kind: 'bool', default: true, displayOnly: true },
    language: { kind: 'enum', values: LANGUAGES, default: DEFAULT_LANGUAGE, displayOnly: true }
  },
  // Evaluated by the telemetry process (a hidden widget is not computed), except the waiting
  // panels, which only the overlay windows draw. The overlay only while you drive, and no
  // replays, by default.
  visibility: {
    showWhen: { kind: 'enum', values: SHOW_WHEN, default: 'car' },
    hideWithSimUi: { kind: 'bool', default: true },
    hideInGarage: { kind: 'bool', default: true },
    hideOnSessionScreen: { kind: 'bool', default: true },
    replays: { kind: 'enum', values: ['hide', 'follow'], default: 'hide' },
    showWhileWaiting: { kind: 'bool', default: false, displayOnly: true }
  },
  relative: {
    carsAhead: { kind: 'int', min: 0, max: 10, default: 3 },
    carsBehind: { kind: 'int', min: 0, max: 10, default: 3 },
    // Every row carries every cell: the provider computes the same payload either way.
    columns: elements(RELATIVE_COLUMN_IDS, {
      hidden: ['tyre', 'stint'],
      required: ['driver', 'gap'],
      displayOnly: true
    }),
    // Today's header: the name and the session, your incidents on the right.
    headerBar: infoBar(['title', 'session', 'split', 'incidents']),
    headerBarSize: barSize('normal'),
    // Off by default: the relative is a free-size window, so a footer line takes its height
    // from the rows (the standings grows by it instead).
    footerBar: infoBar(CONDITIONS_FOOTER),
    footerBarSize: barSize('off'),
    ...CONDITIONS_EXTRAS,
    // Off: the panel keeps today's rows until asked for.
    columnHeads: { kind: 'bool', default: false, displayOnly: true },
    brandMarks: BRAND_MARKS,
    countryFlags: { kind: 'bool', default: true, displayOnly: true },
    showFlags: { kind: 'bool', default: true, displayOnly: true },
    nameFormat: {
      kind: 'enum',
      values: NAME_FORMATS_INHERIT,
      default: 'inherit',
      displayOnly: true
    }
  },
  radar: {
    rangeM: { kind: 'number', min: 5, max: 100, decimals: null, default: 20, step: 5 },
    // Layers over the cars; the distance labels sit on the guides.
    parts: elements(idsOf<RadarPartId>()(['guides', 'sideAlerts', 'rangeLabels']), {
      fixedOrder: true,
      parents: { rangeLabels: 'guides' },
      displayOnly: true
    })
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
    // Not display-only: the provider may skip what no visible column shows. The best lap is the
    // extra most asked for; stint, last stop and tyre are for longer races.
    columns: elements(STANDINGS_COLUMN_IDS, {
      hidden: ['delta', 'gapLeader', 'pitLap', 'stint', 'tyre']
    }),
    // Today's two header lines: the session (the widget's name while unknown), the class's SoF
    // and cars, your incidents and what is left; then your projections and the fastest lap.
    headerBar: infoBar(['session', 'sof', 'carCount', 'split', 'incidents', 'remaining']),
    headerBarSize: barSize('normal'),
    subheaderBar: infoBar(['iRating', 'fastestLap', 'split', 'safetyRating']),
    subheaderBarSize: barSize('normal'),
    // On by default: the standings grows by the line (auto height), and it is the table you
    // look at between sessions too.
    footerBar: infoBar(CONDITIONS_FOOTER),
    footerBarSize: barSize('normal'),
    ...CONDITIONS_EXTRAS,
    classLine: elements(idsOf<StandingsClassLineId>()(['sof', 'carCount']), {
      displayOnly: true
    }),
    columnHeads: { kind: 'bool', default: false, displayOnly: true },
    brandMarks: BRAND_MARKS,
    countryFlags: { kind: 'bool', default: true, displayOnly: true },
    nameFormat: {
      kind: 'enum',
      values: NAME_FORMATS_INHERIT,
      default: 'inherit',
      displayOnly: true
    },
    iRatingDeltaAll: { kind: 'bool', default: false },
    // Every row carries its badge: the provider computes the same payload either way.
    showFlags: { kind: 'bool', default: true, displayOnly: true },
    density: {
      kind: 'enum',
      values: ['inherit', 'comfortable', 'compact'],
      default: 'inherit',
      displayOnly: true
    }
  },
  battle: {
    thresholdS: { kind: 'number', min: 0.3, max: 5, decimals: 1, default: 1.5, step: 0.1 },
    // A hidden rival is not looked for.
    lanes: elements(idsOf<BattleLaneId>()(['ahead', 'behind'])),
    layout: { kind: 'enum', values: ['stacked', 'side'], default: 'stacked', displayOnly: true },
    // The prediction is computed only while shown; the sector and lap chips are drawing.
    rows: elements(idsOf<BattleRowId>()(['prediction', 'sectors', 'laps']), {
      hidden: ['laps'],
      computed: ['prediction']
    }),
    parts: elements(idsOf<BattlePartId>()(['rating', 'license', 'trendNote', 'stake']), {
      fixedOrder: true,
      computed: ['stake']
    }),
    holdS: { kind: 'number', min: 0, max: 10, decimals: 1, default: 3, step: 0.5 },
    brandMarks: BRAND_MARKS,
    // Off: a battle card is small, and the rival's name is what matters.
    countryFlags: { kind: 'bool', default: false, displayOnly: true },
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
    // The bars are the widget: they always stay, like the brake and the throttle.
    // The car block (revs, bias, TC, FFB) is new: files from before get it hidden, at the end.
    sections: elements(idsOf<InputsSectionId>()(['trace', 'bars', 'info', 'car']), {
      required: ['bars'],
      displayOnly: true
    }),
    bars: elements(idsOf<InputsBarId>()(['clutch', 'brake', 'throttle']), {
      required: ['brake', 'throttle'],
      displayOnly: true
    }),
    info: elements(idsOf<InputsInfoId>()(['gear', 'speed', 'steering']), { displayOnly: true }),
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
    // A file's old 'wheel' is the realistic one (migrateInputs).
    steeringStyle: {
      kind: 'enum',
      values: idsOf<SteeringStyle>()(['bar', 'minimal', 'realistic', 'formula']),
      default: 'bar',
      displayOnly: true
    },
    // Medium is the wheel of before.
    wheelSize: {
      kind: 'enum',
      values: idsOf<WheelSize>()(['small', 'medium', 'large']),
      default: 'medium',
      displayOnly: true
    },
    // The default accent (ACCENT_PRESETS yellow).
    wheelColor: { kind: 'color', default: '#ffc400', displayOnly: true },
    steeringDegrees: { kind: 'bool', default: false, displayOnly: true },
    // On for a new install; a file from before gets it off (migrateInputs), so nothing new shows.
    shiftLights: { kind: 'bool', default: true, displayOnly: true },
    // Each readout only shows when the car has it (no bias or TC control: no row).
    car: elements(idsOf<InputsCarId>()(['rpm', 'bias', 'tc', 'ffb']), { displayOnly: true })
  },
  // Windows and groups decide what the provider looks for, so they are computed.
  traffic: {
    behindS: { kind: 'int', min: 2, max: 30, default: 12 },
    aheadS: { kind: 'int', min: 2, max: 30, default: 8 },
    hazardS: { kind: 'int', min: 2, max: 20, default: 8 },
    maxEntries: { kind: 'int', min: 1, max: 5, default: 3 },
    // Top to bottom as on track: what is ahead of you first, the faster cars behind last.
    groups: elements(idsOf<TrafficGroupId>()(['hazard', 'slower', 'faster'])),
    parts: elements(idsOf<TrafficPartId>()(['icon', 'cls', 'driver', 'lead', 'value', 'sector']), {
      required: ['driver', 'value'],
      displayOnly: true
    }),
    header: elements(idsOf<TrafficHeaderId>()(['title', 'captions']), {
      fixedOrder: true,
      displayOnly: true
    }),
    onlyMulticlass: { kind: 'bool', default: true },
    nameFormat: {
      kind: 'enum',
      values: NAME_FORMATS_INHERIT,
      default: 'inherit',
      displayOnly: true
    }
  },
  // The provider filters and holds the alerts itself: nothing here is display-only but the
  // band's extras. In UI order: flags, pit lane, race, engine, fuel. Of the engine, only the
  // critical lights: the warning lights strip has them all (a file's showEngineWarnings becomes
  // showOilPressure, migrate.ts).
  alerts: {
    showFlags: { kind: 'bool', default: true },
    showBlue: { kind: 'bool', default: true },
    showFurled: { kind: 'bool', default: true },
    showPitLimiter: { kind: 'bool', default: true },
    showPitOverspeed: { kind: 'bool', default: true },
    showPitEntry: { kind: 'bool', default: true },
    showLapsToGo: { kind: 'bool', default: true },
    showTow: { kind: 'bool', default: true },
    showWrongWay: { kind: 'bool', default: true },
    showIncidents: { kind: 'bool', default: true },
    showStalled: { kind: 'bool', default: true },
    showOilPressure: { kind: 'bool', default: true },
    showDamage: { kind: 'bool', default: true },
    showBoxThisLap: { kind: 'bool', default: true },
    showFuelLow: { kind: 'bool', default: true },
    holdS: { kind: 'number', min: 0, max: 10, decimals: 1, default: 3, step: 0.5 },
    parts: elements(idsOf<AlertsPartId>()(['notes', 'chips']), {
      fixedOrder: true,
      displayOnly: true
    })
  },
  // The references change what the provider computes; the rest is drawing. In practice your
  // record, in qualifying and races your optimal of the session (with the fallback: your
  // record, then your class's optimal, until you have a clean lap).
  delta: {
    referencePractice: { kind: 'enum', values: DELTA_REFERENCE_VALUES, default: 'pb' },
    referenceQualify: { kind: 'enum', values: DELTA_REFERENCE_VALUES, default: 'optimal' },
    referenceRace: { kind: 'enum', values: DELTA_REFERENCE_VALUES, default: 'optimal' },
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
    // The lap times line is off: today's look.
    rows: elements(idsOf<DeltaRowId>()(['top', 'bar', 'sectors', 'laps']), {
      hidden: ['laps'],
      required: ['top'],
      displayOnly: true
    }),
    top: elements(idsOf<DeltaTopId>()(['state', 'predicted', 'reference']), {
      fixedOrder: true,
      displayOnly: true
    }),
    // Every payload carries the four times (cheap): which ones are drawn is display only.
    laps: elements(idsOf<DeltaLapId>()(['last', 'best', 'optimal', 'pb']), {
      hidden: ['pb'],
      displayOnly: true
    })
  },
  // The provider sends every line: each is drawn or not. The average and the margin change what
  // it computes (the average also the alerts band's fuel alerts).
  fuel: {
    // Off, as the header switch it replaced: the name and the SIM tag when on.
    headerBar: infoBar(['title', 'split']),
    headerBarSize: barSize('off'),
    ...CONDITIONS_EXTRAS,
    lines: elements(
      idsOf<FuelLineId>()([
        'hero',
        'gauge',
        'perLap',
        'finish',
        'window',
        'save',
        'tyres',
        'limits'
      ]),
      { required: ['hero'], displayOnly: true }
    ),
    showBox: { kind: 'bool', default: true, displayOnly: true },
    avgLaps: { kind: 'int', min: 2, max: 10, default: 5 },
    marginLaps: { kind: 'number', min: 0, max: 3, decimals: 1, default: 0.5, step: 0.1 }
  },
  // The provider leaves out the lights turned off, the readings not shown and, with onlyWhenLit,
  // the dim lights (a rev limiter flickering unseen re-sends nothing); the layout, the side and
  // the captions are drawing. Small by default: icons only, the repair time, every engine light;
  // the limiters are there for those who want them. In UI order.
  lights: {
    layout: { kind: 'enum', values: ['row', 'column'], default: 'row', displayOnly: true },
    labelSide: { kind: 'enum', values: ['right', 'left'], default: 'right', displayOnly: true },
    onlyWhenLit: { kind: 'bool', default: false },
    showCaptions: { kind: 'bool', default: false, displayOnly: true },
    showTemps: { kind: 'bool', default: false },
    showRepairTime: { kind: 'bool', default: true },
    // The repair times read as the crew's ('42 s (equipo)'), and the real countdown estimated in
    // the stall (notices/repairClock.ts), off until a live stop confirms it.
    repairCrewTag: { kind: 'bool', default: true, displayOnly: true },
    repairRealTime: { kind: 'bool', default: false },
    icons: elements(LIGHT_IDS, { hidden: ['pitLimiter', 'revLimiter'] }),
    showTrend: { kind: 'bool', default: true }
  },
  // Registered by main (SHORTCUT_ACTIONS order); the telemetry process never sees them. The
  // delta's cycle and the next layout have none until you give them one; the settings window
  // opens with Ctrl+Shift+O (O for opciones / options).
  shortcuts: {
    toggleOverlay: { kind: 'accelerator', default: 'Ctrl+Shift+H', displayOnly: true },
    toggleEditMode: { kind: 'accelerator', default: 'Ctrl+Shift+E', displayOnly: true },
    cycleDeltaReference: { kind: 'accelerator', default: '', displayOnly: true },
    nextLayout: { kind: 'accelerator', default: '', displayOnly: true },
    openSettings: { kind: 'accelerator', default: 'Ctrl+Shift+O', displayOnly: true }
  },
  // The settings window's own; nothing else reads them.
  settingsWindow: {
    stageScene: { kind: 'enum', values: ['dark', 'light'], default: 'dark', displayOnly: true }
  },
  // Main's alone (the layouts themselves are settings.savedLayouts, layouts.ts). Off: a layout
  // changes only when you change it. The order is the settings window's alone.
  layouts: {
    autoSwitch: { kind: 'bool', default: false, displayOnly: true },
    sort: { kind: 'enum', values: LAYOUT_SORTS, default: 'custom', displayOnly: true }
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

/**
 * What a saved layout carries besides the places (src/shared/layouts.ts) and what stays the same
 * whatever layout is in use. Every option section is in exactly one of the two lists, and every
 * widget field in a layout's places or in WIDGET_OPTION_FIELDS (settingsSchema.test.ts): a new
 * section or field fails the tests until it is classified here.
 *
 * - Per layout: each widget's own section, named after it (columns and their order, element
 *   lists, info bars, the delta's references per session, the wheel style...), and the widget's
 *   fields outside any section (WIDGET_OPTION_FIELDS: background opacity, the auto height and
 *   its anchor, the sessions it shows in, hiding in the pits, the session screen).
 * - Global: the look and the units of every widget (appearance: language, units, accent, the
 *   colour-blind palette, text size, licences, brand logos...), when the overlay shows at all
 *   (visibility), the shortcuts, the settings window's own options and the layouts' own
 *   (autoSwitch, sort). Nor are the personal bests or the layouts themselves (savedLayouts).
 */
export const LAYOUT_SECTIONS = [
  'relative',
  'radar',
  'standings',
  'battle',
  'inputs',
  'traffic',
  'alerts',
  'delta',
  'fuel',
  'lights'
] as const satisfies readonly OptionSection[]

/** See LAYOUT_SECTIONS. */
export const GLOBAL_SECTIONS = [
  'appearance',
  'visibility',
  'shortcuts',
  'settingsWindow',
  'layouts'
] as const satisfies readonly OptionSection[]

/** An option section a layout carries. */
export type LayoutSection = (typeof LAYOUT_SECTIONS)[number]

/** A widget's fields a layout carries as options (its places are LayoutWidget's). */
export const WIDGET_OPTION_FIELDS = [
  'backgroundOpacity',
  'autoHeight',
  'anchor',
  'showIn',
  'hideInPits',
  'showOnSessionScreen'
] as const satisfies readonly (keyof WidgetSettings)[]

/** Whether option section `section` is carried by the layouts (LAYOUT_SECTIONS). */
export function isLayoutSection(section: string): section is LayoutSection {
  return (LAYOUT_SECTIONS as readonly string[]).includes(section)
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

// ---------------------------------------------------------------------------
// Element lists of the option sections
// ---------------------------------------------------------------------------

/** The element-list fields of a section: `ElementField<'relative'>` is 'columns' | 'headerBar' | ... */
export type ElementField<S extends OptionSection> = {
  [F in keyof OverlaySettings[S]]-?: OverlaySettings[S][F] extends readonly ElementEntry[]
    ? F
    : never
}[keyof OverlaySettings[S]] &
  string

/** The ids of one element-list field: `ElementIdOf<'relative', 'columns'>` is RelativeColumnId. */
export type ElementIdOf<
  S extends OptionSection,
  F extends ElementField<S>
> = OverlaySettings[S][F] extends readonly ElementEntry<infer Id extends string>[] ? Id : never

/** The spec of an element-list field (typed by its ids). */
export function elementsSpec<S extends OptionSection, F extends ElementField<S>>(
  section: S,
  field: F
): ElementsSpec<ElementIdOf<S, F>> {
  const spec = (OPTION_SCHEMA[section] as Readonly<Record<string, OptionSpec>>)[field]
  if (spec?.kind !== 'elements') throw new Error(`${section}.${field} is not an element list`)
  return spec as ElementsSpec<ElementIdOf<S, F>>
}

/** Every element-list field of the schema, as [section, field] pairs (tests, migrations). */
export function elementFields(): readonly (readonly [OptionSection, string])[] {
  const out: [OptionSection, string][] = []
  for (const section of Object.keys(OPTION_SCHEMA) as OptionSection[]) {
    const specs = OPTION_SCHEMA[section] as Readonly<Record<string, OptionSpec>>
    for (const [field, spec] of Object.entries(specs)) {
      if (spec.kind === 'elements') out.push([section, field])
    }
  }
  return out
}
