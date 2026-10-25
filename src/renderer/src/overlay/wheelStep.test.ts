import { describe, expect, it } from 'vitest'
import { WHEEL_INTERVAL_MS, createWheelGate, wheelDirection } from './wheelStep'

describe('wheelDirection', () => {
  it('makes the panel bigger on wheel up, smaller on wheel down', () => {
    expect(wheelDirection(-120)).toBe(1)
    expect(wheelDirection(-0.5)).toBe(1)
    expect(wheelDirection(3)).toBe(-1)
  })

  it('ignores events without vertical motion', () => {
    expect(wheelDirection(0)).toBeNull()
    expect(wheelDirection(-0)).toBeNull()
    expect(wheelDirection(Number.NaN)).toBeNull()
  })
})

describe('createWheelGate', () => {
  it('lets one step through per 50 ms, whatever the wheel resolution', () => {
    expect(WHEEL_INTERVAL_MS).toBe(50)
    const gate = createWheelGate()
    expect(gate.accept(1000)).toBe(true)
    expect(gate.accept(1001)).toBe(false)
    expect(gate.accept(1049.9)).toBe(false)
    expect(gate.accept(1050)).toBe(true)
    expect(gate.accept(1060)).toBe(false)
  })

  it('starts over on a timestamp from before the last step', () => {
    const gate = createWheelGate()
    expect(gate.accept(5000)).toBe(true)
    expect(gate.accept(10)).toBe(true)
    expect(gate.accept(20)).toBe(false)
  })
})
