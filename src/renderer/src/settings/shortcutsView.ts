/**
 * What the settings window shows about the global shortcuts: the rows of the shortcuts page,
 * the keys at the foot of the sidebar, the edit-mode tooltip and the words for a refused
 * combination. A shortcut is a key combination or a controller's button (named after its
 * controller: settings.buttonDeviceNames). Pure.
 */
import type { AcceleratorError, AcceleratorWarning } from '@shared/accelerator'
import { fallbackControllerName, parseButtonBinding } from '@shared/controllers'
import { acceleratorText, keycaps, type Messages } from '@shared/i18n'
import { DEFAULT_SETTINGS } from '@shared/settings'
import {
  EXIT_EDIT_ACCELERATOR,
  SHORTCUT_ACTIONS,
  type ShortcutAction,
  type ShortcutSettings,
  type ShortcutStatus,
  type ShortcutStatusMap
} from '@shared/shortcuts'

/** What the last attempt on a row did (useShortcutCapture); the row words it. */
export type CaptureFeedback =
  | { action: ShortcutAction; kind: 'refused'; error: AcceleratorError; conflict?: ShortcutAction }
  | { action: ShortcutAction; kind: 'saved'; accelerator: string; warning?: AcceleratorWarning }
  | { action: ShortcutAction; kind: 'disabled' }

/** Controller id -> its name (settings.buttonDeviceNames, and the ones just pressed). */
export type DeviceNames = Readonly<Record<string, string>>

/** A button binding as the page draws it: 'Botón 12' and its controller's name. */
export interface ButtonView {
  button: string
  device: string
}

export interface ShortcutRowView {
  action: ShortcutAction
  label: string
  help: string
  /** The binding: a combination or a button ('' when turned off). */
  accelerator: string
  /** The keycaps of a combination ([] for a button or none). */
  keys: string[]
  /** The button, when the binding is one. */
  button: ButtonView | null
  /**
   * 'disabled' from the settings themselves; 'unavailable' as main reported it (a combination
   * another application holds, a button whose controller is not connected).
   */
  status: ShortcutStatus
  /** The status badge ('' when working). */
  badge: string
  /** The factory combination, and as text (the reset button's name). */
  defaultAccelerator: string
  defaultKeys: string
  canDisable: boolean
  canReset: boolean
}

/**
 * A controller's name; with its ids when another controller of `names` has the same name
 * ('Button Box (1dd2:2201)'), so two of them can be told apart.
 */
export function deviceName(id: string, names: DeviceNames): string {
  const name = names[id] ?? fallbackControllerName(id)
  const twin = Object.entries(names).some(([other, n]) => other !== id && n === name)
  if (!twin) return name
  const [, vid = '', pid = '', iface = '0'] = id.split(':')
  return `${name} (${vid}:${pid}${iface === '0' ? '' : `/${iface}`})`
}

/** The button of a binding, null for a combination or none. */
export function buttonView(m: Messages, binding: string, names: DeviceNames): ButtonView | null {
  const parsed = parseButtonBinding(binding)
  if (!parsed) return null
  return { button: m.core.keys.button(parsed.button), device: deviceName(parsed.device, names) }
}

/** A binding as one text: 'Ctrl+Shift+E', 'Botón 12 · G29 Driving Force Racing Wheel'. */
export function bindingText(m: Messages, binding: string, names: DeviceNames): string {
  const button = buttonView(m, binding, names)
  return button ? `${button.button} · ${button.device}` : acceleratorText(m, binding)
}

/** One row per action, SHORTCUT_ACTIONS order. */
export function shortcutRows(
  m: Messages,
  shortcuts: Readonly<ShortcutSettings>,
  status: Readonly<ShortcutStatusMap> | null,
  names: DeviceNames = {}
): ShortcutRowView[] {
  const t = m.settings.shortcuts
  return SHORTCUT_ACTIONS.map((action) => {
    const accelerator = shortcuts[action]
    const defaultAccelerator = DEFAULT_SETTINGS.shortcuts[action]
    const button = buttonView(m, accelerator, names)
    const rowStatus: ShortcutStatus =
      accelerator === '' ? 'disabled' : status?.[action] === 'unavailable' ? 'unavailable' : 'ok'
    return {
      action,
      label: t.actions[action].label,
      help: t.actions[action].help,
      accelerator,
      keys: button ? [] : keycaps(m, accelerator),
      button,
      status: rowStatus,
      badge:
        rowStatus === 'ok'
          ? ''
          : rowStatus === 'unavailable' && button
            ? t.status.disconnected
            : t.status[rowStatus],
      defaultAccelerator,
      defaultKeys: acceleratorText(m, defaultAccelerator),
      canDisable: accelerator !== '',
      // An action without a factory combination (the delta's cycle) is reset by turning it off.
      canReset: accelerator !== defaultAccelerator && defaultAccelerator !== ''
    }
  })
}

