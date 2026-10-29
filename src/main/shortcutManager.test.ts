import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SHORTCUT_CAPTURE_LEASE_MS } from '@shared/ipc'
import type { ShortcutAction, ShortcutSettings, ShortcutStatusMap } from '@shared/shortcuts'
import { REPEAT_GUARD_MS, ShortcutManager } from './shortcutManager'
import { FakeGlobalShortcut } from './testing/fakeElectron'

const DEFAULTS: ShortcutSettings = {
  toggleOverlay: 'Ctrl+Shift+H',
  toggleEditMode: 'Ctrl+Shift+E',
  cycleDeltaReference: '',
  nextLayout: '',
  openSettings: ''
}

let registry: FakeGlobalShortcut
let actions: ShortcutAction[]
let exits: number
let statuses: ShortcutStatusMap[]
let manager: ShortcutManager

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  registry = new FakeGlobalShortcut()
  actions = []
  exits = 0
  statuses = []
  manager = new ShortcutManager({
    registry,
    onAction: (a) => actions.push(a),
    onExitEdit: () => exits++,
    onStatus: (s) => statuses.push(s)
  })
})

afterEach(() => {
  manager.dispose()
  vi.useRealTimers()
})

/** Presses `accelerator` after `ms`, past the repeat guard by default. */
function press(accelerator: string, ms = REPEAT_GUARD_MS): boolean {
  vi.advanceTimersByTime(ms)
  return registry.press(accelerator)
}

describe('ShortcutManager registration', () => {
  it('registers the configured shortcuts and runs their actions', () => {
    manager.configure(DEFAULTS)
    expect(registry.registered()).toEqual(['Ctrl+Shift+E', 'Ctrl+Shift+H'])
    expect(press('Ctrl+Shift+H')).toBe(true)
    expect(press('Ctrl+Shift+E')).toBe(true)
    expect(actions).toEqual(['toggleOverlay', 'toggleEditMode'])
    expect(manager.status).toEqual({
      toggleOverlay: 'ok',
      toggleEditMode: 'ok',
      cycleDeltaReference: 'disabled',
      nextLayout: 'disabled',
      openSettings: 'disabled'
    })
  })

  it('registers the delta cycle once it has a combination (none by default)', () => {
    manager.configure(DEFAULTS)
    expect(registry.registered()).not.toContain('Ctrl+Alt+D')
    manager.configure({ ...DEFAULTS, cycleDeltaReference: 'Ctrl+Alt+D' })
    expect(registry.registered()).toContain('Ctrl+Alt+D')
    expect(press('Ctrl+Alt+D')).toBe(true)
    expect(actions).toEqual(['cycleDeltaReference'])
    expect(manager.status.cycleDeltaReference).toBe('ok')
  })

  it('changes only what differs', () => {
    manager.configure(DEFAULTS)
    registry.register.mockClear()
    manager.configure({ ...DEFAULTS })
    expect(registry.register).not.toHaveBeenCalled()
    expect(registry.unregister).not.toHaveBeenCalled()

    manager.configure({ ...DEFAULTS, toggleOverlay: 'F13' })
    expect(registry.unregister.mock.calls).toEqual([['Ctrl+Shift+H']])
    expect(registry.register.mock.calls.map((c) => c[0])).toEqual(['F13'])
    expect(registry.registered()).toEqual(['Ctrl+Shift+E', 'F13'])
    expect(press('F13')).toBe(true)
    expect(actions).toEqual(['toggleOverlay'])
  })

  it('moves a combination from one action to another (a swap)', () => {
    manager.configure(DEFAULTS)
    manager.configure({
      ...DEFAULTS,
      toggleOverlay: 'Ctrl+Shift+E',
      toggleEditMode: 'Ctrl+Shift+H'
    })
    press('Ctrl+Shift+E')
    press('Ctrl+Shift+H')
    expect(actions).toEqual(['toggleOverlay', 'toggleEditMode'])
  })

  it('does not register a turned-off shortcut and reports it disabled', () => {
    manager.configure({ ...DEFAULTS, toggleOverlay: '' })
    expect(registry.registered()).toEqual(['Ctrl+Shift+E'])
    expect(manager.status).toEqual({
      toggleOverlay: 'disabled',
      toggleEditMode: 'ok',
      cycleDeltaReference: 'disabled',
      nextLayout: 'disabled',
      openSettings: 'disabled'
    })
    expect(statuses.at(-1)).toEqual({
      toggleOverlay: 'disabled',
      toggleEditMode: 'ok',
      cycleDeltaReference: 'disabled',
      nextLayout: 'disabled',
      openSettings: 'disabled'
    })
  })

  it('reports a combination another application holds, once, and retries it on the next change', () => {
    registry.taken.add('Ctrl+Shift+H')
    manager.configure(DEFAULTS)
    expect(manager.status).toEqual({
      toggleOverlay: 'unavailable',
      toggleEditMode: 'ok',
      cycleDeltaReference: 'disabled',
      nextLayout: 'disabled',
      openSettings: 'disabled'
    })
    expect(statuses).toEqual([
      {
        toggleOverlay: 'unavailable',
        toggleEditMode: 'ok',
        cycleDeltaReference: 'disabled',
        nextLayout: 'disabled',
        openSettings: 'disabled'
      }
    ])
    expect(console.warn).toHaveBeenCalledOnce()

    // Still taken: retried silently, nothing new to report.
    manager.setEditing(true)
    expect(console.warn).toHaveBeenCalledOnce()
    expect(statuses).toHaveLength(1)

    registry.taken.delete('Ctrl+Shift+H')
    manager.setEditing(false)
    expect(manager.status).toEqual({
      toggleOverlay: 'ok',
      toggleEditMode: 'ok',
      cycleDeltaReference: 'disabled',
      nextLayout: 'disabled',
      openSettings: 'disabled'
    })
    expect(statuses.at(-1)).toEqual({
      toggleOverlay: 'ok',
      toggleEditMode: 'ok',
      cycleDeltaReference: 'disabled',
      nextLayout: 'disabled',
      openSettings: 'disabled'
    })
    expect(press('Ctrl+Shift+H')).toBe(true)
  })

  it('treats a register that throws as unavailable', () => {
    registry.register.mockImplementationOnce(() => {
      throw new Error('conversion failure')
    })
    manager.configure(DEFAULTS)
    expect(manager.status.toggleOverlay).toBe('unavailable')
    expect(console.error).toHaveBeenCalledOnce()
  })

  it('a combination given up while unavailable stops being reported', () => {
    registry.taken.add('Ctrl+Shift+H')
    manager.configure(DEFAULTS)
    manager.configure({ ...DEFAULTS, toggleOverlay: 'F14' })
    expect(manager.status).toEqual({
      toggleOverlay: 'ok',
      toggleEditMode: 'ok',
      cycleDeltaReference: 'disabled',
      nextLayout: 'disabled',
      openSettings: 'disabled'
    })
  })
})

