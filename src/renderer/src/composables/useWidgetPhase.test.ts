import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { createDefaultSettings } from '@shared/settings'
import type { BattleData } from '@shared/types'
import {
  LIVE_STATUS,
  WAITING_STATUS,
  createFakeOverlay,
  flush,
  settingsWith,
  type FakeOverlay
} from './testing/fakeOverlay'
import { shownContent, widgetPhase, type PhaseInput } from './useWidgetPhase'

describe('shownContent', () => {
  const live = { n: 1 }
  const sample = { n: 0 }
  const preview = (): { n: number } => sample

  it('shows live data, or the sample in preview', () => {
    expect(shownContent('live', live, preview, undefined)).toBe(live)
    expect(shownContent('preview', null, preview, live)).toBe(sample)
  })

  it('keeps the last content while hidden (fading out)', () => {
    expect(shownContent('hidden', null, preview, live)).toBe(live)
    expect(shownContent('offline', null, preview, undefined)).toBeNull()
  })

  it('builds the sample only in preview', () => {
    const preview = vi.fn(() => sample)
    shownContent('live', live, preview, undefined)
    shownContent('hidden', null, preview, live)
    expect(preview).not.toHaveBeenCalled()
  })
})

describe('widgetPhase', () => {
  const base: PhaseInput = {
    hasData: false,
    connectionLive: false,
    editMode: false,
    showsOffline: true
  }

  it('is live with current data, whatever the mode', () => {
    expect(widgetPhase({ ...base, hasData: true, connectionLive: true })).toBe('live')
    expect(widgetPhase({ ...base, hasData: true, connectionLive: true, editMode: true })).toBe(
      'live'
    )
  })

  it('previews in edit mode without data', () => {
    expect(widgetPhase({ ...base, editMode: true })).toBe('preview')
    expect(widgetPhase({ ...base, editMode: true, connectionLive: true })).toBe('preview')
  })

  it('shows the status offline only for widgets that have one', () => {
    expect(widgetPhase(base)).toBe('offline')
    expect(widgetPhase({ ...base, showsOffline: false })).toBe('hidden')
  })

  it('hides the status once it may no longer show, except in edit mode (B21)', () => {
    expect(widgetPhase({ ...base, offlineShown: false })).toBe('hidden')
    expect(widgetPhase({ ...base, offlineShown: true })).toBe('offline')
    expect(widgetPhase({ ...base, offlineShown: false, editMode: true })).toBe('preview')
  })

  it('hides when connected but there is nothing to show', () => {
    expect(widgetPhase({ ...base, connectionLive: true })).toBe('hidden')
  })

  it('never calls stale data live', () => {
    expect(widgetPhase({ ...base, hasData: true })).toBe('offline')
  })
})

