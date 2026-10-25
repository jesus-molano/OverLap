/**
 * Message contracts between the three kinds of process:
 *
 *   telemetry (utilityProcess) --TelemetryOutMessage--> main --IPC--> widget renderers
 *   telemetry <--TelemetryInMessage-- main <--IPC-- widget renderers (edit mode only)
 *
 * The personal bests live in the telemetry process (it owns the file): the
 * settings window asks main, main asks the telemetry process, and the updated
 * list comes back the same way.
 */
import type { PersonalBestList } from './delta/references'
import type {
  HiddenReason,
  OverlaySettings,
  OverlayStatus,
  SettingsPatch,
  TelemetryConfig,
  WidgetDataMessage
} from './types'
import type { WidgetId } from './widgets'

// ---------------------------------------------------------------------------
// Telemetry process <-> main (utilityProcess parentPort messages)
// ---------------------------------------------------------------------------

export type TelemetryOutMessage =
  | { type: 'status'; status: OverlayStatus }
  | ({ type: 'data' } & WidgetDataMessage)
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string }
  /**
   * A "Mostrar en" / "Ocultar en boxes" rule hid or showed a widget. Sent on
   * change only; while hidden its provider is not run. Main hides the window
   * (no paint at all) except in edit mode, where it previews with `reason`
   * (null when shown).
   */
  | { type: 'auto-hidden'; widget: WidgetId; hidden: boolean; reason: HiddenReason | null }
  /**
   * The stored personal bests and the car + layout being driven: once at
   * start, then whenever either changes (a new best, a deletion, another
   * session). Main keeps the latest for the settings window.
   */
  | { type: 'bests'; list: PersonalBestList }

export type TelemetryInMessage =
  | { type: 'config'; config: TelemetryConfig }
  | { type: 'shutdown' }
  /** From the settings window: delete these personal bests. */
  | { type: 'delete-bests'; keys: string[] }
  /** From the settings window: delete every personal best. */
  | { type: 'clear-bests' }

// ---------------------------------------------------------------------------
// Main <-> renderer (ipcMain / ipcRenderer channels)
// ---------------------------------------------------------------------------

export const IPC = {
  /** main -> renderer, `WidgetDataMessage`. Each window only gets its own widget. */
  data: 'overlay:data',
  /** main -> renderer, `OverlayStatus`. */
  status: 'overlay:status',
  /** main -> renderer, `boolean`. */
  editMode: 'overlay:edit-mode',
  /** renderer -> main (invoke), returns `InitialState`. */
  init: 'overlay:init',
  /** renderer -> main (send), `EditDragMessage`. */
  editDrag: 'overlay:edit-drag',
  /** main -> every renderer, `OverlaySettings`, whenever they change. */
  settings: 'overlay:settings',
  /** settings window -> main (invoke), `SettingsPatch`; returns the applied `OverlaySettings`. */
  updateSettings: 'overlay:update-settings',
  /** settings window -> main (send), `SettingsCommand`. */
  command: 'overlay:command',
  /** widget renderer -> main (send), `ContentSizeMessage`: auto-height widgets report their desired height. */
  contentSize: 'overlay:content-size',
  /** widget renderer -> main (send), `EditScaleMessage`: mouse wheel in edit mode. */
  editScale: 'overlay:edit-scale',
  /** main -> widget renderer, `AutoHiddenState`: a visibility rule currently hides this widget. */
  autoHidden: 'overlay:auto-hidden',
  /** main -> settings window, `PersonalBestList`: on 'refresh-personal-bests' and on every change. */
  personalBests: 'overlay:personal-bests'
} as const

/** Desired (untrimmed) content height in DIP; sent only when it changes. */
export interface ContentSizeMessage {
  height: number
}

/** One wheel notch in edit mode: auto-height widgets change scale ±5 %, free widgets resize ±5 %. */
export interface EditScaleMessage {
  step: 1 | -1
}

export interface AutoHiddenState {
  hidden: boolean
  /** Why (null when shown); the edit-mode preview words it (hiddenText in @shared/i18n). */
  reason: HiddenReason | null
}

/** Which page a renderer shows: `?widget=<id>` or `?view=settings`. */
export type RendererView = { kind: 'widget'; widgetId: WidgetId } | { kind: 'settings' }

/** One-shot actions from the settings window. */
export type SettingsCommand =
  | { type: 'set-edit-mode'; on: boolean }
  | { type: 'reset-widget-bounds'; widgetId: WidgetId }
  | { type: 'open-settings-folder' }
  | { type: 'reset-widget-options'; widgetId: WidgetId }
  /** Send me the personal bests (main answers on IPC.personalBests). */
  | { type: 'refresh-personal-bests' }
  | { type: 'delete-personal-bests'; keys: string[] }
  | { type: 'clear-personal-bests' }

export interface InitialState {
  view: RendererView
  editMode: boolean
  status: OverlayStatus
  settings: OverlaySettings
}

/** Edge or corner being dragged when resizing. */
export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

/**
 * Manual move/resize in edit mode, at most one `move` per frame. Main reads
 * the cursor itself (getCursorScreenPoint, DIP) and applies its displacement
 * since `start` to the bounds captured then, so it never drifts across
 * displays with different scale factors. `dx`/`dy` (the pointer displacement
 * the renderer saw) are informative only.
 */
export interface EditDragMessage {
  phase: 'start' | 'move' | 'end'
  mode: 'move' | ResizeHandle
  dx: number
  dy: number
  /** Alt held: no edge snapping. */
  noSnap?: boolean
}

export type Unsubscribe = () => void

/** API exposed by the preload on `window.overlay`. */
export interface OverlayApi {
  getInitialState(): Promise<InitialState>
  onData(cb: (msg: WidgetDataMessage) => void): Unsubscribe
  onStatus(cb: (status: OverlayStatus) => void): Unsubscribe
  onEditMode(cb: (editing: boolean) => void): Unsubscribe
  onSettings(cb: (settings: OverlaySettings) => void): Unsubscribe
  onAutoHidden(cb: (state: AutoHiddenState) => void): Unsubscribe
  /** Settings window only. */
  onPersonalBests(cb: (list: PersonalBestList) => void): Unsubscribe
  editDrag(msg: EditDragMessage): void
  contentSize(msg: ContentSizeMessage): void
  editScale(msg: EditScaleMessage): void
  /** Settings window only (main rejects it from widget windows). */
  updateSettings(patch: SettingsPatch): Promise<OverlaySettings>
  /** Settings window only. */
  command(cmd: SettingsCommand): void
}
