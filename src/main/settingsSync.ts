/**
 * Pure helpers for main's settings plumbing (no Electron): which renderer is
 * asking, validation of settings-window commands and the side effects a
 * settings change needs.
 */
import { isPersonalBestKeys } from '@shared/delta/references'
import { deepEqual } from '@shared/equal'
import type { RendererView, SettingsCommand } from '@shared/ipc'
import { LAYOUT_MODES, isLayoutId, normalizeCarRef } from '@shared/layouts'
import { toTelemetryConfig } from '@shared/settings'
import {
  OPTION_SCHEMA,
  displayOnlyFields,
  type ConfigSection,
  type ElementsSpec,
  type OptionSpec
} from '@shared/settingsSchema'
import type { ElementEntry, LayoutMode, OverlaySettings } from '@shared/types'
import { WIDGET_IDS, isWidgetId, type WidgetId } from '@shared/widgets'

export interface SenderLookup<S> {
  /** One of the overlay windows (one per display). */
  isOverlay(sender: S): boolean
  isSettings(sender: S): boolean
}

/** Page shown by the renderer that sent an IPC message; null for any other sender. */
export function viewOfSender<S>(sender: S, lookup: SenderLookup<S>): RendererView | null {
  if (lookup.isSettings(sender)) return { kind: 'settings' }
  return lookup.isOverlay(sender) ? { kind: 'overlay' } : null
}

/** Validates an untrusted `IPC.command` payload. */
export function isSettingsCommand(raw: unknown): raw is SettingsCommand {
  if (typeof raw !== 'object' || raw === null) return false
  const cmd = raw as Record<string, unknown>
  switch (cmd.type) {
    case 'set-edit-mode':
    case 'capture-shortcuts':
      return typeof cmd.on === 'boolean'
    case 'set-overlay-hidden':
      return typeof cmd.hidden === 'boolean'
    case 'reset-widget-bounds':
    case 'reset-widget-options':
      return isWidgetId(cmd.widgetId)
    case 'open-settings-folder':
    case 'refresh-personal-bests':
    case 'clear-personal-bests':
      return true
    case 'delete-personal-bests':
      return isPersonalBestKeys(cmd.keys)
    // Names are cleaned by the layout commands themselves (layoutName); a string is enough here.
    case 'layout-save':
      return isName(cmd.name) && isModeOrAbsent(cmd.mode)
    case 'layout-apply':
    case 'layout-delete':
    case 'layout-export':
      return isLayoutId(cmd.id)
    case 'layout-set-mode':
      return isLayoutId(cmd.id) && isLayoutMode(cmd.mode)
    case 'layout-options-to-all':
      return isWidgetId(cmd.widgetId) && isLayoutId(cmd.layoutId)
    case 'layout-duplicate':
    case 'layout-rename':
      return isLayoutId(cmd.id) && isName(cmd.name)
    case 'layout-move':
      return (
        isLayoutId(cmd.id) &&
        (cmd.step === -1 || cmd.step === 1) &&
        (cmd.aroundActive === undefined || typeof cmd.aroundActive === 'boolean')
      )
    case 'layout-import':
      return isModeOrAbsent(cmd.mode)
    case 'layout-link-car':
      return (
        normalizeCarRef(cmd.car) !== null && (cmd.layoutId === null || isLayoutId(cmd.layoutId))
      )
    default:
      return false
  }
}

function isLayoutMode(v: unknown): v is LayoutMode {
  return (LAYOUT_MODES as readonly unknown[]).includes(v)
}

function isModeOrAbsent(v: unknown): boolean {
  return v === undefined || isLayoutMode(v)
}

/** A name as sent (cleaned later); longer than any sane one is refused outright. */
function isName(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 1000
}

export interface SettingsDiff {
  /** Anything differs: renderers need the new settings. */
  changed: boolean
  /** Widgets the user enabled or disabled: their window must be shown or hidden. */
  visibilityChanged: WidgetId[]
  /** The telemetry process needs a new `TelemetryConfig`. */
  telemetryConfigChanged: boolean
}

export function diffSettings(prev: OverlaySettings, next: OverlaySettings): SettingsDiff {
  return {
    changed: !deepEqual(prev, next),
    visibilityChanged: WIDGET_IDS.filter(
      (id) => prev.widgets[id].visible !== next.widgets[id].visible
    ),
    telemetryConfigChanged: !deepEqual(computedConfig(prev), computedConfig(next))
  }
}

export type { ConfigSection }

const CONFIG_SECTIONS = [
  'visibility',
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
] as const satisfies readonly ConfigSection[]

/**
 * Options only the renderer reads (`displayOnly` in OPTION_SCHEMA). Toggling
 * them must not make the telemetry process recompute anything, so they are
 * left out of the comparison. `enabledWidgets` and the visibility `rules` are
 * compared whole; whatever is not in TelemetryConfig at all (appearance,
 * per-widget scale, auto height, anchor, bounds, opacity, lock) is
 * display-only by construction.
 */
export const DISPLAY_ONLY: { readonly [K in ConfigSection]: readonly string[] } = {
  visibility: displayOnlyFields('visibility').map(String),
  relative: displayOnlyFields('relative').map(String),
  radar: displayOnlyFields('radar').map(String),
  standings: displayOnlyFields('standings').map(String),
  battle: displayOnlyFields('battle').map(String),
  inputs: displayOnlyFields('inputs').map(String),
  traffic: displayOnlyFields('traffic').map(String),
  alerts: displayOnlyFields('alerts').map(String),
  delta: displayOnlyFields('delta').map(String),
  fuel: displayOnlyFields('fuel').map(String),
  lights: displayOnlyFields('lights').map(String)
}

/**
 * The telemetry config without the display-only options. An element list the provider reads
 * counts by the visibility of its computed ids only: the order is the renderer's alone, so a
 * reorder never makes the telemetry process recompute (the ids are compared sorted).
 */
export function computedConfig(settings: OverlaySettings): Record<string, unknown> {
  const config = toTelemetryConfig(settings)
  const out: Record<string, unknown> = { ...config }
  for (const section of CONFIG_SECTIONS) {
    const options: Record<string, unknown> = { ...config[section] }
    for (const key of DISPLAY_ONLY[section]) delete options[key]
    const specs = OPTION_SCHEMA[section] as Readonly<Record<string, OptionSpec>>
    for (const [field, spec] of Object.entries(specs)) {
      if (spec.kind === 'elements' && field in options) {
        options[field] = computedIds(options[field], spec)
      }
    }
    out[section] = options
  }
  return out
}

/**
 * The visible ids of a list that the provider reads (`spec.computed`, every id when absent),
 * sorted; a malformed list as it is (it cannot come out of normalisation).
 */
export function computedIds(list: unknown, spec: ElementsSpec): unknown {
  if (!Array.isArray(list)) return list
  const read = spec.computed === undefined ? null : new Set<string>(spec.computed)
  return (list as ElementEntry[])
    .filter((e) => e.visible && (read === null || read.has(e.id)))
    .map((e) => e.id)
    .sort()
}
