/**
 * The "Personalizar" accordions: which zone an editor is, whether its accordion is open, and
 * the page's list of them for "Expandir todo / Contraer todo". The open state is
 * settings.settingsWindow.customizeOpen (display only, every zone once, visible = open), so it is
 * remembered per page and zone across reopenings; a change shows at once and goes to main
 * (listSetter). Each page's CustomizeSection provides the registry its editors join.
 */
import {
  computed,
  inject,
  provide,
  shallowRef,
  type ComputedRef,
  type InjectionKey,
  type ShallowRef
} from 'vue'
import { DEFAULT_SETTINGS } from '@shared/settings'
import {
  CUSTOMIZE_ZONE_IDS,
  OPTION_SCHEMA,
  type OptionSection,
  type OptionSpec
} from '@shared/settingsSchema'
import type { CustomizeZoneId, ElementEntry } from '@shared/types'
import { overlayState } from '../../composables/useOverlay'
import { listSetter } from '../editor'

type OpenList = readonly Readonly<ElementEntry<CustomizeZoneId>>[]

let zoneBySpec: Map<object, CustomizeZoneId> | null = null

/**
 * The zone of an editor's list by its spec (each list of the schema has its own spec object):
 * null for a list that is no page's zone.
 */
export function zoneOfSpec(spec: object): CustomizeZoneId | null {
  if (zoneBySpec === null) {
    zoneBySpec = new Map()
    for (const id of CUSTOMIZE_ZONE_IDS) {
      const [section, field] = id.split('.') as [OptionSection, string]
      const own = (OPTION_SCHEMA[section] as Readonly<Record<string, OptionSpec>>)[field]
      if (own !== undefined) zoneBySpec.set(own, id)
    }
  }
  return zoneBySpec.get(spec) ?? null
}

/** `list` with every zone of `zones` opened or closed (new entries; the others copied). */
export function withZonesOpen(
  list: OpenList,
  zones: readonly CustomizeZoneId[],
  open: boolean
): ElementEntry<CustomizeZoneId>[] {
  return list.map((e) => ({ id: e.id, visible: zones.includes(e.id) ? open : e.visible }))
}

/** The last list sent while main has not answered it: what the accordions show meanwhile. */
const pending = shallowRef<OpenList | null>(null)

const openList: ComputedRef<OpenList> = computed(
  () =>
    pending.value ??
    overlayState.settings.value?.settingsWindow.customizeOpen ??
    DEFAULT_SETTINGS.settingsWindow.customizeOpen
)

export function isZoneOpen(zone: CustomizeZoneId): boolean {
  return openList.value.some((e) => e.id === zone && e.visible)
}

/** Opens or closes `zones`; settles when main has answered (never rejects). */
export async function setZonesOpen(
  zones: readonly CustomizeZoneId[],
  open: boolean
): Promise<void> {
  const list = openList.value
  if (zones.every((z) => isZoneOpen(z) === open)) return
  const next = withZonesOpen(list, zones, open)
  pending.value = next
  try {
    await listSetter('settingsWindow', 'customizeOpen')(next)
  } finally {
    if (pending.value === next) pending.value = null
  }
}

/** The accordions of one page's "Personalizar", in the order they joined. */
export interface ZoneRegistry {
  readonly zones: ShallowRef<readonly CustomizeZoneId[]>
  add(zone: CustomizeZoneId): void
  remove(zone: CustomizeZoneId): void
}

const REGISTRY: InjectionKey<ZoneRegistry> = Symbol('customize-zones')

export function provideZoneRegistry(): ZoneRegistry {
  const zones = shallowRef<readonly CustomizeZoneId[]>([])
  const registry: ZoneRegistry = {
    zones,
    add(zone) {
      if (!zones.value.includes(zone)) zones.value = [...zones.value, zone]
    },
    remove(zone) {
      zones.value = zones.value.filter((z) => z !== zone)
    }
  }
  provide(REGISTRY, registry)
  return registry
}

/** The page's registry, or null outside a CustomizeSection. */
export function injectZoneRegistry(): ZoneRegistry | null {
  return inject(REGISTRY, null)
}
