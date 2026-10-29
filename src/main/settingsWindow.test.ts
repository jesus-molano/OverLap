import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FakeBrowserWindow,
  FakeWebContents,
  fakeApp,
  fakeEvent,
  fakeScreen,
  resetFakeElectron
} from './testing/fakeElectron'
import {
  destroySettingsWindow,
  isSettingsSender,
  isSettingsWindowFocused,
  onSettingsWindowInactive,
  openSettingsWindow,
  sendToSettingsWindow,
  setSettingsWindowLanguage,
  settingsWindowSize
} from './settingsWindow'

vi.mock('electron', async () => (await import('./testing/fakeElectron')).electronModule)
vi.mock('../../resources/icon.png?asset', () => ({ default: 'icon.png' }))

function only(): FakeBrowserWindow {
  expect(FakeBrowserWindow.all).toHaveLength(1)
  return FakeBrowserWindow.all[0] as FakeBrowserWindow
}

beforeEach(() => resetFakeElectron())

afterEach(() => {
  onSettingsWindowInactive(null)
  destroySettingsWindow()
  setSettingsWindowLanguage('es')
  vi.unstubAllEnvs()
})

describe('settings window', () => {
  it('is a normal, sandboxed window loaded with ?view=settings and shown when ready', () => {
    openSettingsWindow()
    const w = only()
    expect(w.options).toMatchObject({
      title: 'OverLap — Ajustes',
      show: false,
      resizable: true,
      autoHideMenuBar: true,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
    })
    expect(w.options.focusable).not.toBe(false)
    expect(w.options.frame).not.toBe(false)
    expect(w.loadFile).toHaveBeenCalledWith(expect.stringMatching(/renderer[\\/]index\.html$/), {
      query: { view: 'settings' }
    })
    expect(w.show).not.toHaveBeenCalled()
    w.becomeReady()
    expect(w.show).toHaveBeenCalledOnce()
  })

  it("opens on the page's own background colour, so it never flashes another one", () => {
    const css = readFileSync(
      new URL('../renderer/src/settings/settings.css', import.meta.url),
      'utf8'
    )
    const pageBg = /--st-bg:\s*(#[0-9a-f]{6})\s*;/i.exec(css)?.[1]
    openSettingsWindow()
    expect(pageBg).toBeDefined()
    expect(only().options.backgroundColor).toBe(pageBg)
  })

  it('loads the dev server URL in development', () => {
    fakeApp.isPackaged = false
    vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5173/')
    openSettingsWindow()
    expect(only().loadURL).toHaveBeenCalledWith('http://localhost:5173/?view=settings')
  })

  it('keeps a single window and brings it to the front', () => {
    openSettingsWindow()
    openSettingsWindow()
    const w = only()
    expect(w.show).not.toHaveBeenCalled()
    w.becomeReady()
    w.minimized = true
    openSettingsWindow()
    expect(FakeBrowserWindow.all).toHaveLength(1)
    expect(w.restore).toHaveBeenCalledOnce()
    expect(w.focus).toHaveBeenCalledOnce()
  })

  it('opens on a page: in the URL of a new window, asked of an open one', () => {
    openSettingsWindow('layouts')
    const w = only()
    expect(w.loadFile).toHaveBeenCalledExactlyOnceWith(expect.any(String), {
      query: { view: 'settings', page: 'layouts' }
    })
    // Still loading (its page may not listen yet): loaded again, the page in the URL.
    openSettingsWindow('layouts')
    expect(w.loadFile).toHaveBeenCalledTimes(2)
    expect(w.webContents.send).not.toHaveBeenCalled()
    w.becomeReady()
    openSettingsWindow('layouts')
    expect(w.loadFile).toHaveBeenCalledTimes(2)
    expect(w.webContents.send).toHaveBeenCalledExactlyOnceWith('overlay:settings-page', 'layouts')
    expect(w.focus).toHaveBeenCalledOnce()
    // Without a page: the one it shows.
    openSettingsWindow()
    expect(w.webContents.send).toHaveBeenCalledOnce()
  })

  it('asks for the page in the dev server URL too', () => {
    fakeApp.isPackaged = false
    vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5173/')
    openSettingsWindow('layouts')
    expect(only().loadURL).toHaveBeenCalledWith('http://localhost:5173/?view=settings&page=layouts')
  })

  it('creates a new window after the previous one was closed', () => {
    openSettingsWindow()
    const first = only()
    first.destroy()
    expect(isSettingsSender(first.webContents as never)).toBe(false)
    openSettingsWindow()
    expect(FakeBrowserWindow.all).toHaveLength(2)
    expect(isSettingsSender(FakeBrowserWindow.all[1]?.webContents as never)).toBe(true)
  })

  it('recognises only its own renderer as sender', () => {
    expect(isSettingsSender(new FakeWebContents() as never)).toBe(false)
    openSettingsWindow()
    expect(isSettingsSender(only().webContents as never)).toBe(true)
    expect(isSettingsSender(new FakeWebContents() as never)).toBe(false)
  })

  it('blocks navigation and new windows', () => {
    openSettingsWindow()
    const wc = only().webContents
    const nav = fakeEvent()
    wc.emit('will-navigate', nav)
    expect(nav.defaultPrevented).toBe(true)
    const webview = fakeEvent()
    wc.emit('will-attach-webview', webview)
    expect(webview.defaultPrevented).toBe(true)
    expect(wc.windowOpenHandler?.()).toEqual({ action: 'deny' })
  })

  it('sends only while open, and destroy closes it', () => {
    sendToSettingsWindow('overlay:settings', 1)
    openSettingsWindow()
    const w = only()
    sendToSettingsWindow('overlay:settings', 2)
    expect(w.webContents.send).toHaveBeenCalledExactlyOnceWith('overlay:settings', 2)
    destroySettingsWindow()
    expect(w.destroyed).toBe(true)
    sendToSettingsWindow('overlay:settings', 3)
    expect(w.webContents.send).toHaveBeenCalledOnce()
  })

  it('titles itself in the interface language, live', () => {
    openSettingsWindow()
    const w = only()
    expect(w.getTitle()).toBe('OverLap — Ajustes')
    setSettingsWindowLanguage('en')
    expect(w.getTitle()).toBe('OverLap — Settings')
    setSettingsWindowLanguage('en')
    expect(w.setTitle).toHaveBeenCalledOnce()
    setSettingsWindowLanguage('es')
    expect(w.getTitle()).toBe('OverLap — Ajustes')
  })

  it('opens with the title of the language set while it was closed', () => {
    setSettingsWindowLanguage('en')
    openSettingsWindow()
    expect(only().options.title).toBe('OverLap — Settings')
  })

  it('closes itself when its renderer dies', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    openSettingsWindow()
    const w = only()
    w.webContents.emit('render-process-gone', {}, { reason: 'crashed' })
    expect(w.destroyed).toBe(true)
    expect(isSettingsSender(w.webContents as never)).toBe(false)
  })
})

