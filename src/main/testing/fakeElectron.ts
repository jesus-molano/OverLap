/**
 * Minimal in-memory stand-in for the parts of `electron` that main's window
 * modules use, for tests only:
 *
 *   vi.mock('electron', async () => (await import('./testing/fakeElectron')).electronModule)
 */
import { vi } from 'vitest'
import type { Point, Rect } from '@shared/types'

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

  off(event: string, fn: Listener): this {
    return this.removeListener(event, fn)
  }

  emit(event: string, ...args: unknown[]): void {
    for (const fn of this.listeners.get(event) ?? []) fn(...args)
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.length ?? 0
  }

  /** Every listener still registered, on any event. */
  totalListeners(): number {
    let n = 0
    for (const list of this.listeners.values()) n += list.length
    return n
  }

  removeAllListeners(): this {
    this.listeners.clear()
    return this
  }
}

let nextId = 1

export class FakeWebContents extends Emitter {
  readonly id = nextId++
  loading = true
  destroyed = false
  crashed = false
  readonly send = vi.fn()
  readonly openDevTools = vi.fn()
  readonly focus = vi.fn()
  readonly setZoomFactor = vi.fn()
  readonly setVisualZoomLevelLimits = vi.fn(() => Promise.resolve())
  readonly invalidate = vi.fn()
  readonly forcefullyCrashRenderer = vi.fn()
  /**
   * Answers synchronously (a thenable), so a test that advances fake timers without awaiting
   * still sees a live renderer; return a promise that never settles for a hung one.
   */
  readonly executeJavaScript = vi.fn((): Promise<unknown> => answeredNow())
  /** Starts loading the same page again ('did-start-loading'). */
  readonly reload = vi.fn(() => {
    this.startLoading()
  })
  windowOpenHandler: (() => { action: string }) | null = null

  isDestroyed(): boolean {
    return this.destroyed
  }
  isLoading(): boolean {
    return this.loading
  }
  isCrashed(): boolean {
    return this.crashed
  }
  setWindowOpenHandler(fn: () => { action: string }): void {
    this.windowOpenHandler = fn
  }

  /** A (re)load starts: a new document is on its way. */
  startLoading(): void {
    this.loading = true
    this.crashed = false
    this.emit('did-start-loading')
  }

  /** The renderer process is gone (`reason` as Electron reports it). */
  crash(reason = 'crashed'): void {
    this.crashed = true
    this.emit('render-process-gone', {}, { reason, exitCode: 1 })
  }

  /**
   * The page finished loading (after a reload: no 'ready-to-show'). As in Electron (measured on
   * 44): 'did-finish-load' while isLoading() is still true, then 'did-stop-loading' with it false.
   */
  finishLoad(): void {
    this.emit('did-finish-load')
    this.loading = false
    this.emit('did-stop-loading')
  }

  /** Values sent on `channel`, oldest first. */
  sentOn(channel: string): unknown[] {
    return this.send.mock.calls.filter((c) => c[0] === channel).map((c) => c[1] as unknown)
  }
}

/** A thenable that runs its fulfilment callback at once. */
function answeredNow(): Promise<unknown> {
  const thenable = {
    then(onFulfilled?: (value: unknown) => unknown): unknown {
      onFulfilled?.(0)
      return thenable
    }
  }
  return thenable as unknown as Promise<unknown>
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
  /** Has the keyboard focus (focus() and show() give it; blur() takes it). */
  focused = false
  destroyed = false
  /** What the last setIgnoreMouseEvents call asked for. */
  mouse: { ignore: boolean; forward: boolean } = { ignore: false, forward: false }

  readonly setIgnoreMouseEvents = vi.fn((ignore: boolean, options?: { forward?: boolean }) => {
    this.mouse = { ignore, forward: options?.forward === true }
  })
  readonly setAlwaysOnTop = vi.fn()
  readonly moveTop = vi.fn()
  readonly focus = vi.fn(() => {
    this.focused = true
  })
  readonly setFocusable = vi.fn()
  readonly restore = vi.fn(() => {
    this.minimized = false
  })
  readonly show = vi.fn(() => {
    this.visible = true
    this.focused = true
  })
  readonly showInactive = vi.fn(() => {
    this.visible = true
  })
  readonly hide = vi.fn(() => {
    this.visible = false
    this.focused = false
  })
  readonly setBounds = vi.fn((rect: Rect) => {
    this.bounds = { ...rect }
  })
  readonly setTitle = vi.fn((title: string) => {
    this.title = title
  })
  readonly loadURL = vi.fn(() => {
    this.webContents.startLoading()
    return Promise.resolve()
  })
  readonly loadFile = vi.fn(() => {
    this.webContents.startLoading()
    return Promise.resolve()
  })
  readonly destroy = vi.fn(() => {
    if (this.destroyed) return
    this.destroyed = true
    this.visible = false
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
  isFocused(): boolean {
    return this.focused && !this.destroyed
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

  /** Another window takes the keyboard focus. */
  blur(): void {
    this.focused = false
    this.emit('blur')
  }

  /** Finishes loading (see `finishLoad`), then fires 'ready-to-show', as after the first paint. */
  becomeReady(): void {
    this.webContents.finishLoad()
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
  id: number
  bounds: Rect
  workArea: Rect
  scaleFactor: number
}

/** One 1920x1080 display (id 1, 100 %) with a 40 px taskbar at the bottom. */
function defaultDisplays(): FakeDisplay[] {
  return [
    {
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
      scaleFactor: 1
    }
  ]
}

function distanceTo(r: Rect, p: Point): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.width - 1))
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.height - 1))
  return Math.hypot(dx, dy)
}

