import { describe, expect, it } from 'vitest'
import { WIDGET_SCALE_MAX as SCALE_MAX, WIDGET_SCALE_MIN as SCALE_MIN } from '@shared/settings'
import {
  fitHeight,
  isEditDragMessage,
  isEditScaleMessage,
  parseContentHeight,
  scaleAroundCentre,
  snapAreas,
  stepScale,
  windowShown,
  workAreaFor
} from './windowMath'

const WORK = { x: 0, y: 0, width: 1920, height: 1040 }

describe('parseContentHeight', () => {
  it('rounds and raises small heights to the minimum', () => {
    expect(parseContentHeight({ height: 296.4 }, 60)).toBe(296)
    expect(parseContentHeight({ height: 12 }, 60)).toBe(60)
  })

  it('rejects anything that is not a sane height', () => {
    for (const raw of [
      null,
      296,
      {},
      { height: '296' },
      { height: Number.NaN },
      { height: Infinity },
      { height: 0 },
      { height: -5 },
      { height: 20_000 }
    ]) {
      expect(parseContentHeight(raw, 60), JSON.stringify(raw)).toBeNull()
    }
  })
})

describe('fitHeight', () => {
  const bounds = { x: 100, y: 200, width: 460, height: 470 }

  it('top anchor keeps y and grows or shrinks downwards', () => {
    expect(fitHeight(bounds, 296, 'top', WORK, 60)).toEqual({ ...bounds, height: 296 })
    expect(fitHeight(bounds, 600, 'top', WORK, 60)).toEqual({ ...bounds, height: 600 })
  })

  it('top anchor never grows past the bottom of the work area', () => {
    // 1040 - 200 = 840 available below y.
    expect(fitHeight(bounds, 2000, 'top', WORK, 60)).toEqual({ ...bounds, height: 840 })
  })

  it('bottom anchor keeps the bottom edge and stops at the top of the work area', () => {
    const bottom = bounds.y + bounds.height
    expect(fitHeight(bounds, 300, 'bottom', WORK, 60)).toEqual({
      ...bounds,
      y: bottom - 300,
      height: 300
    })
    expect(fitHeight(bounds, 2000, 'bottom', WORK, 60)).toEqual({ ...bounds, y: 0, height: bottom })
  })

  it('respects the work area of a display placed above or left of the primary one', () => {
    const work = { x: -1920, y: -1080, width: 1920, height: 1040 }
    const b = { x: -1800, y: -1000, width: 300, height: 100 }
    expect(fitHeight(b, 5000, 'top', work, 60)?.height).toBe(-40 - -1000)
  })

  it('never goes below the minimum height, even without room', () => {
    const low = { ...bounds, y: 1020 }
    expect(fitHeight(low, 400, 'top', WORK, 60)).toEqual({ ...low, height: 60 })
    expect(fitHeight(bounds, 10, 'top', WORK, 60)).toEqual({ ...bounds, height: 60 })
  })

  it('ignores changes under 1 DIP', () => {
    expect(fitHeight(bounds, 470, 'top', WORK, 60)).toBeNull()
    expect(fitHeight(bounds, 470.4, 'bottom', WORK, 60)).toBeNull()
  })

  it('is a pure function of its inputs (no feedback from the granted height)', () => {
    const a = fitHeight(bounds, 2000, 'top', WORK, 60)
    const b = a && fitHeight(a, 2000, 'top', WORK, 60)
    expect(b).toBeNull()
  })
})

describe('stepScale', () => {
  it('moves to the next multiple of 5 in the wheel direction', () => {
    expect(stepScale(100, 1)).toBe(105)
    expect(stepScale(100, -1)).toBe(95)
    expect(stepScale(103, 1)).toBe(105)
    expect(stepScale(103, -1)).toBe(100)
  })

  it('stays within the scale range', () => {
    expect(stepScale(SCALE_MAX, 1)).toBe(SCALE_MAX)
    expect(stepScale(SCALE_MIN, -1)).toBe(SCALE_MIN)
    expect(stepScale(500, -1)).toBe(SCALE_MAX)
    expect(stepScale(Number.NaN, 1)).toBe(105)
  })
})

