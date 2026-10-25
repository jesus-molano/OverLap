/**
 * The pit limiter reminder, for the alerts widget. PlayerTrackSurface ApproachingPits covers the
 * lead-in to pit road, pit road itself and the pit exit, so only the step from the track onto it
 * arms the reminder; pit road ends it (the limiter line takes over there) and nothing re-arms it
 * on the way out. Shown while armed with the limiter off. Pure.
 */
import { TrackLocation } from '../telemetry'

/** One per alerts provider. update() at every compute; resume() after a gap in the computes. */
export class PitEntryReminder {
  private lastSurface: number | null = null
  private armed = false

  resume(): void {
    this.lastSurface = null
    this.armed = false
  }

  /**
   * `surface`: PlayerTrackSurface (irsdk_TrkLoc); `limiterOn`: the EngineWarnings bit, null when
   * unknown (never a false reminder then).
   */
  update(surface: number | undefined, onPitRoad: boolean, limiterOn: boolean | null): boolean {
    const s = surface !== undefined && Number.isFinite(surface) ? surface : null
    if (onPitRoad || s !== TrackLocation.ApproachingPits) this.armed = false
    else if (this.lastSurface === TrackLocation.OnTrack) this.armed = true
    this.lastSurface = s
    return this.armed && limiterOn === false
  }
}
