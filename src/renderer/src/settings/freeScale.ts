/**
 * «Escala» of a free-size widget (Relativo, Radar, Delta), R09: its window's size as a share of
 * its factory size, the same 60–200 % slider and 80/100/125/150 buttons as every other widget.
 * Setting it resizes the window about its centre, as the mouse wheel does in edit mode, keeping
 * the shape you gave it. The global «Tamaño del texto» multiplies it, as it multiplies the scale
 * of the other widgets: at 150 % text a window at 1.5× its factory width reads «100 %». Pure.
 */
import type { Rect, Size } from '@shared/types'

/** The factory width times the text size (%), what «100 %» is. */
function baseWidth(factory: Size, fontScale: number): number {
  return (factory.width * (fontScale > 0 ? fontScale : 100)) / 100
}

/** The window's width as a whole percentage of the factory width (times the text size). */
export function freeScalePercent(bounds: Rect, factory: Size, fontScale = 100): number {
  const base = baseWidth(factory, fontScale)
  if (!(base > 0) || !Number.isFinite(bounds.width)) return 100
  return Math.round((bounds.width / base) * 100)
}

/**
 * The window at `percent` of the factory width (times the text size): its height in the same
 * proportion as now (the shape kept), about the same centre, at least `min`.
 */
export function freeScaleBounds(
  bounds: Rect,
  factory: Size,
  percent: number,
  min: Size,
  fontScale = 100
): Rect {
  const width = Math.max(min.width, Math.round((baseWidth(factory, fontScale) * percent) / 100))
  const ratio = bounds.width > 0 ? bounds.height / bounds.width : factory.height / factory.width
  const height = Math.max(min.height, Math.round(width * ratio))
  return {
    x: Math.round(bounds.x + (bounds.width - width) / 2),
    y: Math.round(bounds.y + (bounds.height - height) / 2),
    width,
    height
  }
}
