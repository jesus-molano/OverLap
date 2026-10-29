import { describe, expect, it } from 'vitest'
import { makeDriver, makeFrame, makeSession } from '@shared/race/testing/raceSim'
import type { MutableFrame } from '@shared/race/testing/raceSim'
import { CameraState } from '@shared/simScreen'
import { TrackLocation } from '@shared/telemetry'
import type { HiddenReason, SessionMeta, TelemetryConfig, VisibilityOptions } from '@shared/types'
import { WIDGET_IDS, followsCamera, keepsLiveInReplay, type WidgetId } from '@shared/widgets'
import { AutoHide } from './autoHide'

type Rules = TelemetryConfig['rules']
type Rule = Rules[WidgetId]
type Config = Pick<TelemetryConfig, 'rules' | 'visibility'>

/** The defaults but replays following the camera (the frames are in the car unless said). */
const VISIBILITY: VisibilityOptions = {
  showWhen: 'car',
  hideWithSimUi: true,
  hideInGarage: true,
  hideOnSessionScreen: true,
  replays: 'follow',
  showWhileWaiting: false
}

const EVERYWHERE: Rule = {
  showIn: { practice: true, qualify: true, race: true },
  hideInPits: false,
  showOnSessionScreen: false
}

function rule(o: Partial<Rule> = {}): Rule {
  return { ...EVERYWHERE, ...o }
}

