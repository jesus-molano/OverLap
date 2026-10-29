/**
 * The bigger changes of the settings window, each with the same "Deshacer" toast as hiding an
 * element (R11): one click does it, the toast puts it back. A reset of a widget's options, its
 * window or its position, of the appearance or the shortcuts, hiding a widget, deleting a layout.
 * Only what cannot be put back keeps the second click (the personal bests).
 *
 * The toast says what was done and, with two layouts or more (or a "Solo posición" one in use),
 * where (R24): 'Restablecido: opciones de Relativo · en «Principal»'. An undo goes to the layout
 * the change was made in, and goes away when another one is applied (it would change that one).
 */
import type { InjectionKey } from 'vue'
import { copyData } from '@shared/copy'
import { deepEqual } from '@shared/equal'
import { widgetTitle, type Messages } from '@shared/i18n'
import { DEFAULT_SETTINGS, type WidgetResetPart } from '@shared/settings'
import { shortcutBindings } from '@shared/shortcuts'
import type { OptionSection } from '@shared/settingsSchema'
import type { OverlaySettings, SettingsPatch } from '@shared/types'
import type { WidgetId } from '@shared/widgets'
import { overlayState } from '../../composables/useOverlay'
import { useI18n } from '../../composables/useI18n'
import {
  layoutInUse,
  resetAppearance as sendAppearanceReset,
  resetShortcuts as sendShortcutsReset,
  resetWidgetBounds,
  resetWidgetOptions,
  sendCommand,
  sendingFor,
  updateSection,
  updateSettings
} from '../editor'
import { optionsTarget, targetShown } from '../layoutsView'
import { undoSlot } from './undo'

/** The widget a page is about (WidgetPage provides it): its sections' resets (PageSection). */
export const WIDGET_PAGE: InjectionKey<WidgetId> = Symbol('widget-page')

/** The offers made here: one owner (none of them belongs to an editor that goes away). */
const OWNER = {}

function settingsNow(): OverlaySettings {
  return overlayState.settings.value ?? DEFAULT_SETTINGS
}

/** ' · en «Principal»', ' · en las opciones comunes', or '' with one layout (it says nothing). */
export function whereText(m: Messages, settings: OverlaySettings): string {
  const lib = settings.savedLayouts
  const target = optionsTarget(lib)
  if (!targetShown(lib.list.length, target.shared)) return ''
  const u = m.settings.elements.undo
  return target.shared ? u.inShared : u.inLayout(target.name)
}

/**
 * Offers to undo a change just made in the layout in use: `text` says it, `restore` puts it back
 * (sent as made in that layout). False when no toast shows it.
 */
export function offerRestore(text: (m: Messages) => string, restore: () => void): boolean {
  const t = useI18n()
  const layoutId = layoutInUse()
  return undoSlot.offer({
    owner: OWNER,
    kind: 'restore',
    text: () => text(t.value),
    alive: () => layoutInUse() === layoutId,
    restore: () => sendingFor(layoutId, restore)
  })
}

/** The window rows of a widget ("Ventana y visibilidad"), as they are now. */
function windowFields(id: WidgetId): NonNullable<SettingsPatch['widgets']>[WidgetId] {
  const { scale, autoHeight, anchor, backgroundOpacity, showIn, hideInPits, showOnSessionScreen } =
    settingsNow().widgets[id]
  return {
    scale,
    autoHeight,
    anchor,
    backgroundOpacity,
    showIn: { ...showIn },
    hideInPits,
    showOnSessionScreen
  }
}

/** A widget's options (`part`) back to their defaults, with "Deshacer". */
export function resetWidget(id: WidgetId, part: WidgetResetPart): void {
  const s = settingsNow()
  const where = whereText(useI18n().value, s)
  const patch: SettingsPatch = {}
  if (part !== 'window') {
    ;(patch as Record<string, unknown>)[id] = copyData(s[id])
  }
  if (part !== 'options') patch.widgets = { [id]: windowFields(id) }
  resetWidgetOptions(id, part)
  offerRestore(
    (m) => {
      const u = m.settings.elements.undo
      const name = widgetTitle(m, id)
      const what =
        part === 'options'
          ? u.whatOptions(name)
          : part === 'window'
            ? u.whatWindow(name)
            : u.whatAll(name)
      return u.reset(what, where)
    },
    () => void updateSettings(patch)
  )
}

