import { describe, expect, it } from 'vitest'
import {
  CameraState,
  cameraCarIdx,
  isGarageVisible,
  isReplayPlaying,
  isSimUiHidden,
  screenHiddenReason
} from './simScreen'
import type { VisibilityOptions } from './types'

const ALL: VisibilityOptions = { hideWithSimUi: true, hideInGarage: true, replays: 'hide' }

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

  it('treats a missing or broken value as "nothing hidden, no replay"', () => {
    const missing = { CamCameraState: [], IsGarageVisible: [], IsReplayPlaying: [], CamCarIdx: [] }
    expect(isSimUiHidden(missing)).toBe(false)
    expect(isGarageVisible(missing)).toBe(false)
    expect(isReplayPlaying(missing)).toBe(false)
    expect(cameraCarIdx(missing)).toBe(-1)
    expect(isSimUiHidden(screen({ CamCameraState: [Number.NaN] }))).toBe(false)
    expect(screenHiddenReason(ALL, missing)).toBeNull()
  })

  it('reads the garage screen and a replay', () => {
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
    expect(screenHiddenReason(ALL, screen())).toBeNull()
  })

  it('names the garage first, then the hidden UI, then a replay', () => {
    const everything = screen({
      IsGarageVisible: [true],
      CamCameraState: [CameraState.UIHidden],
      IsReplayPlaying: [true]
    })
    expect(screenHiddenReason(ALL, everything)).toBe('garage')
    expect(screenHiddenReason({ ...ALL, hideInGarage: false }, everything)).toBe('ui-hidden')
    expect(
      screenHiddenReason({ ...ALL, hideInGarage: false, hideWithSimUi: false }, everything)
    ).toBe('replay')
  })

  it('follows each option: off, or replays that follow the camera, never hide', () => {
    const off: VisibilityOptions = { hideWithSimUi: false, hideInGarage: false, replays: 'follow' }
    for (const s of [
      screen({ IsGarageVisible: [true] }),
      screen({ CamCameraState: [CameraState.UIHidden] }),
      screen({ IsReplayPlaying: [true] })
    ]) {
      expect(screenHiddenReason(off, s)).toBeNull()
    }
  })
})
