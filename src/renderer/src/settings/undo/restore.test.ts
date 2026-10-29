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
  it('resets a widget page part in one click and puts back its values', async () => {
    const before = settingsWith(createDefaultSettings(), (s) => {
      s.relative.carsAhead = 5
      s.widgets.relative.scale = 125
    })
    const { restore, undo } = await load(before)
    restore.resetWidget('relative', 'options')
    expect(fake.sent.commands).toContainEqual({
      type: 'reset-widget-options',
      widgetId: 'relative',
      part: 'options'
    })
    // One layout: no "where".
    expect(shownText(undo)).toBe('Restablecido: opciones de Relativo')
    expect(undo.undoSlot.undo()).toBe(true)
    const back = patches.at(-1) as Record<string, unknown>
    expect((back.relative as { carsAhead: number }).carsAhead).toBe(5)
    // The window was not reset: the undo does not touch it.
    expect(back.widgets).toBeUndefined()
  })

  it('names the layout the reset was made in when there are two or more', async () => {
    const two = settingsWith(createDefaultSettings(), (s) => void saveLayoutAs(s, 'Mazda', 0))
    const { restore, undo } = await load(two)
    restore.resetWidget('standings', 'window')
    expect(shownText(undo)).toBe('Restablecido: ventana de Posiciones · en «Mazda»')
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
    expect(shownText(undo)).toBe('Batalla oculto')
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
