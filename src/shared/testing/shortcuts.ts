/**
 * Tests' shortcut literals: the «Más acciones» ones (R52) unbound, to spread into a full
 * ShortcutSettings, MoreShortcuts or ShortcutStatusMap written by hand.
 */
import {
  WIDGET_SHORTCUT_ACTIONS,
  type ShortcutStatus,
  type WidgetShortcutAction
} from '../shortcuts'

export const NO_WIDGET_SHORTCUTS: Readonly<Record<WidgetShortcutAction, string>> = Object.freeze(
  Object.fromEntries(WIDGET_SHORTCUT_ACTIONS.map((a) => [a, ''])) as Record<
    WidgetShortcutAction,
    string
  >
)

/** A fresh one each time: the lists are mutable. */
export function NO_WIDGET_MORE(): Record<WidgetShortcutAction, string[]> {
  return Object.fromEntries(WIDGET_SHORTCUT_ACTIONS.map((a) => [a, []])) as unknown as Record<
    WidgetShortcutAction,
    string[]
  >
}

export const NO_WIDGET_STATUS: Readonly<Record<WidgetShortcutAction, ShortcutStatus>> =
  Object.freeze(
    Object.fromEntries(WIDGET_SHORTCUT_ACTIONS.map((a) => [a, 'disabled'])) as Record<
      WidgetShortcutAction,
      ShortcutStatus
    >
  )
