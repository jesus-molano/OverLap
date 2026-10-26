/**
 * When an overlay window takes the mouse (no Electron). Main decides it from its own panel
 * rects and the cursor: the renderer only says when a drag is running (the drag lease), so a
 * missed pointer event, a panel that moved under a still cursor or a hung renderer can never
 * leave a whole display swallowing the game's clicks.
 *
 * - 'ignore': click-through, no mouse hook (always outside edit mode).
 * - 'forward': click-through, but Electron forwards mouse moves so the panels can draw hover
 *   hints (installs a low-level mouse hook in this process; edit mode only).
 * - 'capture': the window takes the mouse (edit mode, over an unlocked panel, over the edit chip
 *   of any panel, or while dragging).
 *
 * The edit chips are the one thing the renderer reports (where its chips are, IPC.editChips):
 * main clips each to its own panel rect, so a stale report can only ever take the mouse inside
 * a panel, in edit mode. The renderer draws every chip above every panel, so each one takes the
 * mouse even where a panel painted later (the radar) covers its own.
 */
import type { Point, Rect } from '@shared/types'

export type MouseMode = 'ignore' | 'forward' | 'capture'

/** A hosted panel as main hit-tests it: effective screen-DIP rect (fitted height included). */
export interface HitPanel {
  rect: Rect
  /** Cannot be dragged: the mouse goes to the game over it, but over its chip. */
  locked: boolean
  /**
   * The ghost of a disabled widget (edit mode): only its chip is there for the mouse; anywhere
   * else the panels below it get it, as if it were not there.
   */
  ghost?: boolean
  /**
   * Its edit chip (name, eye and padlock), screen DIP, inside `rect`: takes the mouse even when
   * the panel is locked, a ghost or under another panel, so its buttons take clicks. Absent or
   * null: none reported.
   */
  chip?: Rect | null
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
  /** This window's hosted panels, topmost first (reverse PAINT_ORDER). */
  panels: readonly HitPanel[]
}

/** Main reads the cursor this often while editing. */
export const MOUSE_POLL_MS = 33
/** A captured window keeps the mouse this close outside its panel (no toggling on the edge). */
export const CAPTURE_MARGIN_DIP = 4
/** Forward mode only feeds hover visuals; main's poll decides capture either way. */
export const FORWARD_IN_EDIT = true

/** `r` grown by `margin` on every side contains `p` (left and top edges included). */
export function rectHas(r: Rect, p: Point, margin: number): boolean {
  return (
    p.x >= r.x - margin &&
    p.x < r.x + r.width + margin &&
    p.y >= r.y - margin &&
    p.y < r.y + r.height + margin
  )
}

/** The topmost panel containing `p` grown by `margin` on every side; null when none. */
export function panelAt(p: Point, panels: readonly HitPanel[], margin: number): HitPanel | null {
  for (const panel of panels) if (rectHas(panel.rect, p, margin)) return panel
  return null
}

/**
 * Any panel's chip under the cursor takes the mouse (the chips are drawn above every panel);
 * elsewhere the topmost panel under it decides: an unlocked one takes the mouse, a locked one
 * gives it to the game, a ghost lets it through to the panels below.
 */
export function mouseMode(i: MouseInputs): MouseMode {
  if (!i.editing || !i.healthy) return 'ignore'
  if (i.dragging) return 'capture'
  const margin = i.current === 'capture' ? CAPTURE_MARGIN_DIP : 0
  for (const panel of i.panels) {
    const chip = panel.chip ?? null
    if (chip !== null && rectHas(chip, i.cursor, margin)) return 'capture'
  }
  for (const panel of i.panels) {
    if (!rectHas(panel.rect, i.cursor, margin)) continue
    if (panel.ghost === true) continue
    return panel.locked ? 'forward' : 'capture'
  }
  return 'forward'
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
