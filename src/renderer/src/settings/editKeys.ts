/**
 * Edit mode's keys with the settings window in front (R38). Main takes the arrows, Tab and Ctrl+Z
 * only from the other programs: the settings window keeps them for its sliders, lists and fields.
 * Where the focus is free, the window passes them on, so they do what its banner says («Flechas:
 * mover · Tab: otro widget · Ctrl+Z: deshacer») right after «Editar posición» too:
 *
 * - the arrows and Ctrl+Z, while the focus is on nothing or on a plain button (neither moves with
 *   them), and no «Deshacer» toast of this window is shown (Ctrl+Z is the toast's then);
 * - Tab and Shift+Tab only while «aimed»: just after «Editar posición», until anything here takes
 *   the focus or a click, so moving through the page with Tab is never taken away.
 *
 * Pure but for `targetKind`, which reads the DOM.
 */
import { EDIT_KEYS, EDIT_UNDO_KEY, PICK_KEYS } from '@shared/nudge'

/** Where the keyboard focus is: nothing, a plain button, or a control that uses these keys. */
export type FocusKind = 'free' | 'button' | 'control'

/** Whether an edit-mode key (`accelerator`, accelerator.ts's spelling) goes on to edit mode. */
export function forwardsEditKey(
  accelerator: string,
  focus: FocusKind,
  state: { readonly aimed: boolean; readonly undoShown: boolean }
): boolean {
  if (!EDIT_KEYS.includes(accelerator) || focus === 'control') return false
  if (PICK_KEYS[accelerator] !== undefined) return focus === 'free' && state.aimed
  if (accelerator === EDIT_UNDO_KEY) return !state.undoShown
  return true
}

/** Roles that move with the arrows (or take Tab within themselves). */
const KEYED_ROLES = new Set([
  'slider',
  'spinbutton',
  'radio',
  'radiogroup',
  'listbox',
  'option',
  'menu',
  'menuitem',
  'menubar',
  'tab',
  'tablist',
  'grid',
  'combobox',
  'textbox',
  'tree',
  'treeitem'
])

/** What the focused element `el` is for these keys (null, body: nothing). */
export function targetKind(el: Element | null): FocusKind {
  if (el === null || el === document.body || el === document.documentElement) return 'free'
  if (!(el instanceof HTMLElement)) return 'control'
  if (el.isContentEditable) return 'control'
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) return 'control'
  if (el instanceof HTMLTextAreaElement) return 'control'
  // A list row's handle (arrows reorder it) and anything inside a keyed widget.
  if (el.closest('.ed-row, [role="radiogroup"], [role="listbox"], [role="menu"]')) {
    return 'control'
  }
  if (el.closest('[role="tablist"], [role="grid"], [role="tree"]')) return 'control'
  const role = el.getAttribute('role')
  if (role !== null && KEYED_ROLES.has(role)) return 'control'
  if (el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement) return 'button'
  if (el.tagName === 'SUMMARY') return 'button'
  // A scrolling region or a card that took the focus: nothing of its own moves with them.
  return el.tabIndex < 0 ? 'free' : 'button'
}
