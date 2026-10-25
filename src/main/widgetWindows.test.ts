import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { messagesFor, widgetTitle } from '@shared/i18n'
import { IPC, type AutoHiddenState, type EditDragMessage } from '@shared/ipc'
import { createDefaultSettings } from '@shared/settings'
import type { OverlaySettings, OverlayStatus, Rect, WidgetDataMessage } from '@shared/types'
import { WIDGET_DEFS, type WidgetId } from '@shared/widgets'
import {
  FakeBrowserWindow,
  FakeWebContents,
  fakeIpcMain,
  fakeScreen,
  resetFakeElectron
} from './testing/fakeElectron'
import { WidgetWindows } from './widgetWindows'

vi.mock('electron', async () => (await import('./testing/fakeElectron')).electronModule)

let settings: OverlaySettings
let committed: Array<[WidgetId, Rect]>
let scaleSteps: Array<[WidgetId, 1 | -1]>
let windows: WidgetWindows

/** The newest window of a widget (a recreated one replaces the old), created in Spanish. */
function win(id: WidgetId): FakeBrowserWindow {
  const title = `${widgetTitle(messagesFor('es'), id)} ·`
  const w = FakeBrowserWindow.all
    .filter((w) => (w.options.title as string).startsWith(title))
    .at(-1)
  if (!w) throw new Error(`no window for ${id}`)
  return w
}

function drag(
  id: WidgetId,
  phase: EditDragMessage['phase'],
  mode: EditDragMessage['mode'],
  noSnap = false
): void {
  fakeIpcMain.send(IPC.editDrag, win(id).webContents, { phase, mode, dx: 0, dy: 0, noSnap })
}

function contentSize(id: WidgetId, height: unknown): void {
  fakeIpcMain.send(IPC.contentSize, win(id).webContents, { height })
}

function wheel(id: WidgetId, step: unknown): void {
  fakeIpcMain.send(IPC.editScale, win(id).webContents, { step })
}

/** Values sent to a widget's renderer on a channel. */
function sent(id: WidgetId, channel: string): unknown[] {
  return win(id)
    .webContents.send.mock.calls.filter((c) => c[0] === channel)
    .map((c) => c[1])
}

function changeSettings(mutate: (s: OverlaySettings) => void): void {
  settings = structuredClone(settings)
  mutate(settings)
  windows.applySettings(settings)
}

/** Last value given to setIgnoreMouseEvents. */
function ignoring(id: WidgetId): unknown {
  return win(id).setIgnoreMouseEvents.mock.lastCall?.[0]
}

function setLocked(id: WidgetId, locked: boolean): void {
  settings = structuredClone(settings)
  settings.widgets[id].locked = locked
  windows.applySettings(settings)
}

beforeEach(() => {
  resetFakeElectron()
  settings = createDefaultSettings()
  committed = []
  scaleSteps = []
  windows = new WidgetWindows({
    getSettings: () => settings,
    onBoundsCommitted: (id, bounds) => committed.push([id, bounds]),
    onScaleStep: (id, step) => scaleSteps.push([id, step])
  })
  windows.start()
  for (const w of FakeBrowserWindow.all) w.becomeReady()
})

afterEach(() => windows.dispose())

