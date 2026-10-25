import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IPC,
  type AutoHiddenState,
  type ContentSizeMessage,
  type EditDragMessage,
  type EditScaleMessage,
  type InitialState,
  type OverlayApi,
  type SettingsCommand
} from '@shared/ipc'
import type { PersonalBestList } from '@shared/delta/references'
import type {
  OverlaySettings,
  OverlayStatus,
  SettingsPatch,
  WidgetDataMessage
} from '@shared/types'

// Sandboxed preload: only `electron` can be required at runtime, everything
// else (the IPC constants) is bundled in by electron-vite. Widget windows and
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
  onAutoHidden: (cb) => subscribe<AutoHiddenState>(IPC.autoHidden, cb),
  onPersonalBests: (cb) => subscribe<PersonalBestList>(IPC.personalBests, cb),
  editDrag: (msg: EditDragMessage) => ipcRenderer.send(IPC.editDrag, msg),
  contentSize: (msg: ContentSizeMessage) => ipcRenderer.send(IPC.contentSize, msg),
  editScale: (msg: EditScaleMessage) => ipcRenderer.send(IPC.editScale, msg),
  updateSettings: (patch: SettingsPatch) =>
    ipcRenderer.invoke(IPC.updateSettings, patch) as Promise<OverlaySettings>,
  command: (cmd: SettingsCommand) => ipcRenderer.send(IPC.command, cmd)
}

contextBridge.exposeInMainWorld('overlay', api)
