/**
 * Recording a combination on the shortcuts page, driven with synthetic keyboard events the way
 * Chromium delivers them to the settings window (capture phase on the window).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { SHORTCUT_CAPTURE_RENEW_MS, type ControllerPress } from '@shared/ipc'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { shortcutBindings, type ShortcutAction } from '@shared/shortcuts'
import { useShortcutCapture, type ShortcutCapture } from './useShortcutCapture'

interface Mods {
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  metaKey?: boolean
  repeat?: boolean
  /** getModifierState('AltGraph'). */
  altGraph?: boolean
}

/** A KeyboardEvent as the settings window gets it (cancelable, like the real ones). */
function keyEvent(type: 'keydown' | 'keyup', key: string, code: string, mods: Mods = {}): Event {
  const { altGraph = false, ...flags } = mods
  return Object.assign(new Event(type, { cancelable: true }), {
    key,
    code,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    repeat: false,
    ...flags,
    getModifierState: (k: string) => k === 'AltGraph' && altGraph
  })
}

let source: EventTarget
let current: Record<ShortcutAction, string[]>
let saved: [ShortcutAction, string[]][]
let commands: boolean[]
let capture: ShortcutCapture
let stop: () => void

/** Dispatches a keydown on the window; the event, to check what the page did with it. */
function down(key: string, code: string, mods: Mods = {}): Event {
  const e = keyEvent('keydown', key, code, mods)
  source.dispatchEvent(e)
  return e
}

function up(key: string, code: string, mods: Mods = {}): Event {
  const e = keyEvent('keyup', key, code, mods)
  source.dispatchEvent(e)
  return e
}

/** Ctrl, then Shift, then the key, as a hand presses them. */
function pressCtrlShift(key: string, code: string): Event {
  down('Control', 'ControlLeft', { ctrlKey: true })
  down('Shift', 'ShiftLeft', { ctrlKey: true, shiftKey: true })
  return down(key, code, { ctrlKey: true, shiftKey: true })
}

beforeEach(() => {
  vi.useFakeTimers()
  source = new EventTarget()
  current = shortcutBindings(DEFAULT_SETTINGS.shortcuts)
  saved = []
  commands = []
  const scope = effectScope()
  capture = scope.run(() =>
    useShortcutCapture({
      current: () => current,
      save: (action, bindings) => {
        saved.push([action, bindings])
        current = { ...current, [action]: bindings }
      },
      capture: (on) => commands.push(on),
      source
    })
  ) as ShortcutCapture
  stop = () => scope.stop()
})

afterEach(() => {
  stop()
  vi.useRealTimers()
})

