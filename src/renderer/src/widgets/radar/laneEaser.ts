/**
 * Lateral easing of the radar's cars. The provider (shared/radar.ts) puts every car in a whole
 * lane, so a car coming alongside (CarLeftRight) or a held side car back in your lane once
 * RADAR.sideHoldS runs out would jump a full lane in one frame. Here its x slides towards the
 * lane instead: exponentially, frame-rate independent, 95 % of the way in 3 LANE_TAU_MS. Only x:
 * y, opacity, colour step and glow stay exactly as computed, so the radar never lags the real
 * gap, and a car alongside glows from the first frame.
 *
 * Plain state outside Vue's reactivity, advanced once per set of marks the widget computes (each
 * payload, 60 Hz while the radar shows: no timer or rAF of its own). Settled, a frame costs one
 * map lookup per car and hands its input back untouched; while a car slides only that car gets a
 * new mark (its x and transform), every other mark keeps its object, and so its v-memo hit.
 */
import { markTransform, roundSteps, type CarMark } from './geometry'

/** Time constant (ms): 63 % of the way after one, 95 % after three (165 ms). */
export const LANE_TAU_MS = 55
/**
 * A gap between two frames counts as at most this long (ms), and a clock going back as none.
 * A lane change first seen after a stall (a paused or throttled window) still slides rather
 * than landing in one step, and no slide ever depends on how long nothing was drawn.
 */
export const LANE_MAX_STEP_MS = 100
/** Within this of its lane (SVG units, ~0.1 px), a car is put on it and its slide ends. */
export const LANE_SNAP_UNITS = 0.05

export interface LaneEaserOptions {
  tauMs?: number
  maxStepMs?: number
  /** Steps per unit a sliding x is rounded to: toCarMarks' MarkPrecision.pos (0 = exact). */
  posSteps?: number
  snapUnits?: number
}

/** What the easer remembers of a car (one object per car while it is on the radar). */
interface Slot {
  /** Where the car is drawn, unrounded (SVG units). */
  x: number
  /** The ease() call that last saw this key. */
  seen: number
}

/** `m` drawn at `x`, everything else as computed. */
function slid(m: CarMark, x: number): CarMark {
  return {
    key: m.key,
    x,
    y: m.y,
    transform: markTransform(x, m.y),
    bucket: m.bucket,
    classColor: m.classColor,
    overlapping: m.overlapping,
    unsided: m.unsided,
    opacity: m.opacity
  }
}

export class LaneEaser {
  private readonly tauMs: number
  private readonly maxStepMs: number
  private readonly posSteps: number
  private readonly snapUnits: number
  /** By mark key (carIdx, or the phantom's lane key): only the cars of the last frame. */
  private readonly slots = new Map<string, Slot>()
  private lastMs: number | null = null
  private frame = 0
  /** Forgets the cars the current frame no longer draws. Built once, not per frame. */
  private readonly dropUnseen = (slot: Slot, key: string): void => {
    if (slot.seen !== this.frame) this.slots.delete(key)
  }

  constructor(o: LaneEaserOptions = {}) {
    this.tauMs = o.tauMs ?? LANE_TAU_MS
    this.maxStepMs = o.maxStepMs ?? LANE_MAX_STEP_MS
    this.posSteps = o.posSteps ?? 0
    this.snapUnits = o.snapUnits ?? LANE_SNAP_UNITS
  }

  /** Cars remembered: those of the last frame. */
  get size(): number {
    return this.slots.size
  }

  /** Forgets every car and the clock: the next frame draws every car straight at its lane. */
  reset(): void {
    this.slots.clear()
    this.lastMs = null
  }

  /**
   * `marks` with each car's x eased towards its lane at `nowMs` (any ms clock, e.g.
   * performance.now()). A car seen for the first time is drawn at its lane at once. Returns
   * `marks` itself when no car is between lanes.
   */
  ease(marks: readonly CarMark[], nowMs: number): readonly CarMark[] {
    const k = this.blend(nowMs)
    const frame = ++this.frame
    let seen = 0
    let out: CarMark[] | null = null
    for (let i = 0; i < marks.length; i++) {
      const m = marks[i]
      if (m === undefined) continue
      const slot = this.slots.get(m.key)
      if (slot === undefined) {
        // First sight (or back after leaving the radar): at its lane, no slide in.
        this.slots.set(m.key, { x: m.x, seen: frame })
        seen++
        continue
      }
      if (slot.seen !== frame) {
        slot.seen = frame
        seen++
      }
      if (slot.x === m.x) continue
      if (!Number.isFinite(slot.x) || !Number.isFinite(m.x)) {
        // Nothing to slide from or to (a lane that is not a number): drawn as computed, so a
        // NaN neither sticks to the car once its lane is valid again nor costs a mark per frame.
        slot.x = m.x
        continue
      }
      const x = slot.x + (m.x - slot.x) * k
      slot.x = Math.abs(m.x - x) <= this.snapUnits ? m.x : x
      const drawnX = roundSteps(slot.x, this.posSteps)
      if (drawnX === m.x) continue
      out ??= marks.slice()
      out[i] = slid(m, drawnX)
    }
    // Keys are unique per frame: more slots than cars seen means some left the radar.
    if (this.slots.size > seen) this.slots.forEach(this.dropUnseen)
    return out ?? marks
  }

  /** Share of the remaining way covered since the last frame: 0 on the first one. */
  private blend(nowMs: number): number {
    if (!Number.isFinite(nowMs)) return 0
    const last = this.lastMs
    this.lastMs = nowMs
    if (last === null) return 0
    const dt = Math.min(nowMs - last, this.maxStepMs)
    return dt > 0 ? 1 - Math.exp(-dt / this.tauMs) : 0
  }
}
