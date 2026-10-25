import { describe, expect, it } from 'vitest'
import { makeDriver, makeFrame, makeSession } from '@shared/race/testing/raceSim'
import type { MutableFrame } from '@shared/race/testing/raceSim'
import { CameraState } from '@shared/simScreen'
import { TrackLocation } from '@shared/telemetry'
import type { HiddenReason, SessionMeta, TelemetryConfig, VisibilityOptions } from '@shared/types'
import { WIDGET_IDS, followsCamera, type WidgetId } from '@shared/widgets'
import { AutoHide } from './autoHide'

type Rules = TelemetryConfig['rules']
type Config = Pick<TelemetryConfig, 'rules' | 'visibility'>

const VISIBILITY: VisibilityOptions = { hideWithSimUi: true, hideInGarage: true, replays: 'follow' }

function rules(o: Partial<Rules> = {}): Rules {
  const all = { showIn: { practice: true, qualify: true, race: true }, hideInPits: false }
  return { ...(Object.fromEntries(WIDGET_IDS.map((id) => [id, all])) as Rules), ...o }
}

function config(r: Rules = rules(), v: Partial<VisibilityOptions> = {}): Config {
  return { rules: r, visibility: { ...VISIBILITY, ...v } }
}

/** SessionNum 0 = Race, 1 = Practice, 2 = Lone Qualify; the player is car 3, car 5 races too. */
const SESSION: SessionMeta = makeSession(
  0,
  {
    playerCarIdx: 3,
    sessionTypes: new Map([
      [0, 'Race'],
      [1, 'Practice'],
      [2, 'Lone Qualify']
    ])
  },
  [makeDriver(3), makeDriver(5)]
)

function frame(sessionNum: number, o: (f: MutableFrame) => void = () => {}): MutableFrame {
  const f = makeFrame()
  f.SessionNum[0] = sessionNum
  f.PlayerCarIdx[0] = 3
  f.CarIdxTrackSurface[3] = TrackLocation.OnTrack
  f.CarIdxTrackSurface[5] = TrackLocation.OnTrack
  o(f)
  return f
}

/** A replay on the camera of car `cam`. */
function replay(cam: number, o: (f: MutableFrame) => void = () => {}): MutableFrame {
  return frame(0, (f) => {
    f.IsReplayPlaying[0] = true
    f.CamCarIdx[0] = cam
    o(f)
  })
}

function harness(): { auto: AutoHide; changes: [WidgetId, boolean, HiddenReason | null][] } {
  const changes: [WidgetId, boolean, HiddenReason | null][] = []
  return { auto: new AutoHide((w, hidden, reason) => changes.push([w, hidden, reason])), changes }
}

/** The reason of every widget that changed, by widget (the last change wins). */
function latest(changes: [WidgetId, boolean, HiddenReason | null][]): Map<WidgetId, string> {
  return new Map(changes.map(([w, , r]) => [w, r ?? 'shown']))
}

const FOLLOWING = WIDGET_IDS.filter((id) => followsCamera(id))
const LIVE_ONLY = WIDGET_IDS.filter((id) => !followsCamera(id))

describe('AutoHide: per-widget rules', () => {
  const raceOnly = rules({
    battle: { showIn: { practice: false, qualify: false, race: true }, hideInPits: false }
  })

  it('hides by session kind and reports changes only', () => {
    const { auto, changes } = harness()
    auto.update(config(raceOnly), frame(1), SESSION)
    auto.update(config(raceOnly), frame(1), SESSION)
    expect(changes).toEqual([['battle', true, 'practice']])
    expect(auto.isHidden('battle')).toBe(true)
    expect(auto.isHidden('relative')).toBe(false)
    auto.update(config(raceOnly), frame(2), SESSION)
    auto.update(config(raceOnly), frame(0), SESSION)
    expect(changes).toEqual([
      ['battle', true, 'practice'],
      ['battle', true, 'qualify'],
      ['battle', false, null]
    ])
  })

  it('hides in the pits (pit road or stall) when asked to', () => {
    const { auto, changes } = harness()
    const r = config(
      rules({
        inputs: { showIn: { practice: true, qualify: true, race: true }, hideInPits: true }
      })
    )
    auto.update(
      r,
      frame(0, (f) => (f.CarIdxOnPitRoad[3] = true)),
      SESSION
    )
    auto.update(
      r,
      frame(0, (f) => (f.CarIdxTrackSurface[3] = TrackLocation.InPitStall)),
      SESSION
    )
    auto.update(r, frame(0), SESSION)
    expect(changes).toEqual([
      ['inputs', true, 'pits'],
      ['inputs', false, null]
    ])
  })

  it('never hides with an unknown session kind or a missing rule', () => {
    const { auto, changes } = harness()
    auto.update(config(raceOnly), frame(9), SESSION)
    const partial = { ...rules(), battle: undefined } as unknown as Rules
    auto.update(config(partial), frame(1), SESSION)
    expect(changes).toEqual([])
  })

  it('showAll() shows what was hidden, once', () => {
    const { auto, changes } = harness()
    auto.update(config(raceOnly), frame(1), SESSION)
    auto.showAll()
    auto.showAll()
    expect(changes).toEqual([
      ['battle', true, 'practice'],
      ['battle', false, null]
    ])
  })
})

