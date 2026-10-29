import { BrowserWindow, app, type WebContents } from 'electron'
import { join } from 'node:path'
import type { OverlayLayout } from '@shared/ipc'
import { rectsEqual } from '@shared/settings'
import type { Rect } from '@shared/types'
import type { WidgetId } from '@shared/widgets'
import { ignoreArgs, type MouseMode } from './mouseMode'
import { boundsDrift, hostWindowBounds, sameGeometry, type DisplayInfo } from './overlayLayout'

/** A hung renderer is killed (and reloaded through the crash path) after this long. */
export const UNRESPONSIVE_KILL_MS = 10_000
/** A renderer that does not run a no-op script for this long is treated as hung. */
export const PROBE_TIMEOUT_MS = 5_000
/** setBounds is retried this often per target rect when Windows does not keep it. */
export const BOUNDS_GUARD_MAX_TRIES = 3
/** Chromium's net::ERR_ABORTED: a load superseded by another one, not a failure. */
const ERR_ABORTED = -3

/** What an overlay window reports to its manager. */
export interface OverlayWindowHost {
  /** A (re)load started: a new document, with a new session, is on its way. */
  onLoadStart(w: OverlayWindow): void
  /**
   * 'ready-to-show', 'did-finish-load' or 'did-stop-loading': the document may be able to show
   * now (`w.loaded`).
   */
  onLoaded(w: OverlayWindow): void
  /** The renderer is gone or the page failed to load (the window is already hidden). */
  onCrash(w: OverlayWindow, reason: string): void
  /** The renderer stopped answering (the window is already hidden and click-through). */
  onUnresponsive(w: OverlayWindow): void
  onResponsive(w: OverlayWindow): void
  /** The native window is gone. */
  onClosed(w: OverlayWindow): void
}

export interface OverlayWindowInit {
  /** Stable key of this window in the manager's pool. */
  key: number
  display: DisplayInfo
  /** 1-based display number. */
  index: number
  title: string
  /** `?perf=1`: the renderer's perf probe; console lines are forwarded either way in dev. */
  perf: boolean
}

/**
 * One transparent, frameless, click-through, non-focusable, always-on-top window covering a
 * display. It must never take focus from the sim: no show(), focus(), restore() or
 * setFocusable(true), only showInactive(). Holds this window's own state (document session,
 * acknowledged commits, drag lease, mouse mode, health); the manager decides what it hosts,
 * when it shows and which mouse mode it gets.
 */
export class OverlayWindow {
  readonly key: number
  display: DisplayInfo
  index: number
  readonly win: BrowserWindow
  readonly wc: WebContents
  /** Hosted widgets, WIDGET_IDS order (set by the manager). */
  hosted: WidgetId[] = []
  /** This document's load number: bumped on every 'did-start-loading'. */
  session = 0
  /** Last `BoundsCommit.seq` processed from this document. */
  ackSeq = 0
  /** Drag and wheel commits computed against an older layout revision are rejected. */
  geometryRevision = 0
  /** The drag lease runs until then (performance.now() ms; 0: none). */
  dragUntil = 0
  /** Last layout sent to this document (null: none since it started loading). */
  lastLayout: OverlayLayout | null = null
  /** The renderer is gone or the page failed to load, until the next successful load. */
  crashed = false
  unresponsive = false
  /**
   * Hidden until the manager re-checks the displays: its display changed geometry or went
   * away, or the GPU process was lost. The surface may be garbage until then.
   */
  stale = false
  private readonly wcId: number
  private readonly host: OverlayWindowHost
  private readonly perf: boolean
  private readyToShow = false
  private loadFailed = false
  private appliedMode: MouseMode | null = null
  private geometryPending = false
  private reloadTimer: ReturnType<typeof setTimeout> | null = null
  private killTimer: ReturnType<typeof setTimeout> | null = null
  /** performance.now() when the unanswered liveness probe was sent (0: none). */
  private probeSince = 0
  private guardTarget: Rect | null = null
  private guardTries = 0
  private guardLogged = false