export interface KeyHint {
  id: ShortcutAction | 'exit'
  keys: string
  label: string
}

/** The foot of the sidebar: edit mode, show / hide, then Esc; a shortcut turned off is left out. */
export function sidebarKeys(m: Messages, shortcuts: Readonly<ShortcutSettings>): KeyHint[] {
  const k = m.settings.nav.keys
  const out: KeyHint[] = []
  const add = (id: KeyHint['id'], accelerator: string, label: string): void => {
    if (accelerator !== '') out.push({ id, keys: acceleratorText(m, accelerator), label })
  }
  add('toggleEditMode', shortcuts.toggleEditMode, k.editMode)
  add('toggleOverlay', shortcuts.toggleOverlay, k.overlay)
  add('exit', EXIT_EDIT_ACCELERATOR, k.exit)
  return out
}

/** 'Mover y redimensionar los widgets (Ctrl+Shift+E)', without the keys when it has none. */
export function editModeTooltip(m: Messages, shortcuts: Readonly<ShortcutSettings>): string {
  const keys = acceleratorText(m, shortcuts.toggleEditMode)
  return keys === '' ? m.settings.editMode.tooltip : m.settings.editMode.tooltipKeys(keys)
}

/** Why a combination was refused, naming the action that has it for a duplicate. */
export function refusalText(
  m: Messages,
  error: AcceleratorError,
  conflict: ShortcutAction | undefined
): string {
  const e = m.settings.shortcuts.errors
  switch (error) {
    case 'invalid':
      return e.invalid
    case 'unsupported-key':
      return e.unsupportedKey
    case 'meta':
      return e.meta
    case 'needs-modifier':
      return e.needsModifier
    case 'reserved':
      return e.reserved
    case 'duplicate':
      return e.duplicate(conflict ? m.settings.shortcuts.actions[conflict].label : '')
  }
}

export function warningText(m: Messages, warning: AcceleratorWarning): string {
  return m.settings.shortcuts.warnings[warning]
}

export interface RowMessage {
  text: string
  tone: 'info' | 'warn' | 'error'
}

/**
 * The lines under a row: while recording, why the last combination was refused (or how to turn
 * the shortcut off); otherwise what the last attempt on it did, and why it does not work when
 * another application holds it. "Saved" and "turned off" only while the shortcut still is what
 * they say (a reset of every shortcut, say, makes them stale).
 */
export function rowMessages(
  m: Messages,
  row: ShortcutRowView,
  feedback: CaptureFeedback | null,
  recording: boolean,
  names: DeviceNames = {}
): RowMessage[] {
  const t = m.settings.shortcuts
  const mine = feedback !== null && feedback.action === row.action ? feedback : null
  if (recording) {
    return mine?.kind === 'refused'
      ? [{ text: refusalText(m, mine.error, mine.conflict), tone: 'error' }]
      : [{ text: t.capture.clearHint, tone: 'info' }]
  }
  const out: RowMessage[] = []
  if (mine?.kind === 'refused') {
    out.push({ text: refusalText(m, mine.error, mine.conflict), tone: 'error' })
  } else if (mine?.kind === 'saved' && mine.accelerator === row.accelerator) {
    out.push({ text: t.saved(bindingText(m, mine.accelerator, names)), tone: 'info' })
    if (mine.warning) out.push({ text: warningText(m, mine.warning), tone: 'warn' })
  } else if (mine?.kind === 'disabled' && row.accelerator === '') {
    out.push({ text: t.disabled, tone: 'info' })
  }
  if (row.status === 'unavailable') {
    out.push({ text: row.button ? t.disconnectedHelp : t.unavailableHelp, tone: 'warn' })
  }
  return out
}
