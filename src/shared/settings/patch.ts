/** Changes requested by the settings window and its one-shot commands. */
import type { OptionSection } from '../settingsSchema'
import type { OverlaySettings, Rect } from '../types'
import { WIDGET_DEFS, WIDGET_IDS, isWidgetId, type WidgetId } from '../widgets'
import { OPTION_SECTIONS, defaultOptions, defaultWidgetSettings, sectionSpecs } from './defaults'
import {
  isRecord,
  mergeSection,
  mergeWidgetFields,
  normalizeBounds,
  revertDuplicateAccelerators
} from './fields'
import { defaultBoundsIn } from './geometry'
import { syncActiveLayout } from './layouts'
import { normalizeSettings } from './normalize'
import { patchShortcuts } from './shortcuts'

/**
 * Applies an untrusted patch from the settings window. Returns a new
 * normalised object and never mutates `current`. Only known widget ids and
 * their non-bounds fields, plus the known fields of each option section, are
 * taken; invalid values keep the current one and numbers are clamped like in
 * `normalizeSettings`. A column list replaces the current one (normalised);
 * colour sets merge per colour. A shortcut binding another action has is
 * refused (that action keeps its own, the patched one its current ones:
 * patchShortcuts). Bounds cannot be changed here.
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
  patchShortcuts(out, patch.shortcuts, patch.shortcutBindings)
  for (const section of OPTION_SECTIONS) {
    // patchShortcuts took it, with the extra bindings.
    if (section === 'shortcuts') continue
    const p = patch[section]
    if (!isRecord(p)) continue
    const before = { ...out[section] }
    mergeSection(out[section], p, sectionSpecs(section))
    revertDuplicateAccelerators(out[section], before, sectionSpecs(section))
  }
  syncActiveLayout(out)
  return out
}

/**
 * New settings with the widget's bounds back to its `WIDGET_DEFS` default, placed for the primary
 * work area `area` when given (centred on an ultrawide one: defaultBoundsIn).
 */
export function resetWidgetBounds(
  current: OverlaySettings,
  id: WidgetId,
  area?: Rect
): OverlaySettings {
  const out = normalizeSettings(current)
  // The id usually comes straight from IPC.
  if (!isWidgetId(id)) return out
  const def = WIDGET_DEFS[id].defaultBounds
  out.widgets[id].bounds = area !== undefined ? defaultBoundsIn(def, area) : { ...def }
  syncActiveLayout(out)
  return out
}

/**
 * A first run's settings (no file yet) with the default layout placed for the primary work
 * area: moved to its middle on an ultrawide one (defaultLayoutOffsetX), else unchanged.
 */
export function placeDefaultLayout(current: OverlaySettings, area: Rect): OverlaySettings {
  const out = normalizeSettings(current)
  for (const id of WIDGET_IDS) {
    out.widgets[id].bounds = defaultBoundsIn(WIDGET_DEFS[id].defaultBounds, area)
  }
  syncActiveLayout(out)
  return out
}

/**
 * What a widget page's reset covers (R24): 'options', its option section (what the page shows
 * under Contenido and Personalizar); 'window', its "Ventana y visibilidad" (scale, auto height,
 * anchor, background, "Mostrar en", hide in pits, the session screen); 'all', both.
 */
export type WidgetResetPart = 'options' | 'window' | 'all'

export const WIDGET_RESET_PARTS: readonly WidgetResetPart[] = ['options', 'window', 'all']

export function isWidgetResetPart(v: unknown): v is WidgetResetPart {
  return typeof v === 'string' && (WIDGET_RESET_PARTS as readonly string[]).includes(v)
}

/**
 * New settings with the widget's options and look back to their defaults (`part`: which of
 * them). Bounds, visibility and the lock are kept: this is not a layout reset.
 */
export function resetWidgetOptions(
  current: OverlaySettings,
  id: WidgetId,
  part: WidgetResetPart = 'all'
): OverlaySettings {
  const out = normalizeSettings(current)
  if (!isWidgetId(id)) return out
  if (part !== 'options') {
    const { bounds, visible, locked } = out.widgets[id]
    out.widgets[id] = { ...defaultWidgetSettings(id), bounds, visible, locked }
  }
  if (part !== 'window') setSection(out, id, defaultOptions(id))
  syncActiveLayout(out)
  return out
}

/**
 * New settings with the widget's bounds set to `rect` (an undo of a reset, or a size typed on
 * its page), checked as a saved file's are: whole numbers, at least its minimum size. Main places
 * it on a display as for any saved bounds.
 */
export function setWidgetBounds(
  current: OverlaySettings,
  id: WidgetId,
  rect: unknown
): OverlaySettings {
  const out = normalizeSettings(current)
  if (!isWidgetId(id)) return out
  const w = out.widgets[id]
  w.bounds = normalizeBounds(rect, w.bounds, WIDGET_DEFS[id].minSize)
  syncActiveLayout(out)
  return out
}

function setSection<S extends OptionSection>(
  s: OverlaySettings,
  section: S,
  value: OverlaySettings[S]
): void {
  s[section] = value
}
