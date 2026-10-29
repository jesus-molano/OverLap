import { describe, expect, it } from 'vitest'
import { USED_SHOWN_S, usedAgo } from './shortcutUsed'

describe('usedAgo (R37)', () => {
  it('counts whole seconds since the press, for a minute', () => {
    expect(usedAgo(undefined, 5_000)).toBeNull()
    expect(usedAgo(1_000, 1_400)).toBe(0)
    expect(usedAgo(1_000, 4_999)).toBe(3)
    expect(usedAgo(0, (USED_SHOWN_S - 1) * 1000)).toBe(USED_SHOWN_S - 1)
    expect(usedAgo(0, USED_SHOWN_S * 1000)).toBeNull()
  })

  it('reads a press newer than the clock as just now', () => {
    expect(usedAgo(2_000, 1_500)).toBe(0)
  })
})
