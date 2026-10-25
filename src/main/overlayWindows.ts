import {
  app,
  ipcMain,
  powerMonitor,
  screen,
  type Display,
  type IpcMainEvent,
  type WebContents
} from 'electron'
import { DEFAULT_LANGUAGE, messagesFor, type Language } from '@shared/i18n'
import {
  DRAG_LEASE_MS,
  IPC,
  type AutoHiddenMap,
  type AutoHiddenState,
  type OverlayLayout
} from '@shared/ipc'
import { widgetShown } from '@shared/panelGeometry'
import { rectsEqual } from '@shared/settings'
import type {
  HiddenReason,
  OverlaySettings,
  OverlayStatus,
  Point,
  Rect,
  WidgetDataMessage
} from '@shared/types'
import { WIDGET_DEFS, WIDGET_IDS, type WidgetId } from '@shared/widgets'
import { acceptScaleStep, decideCommit, type CommitContext } from './commitRules'
import { CrashBudget } from './crashBudget'
import { KeyedTimer } from './keyedTimer'
import { MOUSE_POLL_MS, mouseMode, type HitPanel, type MouseMode } from './mouseMode'
import {
  anyShown,
  buildLayout,
  displayAtPoint,
  displayNumbers,
  fittedBounds,
  owningDisplay,
  partition,
  placeWidget,
  reconcileWindows,
  sameDisplays,
  sameLayoutContent,
  type DisplayInfo
} from './overlayLayout'
import { parseBoundsCommit, parseDragState, parseScaleStep } from './overlayMessages'
import { MainPerfLog, perfEnabled } from './overlayPerf'
import { OverlayWindow, type OverlayWindowHost } from './overlayWindow'
import { PayloadCache } from './payloadCache'

/** Some games re-assert their z-order; we re-assert ours this often. */
export const Z_ORDER_INTERVAL_MS = 2_000
export const DISPLAY_CHANGE_DEBOUNCE_MS = 300
export const RESUME_DEBOUNCE_MS = 1_000
export const RELOAD_DELAY_MS = 1_000
export const GPU_RECREATE_DELAY_MS = 1_000
/** Fitted and wheel-resized bounds are saved this long after the last change. */
export const COMMIT_DELAY_MS = 1_000

export interface OverlayWindowsOptions {
  getSettings(): OverlaySettings
  /** Bounds to save after a drag, a drop, a wheel resize or an auto-height change. */
  onBoundsCommitted(id: WidgetId, bounds: Rect): void
  /** Mouse wheel over an auto-height widget in edit mode: change its content scale. */
  onScaleStep(id: WidgetId, step: 1 | -1): void
}

/** What the recovery timer will do when it fires (a GPU loss and a resume can combine). */
interface Recovery {
  timer: ReturnType<typeof setTimeout>
  /** Recreate every window first (GPU process lost). */
  recreate: boolean
  /** Leave the suspended state (resume, unlock). */
  resume: boolean
}

/**
 * One overlay window per display that hosts an enabled widget, each widget a panel of that
 * window's single document. Main owns where every widget is (screen DIP; settings change only
 * through `onBoundsCommitted`), which window hosts it, what each window is sent and when it
 * takes the mouse. A widget belongs to the display containing its centre; a disconnected
 * monitor's widgets fall back to the primary display without that fallback being saved.
 *
 * Any event that can leave a garbage surface (crash, failed load, hang, GPU loss, sleep, a
 * display that changed or went away) hides the affected windows and makes them click-through
 * at once; they show again once recovered.
 */
