import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, normalizeSettings } from './settings'
import { nextZoom, zoomFactor, zoomStepOf, type ZoomKeyEvent } from './settingsZoom'

const key = (k: string, code: string, mods: Partial<ZoomKeyEvent> = {}): ZoomKeyEvent => ({
  key: k,
  code,
  ctrlKey: true,
  metaKey: false,
  altKey: false,
  ...mods
})

describe('the settings window zoom (R29)', () => {
  it('is 100 % for a new install and for a file from before', () => {
    expect(DEFAULT_SETTINGS.appearance.settingsZoom).toBe(100)
    expect(
      normalizeSettings({ version: 6, appearance: { accent: '#ff0000' } }).appearance
    ).toMatchObject({
      settingsZoom: 100,
      largeLabels: false,
      noFlashing: false
    })
    expect(normalizeSettings({ appearance: { settingsZoom: 500 } }).appearance.settingsZoom).toBe(
      150
    )
  })

  it('reads Ctrl + / Ctrl − / Ctrl 0 on a Spanish and a US layout and on the keypad', () => {
    expect(zoomStepOf(key('+', 'BracketRight'))).toBe('in')
    expect(zoomStepOf(key('=', 'Equal'))).toBe('in')
    expect(zoomStepOf(key('+', 'NumpadAdd'))).toBe('in')
    expect(zoomStepOf(key('-', 'Slash'))).toBe('out')
    expect(zoomStepOf(key('-', 'NumpadSubtract'))).toBe('out')
    expect(zoomStepOf(key('0', 'Digit0'))).toBe('reset')
    expect(zoomStepOf(key('0', 'Numpad0'))).toBe('reset')
  })

  it('ignores the keys without Ctrl, with AltGr, and every other key', () => {
    expect(zoomStepOf(key('+', 'BracketRight', { ctrlKey: false }))).toBeNull()
    expect(zoomStepOf(key('+', 'BracketRight', { altKey: true }))).toBeNull()
    expect(zoomStepOf(key('f', 'KeyF'))).toBeNull()
  })

  it('steps by 10 % within 80..150, back to 100 % with Ctrl 0', () => {
    expect(nextZoom(100, 'in')).toBe(110)
    expect(nextZoom(100, 'out')).toBe(90)
    expect(nextZoom(150, 'in')).toBe(150)
    expect(nextZoom(80, 'out')).toBe(80)
    expect(nextZoom(130, 'reset')).toBe(100)
    // A value off the grid lands on it.
    expect(nextZoom(125, 'in')).toBe(130)
    expect(nextZoom(125, 'out')).toBe(120)
    expect(nextZoom(Number.NaN, 'in')).toBe(110)
  })

  it('gives main the factor, 1 for anything invalid', () => {
    expect(zoomFactor(120)).toBeCloseTo(1.2, 9)
    expect(zoomFactor('x')).toBe(1)
    expect(zoomFactor(10)).toBeCloseTo(0.8, 9)
  })
})
