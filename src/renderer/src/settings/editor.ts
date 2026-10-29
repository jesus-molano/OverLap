/**
 * The settings window's writes: patches and commands to main, which validates, clamps, saves
 * and broadcasts them. Setters are memoised per field, so a control's `apply` prop keeps its
 * identity across renders.
 */
import { shallowRef } from 'vue'
import { setElementVisible } from '@shared/elements'
import type { SettingsCommand } from '@shared/ipc'
import { DEFAULT_SETTINGS } from '@shared/settings'
import type { ElementField, ElementIdOf, OptionSection } from '@shared/settingsSchema'
import type {
  AppearanceSettings,
  ElementEntry,
  OverlaySettings,
  SettingsPatch,
  ShowInSessions
} from '@shared/types'
import type { WidgetId } from '@shared/widgets'
import { overlayState, useOverlayState } from '../composables/useOverlay'

/**
 * The last update failed; cleared by the next one that succeeds. A flag, not a sentence: the
 * window words it in the current language (settings.app.updateError).
 */
export const updateFailed = shallowRef(false)

let seq = 0

/**
 * Sends a patch to main. Never rejects: a failure is shown in the window and the controls
 * fall back to the current settings. Only the reply to the latest request is applied, so an
 * older reply arriving late never overwrites newer settings.
 */
export async function updateSettings(patch: SettingsPatch): Promise<void> {
  useOverlayState()
  const mine = ++seq
  try {
    const next = await window.overlay.updateSettings(patch)
    // Main broadcasts the same object; the reply only wins while no newer request is out.
    if (mine === seq) overlayState.settings.value = next
    updateFailed.value = false
  } catch (err) {
    console.error('[settings] update failed', err)
    updateFailed.value = true
  }
}

export type Setter<V> = (value: V) => Promise<void>

/** One widget's patchable fields (everything but bounds). */
export type WidgetPatch = NonNullable<NonNullable<SettingsPatch['widgets']>[WidgetId]>
type WidgetField = Exclude<keyof WidgetPatch, 'showIn'>

type SectionPatches = { [S in OptionSection]?: Partial<OverlaySettings[S]> }

export function updateSection<S extends OptionSection>(
  section: S,
  fields: Partial<OverlaySettings[S]>
): Promise<void> {
  const patch: SectionPatches = {}
  patch[section] = fields
  return updateSettings(patch)
}

export function updateWidget(id: WidgetId, fields: WidgetPatch): Promise<void> {
  const widgets: NonNullable<SettingsPatch['widgets']> = {}
  widgets[id] = fields
  return updateSettings({ widgets })
}

const optionSetters = new Map<string, Setter<never>>()

/**
 * Memoised setter factory for one option section:
 * `optionSetter('battle')('holdS')(2)` patches `{ battle: { holdS: 2 } }`.
 */
export function optionSetter<S extends OptionSection>(
  section: S
): <F extends keyof OverlaySettings[S] & string>(field: F) => Setter<OverlaySettings[S][F]> {
  return <F extends keyof OverlaySettings[S] & string>(field: F) => {
    const key = `${section}.${field}`
    let set = optionSetters.get(key) as Setter<OverlaySettings[S][F]> | undefined
    if (set === undefined) {
      set = (value) => {
        const fields: Partial<OverlaySettings[S]> = {}
        fields[field] = value
        return updateSection(section, fields)
      }
      optionSetters.set(key, set)
    }
    return set
  }
}

/** A list sent and not answered yet, per 'section.field': the next change builds on it. */
const pendingLists = new Map<string, { readonly list: readonly ElementEntry[] }>()
const listSetters = new Map<string, Setter<never>>()

/** The list of `section.field` as last sent, or as the settings have it. */
export function currentList<S extends OptionSection, F extends ElementField<S>>(
  section: S,
  field: F
): readonly ElementEntry<ElementIdOf<S, F>>[] {
  const pending = pendingLists.get(`${section}.${field}`)
  if (pending !== undefined) return pending.list as readonly ElementEntry<ElementIdOf<S, F>>[]
  const options = overlayState.settings.value?.[section] ?? DEFAULT_SETTINGS[section]
  return options[field] as unknown as readonly ElementEntry<ElementIdOf<S, F>>[]
}