export class OverlayWindows implements OverlayWindowHost {
  private readonly pool = new Map<number, OverlayWindow>()
  private nextKey = 1
  private displays: DisplayInfo[] = []
  private primaryId = 0
  private numbers = new Map<number, number>()
  /** Where each widget is drawn now (screen DIP, integers, fitted heights included). */
  private readonly rects = new Map<WidgetId, Rect>()
  /** `OverlayPanel.placement`: bumped whenever main moves a panel on its own. */
  private readonly placements = new Map<WidgetId, number>()
  /** The window hosting each enabled widget. */
  private readonly owner = new Map<WidgetId, OverlayWindow>()
  /** Enabled by the user (settings / tray checkbox). */
  private readonly visible = new Map<WidgetId, boolean>()
  private readonly autoHidden = new Map<WidgetId, AutoHiddenState>()
  private readonly payloads = new PayloadCache()
  /** Recoveries per display id; displays given up on get no window until a retry. */
  private readonly budget = new CrashBudget<number>()
  private readonly givenUp = new Set<number>()
  /** Debounced saves: a wheel resize saves the whole rect, a fit only the height. */
  private readonly wheelSaves = new KeyedTimer<WidgetId>(COMMIT_DELAY_MS, (id) => this.saveRect(id))
  private readonly fitSaves = new KeyedTimer<WidgetId>(COMMIT_DELAY_MS, (id) => this.saveFit(id))
  /** Last `OverlayLayout.revision` sent to any window. */
  private revision = 0
  private editing = false
  private suspended = false
  /** settings.appearance.language the window titles are in. */
  private language: Language = DEFAULT_LANGUAGE
  private zOrderTimer: ReturnType<typeof setInterval> | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private displayTimer: ReturnType<typeof setTimeout> | null = null
  private recovery: Recovery | null = null
  private perf: MainPerfLog | null = null
  private gpuWarned = false
  /**
   * Log the GPU compositing status once a window has loaded: before the GPU process has drawn
   * anything, app.getGPUFeatureStatus() reports 'disabled_software' (measured on Electron 44).
   */
  private gpuLogPending = false
  private started = false
  private disposed = false

  constructor(private readonly opts: OverlayWindowsOptions) {}

  get editMode(): boolean {
    return this.editing
  }

  /**
   * Registers the overlay IPC and the display, power and GPU listeners, places every widget,
   * creates the windows and starts the z-order guard. IPC.init is answered by main (see
   * `layoutFor`).
   */
  start(): void {
    if (this.started || this.disposed) return
    this.started = true
    ipcMain.on(IPC.commitBounds, this.onCommitBounds)
    ipcMain.on(IPC.scaleStep, this.onScaleStep)
    ipcMain.on(IPC.dragState, this.onDragState)
    screen.on('display-added', this.onDisplayAdded)
    screen.on('display-removed', this.onDisplayRemoved)
    screen.on('display-metrics-changed', this.onDisplayMetricsChanged)
    powerMonitor.on('suspend', this.onSuspend)
    powerMonitor.on('lock-screen', this.onSuspend)
    powerMonitor.on('resume', this.onResume)
    powerMonitor.on('unlock-screen', this.onResume)
    app.on('child-process-gone', this.onChildProcessGone)

    const settings = this.opts.getSettings()
    this.language = settings.appearance.language
    for (const id of WIDGET_IDS) {
      this.visible.set(id, settings.widgets[id].visible)
      this.placements.set(id, 0)
    }
    const all = screen.getAllDisplays()
    this.setDisplays((all.length > 0 ? all : [screen.getPrimaryDisplay()]).map(displayInfo))
    this.placeAll(settings)
    this.syncWindows()
    this.zOrderTimer = setInterval(() => this.tick(), Z_ORDER_INTERVAL_MS)
    if (perfEnabled()) {
      this.perf = new MainPerfLog()
      this.perf.start()
      this.gpuLogPending = true
    }
  }

  /** Saves pending commits, then destroys the windows and stops every timer and listener. */
  dispose(): void {
    if (this.disposed) return
    this.flushSaves()
    this.disposed = true
    if (this.zOrderTimer) clearInterval(this.zOrderTimer)
    if (this.pollTimer) clearInterval(this.pollTimer)
    if (this.displayTimer) clearTimeout(this.displayTimer)
    if (this.recovery) clearTimeout(this.recovery.timer)
    this.zOrderTimer = this.pollTimer = this.displayTimer = null
    this.recovery = null
    this.perf?.dispose()
    this.perf = null
    // Anything the flush above re-scheduled.
    this.wheelSaves.dispose()
    this.fitSaves.dispose()
    ipcMain.removeListener(IPC.commitBounds, this.onCommitBounds)
    ipcMain.removeListener(IPC.scaleStep, this.onScaleStep)
    ipcMain.removeListener(IPC.dragState, this.onDragState)
    screen.removeListener('display-added', this.onDisplayAdded)
    screen.removeListener('display-removed', this.onDisplayRemoved)
    screen.removeListener('display-metrics-changed', this.onDisplayMetricsChanged)
    powerMonitor.removeListener('suspend', this.onSuspend)
    powerMonitor.removeListener('lock-screen', this.onSuspend)
    powerMonitor.removeListener('resume', this.onResume)
    powerMonitor.removeListener('unlock-screen', this.onResume)
    app.removeListener('child-process-gone', this.onChildProcessGone)
    const windows = [...this.pool.values()]
    this.pool.clear()
    this.owner.clear()
    this.payloads.clear()
    for (const w of windows) w.destroy()
  }

