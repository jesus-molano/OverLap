import { describe, expect, it } from 'vitest'
import {
  CameraState,
  IN_CAR_HOLD_MS,
  InCarHold,
  REPLAY_POINT,
  ReplayPoint,
  cameraCarIdx,
  isGarageVisible,
  isInCar,
  isReplayPlaying,
  isSessionScreen,
  isSimUiHidden,
  screenHiddenReason,
  type ReplayMode,
  type ScreenFacts
} from './simScreen'
import type { HiddenReason, VisibilityOptions } from './types'

/** Every rule on, the overlay always shown, replays hidden. */
const ALL: VisibilityOptions = {
  showWhen: 'always',
  hideWithSimUi: true,
  hideInGarage: true,
  hideOnSessionScreen: true,
  replays: 'hide',
  showWhileWaiting: false
}

/** The defaults: only in the car, no replays. */
const DEFAULTS: VisibilityOptions = { ...ALL, showWhen: 'car' }

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

/** In the car, live, in a race, unless given. */
function facts(o: Partial<ScreenFacts> = {}): ScreenFacts {
  return { mode: 'none', inCar: true, kind: 'race', ...o }
}

/** Just a mode, in the car in a race. */
const at = (mode: ReplayMode): ScreenFacts => facts({ mode })

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
    expect(screenHiddenReason(ALL, missing, at('none'))).toBeNull()
    expect(screenHiddenReason(DEFAULTS, missing, facts({ inCar: null, kind: null }))).toBeNull()
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

  it('reads IsOnTrack as in the car, unknown when missing', () => {
    expect(isInCar({ IsOnTrack: [true] })).toBe(true)
    expect(isInCar({ IsOnTrack: [false] })).toBe(false)
    expect(isInCar({ IsOnTrack: [] })).toBeNull()
  })
})

describe('InCarHold', () => {
  const IN = { IsOnTrack: [true] }
  const OUT = { IsOnTrack: [false] }

  it('is out at once when you were never in the car (connecting from the garage)', () => {
    const hold = new InCarHold()
    expect(hold.update(OUT, 0)).toBe(false)
    expect(hold.update(IN, 10)).toBe(true)
  })

  it('holds a moment out of the car, then counts you out until you get in again', () => {
    const hold = new InCarHold()
    hold.update(IN, 1000)
    expect(hold.update(OUT, 1016)).toBe(true)
    expect(hold.update(OUT, 1000 + IN_CAR_HOLD_MS - 1)).toBe(true)
    expect(hold.update(OUT, 1000 + IN_CAR_HOLD_MS)).toBe(false)
    expect(hold.update(OUT, 9000)).toBe(false)
    // Getting in shows the overlay on the first frame.
    expect(hold.update(IN, 9016)).toBe(true)
  })

  it('keeps unknown as unknown, without forgetting when you were last in', () => {
    const hold = new InCarHold()
    hold.update(IN, 0)
    expect(hold.update({ IsOnTrack: [] }, 500)).toBeNull()
    expect(hold.update(OUT, 600)).toBe(true)
    expect(hold.update(OUT, IN_CAR_HOLD_MS)).toBe(false)
  })

  it('forgets you were in the car on reset (a new connection)', () => {
    const hold = new InCarHold()
    hold.update(IN, 0)
    hold.reset()
    expect(hold.update(OUT, 10)).toBe(false)
  })
})

describe('screenHiddenReason', () => {
  it('shows everything by default in the car', () => {
    expect(screenHiddenReason(ALL, screen(), at('none'))).toBeNull()
    expect(screenHiddenReason(DEFAULTS, screen(), at('none'))).toBeNull()
  })

  it('names the garage first, then the hidden UI, then the tape, then the session screen', () => {
    const everything = screen({
      IsGarageVisible: [true],
      CamCameraState: [CameraState.UIHidden | CameraState.IsSessionScreen]
    })
    expect(screenHiddenReason(ALL, everything, at('tape'))).toBe('garage')
    expect(screenHiddenReason({ ...ALL, hideInGarage: false }, everything, at('tape'))).toBe(
      'ui-hidden'
    )
    const noUi = { ...ALL, hideInGarage: false, hideWithSimUi: false }
    expect(screenHiddenReason(noUi, everything, at('tape'))).toBe('replay')
    expect(screenHiddenReason({ ...noUi, replays: 'follow' }, everything, at('tape'))).toBe(
      'session-screen'
    )
  })

  it('hides on the session screen unless the widget is kept there (B06)', () => {
    const session = screen({ CamCameraState: [81], IsReplayPlaying: [true] })
    expect(screenHiddenReason(ALL, session, at('live'))).toBe('session-screen')
    expect(screenHiddenReason(ALL, session, at('live'), true)).toBeNull()
    expect(
      screenHiddenReason({ ...ALL, hideOnSessionScreen: false }, session, at('live'))
    ).toBeNull()
  })

  it('never hides at the live point of a replay by itself, even with replays set to hide (Q1)', () => {
    const live = screen({ IsReplayPlaying: [true] })
    expect(screenHiddenReason(ALL, live, at('live'))).toBeNull()
    expect(screenHiddenReason(DEFAULTS, live, at('live'))).toBeNull()
    expect(screenHiddenReason(ALL, live, at('tape'))).toBe('replay')
  })

  it('follows each option: off, or replays that follow the camera, never hide', () => {
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
      expect(screenHiddenReason(off, s, at('tape'))).toBeNull()
      expect(screenHiddenReason(off, s, facts({ mode: 'tape', inCar: false }))).toBeNull()
    }
  })
})

