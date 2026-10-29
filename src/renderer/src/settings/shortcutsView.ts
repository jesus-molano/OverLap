/**
 * What the settings window shows about the global shortcuts: the rows of the shortcuts page,
 * the keys at the foot of the sidebar, the edit-mode tooltip and the words for a refused
 * combination. Pure.
 */
import type { AcceleratorError, AcceleratorWarning } from '@shared/accelerator'
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

export interface ShortcutRowView {
  action: ShortcutAction
  label: string
  help: string
  /** The combination ('' when turned off). */
  accelerator: string
  keys: string[]
  /** 'disabled' from the settings themselves; 'unavailable' as main reported it. */
  status: ShortcutStatus
  /** The status badge ('' when registered). */
  badge: string
  /** The factory combination, and as text (the reset button's name). */
  defaultAccelerator: string
  defaultKeys: string
  canDisable: boolean
  canReset: boolean
}

/** One row per action, SHORTCUT_ACTIONS order. */
export function shortcutRows(
  m: Messages,
  shortcuts: Readonly<ShortcutSettings>,
  status: Readonly<ShortcutStatusMap> | null
): ShortcutRowView[] {
  const t = m.settings.shortcuts
  return SHORTCUT_ACTIONS.map((action) => {
    const accelerator = shortcuts[action]
    const defaultAccelerator = DEFAULT_SETTINGS.shortcuts[action]
    const rowStatus: ShortcutStatus =
      accelerator === '' ? 'disabled' : status?.[action] === 'unavailable' ? 'unavailable' : 'ok'
    return {
      action,
      label: t.actions[action].label,
      help: t.actions[action].help,
      accelerator,
      keys: keycaps(m, accelerator),
      status: rowStatus,
      badge: rowStatus === 'ok' ? '' : t.status[rowStatus],
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
  recording: boolean
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
    out.push({ text: t.saved(acceleratorText(m, mine.accelerator)), tone: 'info' })
    if (mine.warning) out.push({ text: warningText(m, mine.warning), tone: 'warn' })
  } else if (mine?.kind === 'disabled' && row.accelerator === '') {
    out.push({ text: t.disabled, tone: 'info' })
  }
  if (row.status === 'unavailable') out.push({ text: t.unavailableHelp, tone: 'warn' })
  return out
}
