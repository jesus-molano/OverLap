import { describe, expect, it } from 'vitest'
import { DAY_READABLE_ALPHA, dayUnreadable } from './opacityNote'

describe('dayUnreadable', () => {
  it('warns only over the «Día» preview, below 60 %', () => {
    expect(DAY_READABLE_ALPHA).toBe(0.6)
    expect(dayUnreadable('light', 0.5)).toBe(true)
    expect(dayUnreadable('light', 0.59)).toBe(true)
    expect(dayUnreadable('light', 0.6)).toBe(false)
    expect(dayUnreadable('light', 0.8)).toBe(false)
    expect(dayUnreadable('dark', 0.2)).toBe(false)
  })
})
