import { describe, expect, it } from 'vitest'
import {
  CameraState,
  REPLAY_POINT,
  ReplayPoint,
  cameraCarIdx,
  isGarageVisible,
  isReplayPlaying,
  isSessionScreen,
  isSimUiHidden,
  screenHiddenReason,
  type ReplayMode
} from './simScreen'
import type { VisibilityOptions } from './types'

const ALL: VisibilityOptions = {
  hideWithSimUi: true,
  hideInGarage: true,
  hideOnSessionScreen: true,
  replays: 'hide',
  showWhileWaiting: false
}

interface Screen {
  CamCameraState: number[]
  IsGarageVisible: boolean[]
  IsReplayPlaying: boolean[]
  CamCarIdx: number[]
}

function screen(o: Partial<Screen> = {}): Screen {
  return {
    CamCameraState: [0],
    IsGarageVisible: [false],
    IsReplayPlaying: [false],
    CamCarIdx: [0],
    ...o
  }
}

describe('sim screen state', () => {
  it('reads the hidden UI bit, also from a negative (signed Int32) bit field', () => {
    expect(isSimUiHidden(screen({ CamCameraState: [CameraState.UIHidden] }))).toBe(true)
    expect(isSimUiHidden(screen({ CamCameraState: [0x80000000 | CameraState.UIHidden] }))).toBe(
      true
    )
    expect(isSimUiHidden(screen({ CamCameraState: [0x80000000 | 0x10] }))).toBe(false)
    expect(isSimUiHidden(screen({ CamCameraState: [0x37] }))).toBe(false)
  })

  it('reads the session screen bit: 81/83 on the session screen, 80/82 in the car (B06)', () => {
    for (const v of [81, 83, 0x80000000 | 1]) {
      expect(isSessionScreen(screen({ CamCameraState: [v] }))).toBe(true)
    }
    for (const v of [80, 82, 0])
      expect(isSessionScreen(screen({ CamCameraState: [v] }))).toBe(false)
  })

  it('treats a missing or broken value as "nothing hidden, no replay"', () => {
    const missing = { CamCameraState: [], IsGarageVisible: [], IsReplayPlaying: [], CamCarIdx: [] }
    expect(isSimUiHidden(missing)).toBe(false)
    expect(isSessionScreen(missing)).toBe(false)
    expect(isGarageVisible(missing)).toBe(false)
    expect(isReplayPlaying(missing)).toBe(false)
    expect(cameraCarIdx(missing)).toBe(-1)
    expect(isSimUiHidden(screen({ CamCameraState: [Number.NaN] }))).toBe(false)
    expect(screenHiddenReason(ALL, missing, 'none')).toBeNull()
  })

  it('reads the garage screen and the replay system', () => {
    expect(isGarageVisible(screen({ IsGarageVisible: [true] }))).toBe(true)
    expect(isReplayPlaying(screen({ IsReplayPlaying: [true] }))).toBe(true)
  })

  it('names the car on camera, none on a scenic camera or a value that is not a CarIdx', () => {
    expect(cameraCarIdx(screen({ CamCarIdx: [12] }))).toBe(12)
    expect(
      cameraCarIdx(screen({ CamCarIdx: [12], CamCameraState: [CameraState.IsScenicActive] }))
    ).toBe(-1)
    for (const bad of [-1, 2.5, Number.NaN]) {
      expect(cameraCarIdx(screen({ CamCarIdx: [bad] }))).toBe(-1)
    }
  })
})

describe('screenHiddenReason', () => {
  it('shows everything by default', () => {
    expect(screenHiddenReason(ALL, screen(), 'none')).toBeNull()
  })

  it('names the garage first, then the hidden UI, then the session screen, then the tape', () => {
    const everything = screen({
      IsGarageVisible: [true],
      CamCameraState: [CameraState.UIHidden | CameraState.IsSessionScreen]
    })
    expect(screenHiddenReason(ALL, everything, 'tape')).toBe('garage')
    expect(screenHiddenReason({ ...ALL, hideInGarage: false }, everything, 'tape')).toBe(
      'ui-hidden'
    )
    const noUi = { ...ALL, hideInGarage: false, hideWithSimUi: false }
    expect(screenHiddenReason(noUi, everything, 'tape')).toBe('session-screen')
    expect(screenHiddenReason({ ...noUi, hideOnSessionScreen: false }, everything, 'tape')).toBe(
      'replay'
    )
  })

  it('hides on the session screen unless the widget is kept there (B06)', () => {
    const session = screen({ CamCameraState: [81], IsReplayPlaying: [true] })
    expect(screenHiddenReason(ALL, session, 'live')).toBe('session-screen')
    expect(screenHiddenReason(ALL, session, 'live', true)).toBeNull()
    expect(screenHiddenReason({ ...ALL, hideOnSessionScreen: false }, session, 'live')).toBeNull()
  })

  it('never hides at the live point of a replay, even with replays set to hide (Q1)', () => {
    const live = screen({ IsReplayPlaying: [true] })
    expect(screenHiddenReason(ALL, live, 'live')).toBeNull()
    expect(screenHiddenReason(ALL, live, 'tape')).toBe('replay')
  })

  it('follows each option: off, or replays that keep the standings, never hide', () => {
    const off: VisibilityOptions = {
      ...ALL,
      hideWithSimUi: false,
      hideInGarage: false,
      hideOnSessionScreen: false,
      replays: 'follow'
    }
    for (const s of [
      screen({ IsGarageVisible: [true] }),
      screen({ CamCameraState: [CameraState.UIHidden] }),
      screen({ CamCameraState: [CameraState.IsSessionScreen] }),
      screen({ IsReplayPlaying: [true] })
    ]) {
      expect(screenHiddenReason(off, s, 'tape')).toBeNull()
    }
  })
})

