import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, watch } from 'vue'
import { createDefaultSettings } from '@shared/settings'
import type { OverlaySettings } from '@shared/types'
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

/** A drag in edit mode: only the bounds change, but main broadcasts a whole new object. */
function drag(s: OverlaySettings): OverlaySettings {
  return settingsWith(s, (n) => (n.widgets.standings.bounds.x += 10))
}

describe('useWidgetSettings', () => {
  it('drops the bounds and keeps its object through a drag', async () => {
    const { useWidgetSettings } = await import('./useWidgetSettings')
    const scope = effectScope()
    const prefs = scope.run(() => useWidgetSettings('standings'))!
    await flush()
    const first = prefs.value
    expect('bounds' in first).toBe(false)
    expect(first.autoHeight).toBe(true)
    let s = base
    for (let i = 0; i < 5; i++) fake.settings.emit((s = drag(s)))
    expect(prefs.value).toBe(first)
    fake.settings.emit(settingsWith(s, (n) => (n.widgets.standings.scale = 120)))
    expect(prefs.value).not.toBe(first)
    expect(prefs.value.scale).toBe(120)
    scope.stop()
  })
})

describe('useAutoHeight', () => {
  it('needs both the auto-height size model and the option', async () => {
    const { useAutoHeight } = await import('./useWidgetSettings')
    const scope = effectScope()
    const [standings, relative] = scope.run(() => [
      useAutoHeight('standings'),
      useAutoHeight('relative')
    ])!
    fake.settings.emit(settingsWith(base, (n) => (n.widgets.relative.autoHeight = true)))
    expect(standings!.value).toBe(true)
    expect(relative!.value).toBe(false)
    fake.settings.emit(settingsWith(base, (n) => (n.widgets.standings.autoHeight = false)))
    expect(standings!.value).toBe(false)
    scope.stop()
  })
})

describe('useOptions / useOption', () => {
  it('trigger nothing while only the bounds change', async () => {
    const { useOption, useOptions } = await import('./useWidgetSettings')
    const scope = effectScope()
    const runs = { options: 0, columns: 0 }
    scope.run(() => {
      const options = useOptions('standings')
      const columns = useOption('standings', 'columns')
      watch(options, () => runs.options++)
      watch(columns, () => runs.columns++)
    })
    await flush()
    runs.options = 0
    runs.columns = 0
    let s = base
    for (let i = 0; i < 10; i++) {
      fake.settings.emit((s = drag(s)))
      await nextTick()
    }
    expect(runs).toEqual({ options: 0, columns: 0 })
    fake.settings.emit(settingsWith(s, (n) => (n.standings.topRows = 5)))
    await nextTick()
    expect(runs).toEqual({ options: 1, columns: 0 })
    scope.stop()
  })
})

describe('useNameFormat / useDensity', () => {
  it("follow the global appearance when the widget says 'inherit'", async () => {
    const { useDensity, useNameFormat } = await import('./useWidgetSettings')
    const scope = effectScope()
    const [name, density] = scope.run(() => [useNameFormat('standings'), useDensity('standings')])!
    const inheriting = settingsWith(base, (n) => {
      n.standings.nameFormat = 'inherit'
      n.standings.density = 'inherit'
      n.appearance.nameFormat = 'surname'
      n.appearance.density = 'compact'
    })
    fake.settings.emit(inheriting)
    expect(name.value).toBe('surname')
    expect(density.value).toBe('compact')
    fake.settings.emit(
      settingsWith(inheriting, (n) => {
        n.standings.nameFormat = 'tv'
        n.standings.density = 'comfortable'
      })
    )
    expect(name.value).toBe('tv')
    expect(density.value).toBe('comfortable')
    scope.stop()
  })
})

