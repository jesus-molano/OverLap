/**
 * Avisos as eye lists (R12: Contenido for behaviour, Personalizar for what is drawn): its alert
 * switches, kept as they are stored (alerts.show*), read as five fixed-order lists, one per
 * group, with an eye each, as Testigos' and Radar's lists are. A blue flag and a furled flag
 * belong to the flags, the overspeed to the limiter: their eye greys out while it is hidden. Pure.
 */
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import { isElementVisible, setElementVisible } from '@shared/elements'
import type { AlertsOptions, ElementEntry, LightKind, LightsOptions } from '@shared/types'
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

/**
 * Every alert as one fixed-order list (R12): the groups' ids in the page's order, each group's
 * name as a subhead above its first row (ALERT_GROUP_HEADS), one reset and one help for all.
 */
export const ALERTS_SPEC: SpecRules<AlertKey> = {
  ids: ALERT_GROUPS.flatMap((g) => g.spec.ids),
  default: ALERT_GROUPS.flatMap((g) => g.spec.default),
  required: [],
  fixedOrder: true,
  parents: Object.assign({}, ...ALERT_GROUPS.map((g) => g.spec.parents)) as Readonly<
    Partial<Record<AlertKey, AlertKey>>
  >
}

/** The first alert of each group: its subhead goes above it. */
export const ALERT_GROUP_HEADS: readonly (readonly [AlertKey, AlertGroupKey])[] = ALERT_GROUPS.map(
  (g) => [g.spec.ids[0] as AlertKey, g.key] as const
)

/** Every alert's switch as the one list. */
export function allAlertItems(o: AlertsOptions): ElementEntry<AlertKey>[] {
  return ALERTS_SPEC.ids.map((id) => ({ id, visible: o[id] }))
}

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

/**
 * The events both widgets have (R39): the banner in Avisos and the lamp in Testigos. Each page's
 * row of one of them has a box for the other, so an event is never on in one place without a
 * hint that it is in the other.
 */
export const SHARED_EVENTS: readonly (readonly [AlertKey, LightKind])[] = [
  ['showStalled', 'stalled'],
  ['showOilPressure', 'oilPressure'],
  ['showPitLimiter', 'pitLimiter']
]

/** The Testigos lamp of an alert, null when Testigos has none. */
export function lightOfAlert(id: string): LightKind | null {
  return SHARED_EVENTS.find(([a]) => a === id)?.[1] ?? null
}

/** The Avisos switch of a lamp, null when Avisos has none. */
export function alertOfLight(id: string): AlertKey | null {
  return SHARED_EVENTS.find(([, l]) => l === id)?.[0] ?? null
}

/** Whether Testigos shows the lamp. */
export function lightShown(o: Pick<LightsOptions, 'icons'>, kind: LightKind): boolean {
  return isElementVisible(o.icons, kind)
}

/** Testigos' list with one lamp shown or hidden (its place kept). */
export function lightsPatch(
  o: Pick<LightsOptions, 'icons'>,
  kind: LightKind,
  on: boolean
): Pick<LightsOptions, 'icons'> {
  return { icons: setElementVisible(o.icons, kind, on) }
}