/** Everything of a widget page (options, window, position and size), with one "Deshacer". */
export function resetWidgetAll(id: WidgetId): void {
  const s = settingsNow()
  const where = whereText(useI18n().value, s)
  const patch: SettingsPatch = { widgets: { [id]: windowFields(id) } }
  ;(patch as Record<string, unknown>)[id] = copyData(s[id])
  const bounds = { ...s.widgets[id].bounds }
  resetWidgetOptions(id, 'all')
  resetWidgetBounds(id)
  offerRestore(
    (m) =>
      m.settings.elements.undo.reset(m.settings.elements.undo.whatAll(widgetTitle(m, id)), where),
    () => {
      void updateSettings(patch)
      sendCommand({ type: 'set-widget-bounds', widgetId: id, bounds })
    }
  )
}

/** A widget back to its factory position and size, with "Deshacer". */
export function resetBounds(id: WidgetId): void {
  const s = settingsNow()
  const bounds = { ...s.widgets[id].bounds }
  const where = whereText(useI18n().value, s)
  resetWidgetBounds(id)
  offerRestore(
    (m) =>
      m.settings.elements.undo.reset(
        m.settings.elements.undo.whatBounds(widgetTitle(m, id)),
        where
      ),
    () => sendCommand({ type: 'set-widget-bounds', widgetId: id, bounds })
  )
}

/** The appearance back to its defaults (the language kept), with "Deshacer". */
export function resetAppearance(): void {
  const before: Partial<OverlaySettings['appearance']> = { ...settingsNow().appearance }
  delete before.language
  void sendAppearanceReset()
  offerRestore(
    (m) => m.settings.elements.undo.reset(m.settings.elements.undo.whatAppearance, ''),
    () => void updateSettings({ appearance: before })
  )
}

/** Every shortcut back to its factory combination alone (one patch), with "Deshacer". */
export function resetShortcuts(): void {
  const s = settingsNow()
  const before = shortcutBindings(s.shortcuts, s.shortcutsMore)
  void sendShortcutsReset()
  const restore: NonNullable<SettingsPatch['shortcutBindings']> = {}
  for (const [action, list] of Object.entries(before)) {
    restore[action as keyof typeof restore] = [...list]
  }
  offerRestore(
    (m) => m.settings.elements.undo.reset(m.settings.elements.undo.whatShortcuts, ''),
    () => void updateSettings({ shortcutBindings: restore })
  )
}

/** A widget shown or hidden (its page's switch, the sidebar's dot); hiding offers "Deshacer". */
export function setWidgetVisible(id: WidgetId, visible: boolean): Promise<void> {
  const sent = updateSettings({ widgets: { [id]: { visible } } })
  if (!visible) {
    offerRestore(
      (m) => m.settings.elements.undo.widgetHidden(widgetTitle(m, id)),
      () => void updateSettings({ widgets: { [id]: { visible: true } } })
    )
  }
  return sent
}

/** A layout deleted (one click), with "Deshacer": main keeps the last one deleted. */
export function deleteLayout(id: string, name: string): void {
  sendCommand({ type: 'layout-delete', id })
  offerRestore(
    (m) => m.settings.elements.undo.layoutDeleted(name),
    () => sendCommand({ type: 'layout-restore', id })
  )
}

/**
 * Before a zone's reset (ElementEditor's "Restablecer": its list, and what goes with it, an info
 * bar's size, the standings' gap mode): its option section as it is, and, once reset, the
 * "Deshacer" that puts back every field of it the reset changed.
 */
export function offerSectionRestore(section: OptionSection, zone: string): () => boolean {
  const where = whereText(useI18n().value, settingsNow())
  return offerSectionUndo(section, (m) => m.settings.elements.undo.reset(zone, where))
}

/**
 * Before a change to `section` (a reset, a bar copied into it): its fields as they are, and,
 * once changed, the "Deshacer" (worded by `text`) that puts back every field the change touched.
 */
export function offerSectionUndo(
  section: OptionSection,
  text: (m: Messages) => string
): () => boolean {
  const s = settingsNow()
  const before = copyData(s[section]) as unknown as Readonly<Record<string, unknown>>
  return () =>
    offerRestore(text, () => {
      const now = settingsNow()[section] as unknown as Readonly<Record<string, unknown>>
      const fields: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(before)) if (!deepEqual(v, now[k])) fields[k] = v
      if (Object.keys(fields).length > 0) {
        void updateSection(section, fields as Partial<OverlaySettings[typeof section]>)
      }
    })
}
