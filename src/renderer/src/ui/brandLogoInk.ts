/**
 * How much a logo's drawing covers, read from its path data alone (no browser): the box of its
 * ink, with the true extremes of every curve and arc, and the area its fills cover. The script
 * scripts/brand-logo-sizes.mjs measures every logo with it and writes brandLogoSizes.ts; the
 * tests measure again and check that file is current.
 *
 * Plain erasable TypeScript with no imports: Node runs it as is (type stripping).
 */

export interface InkShape {
  readonly d: string
  readonly evenOdd?: boolean
}

/** [x0, y0, x1, y1] */
export type InkBox = readonly [number, number, number, number]

export interface InkMeasure {
  readonly box: InkBox
  /** Area the shapes cover together (their union), in square units of the path. */
  readonly area: number
}

type Point = readonly [number, number]

const ARGS: Readonly<Record<string, number>> = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7,
  Z: 0
}
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/

/** One parsed path: closed polygons of its flattened outline, and its exact bounds. */
interface Outline {
  readonly polygons: Point[][]
  readonly box: [number, number, number, number]
}

/** Roots in [0, 1] of a t^2 + b t + c. */
function unitRoots(a: number, b: number, c: number): number[] {
  const out: number[] = []
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) out.push(-c / b)
  } else {
    const disc = b * b - 4 * a * c
    if (disc >= 0) {
      const s = Math.sqrt(disc)
      out.push((-b + s) / (2 * a), (-b - s) / (2 * a))
    }
  }
  return out.filter((t) => t > 0 && t < 1)
}

function cubicAt(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
}

/** Parameters where a cubic's coordinate turns (derivative zero). */
function cubicTurns(p0: number, p1: number, p2: number, p3: number): number[] {
  // d/dt = 3[(p1-p0)(1-t)^2 + 2(p2-p1)(1-t)t + (p3-p2)t^2]
  const a = p1 - p0
  const b = p2 - p1
  const c = p3 - p2
  return unitRoots(a - 2 * b + c, 2 * (b - a), a)
}

/** Steps to flatten a curve whose control polygon is `len` long (about 0.02 units of error). */
function steps(len: number): number {
  return Math.min(256, Math.max(4, Math.ceil(len * 4)))
}

/**
 * Parses a path (absolute and relative commands, implicit repeats, compact arc flags) into
 * flattened closed polygons and its exact bounds. Throws on anything malformed.
 */
