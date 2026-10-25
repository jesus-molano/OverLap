import {
  BrowserWindow,
  app,
  ipcMain,
  screen,
  type IpcMainEvent,
  type Point,
  type WebContents
} from 'electron'
import { join } from 'node:path'
import { DEFAULT_LANGUAGE, messagesFor, widgetTitle, type Language } from '@shared/i18n'
import { IPC, type AutoHiddenState, type EditDragMessage } from '@shared/ipc'
import {
  applyDrag,
  clampRectToDisplays,
  pickDisplay,
  rectsEqual,
  restoreBounds
} from '@shared/settings'
import { SNAP_THRESHOLD, snapRect } from '@shared/snap'
import type {
  HiddenReason,
  OverlaySettings,
  OverlayStatus,
  Rect,
  WidgetDataMessage
} from '@shared/types'
import { WIDGET_DEFS, WIDGET_IDS, type WidgetId } from '@shared/widgets'
import { HeightFitter } from './heightFitter'
import { KeyedTimer } from './keyedTimer'
import {
  COMMIT_DELAY_MS,
  fitHeight,
  isEditDragMessage,
  isEditScaleMessage,
  parseContentHeight,
  scaleAroundCentre,
  snapAreas,
  windowShown,
  workAreaFor,
  type DisplayAreas
} from './windowMath'

/** Some games re-assert their z-order; we re-assert ours this often. */
const Z_ORDER_INTERVAL_MS = 2_000
const DISPLAY_CHANGE_DEBOUNCE_MS = 300
const RECREATE_DELAY_MS = 1_000
/** More renderer crashes than this within the window and we stop recreating it. */
const MAX_CRASHES = 5
const CRASH_WINDOW_MS = 60_000

export interface WidgetWindowsOptions {
  getSettings(): OverlaySettings
  /** Bounds to save after a drag, a wheel resize or an auto-height change. */
  onBoundsCommitted(id: WidgetId, bounds: Rect): void
  /** Mouse wheel over an auto-height widget in edit mode: change its content scale. */
  onScaleStep(id: WidgetId, step: 1 | -1): void
}

interface Entry {
  win: BrowserWindow
  /** 'ready-to-show' fired: the window may be shown and receive data. */
  ready: boolean
  /** Last value passed to setIgnoreMouseEvents; null before the first call. */
  ignoringMouse: boolean | null
}

interface Drag {
  id: WidgetId
  mode: EditDragMessage['mode']
  cursor0: Point
  /** Bounds at `start`, rebased when auto height resizes the window mid-drag. */
  bounds0: Rect
  /** Display and work-area rects to snap to, read once at `start`. */
  areas: Rect[]
}

/**
 * One transparent, click-through, non-focusable, always-on-top window per
 * widget. These windows must never take focus from the sim: no show(),
 * focus() or restore(), only showInactive().
 *
 * A window is on screen while the user enabled its widget and no visibility
 * rule of the telemetry process hides it; edit mode overrides the rules so a
 * hidden widget can still be placed (see `windowShown`).
 */
export class WidgetWindows {
  private readonly entries = new Map<WidgetId, Entry>()
  /** Source of truth for each window's bounds (DIP, integers). */
  private readonly bounds = new Map<WidgetId, Rect>()
  /** Enabled by the user (settings / tray checkbox). */
  private readonly visible = new Map<WidgetId, boolean>()
  private readonly autoHidden = new Map<WidgetId, AutoHiddenState>()
  /**
   * Last payload of each widget, handed to its window when it becomes ready: one sent while it
   * loads is lost, and the telemetry process never repeats an unchanged payload (a static
   * practice table would stay empty after a start, a reload or a crash). Forgotten whenever
   * it would be stale.
   */
  private readonly lastData = new Map<WidgetId, WidgetDataMessage>()
  private readonly crashes = new Map<WidgetId, number[]>()
  /** Last autoHeight/anchor seen per widget, to refit when they change. */
  private readonly fitKeys = new Map<WidgetId, string>()
  private readonly fitter = new HeightFitter<WidgetId>({
    active: (id) => this.fits(id),
    offscreen: (id) => {
      const entry = this.entries.get(id)
      return !entry?.ready || entry.win.isDestroyed() || !entry.win.isVisible()
    },
    target: (id, desired) => this.fitTarget(id, desired),
    current: (id) => this.boundsOf(id),
    apply: (id, rect) => this.applyFit(id, rect)
  })
  /** Debounced saves: auto height saves only the height, a wheel resize the whole rect. */
  private readonly fitCommits = new KeyedTimer<WidgetId>(COMMIT_DELAY_MS, (id) =>
    this.commitFit(id)
  )
  private readonly resizeCommits = new KeyedTimer<WidgetId>(COMMIT_DELAY_MS, (id) =>
    this.commitBounds(id)
  )
  private editing = false
  /** settings.appearance.language the window titles are in. */
  private language: Language = DEFAULT_LANGUAGE
  private drag: Drag | null = null
  private zOrderTimer: ReturnType<typeof setInterval> | null = null
  private displayTimer: ReturnType<typeof setTimeout> | null = null
  private started = false
  private disposed = false

