import { describe, expect, it } from 'vitest'
import type { BoundsCommit } from '@shared/ipc'
import type { Rect } from '@shared/types'
import { WIDGET_DEFS } from '@shared/widgets'
import { acceptScaleStep, decideCommit, type CommitContext } from './commitRules'
import type { DisplayInfo } from './overlayLayout'

/** Right of a 1920 px primary: window-local (0, 0) is screen (1920, -200). */
const SECOND: DisplayInfo = {
  id: 2,
  bounds: { x: 1920, y: -200, width: 1707, height: 960 },
  workArea: { x: 1920, y: -200, width: 1707, height: 920 },
  scaleFactor: 1.5
}
const PRIMARY: DisplayInfo = {
  id: 1,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  workArea: { x: 0, y: 0, width: 1920, height: 1040 },
  scaleFactor: 1
}
const RECT: Rect = { x: 100, y: 50, width: 300, height: 200 }
const HEAD = { session: 1, seq: 1 } as const

function ctx(over: Partial<CommitContext> = {}): CommitContext {
  return {
    editing: true,
    hosted: true,
    prefs: { locked: false, autoHeight: true, anchor: 'top' },
    def: WIDGET_DEFS.relative,
    geometryRevision: 5,
    display: SECOND,
    current: { x: 2020, y: -150, width: 300, height: 200 },
    dropTarget: () => ({ cursor: { x: 500, y: 400 }, target: PRIMARY }),
    ...over
  }
}

const drag: BoundsCommit = { ...HEAD, widget: 'relative', kind: 'drag', revision: 5, rect: RECT }
const wheel: BoundsCommit = { ...drag, kind: 'wheel' }
const fit: BoundsCommit = { ...HEAD, widget: 'standings', kind: 'fit', height: 400 }
const drop: BoundsCommit = {
  ...HEAD,
  widget: 'relative',
  kind: 'drop-outside',
  grab: { x: 20, y: 10 },
  size: { width: 460, height: 252 }
}

describe('decideCommit', () => {
  it('accepts a drag in screen DIP, saved now, and a wheel notch, saved later', () => {
    expect(decideCommit(drag, ctx())).toEqual({
      accepted: true,
      rect: { x: 2020, y: -150, width: 300, height: 200 },
      save: 'now'
    })
    expect(decideCommit(wheel, ctx())).toEqual({
      accepted: true,
      rect: { x: 2020, y: -150, width: 300, height: 200 },
      save: 'wheel'
    })
  })

  it('rejects drags and wheel notches outside edit mode, locked, foreign or stale', () => {
    for (const c of [
      ctx({ editing: false }),
      ctx({ prefs: { locked: true, autoHeight: true, anchor: 'top' } }),
      ctx({ hosted: false }),
      ctx({ geometryRevision: 6 })
    ]) {
      expect(decideCommit(drag, c)).toEqual({ accepted: false })
      expect(decideCommit(wheel, c)).toEqual({ accepted: false })
    }
    // A newer revision than the last geometry change is fine.
    expect(decideCommit(drag, ctx({ geometryRevision: 4 })).accepted).toBe(true)
  })

  it('never resizes an auto-height widget with the wheel', () => {
    expect(
      decideCommit({ ...wheel, widget: 'standings' }, ctx({ def: WIDGET_DEFS.standings }))
    ).toEqual({ accepted: false })
  })

  it('fits an auto-height widget within its work area, outside edit mode too', () => {
    const c = ctx({ def: WIDGET_DEFS.standings, editing: false })
    expect(decideCommit(fit, c)).toEqual({
      accepted: true,
      rect: { x: 2020, y: -150, width: 300, height: 400 },
      save: 'fit'
    })
    // The work area ends at 720: at most 870 tall from y = -150.
    expect(decideCommit({ ...fit, height: 9_000 }, c)).toEqual({
      accepted: true,
      rect: { x: 2020, y: -150, width: 300, height: 870 },
      save: 'fit'
    })
  })

  it('rejects a fit that changes nothing, of a free widget or with auto height off', () => {
    const c = ctx({ def: WIDGET_DEFS.standings })
    expect(decideCommit({ ...fit, height: 200 }, c)).toEqual({ accepted: false })
    expect(decideCommit(fit, ctx())).toEqual({ accepted: false })
    expect(
      decideCommit(fit, { ...c, prefs: { locked: false, autoHeight: false, anchor: 'top' } })
    ).toEqual({ accepted: false })
    expect(decideCommit(fit, { ...c, current: undefined })).toEqual({ accepted: false })
  })

  it('places a drop under the cursor on the display there, saved now', () => {
    expect(decideCommit(drop, ctx())).toEqual({
      accepted: true,
      rect: { x: 480, y: 390, width: 460, height: 252 },
      save: 'now'
    })
  })

  it('rejects drops outside edit mode, of locked widgets, or with no display under the cursor', () => {
    let read = 0
    const target = (): ReturnType<CommitContext['dropTarget']> => {
      read++
      return { cursor: { x: 0, y: 0 }, target: undefined }
    }
    expect(decideCommit(drop, ctx({ editing: false, dropTarget: target }))).toEqual({
      accepted: false
    })
    expect(
      decideCommit(
        drop,
        ctx({ prefs: { locked: true, autoHeight: true, anchor: 'top' }, dropTarget: target })
      )
    ).toEqual({ accepted: false })
    // The cursor is only read for a drop that could be accepted.
    expect(read).toBe(0)
    expect(decideCommit(drop, ctx({ dropTarget: target }))).toEqual({ accepted: false })
    expect(read).toBe(1)
  })
})

describe('acceptScaleStep', () => {
  it('takes a notch over an unlocked, hosted auto-height widget in edit mode only', () => {
    const c = ctx({ def: WIDGET_DEFS.standings })
    expect(acceptScaleStep(c)).toBe(true)
    expect(acceptScaleStep({ ...c, editing: false })).toBe(false)
    expect(acceptScaleStep({ ...c, hosted: false })).toBe(false)
    expect(acceptScaleStep({ ...c, prefs: { ...c.prefs, locked: true } })).toBe(false)
    expect(acceptScaleStep(ctx())).toBe(false)
  })
})
