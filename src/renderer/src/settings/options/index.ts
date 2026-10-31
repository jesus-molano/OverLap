import type { Component } from 'vue'
import type { WidgetId } from '@shared/widgets'
import AlertsSettings from './AlertsSettings.vue'
import BattleSettings from './BattleSettings.vue'
import DeltaSettings from './DeltaSettings.vue'
import FuelSettings from './FuelSettings.vue'
import InputsSettings from './InputsSettings.vue'
import LightsSettings from './LightsSettings.vue'
import RadarSettings from './RadarSettings.vue'
import RelativeSettings from './RelativeSettings.vue'
import SpotterSettings from './SpotterSettings.vue'
import StandingsSettings from './StandingsSettings.vue'
import TrafficSettings from './TrafficSettings.vue'

/**
 * The widget-specific sections ("Contenido", and e.g. "Columnas") of each widget page. They
 * take no props: each reads its option section with useOptions(). A widget without options
 * has no entry and its page shows only the window section.
 */
export const WIDGET_OPTIONS: Partial<Record<WidgetId, Component>> = {
  relative: RelativeSettings,
  radar: RadarSettings,
  spotter: SpotterSettings,
  standings: StandingsSettings,
  battle: BattleSettings,
  inputs: InputsSettings,
  traffic: TrafficSettings,
  alerts: AlertsSettings,
  lights: LightsSettings,
  delta: DeltaSettings,
  fuel: FuelSettings
}