  /**
   * Enabled by the user. A disabled widget is not hosted at all (its window goes away with its
   * last widget). Enabling a widget of a display main gave up on (repeated crashes) is the
   * explicit retry.
   */
  setVisible(id: WidgetId, visible: boolean): void {
    this.visible.set(id, visible)
    if (!this.started || this.disposed) return
    if (!visible) {
      // Not computed while disabled: enabled again, it gets a fresh payload.
      this.payloads.forget(id)
      this.flushSavesOf(id)
    } else {
      const rect = this.rects.get(id)
      const display = rect && owningDisplay(rect, this.displays)
      if (display && this.givenUp.delete(display.id)) this.budget.reset(display.id)
    }
    this.syncWindows()
  }

  /**
   * A "Mostrar en" / "Ocultar en boxes" rule hid or showed a widget. Every overlay window gets
   * the state (edit mode previews a hidden widget with its reason); outside edit mode the panel
   * is not drawn, and a window with nothing to draw is hidden.
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
    if (next.hidden) this.payloads.forget(id)
    if (!this.started || this.disposed) return
    this.broadcast(IPC.autoHidden, { widget: id, ...next })
    const w = this.owner.get(id)
    if (w) this.refresh(w)
  }

  /** Why each widget a rule hides right now is hidden (null: no known reason). */
  autoHiddenReasons(): Partial<Record<WidgetId, HiddenReason | null>> {
    const out: Partial<Record<WidgetId, HiddenReason | null>> = {}
    for (const [id, state] of this.autoHidden) if (state.hidden) out[id] = state.reason
    return out
  }

  /** Every widget a rule hides right now, for `InitialState.autoHidden`. */
  autoHiddenMap(): AutoHiddenMap {
    const out: AutoHiddenMap = {}
    for (const [id, state] of this.autoHidden) {
      if (state.hidden) out[id] = { hidden: true, reason: state.reason }
    }
    return out
  }

  /**
   * Edit mode: rule-hidden widgets preview, and the windows take the mouse only while the
   * cursor is over an unlocked panel or a drag runs (main polls the cursor). The windows stay
   * non-focusable. Leaving it makes every window click-through again at once; drags in
   * progress are cancelled by the renderers (late commits are rejected), then the pending
   * wheel and fit saves are written.
   */
  setEditMode(on: boolean): void {
    if (this.editing === on) return
    this.editing = on
    if (!this.started || this.disposed) return
    if (on) {
      this.pollTimer ??= setInterval(() => this.pollMouse(), MOUSE_POLL_MS)
    } else {
      if (this.pollTimer) clearInterval(this.pollTimer)
      this.pollTimer = null
      for (const w of this.pool.values()) w.dragUntil = 0
    }
    this.updateModes()
    for (const w of this.pool.values()) this.refresh(w)
    if (on) this.guardAll()
    this.broadcast(IPC.editMode, on)
    if (!on) this.flushSaves()
  }

  /**
   * After a settings change: the locks apply at once (mouse modes), and a new interface
   * language retitles every window. Opacity, scale, auto height and anchor are drawn by the
   * renderer from `broadcastSettings`, which follows this call.
   *
   * Every window also gets main's current rects first: a fit changes only main's copy of a
   * height (no layout is sent for it), so a panel whose auto height is turned off, or that fits
   * again from another anchor, would otherwise draw the height of an older layout while main
   * hit-tests and saves the fitted one.
   */
  applySettings(settings: OverlaySettings): void {
    if (!this.started || this.disposed) return
    if (settings.appearance.language !== this.language) {
      this.language = settings.appearance.language
      for (const w of this.pool.values()) w.setTitle(this.titleOf(w.index))
    }
    this.pushLayouts()
    this.updateModes()
  }

  /** Every overlay window gets the settings, hidden ones too, so they are current when shown. */
  broadcastSettings(settings: OverlaySettings): void {
    this.broadcast(IPC.settings, settings)
  }

  /** Every overlay window gets the status, hidden ones too, so they are current when shown. */
  broadcastStatus(status: OverlayStatus): void {
    // Not live any more: every payload belongs to the old connection (the renderers drop theirs).
    this.payloads.onStatus(status)
    this.broadcast(IPC.status, status)
  }