describe('WidgetWindows locks', () => {
  it('only unlocked widgets take the mouse in edit mode', () => {
    expect(ignoring('relative')).toBe(true)
    expect(ignoring('radar')).toBe(true)
    setLocked('radar', true)
    windows.setEditMode(true)
    expect(ignoring('relative')).toBe(false)
    expect(ignoring('radar')).toBe(true)
    windows.setEditMode(false)
    expect(ignoring('relative')).toBe(true)
  })

  it('re-applies a lock change while editing, without redundant calls', () => {
    windows.setEditMode(true)
    const calls = win('radar').setIgnoreMouseEvents.mock.calls.length
    windows.applySettings(settings)
    expect(win('radar').setIgnoreMouseEvents.mock.calls.length).toBe(calls)
    setLocked('radar', true)
    expect(ignoring('radar')).toBe(true)
    setLocked('radar', false)
    expect(ignoring('radar')).toBe(false)
  })

  it('ignores an edit drag from a locked widget', () => {
    setLocked('relative', true)
    windows.setEditMode(true)
    const before = win('relative').getBounds()
    drag('relative', 'start', 'move')
    fakeScreen.cursor = { x: 100, y: 50 }
    drag('relative', 'move', 'move')
    drag('relative', 'end', 'move')
    expect(win('relative').getBounds()).toEqual(before)
    expect(committed).toEqual([])
  })

  it('ends and commits a drag when its widget gets locked', () => {
    windows.setEditMode(true)
    const before = win('relative').getBounds()
    drag('relative', 'start', 'move')
    fakeScreen.cursor = { x: 100, y: 50 }
    drag('relative', 'move', 'move')
    setLocked('relative', true)
    const moved = { ...before, x: before.x + 100, y: before.y + 50 }
    expect(committed).toEqual([['relative', moved]])
    expect(ignoring('relative')).toBe(true)
    // Further messages of that drag change nothing.
    fakeScreen.cursor = { x: 300, y: 300 }
    drag('relative', 'move', 'move')
    expect(win('relative').getBounds()).toEqual(moved)
  })

  it('applies the lock to a window that becomes ready while editing', () => {
    settings.widgets.radar.locked = true
    windows.setEditMode(true)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // Fake timers swallow the delayed recreate; showing it again recreates it at once.
    vi.useFakeTimers()
    try {
      win('radar').webContents.emit('render-process-gone', {}, { reason: 'crashed' })
      settings.widgets.radar.locked = false
      windows.setVisible('radar', true)
    } finally {
      vi.useRealTimers()
    }
    const recreated = FakeBrowserWindow.all.at(-1)
    expect(recreated?.options.title).toMatch(/^Radar/)
    recreated?.becomeReady()
    expect(recreated?.setIgnoreMouseEvents.mock.lastCall?.[0]).toBe(false)
  })
})

describe('WidgetWindows settings', () => {
  it('sends the settings to every widget window', () => {
    windows.broadcastSettings(settings)
    for (const w of FakeBrowserWindow.all) {
      expect(w.webContents.send).toHaveBeenCalledWith(IPC.settings, settings)
    }
  })

  it('reloadBounds moves the window to the saved bounds and drops its drag', () => {
    windows.setEditMode(true)
    drag('radar', 'start', 'move')
    fakeScreen.cursor = { x: 40, y: 40 }
    drag('radar', 'move', 'move')
    settings = structuredClone(settings)
    settings.widgets.radar.bounds = { x: 10, y: 20, width: 200, height: 240 }
    windows.reloadBounds('radar')
    expect(win('radar').getBounds()).toEqual({ x: 10, y: 20, width: 200, height: 240 })
    drag('radar', 'end', 'move')
    expect(committed).toEqual([])
    expect(win('radar').getBounds()).toEqual({ x: 10, y: 20, width: 200, height: 240 })
  })

  it('maps a sender to its widget, and nothing else', () => {
    expect(windows.widgetOf(win('radar').webContents as never)).toBe('radar')
    expect(windows.widgetOf(new FakeWebContents() as never)).toBeUndefined()
  })
})

