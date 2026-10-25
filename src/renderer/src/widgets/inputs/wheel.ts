/**
 * Steering wheel drawn by the inputs widget ('Volante: rueda'): a static SVG in user units of
 * a "-10 -10 20 20" viewBox, rotated as a whole with a CSS transform (its own compositor
 * layer), so a 60 Hz steering change never re-renders or repaints it.
 */

/** Rim centre-line radius and stroke width. */
export const WHEEL_RIM_R = 8
export const WHEEL_RIM_W = 2.2
/** Hub radius. */
export const WHEEL_HUB_R = 2.4

/** Inner edge of the rim: the spokes end there. */
const RIM_INNER = WHEEL_RIM_R - WHEEL_RIM_W / 2

/** A spoke from the hub edge to the rim at `deg` (0 = right, 90 = down; SVG y points down). */
function spoke(deg: number): string {
  const a = (deg * Math.PI) / 180
  const r = (v: number): number => Math.round(v * 100) / 100
  const c = Math.cos(a)
  const s = Math.sin(a)
  return `M${r(c * WHEEL_HUB_R)} ${r(s * WHEEL_HUB_R)}L${r(c * RIM_INNER)} ${r(s * RIM_INNER)}`
}

/** Three spokes: left, right and bottom, like most racing wheels. */
export const WHEEL_SPOKES = [spoke(180), spoke(0), spoke(90)].join('')
export const WHEEL_SPOKE_W = 1.8

/** Straight-ahead marker at 12 o'clock, across the rim. */
export const WHEEL_MARKER = `M0 ${-(WHEEL_RIM_R + WHEEL_RIM_W / 2)}V${-RIM_INNER}`
export const WHEEL_MARKER_W = 2.4
