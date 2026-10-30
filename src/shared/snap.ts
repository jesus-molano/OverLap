/**
 * Edge snapping while moving or resizing a widget in edit mode. Pure: the
 * overlay window applies it to the rect from `applyDrag` (unless Alt or Shift
 * is held; renderer overlay/dragMath.ts), against the other panels of its
 * display and that display's bounds and work area. Rects are DIP in any one
 * coordinate space (the overlay uses window-local CSS px, = DIP at zoom 1).
 */
import type { Rect, ResizeHandle, Size } from './types'

/** Distance (DIP) within which an edge jumps to a line. */
export const SNAP_THRESHOLD = 8

/** A snap: how far the edge moves, and the line it lands on (drawn as a guide, R38). */
interface Hit {
  readonly d: number
  readonly line: number
}

/** The nearest line to `value` within `threshold`, null when none (first wins ties). */
function nearest(value: number, lines: readonly number[], threshold: number): Hit | null {
  let best: Hit | null = null
  for (const line of lines) {
    const d = line - value
    if (Math.abs(d) <= threshold && (best === null || Math.abs(d) < Math.abs(best.d))) {
      best = { d, line }
    }
  }
  return best
}

/** The nearer of the hits (the first wins ties). */
function nearer(...hits: (Hit | null)[]): Hit | null {
  let best: Hit | null = null
  for (const h of hits)
    if (h !== null && (best === null || Math.abs(h.d) < Math.abs(best.d))) best = h
  return best
}

/**
 * The lines a rect snapped to (R38: edit mode draws them while you drag): vertical ones at these
 * x, horizontal ones at these y, in the rects' coordinates.
 */
export interface SnapGuides {
  readonly xs: readonly number[]
  readonly ys: readonly number[]
}

export interface SnapResult {
  readonly rect: Rect
  readonly guides: SnapGuides
}

/** Centre lines a moved rect's centre snaps to (the display's middle, R38). */
export interface SnapCentres {
  readonly xs: readonly number[]
  readonly ys: readonly number[]
}

export const NO_GUIDES: SnapGuides = Object.freeze({ xs: Object.freeze([]), ys: Object.freeze([]) })

/** The middle of each rect, as centre lines (snapRectGuided). */
export function centresOf(rects: readonly Rect[]): SnapCentres {
  return {
    xs: rects.map((r) => r.x + r.width / 2),
    ys: rects.map((r) => r.y + r.height / 2)
  }
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
  return snapRectGuided(rect, mode, targets, displays, threshold, minSize).rect
}

/**
 * snapRect, plus the lines it snapped to (`guides`, drawn while you drag) and, for a move, the
 * rect's centre snapping to `centres` too (the display's middle: centred on screen, R38).
 */
export function snapRectGuided(
  rect: Rect,
  mode: 'move' | ResizeHandle,
  targets: readonly Rect[],
  displays: readonly Rect[],
  threshold = SNAP_THRESHOLD,
  minSize: Size = { width: 0, height: 0 },
  centres: SnapCentres = { xs: [], ys: [] }
): SnapResult {
  let { x, y, width, height } = rect
  const gx: number[] = []
  const gy: number[] = []
  if (threshold > 0) {
    const xs: number[] = []
    const ys: number[] = []
    for (const r of [...targets, ...displays]) {
      xs.push(r.x, r.x + r.width)
      ys.push(r.y, r.y + r.height)
    }
    if (mode === 'move') {
      const hx = nearer(
        nearest(x, xs, threshold),
        nearest(x + width, xs, threshold),
        nearest(x + width / 2, centres.xs, threshold)
      )
      const hy = nearer(
        nearest(y, ys, threshold),
        nearest(y + height, ys, threshold),
        nearest(y + height / 2, centres.ys, threshold)
      )
      if (hx !== null) {
        x += hx.d
        gx.push(hx.line)
      }
      if (hy !== null) {
        y += hy.d
        gy.push(hy.line)
      }
    } else {
      if (mode.includes('e')) {
        const h = nearest(x + width, xs, threshold)
        if (h !== null && width + h.d >= minSize.width) {
          width += h.d
          gx.push(h.line)
        }
      } else if (mode.includes('w')) {
        const h = nearest(x, xs, threshold)
        if (h !== null && width - h.d >= minSize.width) {
          x += h.d
          width -= h.d
          gx.push(h.line)
        }
      }
      if (mode.includes('s')) {
        const h = nearest(y + height, ys, threshold)
        if (h !== null && height + h.d >= minSize.height) {
          height += h.d
          gy.push(h.line)
        }
      } else if (mode.includes('n')) {
        const h = nearest(y, ys, threshold)
        if (h !== null && height - h.d >= minSize.height) {
          y += h.d
          height -= h.d
          gy.push(h.line)
        }
      }
    }
  }
  return {
    rect: {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height)
    },
    guides: gx.length === 0 && gy.length === 0 ? NO_GUIDES : { xs: gx, ys: gy }
  }
}