describe('scaleAroundCentre', () => {
  const display = { x: 0, y: 0, width: 1920, height: 1080 }
  const min = { width: 300, height: 150 }
  const centre = (r: { x: number; y: number; width: number; height: number }): number[] => [
    r.x + r.width / 2,
    r.y + r.height / 2
  ]

  it('grows and shrinks by 5 % around the centre, keeping the aspect ratio', () => {
    const b = { x: 400, y: 300, width: 400, height: 200 }
    const up = scaleAroundCentre(b, 1, min, display)
    expect(up).toEqual({ x: 390, y: 295, width: 420, height: 210 })
    expect(centre(up)).toEqual(centre(b))
    const down = scaleAroundCentre(up, -1, min, display)
    expect(down).toEqual(b)
  })

  it('stops at the minimum size without distorting the ratio', () => {
    const b = { x: 400, y: 300, width: 305, height: 300 }
    const down = scaleAroundCentre(b, -1, min, display)
    expect(down.width).toBe(300)
    expect(down.height).toBe(Math.round(300 * (300 / 305)))
    expect(scaleAroundCentre(down, -1, min, display)).toEqual(down)
  })

  it('stops at the display size and stays inside it', () => {
    const b = { x: 0, y: 0, width: 1900, height: 500 }
    const up = scaleAroundCentre(b, 1, min, display)
    expect(up.width).toBe(1920)
    expect(up.x).toBe(0)
    expect(up.y).toBeGreaterThanOrEqual(0)
  })
})

describe('workAreaFor / snapAreas', () => {
  const left = {
    bounds: { x: -1920, y: 0, width: 1920, height: 1080 },
    workArea: { x: -1920, y: 0, width: 1920, height: 1080 }
  }
  const primary = { bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: WORK }

  it('picks the work area of the display the rect is on', () => {
    expect(workAreaFor({ x: 100, y: 100, width: 50, height: 50 }, [left, primary])).toBe(WORK)
    expect(workAreaFor({ x: -500, y: 100, width: 50, height: 50 }, [left, primary])).toBe(
      left.workArea
    )
    expect(workAreaFor({ x: 0, y: 0, width: 1, height: 1 }, [])).toBeUndefined()
  })

  it('lists every display edge once, work areas included', () => {
    expect(snapAreas([left, primary])).toEqual([left.bounds, primary.bounds, WORK])
  })
})

describe('windowShown', () => {
  it('shows enabled widgets unless a rule hides them, and previews them in edit mode', () => {
    const cases: [boolean, boolean, boolean, boolean][] = [
      // userVisible, autoHidden, editing -> shown
      [true, false, false, true],
      [true, true, false, false],
      [true, true, true, true],
      [false, false, false, false],
      [false, false, true, false],
      [false, true, true, false]
    ]
    for (const [userVisible, autoHidden, editing, shown] of cases) {
      expect(windowShown({ userVisible, autoHidden, editing })).toBe(shown)
    }
  })
})

describe('edit message validation', () => {
  it('accepts drags with a known phase and mode only', () => {
    expect(isEditDragMessage({ phase: 'move', mode: 'se', dx: 0, dy: 0 })).toBe(true)
    expect(isEditDragMessage({ phase: 'start', mode: 'move' })).toBe(true)
    for (const raw of [
      null,
      'move',
      {},
      { phase: 'drag', mode: 'move' },
      { phase: 'move', mode: 'nesw' },
      { phase: 'toString', mode: 'move' }
    ]) {
      expect(isEditDragMessage(raw), JSON.stringify(raw)).toBe(false)
    }
  })

  it('accepts one wheel notch up or down only', () => {
    expect(isEditScaleMessage({ step: 1 })).toBe(true)
    expect(isEditScaleMessage({ step: -1 })).toBe(true)
    for (const raw of [null, 1, {}, { step: 2 }, { step: '1' }, { step: 0 }]) {
      expect(isEditScaleMessage(raw), JSON.stringify(raw)).toBe(false)
    }
  })
})