  /**
   * Moves a widget to the bounds now saved in settings (after a reset): its pending saves are
   * dropped and an interaction in progress on it is cancelled (`placement`), so the reset wins.
   */
  reloadBounds(id: WidgetId): void {
    this.wheelSaves.cancel(id)
    this.fitSaves.cancel(id)
    if (!this.started || this.disposed) return
    this.rects.set(id, this.place(id, this.opts.getSettings()))
    this.syncWindows(new Set([id]))
  }

  /**
   * Forwards a payload only to the window hosting its widget, and only while the widget is
   * enabled; a window that cannot show it now gets the latest one when it can.
   */
  sendData(msg: WidgetDataMessage): void {
    if (this.disposed || this.visible.get(msg.widget) !== true) return
    this.payloads.remember(msg)
    this.perf?.countData(msg.widget)
    const w = this.owner.get(msg.widget)
    if (w && this.canReceive(w)) w.wc.send(IPC.data, msg)
  }

  /** True when `sender` is one of the overlay windows. */
  isOverlaySender(sender: WebContents): boolean {
    return this.windowOf(sender) !== undefined
  }

  /** `InitialState.layout` of an overlay window (always fresh); null for any other sender. */
  layoutFor(sender: WebContents): OverlayLayout | null {
    const w = this.windowOf(sender)
    if (!w) return null
    const layout = this.layoutOf(w, ++this.revision)
    w.noteLayoutSent(layout)
    return layout
  }

  // -------------------------------------------------------------------------
  // OverlayWindowHost
  // -------------------------------------------------------------------------

  onLoadStart(w: OverlayWindow): void {
    if (this.owns(w)) this.refresh(w)
  }

  onLoaded(w: OverlayWindow): void {
    if (!this.owns(w) || !w.loaded) return
    this.refresh(w, true)
    if (this.gpuLogPending) {
      this.gpuLogPending = false
      this.logGpuCompositing()
    }
  }

  onCrash(w: OverlayWindow, reason: string): void {
    if (!this.owns(w)) return
    console.error(`[overlay] display ${w.index}: renderer gone (${reason})`)
    if (!this.budget.record(w.display.id, performance.now())) {
      this.giveUp(w)
      return
    }
    w.scheduleReload(RELOAD_DELAY_MS, (err) => {
      console.error(`[overlay] display ${w.index}: reload failed`, err)
      this.giveUp(w)
    })
  }

  onUnresponsive(w: OverlayWindow): void {
    if (this.owns(w)) console.warn(`[overlay] display ${w.index}: unresponsive, hidden`)
  }

  onResponsive(w: OverlayWindow): void {
    if (!this.owns(w)) return
    console.log(`[overlay] display ${w.index}: responsive again`)
    this.refresh(w, true)
  }

  onClosed(w: OverlayWindow): void {
    if (!this.owns(w)) return
    // Only main destroys these windows, after taking them out of the pool.
    console.warn(`[overlay] display ${w.index}: window closed unexpectedly`)
    this.removeWindow(w)
  }

  // -------------------------------------------------------------------------
  // Windows and placement
  // -------------------------------------------------------------------------

  private setDisplays(displays: DisplayInfo[]): void {
    this.displays = displays
    this.primaryId = screen.getPrimaryDisplay().id
    this.numbers = displayNumbers(displays, this.primaryId)
  }

  private get primary(): DisplayInfo | undefined {
    return this.displays.find((d) => d.id === this.primaryId) ?? this.displays[0]
  }

  private place(id: WidgetId, settings: OverlaySettings): Rect {
    const primary = this.primary
    const saved = settings.widgets[id].bounds
    return primary
      ? placeWidget(saved, WIDGET_DEFS[id].defaultBounds, this.displays, primary)
      : { ...saved }
  }

  /** Every widget from its saved bounds; the widgets whose rect changed. */
  private placeAll(settings: OverlaySettings): Set<WidgetId> {
    const changed = new Set<WidgetId>()
    for (const id of WIDGET_IDS) {
      const before = this.rects.get(id)
      const after = this.place(id, settings)
      this.rects.set(id, after)
      if (before && !rectsEqual(before, after)) changed.add(id)
    }
    return changed
  }

  private titleOf(index: number): string {
    return messagesFor(this.language).core.windowTitles.overlay(index)
  }

