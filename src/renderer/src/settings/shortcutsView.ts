/**
 * What the settings window shows about the global shortcuts: the rows of the shortcuts page
 * (each action with its bindings side by side, up to MAX_BINDINGS), the keys at the foot of the
 * sidebar, the edit-mode tooltip and the words for a refused binding. A binding is a key
 * combination or a controller's button (named after its controller:
 * settings.buttonDeviceNames). Pure.
 */
import type { AcceleratorError, AcceleratorWarning } from '@shared/accelerator'
import { fallbackControllerName, isButtonBinding, parseButtonBinding } from '@shared/controllers'
import { acceleratorText, keycaps, type Messages } from '@shared/i18n'
import { DEFAULT_SETTINGS } from '@shared/settings'
import {
  EXIT_EDIT_ACCELERATOR,
  MAX_BINDINGS,
  SHORTCUT_ACTIONS,
  sameList,
  type ShortcutAction,
  type ShortcutBindings,
  type ShortcutStatus,
  type ShortcutStatusReport
} from '@shared/shortcuts'

/** What the last attempt on a row did (useShortcutCapture); the row words it. */
export type CaptureFeedback =
  | {
      action: ShortcutAction
      kind: 'refused'
      error: AcceleratorError
      /** 'duplicate': the action that has it (this one, when another of its bindings is it). */
      conflict?: ShortcutAction
      /** The button refused (a combination is not repeated: the user knows what they typed). */
      button?: string
    }
  | {
      action: ShortcutAction
      kind: 'saved'
      accelerator: string
      warning?: AcceleratorWarning
      /** Where it is now among the action's bindings. */
      slot?: number
    }
  /** A binding removed (the × of its chip, Backspace while recording it); `slot`: where it was. */
  | { action: ShortcutAction; kind: 'removed'; accelerator: string; slot?: number }
  /** A button from a controller's first report: not saved, it must be pressed again. */
  | { action: ShortcutAction; kind: 'again' }

/** Controller id -> its name (settings.buttonDeviceNames, and the ones just pressed). */
export type DeviceNames = Readonly<Record<string, string>>

/** A button binding as the page draws it: 'Botón 12' and its controller's name. */
export interface ButtonView {
  button: string
  device: string
}

/** One binding of a row: a chip. */
export interface BindingView {
  /** The binding: a combination or a button. */
  accelerator: string
  /** Its place among the action's bindings (0: the first, the one older versions read). */
  slot: number
  /** The keycaps of a combination ([] for a button). */
  keys: string[]
  /** The button, when the binding is one. */
  button: ButtonView | null
  /** As one text: 'Ctrl+Shift+H', 'Botón 24 · G29 Driving Force Racing Wheel'. */
  text: string
  /**
   * Not working now, as main reported it: another application holds the combination, or the
   * button's controller is not connected.
   */
  off: boolean
}

