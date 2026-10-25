/**
 * Edge snapping while moving or resizing a widget in edit mode. Pure: main
 * applies it to the rect from `applyDrag` (unless Alt is held). Rects are in
 * DIP screen coordinates.
 */
import type { ResizeHandle } from './ipc'
import type { Rect, Size } from './types'

/** Distance (DIP) within which an edge jumps to a line. */
export const SNAP_THRESHOLD = 8

/** Delta from `value` to the nearest line within `threshold`, null when none (first wins ties). */
function nearest(value: number, lines: readonly number[], threshold: number): number | null {
  let best: number | null = null
  for (const line of lines) {
    const d = line - value
    if (Math.abs(d) <= threshold && (best === null || Math.abs(d) < Math.abs(best))) best = d
  }
  return best
}

/** The smaller of two optional deltas (`a` wins ties). */
function smaller(a: number | null, b: number | null): number | null {
  if (a === null) return b
  if (b === null) return a
  return Math.abs(b) < Math.abs(a) ? b : a
}

/**
 * Snaps the moving edges of `rect` to the edges of `targets` (the other
 * visible widgets: aligned with them or touching them, no gap) and of
 * `displays` (their work areas), within `threshold` DIP.
 *
 * - 'move': the size is kept; on each axis the edge closest to a line wins.
 * - a resize handle: only the edges it names move, and never below `minSize`
 *   (a snap that would shrink the rect below it is skipped).
 *
 * A threshold of 0 or less disables snapping. The result is rounded.
 */
export function snapRect(
  rect: Rect,
  mode: 'move' | ResizeHandle,
  targets: readonly Rect[],
  displays: readonly Rect[],
  threshold = SNAP_THRESHOLD,
  minSize: Size = { width: 0, height: 0 }
): Rect {
  let { x, y, width, height } = rect
  if (threshold > 0) {
    const xs: number[] = []
    const ys: number[] = []
    for (const r of [...targets, ...displays]) {
      xs.push(r.x, r.x + r.width)
      ys.push(r.y, r.y + r.height)
    }
    if (mode === 'move') {
      x += smaller(nearest(x, xs, threshold), nearest(x + width, xs, threshold)) ?? 0
      y += smaller(nearest(y, ys, threshold), nearest(y + height, ys, threshold)) ?? 0
    } else {
      if (mode.includes('e')) {
        const d = nearest(x + width, xs, threshold)
        if (d !== null && width + d >= minSize.width) width += d
      } else if (mode.includes('w')) {
        const d = nearest(x, xs, threshold)
        if (d !== null && width - d >= minSize.width) {
          x += d
          width -= d
        }
      }
      if (mode.includes('s')) {
        const d = nearest(y + height, ys, threshold)
        if (d !== null && height + d >= minSize.height) height += d
      } else if (mode.includes('n')) {
        const d = nearest(y, ys, threshold)
        if (d !== null && height - d >= minSize.height) {
          y += d
          height -= d
        }
      }
    }
  }
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height)
  }
}