describe('useShortcutCapture: recording', () => {
  it('records Ctrl+Shift+H with the modifiers shown live, then saves it and lets go', () => {
    capture.start('toggleOverlay', 0)
    expect(capture.active.value).toEqual({ action: 'toggleOverlay', slot: 0 })
    expect(commands).toEqual([true])

    down('Control', 'ControlLeft', { ctrlKey: true })
    expect(capture.held.value).toEqual({ ctrl: true, alt: false, shift: false })
    down('Shift', 'ShiftLeft', { ctrlKey: true, shiftKey: true })
    expect(capture.held.value).toEqual({ ctrl: true, alt: false, shift: true })
    expect(saved).toEqual([])

    const e = down('j', 'KeyJ', { ctrlKey: true, shiftKey: true })
    expect(e.defaultPrevented).toBe(true)
    expect(saved).toEqual([['toggleOverlay', ['Ctrl+Shift+J']]])
    expect(capture.feedback.value).toMatchObject({
      action: 'toggleOverlay',
      kind: 'saved',
      accelerator: 'Ctrl+Shift+J'
    })
    expect(capture.active.value).toBeNull()
    // The patch went first, then main was told to resume.
    expect(commands).toEqual([true, false])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps the keys from the page while recording, and only then', () => {
    expect(down('Enter', 'Enter').defaultPrevented).toBe(false)
    capture.start('toggleEditMode', 0)
    expect(down('Enter', 'Enter').defaultPrevented).toBe(true)
    expect(down(' ', 'Space').defaultPrevented).toBe(true)
    expect(up(' ', 'Space').defaultPrevented).toBe(true)
    capture.cancel()
    expect(down(' ', 'Space').defaultPrevented).toBe(false)
  })

  it('follows the modifiers as they are let go', () => {
    capture.start('toggleOverlay', 0)
    down('Control', 'ControlLeft', { ctrlKey: true })
    down('Alt', 'AltLeft', { ctrlKey: true, altKey: true })
    up('Alt', 'AltLeft', { ctrlKey: true })
    expect(capture.held.value).toEqual({ ctrl: true, alt: false, shift: false })
    up('Control', 'ControlLeft')
    expect(capture.held.value).toEqual({ ctrl: false, alt: false, shift: false })
    expect(capture.active.value).toEqual({ action: 'toggleOverlay', slot: 0 })
  })

  it('ignores the auto-repeat of a held key', () => {
    capture.start('toggleOverlay', 0)
    down('Control', 'ControlLeft', { ctrlKey: true })
    down('Control', 'ControlLeft', { ctrlKey: true, repeat: true })
    down('k', 'KeyK', { ctrlKey: true, altKey: true, repeat: true })
    expect(saved).toEqual([])
    expect(capture.active.value).toEqual({ action: 'toggleOverlay', slot: 0 })
  })

  it('records AltGr as Ctrl+Alt and warns about it after saving', () => {
    capture.start('toggleEditMode', 0)
    down('Control', 'ControlLeft', { ctrlKey: true })
    down('AltGraph', 'AltRight', { ctrlKey: true, altKey: true })
    expect(capture.held.value).toEqual({ ctrl: true, alt: true, shift: false })
    down('€', 'KeyE', { ctrlKey: true, altKey: true })
    expect(saved).toEqual([['toggleEditMode', ['Ctrl+Alt+E']]])
    expect(capture.feedback.value).toMatchObject({ kind: 'saved', warning: 'altgr' })
  })

  it('records AltGr reported only as the AltGraph modifier (ctrlKey/altKey false) as Ctrl+Alt', () => {
    capture.start('toggleEditMode', 0)
    down('Control', 'ControlLeft', { ctrlKey: true })
    down('AltGraph', 'AltRight', { altGraph: true })
    expect(capture.held.value).toEqual({ ctrl: true, alt: true, shift: false })
    // Shift let go while AltGr stays down: the live keycaps keep Ctrl+Alt.
    down('Shift', 'ShiftLeft', { shiftKey: true, altGraph: true })
    up('Shift', 'ShiftLeft', { altGraph: true })
    expect(capture.held.value).toEqual({ ctrl: true, alt: true, shift: false })
    // AltGr+Backspace is a combination, not "turn it off" (refused: Backspace cannot be used).
    down('Backspace', 'Backspace', { altGraph: true })
    expect(saved).toEqual([])
    expect(capture.feedback.value).toMatchObject({ kind: 'refused', error: 'unsupported-key' })
    down('€', 'KeyE', { altGraph: true })
    expect(saved).toEqual([['toggleEditMode', ['Ctrl+Alt+E']]])
    expect(capture.feedback.value).toMatchObject({ kind: 'saved', warning: 'altgr' })
  })

  it('records letters as an AZERTY keyboard labels them', () => {
    capture.start('toggleOverlay', 0)
    pressCtrlShift('a', 'KeyQ')
    expect(saved).toEqual([['toggleOverlay', ['Ctrl+Shift+A']]])
  })

  it('records F13-F24 alone, and the numeric keypad', () => {
    capture.start('toggleOverlay', 0)
    down('F13', 'F13')
    expect(saved.at(-1)).toEqual(['toggleOverlay', ['F13']])
    capture.start('toggleOverlay', 0)
    down('Control', 'ControlLeft', { ctrlKey: true })
    down('5', 'Numpad5', { ctrlKey: true })
    expect(saved.at(-1)).toEqual(['toggleOverlay', ['Ctrl+num5']])
  })
})

