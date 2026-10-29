import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DRAG_LEASE_MS,
  IPC,
  type AutoHiddenState,
  type BoundsCommit,
  type OverlayLayout,
  type OverlayPanel
} from '@shared/ipc'
import { createDefaultSettings } from '@shared/settings'
import type { OverlaySettings, OverlayStatus, Rect, WidgetDataMessage } from '@shared/types'
import { PAINT_ORDER, WIDGET_IDS, type WidgetId } from '@shared/widgets'
import { MOUSE_POLL_MS } from './mouseMode'
import { BOUNDS_GUARD_MAX_TRIES, PROBE_TIMEOUT_MS, UNRESPONSIVE_KILL_MS } from './overlayWindow'
import {
  COMMIT_DELAY_MS,
  CURSOR_HIDDEN_READS,
  CURSOR_POLL_MS,
  DISPLAY_CHANGE_DEBOUNCE_MS,
  GPU_RECREATE_DELAY_MS,
  OverlayWindows,
  RELOAD_DELAY_MS,
  RESUME_DEBOUNCE_MS,
  Z_ORDER_INTERVAL_MS
} from './overlayWindows'
import {
  FakeBrowserWindow,
  FakeWebContents,
  fakeApp,
  fakeEvent,
  fakeIpcMain,
  fakePowerMonitor,
  fakeScreen,
  resetFakeElectron,
  type FakeDisplay
} from './testing/fakeElectron'

vi.mock('electron', async () => (await import('./testing/fakeElectron')).electronModule)

/** The default display (id 1): 1920x1080 at 100 %, 40 px taskbar. */
const PRIMARY: FakeDisplay = {
  id: 1,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  workArea: { x: 0, y: 0, width: 1920, height: 1040 },
  scaleFactor: 1
}
/** Right of the primary, 150 %, higher up: its window-local origin is (1920, -200). */
const SECOND: FakeDisplay = {
  id: 2,
  bounds: { x: 1920, y: -200, width: 1707, height: 960 },
  workArea: { x: 1920, y: -200, width: 1707, height: 920 },
  scaleFactor: 1.5
}
/** radar saved on SECOND: window-local (180, 300) there. */
const RADAR_ON_SECOND: Rect = { x: 2100, y: 100, width: 220, height: 260 }
const HIDDEN: AutoHiddenState = { hidden: true, reason: 'practice' }
const LIVE: OverlayStatus = { state: 'mock', source: 'mock', note: 'none', detail: '' }

let settings: OverlaySettings
let committed: Array<[WidgetId, Rect]>
let scaleSteps: Array<[WidgetId, 1 | -1]>
let toggles: Array<[WidgetId, 'visible' | 'locked', boolean]>
/** What the cursor probe answers (null: unknown). */
let cursorShowing: boolean | null
let windows: OverlayWindows
const seqs = new Map<FakeBrowserWindow, number>()

function msg(widget: WidgetId): WidgetDataMessage {
  return { widget, payload: { n: Math.random() } } as unknown as WidgetDataMessage
}

function changeSettings(mutate: (s: OverlaySettings) => void): void {
  settings = structuredClone(settings)
  mutate(settings)
  windows.applySettings(settings)
}

/** Windows not destroyed, creation order. */
function live(): FakeBrowserWindow[] {
  return FakeBrowserWindow.all.filter((w) => !w.destroyed)
}

function only(): FakeBrowserWindow {
  const all = live()
  expect(all).toHaveLength(1)
  return all[0] as FakeBrowserWindow
}

/** The live window of display number `n` (by its title, in Spanish). */
function display(n: number): FakeBrowserWindow {
  const w = live().find((x) => x.title === `Pantalla ${n} · OverLap`)
  if (!w) throw new Error(`no window for display ${n}`)
  return w
}

function layouts(w: FakeBrowserWindow): OverlayLayout[] {
  return w.webContents.sentOn(IPC.layout) as OverlayLayout[]
}

function layoutOf(w: FakeBrowserWindow): OverlayLayout {
  const l = layouts(w).at(-1)
  if (!l) throw new Error('no layout sent')
  return l
}

function panel(w: FakeBrowserWindow, id: WidgetId): OverlayPanel | undefined {
  return layoutOf(w).panels.find((p) => p.widget === id)
}

function hosted(w: FakeBrowserWindow): WidgetId[] {
  return layoutOf(w).panels.map((p) => p.widget)
}

function readyAll(): void {
  for (const w of live()) if (w.webContents.loading) w.becomeReady()
}

function start(): void {
  windows.start()
  readyAll()
}

function useTwoDisplays(): void {
  fakeScreen.displays = [structuredClone(PRIMARY), structuredClone(SECOND)]
  settings.widgets.radar.bounds = { ...RADAR_ON_SECOND }
}

type CommitBody = BoundsCommit extends infer C
  ? C extends BoundsCommit
    ? Omit<C, 'session' | 'seq'>
    : never
  : never

/** Sends a commit stamped with the window's current session and its next sequence number. */
function commit(w: FakeBrowserWindow, body: CommitBody, session = layoutOf(w).session): void {
  const seq = (seqs.get(w) ?? 0) + 1
  seqs.set(w, seq)
  fakeIpcMain.send(IPC.commitBounds, w.webContents, { session, seq, ...body })
}

function drag(w: FakeBrowserWindow, widget: WidgetId, rect: Rect, revision?: number): void {
  commit(w, { kind: 'drag', widget, rect, revision: revision ?? layoutOf(w).revision })
}

function dragState(w: FakeBrowserWindow, dragging: boolean, session = layoutOf(w).session): void {
  fakeIpcMain.send(IPC.dragState, w.webContents, { session, dragging })
}

function moveCursor(x: number, y: number): void {
  fakeScreen.cursor = { x, y }
  vi.advanceTimersByTime(MOUSE_POLL_MS)
}

const CAPTURE = { ignore: false, forward: false }
const FORWARD = { ignore: true, forward: true }
const IGNORE = { ignore: true, forward: false }

beforeEach(() => {
  vi.useFakeTimers()
  resetFakeElectron()
  seqs.clear()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  settings = createDefaultSettings()
  committed = []
  scaleSteps = []
  toggles = []
  cursorShowing = true
  windows = new OverlayWindows({
    getSettings: () => settings,
    onBoundsCommitted: (id, bounds) => {
      committed.push([id, bounds])
      changeSettings((s) => (s.widgets[id].bounds = bounds))
    },
    onScaleStep: (id, step) => scaleSteps.push([id, step]),
    // Like main/index.ts: the store, then the windows (visibility, then the rest).
    onWidgetToggle: (id, field, value) => {
      toggles.push([id, field, value])
      settings = structuredClone(settings)
      settings.widgets[id][field] = value
      if (field === 'visible') windows.setVisible(id, value)
      windows.applySettings(settings)
    },
    cursorShowing: () => cursorShowing
  })
})