describe('AutoHide: what the sim shows', () => {
  it('hides every widget with the iRacing UI, whatever its own rule says', () => {
    const { auto, changes } = harness()
    // The SDK sends the bit field as a signed Int32: a high bit makes it negative.
    const hidden = frame(1, (f) => (f.CamCameraState[0] = 0x80000000 | CameraState.UIHidden | 0))
    auto.update(config(), hidden, SESSION)
    expect(changes).toEqual(WIDGET_IDS.map((id) => [id, true, 'ui-hidden']))
    auto.update(config(), frame(1), SESSION)
    expect(latest(changes)).toEqual(new Map(WIDGET_IDS.map((id) => [id, 'shown'])))
  })

  it('hides every widget in the garage, named before a hidden UI', () => {
    const { auto, changes } = harness()
    const both = frame(0, (f) => {
      f.IsGarageVisible[0] = true
      f.CamCameraState[0] = CameraState.UIHidden
    })
    auto.update(config(), both, SESSION)
    expect(latest(changes)).toEqual(new Map(WIDGET_IDS.map((id) => [id, 'garage'])))
  })

  it('leaves the widgets alone when those rules are off', () => {
    const { auto, changes } = harness()
    const both = frame(0, (f) => {
      f.IsGarageVisible[0] = true
      f.CamCameraState[0] = CameraState.UIHidden
    })
    auto.update(config(rules(), { hideWithSimUi: false, hideInGarage: false }), both, SESSION)
    expect(changes).toEqual([])
  })

  it('in a replay hides only the widgets with your own live data, also on your own car', () => {
    const { auto, changes } = harness()
    auto.update(config(), replay(5), SESSION)
    expect(latest(changes)).toEqual(new Map(LIVE_ONLY.map((id) => [id, 'replay-player'])))
    expect(FOLLOWING).toEqual(['relative', 'standings', 'battle', 'traffic'])
    auto.update(config(), replay(3), SESSION)
    expect(changes).toHaveLength(LIVE_ONLY.length)
    auto.update(config(), frame(0), SESSION)
    expect(latest(changes)).toEqual(new Map(LIVE_ONLY.map((id) => [id, 'shown'])))
  })

  it('hides every widget in a replay when replays are set to hide', () => {
    const { auto, changes } = harness()
    auto.update(config(rules(), { replays: 'hide' }), replay(5), SESSION)
    expect(latest(changes)).toEqual(new Map(WIDGET_IDS.map((id) => [id, 'replay'])))
  })

  it('applies the pits rule to the car on camera during a replay', () => {
    const { auto, changes } = harness()
    const r = config(
      rules({
        relative: { showIn: { practice: true, qualify: true, race: true }, hideInPits: true }
      })
    )
    auto.update(
      r,
      replay(5, (f) => (f.CarIdxOnPitRoad[5] = true)),
      SESSION
    )
    expect(latest(changes).get('relative')).toBe('pits')
    // You in the pits do not hide it while the replay shows car 5 on track.
    auto.update(
      r,
      replay(5, (f) => (f.CarIdxOnPitRoad[3] = true)),
      SESSION
    )
    expect(latest(changes).get('relative')).toBe('shown')
  })

  it('without global rules in the config only the replay rule applies', () => {
    const { auto, changes } = harness()
    const old = { rules: rules() } as unknown as Config
    auto.update(
      old,
      frame(0, (f) => (f.IsGarageVisible[0] = true)),
      SESSION
    )
    expect(changes).toEqual([])
    auto.update(old, replay(5), SESSION)
    expect(latest(changes)).toEqual(new Map(LIVE_ONLY.map((id) => [id, 'replay-player'])))
  })
})
