/**
 * Pure mapping from RadarData to SVG user units. The widget's viewBox is
 * "-50 -50 100 100": the player sits at the origin, ahead is up (negative y).
 */
import { clamp01 } from '@shared/num'
import { RADAR } from '@shared/radar'
import type { RadarCar } from '@shared/types'

/** Half side of the rounded-square background. */
export const BG_HALF = 48
/** Corner radius: about 6 px in the default 220 x 260 window, like every panel (--ov-radius). */
export const BG_RADIUS = 2.8
/**
 * The bezel (light inner ring and lit top edge) sits this far inside the background's edge:
 * about 1 px at the default size, so the two 1 px rings lie side by side like a panel's border
 * and its inset ring.
 */
export const BEZEL_INSET = 0.45
/** `rangeM` maps to this many units from the centre. */
export const RANGE_UNITS = 44
export const LANE_SPACING = 13
export const CAR_W = 7
/** Drawn length of a car: always RADAR.carLengthM, see distToY. */
export const CAR_H = 15
export const CAR_RX = 2.2

/** Side alert zone: centred on the player, from the outer edge towards the player's flank. */
export const ALERT_HALF_H = 22
export const ALERT_WASH_W = BG_HALF - CAR_W / 2 - 1
export const ALERT_BAR_INSET = 1.5
/** Faint wider copy of the alert bar drawn behind it: the bar's glow without a blur filter. */
export const ALERT_BLOOM_PAD = 1

/** Range labels: right-aligned inside the alert bar column, clear of the rounded corner. */
export const LABEL_X = 40
/** Design size of the labels (user units): 9.9 px in the default 220 x 260 window. */
export const LABEL_FONT = 4.5
/** Labels are never drawn smaller than the overlay's text floor (theme.css --ov-min-text). */
export const LABEL_MIN_PX = 9
/** Raised past this (a very small radar), they would crowd the cars: they are left out. */
export const LABEL_FONT_MAX = 7.5
/** Side of the square viewBox: the SVG scales by min(width, height) / VIEW_UNITS. */
export const VIEW_UNITS = 100

const round2 = (v: number): number => Math.round(v * 100) / 100

/**
 * Label size (user units) for a radar drawn `widthPx` x `heightPx` CSS px: LABEL_FONT, raised
 * so it never renders under LABEL_MIN_PX; null when that would exceed LABEL_FONT_MAX. Before
 * the size is known, LABEL_FONT. Rounded to 0.1 so a resize changes it in visible steps only.
 */
export function labelFontUnits(widthPx: number, heightPx: number): number | null {
  const pxPerUnit = Math.min(widthPx, heightPx) / VIEW_UNITS
  if (!(pxPerUnit > 0) || !Number.isFinite(pxPerUnit)) return LABEL_FONT
  // The epsilon keeps float noise (9 / 1.2 = 7.500000000000001) from rounding up a step.
  const units = Math.ceil(Math.max(LABEL_FONT, LABEL_MIN_PX / pxPerUnit) * 10 - 1e-9) / 10
  return units > LABEL_FONT_MAX ? null : units
}

/** SVG attributes of a rounded rect centred on the origin. */
export interface CenteredRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly rx: number
}

/** A `w` x `h` rect with corner radius `rx`, centred on the origin and grown by `pad` per side. */
export function centeredRect(w: number, h: number, rx: number, pad = 0): CenteredRect {
  return Object.freeze({
    x: round2(-w / 2 - pad),
    y: round2(-h / 2 - pad),
    width: round2(w + 2 * pad),
    height: round2(h + 2 * pad),
    rx: round2(rx + pad)
  })
}

/** The background rect pulled in by BEZEL_INSET on every side, its corners concentric. */
export const BEZEL = centeredRect(BG_HALF * 2, BG_HALF * 2, BG_RADIUS, -BEZEL_INSET)

/**
 * The bezel's top edge, from the top of the left side round the corner to the top of the right
 * side: the lit top edge of every panel (theme.css --ov-edge-top), drawn in the SVG.
 */
export const BEZEL_TOP_PATH = ((): string => {
  const e = round2(BG_HALF - BEZEL_INSET)
  const r = BEZEL.rx
  const s = round2(e - r)
  return `M${-e} ${-s}A${r} ${r} 0 0 1 ${-s} ${-e}H${s}A${r} ${r} 0 0 1 ${e} ${-s}`
})()

/*
 * Glows are fixed shapes behind each icon instead of blur filters, which re-rasterise every
 * frame a car moves. One faint ring in the car's colour approximates a small blur; a car
 * alongside also gets a wide radial gradient (CAR_ALONGSIDE_GLOW) for its stronger glow.
 */
