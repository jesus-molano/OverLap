/**
 * What the sim's screen shows besides the race, once per mock session, so the global
 * visibility rules and replay following show up in mock mode: the iRacing UI hidden for a
 * few seconds, the garage screen open, the session screen (the replay system at its live
 * point, as iRacing has it out of the car), then a replay: first at its live point on the
 * camera of the battle car ahead (live frames), then rewound, on the player's camera (the
 * tape: what was live a little earlier, its clock back, then jumping forward again). Driven by
 * the session clock only, so it is deterministic.
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
  /** [from, to): the session screen, at the replay's live point (IsReplayPlaying, live frames). */
  readonly sessionScreen: readonly [number, number]
  /**
   * From `atS`, for `lengthS`: the first half at the live point with the battle car ahead on
   * camera, the second half the tape, playing back what was live `rewindS` earlier on the
   * player's camera.
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
  sessionScreen: [150, 158],
  replay: { atS: 170, lengthS: 14, rewindS: 20 }
}

/** A live frame is kept for the replay this often (session seconds): enough for 10 Hz widgets. */
const TAPE_STEP_S = 0.1
/** Replay frames per second of the tape (ReplayFrameNumEnd counts them). */
const TAPE_FPS = 60

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
  /** Live frames of the stretch the tape plays back, oldest first (only around it). */
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
    const { uiHidden, garage, sessionScreen, replay } = this.timeline
    const tapeS = replay.atS + replay.lengthS / 2
    const replayEndS = replay.atS + replay.lengthS
    if (s >= tapeS - replay.rewindS && s < tapeS && s >= this.nextSampleS) {
      this.tape.push({ atS: s, frame: live })
      this.nextSampleS = s + TAPE_STEP_S
    }
    if (s >= replay.atS && s < tapeS) {
      // The live point, watching the battle car ahead: live frames.
      return {
        ...live,
        IsReplayPlaying: [true],
        ReplayFrameNumEnd: [0],
        CamCarIdx: [race.cast.battleAhead]
      }
    }
    if (s >= tapeS && s < replayEndS) {
      const sample = this.sampleAt(s - replay.rewindS)
      if (sample) {
        return {
          ...sample.frame,
          IsReplayPlaying: [true],
          ReplayFrameNumEnd: [Math.round(replay.rewindS * TAPE_FPS)],
          CamCarIdx: [race.playerCarIdx]
        }
      }
    } else if (s >= replayEndS && this.tape.length > 0) {
      this.tape = []
    }
    if (within(s, sessionScreen)) {
      return {
        ...live,
        IsReplayPlaying: [true],
        ReplayFrameNumEnd: [0],
        CamCameraState: [CameraState.IsSessionScreen],
        CamCarIdx: [race.playerCarIdx]
      }
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