  private numberOf(displayId: number): number {
    return this.numbers.get(displayId) ?? 1
  }

  /**
   * Brings the windows in line with the widgets: one window per display hosting an enabled
   * widget (reused across display id changes), each told what it hosts. `moved` are widgets
   * main just moved on its own; widgets that changed window or whose window changed geometry
   * are added. Their `placement` is bumped, so an interaction in progress on them is cancelled.
   */
  private syncWindows(moved: ReadonlySet<WidgetId> = new Set()): void {
    if (!this.started || this.disposed) return
    // Before any window goes away: a widget whose window is destroyed below changes window too.
    const before = new Map(this.owner)
    const parts = partition(this.rects, (id) => this.visible.get(id) === true, this.displays)
    const needed = [...parts.keys()].filter((id) => !this.givenUp.has(id))
    const plan = reconcileWindows(
      [...this.pool.values()].map((w) => ({ key: w.key, displayId: w.display.id })),
      needed
    )
    for (const key of plan.destroy) {
      const w = this.pool.get(key)
      if (w) {
        this.removeWindow(w)
        w.destroy()
      }
    }
    const regeometry = new Set<OverlayWindow>()
    for (const [key, displayId] of plan.assign) {
      const w = this.pool.get(key)
      const display = this.displays.find((d) => d.id === displayId)
      if (!w || !display) continue
      const index = this.numberOf(display.id)
      if (w.moveTo(display, index, this.titleOf(index))) regeometry.add(w)
    }
    for (const displayId of plan.create) {
      const display = this.displays.find((d) => d.id === displayId)
      if (display) this.createWindow(display)
    }

    this.owner.clear()
    const bump = new Set(moved)
    const gained = new Set<OverlayWindow>()
    for (const w of this.pool.values()) {
      w.hosted = parts.get(w.display.id) ?? []
      for (const id of w.hosted) {
        this.owner.set(id, w)
        const prev = before.get(id)
        if (prev !== w) gained.add(w)
        if ((prev !== undefined && prev !== w) || regeometry.has(w)) bump.add(id)
      }
    }
    for (const id of bump) this.placements.set(id, (this.placements.get(id) ?? 0) + 1)
    for (const w of this.pool.values()) this.refresh(w, gained.has(w))
  }

  private createWindow(display: DisplayInfo): OverlayWindow {
    const index = this.numberOf(display.id)
    const w = new OverlayWindow(
      {
        key: this.nextKey++,
        display,
        index,
        title: this.titleOf(index),
        perf: perfEnabled()
      },
      this
    )
    this.pool.set(w.key, w)
    w.load()
    return w
  }

  /** Out of the pool; its widgets have no window until the next sync. */
  private removeWindow(w: OverlayWindow): void {
    if (this.pool.get(w.key) === w) this.pool.delete(w.key)
    for (const [id, owner] of this.owner) if (owner === w) this.owner.delete(id)
  }

  /** Repeated failures: no window for that display until one of its widgets is enabled again. */
  private giveUp(w: OverlayWindow): void {
    if (!this.owns(w)) return
    console.error(
      `[overlay] display ${w.index}: failed too often, giving up ` +
        '(hide and show one of its widgets from the tray to retry)'
    )
    this.givenUp.add(w.display.id)
    this.removeWindow(w)
    w.destroy()
  }

  private owns(w: OverlayWindow): boolean {
    return !this.disposed && this.pool.get(w.key) === w
  }

  private windowOf(sender: WebContents): OverlayWindow | undefined {
    for (const w of this.pool.values()) if (w.isSender(sender)) return w
    return undefined
  }

  // -------------------------------------------------------------------------
  // Layout, visibility, data
  // -------------------------------------------------------------------------

  private layoutOf(w: OverlayWindow, revision: number): OverlayLayout {
    return buildLayout({
      display: w.display,
      index: w.index,
      widgets: w.hosted,
      rects: this.rects,
      placements: this.placements,
      session: w.session,
      ackSeq: w.ackSeq,
      revision
    })
  }

  /** Sends a window its layout when it differs from the last one it got. */
  private pushLayout(w: OverlayWindow): void {
    // A loading document is not listening yet: IPC.init gives it the layout.
    if (w.destroyed || w.crashed || w.wc.isLoading()) return
    const next = this.layoutOf(w, 0)
    if (w.lastLayout && sameLayoutContent(w.lastLayout, next)) return
    next.revision = ++this.revision
    w.noteLayoutSent(next)
    w.send(IPC.layout, next)
  }

