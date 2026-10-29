/**
 * The shortcuts' bindings in the settings: the first one of each action in settings.shortcuts
 * (an option section, what a version before 2.2 reads), the others in settings.shortcutsMore.
 * Read from disk and patched here, so both always hold valid, canonical bindings, unique across
 * every action and slot, the first one filled whenever an action has any.
 */
import {
  MAX_BINDINGS,
  SHORTCUT_ACTIONS,
  canonicalShortcut,
  sameList,
  settleBindings,
  shortcutBindings,
  splitBindings,
  type ShortcutAction,
  type ShortcutBindings
} from '../shortcuts'
import type { OverlaySettings } from '../types'
import { isRecord } from './fields'

type ShortcutFields = Pick<OverlaySettings, 'shortcuts' | 'shortcutsMore'>

/** Every binding of each action in `s`. */
export function bindingsOf(s: Readonly<ShortcutFields>): Record<ShortcutAction, string[]> {
  return shortcutBindings(s.shortcuts, s.shortcutsMore)
}

function write(s: ShortcutFields, bindings: Readonly<ShortcutBindings>): void {
  const { shortcuts, more } = splitBindings(bindings)
  s.shortcuts = shortcuts
  s.shortcutsMore = more
}

/**
 * Read from disk, after the shortcuts section (`s.shortcuts`, already valid and unique): adds
 * each action's extra bindings from `rawMore` (settings.shortcutsMore of the file). Invalid
 * ones are dropped, one that repeats an earlier binding too (the earlier action, or slot,
 * keeps it), past MAX_BINDINGS as well; a first binding that is '' takes the next one. A file
 * without the field (every file before 2.2) keeps its shortcuts as they are.
 */
export function settleShortcuts(s: ShortcutFields, rawMore: unknown): void {
  const more = isRecord(rawMore) ? rawMore : {}
  const lists: Partial<Record<ShortcutAction, unknown[]>> = {}
  for (const action of SHORTCUT_ACTIONS) {
    const extra = more[action]
    lists[action] = [s.shortcuts[action], ...(Array.isArray(extra) ? extra : [])]
  }
  write(s, settleBindings(lists))
}

/**
 * A patch's bindings for one action (`shortcutBindings`): every one valid and canonical, none
 * twice, at most MAX_BINDINGS; null otherwise (the patch of that action is refused).
 */
function patchedList(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_BINDINGS) return null
  const out: string[] = []
  for (const value of raw) {
    const binding = canonicalShortcut(value)
    if (binding === null || out.includes(binding)) return null
    out.push(binding)
  }
  return out
}

/**
 * Applies the shortcuts of an untrusted patch: `first` (patch.shortcuts) sets an action's first
 * binding ('' removes it, and the next one moves up; an invalid one is ignored), `lists`
 * (patch.shortcutBindings) replaces all of an action's bindings (refused whole when one is not
 * valid). An action whose new bindings include one another action has keeps its current ones,
 * until none does (the current ones never repeat, so this ends): two actions that swapped
 * bindings are both accepted.
 */
export function patchShortcuts(s: ShortcutFields, first: unknown, lists: unknown): void {
  const before = bindingsOf(s)
  const next = bindingsOf(s)
  const changed = new Set<ShortcutAction>()
  if (isRecord(first)) {
    for (const action of SHORTCUT_ACTIONS) {
      if (!(action in first)) continue
      const value = first[action]
      const rest = next[action].slice(1)
      if (value === '') {
        next[action] = rest
      } else {
        const binding = canonicalShortcut(value)
        if (binding === null) continue
        next[action] = [binding, ...rest.filter((b) => b !== binding)]
      }
      changed.add(action)
    }
  }
  if (isRecord(lists)) {
    for (const action of SHORTCUT_ACTIONS) {
      const list = patchedList(lists[action])
      if (list === null) continue
      next[action] = list
      changed.add(action)
    }
  }
  for (;;) {
    const colliding = [...changed].filter(
      (action) =>
        !sameList(next[action], before[action]) &&
        next[action].some((b) =>
          SHORTCUT_ACTIONS.some((other) => other !== action && next[other].includes(b))
        )
    )
    if (colliding.length === 0) break
    for (const action of colliding) next[action] = before[action]
  }
  write(s, next)
}
