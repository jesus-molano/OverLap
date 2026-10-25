/**
 * What the sim's screen shows besides the car: its UI hidden, the garage screen open, a
 * replay playing and the car on camera. Read from the frame on every tick for the global
 * visibility rules (VisibilityOptions) and the replay focus car. Pure.
 */
import type { TelemetryFrame } from './telemetry'
import type { HiddenReason, VisibilityOptions } from './types'

/** irsdk_CameraState bits of CamCameraState (mirrors CameraState in @irsdk-node/types). */
export const CameraState = {
  /** The scenic camera is active: there is no focus car. */
  IsScenicActive: 0x2,
  /** The user hid the iRacing UI (Space by default). */
  UIHidden: 0x8
} as const

/** CamCameraState as an unsigned bit field (the SDK sends a signed Int32), 0 when missing. */
function cameraBits(frame: Pick<TelemetryFrame, 'CamCameraState'>): number {
  const v = frame.CamCameraState[0]
  return v === undefined || !Number.isFinite(v) ? 0 : v >>> 0
}

/** The user hid the iRacing UI. */
export function isSimUiHidden(frame: Pick<TelemetryFrame, 'CamCameraState'>): boolean {
  return (cameraBits(frame) & CameraState.UIHidden) !== 0
}

/** The garage screen is open. */
export function isGarageVisible(frame: Pick<TelemetryFrame, 'IsGarageVisible'>): boolean {
  return frame.IsGarageVisible[0] === true
}

/**
 * A replay is playing: the per-car arrays and SessionTime are the replay's, so nothing timed
 * from them is live (SessionTime can go back, or jump, at any tick).
 */
export function isReplayPlaying(frame: Pick<TelemetryFrame, 'IsReplayPlaying'>): boolean {
  return frame.IsReplayPlaying[0] === true
}

/**
 * The CarIdx the camera follows, -1 when it follows nobody (a scenic camera) or the value is
 * missing or not a CarIdx. Not checked against the session: callers decide which cars count.
 */
export function cameraCarIdx(frame: Pick<TelemetryFrame, 'CamCarIdx' | 'CamCameraState'>): number {
  const idx = frame.CamCarIdx[0]
  if (idx === undefined || !Number.isInteger(idx) || idx < 0) return -1
  return (cameraBits(frame) & CameraState.IsScenicActive) !== 0 ? -1 : idx
}

/**
 * Why the global rules hide every widget now, null when they do not: the garage screen first
 * (it covers the whole sim), then the hidden UI, then a replay set to hide everything.
 */
export function screenHiddenReason(
  opts: VisibilityOptions,
  frame: Pick<TelemetryFrame, 'CamCameraState' | 'IsGarageVisible' | 'IsReplayPlaying'>
): HiddenReason | null {
  if (opts.hideInGarage && isGarageVisible(frame)) return 'garage'
  if (opts.hideWithSimUi && isSimUiHidden(frame)) return 'ui-hidden'
  if (opts.replays === 'hide' && isReplayPlaying(frame)) return 'replay'
  return null
}