  private pushLayouts(): void {
    for (const w of this.pool.values()) this.pushLayout(w)
  }

  /**
   * A window's layout, visibility and mouse mode after anything changed; `handOver` also gives
   * it the latest payload of everything it hosts (it just became able to show them, or gained
   * a widget).
   */
  private refresh(w: OverlayWindow, handOver = false): void {
    if (w.destroyed) return
    this.pushLayout(w)
    this.syncShown(w)
    this.updateMode(w)
    if (handOver) this.handOver(w)
  }

  /** Not loading, crashed, hung, waiting for a display re-check or suspended. */
  private canReceive(w: OverlayWindow): boolean {
    return !this.suspended && w.healthy
  }

  private isShown(id: WidgetId): boolean {
    return widgetShown({
      userVisible: this.visible.get(id) === true,
      autoHidden: this.autoHidden.get(id)?.hidden === true,
      editing: this.editing
    })
  }

  private syncShown(w: OverlayWindow): void {
    const show =
      this.canReceive(w) && anyShown(w.hosted, (id) => this.isShown(id)) && !this.disposed
    if (show === w.isVisible()) return
    if (show) w.show()
    else w.hide()
  }

  private handOver(w: OverlayWindow): void {
    if (!this.canReceive(w)) return
    for (const id of w.hosted) {
      const last = this.payloads.latest(id)
      if (last && this.visible.get(id) === true) w.send(IPC.data, last)
    }
  }

  private broadcast(channel: string, value: unknown): void {
    for (const w of this.pool.values()) w.send(channel, value)
  }

  // -------------------------------------------------------------------------
  // Mouse
  // -------------------------------------------------------------------------

  private modeFor(w: OverlayWindow, cursor: Point | null): MouseMode {
    if (!this.editing || !this.canReceive(w) || !w.isVisible()) return 'ignore'
    return mouseMode({
      editing: true,
      healthy: true,
      dragging: w.dragUntil > performance.now(),
      current: w.mode,
      cursor: cursor ?? screen.getCursorScreenPoint(),
      panels: this.hitPanels(w)
    })
  }

  private updateMode(w: OverlayWindow, cursor: Point | null = null): void {
    if (w.applyMode(this.modeFor(w, cursor))) this.perf?.countModeChange()
  }

  /** Every window, with one cursor read. */
  private updateModes(): void {
    const cursor = this.editing ? screen.getCursorScreenPoint() : null
    for (const w of this.pool.values()) this.updateMode(w, cursor)
  }

  /** The shown panels of a window, topmost first (later WIDGET_IDS are drawn on top). */
  private hitPanels(w: OverlayWindow): HitPanel[] {
    const settings = this.opts.getSettings()
    const out: HitPanel[] = []
    for (let n = w.hosted.length - 1; n >= 0; n--) {
      const id = w.hosted[n]
      const rect = id !== undefined && this.isShown(id) ? this.rects.get(id) : undefined
      if (id !== undefined && rect) out.push({ rect, locked: settings.widgets[id].locked })
    }
    return out
  }

  private pollMouse(): void {
    if (!this.editing || this.disposed) return
    let anyVisible = false
    for (const w of this.pool.values()) anyVisible ||= w.isVisible()
    if (anyVisible) this.updateModes()
  }

  // -------------------------------------------------------------------------
  // Messages from the overlay windows
  // -------------------------------------------------------------------------

  /**
   * A panel changed in a window. Stale documents (another session) and repeats are ignored
   * without an acknowledgement; anything else is acknowledged (`OverlayLayout.ackSeq`), accepted
   * or not, so the renderer stops drawing it.
   */
  private readonly onCommitBounds = (event: IpcMainEvent, raw: unknown): void => {
    const msg = parseBoundsCommit(raw)
    const w = msg ? this.windowOf(event.sender) : undefined
    if (!msg || !w || msg.session !== w.session || msg.seq <= w.ackSeq) return
    w.ackSeq = msg.seq
    const id = msg.widget
    const out = decideCommit(msg, this.commitContext(w, id))
    if (out.accepted) {
      this.rects.set(id, out.rect)
      if (out.save === 'wheel') this.wheelSaves.restart(id)
      else if (out.save === 'fit') this.fitSaves.restart(id)
      else {
        // Saved whole right below: an older debounced save must not overwrite it.
        this.wheelSaves.cancel(id)
        this.fitSaves.cancel(id)
      }
      // Another display can mean another window (this one may even go away).
      if (msg.kind === 'drop-outside') this.syncWindows()
    }
    // A fit changes only main's copy of the height: nothing for the renderer to redraw.
    if (msg.kind !== 'fit') this.pushLayouts()
    if (out.accepted && out.save === 'now') this.saveRect(id)
  }

