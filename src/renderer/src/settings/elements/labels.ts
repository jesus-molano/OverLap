/**
 * The words of every element list of the settings (OPTION_SCHEMA 'elements' specs): each zone's
 * title and each element's label and hint, in the interface language. Typed by the schema: a
 * new list, or a new id in one, without its words here (and in both dictionaries) does not
 * compile. The settings pages pass these to ElementEditor.vue.
 */
import { widgetTitle, type Messages } from '@shared/i18n'
import { INFO_BAR_ENTRY_IDS } from '@shared/infoBar'
import {
  CUSTOMIZE_ZONE_IDS,
  type ElementField,
  type ElementIdOf,
  type OptionSection
} from '@shared/settingsSchema'
import type { CustomizeZoneId, InfoBarEntryId, LightKind, StandingsColumnId } from '@shared/types'
import type { WidgetId } from '@shared/widgets'
import type { ElementText } from './listOps'

type Texts<Id extends string> = Readonly<Record<Id, ElementText>>

type ZoneWords = {
  readonly [S in OptionSection]: {
    readonly [F in ElementField<S>]: {
      readonly title: (m: Messages) => string
      readonly items: (m: Messages) => Texts<ElementIdOf<S, F>>
    }
  }
}

/** Plain labels (no hints) as element texts. */
function plain<Id extends string>(labels: Readonly<Record<Id, string>>): Texts<Id> {
  const out = {} as Record<Id, ElementText>
  for (const id of Object.keys(labels) as Id[]) out[id] = { label: labels[id] }
  return out
}

/** Every info bar's entries: the catalog's items and the split marker. */
export function infoBarTexts(m: Messages): Texts<InfoBarEntryId> {
  const b = m.settings.infoBar
  const hints: Readonly<Partial<Record<InfoBarEntryId, string>>> = b.hints
  const out = {} as Record<InfoBarEntryId, ElementText>
  for (const id of INFO_BAR_ENTRY_IDS) {
    out[id] =
      id === 'split'
        ? { label: b.split, hint: b.splitHint }
        : { label: b.items[id], ...(hints[id] !== undefined ? { hint: hints[id] } : {}) }
  }
  return out
}

function standingsColumns(m: Messages): Texts<StandingsColumnId> {
  const c = m.settings.columns
  const hints: Readonly<Partial<Record<StandingsColumnId, string>>> = c.hints
  const out = {} as Record<StandingsColumnId, ElementText>
  for (const id of Object.keys(c.labels) as StandingsColumnId[]) {
    out[id] = { label: c.labels[id], ...(hints[id] !== undefined ? { hint: hints[id] } : {}) }
  }
  return out
}

function lights(m: Messages): Texts<LightKind> {
  const names = m.widgets.lights.names
  const help = m.settings.lights.help
  const out = {} as Record<LightKind, ElementText>
  for (const id of Object.keys(names) as LightKind[]) {
    out[id] = { label: names[id], hint: help[id] }
  }
  return out
}

/** The accordions' zones by page and name: 'Relativo · Columnas'. */
function customizeZoneTexts(m: Messages): Texts<CustomizeZoneId> {
  const out = {} as Record<CustomizeZoneId, ElementText>
  for (const id of CUSTOMIZE_ZONE_IDS) {
    const [section, field] = id.split('.') as [WidgetId, string]
    const zones = ZONES[section] as Readonly<Record<string, { title: (m: Messages) => string }>>
    out[id] = { label: `${widgetTitle(m, section)} · ${zones[field]?.title(m) ?? field}` }
  }
  return out
}