describe('ShortcutManager Escape', () => {
  it('takes Escape only while editing, to leave edit mode', () => {
    manager.configure(DEFAULTS)
    expect(registry.isRegistered('Escape')).toBe(false)
    manager.setEditing(true)
    expect(registry.isRegistered('Escape')).toBe(true)
    press('Escape')
    expect(exits).toBe(1)
    expect(actions).toEqual([])
    manager.setEditing(false)
    expect(registry.isRegistered('Escape')).toBe(false)
    expect(press('Escape')).toBe(false)
  })

  it('reports nothing about Escape (it is not configurable)', () => {
    registry.taken.add('Escape')
    manager.configure(DEFAULTS)
    manager.setEditing(true)
    expect(manager.status).toEqual({
      toggleOverlay: 'ok',
      toggleEditMode: 'ok',
      cycleDeltaReference: 'disabled',
      nextLayout: 'disabled',
      openSettings: 'disabled'
    })
  })
})

describe('ShortcutManager repeat guard', () => {
  it('counts a burst of presses (a held key) as one', () => {
    manager.configure(DEFAULTS)
    press('Ctrl+Shift+H', 0)
    for (let i = 0; i < 10; i++) press('Ctrl+Shift+H', 33)
    expect(actions).toEqual(['toggleOverlay'])
    // Released and pressed again.
    press('Ctrl+Shift+H', REPEAT_GUARD_MS)
    expect(actions).toEqual(['toggleOverlay', 'toggleOverlay'])
  })

  it('guards each shortcut on its own', () => {
    manager.configure(DEFAULTS)
    manager.setEditing(true)
    press('Ctrl+Shift+H', 0)
    press('Ctrl+Shift+E', 10)
    press('Escape', 10)
    expect(actions).toEqual(['toggleOverlay', 'toggleEditMode'])
    expect(exits).toBe(1)
  })
})