interface ReplayVars {
  IsReplayPlaying: boolean[]
  ReplayFrameNumEnd: number[]
  ReplaySessionNum: number[]
  ReplaySessionTime: number[]
  SessionNum: number[]
  SessionTime: number[]
}

/** IsReplayPlaying on, SessionNum 2 at `t`, the replay vars missing unless given. */
function replayFrame(t: number, o: Partial<ReplayVars> = {}): ReplayVars {
  return {
    IsReplayPlaying: [true],
    ReplayFrameNumEnd: [],
    ReplaySessionNum: [],
    ReplaySessionTime: [],
    SessionNum: [2],
    SessionTime: [t],
    ...o
  }
}

/** Feeds frames 1 s apart on the wall clock; the modes seen. */
function modes(frames: readonly ReplayVars[]): ReplayMode[] {
  const point = new ReplayPoint()
  return frames.map((f, i) => point.update(f, i * 1000))
}

describe('ReplayPoint', () => {
  it('is no replay without IsReplayPlaying', () => {
    expect(modes([replayFrame(1, { IsReplayPlaying: [false] })])).toEqual(['none'])
    expect(modes([replayFrame(1, { IsReplayPlaying: [] })])).toEqual(['none'])
  })

  it('takes the live session screen as live: SessionTime on at 1 s/s, the end of the tape (Q1)', () => {
    // The race, out of the car after the flag: IsReplayPlaying on, the clock on as usual.
    const clock = [920.4, 921.4, 922.4, 923.4]
    expect(modes(clock.map((t) => replayFrame(t)))).toEqual(['live', 'live', 'live', 'live'])
    expect(modes(clock.map((t) => replayFrame(t, { ReplayFrameNumEnd: [0] })))).toEqual([
      'live',
      'live',
      'live',
      'live'
    ])
    // A frame or two of lag at the end of the tape is still the live point.
    expect(modes([replayFrame(1, { ReplayFrameNumEnd: [REPLAY_POINT.liveFrames] })])).toEqual([
      'live'
    ])
  })

  it('takes ReplayFrameNumEnd above the live point as the tape, whatever the clock does', () => {
    expect(
      modes([
        replayFrame(100, { ReplayFrameNumEnd: [0] }),
        replayFrame(101, { ReplayFrameNumEnd: [600] }),
        replayFrame(102, { ReplayFrameNumEnd: [600] }),
        // Back to live: the clock jumps, the tape says live.
        replayFrame(400, { ReplayFrameNumEnd: [0] })
      ])
    ).toEqual(['live', 'tape', 'tape', 'live'])
  })

  it('without ReplayFrameNumEnd, takes the clock going back or jumping as the tape, until the replay stops', () => {
    expect(
      modes([
        replayFrame(100),
        replayFrame(60),
        replayFrame(61),
        replayFrame(62),
        replayFrame(63, { IsReplayPlaying: [false] }),
        replayFrame(64)
      ])
    ).toEqual(['live', 'tape', 'tape', 'tape', 'none', 'live'])
    // Ahead of the wall clock (fast forward, a jump in the tape).
    expect(modes([replayFrame(100), replayFrame(130)])).toEqual(['live', 'tape'])
    // A paused sim (the clock stops) is still live.
    expect(modes([replayFrame(100), replayFrame(100), replayFrame(101)])).toEqual([
      'live',
      'live',
      'live'
    ])
  })

  it('without ReplayFrameNumEnd, reads another session or replay clock as the tape', () => {
    expect(modes([replayFrame(10, { ReplaySessionNum: [1] })])).toEqual(['tape'])
    expect(modes([replayFrame(10, { ReplaySessionNum: [2], ReplaySessionTime: [10.5] })])).toEqual([
      'live'
    ])
    expect(modes([replayFrame(10, { ReplaySessionTime: [400] })])).toEqual(['tape'])
  })

  it('starts over with a new session: its clock going back is not the tape', () => {
    const point = new ReplayPoint()
    expect(point.update(replayFrame(900, { SessionNum: [1] }), 0)).toBe('live')
    expect(point.update(replayFrame(0.1, { SessionNum: [2] }), 1000)).toBe('live')
    expect(point.update(replayFrame(1.1, { SessionNum: [2] }), 2000)).toBe('live')
  })

  it('forgets everything on reset (a new connection)', () => {
    const point = new ReplayPoint()
    point.update(replayFrame(100), 0)
    point.update(replayFrame(50), 1000)
    point.reset()
    expect(point.update(replayFrame(10), 2000)).toBe('live')
  })

  it('ignores broken values: unknown is never the tape', () => {
    expect(
      modes([
        replayFrame(Number.NaN, { ReplayFrameNumEnd: [Number.NaN] }),
        replayFrame(5, { ReplaySessionNum: [Number.NaN], ReplaySessionTime: [Number.NaN] })
      ])
    ).toEqual(['live', 'live'])
  })
})
