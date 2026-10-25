import { describe, expect, it } from 'vitest'
import { makeDriver, makeFrame, makeSession } from '@shared/race/testing/raceSim'
import type { MutableFrame } from '@shared/race/testing/raceSim'
import { TrackLocation } from '@shared/telemetry'
import type { HiddenReason, SessionMeta, TelemetryConfig } from '@shared/types'
import { WIDGET_IDS, type WidgetId } from '@shared/widgets'
import { AutoHide } from './autoHide'

type Rules = TelemetryConfig['rules']

function rules(o: Partial<Rules> = {}): Rules {
  const all = { showIn: { practice: true, qualify: true, race: true }, hideInPits: false }
  return { ...(Object.fromEntries(WIDGET_IDS.map((id) => [id, all])) as Rules), ...o }
}

/** SessionNum 0 = Race, 1 = Practice, 2 = Lone Qualify; the player is car 3. */
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
  [makeDriver(3)]
)

function frame(sessionNum: number, o: (f: MutableFrame) => void = () => {}): MutableFrame {
  const f = makeFrame()
  f.SessionNum[0] = sessionNum
  f.PlayerCarIdx[0] = 3
  f.CarIdxTrackSurface[3] = TrackLocation.OnTrack
  o(f)
  return f
}

function harness(): { auto: AutoHide; changes: [WidgetId, boolean, HiddenReason | null][] } {
  const changes: [WidgetId, boolean, HiddenReason | null][] = []
  return { auto: new AutoHide((w, hidden, reason) => changes.push([w, hidden, reason])), changes }
}

describe('AutoHide', () => {
  const raceOnly = rules({
    battle: { showIn: { practice: false, qualify: false, race: true }, hideInPits: false }
  })

  it('hides by session kind and reports changes only', () => {
    const { auto, changes } = harness()
    auto.update(raceOnly, frame(1), SESSION)
    auto.update(raceOnly, frame(1), SESSION)
    expect(changes).toEqual([['battle', true, 'practice']])
    expect(auto.isHidden('battle')).toBe(true)
    expect(auto.isHidden('relative')).toBe(false)
    auto.update(raceOnly, frame(2), SESSION)
    auto.update(raceOnly, frame(0), SESSION)
    expect(changes).toEqual([
      ['battle', true, 'practice'],
      ['battle', true, 'qualify'],
      ['battle', false, null]
    ])
  })

  it('hides in the pits (pit road or stall) when asked to', () => {
    const { auto, changes } = harness()
    const r = rules({
      inputs: { showIn: { practice: true, qualify: true, race: true }, hideInPits: true }
    })
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
    auto.update(raceOnly, frame(9), SESSION)
    const partial = { ...rules(), battle: undefined } as unknown as Rules
    auto.update(partial, frame(1), SESSION)
    expect(changes).toEqual([])
  })

  it('showAll() shows what was hidden, once', () => {
    const { auto, changes } = harness()
    auto.update(raceOnly, frame(1), SESSION)
    auto.showAll()
    auto.showAll()
    expect(changes).toEqual([
      ['battle', true, 'practice'],
      ['battle', false, null]
    ])
  })
})