  constructor(private readonly opts: WidgetWindowsOptions) {}

  get editMode(): boolean {
    return this.editing
  }

  /**
   * Registers the edit-mode IPC, creates every widget window (WIDGET_IDS order)
   * and starts the z-order guard. IPC.init is answered by main (see `widgetOf`).
   */
  start(): void {
    if (this.started || this.disposed) return
    this.started = true
    ipcMain.on(IPC.editDrag, this.handleEditDrag)
    ipcMain.on(IPC.editScale, this.handleEditScale)
    ipcMain.on(IPC.contentSize, this.handleContentSize)
    screen.on('display-added', this.onDisplaysChanged)
    screen.on('display-removed', this.onDisplaysChanged)
    screen.on('display-metrics-changed', this.onDisplaysChanged)

    const settings = this.opts.getSettings()
    this.language = settings.appearance.language
    for (const id of WIDGET_IDS) {
      this.visible.set(id, settings.widgets[id].visible)
      this.fitKeys.set(id, fitKey(settings, id))
      this.bounds.set(id, this.restore(id, settings))
      this.create(id)
    }
    this.zOrderTimer = setInterval(() => this.reassertZOrder(), Z_ORDER_INTERVAL_MS)
  }

  /** Hides the windows and stops timers and listeners; nothing is recreated afterwards. */
  dispose(): void {
    if (this.disposed) return
    // Save the last fitted or wheel-resized bounds before going away.
    this.fitCommits.flush()
    this.resizeCommits.flush()
    this.disposed = true
    this.drag = null
    if (this.zOrderTimer) clearInterval(this.zOrderTimer)
    if (this.displayTimer) clearTimeout(this.displayTimer)
    this.zOrderTimer = this.displayTimer = null
    this.lastData.clear()
    this.fitter.dispose()
    // Anything the flush above re-scheduled.
    this.fitCommits.dispose()
    this.resizeCommits.dispose()
    screen.removeListener('display-added', this.onDisplaysChanged)
    screen.removeListener('display-removed', this.onDisplaysChanged)
    screen.removeListener('display-metrics-changed', this.onDisplaysChanged)
    ipcMain.removeListener(IPC.editDrag, this.handleEditDrag)
    ipcMain.removeListener(IPC.editScale, this.handleEditScale)
    ipcMain.removeListener(IPC.contentSize, this.handleContentSize)
    for (const { win } of this.entries.values()) if (!win.isDestroyed()) win.hide()
  }

  /**
   * Enabled by the user. Hidden windows stay alive (hidden, no data) so showing
   * them again is instant. Showing a widget whose window is gone (the crash
   * limit gave up on it) creates it again: unchecking and checking it in the
   * tray is the explicit retry.
   */
  setVisible(id: WidgetId, visible: boolean): void {
    this.visible.set(id, visible)
    // Not computed while disabled: enabled again, it gets a fresh payload.
    if (!visible) this.lastData.delete(id)
    const entry = this.entries.get(id)
    if (!entry || entry.win.isDestroyed()) {
      if (visible && this.started && !this.disposed) {
        this.crashes.delete(id)
        // A pending recreate timer finds the new entry and does nothing.
        this.create(id)
      }
      return
    }
    this.syncShown(id, entry)
  }

