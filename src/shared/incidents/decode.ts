/**
 * The player's incident telemetry decoded: PlayerIncidents (irsdk_IncidentFlags: the report in
 * the low byte, the penalty in the next one) and PlayerTrackSurfaceMaterial (irsdk_TrkSurf).
 * Plain numbers mirroring irsdk_defines.h, so the renderer and the mock need no SDK package.
 * Pure.
 */
import type { IncidentKind, IncidentSurface } from '../types'

/** irsdk_IncidentFlags, report byte (only one is ever set). */
export const IncidentReport = {
  None: 0x00,
  /** "Loss of Control (2x)". */
  OutOfControl: 0x01,
  /** "Off Track (1x)". */
  OffTrack: 0x02,
  /** Not currently sent. */
  OffTrackOngoing: 0x03,
  /** "Contact (0x)". */
  ContactWithWorld: 0x04,
  /** "Contact (2x)". */
  CollisionWithWorld: 0x05,
  /** Not currently sent. */
  CollisionWithWorldOngoing: 0x06,
  /** "Car Contact (0x)". */
  ContactWithCar: 0x07,
  /** "Car Contact (4x)". */
  CollisionWithCar: 0x08
} as const

/** irsdk_IncidentFlags, penalty byte. */
export const IncidentPenalty = {
  None: 0x0000,
  ZeroX: 0x0100,
  OneX: 0x0200,
  TwoX: 0x0300,
  FourX: 0x0400
} as const

const REPORT_MASK = 0x00ff
const PENALTY_MASK = 0xff00

const KIND_OF: Readonly<Record<number, IncidentKind>> = {
  [IncidentReport.OutOfControl]: 'loss-of-control',
  [IncidentReport.OffTrack]: 'off-track',
  [IncidentReport.OffTrackOngoing]: 'off-track',
  [IncidentReport.ContactWithWorld]: 'contact-world',
  [IncidentReport.CollisionWithWorld]: 'collision-world',
  [IncidentReport.CollisionWithWorldOngoing]: 'collision-world',
  [IncidentReport.ContactWithCar]: 'contact-car',
  [IncidentReport.CollisionWithCar]: 'collision-car'
}

const POINTS_OF: Readonly<Record<number, number>> = {
  [IncidentPenalty.ZeroX]: 0,
  [IncidentPenalty.OneX]: 1,
  [IncidentPenalty.TwoX]: 2,
  [IncidentPenalty.FourX]: 4
}

export interface DecodedIncident {
  readonly kind: IncidentKind
  /**
   * Points of the penalty byte, null when it holds none we know. Not the points the incident
   * adds (online it read 0x00 for an "Off Track (1x)", 0x0400 for a 1x wall hit): the count says
   * those, and INCIDENT_SEVERITY which report names an incident.
   */
  readonly points: number | null
}

/**
 * How serious each report is, the worst first: hitting a car, hitting the wall, a loss of
 * control, leaving the track, then a light contact (with a car before the wall). Several reports
 * around one incident (an off-track that ends in the wall) name it by the worst.
 */
export const INCIDENT_SEVERITY: Readonly<Record<IncidentKind, number>> = {
  'collision-car': 6,
  'collision-world': 5,
  'loss-of-control': 4,
  'off-track': 3,
  'contact-car': 2,
  'contact-world': 1
}

/** A PlayerIncidents value as an unsigned bit field, 0 when missing or not a number. */
export function incidentBits(raw: number | undefined): number {
  // Bit fields arrive as signed Int32.
  return raw !== undefined && Number.isFinite(raw) ? raw >>> 0 : 0
}

/** What a PlayerIncidents value reports, null when it reports nothing we know. */
export function decodeIncident(raw: number | undefined): DecodedIncident | null {
  const bits = incidentBits(raw)
  const kind = KIND_OF[bits & REPORT_MASK]
  if (kind === undefined) return null
  return { kind, points: POINTS_OF[bits & PENALTY_MASK] ?? null }
}

/** The PlayerIncidents value of `kind` and `points` (the inverse of decodeIncident; the mock). */
export function encodeIncident(report: number, penalty: number): number {
  return (report & REPORT_MASK) | (penalty & PENALTY_MASK)
}

/** irsdk_TrkSurf ranges that are not the racing surface (asphalt, concrete, paint, racing dirt). */
export const TrackMaterial = {
  Asphalt1: 1,
  Rumble1: 11,
  Rumble4: 14,
  Grass1: 15,
  Grass4: 18,
  Dirt1: 19,
  Dirt4: 22,
  Sand: 23,
  Gravel1: 24,
  Gravel2: 25,
  Grasscrete: 26,
  Astroturf: 27
} as const

/** Where the car was off the asphalt (kerb, grass, gravel...), null on the track itself. */
export function incidentSurface(material: number | undefined): IncidentSurface | null {
  if (material === undefined || !Number.isInteger(material)) return null
  const m = TrackMaterial
  if (material >= m.Rumble1 && material <= m.Rumble4) return 'kerb'
  if ((material >= m.Grass1 && material <= m.Grass4) || material === m.Grasscrete) return 'grass'
  if (material >= m.Dirt1 && material <= m.Dirt4) return 'dirt'
  if (material === m.Sand) return 'sand'
  if (material === m.Gravel1 || material === m.Gravel2) return 'gravel'
  if (material === m.Astroturf) return 'astroturf'
  return null
}

/**
 * How far off the track a surface is: the gravel trap tells more than the kerb you crossed on
 * the way there, so the furthest one seen around an incident is the one shown.
 */
export const SURFACE_RANK: Readonly<Record<IncidentSurface, number>> = {
  kerb: 1,
  astroturf: 2,
  grass: 2,
  dirt: 3,
  sand: 3,
  gravel: 3
}