export function outline(d: string): Outline {
  const polygons: Point[][] = []
  const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity]
  const grow = (x: number, y: number): void => {
    if (x < box[0]) box[0] = x
    if (y < box[1]) box[1] = y
    if (x > box[2]) box[2] = x
    if (y > box[3]) box[3] = y
  }
  let current: Point[] = []
  const flush = (): void => {
    if (current.length > 2) polygons.push(current)
    current = []
  }
  const to = (x: number, y: number): void => {
    current.push([x, y])
  }

  let i = 0
  let x = 0
  let y = 0
  let sx = 0
  let sy = 0
  /** The last control point, for S and T reflections. */
  let cx = 0
  let cy = 0
  let prev = ''
  let cmd = ''
  const skip = (): void => {
    while (i < d.length && /[\s,]/.test(d.charAt(i))) i++
  }
  const num = (): number => {
    skip()
    const m = NUMBER.exec(d.slice(i))
    if (!m) throw new Error(`number expected at ${i}: '${d.slice(i, i + 12)}'`)
    i += m[0].length
    return Number(m[0])
  }
  const flag = (): number => {
    skip()
    const c = d.charAt(i)
    if (c !== '0' && c !== '1') throw new Error(`arc flag expected at ${i}`)
    i++
    return Number(c)
  }

  const cubic = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void => {
    for (const t of [...cubicTurns(x, x1, x2, x3), ...cubicTurns(y, y1, y2, y3)]) {
      grow(cubicAt(x, x1, x2, x3, t), cubicAt(y, y1, y2, y3, t))
    }
    grow(x3, y3)
    const len =
      Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2)
    const n = steps(len)
    for (let k = 1; k <= n; k++) {
      const t = k / n
      to(cubicAt(x, x1, x2, x3, t), cubicAt(y, y1, y2, y3, t))
    }
    cx = x2
    cy = y2
    x = x3
    y = y3
  }

  const arc = (
    rxIn: number,
    ryIn: number,
    angle: number,
    large: number,
    sweep: number,
    x2: number,
    y2: number
  ): void => {
    let rx = Math.abs(rxIn)
    let ry = Math.abs(ryIn)
    if ((x === x2 && y === y2) || rx === 0 || ry === 0) {
      grow(x2, y2)
      to(x2, y2)
      x = x2
      y = y2
      return
    }
    // SVG 1.1 implementation notes, F.6.5: endpoint to centre parameterisation.
    const phi = (angle * Math.PI) / 180
    const cos = Math.cos(phi)
    const sin = Math.sin(phi)
    const dx = (x - x2) / 2
    const dy = (y - y2) / 2
    const x1p = cos * dx + sin * dy
    const y1p = -sin * dx + cos * dy
    const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
    if (lambda > 1) {
      rx *= Math.sqrt(lambda)
      ry *= Math.sqrt(lambda)
    }
    const num2 = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
    const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
    let coef = Math.sqrt(Math.max(0, num2 / den))
    if (large === sweep) coef = -coef
    const cxp = (coef * rx * y1p) / ry
    const cyp = (-coef * ry * x1p) / rx
    const ccx = cos * cxp - sin * cyp + (x + x2) / 2
    const ccy = sin * cxp + cos * cyp + (y + y2) / 2
    const ang = (ux: number, uy: number, vx: number, vy: number): number =>
      Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
    const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if (!sweep && dt > 0) dt -= 2 * Math.PI
    if (sweep && dt < 0) dt += 2 * Math.PI
    const at = (t: number): Point => [
      ccx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin,
      ccy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos
    ]
    // Where x and y turn: dx/dt = 0 and dy/dt = 0, every half turn.
    const turns = [Math.atan2(-ry * sin, rx * cos), Math.atan2(ry * cos, rx * sin)]
    const lo = Math.min(t1, t1 + dt)
    const hi = Math.max(t1, t1 + dt)
    for (const base of turns) {
      for (let k = -4; k <= 4; k++) {
        const t = base + k * Math.PI
        if (t > lo && t < hi) grow(...at(t))
      }
    }
    grow(x2, y2)
    const n = Math.max(
      4,
      Math.ceil((Math.abs(dt) / (Math.PI / 32)) * Math.max(1, Math.sqrt(Math.max(rx, ry))))
    )
    for (let k = 1; k < n; k++) to(...at(t1 + (dt * k) / n))
    to(x2, y2)
    x = x2
    y = y2
  }

  for (;;) {
    skip()
    if (i >= d.length) break
    const c = d.charAt(i)
    if (/[a-zA-Z]/.test(c)) {
      if (!(c.toUpperCase() in ARGS)) throw new Error(`unknown command ${c} at ${i}`)
      cmd = c
      i++
    } else if (cmd === '' || /z/i.test(cmd)) {
      throw new Error(`command expected at ${i}`)
    } else if (cmd === 'M') {
      cmd = 'L'
    } else if (cmd === 'm') {
      cmd = 'l'
    }
    const up = cmd.toUpperCase()
    const rel = cmd !== up
    const a: number[] = []
    for (let k = 0; k < (ARGS[up] ?? 0); k++) {
      a.push(up === 'A' && (k === 3 || k === 4) ? flag() : num())
    }
    const ox = rel ? x : 0
    const oy = rel ? y : 0
    const at = (k: number): number => a[k] ?? 0
    switch (up) {
      case 'M':
        flush()
        x = at(0) + ox
        y = at(1) + oy
        sx = x
        sy = y
        grow(x, y)
        to(x, y)
        break
      case 'L':
      case 'H':
      case 'V':
        if (up === 'V') y = at(0) + oy
        else x = at(0) + ox
        if (up === 'L') y = at(1) + oy
        grow(x, y)
        to(x, y)
        break
      case 'C':
        cubic(at(0) + ox, at(1) + oy, at(2) + ox, at(3) + oy, at(4) + ox, at(5) + oy)
        break
      case 'S': {
        const reflect = prev === 'C' || prev === 'S'
        cubic(
          reflect ? 2 * x - cx : x,
          reflect ? 2 * y - cy : y,
          at(0) + ox,
          at(1) + oy,
          at(2) + ox,
          at(3) + oy
        )
        break
      }
      case 'Q':
      case 'T': {
        const qx = up === 'Q' ? at(0) + ox : prev === 'Q' || prev === 'T' ? 2 * x - cx : x
        const qy = up === 'Q' ? at(1) + oy : prev === 'Q' || prev === 'T' ? 2 * y - cy : y
        const ex = (up === 'Q' ? at(2) : at(0)) + ox
        const ey = (up === 'Q' ? at(3) : at(1)) + oy
        // A quadratic is the cubic with controls 2/3 of the way to its control point.
        cubic(
          x + (2 / 3) * (qx - x),
          y + (2 / 3) * (qy - y),
          ex + (2 / 3) * (qx - ex),
          ey + (2 / 3) * (qy - ey),
          ex,
          ey
        )
        cx = qx
        cy = qy
        break
      }
      case 'A':
        arc(at(0), at(1), at(2), at(3), at(4), at(5) + ox, at(6) + oy)
        break
      case 'Z':
        flush()
        x = sx
        y = sy
        to(x, y)
        break
    }
    prev = up
  }
  flush()
  return { polygons, box }
}