describe('useWidgetPhase', () => {
  let fake: FakeOverlay
  const BATTLE: BattleData = {
    visible: true,
    lapsRemaining: null,
    playerLastLaps: [],
    ahead: null,
    behind: null
  }

  beforeEach(() => {
    vi.resetModules()
    fake = createFakeOverlay()
    vi.stubGlobal('window', { overlay: fake })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('derives the phase from payload, status and edit mode', async () => {
    const { useWidgetPhase } = await import('./useWidgetPhase')
    const scope = effectScope()
    const { phase } = scope.run(() =>
      useWidgetPhase('battle', {
        showsOffline: false,
        hasContent: (d) => d.visible && (d.ahead !== null || d.behind !== null)
      })
    )!
    await flush()
    expect(phase.value).toBe('hidden')
    fake.data.emit({ widget: 'battle', payload: BATTLE })
    expect(phase.value).toBe('hidden')
    fake.editMode.emit(true)
    expect(phase.value).toBe('preview')
    fake.data.emit({
      widget: 'battle',
      payload: { ...BATTLE, ahead: {} as BattleData['ahead'] }
    })
    expect(phase.value).toBe('live')
    fake.status.emit(WAITING_STATUS)
    await nextTick()
    expect(phase.value).toBe('preview')
    scope.stop()
  })

  it('goes stale without payloads when staleMs is set', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    const { useWidgetPhase } = await import('./useWidgetPhase')
    const scope = effectScope()
    const { phase } = scope.run(() =>
      useWidgetPhase('inputs', { showsOffline: false, staleMs: 500 })
    )!
    await flush()
    fake.data.emit({
      widget: 'inputs',
      payload: {
        throttle: 0,
        brake: 0,
        clutch: 0,
        steering: 0,
        gear: 1,
        speedKmh: 0,
        abs: false,
        active: true,
        t: 0
      }
    })
    expect(phase.value).toBe('live')
    vi.advanceTimersByTime(600)
    expect(phase.value).toBe('hidden')
    scope.stop()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('says "Waiting for iRacing" for a few seconds only; an error and the option keep it (B21)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { useWidgetPhase, WAITING_GRACE_MS } = await import('./useWidgetPhase')
    const scope = effectScope()
    const { phase } = scope.run(() => useWidgetPhase('standings', { showsOffline: true }))!
    await flush()
    // Connected, nothing to show yet.
    expect(phase.value).toBe('hidden')
    // The sim closed: the status for a few seconds, then nothing over the desktop.
    fake.status.emit(WAITING_STATUS)
    expect(phase.value).toBe('offline')
    vi.advanceTimersByTime(WAITING_GRACE_MS - 1)
    expect(phase.value).toBe('offline')
    vi.advanceTimersByTime(1)
    expect(phase.value).toBe('hidden')
    // Edit mode still shows the sample, to place the window.
    fake.editMode.emit(true)
    expect(phase.value).toBe('preview')
    fake.editMode.emit(false)
    // The option keeps the status on screen.
    const keep = settingsWith(
      createDefaultSettings(),
      (s) => (s.visibility.showWhileWaiting = true)
    )
    fake.settings.emit(keep)
    expect(phase.value).toBe('offline')
    fake.settings.emit(createDefaultSettings())
    expect(phase.value).toBe('hidden')
    // An error stays: it says what is wrong.
    fake.status.emit({ ...WAITING_STATUS, state: 'error', detail: 'boom' })
    vi.advanceTimersByTime(3 * WAITING_GRACE_MS)
    expect(phase.value).toBe('offline')
    // Live again, then gone again: a new grace.
    fake.status.emit(LIVE_STATUS)
    expect(phase.value).toBe('hidden')
    fake.status.emit(WAITING_STATUS)
    expect(phase.value).toBe('offline')
    vi.advanceTimersByTime(WAITING_GRACE_MS)
    expect(phase.value).toBe('hidden')
    scope.stop()
  })

  it('drops the payload of a rule-hidden widget, which then previews in edit mode', async () => {
    const { useWidgetPhase } = await import('./useWidgetPhase')
    const scope = effectScope()
    const { phase, data } = scope.run(() => useWidgetPhase('battle', { showsOffline: false }))!
    await flush()
    fake.data.emit({ widget: 'battle', payload: BATTLE })
    expect(phase.value).toBe('live')
    fake.autoHidden.emit({ widget: 'battle', hidden: true, reason: 'practice' })
    await nextTick()
    expect(data.value).toBeNull()
    expect(phase.value).toBe('hidden')
    fake.editMode.emit(true)
    expect(phase.value).toBe('preview')
    scope.stop()
  })

  it('is always the preview, with no listener, when drawn as a settings sample', async () => {
    vi.doMock('./widgetContext', () => ({
      injectSampleHost: () => ({ reportHeight: () => {}, globalAppearance: false })
    }))
    const { useWidgetPhase } = await import('./useWidgetPhase')
    const scope = effectScope()
    const { phase, data } = scope.run(() => useWidgetPhase('battle', { showsOffline: false }))!
    fake.data.emit({ widget: 'battle', payload: BATTLE })
    expect(phase.value).toBe('preview')
    expect(data.value).toBeNull()
    expect(fake.listenerCount()).toBe(0)
    scope.stop()
    vi.doUnmock('./widgetContext')
  })
})