  private commitContext(w: OverlayWindow, id: WidgetId): CommitContext {
    return {
      editing: this.editing,
      hosted: this.owner.get(id) === w,
      prefs: this.opts.getSettings().widgets[id],
      def: WIDGET_DEFS[id],
      geometryRevision: w.geometryRevision,
      display: w.display,
      current: this.rects.get(id),
      dropTarget: () => {
        const cursor = screen.getCursorScreenPoint()
        const nearest = screen.getDisplayNearestPoint(cursor).id
        const target =
          this.displays.find((d) => d.id === nearest) ?? displayAtPoint(cursor, this.displays)
        return { cursor, target }
      }
    }
  }

  private readonly onScaleStep = (event: IpcMainEvent, raw: unknown): void => {
    const msg = parseScaleStep(raw)
    const w = msg ? this.windowOf(event.sender) : undefined
    if (!msg || !w || msg.session !== w.session) return
    if (acceptScaleStep(this.commitContext(w, msg.widget))) {
      this.opts.onScaleStep(msg.widget, msg.step)
    }
  }

  /** The drag lease: the window keeps the mouse while its renderer says a drag runs. */
  private readonly onDragState = (event: IpcMainEvent, raw: unknown): void => {
    const msg = parseDragState(raw)
    const w = msg ? this.windowOf(event.sender) : undefined
    if (!msg || !w || msg.session !== w.session || !this.editing) return
    w.dragUntil = msg.dragging ? performance.now() + DRAG_LEASE_MS : 0
    this.updateMode(w)
  }

  // -------------------------------------------------------------------------
  // Saves
  // -------------------------------------------------------------------------

  private saveRect(id: WidgetId): void {
    const rect = this.rects.get(id)
    if (rect) this.opts.onBoundsCommitted(id, { ...rect })
  }

  /**
   * Saves only the fitted height (bottom anchor: keeping the saved bottom edge). A widget
   * shown away from its saved place because its monitor is gone keeps that place.
   */
  private saveFit(id: WidgetId): void {
    const rect = this.rects.get(id)
    if (!rect) return
    const w = this.opts.getSettings().widgets[id]
    this.opts.onBoundsCommitted(id, fittedBounds(w.bounds, rect.height, w.anchor))
  }

  private flushSaves(): void {
    this.wheelSaves.flush()
    this.fitSaves.flush()
  }

  private flushSavesOf(id: WidgetId): void {
    if (this.wheelSaves.has(id)) {
      this.wheelSaves.cancel(id)
      this.saveRect(id)
    }
    if (this.fitSaves.has(id)) {
      this.fitSaves.cancel(id)
      this.saveFit(id)
    }
  }

  // -------------------------------------------------------------------------
  // Displays, power, GPU, z-order
  // -------------------------------------------------------------------------

  /** Hidden and click-through until the displays are checked again. */
  private markStale(w: OverlayWindow): void {
    w.stale = true
    w.dragUntil = 0
    this.updateMode(w)
    this.syncShown(w)
  }

  private readonly onDisplayAdded = (): void => {
    this.scheduleDisplaySync()
  }

  private readonly onDisplayRemoved = (_event: unknown, display: Display): void => {
    if (this.disposed) return
    for (const w of this.pool.values()) if (w.display.id === display.id) this.markStale(w)
    this.scheduleDisplaySync()
  }

  /** A work-area-only change (taskbar) hides nothing; a new size, scale or rotation does. */
  private readonly onDisplayMetricsChanged = (
    _event: unknown,
    display: Display,
    changed: string[]
  ): void => {
    if (this.disposed) return
    if (changed.some((m) => m === 'bounds' || m === 'scaleFactor' || m === 'rotation')) {
      for (const w of this.pool.values()) if (w.display.id === display.id) this.markStale(w)
    }
    this.scheduleDisplaySync()
  }

