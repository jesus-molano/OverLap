import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/settings'
import type { AppearanceSettings } from '@shared/types'
import {
  FONT_MAX_PX,
  FONT_MIN_PX,
  appearanceAttrs,
  appearanceVars,
  applyAppearance,
  inherit,
  minTextPx,
  widgetFontPx,
  type AppearanceRoot
} from './appearance'

const BASE: AppearanceSettings = DEFAULT_SETTINGS.appearance

function fakeRoot(): AppearanceRoot & { writes: string[]; state: Map<string, string> } {
  const writes: string[] = []
  const state = new Map<string, string>()
  return {
    writes,
    state,
    style: {
      setProperty: (k: string, v: string | null) => {
        writes.push(k)
        state.set(k, v ?? '')
      },
      removeProperty: (k: string) => {
        writes.push(`-${k}`)
        state.delete(k)
        return ''
      }
    },
    setAttribute: (k, v) => {
      writes.push(k)
      state.set(k, v)
    }
  }
}

describe('appearanceVars / appearanceAttrs', () => {
  it('derives the accent text colour', () => {
    expect(appearanceVars({ ...BASE, accent: '#ffc400' })['--ov-accent-fg']).toBe('#000000')
    expect(appearanceVars({ ...BASE, accent: '#1d4ed8' })['--ov-accent-fg']).toBe('#ffffff')
  })

  it('falls back to the default accent when malformed', () => {
    expect(appearanceVars({ ...BASE, accent: 'red' })['--ov-accent']).toBe('#ffc400')
  })

  it('maps the toggles to data attributes', () => {
    const a = { ...BASE, colorBlind: true, density: 'compact', stripes: false } as const
    expect(appearanceAttrs(a)).toEqual({
      'data-cvd': 'on',
      'data-density': 'compact',
      'data-stripes': 'off',
      'data-min-text': '9',
      'data-flash': 'on',
      lang: 'es'
    })
  })

  it('leaves the text floor and the blinking as they were until Accesibilidad asks (R15, R27)', () => {
    expect(appearanceAttrs(BASE)).toMatchObject({ 'data-min-text': '9', 'data-flash': 'on' })
    expect(minTextPx(BASE)).toBe(9)
    const a = { ...BASE, largeLabels: true, noFlashing: true }
    expect(appearanceAttrs(a)).toMatchObject({ 'data-min-text': '10', 'data-flash': 'off' })
    expect(minTextPx(a)).toBe(10)
    // The base font of an auto-height widget has the same floor.
    expect(widgetFontPx(60, 100)).toBe(9)
    expect(widgetFontPx(60, 100, minTextPx(a))).toBe(10)
    expect(widgetFontPx(100, 100, minTextPx(a))).toBe(13)
  })

  it('tags the root with the interface language (Spanish when unknown)', () => {
    expect(appearanceAttrs({ ...BASE, language: 'en' }).lang).toBe('en')
    expect(appearanceAttrs({ ...BASE, language: 'fr' as never }).lang).toBe('es')
  })
})

describe('applyAppearance', () => {
  it('writes everything the first time', () => {
    const root = fakeRoot()
    applyAppearance(root, BASE, null)
    expect(root.state.get('--ov-accent')).toBe(BASE.accent)
    expect(root.state.get('data-cvd')).toBe('off')
    expect(root.state.has('data-density')).toBe(true)
  })

  it('then writes only what changed', () => {
    const root = fakeRoot()
    applyAppearance(root, BASE, null)
    root.writes.length = 0
    applyAppearance(root, { ...BASE, colorBlind: true }, BASE)
    expect(root.writes).toEqual(['data-cvd'])
    root.writes.length = 0
    applyAppearance(root, { ...BASE, accent: '#22d3ee' }, BASE)
    expect(root.writes).toEqual(['--ov-accent'])
    root.writes.length = 0
    applyAppearance(root, { ...BASE, language: 'en' }, BASE)
    expect(root.writes).toEqual(['lang'])
    expect(root.state.get('lang')).toBe('en')
  })

  it('does nothing for the same object', () => {
    const root = fakeRoot()
    applyAppearance(root, BASE, BASE)
    expect(root.writes).toEqual([])
  })
})

describe('widgetFontPx', () => {
  it('is 13 px at 100 % / 100 %', () => {
    expect(widgetFontPx(100, 100)).toBe(13)
  })

  it('multiplies both scales', () => {
    expect(widgetFontPx(150, 100)).toBe(19.5)
    expect(widgetFontPx(100, 80)).toBe(10.4)
  })

  it('clamps to the legible range', () => {
    expect(widgetFontPx(60, 80)).toBe(FONT_MIN_PX)
    expect(widgetFontPx(200, 150)).toBe(FONT_MAX_PX)
  })

  it('treats invalid values as 100 %', () => {
    expect(widgetFontPx(Number.NaN, 0)).toBe(13)
  })
})

describe('inherit', () => {
  it("resolves 'inherit' and missing to the global value", () => {
    expect(inherit('inherit', 'abbr')).toBe('abbr')
    expect(inherit(undefined, 'abbr')).toBe('abbr')
    expect(inherit('tv', 'abbr')).toBe('tv')
  })
})