/** The covered spans of row `y` of one shape, sorted and disjoint. */
function rowSpans(polygons: readonly Point[][], y: number, evenOdd: boolean): [number, number][] {
  const hits: [number, number][] = []
  for (const poly of polygons) {
    for (let k = 0; k < poly.length; k++) {
      const p = poly[k] as Point
      const q = poly[(k + 1) % poly.length] as Point
      if (p[1] <= y === q[1] <= y) continue
      const t = (y - p[1]) / (q[1] - p[1])
      hits.push([p[0] + t * (q[0] - p[0]), q[1] > p[1] ? 1 : -1])
    }
  }
  hits.sort((m, n) => m[0] - n[0])
  const spans: [number, number][] = []
  let wind = 0
  for (let k = 0; k < hits.length; k++) {
    const [hx, dir] = hits[k] as [number, number]
    wind = evenOdd ? wind ^ 1 : wind + dir
    const next = hits[k + 1]
    if (wind !== 0 && next) spans.push([hx, next[0]])
  }
  return spans
}

/** Length of the union of spans. */
function unionLength(spans: [number, number][]): number {
  spans.sort((m, n) => m[0] - n[0])
  let total = 0
  let end = -Infinity
  for (const [a, b] of spans) {
    if (b <= end) continue
    total += b - Math.max(a, end)
    end = b
  }
  return total
}

/** Rows sampled across the ink's height to measure its area. */
const ROWS = 600

/** The box and covered area of shapes drawn together (a colour logo's layers, or one path). */
export function measureInk(shapes: readonly InkShape[]): InkMeasure {
  const outlines = shapes.map((s) => ({ ...outline(s.d), evenOdd: s.evenOdd === true }))
  const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const o of outlines) {
    box[0] = Math.min(box[0], o.box[0])
    box[1] = Math.min(box[1], o.box[1])
    box[2] = Math.max(box[2], o.box[2])
    box[3] = Math.max(box[3], o.box[3])
  }
  const step = (box[3] - box[1]) / ROWS
  let area = 0
  for (let r = 0; r < ROWS; r++) {
    const y = box[1] + (r + 0.5) * step
    const spans: [number, number][] = []
    for (const o of outlines) spans.push(...rowSpans(o.polygons, y, o.evenOdd))
    area += unionLength(spans) * step
  }
  return { box, area }
}

/*
 * The sizing rule. BrandMark fits each drawing in the same slot: 1.75em wide, 85 % of a 1.15em
 * plate tall. Fitted to the slot alone, a wide mark (McLaren's speedmark, Hyundai's oval) fills
 * all of it and reads half again as big as a round badge (BMW) or a tall crest (Ferrari). Each
 * logo is scaled instead so that the geometric mean of its ink's width and height, nudged by
 * how much of that box it inks (a thin outline reads lighter than a solid disc), is about the
 * same for every logo. No logo grows past the plate or past the slot's width, so tall crests
 * and long wordmarks keep the size they had, and none shrinks to less than SCALE_MIN of it.
 */

/** Width over height of the box the drawing is fitted in, in em. */
export const SLOT_ASPECT = 1.75 / (1.15 * 0.85)
/** The apparent size every logo is brought to, in slot heights. */
export const TARGET_SIZE = 0.85
/** How much ink density counts: apparent size times (inked fraction of the box) ^ this. */
export const DENSITY_WEIGHT = 0.15
/** Never under this fraction of the size the slot alone gave. */
export const SCALE_MIN = 0.65
/** Never over this many slot heights tall: 1.1 x 85 % stays inside the plate. */
export const SCALE_MAX = 1.1

export interface LogoFit {
  /** The drawing's height in slot heights (1 = as tall as the slot), rounded to 0.01. */
  readonly scale: number
  /** Apparent size, in slot heights, fitted to the slot alone and with `scale`. */
  readonly before: number
  readonly after: number
}

/** The scale of a drawing with view box `viewBox` ('x y w h') and ink `ink`. */
export function fitLogo(viewBox: string, ink: InkMeasure): LogoFit {
  const [, , vw = NaN, vh = NaN] = viewBox.split(' ').map(Number)
  const [x0, y0, x1, y1] = ink.box
  const iw = x1 - x0
  const ih = y1 - y0
  const density = ink.area / (iw * ih)
  /** Apparent size per slot height of drawn view box. */
  const unit = (Math.sqrt(iw * ih) / vh) * density ** DENSITY_WEIGHT
  /** The view box's height when it meets the slot's width. */
  const widthLimit = SLOT_ASPECT / (vw / vh)
  const natural = Math.min(1, widthLimit)
  let scale = Math.min(SCALE_MAX, Math.max(SCALE_MIN * natural, TARGET_SIZE / unit))
  // Taller than the slot's width allows changes nothing: keep it at 1.
  if (scale >= widthLimit) scale = 1
  scale = Math.round(scale * 100) / 100
  return { scale, before: natural * unit, after: Math.min(scale, widthLimit) * unit }
}
