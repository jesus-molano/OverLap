/**
 * Lap references for the delta widget. The all-time personal bests live on
 * disk in the telemetry process (src/telemetry/store/personalBests.ts); this
 * interface is all the shared code sees, so providers stay pure.
 */
import type { SessionMeta } from '../types'

export interface LapReference {
  lapTime: number
  /** RACE_TIMING_LINES + 1 cumulative seconds from the start of the lap (0 .. lapTime). */
  profile: readonly number[]
  /** ISO date of the lap, '' when unknown. */
  recordedAt: string
}

/** Display names of a personal best's car and track layout, '' when unknown. */
export interface PersonalBestLabel {
  /** DriverInfo CarScreenName, e.g. 'Porsche 911 GT3 R (992)'. */
  car: string
  /** WeekendInfo TrackDisplayName, e.g. 'Circuit de Spa-Francorchamps'. */
  track: string
  /** WeekendInfo TrackConfigName, e.g. 'Grand Prix Pits' ('' when the track has one layout). */
  layout: string
}

/** A car + track layout a personal best belongs to. */
export interface PersonalBestTarget extends PersonalBestLabel {
  /** personalBestKey(): '67@219/Grand Prix'. */
  key: string
}

/** One stored personal best as the settings window lists it (no profile). */
export interface PersonalBestSummary extends PersonalBestTarget {
  lapTime: number
  recordedAt: string
}

/** What the settings window shows: every stored best and what you are driving now. */
export interface PersonalBestList {
  /** Newest first. */
  entries: PersonalBestSummary[]
  /** The car + layout of the current session; null when not in one (or it is unknown). */
  current: PersonalBestTarget | null
}

export interface PersonalBestStore {
  /** All-time best for this key, null when none. Synchronous: the store is loaded at startup. */
  get(key: string): LapReference | null
  /**
   * Offers a completed clean lap. Returns true when it became the new best
   * (the store persists it asynchronously, atomically, without blocking the loop).
   * `label` names the car and layout in the settings window's list.
   */
  offer(key: string, lap: LapReference, label?: PersonalBestLabel): boolean
}

/** In-memory store for tests and when no data directory is available. */
export function createMemoryStore(): PersonalBestStore {
  const bests = new Map<string, LapReference>()
  return {
    get: (key) => bests.get(key) ?? null,
    offer: (key, lap) => {
      const cur = bests.get(key)
      if (cur && cur.lapTime <= lap.lapTime) return false
      bests.set(key, lap)
      return true
    }
  }
}

/**
 * Key of the player's personal best: car model + track + layout, e.g.
 * '67@219/Grand Prix'. null when the car or track is unknown.
 */
export function personalBestKey(session: SessionMeta, playerCarIdx: number): string | null {
  const car = session.drivers.get(playerCarIdx)?.carId ?? 0
  if (car <= 0 || session.trackId <= 0) return null
  return `${car}@${session.trackId}/${session.trackConfig}`
}

/** The key and display names of the player's personal best; null when the key is unknown. */
export function personalBestTarget(
  session: SessionMeta,
  playerCarIdx: number
): PersonalBestTarget | null {
  const key = personalBestKey(session, playerCarIdx)
  if (key === null) return null
  return {
    key,
    car: session.drivers.get(playerCarIdx)?.carName ?? '',
    track: session.trackName,
    layout: session.trackConfig
  }
}

/** Longest key the store accepts (a car id, a track id and a layout name). */
export const MAX_PERSONAL_BEST_KEY_LENGTH = 200
/** Most keys one delete may name (the store keeps at most 500). */
export const MAX_DELETE_KEYS = 1000

/** Validates an untrusted list of keys to delete: 1..MAX_DELETE_KEYS non-empty strings. */
export function isPersonalBestKeys(v: unknown): v is string[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.length <= MAX_DELETE_KEYS &&
    v.every(
      (k) => typeof k === 'string' && k.length > 0 && k.length <= MAX_PERSONAL_BEST_KEY_LENGTH
    )
  )
}

export function sameTarget(a: PersonalBestTarget | null, b: PersonalBestTarget | null): boolean {
  if (a === null || b === null) return a === b
  return a.key === b.key && a.car === b.car && a.track === b.track && a.layout === b.layout
}
