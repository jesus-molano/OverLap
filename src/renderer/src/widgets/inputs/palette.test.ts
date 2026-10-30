import { describe, expect, it } from 'vitest'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import { relativeLuminance } from '@shared/colors'
import {
  ABS_COLOR,
  CLUTCH_TRACE_DIM,
  CVD_ABS_COLOR,
  CVD_PEDALS,
  mixHex,
  pedalPalette
} from './palette'

describe('mixHex', () => {
  it('mixes opaque colours per channel', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(mixHex('#4aa3ff', '#0c0e12', 0)).toBe('#4aa3ff')
    expect(mixHex('#4aa3ff', '#0c0e12', 1)).toBe('#0c0e12')
    expect(mixHex('#ff0000', '#0000ff', 2)).toBe('#0000ff')
    expect(mixHex('#ff0000', '#0000ff', -1)).toBe('#ff0000')
  })
})

describe('pedalPalette', () => {
  it('one source for the bars and the trace', () => {
    const p = pedalPalette({ throttle: '#22C55E', brake: '#f43f5e', clutch: '#a78bfa' })
    expect(p.vars).toEqual({
      '--ov-throttle': '#22c55e',
      '--ov-brake': '#f43f5e',
      '--ov-clutch': '#a78bfa',
      '--ov-abs': ABS_COLOR
    })
    expect(p.trace.throttle).toBe(p.vars['--ov-throttle'])
    expect(p.trace.brake).toBe(p.vars['--ov-brake'])
    expect(p.trace.abs).toBe(ABS_COLOR)
  })

  it('the trace clutch is the bar colour pushed back towards the panel, still opaque', () => {
    const p = pedalPalette(OPTION_SCHEMA.inputs.colors.default)
    expect(p.trace.clutch).toMatch(/^#[0-9a-f]{6}$/)
    expect(p.trace.clutch).toBe(mixHex('#4aa3ff', '#0c0e12', CLUTCH_TRACE_DIM))
    expect(relativeLuminance(p.trace.clutch)!).toBeLessThan(relativeLuminance('#4aa3ff')!)
  })

  it('malformed or missing colours fall back to the defaults', () => {
    const d = OPTION_SCHEMA.inputs.colors.default
    expect(pedalPalette({ throttle: 'green', brake: '#12345', clutch: '' }).vars).toMatchObject({
      '--ov-throttle': d.throttle,
      '--ov-brake': d.brake,
      '--ov-clutch': d.clutch
    })
    expect(pedalPalette(undefined).trace.throttle).toBe(d.throttle)
  })

  it('turns the default colours blue and orange with the colour-blind palette (R36)', () => {
    const d = OPTION_SCHEMA.inputs.colors.default
    const p = pedalPalette(d, true)
    expect(p.vars).toEqual({
      '--ov-throttle': CVD_PEDALS.throttle,
      '--ov-brake': CVD_PEDALS.brake,
      '--ov-clutch': CVD_PEDALS.clutch,
      '--ov-abs': CVD_ABS_COLOR
    })
    expect(p.trace.abs).toBe(CVD_ABS_COLOR)
    // Brake and throttle apart by lightness too, not only by hue.
    const lum = (c: string): number => relativeLuminance(c) ?? 0
    expect(Math.abs(lum(CVD_PEDALS.throttle) - lum(CVD_PEDALS.brake))).toBeGreaterThan(0.05)
    // ABS is apart from the orange brake.
    expect(CVD_ABS_COLOR).not.toBe(CVD_PEDALS.brake)
  })

  it('keeps a colour you chose under the colour-blind palette, and changes nothing without it', () => {
    const d = OPTION_SCHEMA.inputs.colors.default
    const p = pedalPalette({ ...d, brake: '#f43f5e' }, true)
    expect(p.vars['--ov-brake']).toBe('#f43f5e')
    expect(p.vars['--ov-throttle']).toBe(CVD_PEDALS.throttle)
    expect(pedalPalette(d).vars).toEqual({
      '--ov-throttle': d.throttle,
      '--ov-brake': d.brake,
      '--ov-clutch': d.clutch,
      '--ov-abs': ABS_COLOR
    })
  })

  it('returns frozen objects', () => {
    const p = pedalPalette(undefined)
    expect(Object.isFrozen(p.vars)).toBe(true)
    expect(Object.isFrozen(p.trace)).toBe(true)
  })
})
