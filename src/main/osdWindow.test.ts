/**
 * The confirmation window over the game (R37) with a fake BrowserWindow: made once, shown with
 * showInactive only after its page has loaded, placed on the display it is given, hidden after
 * OSD_SHOW_MS, and its timer cleared by dispose.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { IPC } from '@shared/ipc'
import { OSD_SIZE } from './osdPlace'

const fake = vi.hoisted(() => ({
  wins: [] as FakeWin[]
}))

interface FakeWin {
  options: Record<string, unknown>
  bounds: unknown[]
  sent: [string, unknown][]
  visible: boolean
  destroyed: boolean
  ignoreMouse: boolean
  onTop: unknown[]
  loaded: () => void
  showInactive: Mock<() => void>
  show: Mock<() => void>
  focus: Mock<() => void>
}

vi.mock('electron', () => {
  class BrowserWindow {
    private readonly f: FakeWin
    readonly webContents: {
      send: (ch: string, msg: unknown) => void
      on: (ev: string, cb: () => void) => void
      setWindowOpenHandler: () => void
    }
    constructor(options: Record<string, unknown>) {
      const f: FakeWin = {
        options,
        bounds: [],
        sent: [],
        visible: false,
        destroyed: false,
        ignoreMouse: false,
        onTop: [],
        loaded: () => {},
        showInactive: vi.fn(() => {
          f.visible = true
        }),
        show: vi.fn(),
        focus: vi.fn()
      }
      this.f = f
      fake.wins.push(f)
      this.webContents = {
        send: (ch, msg) => void f.sent.push([ch, msg]),
        on: (ev, cb) => {
          if (ev === 'did-finish-load') f.loaded = cb
        },
        setWindowOpenHandler: () => {}
      }
    }
    setIgnoreMouseEvents(on: boolean): void {
      this.f.ignoreMouse = on
    }
    setAlwaysOnTop(...args: unknown[]): void {
      this.f.onTop = args
    }
    setBounds(b: unknown): void {
      this.f.bounds.push(b)
    }
    isDestroyed(): boolean {
      return this.f.destroyed
    }
    isVisible(): boolean {
      return this.f.visible
    }
    showInactive(): void {
      this.f.showInactive()
    }
    show(): void {
      this.f.show()
    }
    focus(): void {
      this.f.focus()
    }
    hide(): void {
      this.f.visible = false
    }
    destroy(): void {
      this.f.destroyed = true
    }
    on(): void {
      // 'closed': the test never closes it.
    }
    loadFile(): Promise<void> {
      return Promise.resolve()
    }
    loadURL(): Promise<void> {
      return Promise.resolve()
    }
  }
  return {
    BrowserWindow,
    app: { isPackaged: true },
    screen: { getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }) }
  }
})

const { OSD_SHOW_MS, OsdWindow } = await import('./osdWindow')

describe('OsdWindow (R37)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fake.wins.length = 0
  })
  afterEach(() => vi.useRealTimers())

  it('never takes the focus or the clicks', () => {
    const osd = new OsdWindow()
    osd.show({ text: 'Overlay oculto', detail: '' })
    const w = fake.wins[0]!
    expect(w.options.focusable).toBe(false)
    expect(w.options.skipTaskbar).toBe(true)
    expect(w.options.show).toBe(false)
    expect(w.ignoreMouse).toBe(true)
    expect(w.onTop[0]).toBe(true)
    w.loaded()
    expect(w.showInactive).toHaveBeenCalledOnce()
    expect(w.show).not.toHaveBeenCalled()
    expect(w.focus).not.toHaveBeenCalled()
    osd.dispose()
  })

  it('waits for its page before the first message, then shows each at once', () => {
    const osd = new OsdWindow()
    osd.show({ text: 'Uno', detail: '' })
    const w = fake.wins[0]!
    expect(w.sent).toEqual([])
    expect(w.visible).toBe(false)
    w.loaded()
    expect(w.sent).toEqual([[IPC.osd, { text: 'Uno', detail: '' }]])
    osd.show({ text: 'Dos', detail: 'x' })
    expect(w.sent.at(-1)).toEqual([IPC.osd, { text: 'Dos', detail: 'x' }])
    // One window for them all.
    expect(fake.wins).toHaveLength(1)
    osd.dispose()
  })

  it('goes on the display it is given, the primary one without', () => {
    const osd = new OsdWindow()
    osd.show({ text: 'a', detail: '' }, { x: 1920, y: 0, width: 2560, height: 1400 })
    osd.show({ text: 'b', detail: '' })
    const w = fake.wins[0]!
    expect(w.bounds[0]).toEqual({
      x: 1920 + (2560 - OSD_SIZE.width) / 2,
      y: 36,
      ...OSD_SIZE
    })
    expect(w.bounds[1]).toEqual({ x: (1920 - OSD_SIZE.width) / 2, y: 36, ...OSD_SIZE })
    osd.dispose()
  })

  it('hides after OSD_SHOW_MS, counted from the latest message', () => {
    const osd = new OsdWindow()
    osd.show({ text: 'a', detail: '' })
    const w = fake.wins[0]!
    w.loaded()
    vi.advanceTimersByTime(OSD_SHOW_MS - 100)
    osd.show({ text: 'b', detail: '' })
    vi.advanceTimersByTime(OSD_SHOW_MS - 100)
    expect(w.visible).toBe(true)
    vi.advanceTimersByTime(100)
    expect(w.visible).toBe(false)
    osd.dispose()
  })

  it('dispose destroys the window and clears its timer', () => {
    const osd = new OsdWindow()
    osd.show({ text: 'a', detail: '' })
    const w = fake.wins[0]!
    w.loaded()
    osd.dispose()
    expect(w.destroyed).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})
