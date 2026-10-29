import type { Rect } from '@shared/types'
import { WIDGET_IDS, type WidgetId } from '@shared/widgets'
import { owningDisplay, type DisplayInfo } from './overlayLayout'

function containsCentre(area: Rect, r: Rect): boolean {
  const cx = r.x + r.width / 2
  const cy = r.y + r.height / 2
  return cx >= area.x && cx < area.x + area.width && cy >= area.y && cy < area.y + area.height
}

/**
 * Where `rect` goes when it is brought to `target` (R51): at the same place relative to its own
 * display's work area (the display holding its centre, else the nearest one: a monitor that was
 * unplugged), with its size, and kept inside the target's work area. Null when its centre is
 * already on the target. Pure.
 */
export function gatheredRect(
  rect: Rect,
  displays: readonly DisplayInfo[],
  target: DisplayInfo
): Rect | null {
  if (containsCentre(target.bounds, rect)) return null
  const from = owningDisplay(rect, displays)?.workArea ?? target.workArea
  const to = target.workArea
  const relX = from.width > 0 ? (rect.x + rect.width / 2 - from.x) / from.width : 0.5
  const relY = from.height > 0 ? (rect.y + rect.height / 2 - from.y) / from.height : 0.5
  const clampRel = (v: number): number => Math.min(1, Math.max(0, v))
  const width = rect.width
  const height = rect.height
  const fit = (start: number, room: number, size: number, rel: number): number => {
    const centred = start + clampRel(rel) * room - size / 2
    const max = start + Math.max(0, room - size)
    return Math.round(Math.min(max, Math.max(start, centred)))
  }
  return {
    x: fit(to.x, to.width, width, relX),
    y: fit(to.y, to.height, height, relY),
    width,
    height
  }
}

/**
 * The new bounds of every widget not on `target` («Traer todos los widgets a esta pantalla»,
 * R51); the ones already there are left out. Pure.
 */
export function gatherBounds(
  bounds: Readonly<Record<WidgetId, Rect>>,
  displays: readonly DisplayInfo[],
  target: DisplayInfo
): Partial<Record<WidgetId, Rect>> {
  const out: Partial<Record<WidgetId, Rect>> = {}
  for (const id of WIDGET_IDS) {
    const next = gatheredRect(bounds[id], displays, target)
    if (next !== null) out[id] = next
  }
  return out
}
