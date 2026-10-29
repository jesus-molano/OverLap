import { onScopeDispose, readonly, shallowRef, type Ref } from 'vue'
import {
  NO_MODIFIERS,
  heldModifiers,
  readKeyboardEvent,
  type HeldModifiers,
  type KeyInput
} from '@shared/accelerator'
import { isButtonBinding } from '@shared/controllers'
import { SHORTCUT_CAPTURE_RENEW_MS, type ControllerPress, type Unsubscribe } from '@shared/ipc'
import { DEFAULT_SETTINGS } from '@shared/settings'
import {
  MAX_BINDINGS,
  checkShortcut,
  sameList,
  shortcutBindings,
  withBinding,
  type ShortcutAction,
  type ShortcutBindings
} from '@shared/shortcuts'
import { useOverlayState } from '../composables/useOverlay'
import { sendCommand, updateSettings } from './editor'
import type { CaptureFeedback } from './shortcutsView'

export type { CaptureFeedback }

/** Where the keys come from: the window (tests pass an EventTarget). */
export type KeySource = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>

export interface CaptureDeps {
  /** Every action's bindings now: one another action, or slot, has is refused. */
  current(): Readonly<ShortcutBindings>
  /** Saves all the bindings of `action` ([] turns it off). */
  save(action: ShortcutAction, bindings: string[]): void
  /** Tells main the page records keys (true, then renewed) or no longer does (false). */
  capture(on: boolean): void
  source: KeySource
  /**
   * The controllers' buttons pressed while recording (main sends them instead of running
   * their actions); absent: keys only.
   */
  onButton?(cb: (press: ControllerPress) => void): Unsubscribe
}

/** What is being recorded: the binding in `slot` of `action` (its count: a new one). */
export interface CaptureTarget {
  action: ShortcutAction
  slot: number
}

export interface ShortcutCapture {
  /** The binding recording now; null when none is. */
  readonly active: Readonly<Ref<Readonly<CaptureTarget> | null>>
  /** The modifiers held right now while recording (the live keycaps). */
  readonly held: Readonly<Ref<Readonly<HeldModifiers>>>
  readonly feedback: Readonly<Ref<CaptureFeedback | null>>
  /**
   * The names of the controllers whose buttons were pressed while recording (id -> name):
   * the page names a new binding before main has saved its controller's name.
   */
  readonly pressedNames: Readonly<Ref<Readonly<Record<string, string>>>>
  /**
   * Starts recording the binding in `slot` of `action` (its count, the default: a new one),
   * or cancels when that one already is.
   */
  toggle(action: ShortcutAction, slot?: number): void
  start(action: ShortcutAction, slot?: number): void
  /** Stops recording without saving anything. */
  cancel(): void
  /**
   * Puts `accelerator` in `slot` of `action` ('' removes the binding there), checked like a
   * recorded one; false (and the reason in `feedback`) when refused.
   */
  assign(action: ShortcutAction, slot: number, accelerator: string): boolean
  /** Removes the binding in `slot` of `action` (the next ones move up). */
  remove(action: ShortcutAction, slot: number): boolean
  /**
   * Back to the factory binding alone (none for an action without one); refused when another
   * action has that combination now.
   */
  reset(action: ShortcutAction): boolean
}

interface KeyEventFields extends KeyInput {
  readonly repeat?: boolean
  getModifierState?(key: string): boolean
}

function isKeyEvent(evt: Event): evt is Event & KeyEventFields {
  return (
    'key' in evt && typeof evt.key === 'string' && 'code' in evt && typeof evt.code === 'string'
  )
}

/** The event as accelerator.ts reads it, AltGr included (only a modifier state for Chromium). */
function keyInput(e: KeyEventFields): KeyInput {
  const altGraph = typeof e.getModifierState === 'function' && e.getModifierState('AltGraph')
  return {
    key: e.key,
    code: e.code,
    ctrlKey: e.ctrlKey,
    altKey: e.altKey,
    shiftKey: e.shiftKey,
    metaKey: e.metaKey,
    altGraph
  }
}

/** Backspace or Delete alone removes the binding (Num Lock off, the keypad's Del too). */
function isClearKey(e: KeyInput): boolean {
  if (e.ctrlKey || e.altKey || e.shiftKey || e.metaKey || e.altGraph === true) return false
  return e.key === 'Backspace' || e.key === 'Delete' || e.code === 'Backspace'
}

