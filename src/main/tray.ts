import {
  Menu,
  Tray,
  nativeImage,
  type MenuItemConstructorOptions,
  type NativeImage
} from 'electron'
import {
  LOCALES,
  hiddenText,
  messagesFor,
  statusText,
  widgetTitle,
  type Language
} from '@shared/i18n'
import { RADAR_RANGE_PRESETS_M } from '@shared/settings'
import type { HiddenReason, OverlaySettings, OverlayStatus } from '@shared/types'
import { WIDGET_IDS, type WidgetId } from '@shared/widgets'
import trayIconPath from '../../resources/icon.png?asset'

// Note: clicking the tray icon moves focus to the Windows shell (that is how
// the notification area works), so while driving use the global shortcut
// Ctrl+Shift+E instead of the menu.

export const EDIT_MODE_ACCELERATOR = 'CommandOrControl+Shift+E'
/** Windows truncates tray tooltips at 127 characters. */
const TOOLTIP_MAX = 127

export interface TrayState {
  status: OverlayStatus
  settings: OverlaySettings
  editMode: boolean
  /** Why each widget a visibility rule hides right now is hidden (null: no known reason). */
  autoHidden: Partial<Record<WidgetId, HiddenReason | null>>
}

export interface TrayActions {
  openSettings(): void
  setWidgetVisible(id: WidgetId, visible: boolean): void
  setRadarRange(rangeM: number): void
  setEditMode(on: boolean): void
  openSettingsFolder(): void
  quit(): void
}

// Module-level so the Tray is never garbage collected (the icon would vanish).
let tray: Tray | null = null
let actions: TrayActions | null = null
let lastKey = ''

export function createTray(state: TrayState, trayActions: TrayActions): void {
  if (tray) return
  actions = trayActions
  tray = new Tray(loadIcon())
  // Left click opens the same menu as right click.
  tray.on('click', () => tray?.popUpContextMenu())
  updateTray(state)
}

/**
 * Rebuilds the tooltip and menu from the current state, in the interface
 * language (skipped when nothing changed: switching language rebuilds them).
 */
export function updateTray(state: TrayState): void {
  if (!tray || tray.isDestroyed() || !actions) return
  const lang = state.settings.appearance.language
  const status = statusText(messagesFor(lang), state.status)
  const key = JSON.stringify([
    lang,
    status,
    state.editMode,
    state.settings.radar.rangeM,
    // '' shown, '-' hidden for no known reason (JSON would turn both undefined and null into null).
    WIDGET_IDS.map((id) => [state.settings.widgets[id].visible, hiddenKey(state.autoHidden[id])])
  ])
  if (key === lastKey) return
  lastKey = key
  tray.setToolTip(messagesFor(lang).core.tray.tooltip(status).slice(0, TOOLTIP_MAX))
  tray.setContextMenu(Menu.buildFromTemplate(buildMenu(state, status, actions)))
}

function hiddenKey(hidden: HiddenReason | null | undefined): string {
  return hidden === undefined ? '' : (hidden ?? '-')
}

export function destroyTray(): void {
  if (tray && !tray.isDestroyed()) tray.destroy()
  tray = null
  actions = null
  lastKey = ''
}

function buildMenu(
  state: TrayState,
  status: string,
  act: TrayActions
): MenuItemConstructorOptions[] {
  const { settings } = state
  const lang = settings.appearance.language
  const t = messagesFor(lang).core.tray
  const rangeM = settings.radar.rangeM
  const ranges: number[] = [...RADAR_RANGE_PRESETS_M]
  // A value edited by hand in settings.json still shows up as the checked choice.
  if (!ranges.includes(rangeM)) ranges.push(rangeM)
  ranges.sort((a, b) => a - b)

  return [
    { label: status, enabled: false },
    { type: 'separator' },
    { label: t.settings, click: () => act.openSettings() },
    { type: 'separator' },
    // The checkbox is what the user enabled; a rule hiding the widget right now only adds a note.
    ...WIDGET_IDS.map((id): MenuItemConstructorOptions => ({
      label: widgetLabel(lang, id, settings.widgets[id].visible ? state.autoHidden[id] : undefined),
      type: 'checkbox',
      checked: settings.widgets[id].visible,
      click: (item) => act.setWidgetVisible(id, item.checked)
    })),
    {
      label: t.radarRange,
      submenu: ranges.map((m): MenuItemConstructorOptions => ({
        label: t.rangeMeters(m),
        type: 'radio',
        checked: m === rangeM,
        click: () => act.setRadarRange(m)
      }))
    },
    { type: 'separator' },
    {
      label: t.editMode,
      type: 'checkbox',
      checked: state.editMode,
      // Only the label: the real shortcut is a globalShortcut registered by main.
      accelerator: EDIT_MODE_ACCELERATOR,
      registerAccelerator: false,
      click: (item) => act.setEditMode(item.checked)
    },
    { label: t.openSettingsFolder, click: () => act.openSettingsFolder() },
    { type: 'separator' },
    { label: t.quit, click: () => act.quit() }
  ]
}

/**
 * 'Batalla', or 'Batalla (oculto en práctica)' while a rule hides it
 * (`hidden`: undefined when shown, null when hidden for no known reason).
 */
export function widgetLabel(
  lang: Language,
  id: WidgetId,
  hidden: HiddenReason | null | undefined
): string {
  const m = messagesFor(lang)
  const title = widgetTitle(m, id)
  if (hidden === undefined) return title
  const caption = hiddenText(m, hidden)
  const note = caption.charAt(0).toLocaleLowerCase(LOCALES[lang]) + caption.slice(1)
  return m.core.tray.widgetHidden(title, note)
}

function loadIcon(): NativeImage {
  const source = nativeImage.createFromPath(trayIconPath)
  if (source.isEmpty()) {
    console.warn(`[tray] icon not found at ${trayIconPath}`)
    return source
  }
  const icon = source.resize({ width: 16, height: 16, quality: 'best' })
  // Sharper icon on scaled displays.
  for (const scaleFactor of [1.5, 2]) {
    const size = Math.round(16 * scaleFactor)
    icon.addRepresentation({
      scaleFactor,
      width: size,
      height: size,
      buffer: source.resize({ width: size, height: size, quality: 'best' }).toPNG()
    })
  }
  return icon
}
