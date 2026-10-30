import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, createDefaultSettings } from '@shared/settings'
import {
  dropIndex,
  indexDone,
  indexing,
  resetIndexForTests,
  searchIndex,
  settingsKey,
  wantIndex
} from './searchIndex'
import { mergeGated, type SearchEntry } from './settingsSearch'
import { unlockedOptions } from './unlock'

const entry = (text: string, context = 'Modo compacto'): SearchEntry => ({
  page: 'standings',
  kind: 'label',
  text,
  context,
  help: ''
})

describe('the search index (R33)', () => {
  beforeEach(() => resetIndexForTests())

  it('is harvested on the first focus, and not again while nothing changed', () => {
    wantIndex('a')
    expect(indexing.value).toBe(true)
    indexDone([entry('Primeros puestos')])
    expect(indexing.value).toBe(false)
    wantIndex('a')
    expect(indexing.value).toBe(false)
  })

  it('is harvested again after a setting changed, the old one answering meanwhile', () => {
    wantIndex('a')
    indexDone([entry('a')])
    wantIndex('b')
    expect(indexing.value).toBe(true)
    expect(searchIndex.value).toEqual([entry('a')])
  })

  it('stays stale when a setting changes during a harvest', () => {
    wantIndex('a')
    indexDone([entry('a')])
    wantIndex('b')
    expect(indexing.value).toBe(true)
  })

  it('a new language drops it, and a harvest under way counts from then', () => {
    wantIndex('a')
    indexDone([entry('a')])
    dropIndex('a')
    expect(searchIndex.value).toBeNull()
    wantIndex('a')
    // The language changes again mid-harvest: SettingsApp remounts the indexer (keyed).
    dropIndex('a')
    indexDone([entry('b')])
    wantIndex('a')
    expect(indexing.value).toBe(false)
  })

  it('reads a moved or fitted widget as no change, a mode as one', () => {
    const s = createDefaultSettings()
    const before = settingsKey(s)
    s.widgets.fuel.bounds = { ...s.widgets.fuel.bounds, x: s.widgets.fuel.bounds.x + 40 }
    expect(settingsKey(s)).toBe(before)
    s.standings.mode = 'full'
    expect(settingsKey(s)).not.toBe(before)
  })
})

describe('mergeGated (R33)', () => {
  it('adds what only the unlocked pass shows, marked gated', () => {
    const shown = [entry('Filas'), entry('Densidad', '')]
    const all = [entry('Filas'), entry('Densidad', ''), entry('Primeros puestos')]
    expect(mergeGated(shown, all)).toEqual([
      entry('Filas'),
      entry('Densidad', ''),
      { ...entry('Primeros puestos'), gated: true }
    ])
  })
})

describe('unlockedOptions (R33)', () => {
  it('shows every list item and turns every switch on, for a widget only', () => {
    const fuel = unlockedOptions('fuel', DEFAULT_SETTINGS.fuel) as typeof DEFAULT_SETTINGS.fuel
    expect(fuel.lines.every((l) => l.visible)).toBe(true)
    const appearance = DEFAULT_SETTINGS.appearance
    expect(unlockedOptions('appearance', appearance)).toBe(appearance)
  })

  it('picks what shows more where that is not "on"', () => {
    const s = structuredClone(DEFAULT_SETTINGS)
    s.standings.mode = 'full'
    s.inputs.steeringStyle = 'bar'
    s.lights.showCaptions = true
    expect((unlockedOptions('standings', s.standings) as typeof s.standings).mode).toBe('compact')
    expect((unlockedOptions('inputs', s.inputs) as typeof s.inputs).steeringStyle).not.toBe('bar')
    expect((unlockedOptions('lights', s.lights) as typeof s.lights).showCaptions).toBe(false)
    // A global section only gets its choice: the session-screen switch is offered.
    s.visibility.replays = 'hide'
    const v = unlockedOptions('visibility', s.visibility) as typeof s.visibility
    expect(v.replays).toBe('follow')
    expect(v.hideOnSessionScreen).toBe(s.visibility.hideOnSessionScreen)
    // The stored settings are left as they are.
    expect(s.standings.mode).toBe('full')
  })
})