describe('WidgetWindows auto height', () => {
  // Restored from the defaults into the primary work area (0, 0, 1920 x 1040).
  const STANDINGS = { x: 1340, y: 120, width: 540, height: 470 }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    windows.dispose()
    vi.useRealTimers()
  })

  it('grows at once, and only auto-height widgets with auto height on are fitted', () => {
    expect(win('standings').getBounds()).toEqual(STANDINGS)
    contentSize('standings', 600.4)
    expect(win('standings').getBounds()).toEqual({ ...STANDINGS, height: 600 })

    const relative = win('relative').getBounds()
    contentSize('relative', 600)
    expect(win('relative').getBounds()).toEqual(relative)

    changeSettings((s) => (s.widgets.battle.autoHeight = false))
    const battle = win('battle').getBounds()
    contentSize('battle', 400)
    expect(win('battle').getBounds()).toEqual(battle)
    // Remembered: turning auto height on fits it right away.
    changeSettings((s) => (s.widgets.battle.autoHeight = true))
    expect(win('battle').getBounds()).toEqual({ ...battle, height: 400 })
  })

  it('fits the first report at once, then shrinks only after 1.5 s without growth', () => {
    contentSize('standings', 470) // first report: already the window's height
    contentSize('standings', 300)
    vi.advanceTimersByTime(1_000)
    contentSize('standings', 296)
    vi.advanceTimersByTime(499)
    expect(win('standings').getBounds().height).toBe(470)
    vi.advanceTimersByTime(1)
    expect(win('standings').getBounds()).toEqual({ ...STANDINGS, height: 296 })

    contentSize('standings', 200)
    vi.advanceTimersByTime(1_000)
    contentSize('standings', 320)
    expect(win('standings').getBounds().height).toBe(320)
    vi.advanceTimersByTime(5_000)
    expect(win('standings').getBounds().height).toBe(320)
  })

  it('fits a window that is not on screen both ways at once, so it shows at the right height', () => {
    windows.setVisible('standings', false)
    contentSize('standings', 300)
    expect(win('standings').getBounds()).toEqual({ ...STANDINGS, height: 300 })
    windows.setVisible('standings', true)
    contentSize('standings', 280)
    expect(win('standings').getBounds().height).toBe(300)
  })

  it('stays inside the work area, keeping the top or the bottom edge', () => {
    contentSize('standings', 5_000)
    expect(win('standings').getBounds()).toEqual({ ...STANDINGS, height: 1040 - STANDINGS.y })

    changeSettings((s) => (s.widgets.battle.anchor = 'bottom'))
    const battle = win('battle').getBounds()
    const bottom = battle.y + battle.height
    contentSize('battle', 5_000)
    expect(win('battle').getBounds()).toEqual({ ...battle, y: 0, height: bottom })
    contentSize('battle', 100)
    vi.advanceTimersByTime(1_500)
    expect(win('battle').getBounds()).toEqual({ ...battle, y: bottom - 100, height: 100 })
  })

  it('ignores invalid heights and raises tiny ones to the minimum', () => {
    for (const h of ['300', Number.NaN, -1, 0, 1e9, null]) contentSize('standings', h)
    expect(win('standings').getBounds()).toEqual(STANDINGS)
    contentSize('standings', 5)
    vi.advanceTimersByTime(1_500)
    expect(win('standings').getBounds().height).toBe(WIDGET_DEFS.standings.minSize.height)
  })

  it('saves only the fitted height, debounced', () => {
    contentSize('standings', 500)
    contentSize('standings', 520)
    vi.advanceTimersByTime(999)
    expect(committed).toEqual([])
    vi.advanceTimersByTime(1)
    expect(committed).toEqual([
      ['standings', { ...settings.widgets.standings.bounds, height: 520 }]
    ])
  })

  it('reassertZOrder keeps the fitted height', () => {
    contentSize('standings', 600)
    win('standings').bounds = { ...STANDINGS }
    windows.setEditMode(true)
    expect(win('standings').getBounds()).toEqual({ ...STANDINGS, height: 600 })
  })

  it('a closed window or dispose leaves no timer behind', () => {
    contentSize('standings', 600)
    contentSize('standings', 300)
    expect(vi.getTimerCount()).toBe(2)
    win('standings').destroy()
    // The shrink timer is gone with the window; the save of the last fit stays.
    expect(vi.getTimerCount()).toBe(1)

    contentSize('battle', 400)
    contentSize('battle', 100)
    windows.dispose()
    expect(vi.getTimerCount()).toBe(0)
    expect(committed.map(([id]) => id)).toEqual(['standings', 'battle'])
  })

  it('only the sides of an auto-height widget can be dragged, and the fit survives the drag', () => {
    contentSize('standings', 600)
    windows.setEditMode(true)
    for (const mode of ['n', 's', 'se', 'nw'] as const) {
      drag('standings', 'start', mode)
      fakeScreen.cursor = { x: 30, y: 30 }
      drag('standings', 'end', mode)
      fakeScreen.cursor = { x: 0, y: 0 }
    }
    expect(committed).toEqual([])
    expect(win('standings').getBounds()).toEqual({ ...STANDINGS, height: 600 })

    drag('standings', 'start', 'w', true)
    fakeScreen.cursor = { x: -100, y: 0 }
    drag('standings', 'move', 'w', true)
    // The content grows mid-drag: the drag keeps the new height.
    contentSize('standings', 650)
    fakeScreen.cursor = { x: -110, y: 0 }
    drag('standings', 'end', 'w', true)
    const expected = {
      x: STANDINGS.x - 110,
      y: STANDINGS.y,
      width: STANDINGS.width + 110,
      height: 650
    }
    expect(win('standings').getBounds()).toEqual(expected)
    expect(committed).toEqual([['standings', expected]])
  })
})

