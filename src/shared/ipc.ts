/**
 * Message contracts between the kinds of process:
 *
 *   telemetry (utilityProcess) --TelemetryOutMessage--> main --IPC--> overlay windows
 *   telemetry <--TelemetryInMessage-- main <--IPC-- settings window
 *   input (utilityProcess, only while a shortcut is a button) --InputOutMessage--> main
 *
 * One overlay window per display hosts every enabled widget placed on that display, each as
 * an absolutely positioned panel of one document. Main owns where every widget is (screen
 * DIP, saved in settings), which window hosts it and when a window takes the mouse, and sends
 * each window an `OverlayLayout` in window-local CSS px (= DIP: zoom is pinned to 1). The
 * renderer draws the panels, fits the auto-height ones to their content and runs the
 * edit-mode interactions; what they change comes back as `BoundsCommit`s.
 *
 * The personal bests live in the telemetry process (it owns the file): the
 * settings window asks main, main asks the telemetry process, and the updated
 * list comes back the same way.
 */
import type { ControllerInfo } from './controllers'
import type { PersonalBestList } from './delta/references'
import type { SessionKind } from './sessionInfo'
import type { ShortcutAction, ShortcutStatusReport } from './shortcuts'
import type { LayoutFileError } from './layouts'
import type {
  CarRef,
  HiddenReason,
  LayoutMode,
  OverlaySettings,
  OverlayStatus,
  Point,
  Rect,
  SettingsPatch,
  Size,
  TelemetryConfig,
  WidgetDataMessage
} from './types'
import type { WidgetResetPart } from './settings/patch'
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
   * change only; while hidden its provider is not run. Its panel is not drawn
   * at all, except in edit mode, where it previews with `reason` (null when
   * shown).
   */
  | { type: 'auto-hidden'; widget: WidgetId; hidden: boolean; reason: HiddenReason | null }
  /**
   * The stored personal bests and the car + layout being driven: once at
   * start, then whenever either changes (a new best, a deletion, another
   * session). Main keeps the latest for the settings window.
   */
  | { type: 'bests'; list: PersonalBestList }
  /**
   * The kind of session being driven or watched (sessionKind), on change: main sends the
   * delta's cycle shortcut only while there is one. Null when unknown (no session).
   */
  | { type: 'session-kind'; kind: SessionKind | null }
  /**
   * The car model you are registered in (DriverInfo CarID and CarScreenName of your own car,
   * live frames only), on change: the automatic layout and the settings window's car links.
   * Null without a session or a known car.
   */
  | { type: 'player-car'; car: CarRef | null }

export type TelemetryInMessage =
  | { type: 'config'; config: TelemetryConfig }
  | { type: 'shutdown' }
  /** From the settings window: delete these personal bests. */
  | { type: 'delete-bests'; keys: string[] }
  /** From the settings window: delete every personal best. */
  | { type: 'clear-bests' }
  /**
   * The delta's cycle shortcut: the next reference for the current session only. The settings
   * are never changed by it (the DeltaProvider keeps it).
   */
  | { type: 'cycle-delta-reference' }

// ---------------------------------------------------------------------------
// Input process <-> main (utilityProcess parentPort messages)
// ---------------------------------------------------------------------------

/**
 * The input process (src/input) reads the game controllers' buttons, passively, while some
 * shortcut is a button or the shortcuts page records one (main/inputHost.ts).
 */
export type InputOutMessage =
  /** The controllers connected now: once at start, then on every arrival or removal. */
  | { type: 'devices'; list: ControllerInfo[] }
  /**
   * A button went down (once per press: holding it sends nothing more). `first`: in the
   * controller's first report since it arrived, so it may be resting down rather than pressed.
   */
  | { type: 'press'; device: string; button: number; first: boolean }
  /** Controllers cannot be read at all (not Windows, no Raw Input): `detail` says why. */
  | { type: 'unavailable'; detail: string }
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string }

export type InputInMessage = { type: 'shutdown' }

// ---------------------------------------------------------------------------
// Main <-> renderer (ipcMain / ipcRenderer channels)
// ---------------------------------------------------------------------------

