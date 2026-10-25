/**
 * What the sim's screen shows besides the car: its UI hidden, the garage screen, the session
 * screen, a replay and the car on camera. Read from the frame on every tick for the global
 * visibility rules (VisibilityOptions) and the replay focus car. Pure, except ReplayPoint, which
 * remembers the last frame to tell a replay of the tape from the live point.
 */
import type { TelemetryFrame } from './telemetry'
import type { HiddenReason, VisibilityOptions } from './types'

/** irsdk_CameraState bits of CamCameraState (mirrors CameraState in @irsdk-node/types). */
export const CameraState = {
  /** The session screen is shown (out of the car: results, chat, the Drive button). */
  IsSessionScreen: 0x1,
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

/** The session screen is shown (CamCameraState 81/83 there, 80/82 in the car). */
export function isSessionScreen(frame: Pick<TelemetryFrame, 'CamCameraState'>): boolean {
  return (cameraBits(frame) & CameraState.IsSessionScreen) !== 0
}

/** The garage screen is open. */
export function isGarageVisible(frame: Pick<TelemetryFrame, 'IsGarageVisible'>): boolean {
  return frame.IsGarageVisible[0] === true
}

/**
 * The replay system is on. Not "these frames are a replay": iRacing sets it on the live session
 * screen too ("Playback: Live"), where SessionTime and every car move on live. ReplayPoint says
 * which of the two it is.
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
 * Where the frames come from:
 * - `none`: no replay, live.
 * - `live`: the replay system at its live point (the session screen, watching any car live):
 *   the frames are live and everything is timed as usual.
 * - `tape`: a replay of the tape, away from the live point: SessionTime and every per-car array
 *   are the tape's (they go back and jump), nothing in them is live.
 */
export type ReplayMode = 'none' | 'live' | 'tape'

export const REPLAY_POINT = {
  /**
   * The tape is this many frames (60 a second) or fewer from its end: still the live point.
   * iRacing reports 0 there; the slack only absorbs a frame or two of lag.
   */
  liveFrames: 60,
  /** Without ReplayFrameNumEnd: SessionTime going back more than this (s) is the tape... */
  backS: 0.5,
  /** ...and so is SessionTime jumping ahead of the wall clock by more than this (s)... */
  jumpS: 2,
  /** ...or a ReplaySessionTime this far (s) from SessionTime. */
  replayClockS: 2
} as const

type ReplayFrame = Pick<
  TelemetryFrame,
  | 'IsReplayPlaying'
  | 'ReplayFrameNumEnd'
  | 'ReplaySessionNum'
  | 'ReplaySessionTime'
  | 'SessionNum'
  | 'SessionTime'
>

function finite(v: number | undefined): number | null {
  return v !== undefined && Number.isFinite(v) ? v : null
}

/**
 * Tells the live point from the tape, one frame at a time. ReplayFrameNumEnd decides when the
 * var header has it (0 at the live point). Without it, any sign of the tape counts and stays
 * until the replay stops or the session changes: SessionTime going back or jumping ahead of the
 * wall clock, or a ReplaySessionNum / ReplaySessionTime that is not the live session's. Every
 * var is read defensively (missing, NaN): unknown never means the tape.
 */
export class ReplayPoint {
  private lastT: number | null = null
  private lastNum: number | null = null
  private lastMs = 0
  /** Without ReplayFrameNumEnd: the tape was seen since the replay started. */
  private tape = false

  /** `nowMs`: a wall clock in ms (the loop's), for SessionTime jumps. */
  update(frame: ReplayFrame, nowMs: number): ReplayMode {
    const t = finite(frame.SessionTime[0])
    const num = finite(frame.SessionNum[0])
    const prevT = this.lastT
    const sameSession = num === this.lastNum
    const elapsedS = Math.max(0, (nowMs - this.lastMs) / 1000)
    this.lastT = t
    this.lastNum = num
    this.lastMs = nowMs
    if (!isReplayPlaying(frame)) {
      this.tape = false
      return 'none'
    }
    const end = finite(frame.ReplayFrameNumEnd[0])
    if (end !== null) {
      this.tape = false
      return end > REPLAY_POINT.liveFrames ? 'tape' : 'live'
    }
    if (!sameSession) this.tape = false
    if (t !== null && prevT !== null && sameSession) {
      const dt = t - prevT
      if (dt < -REPLAY_POINT.backS || dt > elapsedS + REPLAY_POINT.jumpS) this.tape = true
    }
    const replayNum = finite(frame.ReplaySessionNum[0])
    const replayT = finite(frame.ReplaySessionTime[0])
    if (replayNum !== null && num !== null && replayNum !== num) this.tape = true
    if (replayT !== null && t !== null && Math.abs(replayT - t) > REPLAY_POINT.replayClockS) {
      this.tape = true
    }
    return this.tape ? 'tape' : 'live'
  }

  /** A new connection: nothing seen yet. */
  reset(): void {
    this.lastT = null
    this.lastNum = null
    this.tape = false
  }
}

/**
 * Why the global rules hide a widget now, null when they do not: the garage screen first (it
 * covers the whole sim), then the hidden UI, then the session screen (unless the widget is kept
 * there: `keepOnSessionScreen`), then a replay of the tape with replays set to hide everything.
 * The live point of a replay is live: it hides nothing here.
 */
export function screenHiddenReason(
  opts: VisibilityOptions,
  frame: Pick<TelemetryFrame, 'CamCameraState' | 'IsGarageVisible'>,
  mode: ReplayMode,
  keepOnSessionScreen = false
): HiddenReason | null {
  if (opts.hideInGarage && isGarageVisible(frame)) return 'garage'
  if (opts.hideWithSimUi && isSimUiHidden(frame)) return 'ui-hidden'
  if (opts.hideOnSessionScreen && !keepOnSessionScreen && isSessionScreen(frame)) {
    return 'session-screen'
  }
  if (opts.replays === 'hide' && mode === 'tape') return 'replay'
  return null
}
