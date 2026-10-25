/**
 * Pure helpers for main's settings plumbing (no Electron): which renderer is
 * asking, validation of settings-window commands and the side effects a
 * settings change needs.
 */
import { isPersonalBestKeys } from '@shared/delta/references'
import { deepEqual } from '@shared/equal'
import type { RendererView, SettingsCommand } from '@shared/ipc'
import { toTelemetryConfig } from '@shared/settings'
import { displayOnlyFields, type ConfigSection } from '@shared/settingsSchema'
import type { OverlaySettings, StandingsColumn, StandingsColumnId } from '@shared/types'
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
      return typeof cmd.on === 'boolean'
    case 'reset-widget-bounds':
    case 'reset-widget-options':
      return isWidgetId(cmd.widgetId)
    case 'open-settings-folder':
    case 'refresh-personal-bests':
    case 'clear-personal-bests':
      return true
    case 'delete-personal-bests':
      return isPersonalBestKeys(cmd.keys)
    default:
      return false
  }
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
  'relative',
  'radar',
  'standings',
  'battle',
  'inputs',
  'traffic',
  'alerts',
  'delta'
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
  relative: displayOnlyFields('relative').map(String),
  radar: displayOnlyFields('radar').map(String),
  standings: displayOnlyFields('standings').map(String),
  battle: displayOnlyFields('battle').map(String),
  inputs: displayOnlyFields('inputs').map(String),
  traffic: displayOnlyFields('traffic').map(String),
  alerts: displayOnlyFields('alerts').map(String),
  delta: displayOnlyFields('delta').map(String)
}

/** The telemetry config without the display-only options. */
export function computedConfig(settings: OverlaySettings): Record<string, unknown> {
  const config = toTelemetryConfig(settings)
  const out: Record<string, unknown> = { ...config }
  for (const section of CONFIG_SECTIONS) {
    const options: Record<string, unknown> = { ...config[section] }
    for (const key of DISPLAY_ONLY[section]) delete options[key]
    if (section === 'standings' && 'columns' in options) {
      options.columns = visibleColumns(config.standings.columns)
    }
    out[section] = options
  }
  return out
}

/**
 * The provider may skip what no visible column shows (the per-row iRating
 * projection for 'delta', for one), so visibility counts; the order is the
 * renderer's alone, so the set is compared sorted.
 */
function visibleColumns(columns: readonly StandingsColumn[]): StandingsColumnId[] {
  return columns
    .filter((c) => c.visible)
    .map((c) => c.id)
    .sort()
}