export const IPC = {
  /** main -> overlay window, `WidgetDataMessage`: only for the widgets that window hosts. */
  data: 'overlay:data',
  /** main -> every renderer, `OverlayStatus`. */
  status: 'overlay:status',
  /** main -> every renderer, `boolean`. */
  editMode: 'overlay:edit-mode',
  /** renderer -> main (invoke), returns `InitialState`. */
  init: 'overlay:init',
  /** main -> every renderer, `OverlaySettings`, whenever they change. */
  settings: 'overlay:settings',
  /** settings window -> main (invoke), `SettingsPatch`; returns the applied `OverlaySettings`. */
  updateSettings: 'overlay:update-settings',
  /** settings window -> main (send), `SettingsCommand`. */
  command: 'overlay:command',
  /** main -> every overlay window, `AutoHiddenMessage`: a visibility rule hid or showed a widget. */
  autoHidden: 'overlay:auto-hidden',
  /** main -> settings window, `PersonalBestList`: on 'refresh-personal-bests' and on every change. */
  personalBests: 'overlay:personal-bests',
  /** main -> overlay window, `OverlayLayout`: what it hosts and where, whenever that changes. */
  layout: 'overlay:layout',
  /** overlay window -> main (send), `BoundsCommit`. */
  commitBounds: 'overlay:commit-bounds',
  /** overlay window -> main (send), `ScaleStepMessage`: wheel over an auto-height widget, edit mode. */
  scaleStep: 'overlay:scale-step',
  /** overlay window -> main (send), `DragStateMessage`: edit mode only. */
  dragState: 'overlay:drag-state',
  /** main -> settings window, `boolean`: the user hid every overlay window (tray, shortcut). */
  overlayHidden: 'overlay:overlay-hidden',
  /** main -> settings window, `ShortcutStatusReport`: whenever a binding's registration changes. */
  shortcutStatus: 'overlay:shortcut-status',
  /** overlay window -> main (send), `WidgetToggleMessage`: an edit chip's eye or padlock. */
  widgetToggle: 'overlay:widget-toggle',
  /** overlay window -> main (send), `EditChipsMessage`: where its edit chips are (edit mode). */
  editChips: 'overlay:edit-chips',
  /**
   * main -> every overlay window, `boolean`: while editing, the game hides the mouse cursor (a
   * driver in the car), so nothing can be dragged until another window frees it.
   */
  cursorHidden: 'overlay:cursor-hidden',
  /** main -> settings window, `CarRef | null`: the car you are in now (layout links). */
  currentCar: 'overlay:current-car',
  /** main -> settings window, `LayoutNotice`: how an export or an import went. */
  layoutNotice: 'overlay:layout-notice',
  /** main -> settings window, `SettingsWindowPage`: show this page (the tray's "Más…"). */
  settingsPage: 'overlay:settings-page',
  /** main -> settings window: the settings stopped (true) or started again (false) saving. */
  saveFailing: 'overlay:save-failing',
  /**
   * main -> settings window, `ControllerPress`: a controller's button went down while the
   * shortcuts page records a binding (no action runs then).
   */
  controllerPress: 'overlay:controller-press',
  /** main -> settings window, `UsedShortcut`: a shortcut ran (its row says so, R37). */
  shortcutUsed: 'overlay:shortcut-used',
  /** main -> the confirmation window over the game, `OsdMessage` (R37). */
  osd: 'overlay:osd',
  /**
   * main -> every overlay window, `WidgetId`: edit mode was entered from that widget's page
   * («Editar posición», R25); its panel is pointed out for a moment.
   */
  editFocus: 'overlay:edit-focus',
  /** overlay window -> main (send), `OpenWidgetPageMessage`: an edit chip's ⚙ (R25). */
  openWidgetPage: 'overlay:open-widget-page'
} as const

/**
 * `IPC.openWidgetPage`, edit mode only: the ⚙ of a widget's edit chip, from the window hosting
 * it. Main opens the settings window on that widget's page.
 */
export interface OpenWidgetPageMessage {
  session: number
  widget: WidgetId
}

/** A shortcut that ran: a configured action, or Esc leaving edit mode (its fixed row). */
export type UsedShortcut = ShortcutAction | 'exitEdit'

/** What the confirmation over the game says: a line, and a smaller one under it. */
export interface OsdMessage {
  text: string
  detail: string
}

