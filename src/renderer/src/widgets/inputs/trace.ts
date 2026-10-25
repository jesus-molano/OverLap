/**
 * Pedal trace of the inputs widget: a preallocated sample ring (outside Vue reactivity), the
 * time-to-pixel mapping and the canvas drawing. x follows each sample's SessionTime, so a
 * dropped or late sample leaves the line where it belongs and a gap in the stream shows as a
 * gap. The canvas scrolls left by whole device pixels and only the newest segments are
 * stroked, so a 60 Hz update costs one self-blit and a few short strokes. Geometry is in
 * device pixels.
 */
import { frac } from '@shared/num'
import { OPTION_SCHEMA, clampOption } from '@shared/settingsSchema'

export const CH_THROTTLE = 0
export const CH_BRAKE = 1
export const CH_CLUTCH = 2
/** 1 when ABS was active on that sample, else 0. */
export const CH_ABS = 3
const CHANNELS = 4

/** No line between two samples further apart than this (s): the stream had a gap. */
export const MAX_SEGMENT_S = 0.25
/** Room in the ring for a stream up to this much faster than the widget's nominal rate. */
const RATE_SLACK = 1.5

/** Seconds of history in the schema's range; anything invalid is the default. */
export function clampTraceSeconds(s: unknown): number {
  return clampOption(OPTION_SCHEMA.inputs.traceSeconds, s)
}

/** Line width (CSS px) in the schema's range; anything invalid is the default. */
export function clampTraceWidth(w: unknown): number {
  return clampOption(OPTION_SCHEMA.inputs.traceWidth, w)
}

/** Ring capacity for `seconds` of samples at `hz`, plus slack for a faster stream. */
export function ringCapacity(seconds: number, hz: number): number {
  return Math.ceil(clampTraceSeconds(seconds) * Math.max(1, hz) * RATE_SLACK) + 2
}

/** Fixed-capacity ring of interleaved samples with their times; the oldest is overwritten. */
export class SampleRing {
  readonly capacity: number
  private readonly buf: Float32Array
  private readonly times: Float64Array
  /** Index of the oldest sample. */
  private start = 0
  private count = 0
  /** Time of the first sample since the last clear: the origin of the scroll phase. */
  epoch = NaN

  constructor(capacity: number) {
    this.capacity = Math.max(2, Math.floor(capacity))
    this.buf = new Float32Array(this.capacity * CHANNELS)
    this.times = new Float64Array(this.capacity)
  }

  get length(): number {
    return this.count
  }

  push(t: number, throttle: number, brake: number, clutch: number, abs: boolean): void {
    let slot: number
    if (this.count < this.capacity) {
      slot = (this.start + this.count) % this.capacity
      this.count++
    } else {
      slot = this.start
      this.start = (this.start + 1) % this.capacity
    }
    if (this.count === 1) this.epoch = t
    this.times[slot] = t
    this.write(slot, throttle, brake, clutch, abs)
  }

  /** Replaces the values of the newest sample (a repeated time); false when empty. */
  setNewest(throttle: number, brake: number, clutch: number, abs: boolean): boolean {
    if (this.count === 0) return false
    this.write((this.start + this.count - 1) % this.capacity, throttle, brake, clutch, abs)
    return true
  }

  /** `channel` of the sample `age` pushes before the newest (0 = newest); NaN when not held. */
  at(age: number, channel: number): number {
    if (age < 0 || age >= this.count) return NaN
    const slot = (this.start + this.count - 1 - age) % this.capacity
    return this.buf[slot * CHANNELS + channel] ?? NaN
  }

  /** Time (s) of the sample `age` pushes before the newest; NaN when not held. */
  timeAt(age: number): number {
    if (age < 0 || age >= this.count) return NaN
    return this.times[(this.start + this.count - 1 - age) % this.capacity] ?? NaN
  }

  clear(): void {
    this.start = 0
    this.count = 0
    this.epoch = NaN
  }

