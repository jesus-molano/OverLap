import { describe, expect, it } from 'vitest'
import { LAPS_TO_GO, LapsToGo } from './lapsToGo'

describe('LapsToGo', () => {
  it('shows each mark for showS once the laps to go reach it, once', () => {
    const l = new LapsToGo()
    expect(l.update(0, 11.4)).toBeNull()
    expect(l.update(1, 11.01)).toBeNull()
    // 10.98 laps to go: the lap you are on is the 11th from the end; 9.98 is the 10th.
    expect(l.update(2, 10.98)).toBeNull()
    expect(l.update(3, 9.98)).toBe(10)
    expect(l.update(3 + LAPS_TO_GO.showS - 0.1, 9.5)).toBe(10)
    expect(l.update(3 + LAPS_TO_GO.showS, 9.4)).toBeNull()
    // The estimate going back over the mark and down again does not show it twice.
    l.update(20, 10.2)
    expect(l.update(21, 9.9)).toBeNull()
    expect(l.update(100, 4.9)).toBe(5)
    expect(l.update(200, 0.5)).toBeNull()
  })

  it('needs a known count before the mark: joining with fewer laps left shows nothing', () => {
    const l = new LapsToGo()
    expect(l.update(0, 7)).toBeNull()
    expect(l.update(1, null)).toBeNull()
    expect(l.update(2, 6)).toBeNull()
    expect(l.update(3, 5)).toBe(5)
  })

  it('a jump over both marks shows the nearer one; the finish shows none', () => {
    const l = new LapsToGo()
    l.update(0, 12)
    expect(l.update(1, 4)).toBe(5)
    const f = new LapsToGo()
    f.update(0, 6)
    expect(f.update(1, 0)).toBeNull()
  })

  it('keeps what was shown across resume(); reset() is a new session', () => {
    const l = new LapsToGo()
    l.update(0, 11)
    expect(l.update(1, 10)).toBe(10)
    l.resume()
    expect(l.update(2, 10)).toBeNull()
    l.update(3, 11)
    expect(l.update(4, 10)).toBeNull()
    l.reset()
    l.update(5, 11)
    expect(l.update(6, 10)).toBe(10)
  })

  it('holds a mark longer with a longer showS', () => {
    const l = new LapsToGo()
    l.update(0, 11)
    l.update(1, 10)
    expect(l.update(9, 9.9, 10)).toBe(10)
    expect(l.update(11, 9.8, 10)).toBeNull()
  })
})
