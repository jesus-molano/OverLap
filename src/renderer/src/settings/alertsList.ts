/**
 * Avisos as eye lists (R12: Contenido for behaviour, Personalizar for what is drawn): its alert
 * switches, kept as they are stored (alerts.show*), read as five fixed-order lists, one per
 * group, with an eye each, as Testigos' and Radar's lists are. A blue flag and a furled flag
 * belong to the flags, the overspeed to the limiter: their eye greys out while it is hidden. Pure.
 */
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import type { AlertsOptions, ElementEntry } from '@shared/types'
import type { SpecRules } from './elements/listOps'

/** An alert switch of the section (its `show*` fields). */
export type AlertKey = Extract<
  keyof AlertsOptions,
  | 'showFlags'
  | 'showBlue'
  | 'showFurled'
  | 'showPitLimiter'
  | 'showPitOverspeed'
  | 'showPitEntry'
  | 'showLapsToGo'
  | 'showTow'
  | 'showWrongWay'
  | 'showIncidents'
  | 'showStalled'
  | 'showOilPressure'
  | 'showDamage'
  | 'showBoxThisLap'
  | 'showFuelLow'
>

export type AlertGroupKey = 'flags' | 'pit' | 'race' | 'engine' | 'fuel'

export interface AlertGroup {
  readonly key: AlertGroupKey
  readonly spec: SpecRules<AlertKey>
}

function group(
  key: AlertGroupKey,
  ids: readonly AlertKey[],
  parents: Readonly<Partial<Record<AlertKey, AlertKey>>> = {}
): AlertGroup {
  return {
    key,
    spec: {
      ids,
      default: ids.map((id) => ({ id, visible: OPTION_SCHEMA.alerts[id].default })),
      required: [],
      fixedOrder: true,
      parents
    }
  }
}

/** The page's order: flags, pit lane, the race, the engine, the fuel. */
export const ALERT_GROUPS: readonly AlertGroup[] = [
  group('flags', ['showFlags', 'showBlue', 'showFurled'], {
    showBlue: 'showFlags',
    showFurled: 'showFlags'
  }),
  group('pit', ['showPitLimiter', 'showPitOverspeed', 'showPitEntry'], {
    showPitOverspeed: 'showPitLimiter'
  }),
  group('race', ['showLapsToGo', 'showTow', 'showWrongWay', 'showIncidents']),
  group('engine', ['showStalled', 'showOilPressure', 'showDamage']),
  group('fuel', ['showBoxThisLap', 'showFuelLow'])
]

/** A group's switches as its list. */
export function alertItems(g: AlertGroup, o: AlertsOptions): ElementEntry<AlertKey>[] {
  return g.spec.ids.map((id) => ({ id, visible: o[id] }))
}

/** The patch a group's edited list makes: each of its switches as its eye says. */
export function alertPatch(next: readonly ElementEntry<AlertKey>[]): Partial<AlertsOptions> {
  const out: Partial<Record<AlertKey, boolean>> = {}
  for (const e of next) out[e.id] = e.visible
  return out
}
