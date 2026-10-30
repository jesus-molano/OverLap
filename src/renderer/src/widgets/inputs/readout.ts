/**
 * Numeric readouts of the inputs widget (bars, gear, speed, steering) and the edit-mode
 * preview. The 60 Hz path writes the DOM directly through the slots below, outside Vue's
 * render, and only when the shown value changes.
 */
import { formatSpeed } from '@shared/format'
import { clamp, clamp01 } from '@shared/num'
import type { AppearanceSettings, InputsData } from '@shared/types'
import type { SampleRing } from './trace'

/** 0..1 pedal to a whole percentage (NaN reads as 0). */
export function pedalPercent(v: number): number {
  return Math.round(clamp01(v) * 100)
}

/** 'R', 'N', '1'.. */
export function gearLabel(gear: number): string {
  if (!Number.isFinite(gear)) return 'N'
  const g = Math.round(gear)
  if (g < 0) return 'R'
  return g === 0 ? 'N' : String(g)
}

/** How the gear is drawn: neutral muted, reverse as a warning, forward gears plain. */
export function gearKind(gear: number): 'neutral' | 'reverse' | 'forward' {
  const l = gearLabel(gear)
  return l === 'N' ? 'neutral' : l === 'R' ? 'reverse' : 'forward'
}

/** Whole speed in the chosen units ('166'). */
export function speedLabel(kmh: number, units: AppearanceSettings['units'] = 'metric'): string {
  return formatSpeed(kmh, units)
}

/** Bar fill: scaleY of the 0..1 pedal, two decimals (the payload is quantised to 0.01). */
export function barTransform(v: number): string {
  return `scaleY(${pedalPercent(v) / 100})`
}

/** -1..1 steering; anything else reads as straight ahead. */
function steeringRatio(steering: number): number {
  return Number.isFinite(steering) ? clamp(steering, -1, 1) : 0
}

/**
 * Steering bar fill, anchored at the centre and growing towards the side the wheel turns:
 * positive steering is left, so it is mirrored (negative scaleX).
 */
export function steerTransform(steering: number): string {
  const k = Math.round(-steeringRatio(steering) * 100) / 100 || 0
  return `scaleX(${k})`
}

// ---------------------------------------------------------------------------
// Strings of the 60 Hz readouts, built once per value: a new sample allocates nothing.
// ---------------------------------------------------------------------------

/** The widest wheel angle the cache holds (degrees each way): no car turns further. */
export const MAX_WHEEL_DEG = 1440

/** A string per whole number in [-max, max], built on first use. */
class StringTable {
  private readonly cells: (string | undefined)[]

  constructor(
    private readonly max: number,
    private readonly build: (n: number) => string
  ) {
    this.cells = new Array<string | undefined>(2 * max + 1)
  }

  get(n: number): string {
    const k = Number.isFinite(n) ? Math.round(n) : 0
    const i = (k > this.max ? this.max : k < -this.max ? -this.max : k) + this.max
    return (this.cells[i] ??= this.build(i - this.max || 0))
  }
}

const ROTATIONS = new StringTable(MAX_WHEEL_DEG, (deg) => `rotate(${-deg || 0}deg)`)

/**
 * The wheel's rotation for its angle (whole degrees, positive = left): left turns it
 * anticlockwise, like the real one, as far as the car's lock (the payload's angle is within it).
 */
export function wheelRotation(deg: number): string {
  return ROTATIONS.get(deg)
}

const DEGREES = new StringTable(MAX_WHEEL_DEG, (deg) =>
  deg > 0 ? `‹ ${deg}°` : deg < 0 ? `${-deg}° ›` : '0°'
)

/** The wheel's angle as read under it: '‹ 45°' turning left, '45° ›' right, '0°' straight. */
export function degreesLabel(deg: number): string {
  return DEGREES.get(deg)
}

/** Revs to the ten (the last digit would only flicker), up to 25 000. */
const RPM_TENS = new StringTable(2500, (tens) => String(Math.max(0, tens) * 10))

/** '7450'; 0 or unknown read '0'. */
export function rpmLabel(rpm: number): string {
  return RPM_TENS.get(Number.isFinite(rpm) && rpm > 0 ? rpm / 10 : 0)
}

/** '54.5': the bias as the car shows it (built only when it changes, NumberSlot). */
export function biasLabel(bias: number): string {
  return Number.isFinite(bias) ? bias.toFixed(1) : ''
}

/** The TC setting, whole. */
export function tcLabel(tc: number): string {
  return Number.isFinite(tc) ? String(Math.round(tc)) : ''
}

const PERCENT = new StringTable(100, (p) => String(Math.max(0, p)))

/** The force feedback in whole percent of its maximum ('100' when clipping). */
export function ffbLabel(ffb: number): string {
  return PERCENT.get(pedalPercent(ffb))
}

// ---------------------------------------------------------------------------
// DOM slots: the last value written to one element. A new element (re-created by a v-if)
// always gets written, so toggling a readout never shows a stale value; a removed one (null)
// is let go, so no detached node is kept.
// ---------------------------------------------------------------------------

export class TextSlot {
  private el: { textContent: string | null } | null = null
  private value = ''

  set(el: { textContent: string | null } | null, value: string): void {
    if (el === null) {
      this.el = null
      return
    }
    if (el === this.el && value === this.value) return
    el.textContent = value
    this.el = el
    this.value = value
  }
}

export class TransformSlot {
  private el: { style: { transform: string } } | null = null
  private value = ''

  set(el: { style: { transform: string } } | null, value: string): void {
    if (el === null) {
      this.el = null
      return
    }
    if (el === this.el && value === this.value) return
    el.style.transform = value
    this.el = el
    this.value = value
  }
}

