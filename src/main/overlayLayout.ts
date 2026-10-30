/**
 * Pure placement rules of the overlay windows (no Electron): which display each widget belongs
 * to, which window hosts it, where that window goes, and the conversions between screen DIP
 * (settings, main, Electron) and the window-local CSS px the renderer works in (zoom is pinned
 * to 1, so both are DIP; only the origin differs).
 */
import type { OverlayDisplay, OverlayLayout, OverlayPanel } from '@shared/ipc'
import { fitHeight, type Anchor } from '@shared/panelGeometry'
import { clampRectToDisplay, pickDisplay, rectsEqual, restoreBounds } from '@shared/settings'
import type { Point, Rect, Size } from '@shared/types'
import { PAINT_ORDER, type WidgetId } from '@shared/widgets'

/** A display as main uses it (the fields of Electron's `Display` that matter here). */
export interface DisplayInfo {
  id: number
  bounds: Rect
  workArea: Rect
  scaleFactor: number
}

/**
 * 1-based number of every display: the primary one is 1, the others follow left to right,
 * then top to bottom. Window titles and the layout use it.
 */
export function displayNumbers(
  displays: readonly DisplayInfo[],
  primaryId: number
): Map<number, number> {
  const others = displays
    .filter((d) => d.id !== primaryId)
    .sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y)
  const out = new Map<number, number>()
  let n = 1
  if (displays.some((d) => d.id === primaryId)) out.set(primaryId, n++)
  for (const d of others) out.set(d.id, n++)
  return out
}

/** Same displays (id, bounds, work area and scale factor), in any order. */
export function sameDisplays(a: readonly DisplayInfo[], b: readonly DisplayInfo[]): boolean {
  if (a.length !== b.length) return false
  return a.every((d) => {
    const o = b.find((x) => x.id === d.id)
    return o !== undefined && sameDisplay(d, o)
  })
}

/** Same geometry and scale factor (the id is not compared). */
export function sameGeometry(a: DisplayInfo, b: DisplayInfo): boolean {
  return rectsEqual(a.bounds, b.bounds) && a.scaleFactor === b.scaleFactor
}

function sameDisplay(a: DisplayInfo, b: DisplayInfo): boolean {
  return a.id === b.id && sameGeometry(a, b) && rectsEqual(a.workArea, b.workArea)
}

/**
 * The display a widget belongs to: the one containing its centre, else the one `pickDisplay`
 * chooses (most overlap, then nearest). Undefined only without displays.
 */
export function owningDisplay(
  rect: Rect,
  displays: readonly DisplayInfo[]
): DisplayInfo | undefined {
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  const containing = displays.find((d) => containsPoint(d.bounds, cx, cy))
  if (containing) return containing
  const picked = pickDisplay(
    rect,
    displays.map((d) => d.bounds)
  )
  return displays.find((d) => d.bounds === picked)
}

/** The display containing `p`, else the nearest one (like `screen.getDisplayNearestPoint`). */
export function displayAtPoint(
  p: Point,
  displays: readonly DisplayInfo[]
): DisplayInfo | undefined {
  return owningDisplay({ x: p.x, y: p.y, width: 0, height: 0 }, displays)
}

function containsPoint(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height
}

/**
 * Where a widget is drawn: its saved bounds when they are still visible on some display
 * (clamped into it), else its default bounds in the primary work area. Never saved: a widget
 * whose monitor is gone keeps its saved place and returns there with the monitor.
 */
export function placeWidget(
  saved: Rect,
  def: Rect,
  displays: readonly DisplayInfo[],
  primary: DisplayInfo
): Rect {
  return restoreBounds(
    saved,
    def,
    displays.map((d) => d.bounds),
    primary.workArea
  )
}

/** The rect an overlay window covers on `display` (the only place that decides it). */
export function hostWindowBounds(display: DisplayInfo): Rect {
  return { ...display.bounds }
}

/**
 * The hosted widgets of every display that hosts at least one, PAINT_ORDER (later ones on top,
 * so main hit-tests them in reverse). A widget belongs to the display of its rect (see
 * `owningDisplay`).
 */