/**
 * A button pressed while recording: its binding (controllers.ts) and its controller's name.
 * `first`: from the controller's first report since it arrived (InputOutMessage 'press'): it
 * may be a button resting down, so the page asks for the press again instead of saving it.
 */
export interface ControllerPress {
  binding: string
  name: string
  first: boolean
}

/**
 * A page main opens the settings window on: sent on IPC.settingsPage to an open window, or as
 * `?page=` in the URL of a new one (the renderer checks it like any page id).
 */
export type SettingsWindowPage = 'layouts' | 'shortcuts' | WidgetId

/** What became of a layout export or import (the settings window words it). */
export type LayoutFileNotice =
  | { kind: 'exported'; name: string }
  | { kind: 'export-failed'; name: string }
  | { kind: 'imported'; name: string }
  | { kind: 'import-failed'; error: LayoutFileError | 'read' | 'full' }

/**
 * What a layout command did, for the settings window to say: an export or an import (the layouts
 * page), or a widget's options copied to every layout (its page): 'unchanged' when they all had
 * them, 'stale' when the layout in use changed after the button was armed (nothing copied).
 */
export type LayoutNotice =
  | LayoutFileNotice
  | { kind: 'options-copied'; widgetId: WidgetId; result: 'copied' | 'unchanged' | 'stale' }
  /**
   * «Traer todos los widgets a esta pantalla» (R51): how many moved (0: all were there), to
   * which screen (the settings window's, or the cursor's from the tray), and the id that undoes
   * it (`undo-notice`; null: nothing to undo).
   */
  | { kind: 'gathered'; count: number; to: 'window' | 'cursor'; undo: number | null }
  /** Linking `carName` turned «Según el coche» on (R26); `undo` as above. */
  | { kind: 'auto-switch-on'; carName: string; undo: number | null }

export interface AutoHiddenState {
  hidden: boolean
  /** Why (null when shown); the edit-mode preview words it (hiddenText in @shared/i18n). */
  reason: HiddenReason | null
}

/** `IPC.autoHidden`: one widget's state (every overlay window gets every widget's). */
export interface AutoHiddenMessage extends AutoHiddenState {
  widget: WidgetId
}

/** Widgets a visibility rule hides right now (absent: shown). */
export type AutoHiddenMap = Partial<Record<WidgetId, AutoHiddenState>>

/**
 * The display an overlay window covers, in that window's coordinates: window-local CSS px,
 * which are DIP (zoom is pinned to 1).
 */
export interface OverlayDisplay {
  /** Electron `Display.id` (diagnostics only: windows are reassigned when ids change). */
  id: number
  /** 1-based number of the display (primary first, then left to right, top to bottom). */
  index: number
  /**
   * The whole display, window-local. Drags are confined to it and a pointer outside it means
   * "drop on another display". Do not assume it starts at 0,0.
   */
  bounds: Rect
  /** Its work area (without the taskbar), window-local. Auto height never grows past it. */
  workArea: Rect
  /** Its scale factor (the window's devicePixelRatio), for device-pixel snapping. */
  scaleFactor: number
}

/** One hosted widget. */
export interface OverlayPanel {
  widget: WidgetId
  /**
   * Where main places it, window-local integers. Auto-height widgets (option on) take x, width
   * and their anchored edge from it; the renderer fits their height to the content.
   */
  rect: Rect
  /**
   * Bumped by main whenever it moves this panel on its own (reset, re-placement after a display
   * change, arrival from another display, window reassignment), never for this window's own
   * commits or fits. A change cancels the interaction in progress on this panel.
   */
  placement: number
  /**
   * Disabled by the user (widgets[id].visible false), hosted only in edit mode: the window draws
   * a ghost (outline, name and the chip's eye to show it again), never the widget, and it gets
   * no data. Absent for an enabled widget.
   */
  ghost?: true
}

