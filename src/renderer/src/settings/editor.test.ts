import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { saveLayoutAs } from '@shared/layouts'
import { createDefaultSettings } from '@shared/settings'
import type { OverlaySettings, SettingsPatch } from '@shared/types'
import {
  createFakeOverlay,
  flush,
  settingsWith,
  type FakeOverlay
} from '../composables/testing/fakeOverlay'

interface Deferred {
  patch: SettingsPatch
  forLayout: string | undefined
  resolve: (s: OverlaySettings) => void
  reject: (err: unknown) => void
}

let fake: FakeOverlay
let calls: Deferred[]

beforeEach(() => {
  vi.resetModules()
  calls = []
  fake = createFakeOverlay()
  fake.updateSettings = (patch, forLayout) =>
    new Promise<OverlaySettings>((resolve, reject) => {
      calls.push({ patch, forLayout, resolve, reject })
    })
  vi.stubGlobal('window', { overlay: fake })
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function load(): Promise<{
  editor: typeof import('./editor')
  state: typeof import('../composables/useOverlay')
}> {
  const editor = await import('./editor')
  const state = await import('../composables/useOverlay')
  state.useOverlayState()
  await flush()
  return { editor, state }
}

describe('updateSettings', () => {
  it('applies the reply to the latest request only', async () => {
    const { editor, state } = await load()
    const older = settingsWith(createDefaultSettings(), (s) => (s.radar.rangeM = 30))
    const newer = settingsWith(createDefaultSettings(), (s) => (s.radar.rangeM = 50))
    const first = editor.updateSettings({ radar: { rangeM: 30 } })
    const second = editor.updateSettings({ radar: { rangeM: 50 } })
    calls[1]!.resolve(newer)
    await second
    expect(state.overlayState.settings.value).toBe(newer)
    // The older reply arrives late: it must not win.
    calls[0]!.resolve(older)
    await first
    expect(state.overlayState.settings.value).toBe(newer)
  })

  it('reports a failure and clears it on the next success', async () => {
    const { editor, state } = await load()
    const before = state.overlayState.settings.value
    const failing = editor.updateSettings({ radar: { rangeM: 30 } })
    calls[0]!.reject(new Error('boom'))
    await expect(failing).resolves.toBeUndefined()
    expect(editor.updateFailed.value).toBe(true)
    expect(state.overlayState.settings.value).toBe(before)

    const ok = editor.updateSettings({ radar: { rangeM: 40 } })
    calls[1]!.resolve(createDefaultSettings())
    await ok
    expect(editor.updateFailed.value).toBe(false)
  })
})

describe('setters', () => {
  it('patches one option field and keeps the setter identity', async () => {
    const { editor } = await load()
    const set = editor.optionSetter('battle')('holdS')
    expect(editor.optionSetter('battle')('holdS')).toBe(set)
    expect(editor.optionSetter('battle')('thresholdS')).not.toBe(set)
    void set(2.5)
    expect(calls[0]!.patch).toEqual({ battle: { holdS: 2.5 } })
    void editor.optionSetter('appearance')('accent')('#22d3ee')
    expect(calls[1]!.patch).toEqual({ appearance: { accent: '#22d3ee' } })
  })

  it('patches widget fields and "Mostrar en" kinds', async () => {
    const { editor } = await load()
    const lock = editor.widgetSetter('radar')('locked')
    expect(editor.widgetSetter('radar')('locked')).toBe(lock)
    expect(editor.widgetSetter('relative')('locked')).not.toBe(lock)
    void lock(true)
    expect(calls[0]!.patch).toEqual({ widgets: { radar: { locked: true } } })
    const race = editor.showInSetter('battle', 'race')
    expect(editor.showInSetter('battle', 'race')).toBe(race)
    void race(false)
    expect(calls[1]!.patch).toEqual({ widgets: { battle: { showIn: { race: false } } } })
  })

  it('sends multi-field section patches', async () => {
    const { editor } = await load()
    void editor.updateSection('standings', { gapMode: 'both', iRatingDeltaAll: true })
    expect(calls[0]!.patch).toEqual({ standings: { gapMode: 'both', iRatingDeltaAll: true } })
  })
})

describe('commands', () => {
  it('sends the reset commands', async () => {
    const { editor } = await load()
    editor.resetWidgetOptions('standings')
    editor.resetWidgetBounds('battle')
    editor.sendCommand({ type: 'set-edit-mode', on: true })
    expect(fake.sent.commands).toEqual([
      { type: 'reset-widget-options', widgetId: 'standings', part: 'all' },
      { type: 'reset-widget-bounds', widgetId: 'battle' },
      { type: 'set-edit-mode', on: true }
    ])
  })

  it('resets the appearance with a plain patch of the defaults, keeping the language', async () => {
    const { editor } = await load()
    void editor.resetAppearance()
    const { language, ...look } = createDefaultSettings().appearance
    expect(language).toBe('es')
    expect(calls[0]!.patch).toEqual({ appearance: look })
    expect('language' in calls[0]!.patch.appearance!).toBe(false)
  })
})

describe('the layout a change was made for', () => {
  /** Principal (layout-1) and Mazda (layout-2), `activeId` in use. */
  function twoLayouts(activeId: string): OverlaySettings {
    return settingsWith(createDefaultSettings(), (s) => {
      saveLayoutAs(s, 'Mazda', 1)
      s.savedLayouts.activeId = activeId
    })
  }

  it('goes with every patch: the one in use, or the one sendingFor says', async () => {
    const { editor } = await load()
    fake.settings.emit(twoLayouts('layout-1'))
    void editor.optionSetter('radar')('rangeM')(40)
    editor.sendingFor('layout-2', () => void editor.optionSetter('radar')('rangeM')(50))
    void editor.optionSetter('radar')('rangeM')(60)
    expect(calls.map((c) => c.forLayout)).toEqual(['layout-1', 'layout-2', 'layout-1'])
  })

  it('a slider value that waited for the throttle keeps the layout it was set in', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const { editor } = await load()
      const { useDraft, SETTINGS_THROTTLE_MS } = await import('./useDraft')
      fake.settings.emit(twoLayouts('layout-1'))
      const scope = effectScope()
      const draft = scope.run(() => useDraft(() => 0, editor.optionSetter('radar')('rangeM')))!
      draft.input(30)
      draft.commit(60)
      // The tray applies Mazda before the throttle lets the 60 go.
      fake.settings.emit(twoLayouts('layout-2'))
      vi.advanceTimersByTime(SETTINGS_THROTTLE_MS)
      expect(calls.map((c) => [c.patch.radar?.rangeM, c.forLayout])).toEqual([
        [30, 'layout-1'],
        [60, 'layout-1']
      ])
      scope.stop()
    } finally {
      vi.useRealTimers()
    }
  })

  it('a list sent on the layout left is not built on in the next one', async () => {
    const { editor, state } = await load()
    fake.settings.emit(twoLayouts('layout-1'))
    void editor.elementToggle('standings', 'columns', 'lic')(false)
    const sent = calls[0]!.patch.standings?.columns
    expect(editor.currentList('standings', 'columns')).toBe(sent)
    // Mazda applied while that reply is out: its own list, not Principal's as sent.
    const mazda = twoLayouts('layout-2')
    fake.settings.emit(mazda)
    expect(editor.currentList('standings', 'columns')).toBe(
      state.overlayState.settings.value?.standings.columns
    )
    void editor.elementToggle('standings', 'columns', 'ir')(false)
    const next = calls[1]!
    expect(next.forLayout).toBe('layout-2')
    expect(next.patch.standings?.columns?.find((c) => c.id === 'lic')?.visible).toBe(true)
  })
})