afterEach(() => {
  windows.dispose()
  // Never anything that could take focus from the sim.
  for (const w of FakeBrowserWindow.all) {
    expect(w.show).not.toHaveBeenCalled()
    expect(w.focus).not.toHaveBeenCalled()
    expect(w.restore).not.toHaveBeenCalled()
    expect(w.setFocusable).not.toHaveBeenCalled()
    expect(w.webContents.focus).not.toHaveBeenCalled()
  }
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('OverlayWindows windows', () => {
  it('creates one transparent, non-focusable, click-through window covering the display', () => {
    start()
    const w = only()
    expect(w.options).toMatchObject({
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      title: 'Pantalla 1 · OverLap',
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
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
        spellcheck: false,
        devTools: false,
        zoomFactor: 1
      }
    })
    expect(w.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver')
    expect(w.loadFile).toHaveBeenCalledWith(expect.stringMatching(/renderer[\\/]index\.html$/), {
      query: { view: 'overlay' }
    })
    expect(hosted(w)).toEqual(PAINT_ORDER)
  })

  it('is click-through before it is ever shown, and only shown inactive once ready', () => {
    windows.start()
    const w = only()
    expect(w.setIgnoreMouseEvents.mock.calls).toEqual([[true]])
    expect(w.isVisible()).toBe(false)
    w.becomeReady()
    expect(w.isVisible()).toBe(true)
    expect(w.showInactive).toHaveBeenCalled()
    expect(w.setIgnoreMouseEvents.mock.invocationCallOrder[0]).toBeLessThan(
      w.showInactive.mock.invocationCallOrder[0] as number
    )
    expect(w.moveTop).toHaveBeenCalled()
    // Zoom pinned on every load.
    expect(w.webContents.setZoomFactor).toHaveBeenCalledWith(1)
    expect(w.webContents.setVisualZoomLevelLimits).toHaveBeenCalledWith(1, 1)
  })

  it('loads the dev server with ?view=overlay and &perf=1, and forwards console lines', () => {
    fakeApp.isPackaged = false
    vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5173/')
    vi.stubEnv('OVERLAY_PERF', '1')
    start()
    const w = only()
    expect(w.loadURL).toHaveBeenCalledWith('http://localhost:5173/?view=overlay&perf=1')
    w.webContents.emit('console-message', { message: 'slow frame', level: 'warning' })
    expect(console.warn).toHaveBeenCalledWith('[overlay:1] slow frame')
  })

  it('blocks navigation, webviews and new windows', () => {
    start()
    const w = only()
    const nav = fakeEvent()
    w.webContents.emit('will-navigate', nav)
    const webview = fakeEvent()
    w.webContents.emit('will-attach-webview', webview)
    const title = fakeEvent()
    w.emit('page-title-updated', title, 'OverLap')
    expect(nav.defaultPrevented).toBe(true)
    expect(webview.defaultPrevented).toBe(true)
    expect(title.defaultPrevented).toBe(true)
    expect(w.webContents.windowOpenHandler?.()).toEqual({ action: 'deny' })
  })

  it('creates one window per display that hosts an enabled widget', () => {
    useTwoDisplays()
    start()
    expect(live()).toHaveLength(2)
    const second = display(2)
    expect(second.getBounds()).toEqual(SECOND.bounds)
    expect(layoutOf(second).display).toEqual({
      id: 2,
      index: 2,
      bounds: { x: 0, y: 0, width: 1707, height: 960 },
      workArea: { x: 0, y: 0, width: 1707, height: 920 },
      scaleFactor: 1.5
    })
    expect(hosted(second)).toEqual(['radar'])
    expect(panel(second, 'radar')?.rect).toEqual({ x: 180, y: 300, width: 220, height: 260 })
    expect(hosted(display(1))).toEqual(WIDGET_IDS.filter((id) => id !== 'radar'))
  })

  it('has no window for a display without enabled widgets, and makes one when needed', () => {
    useTwoDisplays()
    start()
    windows.setVisible('radar', false)
    expect(live()).toHaveLength(1)
    expect(hosted(display(1))).not.toContain('radar')
    windows.setVisible('radar', true)
    expect(live()).toHaveLength(2)
    readyAll()
    expect(hosted(display(2))).toEqual(['radar'])

    for (const id of WIDGET_IDS) windows.setVisible(id, false)
    expect(live()).toHaveLength(0)
  })

  it('retitles every window when the language changes', () => {
    useTwoDisplays()
    start()
    changeSettings((s) => (s.appearance.language = 'en'))
    expect(live().map((w) => w.getTitle())).toEqual(['Display 1 · OverLap', 'Display 2 · OverLap'])
    const calls = live()[0]?.setTitle.mock.calls.length
    changeSettings((s) => (s.appearance.accent = '#22d3ee'))
    expect(live()[0]?.setTitle.mock.calls.length).toBe(calls)
  })
})

describe('OverlayWindows layouts', () => {
  it('sends each window what it hosts, in its own coordinates, only when it changes', () => {
    start()
    const w = only()
    const l = layoutOf(w)
    expect(l).toMatchObject({
      session: 1,
      ackSeq: 0,
      display: { id: 1, index: 1, bounds: PRIMARY.bounds, workArea: PRIMARY.workArea }
    })
    expect(panel(w, 'relative')).toEqual({
      widget: 'relative',
      rect: settings.widgets.relative.bounds,
      placement: 0
    })
    const count = layouts(w).length
    windows.applySettings(settings)
    windows.setEditMode(true)
    windows.setEditMode(false)
    windows.broadcastStatus(LIVE)
    expect(layouts(w)).toHaveLength(count)
  })

  it('answers IPC.init with a fresh layout, and nothing for other senders', () => {
    start()
    const w = only()
    const sent = layoutOf(w)
    const init = windows.layoutFor(w.webContents as never)
    expect(init?.revision).toBeGreaterThan(sent.revision)
    expect({ ...init, revision: 0 }).toEqual({ ...sent, revision: 0 })
    expect(windows.layoutFor(new FakeWebContents() as never)).toBeNull()
    expect(windows.isOverlaySender(w.webContents as never)).toBe(true)
    expect(windows.isOverlaySender(new FakeWebContents() as never)).toBe(false)
  })

  it('starts a new session on every reload and sends it the layout once loaded', () => {
    start()
    const w = only()
    w.webContents.reload()
    expect(w.isVisible()).toBe(false)
    w.webContents.finishLoad()
    expect(w.isVisible()).toBe(true)
    const l = layoutOf(w)
    expect(l.session).toBe(2)
    expect(l.ackSeq).toBe(0)
    const revisions = layouts(w).map((x) => x.revision)
    expect([...revisions].sort((a, b) => a - b)).toEqual(revisions)
  })
})

describe('OverlayWindows data', () => {
  it('sends a payload only to the window hosting its widget', () => {
    useTwoDisplays()
    start()
    const radar = msg('radar')
    const standings = msg('standings')
    windows.sendData(radar)
    windows.sendData(standings)
    expect(display(2).webContents.sentOn(IPC.data)).toEqual([radar])
    expect(display(1).webContents.sentOn(IPC.data)).toEqual([standings])
  })

  it('drops payloads of disabled widgets', () => {
    start()
    windows.setVisible('radar', false)
    windows.sendData(msg('radar'))
    expect(only().webContents.sentOn(IPC.data)).toEqual([])
  })

  it('hands the latest payload over when the window becomes ready and after a reload', () => {
    windows.start()
    const w = only()
    windows.broadcastStatus(LIVE)
    const first = msg('standings')
    windows.sendData(first)
    expect(w.webContents.sentOn(IPC.data)).toEqual([])
    w.becomeReady()
    expect(w.webContents.sentOn(IPC.data)).toEqual([first])

    w.webContents.reload()
    const second = msg('standings')
    windows.sendData(second)
    expect(w.webContents.sentOn(IPC.data)).toEqual([first])
    w.webContents.finishLoad()
    expect(w.webContents.sentOn(IPC.data)).toEqual([first, second])
  })

  it('never hands over a stale payload', () => {
    start()
    const w = only()
    const reloaded = (): unknown[] => {
      w.webContents.send.mockClear()
      w.webContents.reload()
      w.webContents.finishLoad()
      return w.webContents.sentOn(IPC.data)
    }
    windows.sendData(msg('standings'))
    windows.broadcastStatus({ state: 'waiting', source: 'iracing', note: 'none', detail: '' })
    expect(reloaded()).toEqual([])

    windows.sendData(msg('standings'))
    windows.setAutoHidden('standings', { hidden: true, reason: 'pits' })
    windows.setAutoHidden('standings', { hidden: false, reason: null })
    expect(reloaded()).toEqual([])

    windows.sendData(msg('standings'))
    windows.setVisible('standings', false)
    windows.setVisible('standings', true)
    expect(reloaded()).toEqual([])
  })

  it('sends status and settings to every window', () => {
    useTwoDisplays()
    start()
    windows.broadcastStatus(LIVE)
    windows.broadcastSettings(settings)
    for (const w of live()) {
      expect(w.webContents.sentOn(IPC.status)).toEqual([LIVE])
      expect(w.webContents.sentOn(IPC.settings)).toEqual([settings])
    }
  })

  it('sends nothing to a renderer that is gone, and again once it reloads', () => {
    start()
    const w = only()
    w.webContents.crash()
    windows.broadcastStatus(LIVE)
    windows.setEditMode(true)
    expect(w.webContents.sentOn(IPC.status)).toEqual([])
    expect(w.webContents.sentOn(IPC.editMode)).toEqual([])
    vi.advanceTimersByTime(RELOAD_DELAY_MS)
    // Loading again in a live process: it may already have asked for its initial state.
    windows.broadcastSettings(settings)
    expect(w.webContents.sentOn(IPC.settings)).toEqual([settings])
  })
})

describe('OverlayWindows visibility rules', () => {
  it('sends every window every rule change, once, and hides a window with nothing to draw', () => {
    useTwoDisplays()
    start()
    windows.setAutoHidden('radar', HIDDEN)
    windows.setAutoHidden('radar', HIDDEN)
    for (const w of live()) {
      expect(w.webContents.sentOn(IPC.autoHidden)).toEqual([{ widget: 'radar', ...HIDDEN }])
    }
    expect(display(2).isVisible()).toBe(false)
    expect(display(1).isVisible()).toBe(true)
    expect(windows.autoHiddenMap()).toEqual({ radar: HIDDEN })
    expect(windows.autoHiddenReasons()).toEqual({ radar: 'practice' })

    windows.setAutoHidden('radar', { hidden: false, reason: 'race' })
    expect(display(2).isVisible()).toBe(true)
    expect(display(2).webContents.sentOn(IPC.autoHidden).at(-1)).toEqual({
      widget: 'radar',
      hidden: false,
      reason: null
    })
    expect(windows.autoHiddenMap()).toEqual({})
  })

  it('previews rule-hidden widgets in edit mode, and disabled ones only as ghosts', () => {
    useTwoDisplays()
    start()
    windows.setAutoHidden('radar', HIDDEN)
    windows.setEditMode(true)
    expect(display(2).isVisible()).toBe(true)
    expect(panel(display(2), 'radar')?.ghost).toBeUndefined()
    windows.setEditMode(false)
    expect(display(2).isVisible()).toBe(false)
    windows.setVisible('radar', false)
    expect(live()).toHaveLength(1)
    // Edit mode hosts it again, as a ghost at its place: its display gets a window for it.
    windows.setEditMode(true)
    expect(live()).toHaveLength(2)
    readyAll()
    expect(display(2).isVisible()).toBe(true)
    expect(panel(display(2), 'radar')).toMatchObject({
      ghost: true,
      rect: { x: 180, y: 300, width: 220, height: 260 }
    })
    // Never any data, in edit mode or out of it.
    windows.sendData(msg('radar'))
    expect(display(2).webContents.sentOn(IPC.data)).toEqual([])
    // Out of edit mode nothing changes: not hosted, its window gone.
    windows.setEditMode(false)
    expect(live()).toHaveLength(1)
    expect(hosted(display(1))).not.toContain('radar')
  })

  it('out of the car hides every window; edit mode shows them all; the user still hides by hand', () => {
    start()
    const w = only()
    const OUT: AutoHiddenState = { hidden: true, reason: 'out-of-car' }
    // The standings stay on the session screen (the results): the window stays for them.
    for (const id of WIDGET_IDS) if (id !== 'standings') windows.setAutoHidden(id, OUT)
    expect(w.isVisible()).toBe(true)
    windows.setAutoHidden('standings', OUT)
    expect(w.isVisible()).toBe(false)
    expect(windows.autoHiddenReasons()).toEqual(
      Object.fromEntries(WIDGET_IDS.map((id) => [id, 'out-of-car']))
    )
    // Edit mode shows every widget, with its reason (the renderer's caption).
    windows.setEditMode(true)
    expect(w.isVisible()).toBe(true)
    expect([...hosted(w)].sort()).toEqual([...WIDGET_IDS].sort())
    expect(w.webContents.sentOn(IPC.autoHidden).at(-1)).toEqual({ widget: 'standings', ...OUT })
    windows.setEditMode(false)
    expect(w.isVisible()).toBe(false)
    // Back in the car while the user hid the overlay (the shortcut): it stays hidden until shown.
    windows.setUserHidden(true)
    for (const id of WIDGET_IDS) windows.setAutoHidden(id, { hidden: false, reason: null })
    expect(w.isVisible()).toBe(false)
    windows.setUserHidden(false)
    expect(w.isVisible()).toBe(true)
  })

  it('shows nothing once disposed, even when rules are released while quitting', () => {
    start()
    windows.dispose()
    windows.setAutoHidden('battle', { hidden: false, reason: null })
    windows.setVisible('relative', true)
    windows.sendData(msg('relative'))
    expect(live()).toHaveLength(0)
  })
})

describe('OverlayWindows mouse', () => {
  it('stays click-through without the mouse hook outside edit mode', () => {
    start()
    const w = only()
    windows.setAutoHidden('battle', HIDDEN)
    windows.setAutoHidden('battle', { hidden: false, reason: null })
    vi.advanceTimersByTime(Z_ORDER_INTERVAL_MS * 3)
    fakeScreen.cursor = { x: 100, y: 300 }
    vi.advanceTimersByTime(MOUSE_POLL_MS * 3)
    expect(w.setIgnoreMouseEvents.mock.calls.every((c) => c.length === 1 && c[0] === true)).toBe(
      true
    )
  })

  it('polls the cursor only while editing', () => {
    start()
    const base = vi.getTimerCount()
    windows.setEditMode(true)
    // The cursor position and whether the game hides the cursor.
    expect(vi.getTimerCount()).toBe(base + 2)
    windows.setEditMode(false)
    expect(vi.getTimerCount()).toBe(base)
  })

  it('takes the mouse over an unlocked panel and gives it back within one tick', () => {
    start()
    const w = only()
    windows.setEditMode(true)
    expect(w.mouse).toEqual(FORWARD)
    // relative: 60..520 x 260..512.
    moveCursor(100, 300)
    expect(w.mouse).toEqual(CAPTURE)
    moveCursor(57, 300) // 3 DIP outside: kept while captured
    expect(w.mouse).toEqual(CAPTURE)
    moveCursor(40, 300)
    expect(w.mouse).toEqual(FORWARD)
    moveCursor(57, 300) // not captured: no margin
    expect(w.mouse).toEqual(FORWARD)
    windows.setEditMode(false)
    expect(w.mouse).toEqual(IGNORE)
  })

  it('never takes the mouse over a locked panel', () => {
    start()
    const w = only()
    windows.setEditMode(true)
    moveCursor(100, 300)
    expect(w.mouse).toEqual(CAPTURE)
    changeSettings((s) => (s.widgets.relative.locked = true))
    expect(w.mouse).toEqual(FORWARD)
    moveCursor(110, 310)
    expect(w.mouse).toEqual(FORWARD)
  })

  it('keeps the mouse while a drag lease is valid, wherever the cursor is', () => {
    start()
    const w = only()
    windows.setEditMode(true)
    moveCursor(1900, 1050)
    expect(w.mouse).toEqual(FORWARD)
    dragState(w, true)
    expect(w.mouse).toEqual(CAPTURE)
    vi.advanceTimersByTime(DRAG_LEASE_MS - 100)
    dragState(w, true) // heartbeat
    vi.advanceTimersByTime(DRAG_LEASE_MS - 100)
    expect(w.mouse).toEqual(CAPTURE)
    // The renderer hangs: the lease runs out.
    vi.advanceTimersByTime(200)
    expect(w.mouse).toEqual(FORWARD)
    dragState(w, true)
    dragState(w, false)
    expect(w.mouse).toEqual(FORWARD)
  })

  it('ignores drag states outside edit mode or from another document', () => {
    start()
    const w = only()
    dragState(w, true)
    expect(w.mouse).toEqual(IGNORE)
    windows.setEditMode(true)
    dragState(w, true, layoutOf(w).session + 1)
    expect(w.mouse).toEqual(FORWARD)
    fakeIpcMain.send(IPC.dragState, w.webContents, { session: 1, dragging: 'yes' })
    expect(w.mouse).toEqual(FORWARD)
  })

  it('re-applies the mode after every show', () => {
    useTwoDisplays()
    start()
    const w = display(2)
    windows.setAutoHidden('radar', HIDDEN)
    const calls = w.setIgnoreMouseEvents.mock.calls.length
    windows.setAutoHidden('radar', { hidden: false, reason: null })
    expect(w.setIgnoreMouseEvents.mock.calls.length).toBeGreaterThan(calls)
    expect(w.setIgnoreMouseEvents.mock.invocationCallOrder.at(-1)).toBeGreaterThan(
      w.showInactive.mock.invocationCallOrder.at(-1) as number
    )
  })

  it('drops the mouse at once on a crash, a hang, a reload, a suspend or leaving edit mode', () => {
    start()
    const w = only()
    const capture = (): void => {
      windows.setEditMode(true)
      moveCursor(100, 300)
      expect(w.mouse).toEqual(CAPTURE)
    }
    capture()
    w.webContents.crash()
    expect(w.mouse).toEqual(IGNORE)
    expect(w.isVisible()).toBe(false)
    vi.advanceTimersByTime(RELOAD_DELAY_MS)
    w.webContents.finishLoad()
    moveCursor(100, 300)
    expect(w.mouse).toEqual(CAPTURE)

    w.emit('unresponsive')
    expect(w.mouse).toEqual(IGNORE)
    expect(w.isVisible()).toBe(false)
    w.emit('responsive')
    moveCursor(100, 300)
    expect(w.mouse).toEqual(CAPTURE)

    w.webContents.reload()
    expect(w.mouse).toEqual(IGNORE)
    w.webContents.finishLoad()
    moveCursor(100, 300)
    expect(w.mouse).toEqual(CAPTURE)

    fakePowerMonitor.emit('suspend')
    expect(w.mouse).toEqual(IGNORE)
    fakePowerMonitor.emit('resume')
    vi.advanceTimersByTime(RESUME_DEBOUNCE_MS)
    moveCursor(100, 300)
    expect(w.mouse).toEqual(CAPTURE)

    windows.setEditMode(false)
    expect(w.mouse).toEqual(IGNORE)
  })
})

describe('OverlayWindows edit chips', () => {
  /** relative's chip: 180 x 20 at the top centre of its panel (60..520 x 260..512). */
  const CHIP = { x: 140, y: 4, width: 180, height: 20 }

  function chips(
    w: FakeBrowserWindow,
    list: Array<{ widget: WidgetId; rect: Rect }>,
    session = layoutOf(w).session
  ): void {
    fakeIpcMain.send(IPC.editChips, w.webContents, { session, chips: list })
  }

  function toggle(
    w: FakeBrowserWindow,
    widget: WidgetId,
    field: 'visible' | 'locked',
    value: boolean,
    session = layoutOf(w).session
  ): void {
    fakeIpcMain.send(IPC.widgetToggle, w.webContents, { session, widget, field, value })
  }

  it('takes the mouse over the chip of a locked panel, only there and only in edit mode', () => {
    start()
    const w = only()
    changeSettings((s) => (s.widgets.relative.locked = true))
    chips(w, [{ widget: 'relative', rect: CHIP }])
    windows.setEditMode(true)
    // Reported before edit mode: dropped. Nothing takes the mouse over the locked panel yet.
    moveCursor(210, 270)
    expect(w.mouse).toEqual(FORWARD)
    chips(w, [{ widget: 'relative', rect: CHIP }])
    expect(w.mouse).toEqual(CAPTURE)
    moveCursor(210, 300) // the rest of the locked panel
    expect(w.mouse).toEqual(FORWARD)
    moveCursor(379, 283) // the chip's far corner (200..380 x 264..284)
    expect(w.mouse).toEqual(CAPTURE)
    // Another document's chips count for nothing.
    chips(w, [{ widget: 'relative', rect: { ...CHIP, y: 40 } }], layoutOf(w).session + 1)
    moveCursor(210, 310)
    expect(w.mouse).toEqual(FORWARD)
    // Leaving edit mode drops them: the next edit mode needs a new report.
    windows.setEditMode(false)
    expect(w.mouse).toEqual(IGNORE)
    windows.setEditMode(true)
    moveCursor(210, 270)
    expect(w.mouse).toEqual(FORWARD)
  })

  it('clips a chip to its panel and ignores malformed reports', () => {
    start()
    const w = only()
    changeSettings((s) => (s.widgets.relative.locked = true))
    windows.setEditMode(true)
    // Reaches far out of the panel: only the part inside it counts.
    chips(w, [{ widget: 'relative', rect: { x: -200, y: -100, width: 400, height: 130 } }])
    moveCursor(30, 270)
    expect(w.mouse).toEqual(FORWARD)
    moveCursor(70, 270)
    expect(w.mouse).toEqual(CAPTURE)
    moveCursor(1000, 1000)
    fakeIpcMain.send(IPC.editChips, w.webContents, {
      session: layoutOf(w).session,
      chips: [{ widget: 'relative', rect: { x: 0, y: 0, width: -5, height: 10 } }]
    })
    // The bad report changed nothing: the last good one stands.
    moveCursor(70, 270)
    expect(w.mouse).toEqual(CAPTURE)
  })

  it('paints and hit-tests the radar above every other panel (B05)', () => {
    // The race layout: the alerts banner reaches into the radar (alerts 802,349; radar 883,234).
    settings.widgets.radar.bounds = { x: 883, y: 234, width: 220, height: 260 }
    settings.widgets.alerts.bounds = { x: 802, y: 349, width: 400, height: 70 }
    start()
    const w = only()
    expect(hosted(w).at(-1)).toBe('radar')
    windows.setEditMode(true)
    // Where both are, the radar is on top: a locked alerts panel under it changes nothing.
    changeSettings((s) => (s.widgets.alerts.locked = true))
    moveCursor(950, 360)
    expect(w.mouse).toEqual(CAPTURE)
    // And a locked radar keeps the unlocked alerts under it from taking the mouse there.
    changeSettings((s) => {
      s.widgets.alerts.locked = false
      s.widgets.radar.locked = true
    })
    expect(w.mouse).toEqual(FORWARD)
    moveCursor(820, 360) // alerts alone
    expect(w.mouse).toEqual(CAPTURE)
  })

  it('applies the eye and the padlock from the hosting window, in edit mode only', () => {
    useTwoDisplays()
    start()
    const w1 = display(1)
    const w2 = display(2)
    toggle(w1, 'relative', 'locked', true)
    expect(toggles).toEqual([])
    windows.setEditMode(true)
    // Not its window, another document, a malformed message: ignored.
    toggle(w2, 'relative', 'locked', true)
    toggle(w1, 'relative', 'locked', true, layoutOf(w1).session + 1)
    fakeIpcMain.send(IPC.widgetToggle, w1.webContents, {
      session: layoutOf(w1).session,
      widget: 'relative',
      field: 'bounds',
      value: true
    })
    expect(toggles).toEqual([])

    toggle(w1, 'relative', 'locked', true)
    expect(toggles).toEqual([['relative', 'locked', true]])
    expect(settings.widgets.relative.locked).toBe(true)

    // The eye: the radar becomes a ghost in its window, gets no data, and comes back.
    toggle(w2, 'radar', 'visible', false)
    expect(settings.widgets.radar.visible).toBe(false)
    expect(panel(w2, 'radar')?.ghost).toBe(true)
    expect(w2.isVisible()).toBe(true)
    windows.sendData(msg('radar'))
    expect(w2.webContents.sentOn(IPC.data)).toEqual([])
    toggle(w2, 'radar', 'visible', true)
    expect(panel(w2, 'radar')?.ghost).toBeUndefined()
    windows.sendData(msg('radar'))
    expect(w2.webContents.sentOn(IPC.data)).toHaveLength(1)

    // Hidden in edit mode, then edit mode ends: gone (its window too), not computed.
    toggle(w2, 'radar', 'visible', false)
    windows.setEditMode(false)
    expect(live()).toEqual([w1])
  })

  it('takes the mouse over a ghost only at its chip, and never moves or fits it', () => {
    start()
    const w = only()
    windows.setVisible('relative', false)
    windows.setEditMode(true)
    readyAll()
    expect(panel(w, 'relative')?.ghost).toBe(true)
    moveCursor(100, 400)
    expect(w.mouse).toEqual(FORWARD)
    chips(w, [{ widget: 'relative', rect: CHIP }])
    moveCursor(210, 270)
    expect(w.mouse).toEqual(CAPTURE)
    const before = { ...settings.widgets.relative.bounds }
    drag(w, 'relative', { x: 100, y: 100, width: 460, height: 252 })
    expect(committed).toEqual([])
    expect(settings.widgets.relative.bounds).toEqual(before)
    // Acknowledged all the same, so the renderer stops drawing it.
    expect(layoutOf(w).ackSeq).toBe(seqs.get(w))
  })
})

describe('OverlayWindows hidden cursor', () => {
  function sentHidden(w: FakeBrowserWindow): unknown[] {
    return w.webContents.sentOn(IPC.cursorHidden)
  }

  it('reads the cursor only while editing and says when the game hides it', () => {
    start()
    const w = only()
    cursorShowing = false
    vi.advanceTimersByTime(CURSOR_POLL_MS * 4)
    expect(sentHidden(w)).toEqual([])
    windows.setEditMode(true)
    vi.advanceTimersByTime(CURSOR_POLL_MS * (CURSOR_HIDDEN_READS - 1))
    // One hidden read is not enough (a blink while the game changes cursors).
    expect(sentHidden(w)).toEqual([])
    vi.advanceTimersByTime(CURSOR_POLL_MS)
    expect(sentHidden(w)).toEqual([true])
    expect(windows.cursorHidden).toBe(true)
    vi.advanceTimersByTime(CURSOR_POLL_MS * 4)
    expect(sentHidden(w)).toEqual([true])
    // The settings window took the focus: the cursor is back.
    cursorShowing = true
    vi.advanceTimersByTime(CURSOR_POLL_MS)
    expect(sentHidden(w)).toEqual([true, false])
    cursorShowing = false
    vi.advanceTimersByTime(CURSOR_POLL_MS * CURSOR_HIDDEN_READS)
    expect(sentHidden(w)).toEqual([true, false, true])
    // Leaving edit mode clears it at once and stops reading.
    windows.setEditMode(false)
    expect(sentHidden(w)).toEqual([true, false, true, false])
    expect(windows.cursorHidden).toBe(false)
    vi.advanceTimersByTime(CURSOR_POLL_MS * 4)
    expect(sentHidden(w)).toHaveLength(4)
  })

  it('never says hidden when the state is unknown', () => {
    start()
    const w = only()
    cursorShowing = null
    windows.setEditMode(true)
    vi.advanceTimersByTime(CURSOR_POLL_MS * 10)
    expect(sentHidden(w)).toEqual([])
    expect(windows.cursorHidden).toBe(false)
  })
})

describe('OverlayWindows commits', () => {
  it('saves a drag at once, in screen coordinates, and acknowledges it', () => {
    useTwoDisplays()
    start()
    windows.setEditMode(true)
    const w = display(2)
    drag(w, 'radar', { x: 300, y: 400, width: 250, height: 280 })
    expect(committed).toEqual([['radar', { x: 2220, y: 200, width: 250, height: 280 }]])
    expect(layoutOf(w).ackSeq).toBe(1)
    // Its own commit moves nothing on its own: no placement change.
    expect(panel(w, 'radar')).toEqual({
      widget: 'radar',
      rect: { x: 300, y: 400, width: 250, height: 280 },
      placement: 0
    })
  })

  it('keeps an accepted rect on its display and at least the minimum size', () => {
    start()
    windows.setEditMode(true)
    const w = only()
    drag(w, 'radar', { x: 1800.4, y: -50, width: 10, height: 10 })
    expect(committed).toEqual([['radar', { x: 1800, y: 0, width: 120, height: 140 }]])
  })

  it('acknowledges rejected commits: not editing, locked, foreign or stale geometry', () => {
    useTwoDisplays()
    start()
    const w1 = display(1)
    const w2 = display(2)
    const rect = { x: 10, y: 10, width: 220, height: 260 }
    drag(w2, 'radar', rect)
    expect(layoutOf(w2).ackSeq).toBe(1)

    windows.setEditMode(true)
    changeSettings((s) => (s.widgets.radar.locked = true))
    drag(w2, 'radar', rect)
    expect(layoutOf(w2).ackSeq).toBe(2)
    changeSettings((s) => (s.widgets.radar.locked = false))

    // radar is not hosted by display 1.
    drag(w1, 'radar', rect)
    expect(layoutOf(w1).ackSeq).toBe(1)

    // Display 2 moves: a drag computed against the old layout is rejected.
    const old = layoutOf(w2).revision
    fakeScreen.displays = [PRIMARY, { ...SECOND, bounds: { ...SECOND.bounds, y: -100 } }]
    fakeScreen.emit('display-metrics-changed', {}, fakeScreen.displays[1], ['bounds'])
    vi.advanceTimersByTime(DISPLAY_CHANGE_DEBOUNCE_MS)
    w2.becomeReady()
    drag(w2, 'radar', rect, old)
    expect(layoutOf(w2).ackSeq).toBe(3)
    expect(committed).toEqual([])
    drag(w2, 'radar', rect)
    expect(committed).toEqual([['radar', { x: 1930, y: -90, width: 220, height: 260 }]])
  })

  it('ignores another document and repeated sequence numbers without acknowledging them', () => {
    start()
    windows.setEditMode(true)
    const w = only()
    const count = layouts(w).length
    drag(w, 'relative', { x: 0, y: 0, width: 460, height: 252 })
    commit(
      w,
      { kind: 'drag', widget: 'relative', rect: settings.widgets.relative.bounds, revision: 1 },
      7
    )
    expect(layouts(w)).toHaveLength(count + 1)
    expect(layoutOf(w).ackSeq).toBe(1)
    fakeIpcMain.send(IPC.commitBounds, w.webContents, {
      session: layoutOf(w).session,
      seq: 1,
      widget: 'relative',
      kind: 'drag',
      revision: layoutOf(w).revision,
      rect: { x: 50, y: 50, width: 460, height: 252 }
    })
    fakeIpcMain.send(IPC.commitBounds, w.webContents, { garbage: true })
    expect(layouts(w)).toHaveLength(count + 1)
    expect(committed).toHaveLength(1)
  })

  it('debounces wheel resizes of free widgets and writes them when edit mode ends', () => {
    start()
    windows.setEditMode(true)
    const w = only()
    const rect = { x: 50, y: 250, width: 483, height: 265 }
    commit(w, { kind: 'wheel', widget: 'relative', rect, revision: layoutOf(w).revision })
    expect(panel(w, 'relative')?.rect).toEqual(rect)
    vi.advanceTimersByTime(COMMIT_DELAY_MS - 1)
    expect(committed).toEqual([])
    vi.advanceTimersByTime(1)
    expect(committed).toEqual([['relative', rect]])

    // Not for auto-height widgets (they change scale instead).
    commit(w, { kind: 'wheel', widget: 'standings', rect, revision: layoutOf(w).revision })
    vi.advanceTimersByTime(COMMIT_DELAY_MS)
    expect(committed).toHaveLength(1)

    const next = { ...rect, width: 507 }
    commit(w, { kind: 'wheel', widget: 'relative', rect: next, revision: layoutOf(w).revision })
    windows.setEditMode(false)
    expect(committed.at(-1)).toEqual(['relative', next])
  })

  it('writes a pending wheel resize on dispose', () => {
    start()
    windows.setEditMode(true)
    const w = only()
    const rect = { x: 50, y: 250, width: 483, height: 265 }
    commit(w, { kind: 'wheel', widget: 'relative', rect, revision: layoutOf(w).revision })
    windows.dispose()
    expect(committed).toEqual([['relative', rect]])
  })

  it('writes a pending wheel resize when asked (a layout about to be applied), once', () => {
    start()
    windows.setEditMode(true)
    const w = only()
    const rect = { x: 50, y: 250, width: 483, height: 265 }
    commit(w, { kind: 'wheel', widget: 'relative', rect, revision: layoutOf(w).revision })
    windows.flushPendingSaves()
    expect(committed).toEqual([['relative', rect]])
    vi.advanceTimersByTime(COMMIT_DELAY_MS)
    windows.reloadBoundsOf(['relative'])
    expect(committed).toHaveLength(1)
  })

  it('fits auto-height widgets within the work area and saves only the height, debounced', () => {
    start()
    const w = only()
    const count = layouts(w).length
    const saved = settings.widgets.standings.bounds
    commit(w, { kind: 'fit', widget: 'standings', height: 5_000 })
    // Main's copy only: the renderer already draws it.
    expect(layouts(w)).toHaveLength(count)
    vi.advanceTimersByTime(COMMIT_DELAY_MS)
    expect(committed).toEqual([['standings', { ...saved, height: 1040 - saved.y }]])

    // Free widgets and auto height off: nothing.
    commit(w, { kind: 'fit', widget: 'relative', height: 400 })
    changeSettings((s) => (s.widgets.battle.autoHeight = false))
    commit(w, { kind: 'fit', widget: 'battle', height: 400 })
    vi.advanceTimersByTime(COMMIT_DELAY_MS)
    expect(committed).toHaveLength(1)

    // The next layout carries the fitted height and every acknowledgement.
    windows.setEditMode(true)
    expect(panel(w, 'standings')?.rect.height).toBe(1040 - saved.y)
    expect(layoutOf(w).ackSeq).toBe(3)
  })

  it('sends the fitted rect on a settings change, so auto height off draws what main has', () => {
    start()
    const w = only()
    const saved = settings.widgets.standings.bounds
    commit(w, { kind: 'fit', widget: 'standings', height: 300 })
    // Not sent for the fit itself.
    expect(panel(w, 'standings')?.rect.height).toBe(saved.height)
    const count = layouts(w).length
    changeSettings((s) => (s.widgets.standings.autoHeight = false))
    expect(layouts(w)).toHaveLength(count + 1)
    expect(panel(w, 'standings')?.rect).toEqual({ ...saved, height: 300 })
    // Nothing new to send: no layout.
    changeSettings((s) => (s.widgets.standings.backgroundOpacity = 0.5))
    expect(layouts(w)).toHaveLength(count + 1)
  })

  it('a bottom-anchored fit keeps the bottom edge', () => {
    changeSettings((s) => (s.widgets.battle.anchor = 'bottom'))
    start()
    const w = only()
    const saved = settings.widgets.battle.bounds
    commit(w, { kind: 'fit', widget: 'battle', height: 100 })
    vi.advanceTimersByTime(COMMIT_DELAY_MS)
    expect(committed).toEqual([
      ['battle', { ...saved, y: saved.y + saved.height - 100, height: 100 }]
    ])
  })

  it('a fit keeps the saved place of a widget shown away from its missing display', () => {
    settings.widgets.standings.bounds = { x: 2500, y: 0, width: 540, height: 470 }
    start()
    const w = only()
    // Fallback: the default place on the primary display.
    expect(panel(w, 'standings')?.rect).toEqual({ x: 1340, y: 120, width: 540, height: 470 })
    commit(w, { kind: 'fit', widget: 'standings', height: 300 })
    vi.advanceTimersByTime(COMMIT_DELAY_MS)
    expect(committed).toEqual([['standings', { x: 2500, y: 0, width: 540, height: 300 }]])
  })

  it('moves a widget dropped on another display there, into a new window', () => {
    useTwoDisplays()
    settings.widgets.radar.bounds = { x: 560, y: 260, width: 220, height: 260 }
    start()
    expect(live()).toHaveLength(1)
    windows.broadcastStatus(LIVE)
    const payload = msg('relative')
    windows.sendData(payload)
    windows.setEditMode(true)
    const w1 = display(1)
    fakeScreen.cursor = { x: 2500, y: 300 }
    commit(w1, {
      kind: 'drop-outside',
      widget: 'relative',
      grab: { x: 10, y: 20 },
      size: { width: 460, height: 252 }
    })
    expect(committed).toEqual([['relative', { x: 2490, y: 280, width: 460, height: 252 }]])
    expect(hosted(w1)).not.toContain('relative')
    expect(layoutOf(w1).ackSeq).toBe(1)
    const w2 = display(2)
    w2.becomeReady()
    expect(panel(w2, 'relative')).toEqual({
      widget: 'relative',
      rect: { x: 570, y: 480, width: 460, height: 252 },
      placement: 1
    })
    expect(w2.webContents.sentOn(IPC.data)).toEqual([payload])
    expect(w2.isVisible()).toBe(true)
  })

  it('reuses the window of the target display, and drops back on the same display too', () => {
    useTwoDisplays()
    start()
    windows.setEditMode(true)
    const w1 = display(1)
    const w2 = display(2)
    fakeScreen.cursor = { x: 1950, y: 0 }
    commit(w2, {
      kind: 'drop-outside',
      widget: 'radar',
      grab: { x: 500, y: 500 },
      size: { width: 220, height: 260 }
    })
    // Clamped into the display under the cursor (the grab was clamped to the size first).
    expect(committed).toEqual([['radar', { x: 1920, y: -200, width: 220, height: 260 }]])
    expect(panel(w2, 'radar')?.placement).toBe(0)

    fakeScreen.cursor = { x: 900, y: 500 }
    commit(w2, {
      kind: 'drop-outside',
      widget: 'radar',
      grab: { x: 0, y: 0 },
      size: { width: 220, height: 260 }
    })
    expect(w2.destroyed).toBe(true)
    expect(panel(w1, 'radar')).toEqual({
      widget: 'radar',
      rect: { x: 900, y: 500, width: 220, height: 260 },
      placement: 1
    })
  })

  it('rejects drops outside edit mode or of locked widgets', () => {
    useTwoDisplays()
    start()
    const w2 = display(2)
    fakeScreen.cursor = { x: 900, y: 500 }
    const drop = (): void =>
      commit(w2, {
        kind: 'drop-outside',
        widget: 'radar',
        grab: { x: 0, y: 0 },
        size: { width: 220, height: 260 }
      })
    drop()
    windows.setEditMode(true)
    changeSettings((s) => (s.widgets.radar.locked = true))
    drop()
    expect(committed).toEqual([])
    expect(layoutOf(w2).ackSeq).toBe(2)
  })

  it('rejects a late drag after edit mode ended', () => {
    start()
    const w = only()
    windows.setEditMode(true)
    dragState(w, true)
    windows.setEditMode(false)
    expect(w.mouse).toEqual(IGNORE)
    drag(w, 'relative', { x: 0, y: 0, width: 460, height: 252 })
    expect(committed).toEqual([])
    expect(layoutOf(w).ackSeq).toBe(1)
  })

  it('turns a wheel notch over an auto-height widget into a scale step', () => {
    useTwoDisplays()
    start()
    const w1 = display(1)
    const step = (w: FakeBrowserWindow, widget: WidgetId, s: unknown, session?: number): void =>
      fakeIpcMain.send(IPC.scaleStep, w.webContents, {
        session: session ?? layoutOf(w).session,
        widget,
        step: s
      })
    step(w1, 'standings', 1)
    windows.setEditMode(true)
    step(w1, 'standings', 1)
    step(w1, 'battle', -1)
    step(w1, 'relative', 1) // free widget
    step(w1, 'standings', 2)
    step(w1, 'standings', 1, 9) // another document
    step(display(2), 'standings', 1) // not hosted there
    changeSettings((s) => (s.widgets.traffic.locked = true))
    step(w1, 'traffic', 1)
    expect(scaleSteps).toEqual([
      ['standings', 1],
      ['battle', -1]
    ])
  })
})

describe('OverlayWindows displays', () => {
  function emitDisplays(event: string, ...args: unknown[]): void {
    fakeScreen.emit(event, {}, ...args)
  }

  it('hides a removed display at once and moves its widgets to the primary without saving', () => {
    useTwoDisplays()
    start()
    const w2 = display(2)
    const removed = fakeScreen.displays[1]
    fakeScreen.displays = [structuredClone(PRIMARY)]
    emitDisplays('display-removed', removed)
    expect(w2.isVisible()).toBe(false)
    expect(w2.mouse).toEqual(IGNORE)
    vi.advanceTimersByTime(DISPLAY_CHANGE_DEBOUNCE_MS)
    expect(w2.destroyed).toBe(true)
    const w1 = display(1)
    expect(panel(w1, 'radar')).toEqual({
      widget: 'radar',
      rect: { x: 540, y: 260, width: 220, height: 260 },
      placement: 1
    })
    expect(committed).toEqual([])
    expect(settings.widgets.radar.bounds).toEqual(RADAR_ON_SECOND)

    // The monitor comes back: so does the widget.
    fakeScreen.displays = [structuredClone(PRIMARY), structuredClone(SECOND)]
    emitDisplays('display-added', fakeScreen.displays[1])
    vi.advanceTimersByTime(DISPLAY_CHANGE_DEBOUNCE_MS)
    readyAll()
    expect(hosted(display(2))).toEqual(['radar'])
    expect(panel(display(2), 'radar')?.placement).toBe(2)
    expect(hosted(display(1))).not.toContain('radar')
  })

  it('hides a display whose size or scale changes at once, not for a taskbar change', () => {
    useTwoDisplays()
    start()
    const w1 = display(1)
    const w2 = display(2)
    emitDisplays('display-metrics-changed', fakeScreen.displays[0], ['workArea'])
    expect(w1.isVisible()).toBe(true)
    fakeScreen.displays = [
      structuredClone(PRIMARY),
      { ...structuredClone(SECOND), scaleFactor: 1.25 }
    ]
    emitDisplays('display-metrics-changed', fakeScreen.displays[1], ['scaleFactor'])
    expect(w2.isVisible()).toBe(false)
    expect(w1.isVisible()).toBe(true)
    vi.advanceTimersByTime(DISPLAY_CHANGE_DEBOUNCE_MS)
    expect(w2.isVisible()).toBe(true)
    expect(layoutOf(w2).display.scaleFactor).toBe(1.25)
    expect(w2.webContents.invalidate).toHaveBeenCalled()
  })

  it('debounces display events and does nothing when the displays did not change', () => {
    useTwoDisplays()
    start()
    const counts = live().map((w) => layouts(w).length)
    emitDisplays('display-added', fakeScreen.displays[1])
    vi.advanceTimersByTime(DISPLAY_CHANGE_DEBOUNCE_MS - 1)
    emitDisplays('display-metrics-changed', fakeScreen.displays[0], ['workArea'])
    vi.advanceTimersByTime(DISPLAY_CHANGE_DEBOUNCE_MS)
    expect(live().map((w) => layouts(w).length)).toEqual(counts)
    expect(live().every((w) => w.setBounds.mock.calls.length === 0)).toBe(true)

    // A taskbar change: the new work area, nothing else.
    fakeScreen.displays = [
      { ...structuredClone(PRIMARY), workArea: { x: 0, y: 0, width: 1920, height: 1000 } },
      structuredClone(SECOND)
    ]
    emitDisplays('display-metrics-changed', fakeScreen.displays[0], ['workArea'])
    emitDisplays('display-metrics-changed', fakeScreen.displays[0], ['workArea'])
    vi.advanceTimersByTime(DISPLAY_CHANGE_DEBOUNCE_MS)
    expect(layouts(display(1))).toHaveLength((counts[0] as number) + 1)
    expect(layoutOf(display(1)).display.workArea.height).toBe(1000)
    expect(panel(display(1), 'relative')?.placement).toBe(0)
  })

  it('reuses a window when its display only changes id, without reloading it', () => {
    useTwoDisplays()
    start()
    const w2 = display(2)
    const old = fakeScreen.displays[1]
    fakeScreen.displays = [structuredClone(PRIMARY), { ...structuredClone(SECOND), id: 3 }]
    emitDisplays('display-removed', old)
    emitDisplays('display-added', fakeScreen.displays[1])
    vi.advanceTimersByTime(DISPLAY_CHANGE_DEBOUNCE_MS)
    expect(live()).toHaveLength(2)
    expect(w2.destroyed).toBe(false)
    expect(w2.webContents.reload).not.toHaveBeenCalled()
    expect(w2.loadFile).toHaveBeenCalledTimes(1)
    expect(w2.isVisible()).toBe(true)
    expect(layoutOf(w2).display.id).toBe(3)
    expect(panel(w2, 'radar')?.placement).toBe(0)
  })

  it('bumps the placement of panels whose display moved', () => {
    useTwoDisplays()
    start()
    const w2 = display(2)
    fakeScreen.displays = [
      structuredClone(PRIMARY),
      {
        ...structuredClone(SECOND),
        bounds: { ...SECOND.bounds, y: 0 },
        workArea: { ...SECOND.workArea, y: 0 }
      }
    ]
    emitDisplays('display-metrics-changed', fakeScreen.displays[1], ['bounds'])
    vi.advanceTimersByTime(DISPLAY_CHANGE_DEBOUNCE_MS)
    expect(w2.getBounds()).toEqual({ ...SECOND.bounds, y: 0 })
    expect(panel(w2, 'radar')).toEqual({
      widget: 'radar',
      rect: { x: 180, y: 100, width: 220, height: 260 },
      placement: 1
    })
    expect(panel(display(1), 'relative')?.placement).toBe(0)
  })

  it('writes pending saves before re-placing the widgets', () => {
    start()
    windows.setEditMode(true)
    const w = only()
    const rect = { x: 50, y: 250, width: 483, height: 265 }
    commit(w, { kind: 'wheel', widget: 'relative', rect, revision: layoutOf(w).revision })
    emitDisplays('display-added', PRIMARY)
    vi.advanceTimersByTime(DISPLAY_CHANGE_DEBOUNCE_MS)
    expect(committed).toEqual([['relative', rect]])
  })

  it('ignores an empty display list until the next event', () => {
    start()
    const w = only()
    fakeScreen.displays = []
    emitDisplays('display-removed', PRIMARY)
    vi.advanceTimersByTime(DISPLAY_CHANGE_DEBOUNCE_MS)
    expect(w.destroyed).toBe(false)
    expect(w.isVisible()).toBe(false)
    fakeScreen.displays = [structuredClone(PRIMARY)]
    emitDisplays('display-added', PRIMARY)
    vi.advanceTimersByTime(DISPLAY_CHANGE_DEBOUNCE_MS)
    expect(w.isVisible()).toBe(true)
  })
})

describe('OverlayWindows recovery', () => {
  it('reloadBounds moves a widget to its saved bounds and bumps its placement', () => {
    start()
    windows.setEditMode(true)
    const w = only()
    commit(w, {
      kind: 'wheel',
      widget: 'relative',
      rect: { x: 0, y: 0, width: 500, height: 300 },
      revision: layoutOf(w).revision
    })
    settings.widgets.relative.bounds = { x: 10, y: 20, width: 460, height: 252 }
    windows.reloadBounds('relative')
    expect(panel(w, 'relative')).toEqual({
      widget: 'relative',
      rect: { x: 10, y: 20, width: 460, height: 252 },
      placement: 1
    })
    // The reset wins over the pending wheel save.
    vi.advanceTimersByTime(COMMIT_DELAY_MS)
    expect(committed).toEqual([])
  })

  it('marks the layouts of a layout applied: its settings follow (and only those)', () => {
    start()
    const w = only()
    settings.widgets.relative.bounds = { x: 30, y: 40, width: 460, height: 252 }
    windows.reloadBoundsOf(['relative'], true)
    expect(layoutOf(w).settingsFollow).toBe(true)
    settings.widgets.relative.bounds = { x: 60, y: 40, width: 460, height: 252 }
    windows.reloadBoundsOf(['relative'])
    expect(layoutOf(w)).not.toHaveProperty('settingsFollow')
  })

  it('reloads a crashed renderer after a delay and gives up after repeated crashes', () => {
    start()
    let w = only()
    for (let n = 0; n < 5; n++) {
      w.webContents.crash()
      expect(w.isVisible()).toBe(false)
      vi.advanceTimersByTime(RELOAD_DELAY_MS)
      expect(w.webContents.reload).toHaveBeenCalledTimes(n + 1)
    }
    w.webContents.finishLoad()
    expect(w.isVisible()).toBe(true)
    w.webContents.crash()
    expect(w.destroyed).toBe(true)
    expect(live()).toHaveLength(0)
    vi.advanceTimersByTime(RELOAD_DELAY_MS * 5)
    expect(live()).toHaveLength(0)

    // Enabling one of its widgets is the retry.
    windows.setVisible('relative', true)
    w = only()
    w.becomeReady()
    expect(w.isVisible()).toBe(true)
  })

  it('treats a failed page load like a crash, but not an aborted one', () => {
    start()
    const w = only()
    w.webContents.emit('did-fail-load', {}, -3, 'ERR_ABORTED', 'file://x', true)
    w.webContents.emit('did-fail-load', {}, -105, 'ERR_NAME_NOT_RESOLVED', 'file://x', false)
    expect(w.isVisible()).toBe(true)
    w.webContents.emit('did-fail-load', {}, -6, 'ERR_FILE_NOT_FOUND', 'file://x', true)
    expect(w.isVisible()).toBe(false)
    vi.advanceTimersByTime(RELOAD_DELAY_MS)
    expect(w.webContents.reload).toHaveBeenCalledTimes(1)
    w.webContents.finishLoad()
    expect(w.isVisible()).toBe(true)
  })

  it('finds a hung renderer without input events: a probe left unanswered', async () => {
    start()
    const w = only()
    let answer: (value: unknown) => void = () => {}
    w.webContents.executeJavaScript.mockImplementation(
      () => new Promise((resolve) => (answer = resolve))
    )
    vi.advanceTimersByTime(Z_ORDER_INTERVAL_MS)
    expect(w.webContents.executeJavaScript).toHaveBeenCalledTimes(1)
    // One probe at a time; still within PROBE_TIMEOUT_MS of it.
    vi.advanceTimersByTime(Z_ORDER_INTERVAL_MS * 2)
    expect(w.webContents.executeJavaScript).toHaveBeenCalledTimes(1)
    expect(w.isVisible()).toBe(true)
    vi.advanceTimersByTime(Z_ORDER_INTERVAL_MS)
    expect(Z_ORDER_INTERVAL_MS * 3).toBeGreaterThanOrEqual(PROBE_TIMEOUT_MS)
    expect(w.isVisible()).toBe(false)
    expect(w.mouse).toEqual(IGNORE)
    answer(0)
    await Promise.resolve()
    expect(w.isVisible()).toBe(true)

    // Never answers: killed, then reloaded like a crash.
    vi.advanceTimersByTime(Z_ORDER_INTERVAL_MS * 4)
    expect(w.isVisible()).toBe(false)
    vi.advanceTimersByTime(UNRESPONSIVE_KILL_MS)
    expect(w.webContents.forcefullyCrashRenderer).toHaveBeenCalledTimes(1)
  })

  it('ignores the answer to a probe of an older document', async () => {
    start()
    const w = only()
    let answer: (value: unknown) => void = () => {}
    w.webContents.executeJavaScript.mockImplementationOnce(
      () => new Promise((resolve) => (answer = resolve))
    )
    vi.advanceTimersByTime(Z_ORDER_INTERVAL_MS)
    w.webContents.reload()
    w.webContents.finishLoad()
    w.emit('unresponsive')
    answer(0)
    await Promise.resolve()
    expect(w.isVisible()).toBe(false)
  })

  it('hides a hung renderer and kills it if it does not recover', () => {
    start()
    const w = only()
    w.emit('unresponsive')
    expect(w.isVisible()).toBe(false)
    windows.sendData(msg('relative'))
    expect(w.webContents.sentOn(IPC.data)).toEqual([])
    w.emit('responsive')
    expect(w.isVisible()).toBe(true)
    expect(w.webContents.sentOn(IPC.data)).toHaveLength(1)
    vi.advanceTimersByTime(UNRESPONSIVE_KILL_MS)
    expect(w.webContents.forcefullyCrashRenderer).not.toHaveBeenCalled()

    // Really hung: the liveness probes go unanswered too.
    w.webContents.executeJavaScript.mockImplementation(() => new Promise(() => {}))
    w.emit('unresponsive')
    vi.advanceTimersByTime(UNRESPONSIVE_KILL_MS)
    expect(w.webContents.forcefullyCrashRenderer).toHaveBeenCalledTimes(1)
    w.webContents.crash('killed')
    vi.advanceTimersByTime(RELOAD_DELAY_MS)
    w.webContents.finishLoad()
    expect(w.isVisible()).toBe(true)
  })

  it('hides every window on a GPU loss and recreates them', () => {
    useTwoDisplays()
    start()
    const before = live()
    fakeApp.emit('child-process-gone', {}, { type: 'Utility', reason: 'crashed' })
    expect(before.every((w) => w.isVisible())).toBe(true)
    fakeApp.gpuCompositing = 'disabled_software'
    fakeApp.emit('child-process-gone', {}, { type: 'GPU', reason: 'crashed' })
    expect(before.every((w) => !w.isVisible() && w.mouse.ignore)).toBe(true)
    vi.advanceTimersByTime(GPU_RECREATE_DELAY_MS)
    expect(before.every((w) => w.destroyed)).toBe(true)
    expect(live()).toHaveLength(2)
    readyAll()
    expect(live().every((w) => w.isVisible())).toBe(true)
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('GPU compositing is off'))
  })

  it('logs the GPU compositing status once a window has loaded, not at start', () => {
    vi.stubEnv('OVERLAY_PERF', '1')
    // What Electron reports before the GPU process has drawn anything.
    fakeApp.gpuCompositing = 'disabled_software'
    windows.start()
    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('GPU compositing'))
    fakeApp.gpuCompositing = 'enabled'
    readyAll()
    expect(console.log).toHaveBeenCalledWith('[overlay] GPU compositing: enabled')
    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('GPU compositing'))
    // Once.
    only().webContents.reload()
    only().webContents.finishLoad()
    const logged = vi
      .mocked(console.log)
      .mock.calls.filter((c) => String(c[0]).includes('GPU compositing'))
    expect(logged).toHaveLength(1)
  })

  it('hides everything while suspended or locked and shows it again after resuming', () => {
    start()
    const w = only()
    for (const [off, on] of [
      ['suspend', 'resume'],
      ['lock-screen', 'unlock-screen']
    ] as const) {
      fakePowerMonitor.emit(off)
      expect(w.isVisible()).toBe(false)
      windows.setAutoHidden('battle', HIDDEN)
      windows.setAutoHidden('battle', { hidden: false, reason: null })
      expect(w.isVisible()).toBe(false)
      fakePowerMonitor.emit(on)
      vi.advanceTimersByTime(RESUME_DEBOUNCE_MS - 1)
      expect(w.isVisible()).toBe(false)
      vi.advanceTimersByTime(1)
      expect(w.isVisible()).toBe(true)
    }
    expect(w.webContents.invalidate).toHaveBeenCalled()
  })

  // Electron 44 / Windows: with throttling off across a hide() and showInactive(), Chromium's
  // input child window stays hidden and Windows eats every press on the overlay from then on.
  it('throttles a window only while hidden, on every path that hides it', () => {
    start()
    const w = only()
    const wc = w.webContents
    expect(w.isVisible()).toBe(true)
    // The first show needs nothing: the window was created hidden at full rate.
    expect(wc.throttled).not.toBe(true)
    const OUT: AutoHiddenState = { hidden: true, reason: 'out-of-car' }
    const IN: AutoHiddenState = { hidden: false, reason: null }
    const paths: [string, () => void, () => void][] = [
      ['user', () => windows.setUserHidden(true), () => windows.setUserHidden(false)],
      [
        'rules',
        () => {
          for (const id of WIDGET_IDS) windows.setAutoHidden(id, OUT)
        },
        () => {
          for (const id of WIDGET_IDS) windows.setAutoHidden(id, IN)
        }
      ],
      [
        'lock',
        () => fakePowerMonitor.emit('lock-screen'),
        () => {
          fakePowerMonitor.emit('unlock-screen')
          vi.advanceTimersByTime(RESUME_DEBOUNCE_MS)
        }
      ],
      ['hang', () => w.emit('unresponsive'), () => w.emit('responsive')]
    ]
    for (const [name, hide, show] of paths) {
      w.hide.mockClear()
      w.showInactive.mockClear()
      wc.setBackgroundThrottling.mockClear()
      hide()
      expect(w.isVisible(), name).toBe(false)
      expect(wc.throttled, name).toBe(true)
      // Before the hide, not after it.
      expect(wc.setBackgroundThrottling.mock.invocationCallOrder[0], name).toBeLessThan(
        w.hide.mock.invocationCallOrder[0] as number
      )
      show()
      expect(w.isVisible(), name).toBe(true)
      expect(wc.throttled, name).toBe(false)
      // After the show, not before it.
      expect(wc.setBackgroundThrottling.mock.invocationCallOrder.at(-1), name).toBeGreaterThan(
        w.showInactive.mock.invocationCallOrder[0] as number
      )
    }
  })

  it('still notices a hang while hidden and throttled', () => {
    start()
    const w = only()
    windows.setUserHidden(true)
    expect(w.webContents.throttled).toBe(true)
    w.webContents.executeJavaScript.mockImplementation(() => new Promise(() => {}))
    vi.advanceTimersByTime(Z_ORDER_INTERVAL_MS + PROBE_TIMEOUT_MS + Z_ORDER_INTERVAL_MS)
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('renderer does not answer'))
  })

  it('merges a GPU loss during a pending resume into recreate and resync', () => {
    start()
    const w = only()
    fakePowerMonitor.emit('suspend')
    fakePowerMonitor.emit('resume')
    fakeApp.emit('child-process-gone', {}, { type: 'GPU', reason: 'crashed' })
    vi.advanceTimersByTime(GPU_RECREATE_DELAY_MS)
    expect(w.destroyed).toBe(true)
    readyAll()
    expect(only().isVisible()).toBe(true)
  })

  it('re-asserts z-order and its display rect, at most three times per target', () => {
    start()
    const w = only()
    w.moveTop.mockClear()
    vi.advanceTimersByTime(Z_ORDER_INTERVAL_MS)
    expect(w.moveTop).toHaveBeenCalledTimes(1)
    w.bounds = { x: 0, y: 0, width: 2880, height: 1620 }
    w.setBounds.mockImplementation(() => {})
    vi.advanceTimersByTime(Z_ORDER_INTERVAL_MS * 2 * BOUNDS_GUARD_MAX_TRIES)
    expect(w.setBounds).toHaveBeenCalledTimes(BOUNDS_GUARD_MAX_TRIES)
    expect(w.setBounds).toHaveBeenCalledWith(PRIMARY.bounds)
    const stuck = vi
      .mocked(console.warn)
      .mock.calls.filter((c) => /bounds stuck/.test(String(c[0])))
    expect(stuck).toHaveLength(1)
  })
})

