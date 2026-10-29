import { BrowserWindow, app, screen } from 'electron'
import { join } from 'node:path'
import { IPC, type OsdMessage } from '@shared/ipc'

/** How long the confirmation stays over the game. */
export const OSD_SHOW_MS = 1_800
/** Its window: the pill is drawn in the middle, the rest is transparent. */
const SIZE = { width: 520, height: 84 } as const
/** Below the top edge of the primary display's work area. */
const TOP_GAP = 36

/**
 * The short confirmation over the game when a shortcut runs (R37: «Overlay oculto»,
 * «Disposición: GT3», «Solo hay una disposición»). Like the overlay windows: transparent,
 * frameless, click-through, never focusable (WS_EX_NOACTIVATE), not in the taskbar or Alt+Tab,
 * shown with showInactive only, so it never takes the focus from the sim. Made the first time it
 * is needed, at the top centre of the primary display; hidden again after OSD_SHOW_MS.
 */
export class OsdWindow {
  private win: BrowserWindow | null = null
  private ready = false
  private pending: OsdMessage | null = null
  private hideTimer: ReturnType<typeof setTimeout> | undefined

  show(msg: OsdMessage): void {
    const w = this.window()
    if (!w) return
    this.place(w)
    if (!this.ready) {
      // Shown once its page listens (did-finish-load).
      this.pending = msg
      return
    }
    this.present(w, msg)
  }

  dispose(): void {
    clearTimeout(this.hideTimer)
    if (this.win && !this.win.isDestroyed()) this.win.destroy()
    this.win = null
  }

  private present(w: BrowserWindow, msg: OsdMessage): void {
    if (w.isDestroyed()) return
    w.webContents.send(IPC.osd, msg)
    if (!w.isVisible()) w.showInactive()
    clearTimeout(this.hideTimer)
    this.hideTimer = setTimeout(() => {
      if (!w.isDestroyed()) w.hide()
    }, OSD_SHOW_MS)
  }

  private place(w: BrowserWindow): void {
    try {
      const area = screen.getPrimaryDisplay().workArea
      w.setBounds({
        x: Math.round(area.x + (area.width - SIZE.width) / 2),
        y: area.y + TOP_GAP,
        width: SIZE.width,
        height: SIZE.height
      })
    } catch {
      // No display information: it stays where it was.
    }
  }

  private window(): BrowserWindow | null {
    if (this.win && !this.win.isDestroyed()) return this.win
    try {
      this.win = this.create()
    } catch (err) {
      console.error('[osd] could not create the window', err)
      this.win = null
    }
    return this.win
  }

  private create(): BrowserWindow {
    this.ready = false
    const w = new BrowserWindow({
      ...SIZE,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      focusable: false,
      skipTaskbar: true,
      type: 'toolbar',
      hasShadow: false,
      roundedCorners: false,
      title: 'OverLap',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false,
        devTools: !app.isPackaged,
        zoomFactor: 1
      }
    })
    w.setIgnoreMouseEvents(true)
    w.setAlwaysOnTop(true, 'screen-saver')
    const wc = w.webContents
    wc.on('will-navigate', (event) => event.preventDefault())
    wc.setWindowOpenHandler(() => ({ action: 'deny' }))
    wc.on('did-finish-load', () => {
      this.ready = true
      const msg = this.pending
      this.pending = null
      if (msg) this.present(w, msg)
    })
    wc.on('render-process-gone', () => {
      if (!w.isDestroyed()) w.destroy()
    })
    w.on('closed', () => {
      if (this.win === w) this.win = null
    })
    const devUrl = process.env.ELECTRON_RENDERER_URL
    const loading =
      !app.isPackaged && devUrl
        ? w.loadURL(`${devUrl}${devUrl.includes('?') ? '&' : '?'}view=osd`)
        : w.loadFile(join(__dirname, '../renderer/index.html'), { query: { view: 'osd' } })
    loading.catch((err: unknown) => console.error('[osd] could not load', err))
    return w
  }
}