/** `IPC.layout`: everything an overlay window hosts. Sent whole, whenever any of it changes. */
export interface OverlayLayout {
  /** Grows with every layout main sends (to any window): keep the highest one seen. */
  revision: number
  /**
   * This document's load number: main bumps it on every (re)load of the window and ignores any
   * message from this window that does not echo it.
   */
  session: number
  /** Last `BoundsCommit.seq` main processed from this document (0: none yet). */
  ackSeq: number
  display: OverlayDisplay
  /**
   * Enabled widgets placed on this display (in edit mode the disabled ones too, as ghosts),
   * PAINT_ORDER (later ones on top).
   */
  panels: OverlayPanel[]
  /**
   * Sent by a layout applied: the settings with its options are broadcast right after. The
   * window holds this layout until they arrive (briefly), so no frame shows the new places with
   * the old options.
   */
  settingsFollow?: true
}

/**
 * `IPC.commitBounds`: a panel changed in this window. `session` is `OverlayLayout.session`;
 * `seq` starts at 1 in every document and grows by one per message; main echoes the last one it
 * processed in `OverlayLayout.ackSeq` (rejected commits too, so the renderer stops drawing them).
 * Rects are window-local.
 *
 * - 'drag': a move or resize ended (edit mode); `rect` is what was drawn, computed against the
 *   layout `revision`. Saved at once. Rejected when the display geometry changed since.
 * - 'wheel': a wheel notch resized a free widget (edit mode). Saved 1 s after the last one.
 * - 'fit': the drawn height of an auto-height widget changed. Only the height is saved (a
 *   bottom anchor keeps the saved bottom edge), 1 s after the last change.
 * - 'drop-outside': a move ended with the pointer outside this window's display (edit mode).
 *   Main reads the cursor and places the widget, `size` as drawn, with its top-left `grab` px
 *   up and left of the cursor, on the display under it, clamped into that display. Saved at
 *   once; the widget may move to another window.
 */
export type BoundsCommit =
  | {
      session: number
      seq: number
      widget: WidgetId
      kind: 'drag' | 'wheel'
      revision: number
      rect: Rect
    }
  | { session: number; seq: number; widget: WidgetId; kind: 'fit'; height: number }
  | {
      session: number
      seq: number
      widget: WidgetId
      kind: 'drop-outside'
      grab: Point
      size: Size
    }

/** `IPC.scaleStep`: one wheel notch over an auto-height widget in edit mode (scale ±5 %). */
export interface ScaleStepMessage {
  session: number
  widget: WidgetId
  step: 1 | -1
}

/**
 * `IPC.dragState`, edit mode only: a drag is in progress in this window, so main keeps the
 * mouse on it (setIgnoreMouseEvents(false)) even when the cursor leaves the panel. Sent on
 * every change and, while `dragging`, again every DRAG_HEARTBEAT_MS. Otherwise main decides
 * alone: it takes the mouse only while the cursor is over an unlocked panel.
 */
export interface DragStateMessage {
  session: number
  dragging: boolean
}

/**
 * `IPC.widgetToggle`, edit mode only: the eye (`visible`) or the padlock (`locked`) of a widget's
 * edit chip, from the window hosting it. Main applies it like the tray and the settings window
 * (widgets[id].visible / .locked), so all three stay in sync.
 */
export interface WidgetToggleMessage {
  session: number
  widget: WidgetId
  field: 'visible' | 'locked'
  value: boolean
}

/** One panel's edit chip: `rect` relative to the panel's top-left corner, px. */
export interface EditChip {
  widget: WidgetId
  rect: Rect
}

/**
 * `IPC.editChips`, edit mode only: where the edit chips of this window's panels are, the whole
 * list, sent whenever one moves or changes size. Main takes the mouse over a chip even when its
 * panel is locked or a ghost (the chip's buttons must take clicks), clipped to the panel.
 */
export interface EditChipsMessage {
  session: number
  chips: EditChip[]
}

/** While dragging, an overlay window repeats its DragStateMessage this often. */
export const DRAG_HEARTBEAT_MS = 500
/** Main stops holding the mouse for a drag when that repeat is this late (hung renderer). */
export const DRAG_LEASE_MS = 1_500

/** While it records a combination, the shortcuts page repeats its 'capture-shortcuts' this often. */
export const SHORTCUT_CAPTURE_RENEW_MS = 10_000
/** Main resumes its shortcuts by itself when that repeat is this late (a page that went away). */
export const SHORTCUT_CAPTURE_LEASE_MS = 30_000

/** Which page a renderer shows: `?view=overlay` or `?view=settings`. */
export type RendererView = { kind: 'overlay' } | { kind: 'settings' }

