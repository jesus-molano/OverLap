import type { Rect } from '@shared/types'
import { owningDisplay, type DisplayInfo } from './overlayLayout'

/** The confirmation's window: the pill is drawn in the middle, the rest is transparent. */
// Tall enough for a text on two lines and a detail on two (a long layout or car name): the
// window lets every click through, so its transparent rest is never in the way.
export const OSD_SIZE = { width: 520, height: 120 } as const
/** Below the top edge of its display's work area. */
const TOP_GAP = 36

/**
 * The display the game is on, as far as main can tell (R37): the one holding most of the widgets
 * that are on (they are laid out over the game); the primary one on a tie it is part of, or when
 * none is on.
 */
export function gameDisplay(
  widgets: readonly Rect[],
  displays: readonly DisplayInfo[],
  primaryId: number
): DisplayInfo | undefined {
  const count = new Map<number, number>()
  for (const r of widgets) {
    const d = owningDisplay(r, displays)
    if (d) count.set(d.id, (count.get(d.id) ?? 0) + 1)
  }
  const primary = displays.find((d) => d.id === primaryId) ?? displays[0]
  let best = primary
  let most = best ? (count.get(best.id) ?? 0) : 0
  for (const d of displays) {
    const n = count.get(d.id) ?? 0
    if (n > most) {
      best = d
      most = n
    }
  }
  return best
}

/** The confirmation at the top centre of `area` (a work area). */
export function osdBounds(area: Rect): Rect {
  return {
    x: Math.round(area.x + (area.width - OSD_SIZE.width) / 2),
    y: area.y + TOP_GAP,
    width: OSD_SIZE.width,
    height: OSD_SIZE.height
  }
}
