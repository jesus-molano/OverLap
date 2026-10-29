import { describe, expect, it } from 'vitest'
import { createDefaultSettings } from '@shared/settings'
import { WIDGET_IDS } from '@shared/widgets'
import { bgChoiceOf, followGlobalPatch, ownBackgrounds, storedBackground } from './backgrounds'

describe("a widget page's «Fondo: Global / Propio»", () => {
  it('reads «Global» only for a stored "inherit"', () => {
    expect(bgChoiceOf('inherit')).toBe('inherit')
    expect(bgChoiceOf(0.78)).toBe('own')
    expect(bgChoiceOf(0)).toBe('own')
  })

  it('stores "inherit" for «Global», and the shown global number for «Propio»', () => {
    expect(storedBackground('inherit', 0.5)).toBe('inherit')
    expect(storedBackground('own', 0.5)).toBe(0.5)
    expect(storedBackground('own', 0.8)).toBe(0.8)
  })
})

describe('Apariencia › «Usar el global en todos»', () => {
  it('finds the widgets with their own number: none on a new install', () => {
    const s = createDefaultSettings()
    expect(ownBackgrounds(s.widgets)).toEqual([])
    s.widgets.relative.backgroundOpacity = 0.78
    s.widgets.fuel.backgroundOpacity = 0.8
    expect(ownBackgrounds(s.widgets)).toEqual(['relative', 'fuel'])
  })

  it('sets them all back to "inherit" in one patch, touching nothing else', () => {
    expect(followGlobalPatch(['relative', 'standings'])).toEqual({
      widgets: {
        relative: { backgroundOpacity: 'inherit' },
        standings: { backgroundOpacity: 'inherit' }
      }
    })
    expect(Object.keys(followGlobalPatch(WIDGET_IDS).widgets ?? {})).toEqual(WIDGET_IDS)
  })
})