describe('useShortcutCapture: refusals', () => {
  it('reports a refused combination inline and goes on recording', () => {
    capture.start('toggleOverlay', 0)
    const refuse = (expected: object): void => {
      expect(capture.feedback.value).toMatchObject({
        action: 'toggleOverlay',
        kind: 'refused',
        ...expected
      })
      expect(capture.active.value).toEqual({ action: 'toggleOverlay', slot: 0 })
    }
    down('ñ', 'Semicolon', { ctrlKey: true })
    refuse({ error: 'unsupported-key' })
    down('c', 'KeyC', { ctrlKey: true })
    refuse({ error: 'reserved' })
    down('A', 'KeyA', { shiftKey: true })
    refuse({ error: 'needs-modifier' })
    down('F5', 'F5')
    refuse({ error: 'needs-modifier' })
    down('Meta', 'MetaLeft', { metaKey: true })
    refuse({ error: 'meta' })
    down('Tab', 'Tab', { ctrlKey: true })
    refuse({ error: 'unsupported-key' })
    pressCtrlShift('E', 'KeyE')
    refuse({ error: 'duplicate', conflict: 'toggleEditMode' })
    expect(saved).toEqual([])
    expect(commands).toEqual([true])

    pressCtrlShift('U', 'KeyU')
    expect(saved).toEqual([['toggleOverlay', ['Ctrl+Shift+U']]])
  })

  it("takes the action's own combination again over it: nothing to save, recording ends", () => {
    capture.start('toggleEditMode', 0)
    pressCtrlShift('e', 'KeyE')
    expect(saved).toEqual([])
    expect(capture.active.value).toBeNull()
    expect(capture.feedback.value).toMatchObject({ kind: 'saved', accelerator: 'Ctrl+Shift+E' })
  })

  it('refuses one more that the action already has, and goes on recording', () => {
    capture.start('toggleEditMode')
    pressCtrlShift('E', 'KeyE')
    expect(saved).toEqual([])
    expect(capture.active.value).toEqual({ action: 'toggleEditMode', slot: 1 })
    expect(capture.feedback.value).toMatchObject({
      kind: 'refused',
      error: 'duplicate',
      conflict: 'toggleEditMode'
    })
  })
})