describe('ShortcutManager capture', () => {
  it('suspends every shortcut while the settings page records keys', () => {
    manager.configure(DEFAULTS)
    manager.startCapture()
    expect(registry.suspended).toBe(true)
    expect(press('Ctrl+Shift+H')).toBe(false)
    manager.stopCapture()
    expect(registry.suspended).toBe(false)
    expect(press('Ctrl+Shift+H')).toBe(true)
    expect(registry.setSuspended.mock.calls).toEqual([[true], [false]])
  })

  it('defers every change made while suspended to the resume', () => {
    manager.configure(DEFAULTS)
    manager.startCapture()
    registry.register.mockClear()
    manager.configure({ ...DEFAULTS, toggleOverlay: 'F15' })
    manager.setEditing(true)
    // Nothing touched while suspended (registering would fail): it all happens on resume.
    expect(registry.register).not.toHaveBeenCalled()
    expect(registry.unregister).not.toHaveBeenCalled()
    expect(manager.status).toEqual({
      toggleOverlay: 'ok',
      toggleEditMode: 'ok',
      cycleDeltaReference: 'disabled',
      nextLayout: 'disabled',
      openSettings: 'disabled'
    })

    manager.stopCapture()
    expect(registry.registered()).toEqual(['Ctrl+Shift+E', 'Escape', 'F15'])
    expect(press('F15')).toBe(true)
    expect(actions).toEqual(['toggleOverlay'])
  })

  it('reports a deferred registration that Windows refuses once resumed', () => {
    manager.configure(DEFAULTS)
    manager.startCapture()
    registry.taken.add('F16')
    manager.configure({ ...DEFAULTS, toggleOverlay: 'F16' })
    expect(manager.status.toggleOverlay).toBe('ok')
    manager.stopCapture()
    expect(manager.status.toggleOverlay).toBe('unavailable')
    expect(statuses.at(-1)).toEqual({
      toggleOverlay: 'unavailable',
      toggleEditMode: 'ok',
      cycleDeltaReference: 'disabled',
      nextLayout: 'disabled',
      openSettings: 'disabled'
    })
  })

  it('renewing keeps it suspended; a page that stops renewing is resumed by the lease', () => {
    manager.configure(DEFAULTS)
    manager.startCapture()
    vi.advanceTimersByTime(SHORTCUT_CAPTURE_LEASE_MS - 1)
    manager.startCapture()
    vi.advanceTimersByTime(SHORTCUT_CAPTURE_LEASE_MS - 1)
    expect(registry.suspended).toBe(true)
    expect(registry.setSuspended).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(registry.suspended).toBe(false)
    expect(console.warn).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stopping when not capturing does nothing', () => {
    manager.configure(DEFAULTS)
    manager.stopCapture()
    expect(registry.setSuspended).not.toHaveBeenCalled()
  })

  it('resumes before unregistering everything on dispose', () => {
    manager.configure(DEFAULTS)
    manager.setEditing(true)
    manager.startCapture()
    manager.dispose()
    expect(registry.suspended).toBe(false)
    expect(registry.unregisterAll).toHaveBeenCalledOnce()
    expect(registry.registered()).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
    // Anything after that is ignored.
    manager.configure({ ...DEFAULTS, toggleOverlay: 'F17' })
    manager.startCapture()
    expect(registry.registered()).toEqual([])
    expect(registry.suspended).toBe(false)
  })
})

