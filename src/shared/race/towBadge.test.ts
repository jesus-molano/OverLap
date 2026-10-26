import { describe, expect, it } from 'vitest'
import { TOW_BADGE_S, TOW_START_S, ownTowTime, showsTow } from './towBadge'

describe('showsTow', () => {
  const towed = (towedAt: number): { towed: boolean; towedAt: number } => ({ towed: true, towedAt })

  it('another car: for TOW_BADGE_S after it landed in its box', () => {
    expect(showsTow(towed(100), 100, null)).toBe(true)
    expect(showsTow(towed(100), 100 + TOW_BADGE_S - 0.1, null)).toBe(true)
    expect(showsTow(towed(100), 100 + TOW_BADGE_S, null)).toBe(false)
    expect(showsTow({ towed: false, towedAt: 100 }, 101, null)).toBe(false)
    expect(showsTow(towed(NaN), 101, null)).toBe(false)
  })

  it('your own car: while your countdown runs, and the moment before it starts', () => {
    expect(showsTow(towed(100), 100.5, 0)).toBe(true)
    expect(showsTow(towed(100), 100 + TOW_START_S, 0)).toBe(false)
    expect(showsTow(towed(100), 100 + 200, 12.5)).toBe(true)
    expect(showsTow(towed(100), 100 + 30, 0)).toBe(false)
  })

  it('reads your countdown for your car only', () => {
    const frame = { PlayerCarTowTime: [42] }
    expect(ownTowTime(frame, 3, 3)).toBe(42)
    expect(ownTowTime(frame, 2, 3)).toBeNull()
    expect(ownTowTime(frame, -1, -1)).toBeNull()
    expect(ownTowTime({ PlayerCarTowTime: [] }, 3, 3)).toBe(0)
  })
})
