import { describe, expect, it } from 'vitest'
import { contentHeightPx, createContentSizeReporter, type ContentSizeReporter } from './contentSize'

describe('contentHeightPx', () => {
  it('rounds up to whole pixels, ignoring float noise', () => {
    expect(contentHeightPx(296.4)).toBe(297)
    expect(contentHeightPx(296)).toBe(296)
    expect(contentHeightPx(296.000001)).toBe(296)
  })

  it('rejects unusable heights', () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(contentHeightPx(bad)).toBeNull()
    }
  })
})

describe('createContentSizeReporter', () => {
  function setup(): { sent: number[]; r: ContentSizeReporter } {
    const sent: number[] = []
    return { sent, r: createContentSizeReporter((h) => sent.push(h)) }
  }

  it('sends only when the whole-pixel height changes', () => {
    const { sent, r } = setup()
    r.report(296.2)
    r.report(296.7)
    r.report(296.9)
    r.report(310)
    r.report(310)
    expect(sent).toEqual([297, 310])
    expect(r.last).toBe(310)
  })

  it('ignores unusable heights without forgetting the last one', () => {
    const { sent, r } = setup()
    r.report(100)
    r.report(Number.NaN)
    r.report(0)
    r.report(100)
    expect(sent).toEqual([100])
  })

  it('re-sends an equal height after reset', () => {
    const { sent, r } = setup()
    r.report(100)
    r.reset()
    expect(r.last).toBeNull()
    r.report(100)
    expect(sent).toHaveLength(2)
  })

  it('depends on its input only (a granted height cannot feed back)', () => {
    const a = setup()
    const b = setup()
    for (const h of [120, 120.4, 180, 180, 64]) {
      a.r.report(h)
      b.r.report(h)
    }
    expect(a.sent).toEqual(b.sent)
    expect(a.sent).toEqual([120, 121, 180, 64])
  })
})