describe('ShortcutManager controller buttons', () => {
  const G29 = 'joy:046d:c24f:0'
  const BOX = 'joy:1dd2:2201:0'
  const BUTTONS: ShortcutSettings = {
    ...DEFAULTS,
    toggleOverlay: `${G29}:7`,
    nextLayout: `${BOX}:40`
  }

  function make(onButtonsWanted: (on: boolean) => void): ShortcutManager {
    manager.dispose()
    manager = new ShortcutManager({
      registry,
      onAction: (a) => actions.push(a),
      onExitEdit: () => exits++,
      onStatus: (s) => statuses.push(s),
      onButtonsWanted
    })
    return manager
  }

  it('runs the action bound to a button; never registers it as a hot key', () => {
    manager.configure(BUTTONS)
    expect(registry.registered()).toEqual(['Ctrl+Shift+E'])
    vi.advanceTimersByTime(REPEAT_GUARD_MS)
    manager.pressButton(G29, 7)
    manager.pressButton(BOX, 40)
    // Another button, another controller with that button: nothing.
    manager.pressButton(G29, 8)
    manager.pressButton(BOX, 7)
    expect(actions).toEqual(['toggleOverlay', 'nextLayout'])
  })

  it('keeps keyboard shortcuts working beside buttons', () => {
    manager.configure(BUTTONS)
    expect(press('Ctrl+Shift+E')).toBe(true)
    expect(actions).toEqual(['toggleEditMode'])
    expect(registry.press('Ctrl+Shift+H')).toBe(false)
  })

  it('counts a bouncing switch (presses less than the guard apart) as one press', () => {
    manager.configure(BUTTONS)
    vi.advanceTimersByTime(REPEAT_GUARD_MS)
    manager.pressButton(G29, 7)
    vi.advanceTimersByTime(15)
    manager.pressButton(G29, 7)
    expect(actions).toEqual(['toggleOverlay'])
    vi.advanceTimersByTime(REPEAT_GUARD_MS)
    manager.pressButton(G29, 7)
    expect(actions).toEqual(['toggleOverlay', 'toggleOverlay'])
  })

  it('runs nothing while the settings page records a binding', () => {
    manager.configure(BUTTONS)
    manager.startCapture()
    expect(manager.capturing).toBe(true)
    vi.advanceTimersByTime(REPEAT_GUARD_MS)
    manager.pressButton(G29, 7)
    expect(actions).toEqual([])
    manager.stopCapture()
    expect(manager.capturing).toBe(false)
    manager.pressButton(G29, 7)
    expect(actions).toEqual(['toggleOverlay'])
  })

  it('a button whose controller is unplugged is unavailable, and ok again once it is back', () => {
    manager.configure(BUTTONS)
    // Not known yet (the input process starting): ok.
    expect(manager.status.toggleOverlay).toBe('ok')
    manager.setControllers([G29])
    expect(manager.status).toMatchObject({ toggleOverlay: 'ok', nextLayout: 'unavailable' })
    manager.setControllers([])
    expect(manager.status).toMatchObject({
      toggleOverlay: 'unavailable',
      nextLayout: 'unavailable'
    })
    manager.setControllers([G29, BOX])
    expect(manager.status).toMatchObject({ toggleOverlay: 'ok', nextLayout: 'ok' })
    expect(statuses.at(-1)).toMatchObject({ toggleOverlay: 'ok', nextLayout: 'ok' })
    // The keyboard ones do not depend on it.
    manager.setControllers([])
    expect(manager.status.toggleEditMode).toBe('ok')
  })

  it('wants the controllers read only while some action has a button or a binding is recorded', () => {
    const wanted: boolean[] = []
    make((on) => wanted.push(on))
    manager.configure(DEFAULTS)
    expect(wanted).toEqual([])
    expect(manager.wantsButtons).toBe(false)
    manager.startCapture()
    expect(wanted).toEqual([true])
    manager.stopCapture()
    expect(wanted).toEqual([true, false])
    manager.configure(BUTTONS)
    expect(wanted).toEqual([true, false, true])
    // Recording with buttons already bound changes nothing.
    manager.startCapture()
    manager.stopCapture()
    expect(wanted).toEqual([true, false, true])
    manager.configure(DEFAULTS)
    expect(wanted).toEqual([true, false, true, false])
    manager.configure(BUTTONS)
    manager.dispose()
    expect(wanted.at(-1)).toBe(false)
  })

  it('a capture that the page stops renewing stops wanting the controllers', () => {
    const wanted: boolean[] = []
    make((on) => wanted.push(on))
    manager.configure(DEFAULTS)
    manager.startCapture()
    vi.advanceTimersByTime(SHORTCUT_CAPTURE_LEASE_MS)
    expect(wanted).toEqual([true, false])
  })
})
