/**
 * The global shortcuts: which actions can have one and how a binding is checked against the
 * others. A binding is a key combination (accelerator.ts) or a game controller's button
 * (controllers.ts: `joy:046d:c24f:0:7`), one per action. They live in settings.shortcuts
 * (defaults in settingsSchema.ts); main registers the combinations and listens to the buttons
 * (main/shortcutManager.ts). Pure.
 */
import { canonicalAccelerator, checkAccelerator, type AcceleratorCheck } from './accelerator'
import { isButtonBinding } from './controllers'

/**
 * Actions a shortcut can run, in priority order: when the file on disk gives two of them the
 * same combination, the first keeps it. `cycleDeltaReference` moves the delta's reference of the
 * current kind of session to the next one (delta/choice.ts), from the next lap on; `nextLayout`
 * applies the saved layout after the one in use (layouts.ts), and that choice is saved;
 * openSettings opens the settings window, or brings it to the front.
 */
export const SHORTCUT_ACTIONS = [
  'toggleOverlay',
  'toggleEditMode',
  'cycleDeltaReference',
  'nextLayout',
  'openSettings'
] as const

export type ShortcutAction = (typeof SHORTCUT_ACTIONS)[number]

export function isShortcutAction(value: unknown): value is ShortcutAction {
  return (SHORTCUT_ACTIONS as readonly unknown[]).includes(value)
}

/**
 * settings.shortcuts: per action a canonical accelerator or a button binding, '' when it has
 * none.
 */
export type ShortcutSettings = Record<ShortcutAction, string>

/**
 * How a configured shortcut is doing: working ('ok'), turned off ('disabled'), or not working
 * ('unavailable'): Windows refused the combination because another application holds it, or
 * the button's controller is not connected (or cannot be read).
 */
export type ShortcutStatus = 'ok' | 'disabled' | 'unavailable'

export type ShortcutStatusMap = Record<ShortcutAction, ShortcutStatus>

/** Registered only while editing, to leave edit mode. Fixed: it is never configurable. */
export const EXIT_EDIT_ACCELERATOR = 'Escape'

export interface ShortcutCheck extends AcceleratorCheck {
  /** 'duplicate': the action that already has the combination or the button. */
  conflict?: ShortcutAction
}

/** A binding in its canonical spelling (a combination or a button), null when it is neither. */
export function canonicalShortcut(value: unknown): string | null {
  if (isButtonBinding(value)) return value
  return canonicalAccelerator(value)
}

/**
 * Whether `action` can take `binding` given the current shortcuts: an assignable combination,
 * or a controller's button, that no other action has. '' (turning it off) always can.
 */
export function checkShortcut(
  action: ShortcutAction,
  binding: string,
  current: Readonly<ShortcutSettings>
): ShortcutCheck {
  if (binding === '') return { ok: true, accelerator: '' }
  const check: AcceleratorCheck = isButtonBinding(binding)
    ? { ok: true, accelerator: binding }
    : checkAccelerator(binding)
  if (!check.ok) return check
  const conflict = SHORTCUT_ACTIONS.find((a) => a !== action && current[a] === check.accelerator)
  if (conflict !== undefined) {
    return { ok: false, accelerator: check.accelerator, error: 'duplicate', conflict }
  }
  return check
}