  private scheduleDisplaySync(): void {
    if (this.disposed) return
    if (this.displayTimer) clearTimeout(this.displayTimer)
    this.displayTimer = setTimeout(() => {
      this.displayTimer = null
      this.resyncDisplays(false)
    }, DISPLAY_CHANGE_DEBOUNCE_MS)
  }

  /**
   * Reads the displays again and re-places every widget from its saved bounds (so one returns
   * when its monitor does), then re-partitions and re-shows. Without `force`, nothing happens
   * when the displays did not change and no window waits for this.
   */
  private resyncDisplays(force: boolean): void {
    if (!this.started || this.disposed) return
    // Pending saves are written against the geometry they were made on.
    this.flushSaves()
    const all = screen.getAllDisplays()
    // A transient empty list (monitor switching): the next display event tries again.
    if (all.length === 0) return
    const next = all.map(displayInfo)
    const changed = !sameDisplays(this.displays, next)
    const waiting = [...this.pool.values()].some((w) => w.stale)
    if (!changed && !waiting && !force) return
    if (changed) {
      this.budget.clear()
      this.givenUp.clear()
    }
    this.setDisplays(next)
    const moved = this.placeAll(this.opts.getSettings())
    for (const w of this.pool.values()) w.stale = false
    this.syncWindows(moved)
    for (const w of this.pool.values()) {
      w.invalidate()
      // Data was not delivered while it waited (stale, suspended).
      this.handOver(w)
    }
    this.guardAll()
  }

  private readonly onSuspend = (): void => {
    if (this.disposed) return
    this.suspended = true
    // A resume resync still pending would show the windows again.
    if (this.recovery?.resume && !this.recovery.recreate) {
      clearTimeout(this.recovery.timer)
      this.recovery = null
    }
    for (const w of this.pool.values()) w.dragUntil = 0
    this.updateModes()
    for (const w of this.pool.values()) this.syncShown(w)
  }

  private readonly onResume = (): void => {
    this.scheduleRecovery(false, true, RESUME_DEBOUNCE_MS)
  }

  private readonly onChildProcessGone = (_event: unknown, details: { type: string }): void => {
    if (this.disposed || details.type !== 'GPU') return
    console.error('[overlay] GPU process gone: hiding every overlay window')
    for (const w of this.pool.values()) this.markStale(w)
    this.scheduleRecovery(true, false, GPU_RECREATE_DELAY_MS)
  }

  /** One recovery timer: a GPU loss and a resume merge into recreate + resync. */
  private scheduleRecovery(recreate: boolean, resume: boolean, delayMs: number): void {
    if (this.disposed || !this.started) return
    const prev = this.recovery
    if (prev) clearTimeout(prev.timer)
    const next: Recovery = {
      recreate: recreate || prev?.recreate === true,
      resume: resume || prev?.resume === true,
      timer: setTimeout(() => {
        this.recovery = null
        this.recover(next.recreate, next.resume)
      }, delayMs)
    }
    this.recovery = next
  }

  private recover(recreate: boolean, resume: boolean): void {
    if (this.disposed) return
    if (resume) this.suspended = false
    if (recreate) {
      const now = performance.now()
      for (const w of [...this.pool.values()]) {
        if (!this.budget.record(w.display.id, now)) this.givenUp.add(w.display.id)
        this.removeWindow(w)
        w.destroy()
      }
    }
    this.resyncDisplays(true)
    // The new GPU process reports its status once it has drawn a window (onLoaded).
    if (recreate) this.gpuLogPending = true
  }

  /** Software compositing copies a whole-display surface with the CPU on every frame. */
  private logGpuCompositing(): void {
    const status = app.getGPUFeatureStatus().gpu_compositing
    console.log(`[overlay] GPU compositing: ${status}`)
    if (!status.startsWith('enabled') && !this.gpuWarned) {
      this.gpuWarned = true
      console.warn('[overlay] GPU compositing is off: every overlay frame is copied by the CPU')
    }
  }

  private guardAll(): void {
    for (const w of this.pool.values()) w.guard()
  }

  /** Every Z_ORDER_INTERVAL_MS: z-order, mouse mode and bounds, and a liveness probe. */
  private tick(): void {
    this.guardAll()
    const now = performance.now()
    for (const w of this.pool.values()) w.probe(now)
  }
}

function displayInfo(d: Display): DisplayInfo {
  return {
    id: d.id,
    bounds: { ...d.bounds },
    workArea: { ...d.workArea },
    scaleFactor: d.scaleFactor
  }
}