export const CAR_BODY = centeredRect(CAR_W, CAR_H, CAR_RX)
export const CAR_HALO_INNER = centeredRect(CAR_W, CAR_H, CAR_RX, 0.7)
export const CAR_ALONGSIDE_GLOW = centeredRect(CAR_W, CAR_H, CAR_RX, 5)
export const PLAYER_HALO_INNER = centeredRect(CAR_W, CAR_H, CAR_RX, 1)

/**
 * The windshield, in the front third of the body: dark on your accent car, in the class colour
 * on everyone else's (their body carries the proximity colour).
 */
export const CAR_GLASS: CenteredRect = Object.freeze({
  x: -2.4,
  y: -4.6,
  width: 4.8,
  height: 2.6,
  rx: 0.9
})

/**
 * Proximity colour steps of a car, 0 at the edge of the range to PROX_BUCKETS - 1 touching.
 * The colours themselves are CSS (`.rc-N` fills with theme.css `--ov-prox-N`, grey warming to
 * the alert red, never through yellow), so the colour-blind palette recolours the cars without
 * any JS, and a car holding its gap keeps its step, and its v-memo hit.
 */
export const PROX_BUCKETS = 12
const TOP_BUCKET = PROX_BUCKETS - 1

/** The class of each step, built once: a 60 Hz render looks one up and never builds one. */
export const BUCKET_CLASSES: readonly string[] = Object.freeze(
  Array.from({ length: PROX_BUCKETS }, (_, i) => `rc-${i}`)
)

/** Colour step of a car at `proximity` (0..1, clamped; NaN reads as far). Alongside: touching. */
export function proximityBucket(proximity: number, overlapping: boolean): number {
  return overlapping ? TOP_BUCKET : Math.round(clamp01(proximity) * TOP_BUCKET)
}

/**
 * Distance along the track (m, ahead positive) to y. Piecewise linear so one car length is
 * always one icon: the first RADAR.carLengthM spans CAR_H, the rest of the range the remaining
 * units. Icons then touch exactly when the cars do, at any range. Ranges no longer than a car
 * fall back to a linear scale.
 */
export function distToY(distM: number, rangeM: number): number {
  if (!(rangeM > 0) || !Number.isFinite(rangeM) || !Number.isFinite(distM)) return 0
  const len = RADAR.carLengthM
  const abs = Math.abs(distM)
  let u: number
  if (rangeM <= len) u = (abs / rangeM) * RANGE_UNITS
  else if (abs <= len) u = (abs / len) * CAR_H
  else u = CAR_H + ((abs - len) / (rangeM - len)) * (RANGE_UNITS - CAR_H)
  u = Math.min(u, RANGE_UNITS)
  return distM > 0 ? -u : u
}

export function laneToX(lane: number): number {
  return lane * LANE_SPACING
}

/** 1 inside the range, fading linearly to 0 at its edge over the outer RADAR.edgeFadeFrac. */
export function edgeOpacity(distM: number, rangeM: number): number {
  if (!(rangeM > 0)) return 0
  const t = (rangeM - Math.abs(distM)) / (RADAR.edgeFadeFrac * rangeM)
  return t >= 1 ? 1 : t > 0 ? t : 0
}

export interface CarMark {
  /** carIdx, or 'p' + lane for phantom cars (suffixed if a lane repeats). */
  key: string
  /** Car centre (SVG units, rounded like the transform): its lane's x, its distance's y. */
  x: number
  y: number
  /** SVG transform placing the car centre: markTransform(x, y). */
  transform: string
  /** Proximity colour step, 0 (far) to PROX_BUCKETS - 1 (touching): see BUCKET_CLASSES. */
  bucket: number
  /**
   * Class colour, drawn as the car's windshield (CAR_GLASS): a mark, never the body or its
   * outline, so it can never turn a car into a copy of yours.
   */
  classColor: string
  overlapping: boolean
  opacity: number
}

/** Shared result for every frame without cars, so a hidden radar does not re-render. */
export const NO_MARKS: readonly CarMark[] = Object.freeze([])

/** Rounding of toCarMarks, in steps per unit: positions in SVG units, opacity (0 = exact). */
export interface MarkPrecision {
  readonly pos: number
  readonly opacity: number
}

const EXACT: MarkPrecision = Object.freeze({ pos: 100, opacity: 0 })

/**
 * What the widget draws with. 0.1 units is 0.2-0.4 px at usual window sizes and 1/50 opacity
 * steps are invisible, yet a car holding its gap then yields identical marks frame after
 * frame (see sameMarks), so the window neither re-renders nor repaints.
 */
export const WIDGET_PRECISION: MarkPrecision = Object.freeze({ pos: 10, opacity: 50 })

