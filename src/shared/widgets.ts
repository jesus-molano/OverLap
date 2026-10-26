import type { Rect, Size } from './types'

export interface WidgetDef {
  /** Unique id: the settings key, and the `data-ov-slot` of its overlay panel. */
  readonly id: string
  /** How often the telemetry process computes and sends this widget's payload. */
  readonly hz: number
  /** Position and size on first run (DIP, primary display coordinates). */
  readonly defaultBounds: Rect
  readonly minSize: Size
  readonly defaultVisible: boolean
  /** Background panel opacity on first run, 0..1. */
  readonly defaultBackgroundOpacity: number
  /**
   * 'auto-height': the height follows the content (the widget reports it and
   * its overlay panel fits to it), the user sets the width; text size comes
   * from the scale setting. 'free': the user sets both and the content fits
   * the panel.
   */
  readonly sizeModel: 'auto-height' | 'free'
  /** Default "Mostrar en" rule. */
  readonly defaultShowIn: {
    readonly practice: boolean
    readonly qualify: boolean
    readonly race: boolean
  }
  /**
   * During a replay it follows the car on camera (its data exists for every car). Absent: it
   * only has your own car's data (pedals, spotter, flags, the delta...) and hides while a
   * replay plays, so a new widget is never shown with the wrong car's numbers by default.
   */
  readonly followsCamera?: true
}

/**
 * Height (DIP) left free under the alerts' default top edge, where the delta starts: at the default
 * 100 % their edit-mode sample (band, chips, incident and limiter lines) is 111 px and the tallest
 * live mix (two flags, an incident and the limiter alarm) 120 px, so a fresh layout never draws
 * the delta over the pit limiter alarm.
 */
export const ALERTS_DEFAULT_ROOM = 140

/**
 * Registry of every widget. Adding a widget starts here: add an entry, its
 * payload type to `WidgetPayloads`, its provider in `providers.ts`, its
 * Vue component in the renderer registry and its name in
 * `core.widgetTitles` of every dictionary (`widgetTitle()` in i18n; this
 * table holds no user-facing text). Main, telemetry and renderer all
 * derive their behaviour from this table.
 */
export const WIDGET_DEFS = {
  relative: {
    id: 'relative',
    hz: 10,
    defaultBounds: { x: 60, y: 260, width: 460, height: 252 },
    minSize: { width: 300, height: 150 },
    defaultVisible: true,
    defaultBackgroundOpacity: 0.78,
    sizeModel: 'free',
    defaultShowIn: { practice: true, qualify: true, race: true },
    followsCamera: true
  },
  radar: {
    id: 'radar',
    hz: 60,
    // Clear of the delta below the alerts (x 760 on).
    defaultBounds: { x: 540, y: 260, width: 220, height: 260 },
    minSize: { width: 120, height: 140 },
    defaultVisible: true,
    defaultBackgroundOpacity: 0.8,
    sizeModel: 'free',
    defaultShowIn: { practice: true, qualify: true, race: true }
  },
  standings: {
    id: 'standings',
    hz: 4,
    defaultBounds: { x: 1340, y: 120, width: 540, height: 470 },
    minSize: { width: 240, height: 60 },
    defaultVisible: true,
    defaultBackgroundOpacity: 0.78,
    sizeModel: 'auto-height',
    defaultShowIn: { practice: true, qualify: true, race: true },
    followsCamera: true
  },
  battle: {
    id: 'battle',
    hz: 4,
    defaultBounds: { x: 60, y: 540, width: 380, height: 190 },
    minSize: { width: 220, height: 60 },
    defaultVisible: true,
    defaultBackgroundOpacity: 0.8,
    sizeModel: 'auto-height',
    defaultShowIn: { practice: false, qualify: false, race: true },
    followsCamera: true
  },
  inputs: {
    id: 'inputs',
    hz: 60,
    defaultBounds: { x: 820, y: 860, width: 360, height: 120 },
    // Narrow enough for the bars-only layout (~140 x 110 is a common placement).
    minSize: { width: 120, height: 70 },
    defaultVisible: true,
    defaultBackgroundOpacity: 0.75,
    sizeModel: 'free',
    defaultShowIn: { practice: true, qualify: true, race: true }
  },
  traffic: {
    id: 'traffic',
    hz: 4,
    defaultBounds: { x: 1340, y: 620, width: 400, height: 160 },
    minSize: { width: 220, height: 60 },
    defaultVisible: true,
    defaultBackgroundOpacity: 0.8,
    sizeModel: 'auto-height',
    defaultShowIn: { practice: true, qualify: true, race: true },
    followsCamera: true
  },
  alerts: {
    id: 'alerts',
    hz: 10,
    // Grows down to ALERTS_DEFAULT_ROOM, where the delta starts.
    defaultBounds: { x: 760, y: 90, width: 400, height: 70 },
    minSize: { width: 200, height: 50 },
    defaultVisible: true,
    defaultBackgroundOpacity: 0.85,
    sizeModel: 'auto-height',
    defaultShowIn: { practice: true, qualify: true, race: true }
  },
  delta: {
    id: 'delta',
    hz: 30,
    defaultBounds: { x: 760, y: 90 + ALERTS_DEFAULT_ROOM, width: 400, height: 80 },
    minSize: { width: 200, height: 48 },
    defaultVisible: true,
    defaultBackgroundOpacity: 0.8,
    sizeModel: 'free',
    defaultShowIn: { practice: true, qualify: true, race: true }
  },
  // Weather moves slowly: once a second is plenty. Top left, above the relative.
  conditions: {
    id: 'conditions',
    hz: 1,
    defaultBounds: { x: 60, y: 90, width: 320, height: 130 },
    minSize: { width: 180, height: 40 },
    defaultVisible: true,
    defaultBackgroundOpacity: 0.8,
    sizeModel: 'auto-height',
    defaultShowIn: { practice: true, qualify: true, race: true }
  },
  // Fuel moves a tenth of a litre every few seconds: twice a second is plenty (the laps are
  // measured on every tick anyway). Bottom right, beside the pedals and under the traffic; races
  // only by default, like the battle.
  fuel: {
    id: 'fuel',
    hz: 2,
    defaultBounds: { x: 1200, y: 820, width: 320, height: 170 },
    minSize: { width: 180, height: 40 },
    defaultVisible: true,
    defaultBackgroundOpacity: 0.8,
    sizeModel: 'auto-height',
    defaultShowIn: { practice: false, qualify: false, race: true }
  }
} as const satisfies Record<string, WidgetDef>

export type WidgetId = keyof typeof WIDGET_DEFS

export const WIDGET_IDS = Object.keys(WIDGET_DEFS) as WidgetId[]

export function isWidgetId(value: unknown): value is WidgetId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(WIDGET_DEFS, value)
}

/** WidgetDef.followsCamera: shown during a replay, about the car on camera. */
export function followsCamera(id: WidgetId): boolean {
  const def: WidgetDef = WIDGET_DEFS[id]
  return def.followsCamera === true
}
