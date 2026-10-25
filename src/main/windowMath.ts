/**
 * Pure window rules for main (no Electron): fitting auto-height widgets to
 * their content, the edit-mode mouse wheel and when a widget window is shown.
 * Rects are integer DIP screen coordinates, like everywhere in main.
 */
import { clamp } from '@shared/num'
import {
  WIDGET_SCALE_MAX,
  WIDGET_SCALE_MIN,
  WIDGET_SCALE_STEP,
  clampRectToDisplay,
  pickDisplay,
  rectsEqual
} from '@shared/settings'
import type { EditDragMessage, EditScaleMessage } from '@shared/ipc'
import type { Rect, Size, WidgetSettings } from '@shared/types'

/** A smaller content height is applied only once it stayed smaller this long. */
export const SHRINK_DELAY_MS = 1_500
/** Fitted and wheel-resized bounds are saved this long after the last change. */
export const COMMIT_DELAY_MS = 1_000
/** One wheel notch on a free widget resizes it by this factor (or its inverse). */
export const RESIZE_FACTOR = 1.05
/** Anything taller is a renderer bug, not a layout. */
const MAX_CONTENT_HEIGHT = 10_000

export type Anchor = WidgetSettings['anchor']

/** A display as `screen.getAllDisplays()` describes it. */
export interface DisplayAreas {
  bounds: Rect
  workArea: Rect
}

/**
 * Validates an untrusted `ContentSizeMessage`: a finite, positive height up to
 * 10 000 DIP, rounded and raised to `minHeight`. Null when invalid.
 */
export function parseContentHeight(raw: unknown, minHeight: number): number | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { height } = raw as Record<string, unknown>
  if (typeof height !== 'number' || !Number.isFinite(height)) return null
  if (height <= 0 || height > MAX_CONTENT_HEIGHT) return null
  return Math.max(minHeight, Math.round(height))
}

const DRAG_PHASES: readonly unknown[] = [
  'start',
  'move',
  'end'
] satisfies EditDragMessage['phase'][]
const DRAG_MODES: readonly unknown[] = [
  'move',
  'n',
  's',
  'e',
  'w',
  'ne',
  'nw',
  'se',
  'sw'
] satisfies EditDragMessage['mode'][]

/** Validates an untrusted `EditDragMessage` (main reads the cursor: dx/dy are not used). */
export function isEditDragMessage(raw: unknown): raw is EditDragMessage {
  if (typeof raw !== 'object' || raw === null) return false
  const { phase, mode } = raw as Record<string, unknown>
  return DRAG_PHASES.includes(phase) && DRAG_MODES.includes(mode)
}

/** Validates an untrusted `EditScaleMessage`: one notch up or down. */
export function isEditScaleMessage(raw: unknown): raw is EditScaleMessage {
  if (typeof raw !== 'object' || raw === null) return false
  const { step } = raw as Record<string, unknown>
  return step === 1 || step === -1
}

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

/** Work area of the display a rect belongs to (see `pickDisplay`). */
export function workAreaFor(rect: Rect, displays: readonly DisplayAreas[]): Rect | undefined {
  const picked = pickDisplay(
    rect,
    displays.map((d) => d.bounds)
  )
  return displays.find((d) => d.bounds === picked)?.workArea
}

/** Edges a dragged widget snaps to: every display's bounds and its work area (without the taskbar). */
export function snapAreas(displays: readonly DisplayAreas[]): Rect[] {
  const out: Rect[] = []
  for (const d of displays) {
    for (const r of [d.bounds, d.workArea]) {
      if (!out.some((o) => rectsEqual(o, r))) out.push({ ...r })
    }
  }
  return out
}

export interface WindowShownInput {
  /** Enabled by the user (settings / tray checkbox). */
  userVisible: boolean
  /** A "Mostrar en" / "Ocultar en boxes" rule hides it right now. */
  autoHidden: boolean
  editing: boolean
}

/**
 * Whether a widget window is on screen. A rule-hidden widget is not painted at
 * all, except in edit mode, where it previews so it can still be placed.
 */
export function windowShown(s: WindowShownInput): boolean {
  return s.userVisible && (s.editing || !s.autoHidden)
}