  /**
   * A "Mostrar en" / "Ocultar en boxes" rule hid or showed a widget. The
   * renderer gets the state (edit mode shows its caption); the window is
   * hidden, so it is not painted at all, unless edit mode previews it.
   */
  setAutoHidden(id: WidgetId, state: AutoHiddenState): void {
    const next: AutoHiddenState = {
      hidden: state.hidden,
      reason: state.hidden ? state.reason : null
    }
    const prev = this.autoHidden.get(id)
    if (prev && prev.hidden === next.hidden && prev.reason === next.reason) return
    this.autoHidden.set(id, next)
    // Its provider stops while hidden (the renderer drops the payload too).
    if (next.hidden) this.lastData.delete(id)
    const entry = this.entries.get(id)
    if (!entry || entry.win.isDestroyed()) return
    send(entry.win.webContents, IPC.autoHidden, next)
    this.syncShown(id, entry)
  }

  /** Why each widget a rule hides right now is hidden (null: no known reason). */
  autoHiddenReasons(): Partial<Record<WidgetId, HiddenReason | null>> {
    const out: Partial<Record<WidgetId, HiddenReason | null>> = {}
    for (const [id, state] of this.autoHidden) if (state.hidden) out[id] = state.reason
    return out
  }

  /**
   * Edit mode makes the unlocked windows take the mouse so the renderer can draw
   * its border and drag handles; locked ones stay click-through (the renderer
   * shows a lock chip). The windows stay non-focusable: setFocusable(true)
   * would add a taskbar button and could steal focus. Widgets hidden by a rule
   * preview while editing; widgets the user disabled stay hidden.
   * On exit every window is clamped into a display, on screen only: saved bounds
   * change only through onBoundsCommitted, so a widget whose monitor is
   * disconnected keeps its saved place and returns there with the monitor.
   */
  setEditMode(on: boolean): void {
    if (this.editing === on) return
    if (!on) this.finishDrag()
    this.editing = on
    const settings = this.opts.getSettings()
    for (const [id, entry] of this.entries) {
      if (entry.win.isDestroyed()) continue
      if (entry.ready) this.applyMouse(id, entry, settings)
      if (!on) {
        this.setWindowBounds(id, clampRectToDisplays(this.boundsOf(id), displayBounds()))
        this.fitter.refit(id)
      }
      send(entry.win.webContents, IPC.editMode, on)
      this.syncShown(id, entry)
    }
    if (on) this.reassertZOrder()
  }

  /**
   * Re-applies the locks after a settings change: a widget locked mid-drag ends
   * (and commits) that drag, and its window goes back to click-through.
   * Turning auto height on (or changing its anchor) fits the window at once.
   * Background opacity and scale are drawn by the renderer from `broadcastSettings`.
   * A new interface language retitles every window at once.
   */
  applySettings(settings: OverlaySettings): void {
    if (this.drag && settings.widgets[this.drag.id].locked) this.finishDrag()
    if (settings.appearance.language !== this.language) {
      this.language = settings.appearance.language
      for (const [id, entry] of this.entries) {
        if (!entry.win.isDestroyed()) entry.win.setTitle(this.windowTitle(id))
      }
    }
    for (const [id, entry] of this.entries) {
      if (entry.ready && !entry.win.isDestroyed()) this.applyMouse(id, entry, settings)
    }
    for (const id of WIDGET_IDS) {
      const key = fitKey(settings, id)
      if (this.fitKeys.get(id) === key) continue
      this.fitKeys.set(id, key)
      if (this.fits(id, settings)) this.fitter.refit(id)
      else this.fitter.pause(id)
    }
  }

  /** Every window gets the settings, hidden ones too, so they are current when shown. */
  broadcastSettings(settings: OverlaySettings): void {
    for (const { win } of this.entries.values()) {
      if (!win.isDestroyed()) send(win.webContents, IPC.settings, settings)
    }
  }

  /**
   * Moves a widget to the bounds now saved in settings (after a reset). A drag
   * of that widget is dropped without committing, so the reset wins.
   */
  reloadBounds(id: WidgetId): void {
    if (this.drag?.id === id) this.drag = null
    this.fitCommits.cancel(id)
    this.resizeCommits.cancel(id)
    this.setWindowBounds(id, this.restore(id, this.opts.getSettings()))
    this.fitter.refit(id)
  }

