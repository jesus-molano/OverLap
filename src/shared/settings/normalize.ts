/** Defensive load of anything read from disk. */
import { boundControllers, normalizeDeviceNames } from '../controllers'
import { everyBinding } from '../shortcuts'
import type { OverlaySettings } from '../types'
import { WIDGET_DEFS, WIDGET_IDS } from '../widgets'
import { OPTION_SECTIONS, createDefaultSettings, sectionSpecs } from './defaults'
import {
  disableDuplicateAccelerators,
  isRecord,
  mergeSection,
  mergeWidgetFields,
  normalizeBounds
} from './fields'
import { normalizeLayoutLibrary } from './layouts'
import { bindingsOf, settleShortcuts } from './shortcuts'
import {
  HIDDEN_WHEN_ADDED,
  SHOWN_WHEN_ADDED,
  migrateSection,
  migrateWidgetsV5,
  placeNewWidget,
  shownWhenAdded
} from './migrate'

/**
 * Merges anything read from disk with the defaults. Never throws: unknown
 * widget ids and keys are dropped, missing widgets and fields get their
 * defaults, invalid values are replaced and numbers are clamped to their
 * ranges; a shortcut binding repeated on disk stays with the first action (and slot)
 * only, and each action's extra bindings (settings.shortcutsMore, settleShortcuts) are valid
 * and unique too. The `version` field is not trusted: v1/v2/v3 files are recognised by
 * their fields (see migrate.ts), and files from before v5 get its changed defaults once (the
 * only use of the version); the result is always the current version. A
 * file with widgets saved but not a HIDDEN_WHEN_ADDED one gets that one hidden,
 * in a free spot (`placeNewWidget`); a SHOWN_WHEN_ADDED one, in a free spot and
 * shown unless the file says it would be new to its driver (`shownWhenAdded`). A file without
 * saved layouts gets one equal to its widgets and options; the active layout always takes the
 * widgets' fields and the options in effect (layouts.ts).
 */
export function normalizeSettings(raw: unknown): OverlaySettings {
  const out = createDefaultSettings()
  if (!isRecord(raw)) return out

  const widgets = isRecord(raw.widgets) ? raw.widgets : {}
  for (const id of WIDGET_IDS) {
    const saved = widgets[id]
    if (!isRecord(saved)) continue
    const current = out.widgets[id]
    mergeWidgetFields(id, current, saved)
    current.bounds = normalizeBounds(saved.bounds, current.bounds, WIDGET_DEFS[id].minSize)
  }
  migrateWidgetsV5(out, raw)
  // Placed against every other widget's final bounds, so after the loop above.
  if (WIDGET_IDS.some((id) => isRecord(widgets[id]))) {
    for (const id of HIDDEN_WHEN_ADDED) if (!isRecord(widgets[id])) placeNewWidget(out, id)
    for (const id of SHOWN_WHEN_ADDED) {
      if (!isRecord(widgets[id])) placeNewWidget(out, id, shownWhenAdded(id, raw))
    }
  }
  for (const section of OPTION_SECTIONS) {
    const r = migrateSection(section, raw[section], raw)
    if (!isRecord(r)) continue
    mergeSection(out[section], r, sectionSpecs(section))
    disableDuplicateAccelerators(out[section], sectionSpecs(section))
  }
  // After the shortcuts section: its first bindings take part.
  settleShortcuts(out, raw.shortcutsMore)
  // Only the names of the controllers the final shortcuts use.
  out.buttonDeviceNames = normalizeDeviceNames(
    raw.buttonDeviceNames,
    boundControllers(everyBinding(bindingsOf(out)))
  )
  // Last: against the final widgets, named in the final language.
  out.savedLayouts = normalizeLayoutLibrary(
    raw.savedLayouts,
    out,
    out.appearance.language,
    raw.version
  )
  return out
}