  constructor(init: OverlayWindowInit, host: OverlayWindowHost) {
    this.key = init.key
    this.display = init.display
    this.index = init.index
    this.host = host
    this.perf = init.perf
    const b = hostWindowBounds(init.display)
    this.win = new BrowserWindow({
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      title: init.title,
      show: false,
      frame: false,
      transparent: true,
      // Moved and sized with setBounds only: transparent + resizable has a long regression
      // history on Windows.
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
      roundedCorners: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        // Keep rAF and animations at full rate although the window is never focused.
        backgroundThrottling: false,
        spellcheck: false,
        devTools: !app.isPackaged,
        // 1 CSS px = 1 DIP: the layout's coordinates are DIP.
        zoomFactor: 1
      }
    })
    this.wc = this.win.webContents
    this.wcId = this.wc.id
    this.applyMode('ignore', true)
    // The constructor's alwaysOnTop means 'floating', which sits below the taskbar on Windows.
    this.win.setAlwaysOnTop(true, 'screen-saver')
    this.listen()
  }

  get destroyed(): boolean {
    return this.win.isDestroyed()
  }

  /** The window's page is loaded, painted once and alive: it can take data and be shown. */
  get loaded(): boolean {
    if (this.destroyed || this.wc.isDestroyed()) return false
    return this.readyToShow && !this.crashed && !this.wc.isLoading() && !this.wc.isCrashed()
  }

  /** Loaded, responsive and not waiting for a display re-check. */
  get healthy(): boolean {
    return this.loaded && !this.unresponsive && !this.stale
  }

  /** The mode applied now. */
  get mode(): MouseMode {
    return this.appliedMode ?? 'ignore'
  }

  isVisible(): boolean {
    return !this.destroyed && this.win.isVisible()
  }

  /** True when `sender` is this window's renderer. */
  isSender(sender: WebContents): boolean {
    return !this.destroyed && sender.id === this.wcId
  }

  /** Loads `?view=overlay` (`&perf=1`): dev server in development, the built page otherwise. */
  load(): void {
    const query: Record<string, string> = { view: 'overlay' }
    if (this.perf) query.perf = '1'
    const devUrl = process.env.ELECTRON_RENDERER_URL
    const loading =
      !app.isPackaged && devUrl
        ? this.win.loadURL(withQuery(devUrl, query))
        : this.win.loadFile(join(__dirname, '../renderer/index.html'), { query })
    loading.catch((err: unknown) => {
      // did-fail-load handles the retry.
      if (!this.destroyed) console.error(`[overlay] ${this.label}: could not load`, err)
    })
  }

  /**
   * Nothing goes to a renderer process that is gone (Electron logs an error for every such send);
   * the reloaded document gets the whole state from IPC.init. A document that is loading again
   * runs in a live process and still gets everything.
   */
  send(channel: string, value: unknown): void {
    if (!this.destroyed && !this.wc.isDestroyed() && !this.wc.isCrashed()) {
      this.wc.send(channel, value)
    }
  }

  /**
   * Applies a mouse mode; true when it changed. `force` re-applies it (idempotent): after a
   * show and from the guard, in case Windows or Electron reset the window styles.
   */
  applyMode(mode: MouseMode, force = false): boolean {
    if (this.destroyed) return false
    const prev = this.appliedMode
    const changed = mode !== prev
    if (!changed && !force) return false
    this.appliedMode = mode
    const [ignore, options] = ignoreArgs(mode)
    if (options) this.win.setIgnoreMouseEvents(ignore, options)
    else this.win.setIgnoreMouseEvents(ignore)
    // Not for the very first call: every window starts click-through.
    if (changed && prev !== null) console.log(`[overlay] ${this.label}: mouse ${mode}`)
    return changed
  }

  /**
   * On screen without activating it, above the game, with its mouse mode re-applied and on its
   * display rect (a window created or moved across displays of another scale can be off).
   */
  show(): void {
    if (this.destroyed) return
    this.win.showInactive()
    // Back to full rate only once shown: see hide().
    this.setThrottled(false)
    this.win.setAlwaysOnTop(true, 'screen-saver')
    this.win.moveTop()
    this.applyMode(this.mode, true)
    this.keepBounds()
  }

  /**
   * Throttled while hidden. Measured on Electron 44 / Windows 11: with backgroundThrottling off,
   * Chromium does not show its input child window (Chrome_RenderWidgetHostHWND) again after a
   * hide() and showInactive(), so every press lands on the non-focusable top-level window, which
   * answers WM_MOUSEACTIVATE with MA_NOACTIVATEANDEAT: Windows drops every click (drags, eye,
   * padlock) until the window is recreated. Throttled while it hides, the child comes back.
   */
  hide(): void {
    if (!this.isVisible()) return
    this.setThrottled(true)
    this.win.hide()
  }

  private setThrottled(throttled: boolean): void {
    if (!this.wc.isDestroyed()) this.wc.setBackgroundThrottling(throttled)
  }

  setTitle(title: string): void {
    if (!this.destroyed) this.win.setTitle(title)
  }

  /**
   * Covers `display` from now on (a reassigned window, or its display changed). True when the
   * geometry changed: the window is moved, and commits computed before the next layout sent are
   * rejected.
   */
  moveTo(display: DisplayInfo, index: number, title: string): boolean {
    const moved = !sameGeometry(this.display, display)
    const renumbered = index !== this.index
    this.display = display
    this.index = index
    if (renumbered) this.setTitle(title)
    if (!moved || this.destroyed) return moved
    this.win.setBounds(hostWindowBounds(display))
    this.geometryPending = true
    this.geometryRevision = Number.MAX_SAFE_INTEGER
    this.guardTarget = null
    return true
  }

  /** `layout` was sent to (or returned to) this document. */
  noteLayoutSent(layout: OverlayLayout): void {
    this.lastLayout = layout
    if (this.geometryPending) {
      this.geometryPending = false
      this.geometryRevision = layout.revision
    }
  }

  /**
   * Every few seconds while visible: back on top (some games re-assert their z-order), the
   * mouse mode re-applied, and the window back on its display rect if something moved it (at
   * most BOUNDS_GUARD_MAX_TRIES times per target, so a rect Windows never accepts cannot make
   * it resize forever).
   */
  guard(): void {
    if (!this.isVisible()) return
    if (!this.win.isAlwaysOnTop()) this.win.setAlwaysOnTop(true, 'screen-saver')
    this.win.moveTop()
    this.applyMode(this.mode, true)
    this.keepBounds()
  }

  private keepBounds(): void {
    const want = hostWindowBounds(this.display)
    const got = this.win.getBounds()
    if (!boundsDrift(got, want)) return
    if (!this.guardTarget || !rectsEqual(this.guardTarget, want)) {
      this.guardTarget = want
      this.guardTries = 0
      this.guardLogged = false
    }
    if (this.guardTries < BOUNDS_GUARD_MAX_TRIES) {
      this.guardTries++
      this.win.setBounds(want)
    } else if (!this.guardLogged) {
      this.guardLogged = true
      console.warn(`[overlay] ${this.label}: bounds stuck at ${fmt(got)}, want ${fmt(want)}`)
    }
  }

  /** Hidden and click-through at once; the lease and a pending kill are dropped. */
  markCrashed(): void {
    this.crashed = true
    this.unresponsive = false
    this.dragUntil = 0
    this.clearKillTimer()
    this.applyMode('ignore')
    this.hide()
  }

  /** Reloads the page after `delayMs`; `onFail` when reloading throws. */
  scheduleReload(delayMs: number, onFail: (err: unknown) => void): void {
    this.clearReloadTimer()
    this.reloadTimer = setTimeout(() => {
      this.reloadTimer = null
      if (this.destroyed) return
      try {
        this.wc.reload()
      } catch (err) {
        onFail(err)
      }
    }, delayMs)
  }

  /**
   * Liveness check, every guard tick. Chromium reports a hang only when input events go
   * unanswered, and a click-through overlay gets no input outside edit mode: so main asks the
   * renderer to run a no-op script, and one still unanswered after PROBE_TIMEOUT_MS counts as
   * 'unresponsive' (hidden, killed later). Any answer counts as 'responsive' again.
   */
  probe(now: number): void {
    if (!this.loaded) return
    if (this.probeSince === 0) {
      const session = this.session
      this.probeSince = now
      this.wc.executeJavaScript('0').then(
        () => this.answered(session),
        // The document went away (reload, crash): the next session probes again.
        () => this.answered(session)
      )
    } else if (now - this.probeSince >= PROBE_TIMEOUT_MS) {
      if (!this.unresponsive) console.warn(`[overlay] ${this.label}: renderer does not answer`)
      this.becomeUnresponsive()
    }
  }

  /** Repaints the whole surface (after a resume or a display change). */
  invalidate(): void {
    if (!this.destroyed && !this.wc.isDestroyed()) this.wc.invalidate()
  }

  /** Click-through, then gone; its timers too. Never recreated by itself. */
  destroy(): void {
    this.clearReloadTimer()
    this.clearKillTimer()
    if (this.destroyed) return
    this.applyMode('ignore')
    this.win.destroy()
  }

  private get label(): string {
    return `display ${this.index}`
  }

  private listen(): void {
    const { win, wc } = this
    wc.on('will-navigate', (event) => event.preventDefault())
    wc.on('will-attach-webview', (event) => event.preventDefault())
    wc.setWindowOpenHandler(() => ({ action: 'deny' }))
    // Main owns the title (what OBS window capture lists), not the page's <title>.
    win.on('page-title-updated', (event) => event.preventDefault())

    wc.on('did-start-loading', () => {
      this.session++
      this.ackSeq = 0
      this.dragUntil = 0
      this.lastLayout = null
      this.loadFailed = false
      this.unresponsive = false
      this.probeSince = 0
      this.clearKillTimer()
      this.host.onLoadStart(this)
    })
    wc.on('did-finish-load', () => {
      if (!this.loadFailed) this.crashed = false
      // Nothing zooms an overlay: 1 CSS px stays 1 DIP whatever Chromium remembers per origin.
      wc.setZoomFactor(1)
      wc.setVisualZoomLevelLimits(1, 1).catch(() => {})
      this.host.onLoaded(this)
    })
    // Electron fires 'did-finish-load' while isLoading() is still true, so `loaded` is false
    // there; after a reload (crash, hang, failed load) no 'ready-to-show' follows, and without
    // this the window would stay hidden. Loading has stopped here.
    wc.on('did-stop-loading', () => this.host.onLoaded(this))
    win.once('ready-to-show', () => {
      if (this.destroyed) return
      this.readyToShow = true
      this.host.onLoaded(this)
      if (!app.isPackaged && process.env.OVERLAY_DEVTOOLS === '1') {
        wc.openDevTools({ mode: 'detach', activate: false })
      }
    })
    wc.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
      if (!isMainFrame || code === ERR_ABORTED) return
      console.error(`[overlay] ${this.label}: load failed (${code} ${description}) ${url}`)
      this.loadFailed = true
      this.markCrashed()
      this.host.onCrash(this, `load failed (${code})`)
    })
    wc.on('render-process-gone', (_event, details) => {
      this.markCrashed()
      this.host.onCrash(this, details.reason)
    })
    win.on('unresponsive', () => this.becomeUnresponsive())
    win.on('responsive', () => this.becomeResponsive())
    win.on('closed', () => {
      this.clearReloadTimer()
      this.clearKillTimer()
      this.host.onClosed(this)
    })
    if (this.perf || !app.isPackaged) {
      wc.on('console-message', (details) => {
        const line = `[overlay:${this.index}] ${details.message}`
        if (details.level === 'error') console.error(line)
        else if (details.level === 'warning') console.warn(line)
        else console.log(line)
      })
    }
  }

  /** Hidden and click-through; killed (then reloaded as a crash) if it does not recover. */
  private becomeUnresponsive(): void {
    if (this.unresponsive || this.crashed || this.destroyed) return
    this.unresponsive = true
    this.dragUntil = 0
    this.applyMode('ignore')
    this.hide()
    this.clearKillTimer()
    this.killTimer = setTimeout(() => {
      this.killTimer = null
      if (this.unresponsive && !this.destroyed) {
        console.error(`[overlay] ${this.label}: still unresponsive, killing the renderer`)
        this.wc.forcefullyCrashRenderer()
      }
    }, UNRESPONSIVE_KILL_MS)
    this.host.onUnresponsive(this)
  }

  private becomeResponsive(): void {
    if (!this.unresponsive) return
    this.unresponsive = false
    this.clearKillTimer()
    this.host.onResponsive(this)
  }

  private answered(session: number): void {
    if (session !== this.session) return
    this.probeSince = 0
    this.becomeResponsive()
  }

  private clearReloadTimer(): void {
    if (this.reloadTimer) clearTimeout(this.reloadTimer)
    this.reloadTimer = null
  }

  private clearKillTimer(): void {
    if (this.killTimer) clearTimeout(this.killTimer)
    this.killTimer = null
  }
}

function fmt(r: Rect): string {
  return `${r.x},${r.y} ${r.width}x${r.height}`
}

function withQuery(base: string, query: Record<string, string>): string {
  const url = new URL(base)
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
  return url.toString()
}
