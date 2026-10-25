/**
 * Per-tick facts every provider needs, defined once: who the player is (and which car a
 * replay follows), the type of the current session and the "Mostrar en" / "Ocultar en
 * boxes" visibility rules. Pure.
 */
import { cameraCarIdx, isReplayPlaying } from './simScreen'
import { MAX_CARS, TrackLocation } from './telemetry'
import type { TelemetryFrame } from './telemetry'
import type { HiddenReason, SessionMeta, ShowInSessions } from './types'

/** Session kinds of the visibility rules. */
export type SessionKind = keyof ShowInSessions

export interface VisibilityRule {
  showIn: ShowInSessions
  hideInPits: boolean
}

const RACE_RE = /race/i
const QUALIFY_RE = /qualif|time ?trial/i
const LONE_RE = /^\s*lone\b/i

/**
 * The player's CarIdx: telemetry PlayerCarIdx when it names a driver of the
 * session, else DriverInfo.DriverCarIdx (-1 when unknown).
 */
export function resolvePlayerCarIdx(
  frame: Pick<TelemetryFrame, 'PlayerCarIdx'>,
  session: Pick<SessionMeta, 'drivers' | 'playerCarIdx'>
): number {
  const idx = frame.PlayerCarIdx[0]
  if (
    idx !== undefined &&
    Number.isInteger(idx) &&
    idx >= 0 &&
    idx < MAX_CARS &&
    session.drivers.has(idx)
  ) {
    return idx
  }
  return session.playerCarIdx
}

/**
 * The car the widgets are about: the one on camera while the replay system is on (when it is
 * a race car of the session: not the pace car, a spectator or a scenic camera), the player
 * otherwise. The one seam for following the camera: the RaceModel's playerCarIdx and the
 * providers that can follow any car resolve it here; the ones that only have the player's
 * own data (pedals, flags, the delta) keep resolvePlayerCarIdx and hide while it is another
 * car. Only live frames get here (the live point of a replay): the tape is never fed.
 */
export function resolveFocusCarIdx(
  frame: Pick<TelemetryFrame, 'PlayerCarIdx' | 'IsReplayPlaying' | 'CamCarIdx' | 'CamCameraState'>,
  session: Pick<SessionMeta, 'drivers' | 'playerCarIdx' | 'paceCarIdx'>
): number {
  if (isReplayPlaying(frame)) {
    const cam = cameraCarIdx(frame)
    const d = cam < MAX_CARS ? session.drivers.get(cam) : undefined
    if (d && !d.isPaceCar && !d.isSpectator && cam !== session.paceCarIdx) return cam
  }
  return resolvePlayerCarIdx(frame, session)
}

/** SessionType of the session being driven ("Race", "Lone Qualify", ...), null when unknown. */
export function currentSessionType(
  frame: Pick<TelemetryFrame, 'SessionNum'>,
  session: Pick<SessionMeta, 'sessionTypes'>
): string | null {
  const num = frame.SessionNum[0]
  return num === undefined ? null : (session.sessionTypes.get(num) ?? null)
}

/** "Race", "Heat Race", ... */
export function isRaceSession(type: string | null): boolean {
  return type !== null && RACE_RE.test(type)
}

/**
 * "Lone Qualify", "Lone Practice": you are alone on track, and the other cars in the telemetry
 * are on track in their own runs, not with you (iRacing's spotter, CarLeftRight, ignores them).
 */
export function isLoneSession(type: string | null): boolean {
  return type !== null && LONE_RE.test(type)
}

/**
 * Kind of a SessionType for the visibility rules: race, qualify (qualifying
 * and time trial), practice (everything else: practice, warmup, testing).
 * Null when the type is unknown.
 */
export function sessionKind(type: string | null): SessionKind | null {
  if (type === null || type.trim() === '') return null
  if (RACE_RE.test(type)) return 'race'
  if (QUALIFY_RE.test(type)) return 'qualify'
  return 'practice'
}

/** On pit road or in its pit stall (false for an unknown car). */
export function isCarInPits(
  frame: Pick<TelemetryFrame, 'CarIdxOnPitRoad' | 'CarIdxTrackSurface'>,
  carIdx: number
): boolean {
  if (carIdx < 0) return false
  return (
    frame.CarIdxOnPitRoad[carIdx] === true ||
    frame.CarIdxTrackSurface[carIdx] === TrackLocation.InPitStall
  )
}

/**
 * Why a rule hides its widget right now, as a code (each window words it for
 * the edit-mode preview with hiddenText in @shared/i18n), null when the
 * widget is shown. An unknown session kind never hides: better a widget too
 * many than one missing.
 */
export function ruleHiddenReason(
  rule: VisibilityRule,
  kind: SessionKind | null,
  playerInPits: boolean
): HiddenReason | null {
  if (kind !== null && !rule.showIn[kind]) return kind
  if (rule.hideInPits && playerInPits) return 'pits'
  return null
}
