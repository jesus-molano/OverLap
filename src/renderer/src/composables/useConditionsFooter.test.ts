import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, shallowRef } from 'vue'
import { createDefaultSettings } from '@shared/settings'
import type { ConditionsData, OverlaySettings } from '@shared/types'
import { PREVIEW_CONDITIONS } from '../view/conditions'
import { createFakeOverlay, flush, settingsWith, type FakeOverlay } from './testing/fakeOverlay'

let fake: FakeOverlay
let base: OverlaySettings

beforeEach(() => {
  vi.resetModules()
  base = createDefaultSettings()
  fake = createFakeOverlay({ settings: base })
  vi.stubGlobal('window', { overlay: fake })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('footerOptionsOf / stableReadings', () => {
  it('takes only the footer fields of a section', async () => {
    const { footerOptionsOf } = await import('./useConditionsFooter')
    const o = footerOptionsOf(createDefaultSettings().standings)
    expect(o).toEqual({
      conditionsFooter: true,
      conditionsTrackTemp: true,
      conditionsTrend: true,
      conditionsWet: true,
      conditionsWind: true,
      conditionsWindDirection: true,
      conditionsAirTemp: true,
      conditionsRubber: true
    })
    expect(footerOptionsOf(createDefaultSettings().relative).conditionsFooter).toBe(false)
  })

  it('keeps the previous readings while they read the same', async () => {
    const { stableReadings } = await import('./useConditionsFooter')
    const a: ConditionsData = { ...PREVIEW_CONDITIONS }
    expect(stableReadings(undefined, a)).toBe(a)
    expect(stableReadings(a, structuredClone(a))).toBe(a)
    const b = { ...a, airTempC: 30 }
    expect(stableReadings(a, b)).toBe(b)
    expect(stableReadings(a, null)).toBeNull()
    expect(stableReadings(null, a)).toBe(a)
  })
})

describe('useConditionsFooter', () => {
  it('rebuilds nothing for a table payload whose readings did not move (10 Hz relative)', async () => {
    const { useConditionsFooter } = await import('./useConditionsFooter')
    // The module graph is fresh (resetModules): its own NO_FOOTER.
    const { NO_FOOTER } = await import('../view/conditions')
    const readings = shallowRef<ConditionsData | null>(null)
    const scope = effectScope()
    const footer = scope.run(() => useConditionsFooter('standings', () => readings.value))!
    await flush()
    expect(footer.value).toBe(NO_FOOTER)
    readings.value = { ...PREVIEW_CONDITIONS }
    const first = footer.value
    expect(first.track?.value).toBe('24')
    // Every payload brings a new copy of the same readings (structured clone over IPC).
    for (let i = 0; i < 10; i++) {
      readings.value = structuredClone(PREVIEW_CONDITIONS)
      expect(footer.value).toBe(first)
    }
    readings.value = { ...PREVIEW_CONDITIONS, airTempC: 21 }
    expect(footer.value).not.toBe(first)
    expect(footer.value.track).toBe(first.track)
    expect(footer.value.air?.value).toBe('21')
    scope.stop()
  })

  it('follows the section switch, the readings chosen, the units and the language', async () => {
    const { useConditionsFooter } = await import('./useConditionsFooter')
    // The module graph is fresh (resetModules): its own NO_FOOTER.
    const { NO_FOOTER } = await import('../view/conditions')
    const scope = effectScope()
    const [relative, standings] = scope.run(() => [
      useConditionsFooter('relative', () => PREVIEW_CONDITIONS),
      useConditionsFooter('standings', () => PREVIEW_CONDITIONS)
    ])!
    await flush()
    // Off under the relative by default, on under the standings.
    expect(relative!.value).toBe(NO_FOOTER)
    expect(standings!.value.track).not.toBeNull()

    fake.settings.emit(
      settingsWith(base, (n) => {
        n.relative.footerBarSize = 'normal'
        n.relative.footerBar = n.relative.footerBar.map((e) =>
          e.id === 'airTemp' ? { ...e, visible: false } : e
        )
        n.appearance.units = 'imperial'
        n.appearance.language = 'en'
      })
    )
    expect(relative!.value.air).toBeNull()
    expect(relative!.value.track).toMatchObject({ label: 'Track', unit: '°F' })
    // The standings' own options are untouched.
    expect(standings!.value.air).toMatchObject({ label: 'Air', unit: '°F' })
    scope.stop()
  })

  it('keeps its view through a change of the table’s own options', async () => {
    const { useConditionsFooter } = await import('./useConditionsFooter')
    const scope = effectScope()
    const footer = scope.run(() => useConditionsFooter('standings', () => PREVIEW_CONDITIONS))!
    await flush()
    const first = footer.value
    fake.settings.emit(settingsWith(base, (n) => (n.standings.topRows = 6)))
    expect(footer.value).toBe(first)
    scope.stop()
  })
})
