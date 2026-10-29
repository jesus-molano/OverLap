import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IPC,
  type AutoHiddenMessage,
  type BoundsCommit,
  type ControllerPress,
  type DragStateMessage,
  type EditChipsMessage,
  type InitialState,
  type LayoutNotice,
  type OpenWidgetPageMessage,
  type OsdMessage,
  type OverlayApi,
  type OverlayLayout,
  type ScaleStepMessage,
  type SettingsCommand,
  type SettingsWindowPage,
  type WidgetToggleMessage
} from '@shared/ipc'
import type { PersonalBestList } from '@shared/delta/references'
import type { WidgetId } from '@shared/widgets'
import type { ShortcutAction, ShortcutStatusReport } from '@shared/shortcuts'
import type {
  CarRef,
  OverlaySettings,
  OverlayStatus,
  SettingsPatch,
  WidgetDataMessage
} from '@shared/types'

// Sandboxed preload: only `electron` can be required at runtime, everything
// else (the IPC constants) is bundled in by electron-vite. Overlay windows and
// the settings window share it; main checks which window sent each request.

function subscribe<T>(channel: string, cb: (value: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, value: T): void => cb(value)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api: OverlayApi = {
  getInitialState: () => ipcRenderer.invoke(IPC.init) as Promise<InitialState>,
  onData: (cb) => subscribe<WidgetDataMessage>(IPC.data, cb),
  onStatus: (cb) => subscribe<OverlayStatus>(IPC.status, cb),
  onEditMode: (cb) => subscribe<boolean>(IPC.editMode, cb),
  onSettings: (cb) => subscribe<OverlaySettings>(IPC.settings, cb),
  onAutoHidden: (cb) => subscribe<AutoHiddenMessage>(IPC.autoHidden, cb),
  onLayout: (cb) => subscribe<OverlayLayout>(IPC.layout, cb),
  onPersonalBests: (cb) => subscribe<PersonalBestList>(IPC.personalBests, cb),
  onOverlayHidden: (cb) => subscribe<boolean>(IPC.overlayHidden, cb),
  onShortcutStatus: (cb) => subscribe<ShortcutStatusReport>(IPC.shortcutStatus, cb),
  onCursorHidden: (cb) => subscribe<boolean>(IPC.cursorHidden, cb),
  onCurrentCar: (cb) => subscribe<CarRef | null>(IPC.currentCar, cb),
  onLayoutNotice: (cb) => subscribe<LayoutNotice>(IPC.layoutNotice, cb),
  onSettingsPage: (cb) => subscribe<SettingsWindowPage>(IPC.settingsPage, cb),
  onSaveFailing: (cb) => subscribe<boolean>(IPC.saveFailing, cb),
  onControllerPress: (cb) => subscribe<ControllerPress>(IPC.controllerPress, cb),
  onShortcutUsed: (cb) => subscribe<ShortcutAction>(IPC.shortcutUsed, cb),
  onOsd: (cb) => subscribe<OsdMessage>(IPC.osd, cb),
  commitBounds: (msg: BoundsCommit) => ipcRenderer.send(IPC.commitBounds, msg),
  scaleStep: (msg: ScaleStepMessage) => ipcRenderer.send(IPC.scaleStep, msg),
  dragState: (msg: DragStateMessage) => ipcRenderer.send(IPC.dragState, msg),
  widgetToggle: (msg: WidgetToggleMessage) => ipcRenderer.send(IPC.widgetToggle, msg),
  openWidgetPage: (msg: OpenWidgetPageMessage) => ipcRenderer.send(IPC.openWidgetPage, msg),
  onEditFocus: (cb) => subscribe<WidgetId>(IPC.editFocus, cb),
  editChips: (msg: EditChipsMessage) => ipcRenderer.send(IPC.editChips, msg),
  updateSettings: (patch: SettingsPatch, forLayout?: string) =>
    ipcRenderer.invoke(IPC.updateSettings, patch, forLayout) as Promise<OverlaySettings>,
  command: (cmd: SettingsCommand) => ipcRenderer.send(IPC.command, cmd)
}

contextBridge.exposeInMainWorld('overlay', api)
