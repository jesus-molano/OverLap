/**
 * When an overlay window takes the mouse (no Electron). Main decides it from its own panel
 * rects and the cursor: the renderer only says when a drag is running (the drag lease), so a
 * missed pointer event, a panel that moved under a still cursor or a hung renderer can never
 * leave a whole display swallowing the game's clicks.
 *
 * - 'ignore': click-through, no mouse hook (always outside edit mode).
 * - 'forward': click-through, but Electron forwards mouse moves so the panels can draw hover
 *   hints (installs a low-level mouse hook in this process; edit mode only).
 * - 'capture': the window takes the mouse (edit mode, over an unlocked panel or while dragging).
 */
import type { Point, Rect } from '@shared/types'

export type MouseMode = 'ignore' | 'forward' | 'capture'

/** A hosted panel as main hit-tests it: effective screen-DIP rect (fitted height included). */
export interface HitPanel {
  rect: Rect
  locked: boolean
}

export interface MouseInputs {
  editing: boolean
  /** Ready, not loading, not crashed, responsive, visible, not suspended. */
  healthy: boolean
  /** The window's current document holds a valid drag lease. */
  dragging: boolean
  /** The mode applied now (hysteresis while captured). */
  current: MouseMode
  cursor: Point
  /** This window's hosted panels, topmost first (reverse WIDGET_IDS). */
  panels: readonly HitPanel[]
}

/** Main reads the cursor this often while editing. */
export const MOUSE_POLL_MS = 33
/** A captured window keeps the mouse this close outside its panel (no toggling on the edge). */
export const CAPTURE_MARGIN_DIP = 4
/** Forward mode only feeds hover visuals; main's poll decides capture either way. */
export const FORWARD_IN_EDIT = true

/** The topmost panel containing `p` grown by `margin` on every side; null when none. */
export function panelAt(p: Point, panels: readonly HitPanel[], margin: number): HitPanel | null {
  for (const panel of panels) {
    const r = panel.rect
    if (
      p.x >= r.x - margin &&
      p.x < r.x + r.width + margin &&
      p.y >= r.y - margin &&
      p.y < r.y + r.height + margin
    ) {
      return panel
    }
  }
  return null
}

export function mouseMode(i: MouseInputs): MouseMode {
  if (!i.editing || !i.healthy) return 'ignore'
  if (i.dragging) return 'capture'
  const margin = i.current === 'capture' ? CAPTURE_MARGIN_DIP : 0
  const panel = panelAt(i.cursor, i.panels, margin)
  return panel !== null && !panel.locked ? 'capture' : 'forward'
}

/** The `setIgnoreMouseEvents` arguments of a mode. */
export function ignoreArgs(
  mode: MouseMode,
  forwardInEdit: boolean = FORWARD_IN_EDIT
): [boolean] | [boolean, { forward: true }] {
  switch (mode) {
    case 'ignore':
      return [true]
    case 'forward':
      return forwardInEdit ? [true, { forward: true }] : [true]
    case 'capture':
      return [false]
  }
}
