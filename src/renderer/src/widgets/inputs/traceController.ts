/**
 * Drives the pedal trace: owns the sample ring and the geometry, decides between a full
 * redraw and an incremental step, and turns each payload's SessionTime into a position. Plain
 * state outside Vue reactivity, no timers and no animation frames: it draws at most once per
 * call, so nothing runs while no payload arrives.
 */
import { fillPreview } from './readout'
import {
  CH_ABS,
  CH_BRAKE,
  CH_CLUTCH,
  CH_THROTTLE,
  SampleRing,
  clampTraceSeconds,
  drawTraceFull,
  drawTraceStep,
  ringCapacity,
  traceGeometry,
  type TraceColors,
  type TraceContext,
  type TraceGeometry,
  type TraceStyle
} from './trace'

/** Two samples closer than this (s) share a time: the newer one replaces the older. */
export const SAME_TIME_S = 1e-4

export interface TraceSample {
  /** SessionTime (s); a non-finite value reads as one period after the previous sample. */
  readonly t: number
  readonly throttle: number
  readonly brake: number
  readonly clutch: number
  readonly abs: boolean
}

export interface TraceSettings {
  readonly seconds: number
  /** Pedal line width, CSS px. */
  readonly lineCss: number
  readonly clutch: boolean
  readonly outline: boolean
  readonly colors: TraceColors
}

/** The canvas element as the controller uses it (its backing store and itself as a blit source). */
export type TraceCanvas = CanvasImageSource & { width: number; height: number }

export class TraceController {
  private ring: SampleRing
  private settings: TraceSettings
  private style: TraceStyle
  private canvas: TraceCanvas | null = null
  private ctx: TraceContext | null = null
  private size = { w: 0, h: 0, dpr: 1 }
  private geom: TraceGeometry | null = null
  /** The canvas no longer matches the ring: the next draw is a full one. */
  private dirty = true

  constructor(
    private readonly hz: number,
    settings: TraceSettings
  ) {
    this.settings = settings
    this.style = styleOf(settings)
    this.ring = new SampleRing(ringCapacity(settings.seconds, hz))
  }

  /** Samples held (for tests and the preview). */
  get samples(): SampleRing {
    return this.ring
  }

  /**
   * A new canvas, or none (no trace in this layout). A canvas re-created in the same place gets
   * the last known size at once: its ResizeObserver does not report an unchanged size again.
   * Otherwise nothing is drawn until `resize`.
   */
  attach(canvas: TraceCanvas | null, ctx: TraceContext | null): void {
    if (canvas === this.canvas && ctx === this.ctx) return
    this.canvas = canvas
    this.ctx = canvas === null ? null : ctx
    this.dirty = true
    const { w, h } = this.size
    if (canvas === null || w <= 0 || h <= 0) return
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    this.redraw()
  }

  /** Size of the canvas in device px (ResizeObserver); resizing clears the backing store. */
  resize(w: number, h: number, dpr: number): void {
    const canvas = this.canvas
    if (canvas === null || w <= 0 || h <= 0) return
    const s = this.size
    if (w === s.w && h === s.h && dpr === s.dpr) return
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    this.size = { w, h, dpr }
    this.updateGeometry()
    this.redraw()
  }

  /** New options; redraws when anything that is drawn changed. */
  configure(next: TraceSettings): void {
    const prev = this.settings
    if (sameSettings(prev, next)) return
    this.settings = next
    this.style = styleOf(next)
    if (prev.seconds !== next.seconds) {
      this.ring = this.ring.resized(ringCapacity(next.seconds, this.hz))
    }
    if (prev.seconds !== next.seconds || prev.lineCss !== next.lineCss) this.updateGeometry()
    this.redraw()
  }

  /** Starts a fresh trace (back in the car); the canvas is cleared by the next draw. */
  reset(): void {
    this.ring.clear()
    this.dirty = true
  }

  /** One live sample, drawn at once. */
  push(s: TraceSample): void {
    const ring = this.ring
    const prev = ring.length > 0 ? ring.timeAt(0) : NaN
    const t = Number.isFinite(s.t) ? s.t : Number.isFinite(prev) ? prev + 1 / this.hz : 0
    if (ring.length > 0) {
      const dt = t - prev
      if (dt < -SAME_TIME_S || dt > clampTraceSeconds(this.settings.seconds)) {
        // Back in time (new session, replay) or a gap longer than the plot: start over.
        ring.clear()
        this.dirty = true
      } else if (dt < SAME_TIME_S) {
        // Same time (sim paused): replace, so a paused stream cannot flush the history.
        if (!sameValues(ring, s)) {
          ring.setNewest(s.throttle, s.brake, s.clutch, s.abs)
          this.redraw()
        }
        return
      }
    }
    ring.push(t, s.throttle, s.brake, s.clutch, s.abs)
    this.draw()
  }

  /** The edit-mode sample, drawn at once. */
  preview(): void {
    fillPreview(this.ring, clampTraceSeconds(this.settings.seconds), this.hz)
    this.redraw()
  }

  private updateGeometry(): void {
    const { w, h, dpr } = this.size
    this.geom =
      w > 0 && h > 0 ? traceGeometry(w, h, dpr, this.settings.seconds, this.settings.lineCss) : null
  }

  private redraw(): void {
    if (this.ctx === null || this.geom === null) {
      this.dirty = true
      return
    }
    drawTraceFull(this.ctx, this.geom, this.ring, this.style)
    this.dirty = false
  }

  private draw(): void {
    if (this.dirty || this.ctx === null || this.geom === null || this.canvas === null) {
      this.redraw()
    } else {
      drawTraceStep(this.ctx, this.canvas, this.geom, this.ring, this.style)
    }
  }
}

function styleOf(s: TraceSettings): TraceStyle {
  return { clutch: s.clutch, outline: s.outline, colors: s.colors }
}

function sameSettings(a: TraceSettings, b: TraceSettings): boolean {
  return (
    a.seconds === b.seconds &&
    a.lineCss === b.lineCss &&
    a.clutch === b.clutch &&
    a.outline === b.outline &&
    a.colors.throttle === b.colors.throttle &&
    a.colors.brake === b.colors.brake &&
    a.colors.abs === b.colors.abs &&
    a.colors.clutch === b.colors.clutch
  )
}

/** The newest sample already holds these values (compared as the ring stores them). */
function sameValues(ring: SampleRing, s: TraceSample): boolean {
  return (
    ring.at(0, CH_THROTTLE) === Math.fround(s.throttle) &&
    ring.at(0, CH_BRAKE) === Math.fround(s.brake) &&
    ring.at(0, CH_CLUTCH) === Math.fround(s.clutch) &&
    ring.at(0, CH_ABS) === (s.abs ? 1 : 0)
  )
}
