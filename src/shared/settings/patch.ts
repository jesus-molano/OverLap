/** Changes requested by the settings window and its one-shot commands. */
import type { OptionSection } from '../settingsSchema'
import type { OverlaySettings } from '../types'
import { WIDGET_DEFS, WIDGET_IDS, isWidgetId, type WidgetId } from '../widgets'
import { OPTION_SECTIONS, defaultOptions, defaultWidgetSettings, sectionSpecs } from './defaults'
import { isRecord, mergeSection, mergeWidgetFields, revertDuplicateAccelerators } from './fields'
import { normalizeSettings } from './normalize'

/**
 * Applies an untrusted patch from the settings window. Returns a new
 * normalised object and never mutates `current`. Only known widget ids and
 * their non-bounds fields, plus the known fields of each option section, are
 * taken; invalid values keep the current one and numbers are clamped like in
 * `normalizeSettings`. A column list replaces the current one (normalised);
 * colour sets merge per colour. A shortcut combination another action has is
 * refused (that action keeps its own, the patched one its current one). Bounds
 * cannot be changed here.
 */
export function applySettingsPatch(current: OverlaySettings, patch: unknown): OverlaySettings {
  const out = normalizeSettings(current)
  if (!isRecord(patch)) return out

  if (isRecord(patch.widgets)) {
    for (const id of WIDGET_IDS) {
      const p = patch.widgets[id]
      if (isRecord(p)) mergeWidgetFields(id, out.widgets[id], p)
    }
  }
  for (const section of OPTION_SECTIONS) {
    const p = patch[section]
    if (!isRecord(p)) continue
    const before = { ...out[section] }
    mergeSection(out[section], p, sectionSpecs(section))
    revertDuplicateAccelerators(out[section], before, sectionSpecs(section))
  }
  return out
}

/** New settings with the widget's bounds back to its `WIDGET_DEFS` default. */
export function resetWidgetBounds(current: OverlaySettings, id: WidgetId): OverlaySettings {
  const out = normalizeSettings(current)
  // The id usually comes straight from IPC.
  if (isWidgetId(id)) out.widgets[id].bounds = { ...WIDGET_DEFS[id].defaultBounds }
  return out
}

/**
 * New settings with the widget's options and look (scale, auto height,
 * anchor, "Mostrar en", hide in pits, background opacity) back to their
 * defaults. Bounds, visibility and the lock are kept: this is not a layout
 * reset.
 */
export function resetWidgetOptions(current: OverlaySettings, id: WidgetId): OverlaySettings {
  const out = normalizeSettings(current)
  if (!isWidgetId(id)) return out
  const { bounds, visible, locked } = out.widgets[id]
  out.widgets[id] = { ...defaultWidgetSettings(id), bounds, visible, locked }
  setSection(out, id, defaultOptions(id))
  return out
}

function setSection<S extends OptionSection>(
  s: OverlaySettings,
  section: S,
  value: OverlaySettings[S]
): void {
  s[section] = value
}