const ZONES: ZoneWords = {
  appearance: {},
  visibility: {},
  relative: {
    columns: {
      title: (m) => m.settings.zones.relative.columns,
      items: (m) => plain(m.settings.items.relative.columns)
    },
    headerBar: { title: (m) => m.settings.zones.relative.headerBar, items: infoBarTexts },
    footerBar: { title: (m) => m.settings.zones.relative.footerBar, items: infoBarTexts }
  },
  radar: {
    parts: {
      title: (m) => m.settings.zones.radar.parts,
      items: (m) => plain(m.settings.items.radar.parts)
    }
  },
  standings: {
    columns: { title: (m) => m.settings.zones.standings.columns, items: standingsColumns },
    headerBar: { title: (m) => m.settings.zones.standings.headerBar, items: infoBarTexts },
    subheaderBar: { title: (m) => m.settings.zones.standings.subheaderBar, items: infoBarTexts },
    footerBar: { title: (m) => m.settings.zones.standings.footerBar, items: infoBarTexts },
    classLine: {
      title: (m) => m.settings.zones.standings.classLine,
      items: (m) => plain(m.settings.items.standings.classLine)
    }
  },
  battle: {
    lanes: {
      title: (m) => m.settings.zones.battle.lanes,
      items: (m) => plain(m.settings.items.battle.lanes)
    },
    rows: {
      title: (m) => m.settings.zones.battle.rows,
      items: (m) => plain(m.settings.items.battle.rows)
    },
    parts: {
      title: (m) => m.settings.zones.battle.parts,
      items: (m) => plain(m.settings.items.battle.parts)
    },
    headerBar: { title: (m) => m.settings.zones.battle.headerBar, items: infoBarTexts },
    footerBar: { title: (m) => m.settings.zones.battle.footerBar, items: infoBarTexts }
  },
  inputs: {
    sections: {
      title: (m) => m.settings.zones.inputs.sections,
      items: (m) => plain(m.settings.items.inputs.sections)
    },
    bars: {
      title: (m) => m.settings.zones.inputs.bars,
      items: (m) => plain(m.settings.items.inputs.bars)
    },
    info: {
      title: (m) => m.settings.zones.inputs.info,
      items: (m) => plain(m.settings.items.inputs.info)
    },
    car: {
      title: (m) => m.settings.zones.inputs.car,
      items: (m) => plain(m.settings.items.inputs.car)
    }
  },
  traffic: {
    groups: {
      title: (m) => m.settings.zones.traffic.groups,
      items: (m) => plain(m.settings.items.traffic.groups)
    },
    parts: {
      title: (m) => m.settings.zones.traffic.parts,
      items: (m) => plain(m.settings.items.traffic.parts)
    },
    headerBar: { title: (m) => m.settings.zones.traffic.headerBar, items: infoBarTexts },
    footerBar: { title: (m) => m.settings.zones.traffic.footerBar, items: infoBarTexts }
  },
  alerts: {
    parts: {
      title: (m) => m.settings.zones.alerts.parts,
      items: (m) => plain(m.settings.items.alerts.parts)
    }
  },
  delta: {
    rows: {
      title: (m) => m.settings.zones.delta.rows,
      items: (m) => plain(m.settings.items.delta.rows)
    },
    top: {
      title: (m) => m.settings.zones.delta.top,
      items: (m) => plain(m.settings.items.delta.top)
    },
    laps: {
      title: (m) => m.settings.zones.delta.laps,
      items: (m) => plain(m.settings.items.delta.laps)
    }
  },
  fuel: {
    headerBar: { title: (m) => m.settings.zones.fuel.headerBar, items: infoBarTexts },
    lines: {
      title: (m) => m.settings.zones.fuel.lines,
      items: (m) => plain(m.settings.items.fuel.lines)
    },
    footerBar: { title: (m) => m.settings.zones.fuel.footerBar, items: infoBarTexts }
  },
  lights: {
    icons: { title: (m) => m.settings.zones.lights.icons, items: lights }
  },
  shortcuts: {},
  settingsWindow: {
    customizeOpen: {
      title: (m) => m.settings.zones.settingsWindow.customizeOpen,
      items: customizeZoneTexts
    }
  },
  layouts: {}
}

/** The zone's title ('Columnas', 'Cabecera'). */
export function zoneTitle<S extends OptionSection, F extends ElementField<S>>(
  m: Messages,
  section: S,
  field: F
): string {
  return ZONES[section][field].title(m)
}

/** Every element's words of `section.field`, by id. */
export function elementTexts<S extends OptionSection, F extends ElementField<S>>(
  m: Messages,
  section: S,
  field: F
): Texts<ElementIdOf<S, F>> {
  return ZONES[section][field].items(m)
}