describe('settings window: size', () => {
  it('opens at 880 x 760 on a 1080p screen, as before', () => {
    expect(settingsWindowSize({ width: 1920, height: 1040 })).toEqual({
      width: 880,
      height: 760,
      minWidth: 560,
      minHeight: 520
    })
    openSettingsWindow()
    expect(only().options).toMatchObject({
      width: 880,
      height: 760,
      minWidth: 560,
      minHeight: 520,
      center: true,
      resizable: true,
      maximizable: true
    })
  })

  it('opens taller on a taller screen (1440p, ultrawide), never past 960', () => {
    expect(settingsWindowSize({ width: 2560, height: 1400 })).toMatchObject({
      width: 880,
      height: 960
    })
    expect(settingsWindowSize({ width: 3440, height: 1400 }).height).toBe(960)
    expect(settingsWindowSize({ width: 5120, height: 1400 }).width).toBe(880)
    expect(settingsWindowSize({ width: 3840, height: 2100 }).height).toBe(960)
    expect(settingsWindowSize({ width: 1920, height: 1160 }).height).toBe(835)
  })

  it('fits a small or scaled work area, its minimum never above its size', () => {
    const small = settingsWindowSize({ width: 800, height: 560 })
    expect(small.width).toBeLessThanOrEqual(800 - 48)
    expect(small.height).toBeLessThanOrEqual(560 - 48)
    expect(small.minWidth).toBeLessThanOrEqual(small.width)
    expect(small.minHeight).toBeLessThanOrEqual(small.height)
    const odd = settingsWindowSize({ width: 0, height: Number.NaN })
    expect(odd.width).toBeGreaterThan(0)
    expect(odd.height).toBeGreaterThan(0)
    expect(odd.minWidth).toBeLessThanOrEqual(odd.width)
  })

  it("opens at the size of the primary display's work area", () => {
    fakeScreen.getPrimaryDisplay().workArea = { x: 0, y: 0, width: 3440, height: 1400 }
    openSettingsWindow()
    expect(only().options).toMatchObject({ width: 880, height: 960 })
  })
})

describe('settings window: where the user types', () => {
  it('knows when it has the focus', () => {
    expect(isSettingsWindowFocused()).toBe(false)
    openSettingsWindow()
    const w = only()
    expect(isSettingsWindowFocused()).toBe(false)
    w.becomeReady()
    expect(isSettingsWindowFocused()).toBe(true)
    w.blur()
    expect(isSettingsWindowFocused()).toBe(false)
    w.destroy()
    expect(isSettingsWindowFocused()).toBe(false)
  })

  it('tells when it stops taking the keys: blur, hide, reload, close', () => {
    const inactive = vi.fn()
    onSettingsWindowInactive(inactive)
    openSettingsWindow()
    const w = only()
    w.becomeReady()
    inactive.mockClear()
    w.blur()
    expect(inactive).toHaveBeenCalledTimes(1)
    w.hide()
    w.emit('hide')
    expect(inactive).toHaveBeenCalledTimes(2)
    w.webContents.reload()
    expect(inactive).toHaveBeenCalledTimes(3)
    w.destroy()
    expect(inactive).toHaveBeenCalledTimes(4)
  })

  it('tells when its renderer dies', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const inactive = vi.fn()
    onSettingsWindowInactive(inactive)
    openSettingsWindow()
    const w = only()
    w.becomeReady()
    inactive.mockClear()
    w.webContents.emit('render-process-gone', {}, { reason: 'crashed' })
    expect(inactive).toHaveBeenCalled()
    expect(w.destroyed).toBe(true)
  })
})