/**
 * `v` in steps of 1 / `steps` (0 = exact). Integer steps divide back exactly: 0.1, not
 * 0.30000000000000004.
 */
export const roundSteps = (v: number, steps: number): number =>
  steps > 0 ? Math.round(v * steps) / steps : v

/**
 * Where to draw a car along the track. In your lane and not alongside per CarLeftRight, a car
 * closer than a car length is beside you with a gap iRacing does not report, or nose to tail:
 * it is drawn touching your bumper, never on top of your icon (that read as "the radar missed
 * the car next to me"). Its colour still says how close it is.
 */
export function drawnDistM(car: Pick<RadarCar, 'distM' | 'lane' | 'overlapping'>): number {
  const len = RADAR.carLengthM
  if (car.lane !== 0 || car.overlapping || !(Math.abs(car.distM) < len)) return car.distM
  return car.distM > 0 ? len : -len
}

/** SVG transform of a car centred on (x, y). */
export function markTransform(x: number, y: number): string {
  return `translate(${x} ${y})`
}

/**
 * Cars to draw, closest last so they paint on top; fully faded ones are left out.
 * Does not mutate `cars`.
 */
export function toCarMarks(
  cars: readonly RadarCar[],
  rangeM: number,
  precision: MarkPrecision = EXACT
): readonly CarMark[] {
  if (cars.length === 0) return NO_MARKS
  const sorted = cars.slice().sort((a, b) => a.proximity - b.proximity)
  const used = new Set<string>()
  const marks: CarMark[] = []
  for (const car of sorted) {
    const raw = car.overlapping ? 1 : edgeOpacity(car.distM, rangeM)
    const opacity = roundSteps(raw, precision.opacity)
    if (opacity <= 0) continue
    const base = car.carIdx >= 0 ? String(car.carIdx) : `p${car.lane}`
    let key = base
    for (let n = 2; used.has(key); n++) key = `${base}#${n}`
    used.add(key)
    const x = roundSteps(laneToX(car.lane), precision.pos)
    const y = roundSteps(distToY(drawnDistM(car), rangeM), precision.pos)
    marks.push({
      key,
      x,
      y,
      transform: markTransform(x, y),
      bucket: proximityBucket(car.proximity, car.overlapping),
      classColor: car.classColor,
      overlapping: car.overlapping,
      opacity
    })
  }
  return marks.length > 0 ? marks : NO_MARKS
}

/** True when both lists draw exactly the same thing, in the same order (x, y: see transform). */
export function sameMarks(a: readonly CarMark[], b: readonly CarMark[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const m = a[i]
    const n = b[i]
    if (
      m === undefined ||
      n === undefined ||
      m.key !== n.key ||
      m.transform !== n.transform ||
      m.opacity !== n.opacity ||
      m.bucket !== n.bucket ||
      m.classColor !== n.classColor ||
      m.overlapping !== n.overlapping
    ) {
      return false
    }
  }
  return true
}

export interface RangeGuides {
  /** Half-range line ahead (negative y); the one behind mirrors it. */
  halfY: number
  /** Short centre-line ticks every quarter of the range, top to bottom. */
  ticksY: readonly number[]
  /** Text baselines: half label just above its line, full label just inside the range edge. */
  halfLabelY: number
  fullLabelY: number
}

const QUARTERS: readonly number[] = [1, 0.75, 0.5, 0.25, -0.25, -0.5, -0.75, -1]

/**
 * Guide and label positions for a valid range, through the same mapping as the cars, with
 * labels of `labelFont` user units.
 */
export function rangeGuides(rangeM: number, labelFont = LABEL_FONT): RangeGuides {
  const halfY = round2(distToY(rangeM / 2, rangeM))
  return {
    halfY,
    ticksY: QUARTERS.map((f) => round2(distToY(f * rangeM, rangeM))),
    halfLabelY: round2(halfY - 1.2),
    fullLabelY: round2(distToY(rangeM, rangeM) + labelFont * 0.85)
  }
}

export interface SideAlertStyle {
  opacity: number
  barWidth: number
}

const ALERT_NONE: SideAlertStyle = Object.freeze({ opacity: 0, barWidth: 3 })
const ALERT_ONE: SideAlertStyle = Object.freeze({ opacity: 0.75, barWidth: 3 })
const ALERT_TWO: SideAlertStyle = Object.freeze({ opacity: 1, barWidth: 5.5 })

/** Shared frozen objects: no allocation per frame. */
export function sideAlertStyle(count: number): SideAlertStyle {
  if (count >= 2) return ALERT_TWO
  if (count === 1) return ALERT_ONE
  return ALERT_NONE
}
