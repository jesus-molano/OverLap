/**
 * The steering wheels the inputs widget draws ('Volante': minimalista, realista, fórmula): static
 * SVGs in user units of a "-12 -12 24 24" viewBox (WHEEL_VIEWBOX), rotated as a whole with a CSS
 * transform on their own compositor layer, so a 60 Hz steering change never re-renders or
 * repaints one. Pure geometry: SteeringWheel.vue draws it.
 *
 * Every wheel is drawn straight ahead with its accent mark at 12 o'clock; SVG y points down.
 */
import type { SteeringStyle, WheelSize } from '@shared/types'

export type WheelStyle = Exclude<SteeringStyle, 'bar'>

/** Half the viewBox: every wheel fits a circle of this radius, so it never clips as it turns. */
export const WHEEL_HALF = 12
export const WHEEL_VIEWBOX = `${-WHEEL_HALF} ${-WHEEL_HALF} ${2 * WHEEL_HALF} ${2 * WHEEL_HALF}`

const r2 = (v: number): number => Math.round(v * 100) / 100

/** The point at `deg` on a circle of radius `r` (0 = 3 o'clock, 90 = 6 o'clock). */
function polar(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180
  return [r2(Math.cos(a) * r), r2(Math.sin(a) * r)]
}

/** An arc of radius `r` from `fromDeg` to `toDeg`, clockwise (the short way). */
function arc(r: number, fromDeg: number, toDeg: number): string {
  const [x0, y0] = polar(r, fromDeg)
  const [x1, y1] = polar(r, toDeg)
  return `M${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}`
}

/** A rounded rectangle by its top-left corner. */
export interface WheelRect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly r: number
}

/** A rounded rectangle centred on (cx, cy). */
function rect(cx: number, cy: number, w: number, h: number, r: number): WheelRect {
  return Object.freeze({ x: r2(cx - w / 2), y: r2(cy - h / 2), w, h, r })
}

// ---- Minimalista: a thin ring and the mark --------------------------------

export const MINIMAL = Object.freeze({
  ringR: 10,
  ringW: 1.3,
  /** The mark: a thicker stretch of the ring around 12 o'clock. */
  mark: arc(10, -104, -76),
  markW: 3
})

// ---- Realista: a GT / road wheel ------------------------------------------

const RIM_R = 9.3
const RIM_W = 2.8
const RIM_IN = RIM_R - RIM_W / 2
const HUB_R = 3.4

/**
 * A spoke from inside the hub to under the rim around `deg`, `hubW` wide at the hub and `rimW`
 * at the rim (a filled trapezoid).
 */
