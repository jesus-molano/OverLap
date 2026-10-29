/** Defensive load of anything read from disk. */
import type { OverlaySettings, Rect, Size } from '../types'
import { WIDGET_DEFS, WIDGET_IDS } from '../widgets'
import { OPTION_SECTIONS, createDefaultSettings, sectionSpecs } from './defaults'
import {
  disableDuplicateAccelerators,
  isFiniteNumber,
  isRecord,
  mergeSection,
  mergeWidgetFields
} from './fields'
import {
  HIDDEN_WHEN_ADDED,
  SHOWN_WHEN_ADDED,
  migrateSection,
  migrateWidgetsV5,
  placeNewWidget,
  shownWhenAdded
} from './migrate'

/** Upper bound for a widget dimension; anything larger is a corrupt file. */
const MAX_WIDGET_DIMENSION = 10_000

/**
 * Merges anything read from disk with the defaults. Never throws: unknown
 * widget ids and keys are dropped, missing widgets and fields get their
 * defaults, invalid values are replaced and numbers are clamped to their
 * ranges; a shortcut combination repeated on disk stays with the first action
 * only. The `version` field is not trusted: v1/v2/v3 files are recognised by
 * their fields (see migrate.ts), and files from before v5 get its changed defaults once (the
 * only use of the version); the result is always the current version. A
 * file with widgets saved but not a HIDDEN_WHEN_ADDED one gets that one hidden,
 * in a free spot (`placeNewWidget`); a SHOWN_WHEN_ADDED one, in a free spot and
 * shown unless the file says it would be new to its driver (`shownWhenAdded`).
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
  return out
}

/** Field by field: an invalid coordinate falls back to the default one. */
function normalizeBounds(raw: unknown, fallback: Rect, minSize: Size): Rect {
  if (!isRecord(raw)) return { ...fallback }
  const pick = (v: unknown, def: number): number => (isFiniteNumber(v) ? Math.round(v) : def)
  const size = (v: unknown, def: number, min: number): number =>
    isFiniteNumber(v) && v > 0 ? Math.min(MAX_WIDGET_DIMENSION, Math.max(min, Math.round(v))) : def
  return {
    x: pick(raw.x, fallback.x),
    y: pick(raw.y, fallback.y),
    width: size(raw.width, fallback.width, minSize.width),
    height: size(raw.height, fallback.height, minSize.height)
  }
}
