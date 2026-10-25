import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { StandingsData } from '@shared/types'
import {
  LIVE_STATUS,
  WAITING_STATUS,
  createFakeOverlay,
  flush,
  type FakeOverlay
} from './testing/fakeOverlay'

type Module = typeof import('./useOverlay')

let fake: FakeOverlay
let mod: Module

const STANDINGS: StandingsData = {
  header: {
    sessionType: 'Race',
    lapsRemaining: 10,
    timeRemainingS: null,
    iRating: null,
    safetyRating: null
  },
  classes: []
}

beforeEach(async () => {
  vi.resetModules()
  fake = createFakeOverlay()
  vi.stubGlobal('window', { overlay: fake })
  mod = await import('./useOverlay')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useOverlayState', () => {
  it('registers the listeners once per window', async () => {
    const a = mod.useOverlayState()
    const b = mod.useOverlayState()
    expect(a).toBe(b)
    expect(a).toBe(mod.overlayState)
    expect(fake.listenerCount()).toBe(5)
    await flush()
    expect(a.status.value).toEqual(LIVE_STATUS)
    expect(a.settings.value?.version).toBe(4)
  })

  it('keeps events newer than the initial state', async () => {
    const s = mod.useOverlayState()
    fake.status.emit(WAITING_STATUS)
    fake.editMode.emit(true)
    await flush()
    expect(s.status.value).toEqual(WAITING_STATUS)
    expect(s.editMode.value).toBe(true)
  })

  it('tracks the auto-hide state and ignores repeats', () => {
    const s = mod.useOverlayState()
    expect(s.autoHidden.value.hidden).toBe(false)
    fake.autoHidden.emit({ hidden: true, reason: 'practice' })
    const first = s.autoHidden.value
    expect(first).toEqual({ hidden: true, reason: 'practice' })
    fake.autoHidden.emit({ hidden: true, reason: 'practice' })
    expect(s.autoHidden.value).toBe(first)
    fake.autoHidden.emit({ hidden: false, reason: null })
    expect(s.autoHidden.value).toBe(mod.NOT_AUTO_HIDDEN)
  })
})

describe('useWidgetData', () => {
  it('keeps the payload of its own widget only', async () => {
    const scope = effectScope()
    const data = scope.run(() => mod.useWidgetData('standings'))!
    await flush()
    fake.data.emit({ widget: 'standings', payload: STANDINGS })
    expect(data.value).toBe(STANDINGS)
    fake.data.emit({ widget: 'inputs', payload: {} as never })
    expect(data.value).toBe(STANDINGS)
    scope.stop()
  })

  it('drops the payload when the connection stops being live', async () => {
    const scope = effectScope()
    const data = scope.run(() => mod.useWidgetData('standings'))!
    await flush()
    fake.data.emit({ widget: 'standings', payload: STANDINGS })
    fake.status.emit(WAITING_STATUS)
    await nextTick()
    expect(data.value).toBeNull()
    scope.stop()
  })

  it('drops the payload when a visibility rule hides the widget', async () => {
    const scope = effectScope()
    const data = scope.run(() => mod.useWidgetData('standings'))!
    await flush()
    fake.data.emit({ widget: 'standings', payload: STANDINGS })
    fake.autoHidden.emit({ hidden: true, reason: 'pits' })
    await nextTick()
    expect(data.value).toBeNull()
    scope.stop()
  })

  it('keeps a payload handed over before any widget or the initial state exists', async () => {
    mod.useOverlayState()
    fake.status.emit(LIVE_STATUS)
    fake.data.emit({ widget: 'standings', payload: STANDINGS })
    await flush()
    // The widget component is created later (async chunk): the payload is still there.
    const data = mod.useWidgetData('standings')
    expect(data.value).toBe(STANDINGS)
    // A reconnection is a new stream: nothing from before survives it.
    fake.status.emit(WAITING_STATUS)
    fake.data.emit({ widget: 'standings', payload: STANDINGS })
    fake.status.emit(LIVE_STATUS)
    expect(data.value).toBeNull()
  })

  it('unsubscribes when its scope stops (no leaked IPC listener)', () => {
    mod.useOverlayState()
    const base = fake.listenerCount()
    for (let i = 0; i < 50; i++) {
      const scope = effectScope()
      scope.run(() => mod.useWidgetData('standings'))
      scope.stop()
    }
    expect(fake.listenerCount()).toBe(base)
  })
})

describe('isLive', () => {
  it('is true for connected and mock only', () => {
    expect(mod.isLive(LIVE_STATUS)).toBe(true)
    expect(mod.isLive({ ...LIVE_STATUS, state: 'connected' })).toBe(true)
    expect(mod.isLive(WAITING_STATUS)).toBe(false)
    expect(mod.isLive(null)).toBe(false)
  })
})
