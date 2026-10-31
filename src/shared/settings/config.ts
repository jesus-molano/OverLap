/** What the telemetry process receives. */
import type { ConfigSection } from '../settingsSchema'
import type { OverlaySettings, TelemetryConfig } from '../types'
import { WIDGET_IDS, canHideInPits, type WidgetId } from '../widgets'
import { sectionSpecs } from './defaults'
import { isRecord } from './fields'

/**
 * A section's options with every object field copied (element lists entry by entry, colour
 * sets, names lists), from the schema: a new list or set needs nothing here.
 */
function copySection<S extends ConfigSection>(
  section: S,
  options: OverlaySettings[S]
): OverlaySettings[S] {
  const out: Record<string, unknown> = { ...options }
  for (const [field, spec] of Object.entries(sectionSpecs(section))) {
    const v = out[field]
    if (spec.kind === 'elements' && Array.isArray(v)) {
      out[field] = v.map((e: unknown) => (isRecord(e) ? { ...e } : e))
    } else if (spec.kind === 'names' && Array.isArray(v)) {
      out[field] = [...(v as unknown[])]
    } else if (spec.kind === 'colors' && isRecord(v)) {
      out[field] = { ...v }
    }
  }
  return out as unknown as OverlaySettings[S]
}

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
      hideInPits: w.hideInPits && canHideInPits(id),
      showOnSessionScreen: w.showOnSessionScreen
    }
  }
  const s = settings
  return {
    enabledWidgets: WIDGET_IDS.filter((id: WidgetId) => s.widgets[id].visible),
    rules,
    visibility: copySection('visibility', s.visibility),
    relative: copySection('relative', s.relative),
    radar: copySection('radar', s.radar),
    standings: copySection('standings', s.standings),
    battle: copySection('battle', s.battle),
    inputs: copySection('inputs', s.inputs),
    traffic: copySection('traffic', s.traffic),
    alerts: copySection('alerts', s.alerts),
    delta: copySection('delta', s.delta),
    fuel: copySection('fuel', s.fuel),
    lights: copySection('lights', s.lights),
    spotter: copySection('spotter', s.spotter)
  }
}