/** One-shot actions from the settings window. */
export type SettingsCommand =
  /** `focus`: entered from that widget's page («Editar posición»): its panel is pointed out. */
  | { type: 'set-edit-mode'; on: boolean; focus?: WidgetId }
  | { type: 'reset-widget-bounds'; widgetId: WidgetId }
  | { type: 'open-settings-folder' }
  /** overlap.log in the system's viewer (R35). */
  | { type: 'open-log' }
  /** What support needs (versions, status, displays, shortcuts...) on the clipboard (R35). */
  | { type: 'copy-diagnostics' }
  /**
   * Every widget on another display (or one unplugged) to the display of the settings window
   * (R51); main answers on IPC.layoutNotice ('gathered').
   */
  | { type: 'gather-widgets' }
  /** «Deshacer» of a notice that carries an `undo` id (R26, R51): main keeps what it undoes. */
  | { type: 'undo-notice'; id: number }
  /** `part`: what of it (WidgetResetPart: 'all' when absent). */
  | { type: 'reset-widget-options'; widgetId: WidgetId; part?: WidgetResetPart }
  /** The widget's bounds set to `bounds` (a reset undone, a free widget's «Escala»). */
  | { type: 'set-widget-bounds'; widgetId: WidgetId; bounds: Rect }
  /** Send me the personal bests (main answers on IPC.personalBests). */
  | { type: 'refresh-personal-bests' }
  | { type: 'delete-personal-bests'; keys: string[] }
  | { type: 'clear-personal-bests' }
  /** Hide or show every overlay window (like the tray checkbox and the shortcut). */
  | { type: 'set-overlay-hidden'; hidden: boolean }
  /**
   * The shortcuts page records a combination: main suspends its global shortcuts so the keys
   * reach the page. `on: true` starts or renews it (every SHORTCUT_CAPTURE_RENEW_MS); main
   * resumes on `on: false`, SHORTCUT_CAPTURE_LEASE_MS after the last renewal, and whenever the
   * settings window loses focus, hides, closes, reloads or crashes.
   */
  | { type: 'capture-shortcuts'; on: boolean }
  /**
   * The saved layouts (layouts.ts). 'layout-save' adds one equal to the widgets now and makes it
   * the one in use; 'layout-duplicate' copies one (not applied); names are made unique by main.
   * 'layout-export' and 'layout-import' open a file dialog; main answers on IPC.layoutNotice.
   * 'layout-link-car' links a car model to a layout (`layoutId` null: unlinks it).
   * 'layout-move' with `aroundActive` moves past the one in use, which the page pins apart.
   * 'layout-save' and 'layout-import' say what the new one restores (`mode`, 'full' when
   * absent); 'layout-set-mode' changes it for one; 'layout-options-to-all' copies a widget's
   * options in effect into every 'full' layout and the shared options, only while `layoutId` (the
   * one in use when the button was armed) still is.
   */
  /** `car`: linked to the new layout at once («Vincular a …», R26), which turns «Según el coche» on. */
  | { type: 'layout-save'; name: string; mode?: LayoutMode; car?: CarRef }
  | { type: 'layout-apply'; id: string }
  | { type: 'layout-duplicate'; id: string; name: string }
  | { type: 'layout-rename'; id: string; name: string }
  | { type: 'layout-delete'; id: string }
  /** The layout deleted last, back ("Deshacer"): only while it is the last one deleted. */
  | { type: 'layout-restore'; id: string }
  | { type: 'layout-move'; id: string; step: -1 | 1; aroundActive?: boolean }
  | { type: 'layout-export'; id: string }
  | { type: 'layout-import'; mode?: LayoutMode }
  | { type: 'layout-set-mode'; id: string; mode: LayoutMode }
  | { type: 'layout-options-to-all'; widgetId: WidgetId; layoutId: string }
  | { type: 'layout-link-car'; car: CarRef; layoutId: string | null }