function rules(o: Partial<Rules> = {}): Rules {
  return { ...(Object.fromEntries(WIDGET_IDS.map((id) => [id, EVERYWHERE])) as Rules), ...o }
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

/** The replay system on, the camera on car `cam` (at the live point, or on the tape). */
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
const OFF_TAPE = WIDGET_IDS.filter((id) => !keepsLiveInReplay(id))

describe('AutoHide: per-widget rules', () => {
  const raceOnly = rules({
    battle: rule({ showIn: { practice: false, qualify: false, race: true } })
  })

  it('hides by session kind and reports changes only', () => {
    const { auto, changes } = harness()
    auto.update(config(raceOnly), frame(1), SESSION, 'none')
    auto.update(config(raceOnly), frame(1), SESSION, 'none')
    expect(changes).toEqual([['battle', true, 'practice']])
    expect(auto.isHidden('battle')).toBe(true)
    expect(auto.isHidden('relative')).toBe(false)
    auto.update(config(raceOnly), frame(2), SESSION, 'none')
    auto.update(config(raceOnly), frame(0), SESSION, 'none')
    expect(changes).toEqual([
      ['battle', true, 'practice'],
      ['battle', true, 'qualify'],
      ['battle', false, null]
    ])
  })

  it('knows the kind of session of the last update, none after showAll', () => {
    const { auto } = harness()
    expect(auto.kind).toBeNull()
    auto.update(config(raceOnly), frame(1), SESSION, 'none')
    expect(auto.kind).toBe('practice')
    auto.update(config(raceOnly), frame(0), SESSION, 'none')
    expect(auto.kind).toBe('race')
    auto.showAll()
    expect(auto.kind).toBeNull()
  })

  it('hides in the pits (pit road or stall) when asked to', () => {
    const { auto, changes } = harness()
    const r = config(rules({ inputs: rule({ hideInPits: true }) }))
    auto.update(
      r,
      frame(0, (f) => (f.CarIdxOnPitRoad[3] = true)),
      SESSION,
      'none'
    )
    auto.update(
      r,
      frame(0, (f) => (f.CarIdxTrackSurface[3] = TrackLocation.InPitStall)),
      SESSION,
      'none'
    )
    auto.update(r, frame(0), SESSION, 'none')
    expect(changes).toEqual([
      ['inputs', true, 'pits'],
      ['inputs', false, null]
    ])
  })

  it('never hides with an unknown session kind or a missing rule', () => {
    const { auto, changes } = harness()
    auto.update(config(raceOnly), frame(9), SESSION, 'none')
    const partial = { ...rules(), battle: undefined } as unknown as Rules
    auto.update(config(partial), frame(1), SESSION, 'none')
    expect(changes).toEqual([])
  })

  it('showAll() shows what was hidden, once', () => {
    const { auto, changes } = harness()
    auto.update(config(raceOnly), frame(1), SESSION, 'none')
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
    auto.update(config(), hidden, SESSION, 'none')
    expect(changes).toEqual(WIDGET_IDS.map((id) => [id, true, 'ui-hidden']))
    auto.update(config(), frame(1), SESSION, 'none')
    expect(latest(changes)).toEqual(new Map(WIDGET_IDS.map((id) => [id, 'shown'])))
  })

  it('hides every widget in the garage, named before a hidden UI', () => {
    const { auto, changes } = harness()
    const both = frame(0, (f) => {
      f.IsGarageVisible[0] = true
      f.CamCameraState[0] = CameraState.UIHidden
    })
    auto.update(config(), both, SESSION, 'none')
    expect(latest(changes)).toEqual(new Map(WIDGET_IDS.map((id) => [id, 'garage'])))
  })

  it('leaves the widgets alone when those rules are off', () => {
    const { auto, changes } = harness()
    const all = frame(0, (f) => {
      f.IsGarageVisible[0] = true
      f.CamCameraState[0] = CameraState.UIHidden | CameraState.IsSessionScreen
    })
    const off = { hideWithSimUi: false, hideInGarage: false, hideOnSessionScreen: false }
    auto.update(config(rules(), off), all, SESSION, 'none')
    expect(changes).toEqual([])
  })

  it('hides on the session screen all but the widgets kept there (B06)', () => {
    const { auto, changes } = harness()
    // Out of the car after the race: CamCameraState 81, the replay system at its live point.
    const sessionScreen = replay(3, (f) => (f.CamCameraState[0] = 81))
    const r = config(rules({ standings: rule({ showOnSessionScreen: true }) }))
    auto.update(r, sessionScreen, SESSION, 'live')
    expect(latest(changes)).toEqual(
      new Map(WIDGET_IDS.filter((id) => id !== 'standings').map((id) => [id, 'session-screen']))
    )
    // Back in the car (80): everything again.
    auto.update(
      r,
      frame(0, (f) => (f.CamCameraState[0] = 80)),
      SESSION,
      'none'
    )
    expect(WIDGET_IDS.some((id) => auto.isHidden(id))).toBe(false)
  })

  it('takes the live point of a replay as live: nothing hides, even with replays set to hide (Q1)', () => {
    const { auto, changes } = harness()
    auto.update(config(rules(), { replays: 'hide' }), replay(3), SESSION, 'live')
    expect(changes).toEqual([])
  })

  it('at the live point on another car, hides only the widgets with your own data', () => {
    const { auto, changes } = harness()
    auto.update(config(), replay(5), SESSION, 'live')
    expect(latest(changes)).toEqual(new Map(LIVE_ONLY.map((id) => [id, 'camera-other'])))
    expect(FOLLOWING).toEqual(['relative', 'standings', 'battle', 'traffic'])
    auto.update(config(), replay(3), SESSION, 'live')
    expect(latest(changes)).toEqual(new Map(LIVE_ONLY.map((id) => [id, 'shown'])))
  })

  it('on the tape hides every widget but the standings, which keep the live race', () => {
    const { auto, changes } = harness()
    auto.update(config(), replay(5), SESSION, 'tape')
    expect(OFF_TAPE).toEqual(WIDGET_IDS.filter((id) => id !== 'standings'))
    expect(latest(changes)).toEqual(new Map(OFF_TAPE.map((id) => [id, 'replay-player'])))
    auto.update(config(), frame(0), SESSION, 'none')
    expect(latest(changes)).toEqual(new Map(OFF_TAPE.map((id) => [id, 'shown'])))
  })

  it('hides every widget on the tape when replays are set to hide', () => {
    const { auto, changes } = harness()
    auto.update(config(rules(), { replays: 'hide' }), replay(5), SESSION, 'tape')
    expect(latest(changes)).toEqual(new Map(WIDGET_IDS.map((id) => [id, 'replay'])))
  })

  it('judges the session and the pits from the live frame while the tape plays', () => {
    const { auto, changes } = harness()
    const r = config(rules({ standings: rule({ hideInPits: true }) }))
    // The tape shows you in the pits of practice; live, you are on track in the race.
    const tape = frame(1, (f) => {
      f.IsReplayPlaying[0] = true
      f.CarIdxOnPitRoad[3] = true
    })
    auto.update(r, tape, SESSION, 'tape', frame(0))
    expect(latest(changes).get('standings')).toBeUndefined()
    auto.update(r, tape, SESSION, 'tape', tape)
    expect(latest(changes).get('standings')).toBe('pits')
  })

  it('applies the pits rule to the car on camera at the live point', () => {
    const { auto, changes } = harness()
    const r = config(rules({ relative: rule({ hideInPits: true }) }))
    auto.update(
      r,
      replay(5, (f) => (f.CarIdxOnPitRoad[5] = true)),
      SESSION,
      'live'
    )
    expect(latest(changes).get('relative')).toBe('pits')
    // You in the pits do not hide it while the camera shows car 5 on track.
    auto.update(
      r,
      replay(5, (f) => (f.CarIdxOnPitRoad[3] = true)),
      SESSION,
      'live'
    )
    expect(latest(changes).get('relative')).toBe('shown')
  })

  it('without global rules in the config only the replay rules apply', () => {
    const { auto, changes } = harness()
    const old = { rules: rules() } as unknown as Config
    auto.update(
      old,
      frame(0, (f) => (f.IsGarageVisible[0] = true)),
      SESSION,
      'none'
    )
    expect(changes).toEqual([])
    auto.update(old, replay(5), SESSION, 'tape')
    expect(latest(changes)).toEqual(new Map(OFF_TAPE.map((id) => [id, 'replay-player'])))
  })
})

describe('AutoHide: when to show the overlay', () => {
  const kept = rules({ standings: rule({ showOnSessionScreen: true }) })
  const defaults = (r: Rules = kept): Config => config(r, { replays: 'hide' })
  /** Out of the car (IsOnTrack false) on the session screen, at the replay's live point. */
  const sessionScreen = replay(3, (f) => {
    f.IsOnTrack[0] = false
    f.CamCameraState[0] = 81
  })

  it('hides every widget out of the car but the standings on the session screen', () => {
    const { auto, changes } = harness()
    auto.update(defaults(), sessionScreen, SESSION, 'live')
    expect(latest(changes)).toEqual(
      new Map(WIDGET_IDS.filter((id) => id !== 'standings').map((id) => [id, 'out-of-car']))
    )
    // The camera on another car out of the car: the standings too.
    auto.update(
      defaults(),
      replay(5, (f) => (f.IsOnTrack[0] = false)),
      SESSION,
      'live'
    )
    expect(latest(changes).get('standings')).toBe('out-of-car')
    // Back in the car: everything.
    auto.update(defaults(), frame(0), SESSION, 'none')
    expect(WIDGET_IDS.some((id) => auto.isHidden(id))).toBe(false)
  })

  it('reads you in the car from the live frame, or from the loop’s held value', () => {
    const { auto, changes } = harness()
    const out = frame(0, (f) => (f.IsOnTrack[0] = false))
    // The loop still holds you in the car for a moment.
    auto.update(defaults(), out, SESSION, 'none', out, true)
    expect(changes).toEqual([])
    auto.update(defaults(), out, SESSION, 'none', out, false)
    expect(latest(changes)).toEqual(new Map(WIDGET_IDS.map((id) => [id, 'out-of-car'])))
    // Unknown never hides.
    auto.update(defaults(), out, SESSION, 'none', out, null)
    expect(WIDGET_IDS.some((id) => auto.isHidden(id))).toBe(false)
  })

  it('in races only: nothing in practice or qualifying, from the live frame’s session', () => {
    const { auto, changes } = harness()
    const raceOnly = config(kept, { showWhen: 'race' })
    auto.update(raceOnly, frame(1), SESSION, 'none')
    expect(latest(changes)).toEqual(new Map(WIDGET_IDS.map((id) => [id, 'not-race'])))
    auto.update(raceOnly, frame(2), SESSION, 'none')
    expect(changes).toHaveLength(WIDGET_IDS.length)
    auto.update(raceOnly, frame(0), SESSION, 'none')
    expect(WIDGET_IDS.some((id) => auto.isHidden(id))).toBe(false)
    // The tape of practice while the race goes on live: the live session counts.
    const tape = replay(5, (f) => (f.SessionNum[0] = 1))
    auto.update(config(kept, { showWhen: 'race' }), tape, SESSION, 'tape', frame(0))
    expect(latest(changes).get('standings')).toBe('shown')
  })

  it('the per-widget rules still apply on top', () => {
    const { auto, changes } = harness()
    const r = rules({ battle: rule({ showIn: { practice: false, qualify: false, race: true } }) })
    auto.update(config(r, { showWhen: 'always' }), frame(1), SESSION, 'none')
    expect(changes).toEqual([['battle', true, 'practice']])
  })

  it('follows the car on camera from out of the car when replays follow it', () => {
    const { auto, changes } = harness()
    const watching = replay(5, (f) => (f.IsOnTrack[0] = false))
    auto.update(config(kept), watching, SESSION, 'live')
    // Only the widgets with your own car's data hide: the camera is on car 5.
    expect(latest(changes)).toEqual(new Map(LIVE_ONLY.map((id) => [id, 'camera-other'])))
    auto.update(config(kept), watching, SESSION, 'tape')
    expect(latest(changes)).toEqual(new Map(OFF_TAPE.map((id) => [id, 'replay-player'])))
    // Replays hidden (the default): out of the car on the tape says replay.
    auto.update(defaults(), watching, SESSION, 'tape')
    expect(latest(changes)).toEqual(new Map(WIDGET_IDS.map((id) => [id, 'replay'])))
  })
})
