import { defineAsyncComponent, type Component } from 'vue'
import type { WidgetId } from '@shared/widgets'

/**
 * Renderer side of WIDGET_DEFS: a new widget adds its component here (default
 * export, no props). Async so each window only loads its own widget's chunk.
 */
export const WIDGET_COMPONENTS: { [K in WidgetId]: Component } = {
  relative: defineAsyncComponent(() => import('./relative/RelativeWidget.vue')),
  radar: defineAsyncComponent(() => import('./radar/RadarWidget.vue')),
  standings: defineAsyncComponent(() => import('./standings/StandingsWidget.vue')),
  battle: defineAsyncComponent(() => import('./battle/BattleWidget.vue')),
  inputs: defineAsyncComponent(() => import('./inputs/InputsWidget.vue')),
  traffic: defineAsyncComponent(() => import('./traffic/TrafficWidget.vue')),
  alerts: defineAsyncComponent(() => import('./alerts/AlertsWidget.vue')),
  delta: defineAsyncComponent(() => import('./delta/DeltaWidget.vue'))
}
