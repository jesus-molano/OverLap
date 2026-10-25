/**
 * Pure panel geometry shared by main and the overlay renderer: fitting auto-height widgets to
 * their content, the edit-mode mouse wheel and whether a widget is drawn. Rects are integer
 * DIP: screen coordinates in main, window-local CSS px (DIP at zoom 1) in the renderer.
 */
import { clamp } from './num'
import {
  WIDGET_SCALE_MAX,
  WIDGET_SCALE_MIN,
  WIDGET_SCALE_STEP,
  clampRectToDisplay
} from './settings'
import type { Rect, Size, WidgetSettings } from './types'

/** A smaller content height is applied only once it stayed smaller this long. */
export const SHRINK_DELAY_MS = 1_500
/** One wheel notch on a free widget resizes it by this factor (or its inverse). */
const RESIZE_FACTOR = 1.05

export type Anchor = WidgetSettings['anchor']

/**
 * Bounds for a content height: as tall as `desired`, but never past the work
 * area on the growing side and never below `minHeight`. The anchored edge
 * stays put ('top' keeps y, 'bottom' keeps the bottom edge); x and width never
 * change. Null when the height would change by less than 1 DIP.
 */
export function fitHeight(
  bounds: Rect,
  desired: number,
  anchor: Anchor,
  workArea: Rect,
  minHeight: number
): Rect | null {
  const bottom = bounds.y + bounds.height
  const available = anchor === 'top' ? workArea.y + workArea.height - bounds.y : bottom - workArea.y
  const height = Math.max(minHeight, Math.min(Math.round(desired), Math.floor(available)))
  if (Math.abs(height - bounds.height) < 1) return null
  return {
    x: bounds.x,
    y: anchor === 'top' ? bounds.y : bottom - height,
    width: bounds.width,
    height
  }
}

/**
 * Next content scale (%) for one wheel notch on an auto-height widget: the
 * next multiple of the scale step in that direction (103 -> 105 or 100),
 * within the scale range.
 */
export function stepScale(scale: number, step: 1 | -1): number {
  const s = WIDGET_SCALE_STEP
  const base = Number.isFinite(scale) ? scale : 100
  const next = step > 0 ? Math.floor(base / s) * s + s : Math.ceil(base / s) * s - s
  return clamp(next, WIDGET_SCALE_MIN, WIDGET_SCALE_MAX)
}

/**
 * One wheel notch on a free widget: resized by RESIZE_FACTOR around its
 * centre, keeping the aspect ratio. It stops at the first limit either side
 * reaches (`minSize`, the display size), then the whole rect is moved inside
 * the display. A notch up and one down give back the same rect: the odd pixel
 * of a change always goes to the left / top edge.
 */
export function scaleAroundCentre(bounds: Rect, step: 1 | -1, minSize: Size, display: Rect): Rect {
  let f = step > 0 ? RESIZE_FACTOR : 1 / RESIZE_FACTOR
  f = Math.max(f, minSize.width / bounds.width, minSize.height / bounds.height)
  f = Math.min(f, display.width / bounds.width, display.height / bounds.height)
  const width = Math.round(bounds.width * f)
  const height = Math.round(bounds.height * f)
  const rect = {
    x: bounds.x - halfUp(width - bounds.width),
    y: bounds.y - halfUp(height - bounds.height),
    width,
    height
  }
  return clampRectToDisplay(rect, display)
}

/** Half of an integer change, the odd unit included (7 -> 4, -7 -> -4). */
function halfUp(n: number): number {
  return Math.sign(n) * Math.ceil(Math.abs(n) / 2)
}

export interface WidgetShownInput {
  /** Enabled by the user (settings / tray checkbox). */
  userVisible: boolean
  /** A "Mostrar en" / "Ocultar en boxes" rule hides it right now. */
  autoHidden: boolean
  editing: boolean
}

/**
 * Whether a widget is drawn. A rule-hidden widget is not painted at all, except
 * in edit mode, where it previews so it can still be placed.
 */
export function widgetShown(s: WidgetShownInput): boolean {
  return s.userVisible && (s.editing || !s.autoHidden)
}
