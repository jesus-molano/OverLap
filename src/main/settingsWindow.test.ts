import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FakeBrowserWindow,
  FakeWebContents,
  fakeApp,
  fakeEvent,
  resetFakeElectron
} from './testing/fakeElectron'
import {
  destroySettingsWindow,
  isSettingsSender,
  openSettingsWindow,
  sendToSettingsWindow,
  setSettingsWindowLanguage
} from './settingsWindow'

vi.mock('electron', async () => (await import('./testing/fakeElectron')).electronModule)
vi.mock('../../resources/icon.png?asset', () => ({ default: 'icon.png' }))

function only(): FakeBrowserWindow {
  expect(FakeBrowserWindow.all).toHaveLength(1)
  return FakeBrowserWindow.all[0] as FakeBrowserWindow
}

beforeEach(() => resetFakeElectron())

afterEach(() => {
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
