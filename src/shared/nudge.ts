/**
 * Edit mode's keyboard (R38): the arrows move the widget last touched by 1 px (with Shift,
 * 10 px), and with Ctrl they change its size the same way. Main registers these combinations
 * only while editing and while the settings window is not in front (shortcutManager.ts), so they
 * are taken from the other programs only then; a combination one of your shortcuts already uses
 * stays yours. Pure.
 */
import type { Rect, Size } from './types'

/** What one press does: move by dx, dy and grow by dw, dh (px, DIP). */
export interface NudgeStep {
  readonly dx: number
  readonly dy: number
  readonly dw: number
  readonly dh: number
}

/** Shift's step (px). */
export const NUDGE_BIG = 10

const ARROWS = [
  ['Left', -1, 0],
  ['Right', 1, 0],
  ['Up', 0, -1],
  ['Down', 0, 1]
] as const

function steps(): Record<string, NudgeStep> {
  const out: Record<string, NudgeStep> = {}
  for (const [key, x, y] of ARROWS) {
    for (const big of [false, true]) {
      const n = big ? NUDGE_BIG : 1
      const shift = big ? 'Shift+' : ''
      out[`${shift}${key}`] = { dx: x * n, dy: y * n, dw: 0, dh: 0 }
      out[`Ctrl+${shift}${key}`] = { dx: 0, dy: 0, dw: x * n, dh: y * n }
    }
  }
  return out
}

/** Every combination, in accelerator.ts's canonical spelling ('Ctrl+Shift+Left'), and its step. */
export const NUDGE_KEYS: Readonly<Record<string, NudgeStep>> = Object.freeze(steps())

/**
 * `rect` after `step`: moved, or resized from its top-left corner (never below `minSize`, and
 * never in height when the widget's height follows its content: `autoHeight`), kept inside
 * `area` (its display). Rounded.
 */
export function nudgeRect(
  rect: Rect,
  step: NudgeStep,
  minSize: Size,
  area: Rect,
  autoHeight: boolean
): Rect {
  const right = Math.floor(area.x + area.width)
  const bottom = Math.floor(area.y + area.height)
  let width = Math.round(rect.width)
  let height = Math.round(rect.height)
  if (step.dw !== 0) width = Math.max(minSize.width, Math.min(width + step.dw, right - rect.x))
  if (step.dh !== 0 && !autoHeight) {
    height = Math.max(minSize.height, Math.min(height + step.dh, bottom - rect.y))
  }
  width = Math.min(width, Math.floor(area.width))
  height = Math.min(height, Math.floor(area.height))
  const x = Math.min(Math.max(Math.round(rect.x + step.dx), Math.ceil(area.x)), right - width)
  const y = Math.min(Math.max(Math.round(rect.y + step.dy), Math.ceil(area.y)), bottom - height)
  return { x, y, width, height }
}
