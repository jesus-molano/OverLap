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

/**
 * Wheel rotation at full lock. The payload is relative to SteeringWheelAngleMax, which it does
 * not carry; half a turn reads as a wheel while the usual corner inputs stay well inside it.
 */
export const WHEEL_LOCK_DEG = 180

/** Steering wheel rotation, whole degrees: positive steering (left) turns it anticlockwise. */
export function wheelTransform(steering: number): string {
  const deg = Math.round(-steeringRatio(steering) * WHEEL_LOCK_DEG) || 0
  return `rotate(${deg}deg)`
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
  t: 0
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

/**
 * Replaces the ring's content with `seconds` of preview samples at `hz`, ending at time
 * PREVIEW_READOUT.t (as many as the ring holds).
 */
export function fillPreview(ring: SampleRing, seconds: number, hz: number): void {
  ring.clear()
  const rate = Math.max(1, hz)
  const n = Math.max(2, Math.min(Math.round(seconds * rate) + 1, ring.capacity))
  for (let i = 0; i < n; i++) {
    const s = previewSample(i / (n - 1))
    ring.push(PREVIEW_READOUT.t - (n - 1 - i) / rate, s.throttle, s.brake, s.clutch, s.abs)
  }
}