describe('WidgetWindows mouse wheel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    windows.dispose()
    vi.useRealTimers()
  })

  it('does nothing outside edit mode, for locked widgets or for invalid steps', () => {
    const before = win('relative').getBounds()
    wheel('relative', 1)
    windows.setEditMode(true)
    wheel('relative', 2)
    wheel('relative', '1')
    setLocked('relative', true)
    wheel('relative', 1)
    wheel('standings', 0)
    expect(win('relative').getBounds()).toEqual(before)
    expect(scaleSteps).toEqual([])
  })

  it('resizes a free widget around its centre and saves it, debounced', () => {
    windows.setEditMode(true)
    const b = win('relative').getBounds()
    wheel('relative', 1)
    const up = win('relative').getBounds()
    expect(up.width).toBe(Math.round(b.width * 1.05))
    // Around the centre, within half a DIP of rounding.
    expect(Math.abs(up.x + up.width / 2 - (b.x + b.width / 2))).toBeLessThanOrEqual(0.5)
    expect(Math.abs(up.y + up.height / 2 - (b.y + b.height / 2))).toBeLessThanOrEqual(0.5)
    wheel('relative', -1)
    expect(win('relative').getBounds()).toEqual(b)
    expect(committed).toEqual([])
    vi.advanceTimersByTime(1_000)
    expect(committed).toEqual([['relative', b]])
  })

  it('asks for a scale step on auto-height widgets instead of resizing them', () => {
    windows.setEditMode(true)
    const before = win('battle').getBounds()
    wheel('battle', 1)
    wheel('standings', -1)
    expect(scaleSteps).toEqual([
      ['battle', 1],
      ['standings', -1]
    ])
    expect(win('battle').getBounds()).toEqual(before)
  })
})

describe('WidgetWindows edge snapping', () => {
  // relative: 60..520 x 260..512; radar starts at x = 560.
  it('snaps a moved widget to a neighbour edge within 8 DIP, unless snapping is off', () => {
    windows.setEditMode(true)
    const before = win('relative').getBounds()
    drag('relative', 'start', 'move')
    fakeScreen.cursor = { x: 35, y: 0 }
    drag('relative', 'move', 'move')
    expect(win('relative').getBounds()).toEqual({ ...before, x: 560 - before.width })
    drag('relative', 'move', 'move', true)
    expect(win('relative').getBounds()).toEqual({ ...before, x: before.x + 35 })
    drag('relative', 'end', 'move')
    expect(committed).toEqual([['relative', { ...before, x: 560 - before.width }]])
  })

  it('ignores hidden widgets as targets', () => {
    windows.setVisible('radar', false)
    windows.setEditMode(true)
    const before = win('relative').getBounds()
    drag('relative', 'start', 'move')
    fakeScreen.cursor = { x: 35, y: 0 }
    drag('relative', 'end', 'move')
    expect(win('relative').getBounds()).toEqual({ ...before, x: before.x + 35 })
  })
})