  /** A ring of another capacity holding the newest samples, with the same epoch. */
  resized(capacity: number): SampleRing {
    const next = new SampleRing(capacity)
    const keep = Math.min(this.count, next.capacity)
    for (let age = keep - 1; age >= 0; age--) {
      next.push(
        this.timeAt(age),
        this.at(age, CH_THROTTLE),
        this.at(age, CH_BRAKE),
        this.at(age, CH_CLUTCH),
        this.at(age, CH_ABS) === 1
      )
    }
    next.epoch = this.epoch
    return next
  }

  private write(slot: number, throttle: number, brake: number, clutch: number, abs: boolean): void {
    const o = slot * CHANNELS
    this.buf[o + CH_THROTTLE] = throttle
    this.buf[o + CH_BRAKE] = brake
    this.buf[o + CH_CLUTCH] = clutch
    this.buf[o + CH_ABS] = abs ? 1 : 0
  }
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** Vertical inset (CSS px) of the 0 and 1 levels; the widget's grid lines use the same. */
export const TRACE_PAD_CSS = 3
/** Clutch line width relative to the pedal lines (never under 1 CSS px): it stays behind. */
const CLUTCH_RATIO = 0.6
/** Extra width (CSS px, per side) of the dark underlay drawn over the bare game. */
const OUTLINE_CSS = 1

export interface TraceGeometry {
  width: number
  height: number
  /** y of value 1 and of value 0. */
  top: number
  bottom: number
  /** x of the newest sample at scroll phase 0; it moves right by up to 1 px with the phase. */
  right: number
  /** Device px per second of history. */
  pxPerS: number
  lineWidth: number
  clutchLineWidth: number
  outlineWidth: number
}

/**
 * Mapping for a canvas of `width` x `height` device px showing `seconds` of history with
 * lines `lineCss` CSS px wide.
 */
export function traceGeometry(
  width: number,
  height: number,
  dpr: number,
  seconds: number,
  lineCss: number
): TraceGeometry {
  const scale = Number.isFinite(dpr) && dpr > 0 ? dpr : 1
  const w = Math.max(1, Math.floor(width))
  const h = Math.max(1, Math.floor(height))
  const line = clampTraceWidth(lineCss)
  const lineWidth = line * scale
  const outlineWidth = lineWidth + 2 * OUTLINE_CSS * scale
  const pad = Math.min(TRACE_PAD_CSS * scale, h / 4)
  // Room on the right for the round cap (or the underlay) of the newest point plus its phase.
  const right = Math.max(1, w - Math.ceil(outlineWidth / 2) - 1)
  return {
    width: w,
    height: h,
    top: pad,
    bottom: h - pad,
    right,
    pxPerS: right / clampTraceSeconds(seconds),
    lineWidth,
    clutchLineWidth: Math.max(1, line * CLUTCH_RATIO) * scale,
    outlineWidth
  }
}

/** y of a 0..1 value (clamped; NaN reads as 0). */
export function valueY(g: TraceGeometry, v: number): number {
  const c = v > 0 ? (v < 1 ? v : 1) : 0
  return g.bottom - c * (g.bottom - g.top)
}

/** Distance (device px) the trace has scrolled since the ring's epoch when it reached `t`. */
function head(g: TraceGeometry, ring: SampleRing, t: number): number {
  return (t - ring.epoch) * g.pxPerS
}

/**
 * x of the sample `age` pushes before the newest. The canvas scrolled by floor(head) whole
 * pixels so far; the fractional rest is the phase, so a point keeps its exact position across
 * scrolls and a full redraw lands on the same pixels as the incremental ones.
 */
export function sampleX(g: TraceGeometry, ring: SampleRing, age: number): number {
  const tn = ring.timeAt(0)
  return g.right + frac(head(g, ring, tn)) - (tn - ring.timeAt(age)) * g.pxPerS
}

/** Whole pixels to scroll for the newest sample (since the one before it). */
export function scrollShift(g: TraceGeometry, ring: SampleRing): number {
  if (ring.length < 2) return 0
  const shift =
    Math.floor(head(g, ring, ring.timeAt(0))) - Math.floor(head(g, ring, ring.timeAt(1)))
  return shift > 0 ? shift : 0
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/** The 2D context calls the drawer makes (a subset, so tests can record them). */
export type TraceContext = Pick<
  CanvasRenderingContext2D,
  | 'beginPath'
  | 'moveTo'
  | 'lineTo'
  | 'stroke'
  | 'clearRect'
  | 'drawImage'
  | 'strokeStyle'
  | 'lineWidth'
  | 'lineCap'
  | 'lineJoin'
  | 'globalCompositeOperation'
  | 'imageSmoothingEnabled'
>

/** Opaque colours only: overlapping caps of consecutive segments must not darken. */
export interface TraceColors {
  readonly throttle: string
  readonly brake: string
  /** Brake while ABS is active. */
  readonly abs: string
  readonly clutch: string
}

export interface TraceStyle {
  /** Clutch line (clutchInTrace). */
  clutch: boolean
  /** Dark underlay under every line: for a see-through panel over the game. */
  outline: boolean
  colors: TraceColors
}

/** Underlay alpha per stroke. Incremental draws stroke each segment twice (see drawTraceStep). */
const OUTLINE_ALPHA = 0.32
const OUTLINE_STEP = `rgba(0, 0, 0, ${OUTLINE_ALPHA})`
/** Same coverage in one stroke: 1 - (1 - a)^2. */
const OUTLINE_FULL = `rgba(0, 0, 0, ${(1 - (1 - OUTLINE_ALPHA) ** 2).toFixed(3)})`

function brakeColor(ring: SampleRing, age: number, c: TraceColors): string {
  return ring.at(age, CH_ABS) === 1 ? c.abs : c.brake
}

/**
 * Whether the segment from age `older` to `newer` is drawn: not across a gap in the stream,
 * and brake and clutch not while they rest at 0 (the bottom of the plot shows the throttle
 * line instead of a permanent red or blue line over it).
 */
function drawn(ring: SampleRing, channel: number, older: number, newer: number): boolean {
  if (ring.timeAt(newer) - ring.timeAt(older) > MAX_SEGMENT_S) return false
  return channel === CH_THROTTLE || ring.at(older, channel) !== 0 || ring.at(newer, channel) !== 0
}

/** Oldest age worth drawing: the first point left of the canvas still anchors a segment. */
function oldestAge(g: TraceGeometry, ring: SampleRing): number {
  const tn = ring.timeAt(0)
  const span = (g.right + 1 + g.outlineWidth) / g.pxPerS
  const last = ring.length - 1
  let age = 0
  while (age < last && tn - ring.timeAt(age) <= span) age++
  return age
}

/** One path from age `from` to the newer age `to`; segments not drawn only move the pen. */
function polyline(
  ctx: TraceContext,
  g: TraceGeometry,
  ring: SampleRing,
  channel: number,
  from: number,
  to: number
): void {
  ctx.beginPath()
  ctx.moveTo(sampleX(g, ring, from), valueY(g, ring.at(from, channel)))
  for (let age = from - 1; age >= to; age--) {
    const x = sampleX(g, ring, age)
    const y = valueY(g, ring.at(age, channel))
    if (drawn(ring, channel, age + 1, age)) ctx.lineTo(x, y)
    else ctx.moveTo(x, y)
  }
  ctx.stroke()
}

/** Brake as runs of one colour: a segment takes the ABS state of its newer sample. */
function brakeRuns(
  ctx: TraceContext,
  g: TraceGeometry,
  ring: SampleRing,
  from: number,
  c: TraceColors
): void {
  let runStart = from
  let color = brakeColor(ring, from - 1, c)
  for (let age = from - 1; age >= 0; age--) {
    const next = age > 0 ? brakeColor(ring, age - 1, c) : null
    if (next !== color) {
      ctx.strokeStyle = color
      polyline(ctx, g, ring, CH_BRAKE, runStart, age)
      runStart = age
      if (next !== null) color = next
    }
  }
}

/** Clears and draws every held sample: after a resize, an option change or a reset. */
export function drawTraceFull(
  ctx: TraceContext,
  g: TraceGeometry,
  ring: SampleRing,
  style: TraceStyle
): void {
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, g.width, g.height)
  if (ring.length < 2) return
  const from = oldestAge(g, ring)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (style.outline) {
    ctx.strokeStyle = OUTLINE_FULL
    ctx.lineWidth = g.outlineWidth
    if (style.clutch) polyline(ctx, g, ring, CH_CLUTCH, from, 0)
    polyline(ctx, g, ring, CH_THROTTLE, from, 0)
    polyline(ctx, g, ring, CH_BRAKE, from, 0)
  }
  // Same z-order as drawTraceStep: clutch, throttle, brake on top (trail braking reads on top).
  if (style.clutch) {
    ctx.strokeStyle = style.colors.clutch
    ctx.lineWidth = g.clutchLineWidth
    polyline(ctx, g, ring, CH_CLUTCH, from, 0)
  }
  ctx.lineWidth = g.lineWidth
  ctx.strokeStyle = style.colors.throttle
  polyline(ctx, g, ring, CH_THROTTLE, from, 0)
  brakeRuns(ctx, g, ring, from, style.colors)
}

/** Segment from age `age + 1` to `age`, when drawn. */
function segment(
  ctx: TraceContext,
  g: TraceGeometry,
  ring: SampleRing,
  channel: number,
  age: number
): void {
  if (!drawn(ring, channel, age + 1, age)) return
  ctx.beginPath()
  ctx.moveTo(sampleX(g, ring, age + 1), valueY(g, ring.at(age + 1, channel)))
  ctx.lineTo(sampleX(g, ring, age), valueY(g, ring.at(age, channel)))
  ctx.stroke()
}

/**
 * After one push: scrolls the canvas by whole pixels and strokes the newest segment. The one
 * before it is stroked again, so the caps and the underlay of the new segment never leave a
 * notch in the line drawn last time (every segment ends up stroked twice).
 */
export function drawTraceStep(
  ctx: TraceContext,
  canvas: CanvasImageSource,
  g: TraceGeometry,
  ring: SampleRing,
  style: TraceStyle
): void {
  const shift = scrollShift(g, ring)
  if (shift >= g.width) {
    drawTraceFull(ctx, g, ring, style)
    return
  }
  if (shift > 0) {
    // 'copy' replaces the whole canvas with the shifted image; the clearRect covers
    // implementations that leave the uncovered strip as it was.
    ctx.globalCompositeOperation = 'copy'
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(canvas, -shift, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(g.width - shift, 0, shift, g.height)
  }
  if (ring.length < 2) return
  const oldest = Math.min(1, ring.length - 2)

  ctx.lineJoin = 'round'
  if (style.outline) {
    // Butt caps: a round underlay cap would darken the end of the older, not re-stroked segment.
    ctx.lineCap = 'butt'
    ctx.strokeStyle = OUTLINE_STEP
    ctx.lineWidth = g.outlineWidth
    for (let age = oldest; age >= 0; age--) {
      if (style.clutch) segment(ctx, g, ring, CH_CLUTCH, age)
      segment(ctx, g, ring, CH_THROTTLE, age)
      segment(ctx, g, ring, CH_BRAKE, age)
    }
  }
  ctx.lineCap = 'round'
  if (style.clutch) {
    ctx.strokeStyle = style.colors.clutch
    ctx.lineWidth = g.clutchLineWidth
    for (let age = oldest; age >= 0; age--) segment(ctx, g, ring, CH_CLUTCH, age)
  }
  ctx.lineWidth = g.lineWidth
  ctx.strokeStyle = style.colors.throttle
  for (let age = oldest; age >= 0; age--) segment(ctx, g, ring, CH_THROTTLE, age)
  for (let age = oldest; age >= 0; age--) {
    ctx.strokeStyle = brakeColor(ring, age, style.colors)
    segment(ctx, g, ring, CH_BRAKE, age)
  }
}
