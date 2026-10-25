/**
 * Geometry of one panel of an overlay window: the rect it draws and its inline style. Rects are
 * window-local CSS px (= DIP: zoom is pinned to 1), integers. Pure.
 */
import { fitHeight, type Anchor } from '@shared/panelGeometry'
import type { Rect } from '@shared/types'
import { contentHeightPx } from '../view/contentSize'
import type { InlineStyle } from '../view/styles'

/** Larger content heights are a bug of the widget, never a real panel (main rejects them too). */
export const MAX_CONTENT_HEIGHT = 10_000

export interface SlotRectInput {
  /** The drag rect, else the rect awaiting main's acknowledgement, else the layout rect. */
  base: Rect
  /** Height follows the content (auto-height model, option on). */
  autoHeight: boolean
  /** Which edge stays put when the fitted height changes. */
  anchor: Anchor
  /** Content height the panel applies now (heightGate); null before the first report. */
  fitted: number | null
  /** The display's work area, window-local: auto height never grows past it. */
  workArea: Rect
  minHeight: number
}

/**
 * What a panel draws: `base`, with the fitted height for an auto-height panel (the anchored
 * edge, x and width stay; clamped to the work area on the growing side and to the minimum).
 * Returns `base` itself when nothing changes.
 */
export function slotRect(i: SlotRectInput): Rect {
  if (!i.autoHeight || i.fitted === null) return i.base
  return fitHeight(i.base, i.fitted, i.anchor, i.workArea, i.minHeight) ?? i.base
}

function validDpr(dpr: number): number {
  return Number.isFinite(dpr) && dpr > 0 ? dpr : 1
}

/** CSS length without float noise (3.2, not 3.2000000000000006). */
function px(v: number): string {
  return `${Math.round(v * 10_000) / 10_000}px`
}

/**
 * Inline style of a panel: absolutely positioned at `r`, with both edges of each axis on device
 * pixels, so its content starts on a pixel boundary at any scale factor (crisp text and lines
 * at 125 % and 150 %).
 */
export function slotStyle(r: Rect, dpr: number): InlineStyle {
  const d = validDpr(dpr)
  const left = Math.round(r.x * d)
  const top = Math.round(r.y * d)
  const right = Math.round((r.x + r.width) * d)
  const bottom = Math.round((r.y + r.height) * d)
  return {
    left: px(left / d),
    top: px(top / d),
    width: px((right - left) / d),
    height: px((bottom - top) / d)
  }
}

/**
 * A content height reported by a widget, in whole px (rounded up, float noise ignored); null for
 * no usable height (not finite, not positive, or absurdly large).
 */
export function sanitizeContentHeight(heightPx: number): number | null {
  const h = contentHeightPx(heightPx)
  return h === null || h > MAX_CONTENT_HEIGHT ? null : h
}
