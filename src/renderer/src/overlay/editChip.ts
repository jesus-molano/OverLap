/**
 * The edit chip of a panel (EditFrame's logic, kept out of the SFC so it can be tested): what
 * its eye and padlock send to main, where the chip is relative to its panel (main takes the
 * mouse over it, so its buttons work on locked panels, ghosts and panels painted under another),
 * which hint fits the panel, and which panels clash with the radar, painted above all of them
 * (report B05). Pure.
 */
import type { WidgetToggleMessage } from '@shared/ipc'
import type { Rect } from '@shared/types'
import { TOPMOST_WIDGET, type WidgetId } from '@shared/widgets'
import type { SlotHandle } from './contract'

export type ToggleField = WidgetToggleMessage['field']

/**
 * What a click on the chip's eye (`visible`) or padlock (`locked`) sends: the opposite of what
 * the panel is now (a ghost is shown again). Null outside edit mode or before the first layout.
 */
export function toggleMessage(
  slot: Pick<SlotHandle, 'id' | 'ghost' | 'locked'>,
  field: ToggleField,
  session: number,
  editing: boolean
): WidgetToggleMessage | null {
  if (!editing || !Number.isSafeInteger(session) || session < 1) return null
  const value = field === 'visible' ? slot.ghost.value : !slot.locked.value
  return { session, widget: slot.id, field, value }
}

/** Panel widths (px) from which the hover hint can be the short one, and the long one. */
export const HINT_SHORT_PX = 230
export const HINT_LONG_PX = 330

/** Which hover hint fits a panel `width` px wide: the long one, the short one or the keys. */
export function hintTier(width: number): 'long' | 'short' | 'tiny' {
  if (width >= HINT_LONG_PX) return 'long'
  return width >= HINT_SHORT_PX ? 'short' : 'tiny'
}

/** The fields of a DOMRect read here. */
export interface ClientRect {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

/**
 * `inner` relative to `outer`'s top-left (both client rects, px), grown to whole px so the zone
 * main hit-tests never falls short of the chip. Null when it has no area.
 */
export function relativeRect(outer: ClientRect, inner: ClientRect): Rect | null {
  const values = [outer.left, outer.top, inner.left, inner.top, inner.right, inner.bottom]
  if (!values.every(Number.isFinite)) return null
  const x = Math.floor(inner.left - outer.left)
  const y = Math.floor(inner.top - outer.top)
  const width = Math.ceil(inner.right - outer.left) - x
  const height = Math.ceil(inner.bottom - outer.top) - y
  return width > 0 && height > 0 ? { x, y, width, height } : null
}

/** The two rects share some area (touching edges do not count). */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

/**
 * The radar's clashes in this window, for the edit chips: on the radar (TOPMOST_WIDGET), every
 * other drawn widget it covers, PAINT_ORDER; on any other panel, the radar when it covers it.
 * Ghosts and widgets not drawn count for nothing.
 */
export function radarClashes(id: WidgetId, slots: readonly SlotHandle[]): WidgetId[] {
  const radar = slots.find((s) => s.id === TOPMOST_WIDGET)
  if (radar === undefined || !radar.shown.value) return []
  const covers = (s: SlotHandle): boolean =>
    s.id !== TOPMOST_WIDGET && s.shown.value && rectsOverlap(s.rect.value, radar.rect.value)
  if (id === TOPMOST_WIDGET) return slots.filter(covers).map((s) => s.id)
  const self = slots.find((s) => s.id === id)
  return self !== undefined && covers(self) ? [TOPMOST_WIDGET] : []
}
