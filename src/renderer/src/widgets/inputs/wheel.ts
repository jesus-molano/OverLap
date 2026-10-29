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

// ---- Fórmula: a rectangular yoke with grips --------------------------------

const BODY_W = 7.6
const BODY_TOP = -4.6
const BODY_BOTTOM = 4.2

/** The yoke's body: flat on top, its lower corners rounded off, a shallow cut under the display. */
const BODY =
  `M${-BODY_W} ${BODY_TOP + 1.2}Q${-BODY_W} ${BODY_TOP} ${-BODY_W + 1.2} ${BODY_TOP}` +
  `H${BODY_W - 1.2}Q${BODY_W} ${BODY_TOP} ${BODY_W} ${BODY_TOP + 1.2}` +
  `V${r2(BODY_BOTTOM - 2.4)}Q${BODY_W} ${BODY_BOTTOM} ${r2(BODY_W - 2.6)} ${BODY_BOTTOM}` +
  `H3.4Q2.4 ${BODY_BOTTOM} 2 ${r2(BODY_BOTTOM - 1)}H-2Q-2.4 ${BODY_BOTTOM} -3.4 ${BODY_BOTTOM}` +
  `H${r2(-BODY_W + 2.6)}Q${-BODY_W} ${BODY_BOTTOM} ${-BODY_W} ${r2(BODY_BOTTOM - 2.4)}Z`

export const FORMULA = Object.freeze({
  body: BODY,
  bodyHalfW: BODY_W,
  /** The grips stand out of each side, taller than the body. */
  grips: Object.freeze([rect(-9, 0.4, 3.2, 10, 1.6), rect(9, 0.4, 3.2, 10, 1.6)]),
  /** The dash display in the middle. */
  screen: rect(0, -1.3, 7, 4, 0.7),
  /** Rotaries and buttons each side of the display. */
  buttons: Object.freeze([
    [-5.3, -2.4],
    [5.3, -2.4],
    [-5.3, 0.6],
    [5.3, 0.6],
    [-3.2, 2.6],
    [3.2, 2.6]
  ] as const),
  buttonR: 0.8,
  /** The 12 o'clock mark: a short bar on the top edge. */
  mark: rect(0, BODY_TOP, 2.2, 1.2, 0.4)
})

/** The wheel's box, em of the info column's font, by size (medium is about the wheel of before). */
export const WHEEL_SIZE_EM: Readonly<Record<WheelSize, number>> = Object.freeze({
  small: 1.9,
  medium: 2.5,
  large: 3.2
})