describe('screenHiddenReason: when to show the overlay', () => {
  const sessionScreen = screen({ CamCameraState: [81], IsReplayPlaying: [true] })
  const watching = screen({ IsReplayPlaying: [true], CamCarIdx: [5] })

  it('in the car (the default): hides everything out of it, on any screen', () => {
    expect(screenHiddenReason(DEFAULTS, screen(), facts({ inCar: false }))).toBe('out-of-car')
    // Out of the car on the session screen: out of the car says it, not the session screen.
    expect(screenHiddenReason(DEFAULTS, sessionScreen, facts({ mode: 'live', inCar: false }))).toBe(
      'out-of-car'
    )
    // Watching another car live from out of the car is not driving either.
    expect(screenHiddenReason(DEFAULTS, watching, facts({ mode: 'live', inCar: false }))).toBe(
      'out-of-car'
    )
    // Back in: shown, whatever the session.
    for (const kind of ['practice', 'qualify', 'race', null] as const) {
      expect(screenHiddenReason(DEFAULTS, screen(), facts({ kind }))).toBeNull()
    }
  })

  it('keeps the widgets kept on the session screen there, out of the car (the results)', () => {
    const out = facts({ mode: 'live', inCar: false })
    expect(screenHiddenReason(DEFAULTS, sessionScreen, out, true)).toBeNull()
    // Only on the session screen: watching on camera or in the garage, it hides like the rest.
    expect(screenHiddenReason(DEFAULTS, watching, out, true)).toBe('out-of-car')
    expect(screenHiddenReason(DEFAULTS, screen(), facts({ inCar: false }), true)).toBe('out-of-car')
    // Without the session-screen rule too: the exception is about the car, not only that rule.
    const noRule = { ...DEFAULTS, hideOnSessionScreen: false }
    expect(screenHiddenReason(noRule, sessionScreen, out, true)).toBeNull()
    expect(screenHiddenReason(noRule, sessionScreen, out)).toBe('out-of-car')
  })

  it('with replays following the camera, shows them while you watch from out of the car', () => {
    const follow = { ...DEFAULTS, replays: 'follow' } as const
    expect(screenHiddenReason(follow, watching, facts({ mode: 'live', inCar: false }))).toBeNull()
    expect(screenHiddenReason(follow, watching, facts({ mode: 'tape', inCar: false }))).toBeNull()
    // The session screen still hides all but the kept ones.
    expect(screenHiddenReason(follow, sessionScreen, facts({ mode: 'live', inCar: false }))).toBe(
      'session-screen'
    )
    // No replay system on: out of the car is out of the car.
    expect(screenHiddenReason(follow, screen(), facts({ inCar: false }))).toBe('out-of-car')
  })

  it('hides replays of the tape by default, in or out of the car', () => {
    for (const inCar of [true, false]) {
      expect(screenHiddenReason(DEFAULTS, watching, facts({ mode: 'tape', inCar }))).toBe('replay')
    }
    // Kept on the session screen does not keep anything on the tape.
    expect(
      screenHiddenReason(DEFAULTS, sessionScreen, facts({ mode: 'tape', inCar: false }), true)
    ).toBe('replay')
  })

  it('in races only: hides every other kind of session, first of all', () => {
    const race = { ...DEFAULTS, showWhen: 'race' } as const
    expect(screenHiddenReason(race, screen(), facts({ kind: 'race' }))).toBeNull()
    expect(screenHiddenReason(race, screen(), facts({ kind: 'practice' }))).toBe('not-race')
    expect(screenHiddenReason(race, screen(), facts({ kind: 'qualify' }))).toBe('not-race')
    // Before the garage, out of the car and the session screen: nothing else would show it.
    const garage = screen({ IsGarageVisible: [true] })
    expect(screenHiddenReason(race, garage, facts({ kind: 'practice', inCar: false }))).toBe(
      'not-race'
    )
    expect(screenHiddenReason(race, sessionScreen, facts({ kind: 'qualify' }), true)).toBe(
      'not-race'
    )
    // In a race it is the in-car rule: out of the car hides, the results stay.
    const out = facts({ mode: 'live', kind: 'race', inCar: false })
    expect(screenHiddenReason(race, watching, out)).toBe('out-of-car')
    expect(screenHiddenReason(race, sessionScreen, out, true)).toBeNull()
    // An unknown session kind never hides.
    expect(screenHiddenReason(race, screen(), facts({ kind: null }))).toBeNull()
  })

  it('always: out of the car hides nothing by itself', () => {
    expect(screenHiddenReason(ALL, screen(), facts({ inCar: false }))).toBeNull()
    expect(screenHiddenReason(ALL, watching, facts({ mode: 'live', inCar: false }))).toBeNull()
    expect(screenHiddenReason(ALL, screen(), facts({ inCar: false, kind: 'practice' }))).toBeNull()
  })

  it('never hides for an unknown IsOnTrack', () => {
    for (const showWhen of ['car', 'race'] as const) {
      const o = { ...DEFAULTS, showWhen }
      expect(screenHiddenReason(o, screen(), facts({ inCar: null }))).toBeNull()
    }
  })

  /** [plain widget, a widget kept on the session screen (the standings)] for each choice. */
  type Expected = Partial<
    Record<'car' | 'race' | 'always' | 'follow', [HiddenReason | null, HiddenReason | null]>
  >

  /**
   * The whole state machine, one row per moment of a race weekend: what the sim shows, the
   * replay mode, IsOnTrack (held), the session kind, and the reason for a plain widget and for
   * the standings, with the defaults and with the other choices.
   */
  it('walks a race weekend', () => {
    const garageScreen = screen({ IsGarageVisible: [true], CamCameraState: [81] })
    const rows: [string, Screen, ScreenFacts, Expected][] = [
      [
        'practice, garage open, out of the car',
        garageScreen,
        facts({ kind: 'practice', inCar: false }),
        { car: ['garage', 'garage'], race: ['not-race', 'not-race'], always: ['garage', 'garage'] }
      ],
      [
        'practice, driving',
        screen({ CamCameraState: [80] }),
        facts({ kind: 'practice' }),
        { car: [null, null], race: ['not-race', 'not-race'], always: [null, null] }
      ],
      [
        'race, on the session screen before the start',
        sessionScreen,
        facts({ mode: 'live', kind: 'race', inCar: false }),
        {
          car: ['out-of-car', null],
          race: ['out-of-car', null],
          always: ['session-screen', null],
          follow: ['session-screen', null]
        }
      ],
      [
        'race, driving',
        screen({ CamCameraState: [80] }),
        facts({ kind: 'race' }),
        { car: [null, null], race: [null, null], always: [null, null], follow: [null, null] }
      ],
      [
        'race, out of the car watching the leader live',
        watching,
        facts({ mode: 'live', kind: 'race', inCar: false }),
        {
          car: ['out-of-car', 'out-of-car'],
          race: ['out-of-car', 'out-of-car'],
          always: [null, null],
          follow: [null, null]
        }
      ],
      [
        'race, rewinding the tape',
        watching,
        facts({ mode: 'tape', kind: 'race', inCar: false }),
        {
          car: ['replay', 'replay'],
          race: ['replay', 'replay'],
          always: ['replay', 'replay'],
          follow: [null, null]
        }
      ],
      [
        'race over, results on the session screen',
        sessionScreen,
        facts({ mode: 'live', kind: 'race', inCar: false }),
        { car: ['out-of-car', null], race: ['out-of-car', null], always: ['session-screen', null] }
      ]
    ]
    const options: Record<keyof Expected, VisibilityOptions> = {
      car: DEFAULTS,
      race: { ...DEFAULTS, showWhen: 'race' },
      always: ALL,
      follow: { ...DEFAULTS, replays: 'follow' }
    }
    for (const [name, frame, f, expected] of rows) {
      for (const key of Object.keys(expected) as (keyof Expected)[]) {
        const [plain, kept] = expected[key] ?? [null, null]
        const o = options[key]
        expect([name, key, screenHiddenReason(o, frame, f)]).toEqual([name, key, plain])
        expect([name, key, screenHiddenReason(o, frame, f, true)]).toEqual([name, key, kept])
      }
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
