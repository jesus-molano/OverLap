/**
 * The global keyboard shortcuts: which actions can have one and how a combination is checked
 * against the others. Their combinations live in settings.shortcuts (defaults in
 * settingsSchema.ts); main registers them (main/shortcutManager.ts). Pure.
 */
import { checkAccelerator, type AcceleratorCheck } from './accelerator'

/**
 * Actions a shortcut can run, in priority order: when the file on disk gives two of them the
 * same combination, the first keeps it. `cycleDeltaReference` moves the delta's reference of the
 * current kind of session to the next one (delta/choice.ts), from the next lap on.
 */
export const SHORTCUT_ACTIONS = ['toggleOverlay', 'toggleEditMode', 'cycleDeltaReference'] as const

export type ShortcutAction = (typeof SHORTCUT_ACTIONS)[number]

export function isShortcutAction(value: unknown): value is ShortcutAction {
  return (SHORTCUT_ACTIONS as readonly unknown[]).includes(value)
}

/** settings.shortcuts: a canonical accelerator per action, '' when it has none. */
export type ShortcutSettings = Record<ShortcutAction, string>

/**
 * How a configured shortcut is doing: registered ('ok'), turned off ('disabled'), or refused
 * by Windows because another application holds that combination ('unavailable').
 */
export type ShortcutStatus = 'ok' | 'disabled' | 'unavailable'

export type ShortcutStatusMap = Record<ShortcutAction, ShortcutStatus>

/** Registered only while editing, to leave edit mode. Fixed: it is never configurable. */
export const EXIT_EDIT_ACCELERATOR = 'Escape'

export interface ShortcutCheck extends AcceleratorCheck {
  /** 'duplicate': the action that already has the combination. */
  conflict?: ShortcutAction
}

/**
 * Whether `action` can take `accelerator` given the current shortcuts: an assignable
 * combination no other action has. '' (turning it off) always can.
 */
export function checkShortcut(
  action: ShortcutAction,
  accelerator: string,
  current: Readonly<ShortcutSettings>
): ShortcutCheck {
  if (accelerator === '') return { ok: true, accelerator: '' }
  const check = checkAccelerator(accelerator)
  if (!check.ok) return check
  const conflict = SHORTCUT_ACTIONS.find((a) => a !== action && current[a] === check.accelerator)
  if (conflict !== undefined) {
    return { ok: false, accelerator: check.accelerator, error: 'duplicate', conflict }
  }
  return check
}