describe('useWidgetSurface', () => {
  it('clamps the opacity and applies the halo rule', async () => {
    const { useWidgetSurface } = await import('./useWidgetSurface')
    const scope = effectScope()
    const surface = scope.run(() => useWidgetSurface('relative'))!
    fake.settings.emit(settingsWith(base, (n) => (n.widgets.relative.backgroundOpacity = 0.2)))
    expect(surface.bgAlpha.value).toBe(0.2)
    expect(surface.lowBg.value).toBe(true)
    expect(surface.halo.value).toBe(true)
    fake.settings.emit(
      settingsWith(base, (n) => {
        n.widgets.relative.backgroundOpacity = 0.2
        n.appearance.textHalo = 'off'
      })
    )
    expect(surface.halo.value).toBe(false)
    fake.settings.emit(
      settingsWith(base, (n) => {
        n.widgets.relative.backgroundOpacity = 0.9
        n.appearance.textHalo = 'on'
      })
    )
    expect(surface.halo.value).toBe(true)
    expect(surface.surfaceStyle.value).toEqual({ '--ov-bg-alpha': '0.9' })
    scope.stop()
  })

  it("draws Apariencia's sample with the global background, whatever the widget's own", async () => {
    vi.doMock('./widgetContext', async (importOriginal) => ({
      ...(await importOriginal<typeof import('./widgetContext')>()),
      injectSampleHost: () => ({ reportHeight: () => {}, globalAppearance: true })
    }))
    const { useWidgetSurface } = await import('./useWidgetSurface')
    const scope = effectScope()
    const surface = scope.run(() => useWidgetSurface('standings'))!
    // A file from 2.2: the widget keeps its own 78 %, the global slider says 25 %.
    fake.settings.emit(
      settingsWith(base, (n) => {
        n.widgets.standings.backgroundOpacity = 0.78
        n.appearance.backgroundOpacity = 0.25
      })
    )
    expect(surface.bgAlpha.value).toBe(0.25)
    expect(surface.halo.value).toBe(true)
    scope.stop()
    vi.doUnmock('./widgetContext')
  })

  it('gives auto-height widgets their font from the scale settings', async () => {
    const { useWidgetSurface } = await import('./useWidgetSurface')
    const scope = effectScope()
    const surface = scope.run(() => useWidgetSurface('battle'))!
    fake.settings.emit(
      settingsWith(base, (n) => {
        n.widgets.battle.scale = 150
        n.appearance.fontScale = 100
      })
    )
    expect(surface.fontPx.value).toBe(19.5)
    expect(surface.surfaceStyle.value['--ov-fs']).toBe('19.5px')
    scope.stop()
  })

  it('keeps the same style object through a drag', async () => {
    const { useWidgetSurface } = await import('./useWidgetSurface')
    const scope = effectScope()
    const surface = scope.run(() => useWidgetSurface('standings'))!
    await flush()
    const first = surface.surfaceStyle.value
    fake.settings.emit(drag(base))
    expect(surface.surfaceStyle.value).toBe(first)
    scope.stop()
  })
})

describe('clampOpacity / haloOn', () => {
  it('are pure', async () => {
    const { clampOpacity, haloOn, HALO_AUTO_ALPHA } = await import('./useWidgetSurface')
    expect(clampOpacity(1.5, 0.5)).toBe(1)
    expect(clampOpacity(-1, 0.5)).toBe(0)
    expect(clampOpacity(Number.NaN, 0.5)).toBe(0.5)
    expect(clampOpacity(undefined, 0.5)).toBe(0.5)
    expect(HALO_AUTO_ALPHA).toBe(0.65)
    expect(haloOn('auto', 0.5)).toBe(true)
    expect(haloOn('auto', HALO_AUTO_ALPHA - 0.01)).toBe(true)
    expect(haloOn('auto', HALO_AUTO_ALPHA)).toBe(false)
    expect(haloOn('auto', 0.8)).toBe(false)
    expect(haloOn('on', 1)).toBe(true)
    expect(haloOn('off', 0)).toBe(false)
  })

  it('give a widget its own opacity, or the global one for "inherit"', async () => {
    const { widgetOpacity } = await import('./useWidgetSurface')
    expect(widgetOpacity('inherit', 0.6)).toBe(0.6)
    expect(widgetOpacity(0.3, 0.6)).toBe(0.3)
    expect(widgetOpacity('inherit', undefined)).toBe(0.8)
    expect(widgetOpacity(Number.NaN, 0.6)).toBe(0.6)
  })
})

describe('startAppearance', () => {
  it('applies once, then only when an appearance value changes', async () => {
    const { startAppearance } = await import('./useAppearance')
    const writes: string[] = []
    const root = {
      style: {
        setProperty: (k: string) => void writes.push(k),
        removeProperty: (k: string) => (writes.push(`-${k}`), '')
      },
      setAttribute: (k: string) => void writes.push(k)
    }
    const stop = startAppearance(root)
    expect(writes).toContain('--ov-accent')
    expect(writes).toContain('data-density')
    await flush()
    writes.length = 0
    let s = base
    for (let i = 0; i < 10; i++) {
      fake.settings.emit((s = drag(s)))
      await nextTick()
    }
    expect(writes).toEqual([])
    fake.settings.emit(settingsWith(s, (n) => (n.appearance.colorBlind = true)))
    await nextTick()
    expect(writes).toEqual(['data-cvd'])
    stop()
  })
})