function spoke(deg: number, hubW: number, rimW: number): string {
  const a = (deg * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  // The unit vector across the spoke.
  const px = -s
  const py = c
  const h = HUB_R - 0.6
  const out = RIM_IN + 0.4
  const pts: [number, number][] = [
    [c * h + (px * hubW) / 2, s * h + (py * hubW) / 2],
    [c * out + (px * rimW) / 2, s * out + (py * rimW) / 2],
    [c * out - (px * rimW) / 2, s * out - (py * rimW) / 2],
    [c * h - (px * hubW) / 2, s * h - (py * hubW) / 2]
  ]
  return `M${pts.map(([x, y]) => `${r2(x)} ${r2(y)}`).join('L')}Z`
}

export const REALISTIC = Object.freeze({
  rimR: RIM_R,
  rimW: RIM_W,
  /** The grips: the rim thicker at 3 and 9 o'clock, where the hands go. */
  grips: arc(RIM_R, 150, 210) + arc(RIM_R, -30, 30),
  gripW: RIM_W + 0.9,
  /** Left and right spokes a little under the centre line, a narrower one to 6 o'clock. */
  spokes: [spoke(172, 3.6, 2.6), spoke(8, 3.6, 2.6), spoke(90, 2.4, 1.8)].join(''),
  hubR: HUB_R,
  /** The horn pad, a recess in the hub. */
  padR: 2.1,
  /** The 12 o'clock stripe, across the rim. */
  mark: `M0 ${-(RIM_R + RIM_W / 2)}V${-RIM_IN}`,
  markW: 1.8
})

// ---- Fórmula: a yoke, one outline that flares into the handles -----------

/** Half the width across the handles, the top edge and the handles' bottom. */
const YOKE_W = 10.2
const YOKE_TOP = -5.2
const YOKE_BOTTOM = 5.8
/** Where each handle starts (its inner side) and how low the body between them comes. */
const HANDLE_IN = 7.2
const BODY_BOTTOM = 2.6
/** Corner rounding. */
const CR = 1.6

/** A closed path from its commands, every number rounded (points, never single H/V numbers). */
function yokePath(cmds: readonly (readonly [string, ...number[]])[]): string {
  return cmds.map(([c, ...n]) => `${c}${n.map(r2).join(' ')}`).join('') + 'Z'
}

/**
 * The yoke as one outline, as on a real formula or GT wheel: a straight top edge from handle to
 * handle, the handles hanging lower than the body between them, so it keeps a clear "up" (a
 * flat top, an open bottom) whichever way it is turned.
 */
const YOKE = yokePath([
  // Up the left side, along the top edge, down the right handle.
  ['M', -YOKE_W, YOKE_TOP + CR],
  ['Q', -YOKE_W, YOKE_TOP, -YOKE_W + CR, YOKE_TOP],
  ['L', YOKE_W - CR, YOKE_TOP],
  ['Q', YOKE_W, YOKE_TOP, YOKE_W, YOKE_TOP + CR],
  ['L', YOKE_W, YOKE_BOTTOM - CR],
  ['Q', YOKE_W, YOKE_BOTTOM, YOKE_W - CR, YOKE_BOTTOM],
  ['Q', HANDLE_IN, YOKE_BOTTOM, HANDLE_IN, YOKE_BOTTOM - CR],
  // Up the handle's inner side, under the body, down the left handle.
  ['L', HANDLE_IN, BODY_BOTTOM + 1],
  ['Q', HANDLE_IN, BODY_BOTTOM, HANDLE_IN - 1, BODY_BOTTOM],
  ['L', -HANDLE_IN + 1, BODY_BOTTOM],
  ['Q', -HANDLE_IN, BODY_BOTTOM, -HANDLE_IN, BODY_BOTTOM + 1],
  ['L', -HANDLE_IN, YOKE_BOTTOM - CR],
  ['Q', -HANDLE_IN, YOKE_BOTTOM, -YOKE_W + CR, YOKE_BOTTOM],
  ['Q', -YOKE_W, YOKE_BOTTOM, -YOKE_W, YOKE_BOTTOM - CR]
])

const GRIP_W = 2.2
const gripX = (YOKE_W + HANDLE_IN) / 2

export const FORMULA = Object.freeze({
  body: YOKE,
  bodyHalfW: YOKE_W,
  bodyTop: YOKE_TOP,
  /** The handles' inner side and the body's lower edge between them. */
  handleIn: HANDLE_IN,
  bodyBottom: BODY_BOTTOM,
  /** The rubber of each handle: inside the outline, a shade lighter. */
  grips: Object.freeze([rect(-gripX, 1.3, GRIP_W, 7.8, 1.1), rect(gripX, 1.3, GRIP_W, 7.8, 1.1)]),
  /** The top edge, drawn brighter: it says which way is up. */
  topEdge: `M${r2(-YOKE_W + CR)} ${YOKE_TOP}H${r2(YOKE_W - CR)}`,
  topEdgeW: 0.9,
  /** The dash display in the middle. */
  screen: rect(0, -1.5, 7, 3.6, 0.7),
  /** A rotary each side of the display, and smaller buttons under them. */
  buttons: Object.freeze([
    [-5.3, -2.6, 0.8],
    [5.3, -2.6, 0.8],
    [-5.3, 0.4, 0.55],
    [5.3, 0.4, 0.55]
  ] as const),
  /** The 12 o'clock mark: a bar standing on the top edge. */
  mark: rect(0, YOKE_TOP - 0.2, 3, 1.8, 0.45)
})

/** The wheel's box, em of the info column's font, by size (medium is about the wheel of before). */
export const WHEEL_SIZE_EM: Readonly<Record<WheelSize, number>> = Object.freeze({
  small: 1.9,
  medium: 2.5,
  large: 3.2
})
