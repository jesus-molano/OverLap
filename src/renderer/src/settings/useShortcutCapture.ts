import { onScopeDispose, readonly, shallowRef, type Ref } from 'vue'
import {
  NO_MODIFIERS,
  heldModifiers,
  readKeyboardEvent,
  type HeldModifiers,
  type KeyInput
} from '@shared/accelerator'
import { SHORTCUT_CAPTURE_RENEW_MS } from '@shared/ipc'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { checkShortcut, type ShortcutAction, type ShortcutSettings } from '@shared/shortcuts'
import { useOverlayState } from '../composables/useOverlay'
import { optionSetter, sendCommand } from './editor'
import type { CaptureFeedback } from './shortcutsView'

export type { CaptureFeedback }

/** Where the keys come from: the window (tests pass an EventTarget). */
export type KeySource = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>

export interface CaptureDeps {
  /** The shortcuts now: a combination another action has is refused. */
  current(): Readonly<ShortcutSettings>
  /** Saves a combination ('' turns the shortcut off). */
  save(action: ShortcutAction, accelerator: string): void
  /** Tells main the page records keys (true, then renewed) or no longer does (false). */
  capture(on: boolean): void
  source: KeySource
}

export interface ShortcutCapture {
  /** The row recording now; null when none is. */
  readonly active: Readonly<Ref<ShortcutAction | null>>
  /** The modifiers held right now while recording (the live keycaps). */
  readonly held: Readonly<Ref<Readonly<HeldModifiers>>>
  readonly feedback: Readonly<Ref<CaptureFeedback | null>>
  /** Starts recording on the row of `action`, or cancels when that row already is. */
  toggle(action: ShortcutAction): void
  start(action: ShortcutAction): void
  /** Stops recording without saving anything. */
  cancel(): void
  /**
   * Gives `action` a combination from a button ('' turns it off, a reset its default),
   * checked like a recorded one; false (and the reason in `feedback`) when refused.
   */
  assign(action: ShortcutAction, accelerator: string): boolean
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

/** Backspace or Delete alone turns the shortcut off (Num Lock off, the keypad's Del too). */
function isClearKey(e: KeyInput): boolean {
  if (e.ctrlKey || e.altKey || e.shiftKey || e.metaKey || e.altGraph === true) return false
  return e.key === 'Backspace' || e.key === 'Delete' || e.code === 'Backspace'
}

/**
 * Recording a new combination on the shortcuts page, one row at a time. While it runs, main
 * suspends its global shortcuts so the keys reach this page (the 'capture-shortcuts' command,
 * renewed every SHORTCUT_CAPTURE_RENEW_MS), and every way out releases them: a combination
 * saved, Backspace / Delete (turns it off), Esc, Tab, the window losing focus, cancel() (the
 * row's button losing focus, another click on it) and the owning scope going away (the page
 * left). A refused combination is reported and the recording goes on.
 */
export function useShortcutCapture(deps: CaptureDeps): ShortcutCapture {
  const active = shallowRef<ShortcutAction | null>(null)
  const held = shallowRef<Readonly<HeldModifiers>>(NO_MODIFIERS)
  const feedback = shallowRef<CaptureFeedback | null>(null)
  let renew: ReturnType<typeof setInterval> | null = null

  function listen(on: boolean): void {
    const { source } = deps
    if (on) {
      // Capture phase: the keys never reach the focused button (Enter, Space) or the page.
      source.addEventListener('keydown', onKeyDown, true)
      source.addEventListener('keyup', onKeyUp, true)
      source.addEventListener('blur', cancel)
    } else {
      source.removeEventListener('keydown', onKeyDown, true)
      source.removeEventListener('keyup', onKeyUp, true)
      source.removeEventListener('blur', cancel)
    }
  }

  function start(action: ShortcutAction): void {
    feedback.value = null
    held.value = NO_MODIFIERS
    // Another row: main stays suspended, only the row changes.
    if (active.value !== null) {
      active.value = action
      return
    }
    active.value = action
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

  function toggle(action: ShortcutAction): void {
    if (active.value === action) cancel()
    else start(action)
  }

  function assign(action: ShortcutAction, accelerator: string): boolean {
    const check = checkShortcut(action, accelerator, deps.current())
    if (!check.ok) {
      feedback.value = {
        action,
        kind: 'refused',
        error: check.error ?? 'invalid',
        conflict: check.conflict
      }
      return false
    }
    deps.save(action, check.accelerator)
    feedback.value =
      check.accelerator === ''
        ? { action, kind: 'disabled' }
        : { action, kind: 'saved', accelerator: check.accelerator, warning: check.warning }
    return true
  }

  function onKeyDown(evt: Event): void {
    const action = active.value
    if (action === null || !isKeyEvent(evt)) return
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
      // The patch goes first: main applies it once the capture below has ended.
      if (assign(action, '')) cancel()
      return
    }
    const reading = readKeyboardEvent(input)
    held.value = reading.held
    if (reading.kind === 'modifiers') return
    if (reading.kind === 'refused') {
      feedback.value = { action, kind: 'refused', error: reading.error }
      return
    }
    if (assign(action, reading.accelerator)) cancel()
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
    toggle,
    start,
    cancel,
    assign
  }
}

/** The settings window's own capture: keys from the window, saves and commands to main. */
export function windowCaptureDeps(): CaptureDeps {
  const { settings } = useOverlayState()
  const set = optionSetter('shortcuts')
  return {
    current: () => settings.value?.shortcuts ?? DEFAULT_SETTINGS.shortcuts,
    save: (action, accelerator) => void set(action)(accelerator),
    capture: (on) => sendCommand({ type: 'capture-shortcuts', on }),
    source: window
  }
}