  /**
   * Forwards a payload only to its own widget's window, and only while it is enabled; a window
   * that is not ready yet gets the latest one when it is (see `lastData`).
   */
  sendData(msg: WidgetDataMessage): void {
    if (this.disposed || this.visible.get(msg.widget) !== true) return
    this.lastData.set(msg.widget, msg)
    const entry = this.entries.get(msg.widget)
    if (entry?.ready) this.deliverData(entry, msg)
  }

  /** The latest payload to a window that just became ready or finished (re)loading. */
  private handOverData(id: WidgetId, entry: Entry): void {
    const last = this.lastData.get(id)
    if (last && entry.ready && this.visible.get(id) === true) this.deliverData(entry, last)
  }

  private deliverData(entry: Entry, msg: WidgetDataMessage): void {
    if (entry.win.isDestroyed()) return
    const wc = entry.win.webContents
    if (wc.isDestroyed() || wc.isLoading() || wc.isCrashed()) return
    wc.send(IPC.data, msg)
  }

  /** Every window gets the status, hidden ones too, so they are current when shown. */
  broadcastStatus(status: OverlayStatus): void {
    // Not live any more: every payload belongs to the old connection (the renderers drop theirs).
    if (status.state !== 'connected' && status.state !== 'mock') this.lastData.clear()
    for (const { win } of this.entries.values()) {
      if (!win.isDestroyed()) send(win.webContents, IPC.status, status)
    }
  }

  // -------------------------------------------------------------------------
  // Window lifecycle
  // -------------------------------------------------------------------------

  /** 'Relativo · OverLap', in the interface language. */
  private windowTitle(id: WidgetId): string {
    const m = messagesFor(this.language)
    return m.core.windowTitles.widget(widgetTitle(m, id))
  }

  private create(id: WidgetId): void {
    const b = this.boundsOf(id)
    const win = new BrowserWindow({
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      title: this.windowTitle(id),
      show: false,
      frame: false,
      transparent: true,
      // Resizing is manual (setBounds) in edit mode: transparent + resizable has a long
      // regression history on Windows.
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      // WS_EX_NOACTIVATE: clicking or showing the window never activates it.
      focusable: false,
      skipTaskbar: true,
      // WS_EX_TOOLWINDOW: not listed in Alt+Tab.
      type: 'toolbar',
      hasShadow: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        // Keep rAF and animations at full rate although the window is never focused.
        backgroundThrottling: false,
        spellcheck: false,
        devTools: !app.isPackaged
      }
    })
    // The constructor's alwaysOnTop means 'floating', which sits below the taskbar on Windows.
    win.setAlwaysOnTop(true, 'screen-saver')

    const entry: Entry = { win, ready: false, ignoringMouse: null }
    this.entries.set(id, entry)
    const wc = win.webContents

    wc.on('will-navigate', (event) => event.preventDefault())
    wc.on('will-attach-webview', (event) => event.preventDefault())
    wc.setWindowOpenHandler(() => ({ action: 'deny' }))

