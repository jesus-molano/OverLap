import { BrowserWindow, app, screen, type Rectangle, type WebContents } from 'electron'
import { join } from 'node:path'
import { DEFAULT_LANGUAGE, messagesFor, type Language } from '@shared/i18n'
import { IPC, type SettingsWindowPage } from '@shared/ipc'
import iconPath from '../../resources/icon.png?asset'

// Unlike the widgets, this is a normal framed, focusable window: it only ever
// opens on an explicit user action (tray menu), so taking focus is expected.
let win: BrowserWindow | null = null
/** settings.appearance.language, for the title bar (see setSettingsWindowLanguage). */
let language: Language = DEFAULT_LANGUAGE
let inactiveListener: (() => void) | null = null

/**
 * `listener` runs whenever the settings window stops being where the user types: it loses
 * focus, hides, closes, reloads or its renderer dies (main ends a shortcut capture then).
 */
export function onSettingsWindowInactive(listener: (() => void) | null): void {
  inactiveListener = listener
}

function notifyInactive(): void {
  inactiveListener?.()
}

/** 'OverLap — Ajustes' in `lang`. */
export function settingsWindowTitle(lang: Language): string {
  return messagesFor(lang).core.windowTitles.settings
}

/**
 * The interface language: the title of the window (open now or opened later)
 * follows it at once. Main calls it on start and on every settings change.
 */
export function setSettingsWindowLanguage(lang: Language): void {
  if (lang === language) return
  language = lang
  if (win && !win.isDestroyed()) win.setTitle(settingsWindowTitle(lang))
}

/**
 * Opens the settings window, or brings the existing one to the front; on `page` when given (the
 * window shows the page it showed last otherwise).
 */
export function openSettingsWindow(page?: SettingsWindowPage): void {
  if (win && !win.isDestroyed()) {
    // Still loading: 'ready-to-show' shows it. A failed load is shown anyway so it can be closed.
    if (!win.isVisible() && win.webContents.isLoading()) {
      // Its page may not listen yet: loaded again, asking for that page in the URL.
      if (page !== undefined) loadRenderer(win, page)
      return
    }
    if (page !== undefined) sendToSettingsWindow(IPC.settingsPage, page)
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
    return
  }
  win = createWindow(page)
}

/** The settings window is open and has the keyboard focus. */
export function isSettingsWindowFocused(): boolean {
  return win !== null && !win.isDestroyed() && win.isFocused()
}

/** True when `sender` is the settings window's renderer. */
export function isSettingsSender(sender: WebContents): boolean {
  return win !== null && !win.isDestroyed() && win.webContents.id === sender.id
}

/** The settings window while it is open (the parent of its file dialogs), else null. */
export function openSettingsWindowHandle(): BrowserWindow | null {
  return win && !win.isDestroyed() ? win : null
}

/** Sends to the settings window if it is open (no-op otherwise). */
export function sendToSettingsWindow(channel: string, value: unknown): void {
  if (!win || win.isDestroyed()) return
  const wc = win.webContents
  if (!wc.isDestroyed()) wc.send(channel, value)
}

export function destroySettingsWindow(): void {
  if (win && !win.isDestroyed()) win.destroy()
  win = null
}

export interface SettingsWindowSize {
  readonly width: number
  readonly height: number
  readonly minWidth: number
  readonly minHeight: number
}

/** Room for the sidebar plus a live sample at the default standings width (540 px). */
const BASE = { width: 880, height: 760, minWidth: 560, minHeight: 520 } as const
/** A taller screen (1440p, ultrawide) opens it taller, up to this. */
const TALLEST = 960
/** Share of the work area's height it opens at, between the base height and TALLEST. */
const HEIGHT_SHARE = 0.72
/** Kept clear around it, so it never opens past the work area (a small or scaled screen). */
const MARGIN = 24

/**
 * The opening size in `workArea` (the primary display's): 880 x 760 on a 1080p screen, taller on
 * a taller one (the preview and the options both gain), never larger than the work area, its
 * minimum never above that. Maximising it is the page's to use (settings.css: two option
 * columns, and on an ultrawide the page capped and centred). Pure.
 */
export function settingsWindowSize(
  workArea: Pick<Rectangle, 'width' | 'height'>
): SettingsWindowSize {
  // An unknown side (0, NaN) reads as the 1080p work area.
  const areaW = workArea.width > 0 ? workArea.width : 1920
  const areaH = workArea.height > 0 ? workArea.height : 1040
  const roomW = Math.max(1, Math.floor(areaW) - 2 * MARGIN)
  const roomH = Math.max(1, Math.floor(areaH) - 2 * MARGIN)
  const tall = Math.min(TALLEST, Math.max(BASE.height, Math.round(areaH * HEIGHT_SHARE)))
  const width = Math.min(BASE.width, roomW)
  const height = Math.min(tall, roomH)
  return {
    width,
    height,
    minWidth: Math.min(BASE.minWidth, width),
    minHeight: Math.min(BASE.minHeight, height)
  }
}

function primaryWorkArea(): Pick<Rectangle, 'width' | 'height'> {
  try {
    return screen.getPrimaryDisplay().workArea
  } catch {
    return { width: 1920, height: 1040 }
  }
}

function createWindow(page: SettingsWindowPage | undefined): BrowserWindow {
  const w = new BrowserWindow({
    ...settingsWindowSize(primaryWorkArea()),
    center: true,
    maximizable: true,
    title: settingsWindowTitle(language),
    icon: iconPath,
    show: false,
    resizable: true,
    autoHideMenuBar: true,
    // settings.css --st-bg: no flash of another colour while the page loads.
    backgroundColor: '#101216',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      devTools: !app.isPackaged
    }
  })
  const wc = w.webContents

  wc.on('will-navigate', (event) => event.preventDefault())
  wc.on('will-attach-webview', (event) => event.preventDefault())
  wc.setWindowOpenHandler(() => ({ action: 'deny' }))
  // Keep the fixed title instead of the page's <title>.
  w.on('page-title-updated', (event) => event.preventDefault())

  w.once('ready-to-show', () => {
    if (!w.isDestroyed()) w.show()
  })
  wc.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (isMainFrame) console.error(`[settings-window] load failed (${code} ${description}) ${url}`)
  })
  // Reopening from the tray creates a fresh one.
  wc.on('render-process-gone', (_event, details) => {
    console.error(`[settings-window] renderer gone (${details.reason})`)
    notifyInactive()
    if (!w.isDestroyed()) w.destroy()
  })
  // A page that is not there, or not in front, cannot be recording keys.
  w.on('blur', notifyInactive)
  w.on('hide', notifyInactive)
  wc.on('did-start-loading', notifyInactive)
  w.on('closed', () => {
    if (win === w) win = null
    notifyInactive()
  })

  loadRenderer(w, page)
  return w
}

/** `?view=settings`, and `&page=` to open on a page instead of the one shown last. */
function loadRenderer(w: BrowserWindow, page: SettingsWindowPage | undefined): void {
  const query: Record<string, string> = { view: 'settings' }
  if (page !== undefined) query.page = page
  const devUrl = process.env.ELECTRON_RENDERER_URL
  const loading =
    !app.isPackaged && devUrl
      ? w.loadURL(withQuery(devUrl, query))
      : w.loadFile(join(__dirname, '../renderer/index.html'), { query })
  loading.catch((err: unknown) => {
    if (!w.isDestroyed()) console.error('[settings-window] could not load the renderer', err)
  })
}

function withQuery(base: string, query: Record<string, string>): string {
  const url = new URL(base)
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
  return url.toString()
}
