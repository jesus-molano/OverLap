import { describe, expect, it } from 'vitest'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import { relativeLuminance } from '@shared/colors'
import { ABS_COLOR, CLUTCH_TRACE_DIM, mixHex, pedalPalette } from './palette'

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

  it('returns frozen objects', () => {
    const p = pedalPalette(undefined)
    expect(Object.isFrozen(p.vars)).toBe(true)
    expect(Object.isFrozen(p.trace)).toBe(true)
  })
})