    // The page has run its scripts (listeners registered): a new or reloaded
    // renderer starts without the rule state and the payload, so hand them over.
    // (Whichever of this and 'ready-to-show' comes last delivers the payload: no
    // data is sent while the page is still loading.)
    wc.on('did-finish-load', () => {
      const state = this.autoHidden.get(id)
      if (state?.hidden) send(wc, IPC.autoHidden, state)
      this.handOverData(id, entry)
    })
    win.once('ready-to-show', () => {
      if (win.isDestroyed()) return
      entry.ready = true
      this.applyMouse(id, entry, this.opts.getSettings())
      if (this.shouldShow(id)) this.showWindow(win)
      this.handOverData(id, entry)
      if (!app.isPackaged && process.env.OVERLAY_DEVTOOLS === '1') {
        wc.openDevTools({ mode: 'detach', activate: false })
      }
    })
    wc.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
      if (isMainFrame) console.error(`[windows] ${id}: load failed (${code} ${description}) ${url}`)
    })
    wc.on('render-process-gone', (_event, details) => this.handleCrash(id, win, details.reason))
    win.on('closed', () => {
      if (this.entries.get(id)?.win !== win) return
      this.entries.delete(id)
      this.fitter.forget(id)
    })

    const devUrl = process.env.ELECTRON_RENDERER_URL
    const loading =
      !app.isPackaged && devUrl
        ? win.loadURL(withWidgetParam(devUrl, id))
        : win.loadFile(join(__dirname, '../renderer/index.html'), { query: { widget: id } })
    loading.catch((err: unknown) => {
      if (!win.isDestroyed()) console.error(`[windows] ${id}: could not load the renderer`, err)
    })
  }

  private handleCrash(id: WidgetId, win: BrowserWindow, reason: string): void {
    if (this.disposed || this.entries.get(id)?.win !== win) return
    console.error(`[windows] ${id}: renderer gone (${reason})`)
    const now = Date.now()
    const recent = (this.crashes.get(id) ?? []).filter((t) => now - t < CRASH_WINDOW_MS)
    recent.push(now)
    this.crashes.set(id, recent)

    this.entries.delete(id)
    this.fitter.forget(id)
    if (this.drag?.id === id) this.drag = null
    if (!win.isDestroyed()) win.destroy()
    if (recent.length > MAX_CRASHES) {
      console.error(
        `[windows] ${id}: crashed ${recent.length} times in a minute, giving up ` +
          '(hide and show it from the tray to retry)'
      )
      return
    }
    setTimeout(() => {
      if (!this.disposed && !this.entries.has(id)) this.create(id)
    }, RECREATE_DELAY_MS)
  }

  /** Takes the mouse only in edit mode and only when unlocked. */
  private applyMouse(id: WidgetId, entry: Entry, settings: OverlaySettings): void {
    const ignore = !(this.editing && !settings.widgets[id].locked)
    if (entry.ignoringMouse === ignore) return
    entry.ignoringMouse = ignore
    // No `forward` option: it installs a global low-level mouse hook on main's thread.
    entry.win.setIgnoreMouseEvents(ignore)
  }

  private shouldShow(id: WidgetId): boolean {
    return windowShown({
      userVisible: this.visible.get(id) === true,
      autoHidden: this.autoHidden.get(id)?.hidden === true,
      editing: this.editing
    })
  }

  /**
   * Shows or hides the window to match `shouldShow`; hiding ends (and commits) its drag.
   * Nothing shows after dispose (the telemetry process releases its rules while quitting).
   */
  private syncShown(id: WidgetId, entry: Entry): void {
    if (this.disposed) return
    const show = this.shouldShow(id)
    if (!show && this.drag?.id === id) this.finishDrag()
    if (!entry.ready || entry.win.isDestroyed() || entry.win.isVisible() === show) return
    if (show) this.showWindow(entry.win)
    else entry.win.hide()
  }

  private showWindow(win: BrowserWindow): void {
    win.showInactive()
    win.setAlwaysOnTop(true, 'screen-saver')
    win.moveTop()
  }

  private reassertZOrder(): void {
    for (const [id, { win }] of this.entries) {
      // moveTop() would show a hidden window.
      if (win.isDestroyed() || !win.isVisible()) continue
      if (!win.isAlwaysOnTop()) win.setAlwaysOnTop(true, 'screen-saver')
      win.moveTop()
      // Defensive: keep the window where we put it (fitted heights included), whatever moved it.
      if (this.drag?.id !== id) {
        const want = this.boundsOf(id)
        const got = win.getBounds()
        if (
          Math.abs(got.x - want.x) > 1 ||
          Math.abs(got.y - want.y) > 1 ||
          Math.abs(got.width - want.width) > 1 ||
          Math.abs(got.height - want.height) > 1
        ) {
          win.setBounds(want)
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Bounds
  // -------------------------------------------------------------------------

  private boundsOf(id: WidgetId): Rect {
    return this.bounds.get(id) ?? { ...WIDGET_DEFS[id].defaultBounds }
  }

  private restore(id: WidgetId, settings: OverlaySettings): Rect {
    return restoreBounds(
      settings.widgets[id].bounds,
      WIDGET_DEFS[id].defaultBounds,
      displayBounds(),
      screen.getPrimaryDisplay().workArea
    )
  }

  /** setBounds does not emit 'moved'/'resized'; callers commit explicitly. */
  private setWindowBounds(id: WidgetId, rect: Rect): void {
    const current = this.bounds.get(id)
    if (current && rectsEqual(current, rect)) return
    this.bounds.set(id, rect)
    const entry = this.entries.get(id)
    if (entry && !entry.win.isDestroyed()) entry.win.setBounds(rect)
  }

  /** Re-validates every widget from its saved bounds, so it returns when its monitor does. */
  private readonly onDisplaysChanged = (): void => {
    if (this.displayTimer) clearTimeout(this.displayTimer)
    this.displayTimer = setTimeout(() => {
      this.displayTimer = null
      if (this.disposed) return
      this.finishDrag()
      const settings = this.opts.getSettings()
      for (const id of WIDGET_IDS) {
        this.setWindowBounds(id, this.restore(id, settings))
        this.fitter.refit(id)
      }
    }, DISPLAY_CHANGE_DEBOUNCE_MS)
  }

  private commitBounds(id: WidgetId): void {
    // A drag of it commits when it ends.
    if (this.drag?.id === id) return
    this.opts.onBoundsCommitted(id, { ...this.boundsOf(id) })
  }

  // -------------------------------------------------------------------------
  // Auto height (fit window to content)
  // -------------------------------------------------------------------------

  private fits(id: WidgetId, settings: OverlaySettings = this.opts.getSettings()): boolean {
    return WIDGET_DEFS[id].sizeModel === 'auto-height' && settings.widgets[id].autoHeight
  }

  private fitTarget(id: WidgetId, desired: number): Rect | null {
    const bounds = this.boundsOf(id)
    const workArea = workAreaFor(bounds, displays()) ?? screen.getPrimaryDisplay().workArea
    return fitHeight(
      bounds,
      desired,
      this.opts.getSettings().widgets[id].anchor,
      workArea,
      WIDGET_DEFS[id].minSize.height
    )
  }

  /** Written into `bounds`, so reassertZOrder keeps the fitted height. */
  private applyFit(id: WidgetId, rect: Rect): void {
    const drag = this.drag
    if (drag?.id === id) {
      // Keep the drag maths on the new height (and on the new y with a bottom anchor).
      const prev = this.boundsOf(id)
      drag.bounds0 = { ...drag.bounds0, y: drag.bounds0.y + rect.y - prev.y, height: rect.height }
    }
    this.setWindowBounds(id, rect)
    this.fitCommits.restart(id)
  }

  /**
   * Saves only the fitted height (bottom anchor: keeping the saved bottom
   * edge). A widget shown away from its saved place because its monitor is
   * gone must keep that place for when the monitor returns.
   */
  private commitFit(id: WidgetId): void {
    if (this.drag?.id === id) return
    const w = this.opts.getSettings().widgets[id]
    const { height } = this.boundsOf(id)
    const y = w.anchor === 'bottom' ? w.bounds.y + w.bounds.height - height : w.bounds.y
    this.opts.onBoundsCommitted(id, { ...w.bounds, y, height })
  }

  // -------------------------------------------------------------------------
  // IPC
  // -------------------------------------------------------------------------

  /** Widget whose window `sender` belongs to; undefined for any other renderer. */
  widgetOf(sender: WebContents): WidgetId | undefined {
    const win = BrowserWindow.fromWebContents(sender)
    if (!win) return undefined
    for (const [id, entry] of this.entries) if (entry.win === win) return id
    return undefined
  }

  /** Desired content height of an auto-height widget; remembered even while auto height is off. */
  private readonly handleContentSize = (event: IpcMainEvent, raw: unknown): void => {
    const id = this.widgetOf(event.sender)
    if (!id || WIDGET_DEFS[id].sizeModel !== 'auto-height') return
    const height = parseContentHeight(raw, WIDGET_DEFS[id].minSize.height)
    if (height !== null) this.fitter.report(id, height)
  }

  /**
   * Mouse wheel in edit mode, one meaning everywhere ("bigger / smaller"):
   * auto-height widgets change their content scale (a setting), free widgets
   * resize around their centre.
   */
  private readonly handleEditScale = (event: IpcMainEvent, raw: unknown): void => {
    if (!this.editing || !isEditScaleMessage(raw)) return
    const id = this.widgetOf(event.sender)
    if (!id || this.drag?.id === id || this.opts.getSettings().widgets[id].locked) return
    if (WIDGET_DEFS[id].sizeModel === 'auto-height') {
      this.opts.onScaleStep(id, raw.step)
      return
    }
    const bounds = this.boundsOf(id)
    const display = pickDisplay(bounds, displayBounds())
    if (!display) return
    const next = scaleAroundCentre(bounds, raw.step, WIDGET_DEFS[id].minSize, display)
    if (rectsEqual(next, bounds)) return
    this.setWindowBounds(id, next)
    this.resizeCommits.restart(id)
  }

  /**
   * The cursor is read here with getCursorScreenPoint() (DIP, the same space as
   * setBounds) instead of trusting the renderer's dx/dy, which drift across
   * displays with different scale factors.
   */
  private readonly handleEditDrag = (event: IpcMainEvent, raw: unknown): void => {
    if (!this.editing || !isEditDragMessage(raw)) return
    const id = this.widgetOf(event.sender)
    if (!id) return
    const noSnap = raw.noSnap === true
    switch (raw.phase) {
      case 'start':
        // A locked window is click-through, but a stale message could still arrive.
        if (this.opts.getSettings().widgets[id].locked) return
        // Auto height owns the height: only the sides can be dragged.
        if (raw.mode !== 'move' && /[ns]/.test(raw.mode) && this.fits(id)) return
        if (this.drag) this.finishDrag()
        this.drag = {
          id,
          mode: raw.mode,
          cursor0: screen.getCursorScreenPoint(),
          bounds0: { ...this.boundsOf(id) },
          areas: snapAreas(displays())
        }
        break
      case 'move':
        if (this.drag?.id === id) this.dragStep(this.drag, noSnap)
        break
      case 'end':
        if (this.drag?.id === id) {
          this.dragStep(this.drag, noSnap)
          this.finishDrag()
        }
        break
    }
  }

  private dragStep(drag: Drag, noSnap: boolean): void {
    const cursor = screen.getCursorScreenPoint()
    const next = applyDrag(
      drag.bounds0,
      drag.mode,
      cursor.x - drag.cursor0.x,
      cursor.y - drag.cursor0.y,
      WIDGET_DEFS[drag.id].minSize
    )
    this.setWindowBounds(drag.id, noSnap ? next : this.snap(drag, next))
  }

  /** Moving edges snap to the other shown widgets and to the display edges (ux §3.3). */
  private snap(drag: Drag, rect: Rect): Rect {
    const targets: Rect[] = []
    for (const [id, { win }] of this.entries) {
      if (id !== drag.id && !win.isDestroyed() && win.isVisible()) targets.push(this.boundsOf(id))
    }
    // A snap that would take a resized widget below its minimum size is skipped.
    return snapRect(
      rect,
      drag.mode,
      targets,
      drag.areas,
      SNAP_THRESHOLD,
      WIDGET_DEFS[drag.id].minSize
    )
  }

  private finishDrag(): void {
    const drag = this.drag
    if (!drag) return
    this.drag = null
    this.setWindowBounds(drag.id, clampRectToDisplays(this.boundsOf(drag.id), displayBounds()))
    // A new place can mean another work area, so another available height.
    this.fitter.refit(drag.id)
    this.fitCommits.cancel(drag.id)
    this.resizeCommits.cancel(drag.id)
    this.opts.onBoundsCommitted(drag.id, { ...this.boundsOf(drag.id) })
  }
}

function fitKey(settings: OverlaySettings, id: WidgetId): string {
  const w = settings.widgets[id]
  return `${w.autoHeight}:${w.anchor}`
}

function displays(): DisplayAreas[] {
  return screen.getAllDisplays().map((d) => ({ bounds: d.bounds, workArea: d.workArea }))
}

function displayBounds(): Rect[] {
  return screen.getAllDisplays().map((d) => d.bounds)
}

function withWidgetParam(base: string, id: WidgetId): string {
  const url = new URL(base)
  url.searchParams.set('widget', id)
  return url.toString()
}

function send(wc: WebContents, channel: string, value: unknown): void {
  if (!wc.isDestroyed()) wc.send(channel, value)
}
