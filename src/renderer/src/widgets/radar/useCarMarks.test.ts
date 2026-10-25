/**
 * The radar's marks through the widget's own pipeline (payloads, phase, shown content), with
 * fake timers driving both the freshness timer and performance.now().
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, type ComputedRef, type EffectScope } from 'vue'
import {
  createFakeOverlay,
  flush,
  type FakeOverlay
} from '@renderer/composables/testing/fakeOverlay'
import type { WidgetPhase } from '@renderer/composables/useWidgetPhase'
import { CarLeftRight } from '@shared/telemetry'
import type { RadarCar, RadarData } from '@shared/types'
import { LANE_SPACING, NO_MARKS, type CarMark } from './geometry'
import { previewRadar } from './preview'
import { useCarMarks } from './useCarMarks'

const FRAME_MS = 1000 / 60

function car(over: Partial<RadarCar>): RadarCar {
  return {
    carIdx: 1,
    distM: -3,
    lane: 0,
    overlapping: false,
    proximity: 0.8,
    color: '',
    classColor: '#ffffff',
    ...over
  }
}

function radar(cars: RadarCar[], visible = true): RadarData {
  return {
    visible,
    rangeM: 20,
    carLeftRight: CarLeftRight.Clear,
    leftCount: 0,
    rightCount: 0,
    cars,
    trackLengthKnown: true
  }
}

const xOf = (list: readonly CarMark[], key = '1'): number | undefined =>
  list.find((m) => m.key === key)?.x

interface Mounted {
  phase: ComputedRef<WidgetPhase>
  cars: ComputedRef<readonly CarMark[]>
  scope: EffectScope
}

describe('useCarMarks', () => {
  let fake: FakeOverlay

  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    fake = createFakeOverlay()
    vi.stubGlobal('window', { overlay: fake })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  /** What RadarWidget.vue wires up. */
  async function mount(): Promise<Mounted> {
    const { useShownContent, useWidgetPhase } = await import('@renderer/composables/useWidgetPhase')
    const scope = effectScope()
    const parts = scope.run(() => {
      const { data, phase } = useWidgetPhase('radar', {
        showsOffline: false,
        hasContent: (d) => d.visible,
        staleMs: 300
      })
      const content = useShownContent(
        () => phase.value,
        () => data.value,
        () => previewRadar(20)
      )
      return {
        phase,
        cars: useCarMarks(
          () => content.value,
          () => phase.value
        )
      }
    })
    if (parts === undefined) throw new Error('scope not active')
    await flush()
    return { ...parts, scope }
  }

  /** One payload, a frame after the previous one. */
  function send(d: RadarData, ms = FRAME_MS): void {
    vi.advanceTimersByTime(ms)
    fake.data.emit({ widget: 'radar', payload: d })
  }

  it('draws nothing before any payload', async () => {
    const { cars, scope } = await mount()
    expect(cars.value).toBe(NO_MARKS)
    scope.stop()
  })

  it('slides a lane change over the payloads, then keeps one array while settled', async () => {
    const { cars, phase, scope } = await mount()
    send(radar([car({ lane: 0 })]))
    expect(phase.value).toBe('live')
    expect(xOf(cars.value)).toBe(0)
    const xs: number[] = []
    for (let i = 0; i < 30; i++) {
      send(radar([car({ lane: -1, overlapping: true, proximity: 1 })]))
      xs.push(xOf(cars.value) ?? NaN)
    }
    expect(xs[0]).toBeLessThan(0)
    expect(xs[0]).toBeGreaterThan(-LANE_SPACING / 2)
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeLessThanOrEqual(xs[i - 1] ?? NaN)
    expect(xs[xs.length - 1]).toBe(-LANE_SPACING)
    // Settled: a new payload with the same cars draws nothing new.
    const settled = cars.value
    send(radar([car({ lane: -1, overlapping: true, proximity: 1 })]))
    expect(cars.value).toBe(settled)
    scope.stop()
  })

  it('draws every car at its lane when the radar shows again, never from a stale one', async () => {
    const { cars, phase, scope } = await mount()
    send(radar([car({ lane: 0 })]))
    const shown = cars.value
    // Nobody around: hidden, the last frame kept through the fade-out, not recomputed.
    send(radar([], false))
    expect(phase.value).toBe('hidden')
    expect(cars.value).toBe(shown)
    // Back with the same car beside you: there at once, no slide from where it was drawn.
    send(radar([car({ lane: -1, overlapping: true, proximity: 1 })]), 2000)
    expect(phase.value).toBe('live')
    expect(xOf(cars.value)).toBe(-LANE_SPACING)
    scope.stop()
  })

  it('forgets the cars when the payloads stop (stale), so a new session starts clean', async () => {
    const { cars, phase, scope } = await mount()
    send(radar([car({ lane: 1, overlapping: true, proximity: 1 })]))
    expect(xOf(cars.value)).toBe(LANE_SPACING)
    vi.advanceTimersByTime(400)
    expect(phase.value).toBe('hidden')
    send(radar([car({ lane: 0, distM: 8 })]))
    expect(xOf(cars.value)).toBe(0)
    scope.stop()
  })

  it('draws the edit-mode sample in place, then the live cars in place', async () => {
    const { cars, phase, scope } = await mount()
    fake.editMode.emit(true)
    expect(phase.value).toBe('preview')
    expect(xOf(cars.value, 'p-1')).toBe(-LANE_SPACING)
    send(radar([car({ carIdx: 4, lane: 2, overlapping: true, proximity: 1 })]))
    expect(phase.value).toBe('live')
    expect(cars.value.map((m) => [m.key, m.x])).toEqual([['4', 2 * LANE_SPACING]])
    scope.stop()
  })
})
