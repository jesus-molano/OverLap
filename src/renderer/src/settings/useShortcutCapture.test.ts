/**
 * Recording a combination on the shortcuts page, driven with synthetic keyboard events the way
 * Chromium delivers them to the settings window (capture phase on the window).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { SHORTCUT_CAPTURE_RENEW_MS } from '@shared/ipc'
import { DEFAULT_SETTINGS } from '@shared/settings'
import type { ShortcutAction, ShortcutSettings } from '@shared/shortcuts'
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
let current: ShortcutSettings
let saved: [ShortcutAction, string][]
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
  current = { ...DEFAULT_SETTINGS.shortcuts }
  saved = []
  commands = []
  const scope = effectScope()
  capture = scope.run(() =>
    useShortcutCapture({
      current: () => current,
      save: (action, accelerator) => {
        saved.push([action, accelerator])
        current = { ...current, [action]: accelerator }
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
    capture.start('toggleOverlay')
    expect(capture.active.value).toBe('toggleOverlay')
    expect(commands).toEqual([true])

    down('Control', 'ControlLeft', { ctrlKey: true })
    expect(capture.held.value).toEqual({ ctrl: true, alt: false, shift: false })
    down('Shift', 'ShiftLeft', { ctrlKey: true, shiftKey: true })
    expect(capture.held.value).toEqual({ ctrl: true, alt: false, shift: true })
    expect(saved).toEqual([])

    const e = down('j', 'KeyJ', { ctrlKey: true, shiftKey: true })
    expect(e.defaultPrevented).toBe(true)
    expect(saved).toEqual([['toggleOverlay', 'Ctrl+Shift+J']])
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
    capture.start('toggleEditMode')
    expect(down('Enter', 'Enter').defaultPrevented).toBe(true)
    expect(down(' ', 'Space').defaultPrevented).toBe(true)
    expect(up(' ', 'Space').defaultPrevented).toBe(true)
    capture.cancel()
    expect(down(' ', 'Space').defaultPrevented).toBe(false)
  })

  it('follows the modifiers as they are let go', () => {
    capture.start('toggleOverlay')
    down('Control', 'ControlLeft', { ctrlKey: true })
    down('Alt', 'AltLeft', { ctrlKey: true, altKey: true })
    up('Alt', 'AltLeft', { ctrlKey: true })
    expect(capture.held.value).toEqual({ ctrl: true, alt: false, shift: false })
    up('Control', 'ControlLeft')
    expect(capture.held.value).toEqual({ ctrl: false, alt: false, shift: false })
    expect(capture.active.value).toBe('toggleOverlay')
  })

  it('ignores the auto-repeat of a held key', () => {
    capture.start('toggleOverlay')
    down('Control', 'ControlLeft', { ctrlKey: true })
    down('Control', 'ControlLeft', { ctrlKey: true, repeat: true })
    down('k', 'KeyK', { ctrlKey: true, altKey: true, repeat: true })
    expect(saved).toEqual([])
    expect(capture.active.value).toBe('toggleOverlay')
  })

  it('records AltGr as Ctrl+Alt and warns about it after saving', () => {
    capture.start('toggleEditMode')
    down('Control', 'ControlLeft', { ctrlKey: true })
    down('AltGraph', 'AltRight', { ctrlKey: true, altKey: true })
    expect(capture.held.value).toEqual({ ctrl: true, alt: true, shift: false })
    down('€', 'KeyE', { ctrlKey: true, altKey: true })
    expect(saved).toEqual([['toggleEditMode', 'Ctrl+Alt+E']])
    expect(capture.feedback.value).toMatchObject({ kind: 'saved', warning: 'altgr' })
  })

  it('records AltGr reported only as the AltGraph modifier (ctrlKey/altKey false) as Ctrl+Alt', () => {
    capture.start('toggleEditMode')
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
    expect(saved).toEqual([['toggleEditMode', 'Ctrl+Alt+E']])
    expect(capture.feedback.value).toMatchObject({ kind: 'saved', warning: 'altgr' })
  })

  it('records letters as an AZERTY keyboard labels them', () => {
    capture.start('toggleOverlay')
    pressCtrlShift('a', 'KeyQ')
    expect(saved).toEqual([['toggleOverlay', 'Ctrl+Shift+A']])
  })

  it('records F13-F24 alone, and the numeric keypad', () => {
    capture.start('toggleOverlay')
    down('F13', 'F13')
    expect(saved.at(-1)).toEqual(['toggleOverlay', 'F13'])
    capture.start('toggleOverlay')
    down('Control', 'ControlLeft', { ctrlKey: true })
    down('5', 'Numpad5', { ctrlKey: true })
    expect(saved.at(-1)).toEqual(['toggleOverlay', 'Ctrl+num5'])
  })
})

describe('useShortcutCapture: refusals', () => {
  it('reports a refused combination inline and goes on recording', () => {
    capture.start('toggleOverlay')
    const refuse = (expected: object): void => {
      expect(capture.feedback.value).toMatchObject({
        action: 'toggleOverlay',
        kind: 'refused',
        ...expected
      })
      expect(capture.active.value).toBe('toggleOverlay')
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

    pressCtrlShift('O', 'KeyO')
    expect(saved).toEqual([['toggleOverlay', 'Ctrl+Shift+O']])
  })

  it("takes the action's own combination again", () => {
    capture.start('toggleEditMode')
    pressCtrlShift('e', 'KeyE')
    expect(saved).toEqual([['toggleEditMode', 'Ctrl+Shift+E']])
  })
})

describe('useShortcutCapture: ways out', () => {
  it('Esc cancels without saving, with any modifier', () => {
    capture.start('toggleOverlay')
    down('Control', 'ControlLeft', { ctrlKey: true })
    expect(down('Escape', 'Escape', { ctrlKey: true }).defaultPrevented).toBe(true)
    expect(capture.active.value).toBeNull()
    expect(saved).toEqual([])
    expect(commands).toEqual([true, false])
  })

  it('Backspace or Delete alone turns the shortcut off', () => {
    capture.start('toggleOverlay')
    down('Backspace', 'Backspace')
    expect(saved).toEqual([['toggleOverlay', '']])
    expect(capture.feedback.value).toEqual({ action: 'toggleOverlay', kind: 'disabled' })
    expect(capture.active.value).toBeNull()
    capture.start('toggleEditMode')
    down('Delete', 'Delete')
    expect(saved.at(-1)).toEqual(['toggleEditMode', ''])
    expect(commands).toEqual([true, false, true, false])
  })

  it('Tab cancels and still moves the focus on', () => {
    capture.start('toggleOverlay')
    const tab = down('Tab', 'Tab', { shiftKey: true })
    expect(tab.defaultPrevented).toBe(false)
    expect(capture.active.value).toBeNull()
    expect(commands).toEqual([true, false])
  })

  it('the window losing focus cancels', () => {
    capture.start('toggleOverlay')
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
    capture.start('toggleOverlay')
    vi.advanceTimersByTime(SHORTCUT_CAPTURE_RENEW_MS * 3)
    expect(commands).toEqual([true, true, true, true])
    capture.cancel()
    vi.advanceTimersByTime(SHORTCUT_CAPTURE_RENEW_MS * 3)
    expect(commands).toEqual([true, true, true, true, false])
  })

  it('records on one row at a time: another row takes over, the same one cancels', () => {
    capture.start('toggleOverlay')
    capture.toggle('toggleEditMode')
    expect(capture.active.value).toBe('toggleEditMode')
    // Main stays suspended across the switch.
    expect(commands).toEqual([true])
    capture.toggle('toggleEditMode')
    expect(capture.active.value).toBeNull()
    expect(commands).toEqual([true, false])
    capture.cancel()
    expect(commands).toEqual([true, false])
  })

  it('leaving the page (its scope) releases the capture', () => {
    capture.start('toggleOverlay')
    stop()
    expect(capture.active.value).toBeNull()
    expect(commands).toEqual([true, false])
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('useShortcutCapture: buttons', () => {
  it('turns a shortcut off and resets it, checked like a recorded one', () => {
    expect(capture.assign('toggleOverlay', '')).toBe(true)
    expect(saved).toEqual([['toggleOverlay', '']])
    expect(capture.assign('toggleOverlay', 'Ctrl+Shift+H')).toBe(true)
    expect(saved.at(-1)).toEqual(['toggleOverlay', 'Ctrl+Shift+H'])
    expect(commands).toEqual([])
  })

  it('refuses a reset to a combination another action has now', () => {
    current = { toggleOverlay: 'F13', toggleEditMode: 'Ctrl+Shift+H', cycleDeltaReference: '' }
    expect(capture.assign('toggleOverlay', 'Ctrl+Shift+H')).toBe(false)
    expect(saved).toEqual([])
    expect(capture.feedback.value).toMatchObject({
      action: 'toggleOverlay',
      kind: 'refused',
      error: 'duplicate',
      conflict: 'toggleEditMode'
    })
  })
})
