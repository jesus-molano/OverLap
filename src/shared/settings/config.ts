/** What the telemetry process receives. */
import type { OverlaySettings, TelemetryConfig } from '../types'
import { WIDGET_IDS, type WidgetId } from '../widgets'

/**
 * Only visible widgets are computed; the visibility rules travel with the
 * options. Everything is copied: the result shares no object with `settings`.
 */
export function toTelemetryConfig(settings: OverlaySettings): TelemetryConfig {
  const rules = {} as TelemetryConfig['rules']
  for (const id of WIDGET_IDS) {
    const w = settings.widgets[id]
    rules[id] = {
      showIn: { ...w.showIn },
      hideInPits: w.hideInPits,
      showOnSessionScreen: w.showOnSessionScreen
    }
  }
  const s = settings
  return {
    enabledWidgets: WIDGET_IDS.filter((id: WidgetId) => s.widgets[id].visible),
    rules,
    visibility: { ...s.visibility },
    relative: { ...s.relative },
    radar: { ...s.radar },
    standings: { ...s.standings, columns: s.standings.columns.map((c) => ({ ...c })) },
    battle: { ...s.battle },
    inputs: { ...s.inputs, colors: { ...s.inputs.colors } },
    traffic: { ...s.traffic },
    alerts: { ...s.alerts },
    delta: { ...s.delta },
    conditions: { ...s.conditions },
    fuel: { ...s.fuel },
    lights: { ...s.lights }
  }
}
