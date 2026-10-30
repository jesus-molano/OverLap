/**
 * The focus of a modal dialog (ConfirmDialog): Tab and Shift+Tab go round its own controls and
 * never reach the page behind it. Pure, apart from `focusables`.
 */

/** What Tab can reach inside a dialog. */
export const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Where Tab (`back`: Shift+Tab) must go instead of its own way, among `count` controls with the
 * focus on `index` (-1: on none of them, the dialog itself or its title): the first or the last
 * one when it would leave the dialog, null when its own way stays inside.
 */
export function trapStep(index: number, count: number, back: boolean): number | null {
  if (count === 0) return null
  if (back) return index <= 0 ? count - 1 : null
  return index < 0 || index >= count - 1 ? 0 : null
}

/** The controls Tab reaches in `box`, in order. */
export function focusables(box: HTMLElement): HTMLElement[] {
  return [...box.querySelectorAll<HTMLElement>(FOCUSABLE)]
}