export interface InitialState {
  view: RendererView
  editMode: boolean
  status: OverlayStatus
  settings: OverlaySettings
  /** Overlay windows: what this window hosts (null for the settings window). */
  layout: OverlayLayout | null
  /** Every widget a visibility rule hides right now (the settings window says it too). */
  autoHidden: AutoHiddenMap
  /** The user hid every overlay window (not saved: the app always starts shown). */
  overlayHidden: boolean
  /** How each configured shortcut is doing (registered, off, taken by another app). */
  shortcutStatus: ShortcutStatusReport
  /** Edit mode with the mouse cursor hidden by the game (see `IPC.cursorHidden`). */
  cursorHidden: boolean
  /** The car you are in now (see `IPC.currentCar`). */
  currentCar: CarRef | null
  /** Settings window: changes are not reaching the disk (see `IPC.saveFailing`). */
  saveFailing?: boolean
}

export type Unsubscribe = () => void

/** API exposed by the preload on `window.overlay`. */
export interface OverlayApi {
  getInitialState(): Promise<InitialState>
  onData(cb: (msg: WidgetDataMessage) => void): Unsubscribe
  onStatus(cb: (status: OverlayStatus) => void): Unsubscribe
  onEditMode(cb: (editing: boolean) => void): Unsubscribe
  onSettings(cb: (settings: OverlaySettings) => void): Unsubscribe
  /** Overlay windows: one widget's visibility-rule state (every widget's, hosted or not). */
  onAutoHidden(cb: (msg: AutoHiddenMessage) => void): Unsubscribe
  /** Overlay windows: what this window hosts and where. */
  onLayout(cb: (layout: OverlayLayout) => void): Unsubscribe
  /** Settings window only. */
  onPersonalBests(cb: (list: PersonalBestList) => void): Unsubscribe
  /** Settings window only: the user hid or showed every overlay window. */
  onOverlayHidden(cb: (hidden: boolean) => void): Unsubscribe
  /** Settings window only. */
  onShortcutStatus(cb: (status: ShortcutStatusReport) => void): Unsubscribe
  /** Overlay windows: edit mode with the cursor hidden by the game, or not any more. */
  onCursorHidden(cb: (hidden: boolean) => void): Unsubscribe
  /** Settings window only: the car you are in now changed. */
  onCurrentCar(cb: (car: CarRef | null) => void): Unsubscribe
  /** Settings window only: how a layout export or import went. */
  onLayoutNotice(cb: (notice: LayoutNotice) => void): Unsubscribe
  /** Settings window only: main asks for a page (opened from the tray). */
  onSettingsPage(cb: (page: SettingsWindowPage) => void): Unsubscribe
  /** Settings window only: saving to disk stopped (true) or works again (false). */
  onSaveFailing(cb: (failing: boolean) => void): Unsubscribe
  /** Settings window only: a controller's button went down while recording a shortcut. */
  onControllerPress(cb: (press: ControllerPress) => void): Unsubscribe
  /** Settings window only: a shortcut ran. */
  onShortcutUsed(cb: (action: UsedShortcut) => void): Unsubscribe
  /** The confirmation window over the game only: what to say now. */
  onOsd(cb: (msg: OsdMessage) => void): Unsubscribe
  /** Overlay windows: a panel changed (drag end, wheel notch, fitted height, drop elsewhere). */
  commitBounds(msg: BoundsCommit): void
  /** Overlay windows, edit mode: a wheel notch over an auto-height widget. */
  scaleStep(msg: ScaleStepMessage): void
  /** Overlay windows, edit mode: a drag started, is still running, or ended. */
  dragState(msg: DragStateMessage): void
  /** Overlay windows, edit mode: an edit chip's eye or padlock was clicked. */
  widgetToggle(msg: WidgetToggleMessage): void
  /** Overlay windows, edit mode: where this window's edit chips are now. */
  editChips(msg: EditChipsMessage): void
  /** Overlay windows, edit mode: an edit chip's ⚙ (open that widget's settings page). */
  openWidgetPage(msg: OpenWidgetPageMessage): void
  /** Overlay windows: edit mode entered from a widget's page; point that panel out. */
  onEditFocus(cb: (widget: WidgetId) => void): Unsubscribe
  /**
   * Settings window only (main rejects it from overlay windows). `forLayout`: the layout in use
   * when the change was made; main keeps it in that layout if another is in use by the time it
   * arrives (applySettingsPatchFor).
   */
  updateSettings(patch: SettingsPatch, forLayout?: string): Promise<OverlaySettings>
  /** Settings window only. */
  command(cmd: SettingsCommand): void
}