describe('useShortcutCapture: ways out', () => {
  it('Esc cancels without saving, with any modifier', () => {
    capture.start('toggleOverlay', 0)
    down('Control', 'ControlLeft', { ctrlKey: true })
    expect(down('Escape', 'Escape', { ctrlKey: true }).defaultPrevented).toBe(true)
    expect(capture.active.value).toBeNull()
    expect(saved).toEqual([])
    expect(commands).toEqual([true, false])
  })

  it('Backspace or Delete alone turns the shortcut off', () => {
    capture.start('toggleOverlay', 0)
    down('Backspace', 'Backspace')
    expect(saved).toEqual([['toggleOverlay', []]])
    expect(capture.feedback.value).toEqual({
      action: 'toggleOverlay',
      kind: 'removed',
      accelerator: 'Ctrl+Shift+H',
      slot: 0
    })
    expect(capture.active.value).toBeNull()
    capture.start('toggleEditMode', 0)
    down('Delete', 'Delete')
    expect(saved.at(-1)).toEqual(['toggleEditMode', []])
    expect(commands).toEqual([true, false, true, false])
  })

  it('Tab cancels and still moves the focus on', () => {
    capture.start('toggleOverlay', 0)
    const tab = down('Tab', 'Tab', { shiftKey: true })
    expect(tab.defaultPrevented).toBe(false)
    expect(capture.active.value).toBeNull()
    expect(commands).toEqual([true, false])
  })

  it('the window losing focus cancels', () => {
    capture.start('toggleOverlay', 0)
    down('Control', 'ControlLeft', { ctrlKey: true })
    source.dispatchEvent(new Event('blur'))
    expect(capture.active.value).toBeNull()
    expect(capture.held.value).toEqual({ ctrl: false, alt: false, shift: false })
    expect(commands).toEqual([true, false])
    // Nothing listens any more.
    pressCtrlShift('J', 'KeyJ')
    expect(saved).toEqual([])
  })

  it('renews the capture while recording and stops with it', () => {
    capture.start('toggleOverlay', 0)
    vi.advanceTimersByTime(SHORTCUT_CAPTURE_RENEW_MS * 3)
    expect(commands).toEqual([true, true, true, true])
    capture.cancel()
    vi.advanceTimersByTime(SHORTCUT_CAPTURE_RENEW_MS * 3)
    expect(commands).toEqual([true, true, true, true, false])
  })

  it('records on one row at a time: another row takes over, the same one cancels', () => {
    capture.start('toggleOverlay', 0)
    capture.toggle('toggleEditMode', 0)
    expect(capture.active.value).toEqual({ action: 'toggleEditMode', slot: 0 })
    // Main stays suspended across the switch.
    expect(commands).toEqual([true])
    capture.toggle('toggleEditMode', 0)
    expect(capture.active.value).toBeNull()
    expect(commands).toEqual([true, false])
    capture.cancel()
    expect(commands).toEqual([true, false])
  })

  it('leaving the page (its scope) releases the capture', () => {
    capture.start('toggleOverlay', 0)
    stop()
    expect(capture.active.value).toBeNull()
    expect(commands).toEqual([true, false])
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('useShortcutCapture: buttons', () => {
  it('turns a shortcut off and resets it, checked like a recorded one', () => {
    expect(capture.assign('toggleOverlay', 0, '')).toBe(true)
    expect(saved).toEqual([['toggleOverlay', []]])
    expect(capture.assign('toggleOverlay', 0, 'Ctrl+Shift+H')).toBe(true)
    expect(saved.at(-1)).toEqual(['toggleOverlay', ['Ctrl+Shift+H']])
    expect(commands).toEqual([])
  })

  it('refuses a reset to a combination another action has now', () => {
    current = shortcutBindings({
      toggleOverlay: 'F13',
      toggleEditMode: 'Ctrl+Shift+H',
      cycleDeltaReference: '',
      nextLayout: '',
      openSettings: ''
    })
    expect(capture.assign('toggleOverlay', 0, 'Ctrl+Shift+H')).toBe(false)
    expect(saved).toEqual([])
    expect(capture.feedback.value).toMatchObject({
      action: 'toggleOverlay',
      kind: 'refused',
      error: 'duplicate',
      conflict: 'toggleEditMode'
    })
  })
})

describe('useShortcutCapture: controller buttons', () => {
  const G29 = 'joy:046d:c24f:0'
  let presses: ((press: ControllerPress) => void)[]
  let unsubscribed: number

  beforeEach(() => {
    stop()
    presses = []
    unsubscribed = 0
    const scope = effectScope()
    capture = scope.run(() =>
      useShortcutCapture({
        current: () => current,
        save: (action, accelerator) => {
          saved.push([action, accelerator])
          current = { ...current, [action]: accelerator }
        },
        capture: (on) => commands.push(on),
        source,
        onButton: (cb) => {
          presses.push(cb)
          return () => {
            unsubscribed++
            presses = presses.filter((p) => p !== cb)
          }
        }
      })
    ) as ShortcutCapture
    stop = () => scope.stop()
  })

  function pressButton(
    binding: string,
    name = 'G29 Driving Force Racing Wheel',
    first = false
  ): void {
    for (const cb of [...presses]) cb({ binding, name, first })
  }

  it('listens for buttons only while recording', () => {
    expect(presses).toHaveLength(0)
    capture.start('nextLayout', 0)
    expect(presses).toHaveLength(1)
    capture.cancel()
    expect(presses).toHaveLength(0)
    expect(unsubscribed).toBe(1)
  })

  it('saves a pressed button as the binding and stops recording', () => {
    capture.start('nextLayout', 0)
    pressButton(`${G29}:12`)
    expect(saved).toEqual([['nextLayout', [`${G29}:12`]]])
    expect(capture.active.value).toBeNull()
    expect(commands).toEqual([true, false])
    expect(capture.feedback.value).toEqual({
      action: 'nextLayout',
      kind: 'saved',
      accelerator: `${G29}:12`,
      warning: undefined,
      slot: 0
    })
    expect(capture.pressedNames.value).toEqual({ [G29]: 'G29 Driving Force Racing Wheel' })
  })

  it('refuses a button another action has, and keeps recording', () => {
    current = { ...current, toggleOverlay: [`${G29}:12`] }
    capture.start('nextLayout', 0)
    pressButton(`${G29}:12`)
    expect(saved).toEqual([])
    expect(capture.active.value).toEqual({ action: 'nextLayout', slot: 0 })
    expect(capture.feedback.value).toMatchObject({
      kind: 'refused',
      error: 'duplicate',
      conflict: 'toggleOverlay',
      // The refusal names the button pressed (unlabelled on the rim).
      button: `${G29}:12`
    })
    pressButton(`${G29}:13`)
    expect(saved).toEqual([['nextLayout', [`${G29}:13`]]])
  })

  it('does not save a button from the first report: it asks for the press again', () => {
    capture.start('nextLayout', 0)
    // A rotary resting on 3 and the press of 17, in the controller's first report.
    pressButton(`${G29}:3`, 'Box', true)
    pressButton(`${G29}:17`, 'Box', true)
    expect(saved).toEqual([])
    expect(capture.active.value).toEqual({ action: 'nextLayout', slot: 0 })
    expect(capture.feedback.value).toEqual({ action: 'nextLayout', kind: 'again' })
    expect(capture.pressedNames.value).toEqual({ [G29]: 'Box' })
    // Pressed again: a press for sure.
    pressButton(`${G29}:17`, 'Box')
    expect(saved).toEqual([['nextLayout', [`${G29}:17`]]])
    expect(capture.active.value).toBeNull()
  })

  it('ignores a malformed press, and presses after the page went away', () => {
    capture.start('nextLayout', 0)
    pressButton('joy:nope')
    expect(saved).toEqual([])
    stop()
    expect(unsubscribed).toBe(1)
    pressButton(`${G29}:12`)
    expect(saved).toEqual([])
  })

  it('adds a pressed button beside the keyboard binding, in the next slot', () => {
    capture.start('toggleOverlay')
    pressButton(`${G29}:24`)
    expect(saved).toEqual([['toggleOverlay', ['Ctrl+Shift+H', `${G29}:24`]]])
    expect(capture.active.value).toBeNull()
  })

  it('still records a key combination', () => {
    capture.start('nextLayout', 0)
    pressCtrlShift('N', 'KeyN')
    expect(saved).toEqual([['nextLayout', ['Ctrl+Shift+N']]])
    expect(presses).toHaveLength(0)
  })
})

describe('useShortcutCapture: several bindings per action', () => {
  const G29 = 'joy:046d:c24f:0'

  it('records one more after the last by default, up to three', () => {
    capture.start('toggleOverlay')
    expect(capture.active.value).toEqual({ action: 'toggleOverlay', slot: 1 })
    down('F13', 'F13')
    expect(saved.at(-1)).toEqual(['toggleOverlay', ['Ctrl+Shift+H', 'F13']])
    expect(capture.active.value).toBeNull()
    capture.toggle('toggleOverlay')
    expect(capture.active.value).toEqual({ action: 'toggleOverlay', slot: 2 })
    pressCtrlShift('K', 'KeyK')
    expect(saved.at(-1)).toEqual(['toggleOverlay', ['Ctrl+Shift+H', 'F13', 'Ctrl+Shift+K']])
    // A fourth: not even started.
    capture.start('toggleOverlay')
    expect(capture.active.value).toBeNull()
    capture.start('toggleOverlay', 3)
    expect(capture.active.value).toBeNull()
    expect(commands).toEqual([true, false, true, false])
  })

  it('records over the binding of a slot, keeping the others', () => {
    current = { ...current, toggleOverlay: ['Ctrl+Shift+H', 'F13', 'F14'] }
    capture.start('toggleOverlay', 1)
    down('F15', 'F15')
    expect(saved.at(-1)).toEqual(['toggleOverlay', ['Ctrl+Shift+H', 'F15', 'F14']])
  })

  it('refuses a binding another slot of another action has', () => {
    current = { ...current, toggleEditMode: ['Ctrl+Shift+E', 'F13'] }
    capture.start('toggleOverlay')
    down('F13', 'F13')
    expect(saved).toEqual([])
    expect(capture.feedback.value).toMatchObject({
      action: 'toggleOverlay',
      kind: 'refused',
      error: 'duplicate',
      conflict: 'toggleEditMode'
    })
    expect(capture.active.value).toEqual({ action: 'toggleOverlay', slot: 1 })
  })

  it('removes a binding: the next ones move up, removing the first promotes the second', () => {
    current = { ...current, toggleOverlay: ['Ctrl+Shift+H', `${G29}:24`, 'F13'] }
    expect(capture.remove('toggleOverlay', 0)).toBe(true)
    expect(saved.at(-1)).toEqual(['toggleOverlay', [`${G29}:24`, 'F13']])
    expect(capture.feedback.value).toEqual({
      action: 'toggleOverlay',
      kind: 'removed',
      accelerator: 'Ctrl+Shift+H',
      slot: 0
    })
    expect(capture.remove('toggleOverlay', 5)).toBe(false)
  })

  it('says where a saved binding is now (the focus goes there)', () => {
    current = { ...current, toggleOverlay: ['Ctrl+Shift+H', 'F13'] }
    capture.start('toggleOverlay')
    down('F14', 'F14')
    expect(capture.feedback.value).toMatchObject({ kind: 'saved', accelerator: 'F14', slot: 2 })
    capture.start('toggleOverlay', 1)
    down('F15', 'F15')
    expect(capture.feedback.value).toMatchObject({ kind: 'saved', accelerator: 'F15', slot: 1 })
  })

  it('Backspace over a binding removes it; while adding one it only cancels', () => {
    current = { ...current, toggleOverlay: ['Ctrl+Shift+H', 'F13'] }
    capture.start('toggleOverlay', 1)
    down('Backspace', 'Backspace')
    expect(saved.at(-1)).toEqual(['toggleOverlay', ['Ctrl+Shift+H']])
    expect(capture.active.value).toBeNull()
    capture.start('toggleOverlay')
    down('Delete', 'Delete')
    expect(saved).toHaveLength(1)
    expect(capture.active.value).toBeNull()
  })

  it('Esc cancels a new one without adding anything', () => {
    capture.start('nextLayout')
    expect(capture.active.value).toEqual({ action: 'nextLayout', slot: 0 })
    down('Escape', 'Escape')
    expect(capture.active.value).toBeNull()
    expect(saved).toEqual([])
    expect(commands).toEqual([true, false])
  })

  it('moves between slots of a row without letting main go; the same slot cancels', () => {
    current = { ...current, toggleOverlay: ['Ctrl+Shift+H', 'F13'] }
    capture.toggle('toggleOverlay', 0)
    capture.toggle('toggleOverlay', 1)
    expect(capture.active.value).toEqual({ action: 'toggleOverlay', slot: 1 })
    capture.toggle('toggleOverlay')
    expect(capture.active.value).toEqual({ action: 'toggleOverlay', slot: 2 })
    expect(commands).toEqual([true])
    capture.toggle('toggleOverlay', 2)
    expect(capture.active.value).toBeNull()
    expect(commands).toEqual([true, false])
  })

  it('resets an action to its factory binding alone, or to none', () => {
    current = { ...current, toggleOverlay: ['F13', `${G29}:24`], nextLayout: ['F14'] }
    expect(capture.reset('toggleOverlay')).toBe(true)
    expect(saved.at(-1)).toEqual(['toggleOverlay', ['Ctrl+Shift+H']])
    expect(capture.reset('nextLayout')).toBe(true)
    expect(saved.at(-1)).toEqual(['nextLayout', []])
    // The factory combination is another action's now (in any slot): refused.
    current = { ...current, toggleEditMode: ['Ctrl+Shift+E', 'Ctrl+Shift+O'], openSettings: [] }
    expect(capture.reset('openSettings')).toBe(false)
    expect(capture.feedback.value).toMatchObject({
      action: 'openSettings',
      kind: 'refused',
      conflict: 'toggleEditMode'
    })
  })
})

describe('useShortcutCapture: changes sent before main replies', () => {
  const G29 = 'joy:046d:c24f:0'
  /** Main's list stays the old one until `reply()`: the window of one IPC round trip. */
  let replies: (() => void)[]
  /** Main answering without applying it (refused): its list stays. */
  let refusals: (() => void)[]
  let lists: Record<ShortcutAction, string[]>
  let sent: [ShortcutAction, string[]][]
  let slow: ShortcutCapture
  let stopSlow: () => void

  beforeEach(() => {
    replies = []
    refusals = []
    sent = []
    lists = {
      ...shortcutBindings(DEFAULT_SETTINGS.shortcuts),
      toggleOverlay: ['Ctrl+Shift+H', `${G29}:24`, 'F13']
    }
    const scope = effectScope()
    slow = scope.run(() =>
      useShortcutCapture({
        current: () => lists,
        save: (action, bindings) => {
          sent.push([action, bindings])
          return new Promise<void>((resolve) => {
            replies.push(() => {
              lists = { ...lists, [action]: bindings }
              resolve()
            })
            refusals.push(resolve)
          })
        },
        capture: () => undefined,
        source: new EventTarget()
      })
    ) as ShortcutCapture
    stopSlow = () => scope.stop()
  })

  afterEach(() => stopSlow())

  it('removes twice in a row from the list it sent, not the stale one', async () => {
    expect(slow.remove('toggleOverlay', 0)).toBe(true)
    expect(slow.bindings.value.toggleOverlay).toEqual([`${G29}:24`, 'F13'])
    expect(slow.remove('toggleOverlay', 0)).toBe(true)
    expect(sent.map(([, b]) => b)).toEqual([[`${G29}:24`, 'F13'], ['F13']])
    for (const reply of replies) reply()
    await vi.runAllTimersAsync()
    expect(lists.toggleOverlay).toEqual(['F13'])
    expect(slow.bindings.value.toggleOverlay).toEqual(['F13'])
  })

  it('adds one more after the one just added, not over it', () => {
    lists = { ...lists, toggleOverlay: ['Ctrl+Shift+H'] }
    expect(slow.assign('toggleOverlay', 1, 'F14')).toBe(true)
    slow.start('toggleOverlay')
    expect(slow.active.value).toEqual({ action: 'toggleOverlay', slot: 2 })
    slow.cancel()
  })

  it("goes back to main's list once it answers (a refusal included)", async () => {
    slow.remove('toggleOverlay', 2)
    expect(slow.bindings.value.toggleOverlay).toEqual(['Ctrl+Shift+H', `${G29}:24`])
    // Main refused it: once it has answered, the page shows its list again.
    refusals[0]?.()
    await vi.runAllTimersAsync()
    expect(slow.bindings.value.toggleOverlay).toEqual(['Ctrl+Shift+H', `${G29}:24`, 'F13'])
  })
})