describe('WidgetWindows titles', () => {
  it('titles each window after its widget in the interface language, live', () => {
    expect(win('relative').getTitle()).toBe('Relativo · OverLap')
    expect(win('standings').getTitle()).toBe('Clasificación · OverLap')
    changeSettings((s) => (s.appearance.language = 'en'))
    expect(win('relative').getTitle()).toBe('Relative · OverLap')
    expect(win('standings').getTitle()).toBe('Standings · OverLap')
    expect(win('inputs').getTitle()).toBe('Inputs · OverLap')
    // Nothing to do for any other change.
    const calls = win('radar').setTitle.mock.calls.length
    changeSettings((s) => (s.appearance.accent = '#22d3ee'))
    expect(win('radar').setTitle.mock.calls.length).toBe(calls)
    changeSettings((s) => (s.appearance.language = 'es'))
    expect(win('battle').getTitle()).toBe('Batalla · OverLap')
  })

  it('creates a window again in the current language', () => {
    changeSettings((s) => (s.appearance.language = 'en'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.useFakeTimers()
    try {
      win('battle').webContents.emit('render-process-gone', {}, { reason: 'crashed' })
      windows.setVisible('battle', true)
    } finally {
      vi.useRealTimers()
    }
    expect(FakeBrowserWindow.all.at(-1)?.options.title).toBe('Battle · OverLap')
  })
})

describe('WidgetWindows visibility rules', () => {
  const HIDDEN: AutoHiddenState = { hidden: true, reason: 'practice' }

  it('hides a rule-hidden widget without painting it, and shows it again when the rule clears', () => {
    expect(win('battle').isVisible()).toBe(true)
    windows.setAutoHidden('battle', HIDDEN)
    expect(win('battle').isVisible()).toBe(false)
    expect(sent('battle', IPC.autoHidden)).toEqual([HIDDEN])
    expect(windows.autoHiddenReasons()).toEqual({ battle: 'practice' })

    windows.setAutoHidden('battle', HIDDEN)
    expect(sent('battle', IPC.autoHidden)).toHaveLength(1)

    windows.setAutoHidden('battle', { hidden: false, reason: 'race' })
    expect(win('battle').isVisible()).toBe(true)
    expect(win('battle').showInactive).toHaveBeenCalled()
    expect(win('battle').show).not.toHaveBeenCalled()
    expect(sent('battle', IPC.autoHidden).at(-1)).toEqual({ hidden: false, reason: null })
    expect(windows.autoHiddenReasons()).toEqual({})
  })

  it('reports a widget hidden for no known reason with a null reason', () => {
    windows.setAutoHidden('battle', { hidden: true, reason: null })
    expect(win('battle').isVisible()).toBe(false)
    expect(windows.autoHiddenReasons()).toEqual({ battle: null })
  })

  it('previews rule-hidden widgets in edit mode, but never ones the user disabled', () => {
    windows.setAutoHidden('battle', HIDDEN)
    windows.setAutoHidden('inputs', HIDDEN)
    windows.setVisible('inputs', false)
    windows.setEditMode(true)
    expect(win('battle').isVisible()).toBe(true)
    expect(win('inputs').isVisible()).toBe(false)
    windows.setEditMode(false)
    expect(win('battle').isVisible()).toBe(false)
    // Enabling it while a rule hides it keeps it hidden.
    windows.setVisible('inputs', true)
    expect(win('inputs').isVisible()).toBe(false)
  })

  it('shows nothing once disposed, even when the rules are released while quitting', () => {
    windows.setAutoHidden('battle', HIDDEN)
    windows.dispose()
    windows.setAutoHidden('battle', { hidden: false, reason: null })
    windows.setVisible('relative', true)
    for (const w of FakeBrowserWindow.all) expect(w.isVisible()).toBe(false)
  })

  it('a widget whose rule hides it mid-drag commits that drag', () => {
    windows.setEditMode(true)
    windows.setAutoHidden('relative', HIDDEN)
    const before = win('relative').getBounds()
    drag('relative', 'start', 'move', true)
    fakeScreen.cursor = { x: 100, y: 0 }
    drag('relative', 'move', 'move', true)
    windows.setEditMode(false)
    expect(committed).toEqual([['relative', { ...before, x: before.x + 100 }]])
    expect(win('relative').isVisible()).toBe(false)
  })

  it('a window that becomes ready while its widget is rule-hidden stays hidden and gets the state', () => {
    windows.setAutoHidden('radar', HIDDEN)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.useFakeTimers()
    try {
      win('radar').webContents.emit('render-process-gone', {}, { reason: 'crashed' })
      windows.setVisible('radar', true)
    } finally {
      vi.useRealTimers()
    }
    const recreated = win('radar')
    recreated.becomeReady()
    expect(recreated.isVisible()).toBe(false)
    expect(sent('radar', IPC.autoHidden)).toEqual([HIDDEN])
  })
})

describe('WidgetWindows payload hand-over', () => {
  const MSG = {
    widget: 'standings',
    payload: { header: {}, classes: [] }
  } as unknown as WidgetDataMessage
  const LIVE: OverlayStatus = { state: 'connected', source: 'iracing', note: 'none', detail: '' }

  /** The standings window crashes and comes back, not ready yet. */
  function recreateStandings(): FakeBrowserWindow {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.useFakeTimers()
    try {
      win('standings').webContents.emit('render-process-gone', {}, { reason: 'crashed' })
      vi.advanceTimersByTime(1_000)
    } finally {
      vi.useRealTimers()
    }
    return win('standings')
  }

  it('forwards payloads to a ready window at once', () => {
    windows.sendData(MSG)
    expect(sent('standings', IPC.data)).toEqual([MSG])
  })

  it('hands the latest payload to a window that becomes ready after it was sent', () => {
    windows.broadcastStatus(LIVE)
    const fresh = recreateStandings()
    windows.sendData(MSG)
    expect(sent('standings', IPC.data)).toEqual([])
    fresh.becomeReady()
    expect(sent('standings', IPC.data)).toEqual([MSG])
  })

  it('never hands over a stale payload', () => {
    windows.sendData(MSG)
    windows.broadcastStatus({ state: 'waiting', source: 'iracing', note: 'none', detail: '' })
    recreateStandings().becomeReady()
    expect(sent('standings', IPC.data)).toEqual([])

    windows.sendData(MSG)
    windows.setAutoHidden('standings', { hidden: true, reason: 'pits' })
    windows.setAutoHidden('standings', { hidden: false, reason: null })
    recreateStandings().becomeReady()
    expect(sent('standings', IPC.data)).toEqual([])

    windows.sendData(MSG)
    windows.setVisible('standings', false)
    windows.setVisible('standings', true)
    recreateStandings().becomeReady()
    expect(sent('standings', IPC.data)).toEqual([])
  })
})
