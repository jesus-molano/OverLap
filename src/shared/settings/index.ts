/**
 * Persisted settings: defaults, defensive normalisation of the file on disk
 * (with the migration of older files), validated patches and commands from the settings
 * window, the telemetry config, and the window geometry main uses. Ranges and
 * defaults come from OPTION_SCHEMA (settingsSchema.ts).
 */
import { OPTION_SCHEMA, WIDGET_FIELD_SCHEMA } from '../settingsSchema'

export { RADAR_RANGE_PRESETS_M } from '../settingsSchema'
export {
  DEFAULT_SETTINGS,
  OPTION_SECTIONS,
  SETTINGS_VERSION,
  createDefaultSettings,
  defaultOptions,
  defaultWidgetSettings
} from './defaults'
export { normalizeColumns, normalizeElements } from './fields'
export { settingsDraft } from './layouts'
export { normalizeSettings } from './normalize'
export {
  applySettingsPatch,
  placeDefaultLayout,
  WIDGET_RESET_PARTS,
  isWidgetResetPart,
  resetWidgetBounds,
  resetWidgetOptions,
  setWidgetBounds,
  type WidgetResetPart
} from './patch'
export { toTelemetryConfig } from './config'
export {
  APPEARANCE_PARTS,
  APPEARANCE_PART_FIELDS,
  appearancePartDefaults,
  OPTION_PARTS,
  hasOptionPart,
  optionPartDefaults,
  optionPartFields,
  optionPartOf,
  type AppearancePart,
  type OptionPart
} from './optionParts'
export {
  applyDrag,
  clampRectToDisplay,
  clampRectToDisplays,
  defaultBoundsIn,
  defaultLayoutOffsetX,
  isRectVisible,
  pickDisplay,
  rectsEqual,
  restoreBounds,
  roundRect
} from './geometry'

// Range constants for the controls and the widgets, derived from the schema.
const O = OPTION_SCHEMA
export const RELATIVE_CARS_MIN = O.relative.carsAhead.min
export const RELATIVE_CARS_MAX = O.relative.carsAhead.max
export const RADAR_RANGE_MIN_M = O.radar.rangeM.min
export const RADAR_RANGE_MAX_M = O.radar.rangeM.max
export const BACKGROUND_OPACITY_MIN = WIDGET_FIELD_SCHEMA.backgroundOpacity.min
export const BACKGROUND_OPACITY_MAX = WIDGET_FIELD_SCHEMA.backgroundOpacity.max
export const WIDGET_SCALE_MIN = WIDGET_FIELD_SCHEMA.scale.min
export const WIDGET_SCALE_MAX = WIDGET_FIELD_SCHEMA.scale.max
/** Mouse-wheel / slider step of the widget scale (%). */
export const WIDGET_SCALE_STEP = WIDGET_FIELD_SCHEMA.scale.step
export const FONT_SCALE_MIN = O.appearance.fontScale.min
export const FONT_SCALE_MAX = O.appearance.fontScale.max
/** Standings topRows / aroundRows (integers). */
export const STANDINGS_ROWS_MIN = O.standings.topRows.min
export const STANDINGS_ROWS_MAX = O.standings.topRows.max
export const STANDINGS_MODES = O.standings.mode.values
export const STANDINGS_GAP_MODES = O.standings.gapMode.values
/** «Orden de las clases» (9), the default first. */
export const STANDINGS_CLASS_ORDERS = O.standings.classOrder.values
/** Battle thresholdS (seconds, one decimal). */
export const BATTLE_THRESHOLD_MIN_S = O.battle.thresholdS.min
export const BATTLE_THRESHOLD_MAX_S = O.battle.thresholdS.max
export const BATTLE_HOLD_MIN_S = O.battle.holdS.min
export const BATTLE_HOLD_MAX_S = O.battle.holdS.max
/** Inputs traceSeconds (integers). */
export const INPUTS_TRACE_MIN_S = O.inputs.traceSeconds.min
export const INPUTS_TRACE_MAX_S = O.inputs.traceSeconds.max
export const INPUTS_TRACE_WIDTH_MIN = O.inputs.traceWidth.min
export const INPUTS_TRACE_WIDTH_MAX = O.inputs.traceWidth.max
/** Traffic behindS / aheadS (whole seconds, same range). */
export const TRAFFIC_WINDOW_MIN_S = O.traffic.behindS.min
export const TRAFFIC_WINDOW_MAX_S = O.traffic.behindS.max
export const TRAFFIC_HAZARD_MIN_S = O.traffic.hazardS.min
export const TRAFFIC_HAZARD_MAX_S = O.traffic.hazardS.max
/** Traffic maxEntries per group (integers). */
export const TRAFFIC_ENTRIES_MIN = O.traffic.maxEntries.min
export const TRAFFIC_ENTRIES_MAX = O.traffic.maxEntries.max
/** Alerts holdS (seconds, one decimal). */
export const ALERTS_HOLD_MIN_S = O.alerts.holdS.min
export const ALERTS_HOLD_MAX_S = O.alerts.holdS.max
/** Delta rangeS: full scale of the bar (seconds, two decimals). */
export const DELTA_RANGE_MIN_S = O.delta.rangeS.min
export const DELTA_RANGE_MAX_S = O.delta.rangeS.max
export const DELTA_REFERENCES = O.delta.referenceRace.values