/**
 * Recording a binding on the shortcuts page (a combination or a controller's button), one at a
 * time: one that replaces a binding of an action, or one more (up to MAX_BINDINGS). While it
 * runs, main suspends its global shortcuts so the keys reach this page, and sends it the
 * buttons pressed instead of running their actions (the 'capture-shortcuts' command, renewed
 * every SHORTCUT_CAPTURE_RENEW_MS), and every way out releases them: a binding saved,
 * Backspace / Delete (removes the one being replaced; cancels a new one), Esc, Tab, the window
 * losing focus, cancel() (the recording button losing focus, another click on it) and the
 * owning scope going away (the page left). A refused binding is reported and the recording
 * goes on.
 */
export function useShortcutCapture(deps: CaptureDeps): ShortcutCapture {
  const active = shallowRef<Readonly<CaptureTarget> | null>(null)
  const held = shallowRef<Readonly<HeldModifiers>>(NO_MODIFIERS)
  const feedback = shallowRef<CaptureFeedback | null>(null)
  const pressedNames = shallowRef<Readonly<Record<string, string>>>({})
  let renew: ReturnType<typeof setInterval> | null = null
  let stopButtons: Unsubscribe | null = null

  function listen(on: boolean): void {
    const { source } = deps
    if (on) {
      // Capture phase: the keys never reach the focused button (Enter, Space) or the page.
      source.addEventListener('keydown', onKeyDown, true)
      source.addEventListener('keyup', onKeyUp, true)
      source.addEventListener('blur', cancel)
      stopButtons = deps.onButton?.(onButton) ?? null
    } else {
      source.removeEventListener('keydown', onKeyDown, true)
      source.removeEventListener('keyup', onKeyUp, true)
      source.removeEventListener('blur', cancel)
      stopButtons?.()
      stopButtons = null
    }
  }

  /** `slot` within what the action has, its count at most (a new binding), when there is room. */
  function slotFor(action: ShortcutAction, slot: number | undefined): number | null {
    const count = deps.current()[action].length
    const s = slot ?? count
    if (!Number.isInteger(s) || s < 0 || s > count || s >= MAX_BINDINGS) return null
    return s
  }

  function start(action: ShortcutAction, slot?: number): void {
    const s = slotFor(action, slot)
    if (s === null) return
    feedback.value = null
    held.value = NO_MODIFIERS
    // Another binding: main stays suspended, only the target changes.
    if (active.value !== null) {
      active.value = { action, slot: s }
      return
    }
    active.value = { action, slot: s }
    deps.capture(true)
    renew = setInterval(() => deps.capture(true), SHORTCUT_CAPTURE_RENEW_MS)
    listen(true)
  }

  function cancel(): void {
    if (active.value === null) return
    active.value = null
    held.value = NO_MODIFIERS
    if (renew !== null) clearInterval(renew)
    renew = null
    listen(false)
    deps.capture(false)
  }

  function toggle(action: ShortcutAction, slot?: number): void {
    const now = active.value
    const s = slot ?? deps.current()[action].length
    if (now !== null && now.action === action && now.slot === s) cancel()
    else start(action, s)
  }

  function assign(action: ShortcutAction, slot: number, accelerator: string): boolean {
    const current = deps.current()
    const list = current[action]
    const check = checkShortcut(action, accelerator, current, slot)
    if (!check.ok) {
      feedback.value = {
        action,
        kind: 'refused',
        error: check.error ?? 'invalid',
        conflict: check.conflict,
        ...(isButtonBinding(accelerator) ? { button: accelerator } : {})
      }
      return false
    }
    const next = withBinding(list, slot, check.accelerator)
    if (sameList(next, list)) {
      // Its own binding again, in its own slot: nothing to save. Else no room, or nothing there.
      if (check.accelerator === '' || list[slot] !== check.accelerator) return false
      feedback.value = {
        action,
        kind: 'saved',
        accelerator: check.accelerator,
        warning: check.warning
      }
      return true
    }
    deps.save(action, next)
    const removed = list[slot] ?? ''
    feedback.value =
      check.accelerator === ''
        ? { action, kind: 'removed', accelerator: removed }
        : { action, kind: 'saved', accelerator: check.accelerator, warning: check.warning }
    return true
  }

  function remove(action: ShortcutAction, slot: number): boolean {
    return assign(action, slot, '')
  }

  function reset(action: ShortcutAction): boolean {
    const factory = DEFAULT_SETTINGS.shortcuts[action]
    const current = deps.current()
    if (factory !== '') {
      const check = checkShortcut(action, factory, { ...current, [action]: [] }, 0)
      if (!check.ok) {
        feedback.value = {
          action,
          kind: 'refused',
          error: check.error ?? 'invalid',
          conflict: check.conflict
        }
        return false
      }
    }
    const next = factory === '' ? [] : [factory]
    deps.save(action, next)
    feedback.value =
      factory === ''
        ? { action, kind: 'removed', accelerator: current[action][0] ?? '' }
        : { action, kind: 'saved', accelerator: factory }
    return true
  }

  function onKeyDown(evt: Event): void {
    const target = active.value
    if (target === null || !isKeyEvent(evt)) return
    const { action, slot } = target
    // Tab and Shift+Tab keep moving the focus: the recording ends with it.
    if (evt.code === 'Tab' && !evt.ctrlKey && !evt.altKey && !evt.metaKey) {
      cancel()
      return
    }
    evt.preventDefault()
    evt.stopPropagation()
    if (evt.repeat === true) return
    if (evt.key === 'Escape' || evt.code === 'Escape') {
      cancel()
      return
    }
    const input = keyInput(evt)
    if (isClearKey(input)) {
      // A new binding has nothing to remove. The patch goes first: main applies it once the
      // capture below has ended.
      if (slot < deps.current()[action].length) remove(action, slot)
      cancel()
      return
    }
    const reading = readKeyboardEvent(input)
    held.value = reading.held
    if (reading.kind === 'modifiers') return
    if (reading.kind === 'refused') {
      feedback.value = { action, kind: 'refused', error: reading.error }
      return
    }
    if (assign(action, slot, reading.accelerator)) cancel()
  }

  /**
   * A controller's button while recording: it becomes the binding recorded (refused like a
   * combination when another action, or another slot, has it). Holding a modifier changes
   * nothing. One from the controller's first report is not saved: it may be resting down (a
   * rotary's position, a latched switch) beside the one pressed, so the row asks for the press
   * again, and the next time the button goes down it is a press for sure.
   */
  function onButton(press: ControllerPress): void {
    const target = active.value
    if (target === null || !isButtonBinding(press.binding)) return
    const device = press.binding.slice(0, press.binding.lastIndexOf(':'))
    if (pressedNames.value[device] !== press.name) {
      pressedNames.value = { ...pressedNames.value, [device]: press.name }
    }
    if (press.first) {
      feedback.value = { action: target.action, kind: 'again' }
      return
    }
    if (assign(target.action, target.slot, press.binding)) cancel()
  }

  /** A modifier let go: the live keycaps follow (the event's flags no longer have it). */
  function onKeyUp(evt: Event): void {
    if (active.value === null || !isKeyEvent(evt)) return
    evt.preventDefault()
    evt.stopPropagation()
    // AltGr's own keyup is not a held AltGr any more (its key value says 'AltGraph').
    held.value = heldModifiers({ ...keyInput(evt), key: '' })
  }

  onScopeDispose(cancel)
  return {
    active: readonly(active),
    held: readonly(held),
    feedback: readonly(feedback),
    pressedNames: readonly(pressedNames),
    toggle,
    start,
    cancel,
    assign,
    remove,
    reset
  }
}

/** The settings window's own capture: keys from the window, saves and commands to main. */
export function windowCaptureDeps(): CaptureDeps {
  const { settings } = useOverlayState()
  return {
    current: () => {
      const s = settings.value ?? DEFAULT_SETTINGS
      return shortcutBindings(s.shortcuts, s.shortcutsMore)
    },
    save: (action, bindings) => void updateSettings({ shortcutBindings: { [action]: bindings } }),
    capture: (on) => sendCommand({ type: 'capture-shortcuts', on }),
    source: window,
    onButton: (cb) => window.overlay.onControllerPress(cb)
  }
}