describe('OverlayWindows dispose', () => {
  it('saves pending commits and leaves no window, timer or listener behind', () => {
    vi.stubEnv('OVERLAY_PERF', '1')
    useTwoDisplays()
    start()
    windows.setEditMode(true)
    const w1 = display(1)
    commit(w1, {
      kind: 'wheel',
      widget: 'relative',
      rect: { x: 50, y: 250, width: 483, height: 265 },
      revision: layoutOf(w1).revision
    })
    commit(w1, { kind: 'fit', widget: 'standings', height: 300 })
    display(2).webContents.crash()
    display(2).emit('unresponsive')
    fakePowerMonitor.emit('resume')
    fakeScreen.emit('display-added', {}, SECOND)
    windows.dispose()
    expect(committed.map(([id]) => id)).toEqual(['relative', 'standings'])
    expect(vi.getTimerCount()).toBe(0)
    expect(live()).toHaveLength(0)
    expect(fakeIpcMain.listeners.size).toBe(0)
    expect(fakeScreen.totalListeners()).toBe(0)
    expect(fakePowerMonitor.totalListeners()).toBe(0)
    expect(fakeApp.totalListeners()).toBe(0)
  })
})

describe('OverlayWindows hidden by the user', () => {
  it('hides every window click-through, and shows them again inactive only', () => {
    useTwoDisplays()
    start()
    const all = live()
    for (const w of all) w.showInactive.mockClear()
    windows.setUserHidden(true)
    expect(windows.userHidden).toBe(true)
    for (const w of all) {
      expect(w.isVisible()).toBe(false)
      expect(w.hide).toHaveBeenCalled()
      expect(w.mouse).toEqual(IGNORE)
    }
    // Not a recovery: the z-order guard leaves hidden windows alone.
    vi.advanceTimersByTime(Z_ORDER_INTERVAL_MS)
    expect(all.every((w) => !w.isVisible())).toBe(true)

    windows.setUserHidden(false)
    expect(windows.userHidden).toBe(false)
    for (const w of all) {
      expect(w.isVisible()).toBe(true)
      expect(w.showInactive).toHaveBeenCalledOnce()
      expect(w.mouse).toEqual(IGNORE)
    }
  })

  it('sends no widget data while hidden and hands the latest over when shown', () => {
    useTwoDisplays()
    start()
    windows.broadcastStatus(LIVE)
    windows.setUserHidden(true)
    const older = msg('standings')
    const latest = msg('standings')
    const radar = msg('radar')
    windows.sendData(older)
    windows.sendData(latest)
    windows.sendData(radar)
    expect(display(1).webContents.sentOn(IPC.data)).toEqual([])
    expect(display(2).webContents.sentOn(IPC.data)).toEqual([])
    // Everything else still arrives, so the windows are current when shown.
    windows.broadcastSettings(settings)
    windows.setAutoHidden('battle', HIDDEN)
    expect(display(1).webContents.sentOn(IPC.settings)).toEqual([settings])
    expect(display(1).webContents.sentOn(IPC.autoHidden)).toHaveLength(1)

    windows.setUserHidden(false)
    expect(display(1).webContents.sentOn(IPC.data)).toEqual([latest])
    expect(display(2).webContents.sentOn(IPC.data)).toEqual([radar])
  })

  it('no recovery shows a hidden window: reload, hang, resume, display change, GPU loss', () => {
    start()
    const w = only()
    windows.setUserHidden(true)

    w.webContents.crash()
    vi.advanceTimersByTime(RELOAD_DELAY_MS)
    w.webContents.finishLoad()
    expect(w.isVisible()).toBe(false)

    w.webContents.executeJavaScript.mockImplementationOnce(() => new Promise(() => {}))
    w.emit('unresponsive')
    w.emit('responsive')
    expect(w.isVisible()).toBe(false)

    fakePowerMonitor.emit('suspend')
    fakePowerMonitor.emit('resume')
    vi.advanceTimersByTime(RESUME_DEBOUNCE_MS)
    expect(w.isVisible()).toBe(false)

    fakeScreen.emit('display-metrics-changed', {}, PRIMARY, ['scaleFactor'])
    vi.advanceTimersByTime(DISPLAY_CHANGE_DEBOUNCE_MS)
    expect(w.isVisible()).toBe(false)

    fakeApp.emit('child-process-gone', {}, { type: 'GPU', reason: 'crashed' })
    vi.advanceTimersByTime(GPU_RECREATE_DELAY_MS)
    readyAll()
    expect(w.destroyed).toBe(true)
    expect(only().isVisible()).toBe(false)
    expect(only().mouse).toEqual(IGNORE)

    windows.setUserHidden(false)
    expect(only().isVisible()).toBe(true)
  })

  it('a window that is not healthy when shown again waits for its recovery', () => {
    start()
    const w = only()
    windows.setUserHidden(true)
    w.webContents.crash()
    windows.setUserHidden(false)
    expect(w.isVisible()).toBe(false)
    vi.advanceTimersByTime(RELOAD_DELAY_MS)
    w.webContents.finishLoad()
    expect(w.isVisible()).toBe(true)
  })

  it('widgets enabled while hidden stay hidden, in a new window too', () => {
    useTwoDisplays()
    settings.widgets.radar.visible = false
    start()
    expect(live()).toHaveLength(1)
    windows.setUserHidden(true)
    settings.widgets.radar.visible = true
    windows.setVisible('radar', true)
    readyAll()
    expect(live()).toHaveLength(2)
    expect(live().every((w) => !w.isVisible())).toBe(true)
    windows.setUserHidden(false)
    expect(live().every((w) => w.isVisible())).toBe(true)
  })

  it('hiding leaves edit mode first: the mouse goes back and pending saves are written', () => {
    start()
    const w = only()
    windows.setEditMode(true)
    const rect = { x: 50, y: 250, width: 483, height: 265 }
    commit(w, { kind: 'wheel', widget: 'relative', rect, revision: layoutOf(w).revision })
    moveCursor(100, 300)
    expect(w.mouse).toEqual(CAPTURE)

    windows.setUserHidden(true)
    expect(windows.editMode).toBe(false)
    expect(w.webContents.sentOn(IPC.editMode).at(-1)).toBe(false)
    expect(committed).toEqual([['relative', rect]])
    expect(w.mouse).toEqual(IGNORE)
    expect(w.isVisible()).toBe(false)
    // The poll stopped with edit mode.
    moveCursor(100, 300)
    expect(w.mouse).toEqual(IGNORE)
  })

  it('entering edit mode shows the overlay first', () => {
    start()
    const w = only()
    windows.setUserHidden(true)
    windows.setEditMode(true)
    expect(windows.userHidden).toBe(false)
    expect(windows.editMode).toBe(true)
    expect(w.isVisible()).toBe(true)
    moveCursor(100, 300)
    expect(w.mouse).toEqual(CAPTURE)
  })

  it('hidden before the windows exist: they start hidden', () => {
    windows.setUserHidden(true)
    start()
    expect(only().isVisible()).toBe(false)
    windows.setUserHidden(false)
    expect(only().isVisible()).toBe(true)
  })
})