/**
 * Memoised setter of a whole element list (`listSetter('relative', 'columns')(next)`): main
 * normalises it (every id once, required ones shown). While its reply is out, `currentList`
 * and `elementToggle` build on what was sent, so quick changes never undo each other.
 */
export function listSetter<S extends OptionSection, F extends ElementField<S>>(
  section: S,
  field: F
): Setter<ElementEntry<ElementIdOf<S, F>>[]> {
  const key = `${section}.${field}`
  let set = listSetters.get(key) as Setter<ElementEntry<ElementIdOf<S, F>>[]> | undefined
  if (set === undefined) {
    set = async (list) => {
      const mine = { list }
      pendingLists.set(key, mine)
      const fields: Partial<OverlaySettings[S]> = {}
      ;(fields as Record<string, unknown>)[field] = list
      try {
        await updateSection(section, fields)
      } finally {
        if (pendingLists.get(key) === mine) pendingLists.delete(key)
      }
    }
    listSetters.set(key, set)
  }
  return set
}

const toggleSetters = new Map<string, Setter<never>>()

/**
 * Memoised setter that shows or hides one element of a list (a ToggleControl's `apply`):
 * `elementToggle('relative', 'columns', 'lic')(false)`.
 */
export function elementToggle<S extends OptionSection, F extends ElementField<S>>(
  section: S,
  field: F,
  id: ElementIdOf<S, F>
): Setter<boolean> {
  const key = `${section}.${field}.${id}`
  let set = toggleSetters.get(key) as Setter<boolean> | undefined
  if (set === undefined) {
    set = (visible) =>
      listSetter(section, field)(setElementVisible(currentList(section, field), id, visible))
    toggleSetters.set(key, set)
  }
  return set
}

const widgetSetters = new Map<string, Setter<never>>()

/** Memoised setter of one widget field: `widgetSetter('radar')('locked')(true)`. */
export function widgetSetter(
  id: WidgetId
): <F extends WidgetField>(field: F) => Setter<NonNullable<WidgetPatch[F]>> {
  return <F extends WidgetField>(field: F) => {
    const key = `${id}.${field}`
    let set = widgetSetters.get(key) as Setter<NonNullable<WidgetPatch[F]>> | undefined
    if (set === undefined) {
      set = (value) => {
        const fields: WidgetPatch = {}
        fields[field] = value
        return updateWidget(id, fields)
      }
      widgetSetters.set(key, set)
    }
    return set
  }
}

/** Memoised setter of one "Mostrar en" session kind. */
export function showInSetter(id: WidgetId, kind: keyof ShowInSessions): Setter<boolean> {
  const key = `${id}.showIn.${kind}`
  let set = widgetSetters.get(key) as Setter<boolean> | undefined
  if (set === undefined) {
    set = (on) => {
      const showIn: Partial<ShowInSessions> = {}
      showIn[kind] = on
      return updateWidget(id, { showIn })
    }
    widgetSetters.set(key, set)
  }
  return set
}

export function sendCommand(cmd: SettingsCommand): void {
  window.overlay.command(cmd)
}

/** The widget's options and look back to their defaults; position, visibility and lock stay. */
export function resetWidgetOptions(widgetId: WidgetId): void {
  sendCommand({ type: 'reset-widget-options', widgetId })
}

export function resetWidgetBounds(widgetId: WidgetId): void {
  sendCommand({ type: 'reset-widget-bounds', widgetId })
}

/**
 * The global appearance back to its defaults (a plain patch: no command needed). The language
 * is left out of the patch, so it stays: resetting the look must not switch the interface to
 * a language the user may not read.
 */
export function resetAppearance(): Promise<void> {
  const look: Partial<AppearanceSettings> = { ...DEFAULT_SETTINGS.appearance }
  delete look.language
  return updateSettings({ appearance: look })
}

/** Every shortcut back to its factory combination, all in one patch (so none collides). */
export function resetShortcuts(): Promise<void> {
  return updateSettings({ shortcuts: { ...DEFAULT_SETTINGS.shortcuts } })
}

/** Shows or hides every overlay window, like the tray checkbox. */
export function setOverlayHidden(hidden: boolean): void {
  sendCommand({ type: 'set-overlay-hidden', hidden })
}