export function partition(
  rects: ReadonlyMap<WidgetId, Rect>,
  enabled: (id: WidgetId) => boolean,
  displays: readonly DisplayInfo[]
): Map<number, WidgetId[]> {
  const out = new Map<number, WidgetId[]>()
  for (const id of PAINT_ORDER) {
    const rect = rects.get(id)
    if (!rect || !enabled(id)) continue
    const display = owningDisplay(rect, displays)
    if (!display) continue
    const list = out.get(display.id)
    if (list) list.push(id)
    else out.set(display.id, [id])
  }
  return out
}

/** An existing overlay window: its key and the display it covers now (null: none). */
export interface WindowSlot {
  key: number
  displayId: number | null
}

export interface WindowPlan {
  /** Window key -> display id it covers from now on (kept and reused windows). */
  assign: Map<number, number>
  /** Display ids that need a new window. */
  create: number[]
  /** Window keys no display needs any more. */
  destroy: number[]
}

/**
 * Keeps the windows whose display is still needed, reuses the others for the remaining
 * displays (display ids can change after a resume or a replug: a window is not reloaded for
 * that), creates what is still missing and destroys the leftovers.
 */
export function reconcileWindows(
  windows: readonly WindowSlot[],
  needed: readonly number[]
): WindowPlan {
  const want = new Set(needed)
  const taken = new Set<number>()
  const assign = new Map<number, number>()
  const free: number[] = []
  for (const w of windows) {
    if (w.displayId !== null && want.has(w.displayId) && !taken.has(w.displayId)) {
      assign.set(w.key, w.displayId)
      taken.add(w.displayId)
    } else {
      free.push(w.key)
    }
  }
  const create: number[] = []
  for (const id of needed) {
    if (taken.has(id)) continue
    taken.add(id)
    const key = free.shift()
    if (key === undefined) create.push(id)
    else assign.set(key, id)
  }
  return { assign, create, destroy: free }
}

export function toLocal(rect: Rect, origin: Point): Rect {
  return { x: rect.x - origin.x, y: rect.y - origin.y, width: rect.width, height: rect.height }
}

export function toScreen(rect: Rect, origin: Point): Rect {
  return { x: rect.x + origin.x, y: rect.y + origin.y, width: rect.width, height: rect.height }
}

/** Top-left of the window covering `display`, the origin of its window-local coordinates. */
export function windowOrigin(display: DisplayInfo): Point {
  const b = hostWindowBounds(display)
  return { x: b.x, y: b.y }
}

export interface LayoutInput {
  display: DisplayInfo
  /** 1-based display number (see `displayNumbers`). */
  index: number
  /** Hosted widgets, PAINT_ORDER. */
  widgets: readonly WidgetId[]
  /** Effective rects, screen DIP. */
  rects: ReadonlyMap<WidgetId, Rect>
  placements: ReadonlyMap<WidgetId, number>
  /** Hosted widgets the user disabled (edit mode draws them as ghosts); none when absent. */
  ghosts?: ReadonlySet<WidgetId>
  /** Edit mode: the widget the arrows apply to (OverlayPanel.touched). */
  touched?: WidgetId | null
  session: number
  ackSeq: number
  revision: number
}

/** What one overlay window hosts, in its own coordinates. */
export function buildLayout(i: LayoutInput): OverlayLayout {
  const origin = windowOrigin(i.display)
  const display: OverlayDisplay = {
    id: i.display.id,
    index: i.index,
    bounds: toLocal(i.display.bounds, origin),
    workArea: toLocal(i.display.workArea, origin),
    scaleFactor: i.display.scaleFactor
  }
  const panels: OverlayPanel[] = []
  for (const widget of i.widgets) {
    const rect = i.rects.get(widget)
    if (!rect) continue
    const panel: OverlayPanel = {
      widget,
      rect: toLocal(rect, origin),
      placement: i.placements.get(widget) ?? 0
    }
    if (i.ghosts?.has(widget) === true) panel.ghost = true
    if (i.touched === widget) panel.touched = true
    panels.push(panel)
  }
  return { revision: i.revision, session: i.session, ackSeq: i.ackSeq, display, panels }
}