/**
 * A number shown as text, formatted only when it changes (a new element always gets written):
 * a readout that changes now and then builds its string only then. `format` is a module
 * function, not a closure per call.
 */
export class NumberSlot {
  private el: { textContent: string | null } | null = null
  private value = Number.NaN

  constructor(private readonly format: (n: number) => string) {}

  set(el: { textContent: string | null } | null, value: number): void {
    if (el === null) {
      this.el = null
      return
    }
    if (el === this.el && Object.is(value, this.value)) return
    el.textContent = this.format(value)
    this.el = el
    this.value = value
  }
}

export class ClassSlot {
  private el: { classList: { toggle(token: string, force?: boolean): boolean } } | null = null
  private on = false

  constructor(private readonly token: string) {}

  set(
    el: { classList: { toggle(token: string, force?: boolean): boolean } } | null,
    on: boolean
  ): void {
    if (el === null) {
      this.el = null
      return
    }
    if (el === this.el && on === this.on) return
    el.classList.toggle(this.token, on)
    this.el = el
    this.on = on
  }
}

// ---------------------------------------------------------------------------
// Edit-mode preview: a braking zone, oldest on the left, ending mid trail-brake.
// ---------------------------------------------------------------------------

export const PREVIEW_READOUT: Readonly<InputsData> = Object.freeze({
  throttle: 0.15,
  brake: 0.3,
  clutch: 0,
  steering: 0.35,
  gear: 3,
  speedKmh: 112,
  abs: false,
  active: true,
  t: 0,
  // Turning in, the revs a little past half the lights, a GT3's bias and TC.
  steeringDeg: 60,
  rpm: 6900,
  slFirst: 5800,
  slShift: 7400,
  slLast: 7600,
  slBlink: 7800,
  brakeBias: 54.5,
  tc: 4,
  ffb: 0.72,
  ffbClip: false
})

/** Linear from v0 at t0 to v1 at t1, flat outside. */
function ramp(t: number, t0: number, t1: number, v0: number, v1: number): number {
  if (t <= t0) return v0
  if (t >= t1) return v1
  return v0 + ((t - t0) / (t1 - t0)) * (v1 - v0)
}

/** Triangle of height `peak` centred on `c`, `w` wide on each side. */
function blip(t: number, c: number, w: number, peak: number): number {
  return Math.max(0, peak * (1 - Math.abs(t - c) / w))
}

const q = (v: number): number => Math.round(clamp01(v) * 100) / 100

export interface PreviewSample {
  throttle: number
  brake: number
  clutch: number
  abs: boolean
}

/** Preview inputs at `t` (0 = oldest, 1 = newest = PREVIEW_READOUT). */
export function previewSample(t: number): PreviewSample {
  const throttle = t < 0.9 ? ramp(t, 0.45, 0.48, 1, 0) : ramp(t, 0.9, 1, 0, 0.15)
  // Stomp, short hold (ABS), long trail.
  const brake =
    t >= 0.62
      ? ramp(t, 0.62, 1, 0.8, 0.3)
      : t >= 0.5
        ? ramp(t, 0.5, 0.62, 0.92, 0.8)
        : ramp(t, 0.46, 0.5, 0, 0.92)
  // Two heel-and-toe downshifts.
  const clutch = blip(t, 0.56, 0.02, 0.85) + blip(t, 0.66, 0.02, 0.85)
  return { throttle: q(throttle), brake: q(brake), clutch: q(clutch), abs: t >= 0.52 && t < 0.58 }
}

/** One preview corner (previewSample from 0 to 1), in seconds: the default trace's length. */
export const PREVIEW_CORNER_S = 5
/** The exit before it, from the previous corner's trail back to full throttle. */
export const PREVIEW_EXIT_S = 0.8

/**
 * Preview inputs `ageS` seconds before now, in real time: the corner being driven now over the
 * last PREVIEW_CORNER_S, and before it the same corner again, each one joined to the next by its
 * exit (the throttle back to full), so a longer trace shows more of the lap instead of the same
 * corner stretched, and a shorter one only its end.
 */
export function previewSampleAgo(ageS: number): PreviewSample {
  const a = Math.max(0, ageS)
  if (a <= PREVIEW_CORNER_S) return previewSample(1 - a / PREVIEW_CORNER_S)
  const back = (a - PREVIEW_CORNER_S) % (PREVIEW_CORNER_S + PREVIEW_EXIT_S)
  if (back >= PREVIEW_EXIT_S) {
    return previewSample(1 - (back - PREVIEW_EXIT_S) / PREVIEW_CORNER_S)
  }
  // The exit, newest end first: full throttle where the next corner starts, the trail behind.
  const x = 1 - back / PREVIEW_EXIT_S
  const end = previewSample(1)
  return {
    throttle: q(end.throttle + (1 - end.throttle) * x),
    brake: q(end.brake * (1 - x)),
    clutch: 0,
    abs: false
  }
}

/**
 * Replaces the ring's content with `seconds` of preview samples at `hz`, ending at time
 * PREVIEW_READOUT.t (as many as the ring holds), in real time (previewSampleAgo).
 */
export function fillPreview(ring: SampleRing, seconds: number, hz: number): void {
  ring.clear()
  const rate = Math.max(1, hz)
  const n = Math.max(2, Math.min(Math.round(seconds * rate) + 1, ring.capacity))
  for (let i = 0; i < n; i++) {
    const age = (n - 1 - i) / rate
    const s = previewSampleAgo(age)
    ring.push(PREVIEW_READOUT.t - age, s.throttle, s.brake, s.clutch, s.abs)
  }
}