class FakeScreen extends Emitter {
  cursor: Point = { x: 0, y: 0 }
  displays: FakeDisplay[] = defaultDisplays()
  /** Index in `displays` of the primary display. */
  primary = 0

  getCursorScreenPoint(): Point {
    return { ...this.cursor }
  }
  getAllDisplays(): FakeDisplay[] {
    return this.displays
  }
  getPrimaryDisplay(): FakeDisplay {
    return this.displays[this.primary] ?? this.displays[0] ?? (defaultDisplays()[0] as FakeDisplay)
  }
  getDisplayNearestPoint(p: Point): FakeDisplay {
    let best = this.getPrimaryDisplay()
    let bestDist = Infinity
    for (const d of this.displays) {
      const dist = distanceTo(d.bounds, p)
      if (dist < bestDist) {
        best = d
        bestDist = dist
      }
    }
    return best
  }
}

export const fakeScreen = new FakeScreen()

export const fakePowerMonitor = new Emitter()

class FakeApp extends Emitter {
  isPackaged = true
  gpuCompositing = 'enabled'

  getGPUFeatureStatus(): { gpu_compositing: string } {
    return { gpu_compositing: this.gpuCompositing }
  }
}

export const fakeApp = new FakeApp()

/**
 * Electron's globalShortcut as Windows treats it: a combination another application holds
 * (`taken`) is refused, registrations fail while suspended, and a suspended shortcut does not
 * fire. Nothing reaches the operating system.
 */
export class FakeGlobalShortcut {
  /** Combinations "another application" holds: register() refuses them. */
  readonly taken = new Set<string>()
  readonly callbacks = new Map<string, () => void>()
  suspended = false

  readonly register = vi.fn((accelerator: string, callback: () => void): boolean => {
    if (this.suspended || this.taken.has(accelerator) || this.callbacks.has(accelerator)) {
      return false
    }
    this.callbacks.set(accelerator, callback)
    return true
  })
  readonly unregister = vi.fn((accelerator: string): void => {
    this.callbacks.delete(accelerator)
  })
  readonly unregisterAll = vi.fn((): void => {
    this.callbacks.clear()
  })
  readonly setSuspended = vi.fn((suspended: boolean): void => {
    this.suspended = suspended
  })

  isRegistered(accelerator: string): boolean {
    return this.callbacks.has(accelerator)
  }
  isSuspended(): boolean {
    return this.suspended
  }

  /** The user presses `accelerator`: true when a registered, unsuspended shortcut took it. */
  press(accelerator: string): boolean {
    const cb = this.callbacks.get(accelerator)
    if (!cb || this.suspended) return false
    cb()
    return true
  }

  /** Registered combinations, sorted. */
  registered(): string[] {
    return [...this.callbacks.keys()].sort()
  }

  reset(): void {
    this.taken.clear()
    this.callbacks.clear()
    this.suspended = false
    this.register.mockClear()
    this.unregister.mockClear()
    this.unregisterAll.mockClear()
    this.setSuspended.mockClear()
  }
}

export const fakeGlobalShortcut = new FakeGlobalShortcut()

export const electronModule = {
  BrowserWindow: FakeBrowserWindow,
  app: fakeApp,
  globalShortcut: fakeGlobalShortcut,
  ipcMain: fakeIpcMain,
  powerMonitor: fakePowerMonitor,
  screen: fakeScreen
}

export function resetFakeElectron(): void {
  FakeBrowserWindow.all.length = 0
  fakeIpcMain.listeners.clear()
  fakeIpcMain.handlers.clear()
  fakeScreen.removeAllListeners()
  fakeScreen.cursor = { x: 0, y: 0 }
  fakeScreen.displays = defaultDisplays()
  fakeScreen.primary = 0
  fakePowerMonitor.removeAllListeners()
  fakeApp.removeAllListeners()
  fakeApp.isPackaged = true
  fakeApp.gpuCompositing = 'enabled'
  fakeGlobalShortcut.reset()
}
