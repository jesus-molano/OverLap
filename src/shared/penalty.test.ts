import { describe, expect, it } from 'vitest'
import { SessionFlag } from './flags'
import { penaltyOf } from './penalty'

describe('penaltyOf', () => {
  it('names the flag badge, most serious first', () => {
    expect(penaltyOf(0)).toBeNull()
    expect(penaltyOf(SessionFlag.Black)).toBe('black')
    expect(penaltyOf(SessionFlag.Disqualify)).toBe('black')
    expect(penaltyOf(SessionFlag.Repair)).toBe('meatball')
    expect(penaltyOf(SessionFlag.Furled)).toBe('furled')
    expect(penaltyOf(SessionFlag.Furled | SessionFlag.Repair)).toBe('meatball')
    expect(penaltyOf(SessionFlag.Furled | SessionFlag.Black)).toBe('black')
  })

  it('ignores the other bits, the signed start-go bit included', () => {
    expect(penaltyOf(SessionFlag.Blue | SessionFlag.Servicible)).toBeNull()
    // 0x80000000 arrives as a negative Int32.
    expect(penaltyOf(0x80000000 | SessionFlag.Furled)).toBe('furled')
    expect(penaltyOf(0x80000000 | 0)).toBeNull()
  })

  it('no furled badge for a car that already took the flag (Q3: seen online after a finish)', () => {
    expect(penaltyOf(SessionFlag.Furled | SessionFlag.Servicible, true)).toBeNull()
    expect(penaltyOf(SessionFlag.Furled, false)).toBe('furled')
    // The penalties still show.
    expect(penaltyOf(SessionFlag.Furled | SessionFlag.Black, true)).toBe('black')
    expect(penaltyOf(SessionFlag.Repair, true)).toBe('meatball')
  })

  it('reads a missing or broken value as no flag', () => {
    expect(penaltyOf(undefined)).toBeNull()
    expect(penaltyOf(Number.NaN)).toBeNull()
  })
})
