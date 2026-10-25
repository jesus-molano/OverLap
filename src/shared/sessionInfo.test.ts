import { describe, expect, it } from 'vitest'
import { EMPTY_SESSION } from './session'
import {
  currentSessionType,
  isCarInPits,
  isRaceSession,
  resolveFocusCarIdx,
  resolvePlayerCarIdx,
  ruleHiddenReason,
  sessionKind,
  type VisibilityRule
} from './sessionInfo'
import { CameraState } from './simScreen'
import { TrackLocation } from './telemetry'
import type { DriverEntry, SessionMeta } from './types'

function session(o: Partial<SessionMeta> = {}): SessionMeta {
  const drivers = new Map<number, DriverEntry>(
    [0, 1, 2].map((i) => [i, { carIdx: i } as DriverEntry])
  )
  return {
    ...EMPTY_SESSION,
    playerCarIdx: 1,
    drivers,
    sessionTypes: new Map([
      [0, 'Practice'],
      [1, 'Lone Qualify'],
      [2, 'Race']
    ]),
    ...o
  }
}

describe('resolvePlayerCarIdx', () => {
  it('prefers a telemetry PlayerCarIdx that names a driver', () => {
    expect(resolvePlayerCarIdx({ PlayerCarIdx: [2] }, session())).toBe(2)
  })

  it('falls back to DriverInfo.DriverCarIdx otherwise', () => {
    for (const idx of [[], [7], [-1], [1.5], [Number.NaN], [500]]) {
      expect(resolvePlayerCarIdx({ PlayerCarIdx: idx }, session())).toBe(1)
    }
    expect(resolvePlayerCarIdx({ PlayerCarIdx: [] }, session({ playerCarIdx: -1 }))).toBe(-1)
  })
})

describe('resolveFocusCarIdx', () => {
  /** Live on the player (car 2) unless a replay is playing; camera on `cam`. */
  function focus(replay: boolean, cam: number, cameraState = 0, s = session()): number {
    return resolveFocusCarIdx(
      {
        PlayerCarIdx: [2],
        IsReplayPlaying: [replay],
        CamCarIdx: [cam],
        CamCameraState: [cameraState]
      },
      s
    )
  }

  it('is the player while live, wherever the camera is', () => {
    expect(focus(false, 0)).toBe(2)
  })

  it('is the car on camera while a replay plays, your own car included', () => {
    expect(focus(true, 0)).toBe(0)
    expect(focus(true, 2)).toBe(2)
  })

  it('stays on the player when the camera follows no race car', () => {
    const drivers = new Map<number, DriverEntry>([
      [0, { carIdx: 0 } as DriverEntry],
      [2, { carIdx: 2 } as DriverEntry],
      [3, { carIdx: 3, isSpectator: true } as DriverEntry],
      [64, { carIdx: 64, isPaceCar: true } as DriverEntry],
      [65, { carIdx: 65 } as DriverEntry]
    ])
    const s = session({ drivers, paceCarIdx: 65 })
    // Not in the session, a spectator, the pace car (by flag or by PaceCarIdx).
    for (const cam of [7, 3, 64, 65, -1]) expect(focus(true, cam, 0, s)).toBe(2)
    // A scenic camera has no focus car.
    expect(focus(true, 0, CameraState.IsScenicActive, s)).toBe(2)
  })
})

describe('session type', () => {
  it('reads the type of the current SessionNum', () => {
    expect(currentSessionType({ SessionNum: [2] }, session())).toBe('Race')
    expect(currentSessionType({ SessionNum: [5] }, session())).toBeNull()
    expect(currentSessionType({ SessionNum: [] }, session())).toBeNull()
  })

  it('recognises races', () => {
    expect(isRaceSession('Race')).toBe(true)
    expect(isRaceSession('Heat Race')).toBe(true)
    expect(isRaceSession('Practice')).toBe(false)
    expect(isRaceSession(null)).toBe(false)
  })

  it('classifies session kinds for the visibility rules', () => {
    expect(sessionKind('Race')).toBe('race')
    expect(sessionKind('Lone Qualify')).toBe('qualify')
    expect(sessionKind('Open Qualify')).toBe('qualify')
    expect(sessionKind('Time Trial')).toBe('qualify')
    expect(sessionKind('Practice')).toBe('practice')
    expect(sessionKind('Warmup')).toBe('practice')
    expect(sessionKind('Offline Testing')).toBe('practice')
    expect(sessionKind('')).toBeNull()
    expect(sessionKind(null)).toBeNull()
  })
})

describe('isCarInPits', () => {
  const frame = {
    CarIdxOnPitRoad: [true, false, false],
    CarIdxTrackSurface: [
      TrackLocation.ApproachingPits,
      TrackLocation.InPitStall,
      TrackLocation.OnTrack
    ]
  }
  it('is true on pit road or in the stall', () => {
    expect(isCarInPits(frame, 0)).toBe(true)
    expect(isCarInPits(frame, 1)).toBe(true)
    expect(isCarInPits(frame, 2)).toBe(false)
    expect(isCarInPits(frame, 9)).toBe(false)
    expect(isCarInPits(frame, -1)).toBe(false)
  })
})

describe('ruleHiddenReason', () => {
  const rule = (o: Partial<VisibilityRule> = {}): VisibilityRule => ({
    showIn: { practice: true, qualify: true, race: true },
    hideInPits: false,
    ...o
  })

  it('shows by default and in unknown sessions', () => {
    expect(ruleHiddenReason(rule(), 'race', true)).toBeNull()
    const raceOnly = rule({ showIn: { practice: false, qualify: false, race: true } })
    expect(ruleHiddenReason(raceOnly, null, false)).toBeNull()
    expect(ruleHiddenReason(raceOnly, 'race', false)).toBeNull()
  })

  it('hides outside the selected session kinds, with the kind as the reason code', () => {
    const raceOnly = rule({ showIn: { practice: false, qualify: false, race: true } })
    expect(ruleHiddenReason(raceOnly, 'practice', false)).toBe('practice')
    expect(ruleHiddenReason(raceOnly, 'qualify', false)).toBe('qualify')
    const noRace = rule({ showIn: { practice: true, qualify: true, race: false } })
    expect(ruleHiddenReason(noRace, 'race', false)).toBe('race')
  })

  it('hides in the pits only when asked to', () => {
    expect(ruleHiddenReason(rule({ hideInPits: true }), 'race', true)).toBe('pits')
    expect(ruleHiddenReason(rule({ hideInPits: true }), 'race', false)).toBeNull()
    expect(ruleHiddenReason(rule({ hideInPits: true }), null, true)).toBe('pits')
  })

  it('names the session rule before the pits rule', () => {
    const raceOnly = rule({
      showIn: { practice: false, qualify: false, race: true },
      hideInPits: true
    })
    expect(ruleHiddenReason(raceOnly, 'practice', true)).toBe('practice')
  })
})
