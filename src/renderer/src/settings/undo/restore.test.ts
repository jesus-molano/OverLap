import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { saveLayoutAs } from '@shared/layouts'
import { createDefaultSettings } from '@shared/settings'
import type { OverlaySettings, SettingsPatch } from '@shared/types'
import {
  createFakeOverlay,
  flush,
  settingsWith,
  type FakeOverlay
} from '../../composables/testing/fakeOverlay'

/**
 * The bigger changes with "Deshacer" (R11, R24): what they send, what the toast says (where,
 * with two layouts or more) and what the undo puts back.
 */
let fake: FakeOverlay
let patches: SettingsPatch[]
let current: OverlaySettings

beforeEach(() => {
  vi.resetModules()
  patches = []
  fake = createFakeOverlay()
  fake.updateSettings = (patch) => {
    patches.push(patch)
    return Promise.resolve(current)
  }
  vi.stubGlobal('window', { overlay: fake })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function load(settings: OverlaySettings = createDefaultSettings()): Promise<{
  restore: typeof import('./restore')
  undo: typeof import('./undo')
}> {
  current = settings
  const restore = await import('./restore')
  const undo = await import('./undo')
  const state = await import('../../composables/useOverlay')
  state.useOverlayState()
  state.overlayState.settings.value = settings
  await flush()
  undo.undoSlot.attach()
  return { restore, undo }
}

function shownText(undo: typeof import('./undo')): string {
  const offer = undo.undoSlot.shown.value?.offer
  return offer?.kind === 'restore' ? offer.text() : ''
}

describe('resets with "Deshacer"', () => {
  it('resets only the section whose ↺ was clicked, and puts back its values', async () => {
    const before = settingsWith(createDefaultSettings(), (s) => {
      s.relative.carsAhead = 5
      s.relative.nameFormat = 'surname'
      s.relative.headerBarSize = 'large'
      s.widgets.relative.scale = 125
    })
    const { restore, undo } = await load(before)
    restore.resetWidget('relative', 'content')
    const sent = patches.at(-1) as Record<string, Record<string, unknown>>
    expect(sent.relative?.carsAhead).toBe(3)
    // Contenido only: the Piloto block, Personalizar and the window are not touched.
    expect(Object.keys(sent.relative ?? {}).sort()).toEqual(['carsAhead', 'carsBehind', 'density'])
    expect(sent.widgets).toBeUndefined()
    // One layout: no "where".
    expect(shownText(undo)).toBe('Restablecido: Contenido de Relativo')
    // The undo patches what the reset changed (main has applied it by now).
    const state = await import('../../composables/useOverlay')
    state.overlayState.settings.value = settingsWith(before, (s) => void (s.relative.carsAhead = 3))
    expect(undo.undoSlot.undo()).toBe(true)
    expect(patches.at(-1)).toEqual({ relative: { carsAhead: 5 } })
  })

  it('names each part in its toast: Piloto, Personalizar', async () => {
    const { restore, undo } = await load()
    restore.resetWidget('battle', 'driver')
    expect(shownText(undo)).toBe('Restablecido: Piloto de Batalla')
    expect(Object.keys((patches.at(-1) as Record<string, object>).battle ?? {}).sort()).toEqual([
      'brandMarks',
      'countryFlags',
      'nameFormat',
      'showFlags'
    ])
    restore.resetWidget('battle', 'customize')
    expect(shownText(undo)).toBe('Restablecido: Personalizar de Batalla')
  })

  it('keeps the standings gap mode and its «Ambos» column in step', async () => {
    const both = settingsWith(createDefaultSettings(), (s) => {
      s.standings.gapMode = 'both'
      s.standings.columns = s.standings.columns.map((c) =>
        c.id === 'gapLeader' ? { ...c, visible: true } : c
      )
    })
    const { restore } = await load(both)
    restore.resetWidget('standings', 'content')
    const content = (patches.at(-1) as { standings: Record<string, unknown> }).standings
    expect(content.gapMode).toBe('interval')
    const cols = content.columns as { id: string; visible: boolean }[]
    expect(cols.find((c) => c.id === 'gapLeader')?.visible).toBe(false)
    restore.resetWidget('standings', 'customize')
    const custom = (patches.at(-1) as { standings: Record<string, unknown> }).standings
    expect(custom.gapMode).toBe('interval')
  })

  it('brings a free-size widget «Escala» back with its window section', async () => {
    const def = (await import('@shared/widgets')).WIDGET_DEFS.relative.defaultBounds
    const big = settingsWith(createDefaultSettings(), (s) => {
      s.widgets.relative.bounds = {
        x: 100,
        y: 100,
        width: Math.round(def.width * 1.4),
        height: Math.round(def.height * 1.4)
      }
    })
    const { restore, undo } = await load(big)
    restore.resetWidget('relative', 'window')
    const resize = fake.sent.commands.find((c) => c.type === 'set-widget-bounds') as
      { bounds: { width: number } } | undefined
    expect(resize?.bounds.width).toBe(def.width)
    expect(shownText(undo)).toBe('Restablecido: Ventana y visibilidad de Relativo')
    undo.undoSlot.undo()
    expect(fake.sent.commands.at(-1)).toEqual({
      type: 'set-widget-bounds',
      widgetId: 'relative',
      bounds: big.widgets.relative.bounds
    })
  })

  it('resets one section of Apariencia, and all of it with Visibilidad', async () => {
    const own = settingsWith(createDefaultSettings(), (s) => {
      s.appearance.fontScale = 125
      s.appearance.accent = '#22d3ee'
      s.visibility.showWhen = 'always'
    })
    const { restore, undo } = await load(own)
    restore.resetAppearancePart('text')
    expect(patches.at(-1)).toEqual({ appearance: { fontScale: 100, textHalo: 'auto' } })
    expect(shownText(undo)).toBe('Restablecido: Texto')
    restore.resetAppearance()
    expect(patches.at(-1)?.visibility?.showWhen).toBe('car')
    undo.undoSlot.undo()
    expect(patches.at(-1)?.visibility?.showWhen).toBe('always')
    expect(patches.at(-1)?.appearance?.accent).toBe('#22d3ee')
  })

  it('offers "Deshacer" after «Usar «Global» en todos»', async () => {
    const { restore, undo } = await load()
    await restore.followGlobal(
      ['radar', 'delta'],
      () => 'Fondo',
      { widgets: { radar: { backgroundOpacity: 'inherit' } } },
      { widgets: { radar: { backgroundOpacity: 0.5 } } }
    )
    expect(shownText(undo)).toBe('Restablecido: Global en Fondo (2 widgets)')
    undo.undoSlot.undo()
    expect(patches.at(-1)).toEqual({ widgets: { radar: { backgroundOpacity: 0.5 } } })
  })

  it('offers "Deshacer" after a shortcut row reset, only when it changed something', async () => {
    const custom = settingsWith(createDefaultSettings(), (s) => {
      s.shortcutsMore.toggleOverlay = ['F13']
    })
    const { restore, undo } = await load(custom)
    restore.resetShortcut('toggleOverlay', 'Mostrar u ocultar', () => true)
    expect(shownText(undo)).toBe('Restablecido: Atajos de «Mostrar u ocultar»')
    undo.undoSlot.undo()
    expect(patches.at(-1)?.shortcutBindings?.toggleOverlay).toEqual(['Ctrl+Shift+H', 'F13'])
    const n = patches.length
    restore.resetShortcut('toggleEditMode', 'Modo edición', () => true)
    expect(undo.undoSlot.undo()).toBe(false)
    restore.resetShortcut('toggleOverlay', 'Mostrar u ocultar', () => false)
    expect(undo.undoSlot.undo()).toBe(false)
    expect(patches.length).toBe(n)
  })

  it('names the layout the reset was made in when there are two or more', async () => {
    const two = settingsWith(createDefaultSettings(), (s) => void saveLayoutAs(s, 'Mazda', 0))
    const { restore, undo } = await load(two)
    restore.resetWidget('standings', 'window')
    expect(shownText(undo)).toBe('Restablecido: Ventana y visibilidad de Posiciones · en «Mazda»')
    expect(restore.whereText(messagesFor('en'), two)).toBe(' · in “Mazda”')
  })

  it('puts the bounds back with a command (bounds are not patched)', async () => {
    const moved = settingsWith(createDefaultSettings(), (s) => {
      s.widgets.radar.bounds = { x: 10, y: 20, width: 300, height: 320 }
    })
    const { restore, undo } = await load(moved)
    restore.resetBounds('radar')
    expect(undo.undoSlot.undo()).toBe(true)
    expect(fake.sent.commands.at(-1)).toEqual({
      type: 'set-widget-bounds',
      widgetId: 'radar',
      bounds: { x: 10, y: 20, width: 300, height: 320 }
    })
  })

  it('offers to show a hidden widget again, and to bring a deleted layout back', async () => {
    const { restore, undo } = await load()
    await restore.setWidgetVisible('battle', false)
    expect(shownText(undo)).toBe('Ocultado: Batalla')
    undo.undoSlot.undo()
    expect(patches.at(-1)).toEqual({ widgets: { battle: { visible: true } } })
    restore.deleteLayout('layout-2', 'Mazda')
    expect(shownText(undo)).toBe('Disposición «Mazda» eliminada')
    undo.undoSlot.undo()
    expect(fake.sent.commands.at(-1)).toEqual({ type: 'layout-restore', id: 'layout-2' })
  })

  it('puts the shortcuts back as they were, buttons included', async () => {
    const custom = settingsWith(createDefaultSettings(), (s) => {
      s.shortcutsMore.toggleOverlay = ['F13']
    })
    const { restore, undo } = await load(custom)
    restore.resetShortcuts()
    undo.undoSlot.undo()
    expect(patches.at(-1)?.shortcutBindings?.toggleOverlay).toEqual(['Ctrl+Shift+H', 'F13'])
  })
})
