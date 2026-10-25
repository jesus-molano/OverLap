/**
 * Minimal in-memory stand-in for the parts of `electron` that main's window
 * modules use, for tests only:
 *
 *   vi.mock('electron', async () => (await import('./testing/fakeElectron')).electronModule)
 */
import { vi } from 'vitest'
import type { Rect } from '@shared/types'

type Listener = (...args: unknown[]) => void

class Emitter {
  private readonly listeners = new Map<string, Listener[]>()

  on(event: string, fn: Listener): this {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), fn])
    return this
  }

  once(event: string, fn: Listener): this {
    const wrapper: Listener = (...args) => {
      this.removeListener(event, wrapper)
      fn(...args)
    }
    return this.on(event, wrapper)
  }

  removeListener(event: string, fn: Listener): this {
    this.listeners.set(
      event,
      (this.listeners.get(event) ?? []).filter((l) => l !== fn)
    )
    return this
  }

  emit(event: string, ...args: unknown[]): void {
    for (const fn of this.listeners.get(event) ?? []) fn(...args)
  }
}

let nextId = 1

export class FakeWebContents extends Emitter {
  readonly id = nextId++
  loading = true
  destroyed = false
  readonly send = vi.fn()
  readonly openDevTools = vi.fn()
  windowOpenHandler: (() => { action: string }) | null = null

  isDestroyed(): boolean {
    return this.destroyed
  }
  isLoading(): boolean {
    return this.loading
  }
  isCrashed(): boolean {
    return false
  }
  setWindowOpenHandler(fn: () => { action: string }): void {
    this.windowOpenHandler = fn
  }
}

/** A cancellable event like the ones Electron passes to 'will-navigate' and friends. */
export function fakeEvent(): { defaultPrevented: boolean; preventDefault(): void } {
  return {
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true
    }
  }
}

export class FakeBrowserWindow extends Emitter {
  static readonly all: FakeBrowserWindow[] = []

  static fromWebContents(wc: unknown): FakeBrowserWindow | null {
    return FakeBrowserWindow.all.find((w) => w.webContents === wc) ?? null
  }

  readonly webContents = new FakeWebContents()
  bounds: Rect
  /** Title bar text: the `title` option, then whatever setTitle() set. */
  title: string
  visible = false
  minimized = false
  destroyed = false

  readonly setIgnoreMouseEvents = vi.fn()
  readonly setAlwaysOnTop = vi.fn()
  readonly moveTop = vi.fn()
  readonly focus = vi.fn()
  readonly restore = vi.fn(() => {
    this.minimized = false
  })
  readonly show = vi.fn(() => {
    this.visible = true
  })
  readonly showInactive = vi.fn(() => {
    this.visible = true
  })
  readonly hide = vi.fn(() => {
    this.visible = false
  })
  readonly setBounds = vi.fn((rect: Rect) => {
    this.bounds = { ...rect }
  })
  readonly setTitle = vi.fn((title: string) => {
    this.title = title
  })
  readonly loadURL = vi.fn(() => Promise.resolve())
  readonly loadFile = vi.fn(() => Promise.resolve())
  readonly destroy = vi.fn(() => {
    if (this.destroyed) return
    this.destroyed = true
    this.webContents.destroyed = true
    this.emit('closed')
  })

  constructor(readonly options: Record<string, unknown>) {
    super()
    const n = (key: string, def: number): number =>
      typeof options[key] === 'number' ? (options[key] as number) : def
    this.bounds = { x: n('x', 0), y: n('y', 0), width: n('width', 800), height: n('height', 600) }
    this.title = typeof options.title === 'string' ? options.title : ''
    FakeBrowserWindow.all.push(this)
  }

  isDestroyed(): boolean {
    return this.destroyed
  }
  isVisible(): boolean {
    return this.visible
  }
  isMinimized(): boolean {
    return this.minimized
  }
  getTitle(): string {
    return this.title
  }
  isAlwaysOnTop(): boolean {
    return true
  }
  getBounds(): Rect {
    return { ...this.bounds }
  }

  /** Finishes loading ('did-finish-load') and fires 'ready-to-show', as after the first paint. */
  becomeReady(): void {
    this.webContents.loading = false
    this.webContents.emit('did-finish-load')
    this.emit('ready-to-show')
  }
}

export const fakeIpcMain = {
  listeners: new Map<string, Listener>(),
  handlers: new Map<string, Listener>(),
  on(channel: string, fn: Listener): void {
    fakeIpcMain.listeners.set(channel, fn)
  },
  removeListener(channel: string): void {
    fakeIpcMain.listeners.delete(channel)
  },
  handle(channel: string, fn: Listener): void {
    fakeIpcMain.handlers.set(channel, fn)
  },
  removeHandler(channel: string): void {
    fakeIpcMain.handlers.delete(channel)
  },
  /** Delivers an `ipcRenderer.send` from `sender`. */
  send(channel: string, sender: FakeWebContents, value: unknown): void {
    fakeIpcMain.listeners.get(channel)?.({ sender }, value)
  }
}

export interface FakeDisplay {
  bounds: Rect
  workArea: Rect
}

/** One 1920x1080 display with a 40 px taskbar at the bottom. */
function defaultDisplays(): FakeDisplay[] {
  return [
    {
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 }
    }
  ]
}

export const fakeScreen = {
  cursor: { x: 0, y: 0 },
  displays: defaultDisplays(),
  on: vi.fn(),
  removeListener: vi.fn(),
  getCursorScreenPoint: () => ({ ...fakeScreen.cursor }),
  getAllDisplays: () => fakeScreen.displays,
  getPrimaryDisplay: (): FakeDisplay =>
    fakeScreen.displays[0] ?? (defaultDisplays()[0] as FakeDisplay)
}

export const fakeApp = { isPackaged: true }

export const electronModule = {
  BrowserWindow: FakeBrowserWindow,
  app: fakeApp,
  ipcMain: fakeIpcMain,
  screen: fakeScreen
}

export function resetFakeElectron(): void {
  FakeBrowserWindow.all.length = 0
  fakeIpcMain.listeners.clear()
  fakeIpcMain.handlers.clear()
  fakeScreen.cursor = { x: 0, y: 0 }
  fakeScreen.displays = defaultDisplays()
  fakeApp.isPackaged = true
}
