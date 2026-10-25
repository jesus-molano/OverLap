import { BrowserWindow, app, type WebContents } from 'electron'
import { join } from 'node:path'
import { DEFAULT_LANGUAGE, messagesFor, type Language } from '@shared/i18n'
import iconPath from '../../resources/icon.png?asset'

// Unlike the widgets, this is a normal framed, focusable window: it only ever
// opens on an explicit user action (tray menu), so taking focus is expected.
let win: BrowserWindow | null = null
/** settings.appearance.language, for the title bar (see setSettingsWindowLanguage). */
let language: Language = DEFAULT_LANGUAGE

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

/** Opens the settings window, or brings the existing one to the front. */
export function openSettingsWindow(): void {
  if (win && !win.isDestroyed()) {
    // Still loading: 'ready-to-show' shows it. A failed load is shown anyway so it can be closed.
    if (!win.isVisible() && win.webContents.isLoading()) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
    return
  }
  win = createWindow()
}

/** True when `sender` is the settings window's renderer. */
export function isSettingsSender(sender: WebContents): boolean {
  return win !== null && !win.isDestroyed() && win.webContents.id === sender.id
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

function createWindow(): BrowserWindow {
  const w = new BrowserWindow({
    // Room for the sidebar plus a live sample at the default standings width (540 px).
    width: 880,
    height: 760,
    minWidth: 560,
    minHeight: 520,
    center: true,
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
    if (!w.isDestroyed()) w.destroy()
  })
  w.on('closed', () => {
    if (win === w) win = null
  })

  const devUrl = process.env.ELECTRON_RENDERER_URL
  const loading =
    !app.isPackaged && devUrl
      ? w.loadURL(withViewParam(devUrl))
      : w.loadFile(join(__dirname, '../renderer/index.html'), { query: { view: 'settings' } })
  loading.catch((err: unknown) => {
    if (!w.isDestroyed()) console.error('[settings-window] could not load the renderer', err)
  })
  return w
}

function withViewParam(base: string): string {
  const url = new URL(base)
  url.searchParams.set('view', 'settings')
  return url.toString()
}
