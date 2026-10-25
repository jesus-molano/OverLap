/**
 * Pure geometry of the edit-mode drags of an overlay window. Rects and points are window-local
 * CSS px (= DIP at zoom 1), the coordinates of `OverlayLayout`; the display rect need not start
 * at 0,0.
 */
import { clamp } from '@shared/num'
import { applyDrag, clampRectToDisplay } from '@shared/settings'
import { SNAP_THRESHOLD, snapRect } from '@shared/snap'
import type { Point, Rect, ResizeHandle, Size } from '@shared/types'

/** What a drag does: move the panel, or resize it by one edge or corner. */
export type DragMode = 'move' | ResizeHandle

const ALL_HANDLES: readonly ResizeHandle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
const SIDE_HANDLES: readonly ResizeHandle[] = ['e', 'w']

/** Resize handles a panel offers: only the sides when its height follows the content. */
export function handlesFor(autoHeight: boolean): readonly ResizeHandle[] {
  return autoHeight ? SIDE_HANDLES : ALL_HANDLES
}

/** Whether a drag may start in `mode`: auto height owns the height (no top or bottom edge). */
export function canStart(mode: DragMode, autoHeight: boolean): boolean {
  return mode === 'move' || !autoHeight || !(mode.includes('n') || mode.includes('s'))
}

/** Everything a drag reads besides the pointer, captured once when it starts. */
export interface DragContext {
  /** The widget's minimum size. */
  readonly minSize: Size
  /** The display the window covers (`OverlayDisplay.bounds`): the panel stays inside it. */
  readonly display: Rect
  /** Its work area (`OverlayDisplay.workArea`): edges snap to it as well. */
  readonly workArea: Rect
  /** The other shown panels of this window: edges snap to them. */
  readonly targets: readonly Rect[]
}

/**
 * The panel `dx`,`dy` px of pointer travel after a drag started at `start`: `applyDrag`, then
 * edge snapping to the other panels and to the display and work-area edges (unless `noSnap`),
 * then kept inside the display. A move keeps the size; a resize moves only the edges its handle
 * names and never goes below the minimum size.
 */
export function dragRect(
  start: Rect,
  mode: DragMode,
  dx: number,
  dy: number,
  ctx: DragContext,
  noSnap: boolean
): Rect {
  let r = applyDrag(start, mode, dx, dy, ctx.minSize)
  if (!noSnap) {
    r = snapRect(r, mode, ctx.targets, [ctx.display, ctx.workArea], SNAP_THRESHOLD, ctx.minSize)
  }
  return mode === 'move'
    ? clampRectToDisplay(r, ctx.display)
    : confineResize(r, mode, ctx.display, ctx.minSize)
}

/**
 * A resized rect kept inside `area`: each edge the handle moves stops at the area's edge, the
 * other edges stay where they are, and the minimum size wins over the area.
 */
export function confineResize(rect: Rect, mode: ResizeHandle, area: Rect, minSize: Size): Rect {
  let left = rect.x
  let top = rect.y
  let right = rect.x + rect.width
  let bottom = rect.y + rect.height
  if (mode.includes('w')) left = Math.min(Math.max(left, Math.ceil(area.x)), right - minSize.width)
  if (mode.includes('e')) {
    right = Math.max(Math.min(right, Math.floor(area.x + area.width)), left + minSize.width)
  }
  if (mode.includes('n')) top = Math.min(Math.max(top, Math.ceil(area.y)), bottom - minSize.height)
  if (mode.includes('s')) {
    bottom = Math.max(Math.min(bottom, Math.floor(area.y + area.height)), top + minSize.height)
  }
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/** The pointer is off the display: releasing a move there drops the widget on another one. */
export function isOutside(x: number, y: number, display: Rect): boolean {
  return (
    x < display.x ||
    y < display.y ||
    x >= display.x + display.width ||
    y >= display.y + display.height
  )
}

/** Where the pointer grabbed the panel, from its top-left corner, within its size. */
export function grabOffset(p0: Point, start: Rect): Point {
  return {
    x: clamp(Math.round(p0.x - start.x), 0, start.width),
    y: clamp(Math.round(p0.y - start.y), 0, start.height)
  }
}
