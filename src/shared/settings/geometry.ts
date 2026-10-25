/**
 * Pure window geometry main uses to restore, validate, move and resize widget
 * windows. All rects are in DIP screen coordinates, which can be negative (a
 * display left of or above the primary one).
 */
import type { ResizeHandle } from '../ipc'
import type { Rect, Size } from '../types'

/** Part of a widget that must be on some display for it to count as reachable. */
const MIN_VISIBLE_WIDTH = 48
const MIN_VISIBLE_HEIGHT = 32

export function roundRect(rect: Rect): Rect {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  }
}

export function rectsEqual(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

/** Overlapping width and height of two rects (0 when they do not overlap). */
function overlap(a: Rect, b: Rect): Size {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return { width: Math.max(0, width), height: Math.max(0, height) }
}

/**
 * True when at least min(48, w) x min(32, h) of the rect lies on one display,
 * so the user can still see it and grab it in edit mode.
 */
export function isRectVisible(rect: Rect, displays: readonly Rect[]): boolean {
  const needW = Math.min(MIN_VISIBLE_WIDTH, rect.width)
  const needH = Math.min(MIN_VISIBLE_HEIGHT, rect.height)
  if (needW <= 0 || needH <= 0) return false
  return displays.some((d) => {
    const o = overlap(rect, d)
    return o.width >= needW && o.height >= needH
  })
}

/**
 * Display the rect belongs to: the one it overlaps most, or the closest one
 * (by centre distance) when it overlaps none. Undefined only without displays.
 */
export function pickDisplay(rect: Rect, displays: readonly Rect[]): Rect | undefined {
  let best: Rect | undefined
  let bestArea = 0
  for (const d of displays) {
    const o = overlap(rect, d)
    const area = o.width * o.height
    if (area > bestArea) {
      best = d
      bestArea = area
    }
  }
  if (best) return best

  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  let bestDist = Infinity
  for (const d of displays) {
    const dist = Math.hypot(d.x + d.width / 2 - cx, d.y + d.height / 2 - cy)
    if (dist < bestDist) {
      best = d
      bestDist = dist
    }
  }
  return best
}

/** Shrinks the rect to fit the display if needed and moves it fully inside. */
export function clampRectToDisplay(rect: Rect, display: Rect): Rect {
  const width = Math.min(Math.round(rect.width), Math.floor(display.width))
  const height = Math.min(Math.round(rect.height), Math.floor(display.height))
  const minX = Math.ceil(display.x)
  const minY = Math.ceil(display.y)
  const maxX = Math.floor(display.x + display.width) - width
  const maxY = Math.floor(display.y + display.height) - height
  return {
    x: Math.min(Math.max(Math.round(rect.x), minX), maxX),
    y: Math.min(Math.max(Math.round(rect.y), minY), maxY),
    width,
    height
  }
}

/** Clamps into the display the rect belongs to (see `pickDisplay`). */
export function clampRectToDisplays(rect: Rect, displays: readonly Rect[]): Rect {
  const display = pickDisplay(rect, displays)
  return display ? clampRectToDisplay(rect, display) : roundRect(rect)
}

/**
 * Bounds to open a widget with. Saved bounds win when they are sane and still
 * visible on some display (a monitor may have been unplugged since); they are
 * clamped into their display. Otherwise the default bounds are used as an
 * offset into the primary work area.
 */
export function restoreBounds(
  saved: Rect | undefined,
  def: Rect,
  displays: readonly Rect[],
  primaryWorkArea: Rect
): Rect {
  const screens = displays.length > 0 ? displays : [primaryWorkArea]
  if (saved && isSaneRect(saved)) {
    const rect = roundRect(saved)
    if (rect.width > 0 && rect.height > 0 && isRectVisible(rect, screens)) {
      return clampRectToDisplays(rect, screens)
    }
  }
  return clampRectToDisplay(
    {
      x: primaryWorkArea.x + def.x,
      y: primaryWorkArea.y + def.y,
      width: def.width,
      height: def.height
    },
    primaryWorkArea
  )
}

/**
 * Bounds while the user drags in edit mode: `start` plus the total cursor
 * displacement since the drag started. `move` translates; a handle moves the
 * edges it names, never below `minSize` (the opposite edge stays put).
 */
export function applyDrag(
  start: Rect,
  mode: 'move' | ResizeHandle,
  dx: number,
  dy: number,
  minSize: Size
): Rect {
  if (mode === 'move') {
    return roundRect({ ...start, x: start.x + dx, y: start.y + dy })
  }
  let { x, y, width, height } = start
  const right = start.x + start.width
  const bottom = start.y + start.height
  if (mode.includes('e')) width = Math.max(minSize.width, start.width + dx)
  if (mode.includes('w')) {
    width = Math.max(minSize.width, start.width - dx)
    x = right - width
  }
  if (mode.includes('s')) height = Math.max(minSize.height, start.height + dy)
  if (mode.includes('n')) {
    height = Math.max(minSize.height, start.height - dy)
    y = bottom - height
  }
  return roundRect({ x, y, width, height })
}

function isSaneRect(rect: Rect): boolean {
  return (
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height)
  )
}
