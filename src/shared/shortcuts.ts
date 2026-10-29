/**
 * The global shortcuts: which actions can have one and how a binding is checked against the
 * others. A binding is a key combination (accelerator.ts) or a game controller's button
 * (controllers.ts: `joy:046d:c24f:0:7`), up to MAX_BINDINGS per action (a wheel's button and a
 * combination on the keyboard, say). The first one lives in settings.shortcuts (defaults in
 * settingsSchema.ts; it is all a version before 2.2 reads), the others in
 * settings.shortcutsMore; main registers every combination and listens to every button
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
 * settings.shortcuts: per action its first binding, a canonical accelerator or a button
 * binding, '' when it has none.
 */
export type ShortcutSettings = Record<ShortcutAction, string>

/** How many bindings an action can have: the first one and two more. */
export const MAX_BINDINGS = 3

/**
 * settings.shortcutsMore: per action the bindings after the first one (at most
 * MAX_BINDINGS - 1), in order. Empty while the first one is '' (they move up: settleBindings).
 */
export type MoreShortcuts = Record<ShortcutAction, string[]>

/** Every binding of each action, the first one first, none '' (at most MAX_BINDINGS). */
export type ShortcutBindings = Record<ShortcutAction, readonly string[]>

/** No action with more than one binding. */
export function emptyMoreShortcuts(): MoreShortcuts {
  const out = {} as MoreShortcuts
  for (const action of SHORTCUT_ACTIONS) out[action] = []
  return out
}

/** The bindings of each action: settings.shortcuts' then settings.shortcutsMore's. */
export function shortcutBindings(
  first: Readonly<ShortcutSettings>,
  more?: Readonly<Partial<Record<ShortcutAction, readonly string[]>>>
): Record<ShortcutAction, string[]> {
  const out = {} as Record<ShortcutAction, string[]>
  for (const action of SHORTCUT_ACTIONS) {
    out[action] = [first[action], ...(more?.[action] ?? [])].filter((b) => b !== '')
  }
  return out
}

/** The other way round: the first binding of each action ('' for none), and the others. */
export function splitBindings(bindings: Readonly<ShortcutBindings>): {
  shortcuts: ShortcutSettings
  more: MoreShortcuts
} {
  const shortcuts = {} as ShortcutSettings
  const more = emptyMoreShortcuts()
  for (const action of SHORTCUT_ACTIONS) {
    const [first = '', ...rest] = bindings[action]
    shortcuts[action] = first
    more[action] = rest
  }
  return { shortcuts, more }
}

/**
 * Lists of bindings from anything: per action its valid bindings in their canonical spelling
 * ('' and anything else dropped), at most MAX_BINDINGS. A binding that repeats one already
 * taken is dropped (SHORTCUT_ACTIONS order, then slot order: the earlier action, or slot, keeps
 * it) and the ones after it move up, so a first binding dropped is replaced by the next one.
 */
export function settleBindings(
  raw: Readonly<Partial<Record<ShortcutAction, readonly unknown[]>>>
): Record<ShortcutAction, string[]> {
  const seen = new Set<string>()
  const out = {} as Record<ShortcutAction, string[]>
  for (const action of SHORTCUT_ACTIONS) {
    const list: string[] = []
    for (const value of raw[action] ?? []) {
      if (list.length >= MAX_BINDINGS) break
      const binding = canonicalShortcut(value)
      if (binding === null || seen.has(binding)) continue
      seen.add(binding)
      list.push(binding)
    }
    out[action] = list
  }
  return out
}

/** Whether two sets of bindings are the same, slot by slot. */
export function sameBindings(
  a: Readonly<ShortcutBindings>,
  b: Readonly<ShortcutBindings>
): boolean {
  return SHORTCUT_ACTIONS.every((action) => sameList(a[action], b[action]))
}

export function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => b[i] === x)
}

/** The first key combination among `list` (a menu or a hint shows keys only), '' for none. */
export function firstCombination(list: readonly string[]): string {
  return list.find((b) => b !== '' && !isButtonBinding(b)) ?? ''
}

/** Every binding of every action, in priority order. */
export function everyBinding(bindings: Readonly<ShortcutBindings>): string[] {
  return SHORTCUT_ACTIONS.flatMap((action) => [...bindings[action]])
}

/**
 * How a configured shortcut is doing: working ('ok'), turned off ('disabled': no binding), or
 * not all working ('unavailable'): Windows refused one of its combinations because another
 * application holds it, or one of its buttons' controller is not connected (or cannot be read).
 * Which ones: ShortcutStatusReport.unavailable.
 */
export type ShortcutStatus = 'ok' | 'disabled' | 'unavailable'

export type ShortcutStatusMap = Record<ShortcutAction, ShortcutStatus>

/** What main tells the settings window: per action, and which bindings do not work. */
export interface ShortcutStatusReport {
  actions: ShortcutStatusMap
  /** The bindings that do not work now (each one belongs to a single action). */
  unavailable: string[]
}

/** Registered only while editing, to leave edit mode. Fixed: it is never configurable. */
export const EXIT_EDIT_ACCELERATOR = 'Escape'

export interface ShortcutCheck extends AcceleratorCheck {
  /**
   * 'duplicate': the action that already has the combination or the button (the action itself
   * when another of its own bindings is that one).
   */
  conflict?: ShortcutAction
}

/** A binding in its canonical spelling (a combination or a button), null when it is neither. */
export function canonicalShortcut(value: unknown): string | null {
  if (isButtonBinding(value)) return value
  return canonicalAccelerator(value)
}

/**
 * Whether `action` can take `binding` in slot `slot` (the binding it replaces; by default the
 * next free one, an addition) given the current bindings: an assignable combination, or a
 * controller's button, that no other action, and no other slot of this one, has. '' (removing
 * the binding of that slot) always can.
 */
export function checkShortcut(
  action: ShortcutAction,
  binding: string,
  current: Readonly<ShortcutBindings>,
  slot: number = current[action].length
): ShortcutCheck {
  if (binding === '') return { ok: true, accelerator: '' }
  const check: AcceleratorCheck = isButtonBinding(binding)
    ? { ok: true, accelerator: binding }
    : checkAccelerator(binding)
  if (!check.ok) return check
  const conflict = SHORTCUT_ACTIONS.find((a) =>
    current[a].some((b, i) => b === check.accelerator && (a !== action || i !== slot))
  )
  if (conflict !== undefined) {
    return { ok: false, accelerator: check.accelerator, error: 'duplicate', conflict }
  }
  return check
}

/**
 * The bindings of an action with `binding` in slot `slot`: replacing the one there, added after
 * the last one (slot = how many there are), or the one there removed ('': the next ones move
 * up). An addition past MAX_BINDINGS changes nothing.
 */
export function withBinding(list: readonly string[], slot: number, binding: string): string[] {
  const out = [...list]
  if (binding === '') {
    if (slot >= 0 && slot < out.length) out.splice(slot, 1)
    return out
  }
  if (slot >= 0 && slot < out.length) out[slot] = binding
  else if (out.length < MAX_BINDINGS) out.push(binding)
  return out
}