/**
 * An edit chip a window reported (relative to its panel's top-left) on screen: clipped to the
 * panel's screen rect `panel`, as the panel clips it on screen. Null when nothing is left.
 */
export function chipOnScreen(panel: Rect, chip: Rect): Rect | null {
  const x0 = Math.max(panel.x, panel.x + chip.x)
  const y0 = Math.max(panel.y, panel.y + chip.y)
  const x1 = Math.min(panel.x + panel.width, panel.x + chip.x + chip.width)
  const y1 = Math.min(panel.y + panel.height, panel.y + chip.y + chip.height)
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null
}

/** Same layout content: everything but `revision`. */
export function sameLayoutContent(a: OverlayLayout, b: OverlayLayout): boolean {
  if (a.session !== b.session || a.ackSeq !== b.ackSeq) return false
  const da = a.display
  const db = b.display
  if (
    da.id !== db.id ||
    da.index !== db.index ||
    da.scaleFactor !== db.scaleFactor ||
    !rectsEqual(da.bounds, db.bounds) ||
    !rectsEqual(da.workArea, db.workArea)
  ) {
    return false
  }
  if (a.panels.length !== b.panels.length) return false
  return a.panels.every((p, n) => {
    const q = b.panels[n]
    return (
      q !== undefined &&
      p.widget === q.widget &&
      p.placement === q.placement &&
      p.ghost === q.ghost &&
      p.touched === q.touched &&
      rectsEqual(p.rect, q.rect)
    )
  })
}

/**
 * A rect a window committed (window-local) as main keeps it: screen DIP, rounded, at least
 * `minSize`, moved and shrunk into the window's display. Null when it is not finite.
 */
export function acceptRect(
  local: Rect,
  origin: Point,
  display: DisplayInfo,
  minSize: Size
): Rect | null {
  const r = toScreen(local, origin)
  if (![r.x, r.y, r.width, r.height].every(Number.isFinite)) return null
  const rect = {
    x: Math.round(r.x),
    y: Math.round(r.y),
    width: Math.max(minSize.width, Math.round(r.width)),
    height: Math.max(minSize.height, Math.round(r.height))
  }
  return clampRectToDisplay(rect, display.bounds)
}

/**
 * A widget dropped on another display: `size` (at least `minSize`) with its top-left `grab`
 * DIP up and left of the cursor, moved and shrunk into `target`.
 */
export function dropRect(
  cursor: Point,
  grab: Point,
  size: Size,
  minSize: Size,
  target: DisplayInfo
): Rect {
  const rect = {
    x: Math.round(cursor.x - grab.x),
    y: Math.round(cursor.y - grab.y),
    width: Math.max(minSize.width, Math.round(size.width)),
    height: Math.max(minSize.height, Math.round(size.height))
  }
  return clampRectToDisplay(rect, target.bounds)
}

/**
 * The rect of an auto-height widget fitted to `height` (see `fitHeight`: never past the work
 * area on its growing side, never below `minHeight`, the anchored edge kept).
 */
export function applyFit(
  rect: Rect,
  height: number,
  anchor: Anchor,
  workArea: Rect,
  minHeight: number
): Rect {
  return fitHeight(rect, height, anchor, workArea, minHeight) ?? rect
}

/**
 * What a fit saves: only the height, applied to the saved bounds (a bottom anchor keeps the
 * saved bottom edge), so a widget shown away from its saved place keeps that place.
 */
export function fittedBounds(saved: Rect, height: number, anchor: Anchor): Rect {
  const y = anchor === 'bottom' ? saved.y + saved.height - height : saved.y
  return { x: saved.x, y, width: saved.width, height }
}

export function anyShown(
  widgets: readonly WidgetId[],
  isShown: (id: WidgetId) => boolean
): boolean {
  return widgets.some(isShown)
}

/** Any edge of `got` is more than 1 DIP away from `want`. */
export function boundsDrift(got: Rect, want: Rect): boolean {
  return (
    Math.abs(got.x - want.x) > 1 ||
    Math.abs(got.y - want.y) > 1 ||
    Math.abs(got.x + got.width - (want.x + want.width)) > 1 ||
    Math.abs(got.y + got.height - (want.y + want.height)) > 1
  )
}
