/**
 * What the sim's screen shows besides the race, once per mock session, so the global
 * visibility rules and replay following show up in mock mode: the iRacing UI hidden for a
 * few seconds, the garage screen open, then a short replay of what was live a little
 * earlier (its clock goes back, then jumps forward again), on the camera of the battle car
 * ahead and then of the player. Driven by the session clock only, so it is deterministic.
 *
 * MockSource applies it to the frames it hands out; MockRace and MockSeries stay live-only,
 * so their tests and the end-to-end runs read the race as it is driven.
 */
import { CameraState } from '@shared/simScreen'
import type { TelemetryFrame } from '@shared/telemetry'
import { START_SESSION_TIME_S } from './constants'
import type { MockCast } from './field'

/** Seconds since the session started, as MOCK_TIMELINE (scenarios.ts) counts them. */
export interface MockScreenTimeline {
  /** [from, to): the iRacing UI hidden (CamCameraState UIHidden). */
  readonly uiHidden: readonly [number, number]
  /** [from, to): the garage screen open (IsGarageVisible). */
  readonly garage: readonly [number, number]
  /**
   * From `atS`, for `lengthS`, the replay plays back what was live `rewindS` earlier: the
   * battle car ahead on camera for the first half, the player for the second.
   */
  readonly replay: { readonly atS: number; readonly lengthS: number; readonly rewindS: number }
}

/**
 * Early in the session, so mock mode shows it within a few minutes, and clear of the cast's
 * own scripted moments (the meatball at ~26 s, the player's incident at 90 s).
 */
export const MOCK_SCREEN_TIMELINE: MockScreenTimeline = {
  uiHidden: [120, 126],
  garage: [140, 146],
  replay: { atS: 170, lengthS: 14, rewindS: 20 }
}

/** A live frame is kept for the replay this often (session seconds): enough for 10 Hz widgets. */
const TAPE_STEP_S = 0.1

interface Sample {
  readonly atS: number
  readonly frame: TelemetryFrame
}

/** The race the screen belongs to (a MockRace). */
export interface MockScreenRace {
  readonly sessionIndex: number
  readonly sessionTime: number
  readonly playerCarIdx: number
  readonly cast: Pick<MockCast, 'battleAhead'>
}

function within(s: number, [from, to]: readonly [number, number]): boolean {
  return s >= from && s < to
}

export class MockScreen {
  private session = -1
  /** Live frames of the stretch the replay plays back, oldest first (only around it). */
  private tape: Sample[] = []
  private nextSampleS = -Infinity

  constructor(private readonly timeline: MockScreenTimeline = MOCK_SCREEN_TIMELINE) {}

  /**
   * The frame the sim would publish now, given the live one: `live` itself outside the
   * timeline's moments. The frames are kept as they are (nobody writes to them).
   */
  frame(live: TelemetryFrame, race: MockScreenRace): TelemetryFrame {
    if (race.sessionIndex !== this.session) {
      // A new session runs the timeline again.
      this.session = race.sessionIndex
      this.tape = []
      this.nextSampleS = -Infinity
    }
    const s = race.sessionTime - START_SESSION_TIME_S
    const { uiHidden, garage, replay } = this.timeline
    const replayEndS = replay.atS + replay.lengthS
    if (s >= replay.atS - replay.rewindS && s < replay.atS && s >= this.nextSampleS) {
      this.tape.push({ atS: s, frame: live })
      this.nextSampleS = s + TAPE_STEP_S
    }
    if (s >= replay.atS && s < replayEndS) {
      const sample = this.sampleAt(s - replay.rewindS)
      if (sample) {
        const cam = s < replay.atS + replay.lengthS / 2 ? race.cast.battleAhead : race.playerCarIdx
        return { ...sample.frame, IsReplayPlaying: [true], CamCarIdx: [cam] }
      }
    } else if (s >= replayEndS && this.tape.length > 0) {
      this.tape = []
    }
    const uiOff = within(s, uiHidden)
    const inGarage = within(s, garage)
    if (!uiOff && !inGarage) return live
    return {
      ...live,
      CamCameraState: [uiOff ? CameraState.UIHidden : 0],
      IsGarageVisible: [inGarage]
    }
  }

  /** The last kept frame at or before `atS` (the first one before the tape reaches it). */
  private sampleAt(atS: number): Sample | undefined {
    let found = this.tape[0]
    for (const sample of this.tape) {
      if (sample.atS > atS) break
      found = sample
    }
    return found
  }
}