export interface ShortcutRowView {
  action: ShortcutAction
  label: string
  help: string
  /** Its bindings, in order ([] when turned off). */
  bindings: BindingView[]
  /**
   * 'disabled' without bindings; 'unavailable' when one of them does not work (its chip says
   * which); else 'ok'.
   */
  status: ShortcutStatus
  /** The status badge ('' when working). */
  badge: string
  /** Another binding can be added (fewer than MAX_BINDINGS). */
  canAdd: boolean
  /** The factory combination, and as text (the reset button's name). */
  defaultAccelerator: string
  defaultKeys: string
  /** Away from the factory bindings (the factory combination alone). */
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

/** A binding without its controller: 'Ctrl+Shift+E', 'Botón 12'. */
function shortBindingText(m: Messages, binding: string): string {
  const parsed = parseButtonBinding(binding)
  return parsed ? m.core.keys.button(parsed.button) : acceleratorText(m, binding)
}

/**
 * An action's bindings inside a sentence, any of them does it: the only one in full
 * ('Botón 12 de G29 …': no "·", which those sentences already use between their parts),
 * several without their controllers ('Ctrl+Shift+H o Botón 24', 'Ctrl+Shift+E, Botón 3 o
 * F13'); '' for none.
 */
export function bindingsText(m: Messages, list: readonly string[], names: DeviceNames): string {
  if (list.length <= 1) {
    const only = list[0] ?? ''
    const button = buttonView(m, only, names)
    if (button) return m.settings.shortcuts.buttonAria(button.button, button.device)
    return acceleratorText(m, only)
  }
  const texts = list.map((b) => shortBindingText(m, b))
  return m.settings.shortcuts.anyOf(texts.slice(0, -1).join(', '), texts.at(-1) ?? '')
}

/** The badge of a row: off, or which kind of binding does not work. */
function badgeOf(m: Messages, status: ShortcutStatus, off: readonly BindingView[]): string {
  const t = m.settings.shortcuts.status
  if (status === 'ok') return ''
  if (status === 'disabled') return t.disabled
  return off.every((b) => b.button !== null) ? t.disconnected : t.unavailable
}

/** One row per action, SHORTCUT_ACTIONS order. */
export function shortcutRows(
  m: Messages,
  bindings: Readonly<ShortcutBindings>,
  status: Readonly<ShortcutStatusReport> | null,
  names: DeviceNames = {}
): ShortcutRowView[] {
  const t = m.settings.shortcuts
  const unavailable = new Set(status?.unavailable ?? [])
  return SHORTCUT_ACTIONS.map((action) => {
    const list = bindings[action]
    const defaultAccelerator = DEFAULT_SETTINGS.shortcuts[action]
    const chips = list.map((accelerator, slot): BindingView => {
      const button = buttonView(m, accelerator, names)
      return {
        accelerator,
        slot,
        keys: button ? [] : keycaps(m, accelerator),
        button,
        text: bindingText(m, accelerator, names),
        off: unavailable.has(accelerator)
      }
    })
    const off = chips.filter((c) => c.off)
    const rowStatus: ShortcutStatus =
      chips.length === 0 ? 'disabled' : off.length > 0 ? 'unavailable' : 'ok'
    return {
      action,
      label: t.actions[action].label,
      help: t.actions[action].help,
      bindings: chips,
      status: rowStatus,
      badge: badgeOf(m, rowStatus, off),
      canAdd: chips.length < MAX_BINDINGS,
      defaultAccelerator,
      defaultKeys: acceleratorText(m, defaultAccelerator),
      // An action without a factory combination (the delta's cycle) is reset by removing its own.
      canReset: defaultAccelerator !== '' && !sameList(list, [defaultAccelerator])
    }
  })
}

/** How many controller buttons the actions have, all their bindings counted. */
export function buttonBindingCount(bindings: Readonly<ShortcutBindings>): number {
  return SHORTCUT_ACTIONS.reduce((n, a) => n + bindings[a].filter(isButtonBinding).length, 0)
}

export interface KeyHint {
  id: ShortcutAction | 'exit'
  /** 'Ctrl+Shift+E', or 'Botón 3 · G29 Driving Force Racing Wheel' for a button. */
  keys: string
  label: string
  /** A controller's button: drawn with the wheel glyph, not as a key. */
  button: boolean
  /** The binding in full, for a button ('Botón 3 · G29 …'; its controller is not drawn). */
  title?: string
}

/**
 * The foot of the sidebar: edit mode, show / hide, then Esc, each with one binding (the sidebar
 * is narrow): its first key combination, else its first button, without its controller (that
 * one in the title); a shortcut turned off is left out.
 */
export function sidebarKeys(
  m: Messages,
  bindings: Readonly<ShortcutBindings>,
  names: DeviceNames = {}
): KeyHint[] {
  const k = m.settings.nav.keys
  const out: KeyHint[] = []
  const add = (id: KeyHint['id'], list: readonly string[], label: string): void => {
    const accelerator = list.find((b) => !isButtonBinding(b)) ?? list[0] ?? ''
    if (accelerator === '') return
    if (!isButtonBinding(accelerator)) {
      out.push({ id, keys: acceleratorText(m, accelerator), label, button: false })
      return
    }
    const title = bindingText(m, accelerator, names)
    out.push({ id, keys: shortBindingText(m, accelerator), label, button: true, title })
  }
  add('toggleEditMode', bindings.toggleEditMode, k.editMode)
  add('toggleOverlay', bindings.toggleOverlay, k.overlay)
  add('exit', [EXIT_EDIT_ACCELERATOR], k.exit)
  return out
}

/**
 * 'Mover y redimensionar los widgets (Ctrl+Shift+E o Botón 24)', without the keys when it has
 * none.
 */
export function editModeTooltip(
  m: Messages,
  bindings: Readonly<ShortcutBindings>,
  names: DeviceNames = {}
): string {
  const keys = bindingsText(m, bindings.toggleEditMode, names)
  return keys === '' ? m.settings.editMode.tooltip : m.settings.editMode.tooltipKeys(keys)
}

/**
 * Why a binding was refused, naming the action that has it for a duplicate (worded apart when
 * it is the row's own, `action`), and the button pressed (`button`: its text,
 * 'Botón 12 · G29 …') when it was one.
 */
export function refusalText(
  m: Messages,
  error: AcceleratorError,
  conflict: ShortcutAction | undefined,
  button?: string,
  action?: ShortcutAction
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
    case 'duplicate': {
      if (conflict !== undefined && conflict === action) {
        return button ? e.duplicateSameButton(button) : e.duplicateSame
      }
      const label = conflict ? m.settings.shortcuts.actions[conflict].label : ''
      return button ? e.duplicateButton(button, label) : e.duplicate(label)
    }
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
 * The lines under a row: while recording (`recording`: the slot recorded, null when not), why
 * the last binding was refused, or how to cancel (and remove the binding being replaced);
 * otherwise what the last attempt on it did, and why some binding does not work. "Saved" and
 * "removed" only while the bindings still are what they say (a reset of every shortcut, say,
 * makes them stale).
 */
export function rowMessages(
  m: Messages,
  row: ShortcutRowView,
  feedback: CaptureFeedback | null,
  recording: number | null,
  names: DeviceNames = {}
): RowMessage[] {
  const t = m.settings.shortcuts
  const mine = feedback !== null && feedback.action === row.action ? feedback : null
  const refused =
    mine?.kind === 'refused'
      ? refusalText(
          m,
          mine.error,
          mine.conflict,
          mine.button === undefined ? undefined : bindingText(m, mine.button, names),
          row.action
        )
      : ''
  if (recording !== null) {
    if (mine?.kind === 'refused') return [{ text: refused, tone: 'error' }]
    if (mine?.kind === 'again') return [{ text: t.capture.pressAgain, tone: 'info' }]
    const replacing = recording < row.bindings.length
    return [{ text: replacing ? t.capture.clearHint : t.capture.addHint, tone: 'info' }]
  }
  const has = (b: string): boolean => row.bindings.some((c) => c.accelerator === b)
  const out: RowMessage[] = []
  if (mine?.kind === 'refused') {
    out.push({ text: refused, tone: 'error' })
  } else if (mine?.kind === 'saved' && has(mine.accelerator)) {
    out.push({ text: t.saved(bindingText(m, mine.accelerator, names)), tone: 'info' })
    if (mine.warning) out.push({ text: warningText(m, mine.warning), tone: 'warn' })
  } else if (mine?.kind === 'removed' && !has(mine.accelerator)) {
    const text =
      row.bindings.length === 0 ? t.disabled : t.removed(bindingText(m, mine.accelerator, names))
    out.push({ text, tone: 'info' })
  }
  if (row.bindings.some((b) => b.off && b.button !== null)) {
    out.push({ text: t.disconnectedHelp, tone: 'warn' })
  }
  if (row.bindings.some((b) => b.off && b.button === null)) {
    out.push({ text: t.unavailableHelp, tone: 'warn' })
  }
  return out
}

/** Where the focus goes on a row once a change has redrawn it: a chip's slot, or "add". */
export type RowFocus = { slot: number } | 'add'

/**
 * Where the focus goes after `feedback` changed `row` (its bindings now), when the button that
 * had it went away with the change (a removed chip's ×, a chip recorded over, "add" once the
 * row is full, Reset once it is back to the factory binding): the chip now in the slot of the
 * change (the next one moved up), else "add", else the last chip; null when nothing changed.
 */
export function focusAfter(
  feedback: CaptureFeedback | null,
  row: ShortcutRowView
): RowFocus | null {
  if (feedback === null || feedback.action !== row.action) return null
  if (feedback.kind !== 'saved' && feedback.kind !== 'removed') return null
  const count = row.bindings.length
  const slot = feedback.slot ?? 0
  if (slot < count) return { slot }
  if (row.canAdd) return 'add'
  return count > 0 ? { slot: count - 1 } : null
}
