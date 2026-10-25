import { describe, expect, it } from 'vitest'
import type { RadarCar } from '@shared/types'
import {
  LANE_SPACING,
  NO_MARKS,
  PROX_BUCKETS,
  WIDGET_PRECISION,
  markTransform,
  sameMarks,
  toCarMarks,
  type CarMark
} from './geometry'
import { LANE_MAX_STEP_MS, LANE_SNAP_UNITS, LANE_TAU_MS, LaneEaser } from './laneEaser'

const RANGE = 20
const FRAME_MS = 1000 / 60

function car(over: Partial<RadarCar>): RadarCar {
  return {
    carIdx: 1,
    distM: -3,
    lane: 0,
    overlapping: false,
    proximity: 0.8,
    color: '',
    classColor: '#ffffff',
    ...over
  }
}

/** The marks the widget would compute for these cars. */
const marksOf = (...cars: RadarCar[]): readonly CarMark[] =>
  toCarMarks(cars, RANGE, WIDGET_PRECISION)

/** As the widget eases: rounded to its precision. */
const widgetEaser = (): LaneEaser => new LaneEaser({ posSteps: WIDGET_PRECISION.pos })
/** Unrounded, for exact checks of the curve. */
const exactEaser = (): LaneEaser => new LaneEaser({ posSteps: 0, snapUnits: 0 })

function markOf(list: readonly CarMark[], key: string): CarMark {
  const m = list.find((c) => c.key === key)
  if (m === undefined) throw new Error(`no mark ${key}`)
  return m
}

const xOf = (list: readonly CarMark[], key = '1'): number => markOf(list, key).x

/** Share of the way from `from` to `to` that `x` covers. */
const progress = (x: number, from: number, to: number): number => (x - from) / (to - from)

describe('LaneEaser', () => {
  it('draws a car seen for the first time straight at its lane', () => {
    const e = widgetEaser()
    const first = marksOf(car({ lane: -1, overlapping: true }))
    expect(e.ease(first, 0)).toBe(first)
    expect(xOf(first)).toBe(-LANE_SPACING)
    // A newcomer next to a car mid-slide does not slide in either.
    e.ease(marksOf(car({ carIdx: 2, lane: 0 })), 10)
    const out = e.ease(
      marksOf(car({ carIdx: 2, lane: 1, overlapping: true }), car({ carIdx: 3, lane: 2 })),
      10 + FRAME_MS
    )
    expect(xOf(out, '2')).toBeGreaterThan(0)
    expect(xOf(out, '2')).toBeLessThan(LANE_SPACING)
    expect(xOf(out, '3')).toBe(2 * LANE_SPACING)
  })

  it('slides a car to its new lane monotonically, without overshoot, and lands on it', () => {
    for (const [from, to] of [
      [0, -1],
      [-1, 0],
      [0, 2],
      [1, -2]
    ] as const) {
      const e = widgetEaser()
      e.ease(marksOf(car({ lane: from })), 0)
      const fromX = from * LANE_SPACING
      const toX = to * LANE_SPACING
      let prev = fromX
      let t = 0
      let landedAt: number | null = null
      while (t < 600) {
        t += FRAME_MS
        const input = marksOf(car({ lane: to }))
        const out = e.ease(input, t)
        const x = xOf(out)
        const p = progress(x, fromX, toX)
        expect(p).toBeGreaterThanOrEqual(progress(prev, fromX, toX))
        expect(p).toBeLessThanOrEqual(1)
        if (t < 100) expect(p).toBeLessThan(1)
        // Every drawn x is on the widget's 0.1-unit grid.
        expect(x).toBe(Math.round(x * 10) / 10)
        if (x === toX && landedAt === null) landedAt = t
        // Once there it stays there, as the very marks computed.
        if (landedAt !== null) expect(out).toBe(input)
        prev = x
      }
      expect(prev).toBe(toX)
      // The tail ends by snapping: settled well within half a second, even across 4 lanes.
      expect(landedAt).not.toBeNull()
      expect(landedAt ?? Infinity).toBeLessThan(400)
    }
  })

  it('covers about 95 % of the way after three time constants, at any frame rate', () => {
    /** Share of a lane change into lane 1 covered after `ms`, drawn in `frames` even frames. */
    const after = (ms: number, frames: number): number => {
      const e = exactEaser()
      e.ease(marksOf(car({ lane: 0 })), 0)
      let x = 0
      for (let i = 1; i <= frames; i++) {
        x = xOf(e.ease(marksOf(car({ lane: 1 })), (ms * i) / frames))
      }
      return progress(x, 0, LANE_SPACING)
    }
    const tEnd = 3 * LANE_TAU_MS
    // 30 Hz, 60 Hz, 144 Hz and 180 Hz: the same curve.
    for (const frames of [5, 10, 24, 30]) {
      expect(after(tEnd, frames)).toBeCloseTo(1 - Math.exp(-3), 9)
    }
    expect(after(tEnd, 10)).toBeCloseTo(0.95, 2)
    // So 95 % lands within the 150-180 ms the slide is meant to take.
    expect(after(150, 9)).toBeLessThan(0.95)
    expect(after(180, 11)).toBeGreaterThan(0.95)
  })

  it('counts a long gap as LANE_MAX_STEP_MS, a clock going back or no clock as no time', () => {
    // A lane change first seen after a 5 s stall still slides, as after a 100 ms frame.
    const stall = exactEaser()
    stall.ease(marksOf(car({ lane: 0 })), 0)
    const afterStall = progress(xOf(stall.ease(marksOf(car({ lane: -1 })), 5000)), 0, -LANE_SPACING)
    expect(afterStall).toBeCloseTo(1 - Math.exp(-LANE_MAX_STEP_MS / LANE_TAU_MS), 9)
    expect(afterStall).toBeLessThan(0.9)

    // Back in time: nothing moves, and the next frame measures from the new reading.
    const back = exactEaser()
    back.ease(marksOf(car({ lane: 0 })), 1000)
    expect(xOf(back.ease(marksOf(car({ lane: -1 })), 900))).toBe(0)
    const next = progress(
      xOf(back.ease(marksOf(car({ lane: -1 })), 900 + FRAME_MS)),
      0,
      -LANE_SPACING
    )
    expect(next).toBeCloseTo(1 - Math.exp(-FRAME_MS / LANE_TAU_MS), 9)

    // A non-finite reading moves nothing and keeps the last good one.
    const bad = exactEaser()
    bad.ease(marksOf(car({ lane: 0 })), 0)
    expect(xOf(bad.ease(marksOf(car({ lane: -1 })), NaN))).toBe(0)
    const resumed = progress(xOf(bad.ease(marksOf(car({ lane: -1 })), FRAME_MS)), 0, -LANE_SPACING)
    expect(resumed).toBeCloseTo(1 - Math.exp(-FRAME_MS / LANE_TAU_MS), 9)
  })

  it('turns round mid-slide without overshooting either lane', () => {
    const e = widgetEaser()
    e.ease(marksOf(car({ lane: 0 })), 0)
    let t = 0
    let x = 0
    for (let i = 0; i < 3; i++) x = xOf(e.ease(marksOf(car({ lane: -1 })), (t += FRAME_MS)))
    expect(x).toBeLessThan(0)
    for (let i = 0; i < 40; i++) {
      const nx = xOf(e.ease(marksOf(car({ lane: 0 })), (t += FRAME_MS)))
      expect(nx).toBeGreaterThanOrEqual(x)
      expect(nx).toBeLessThanOrEqual(0)
      x = nx
    }
    expect(x).toBe(0)
  })

  it('forgets cars that leave the radar: back later, they appear at their lane', () => {
    const e = widgetEaser()
    e.ease(marksOf(car({ carIdx: 1 }), car({ carIdx: 2, distM: 6 }), car({ carIdx: 3 })), 0)
    expect(e.size).toBe(3)
    e.ease(marksOf(car({ carIdx: 1 })), FRAME_MS)
    expect(e.size).toBe(1)
    // Car 2 was last drawn in lane 0: back in lane 1, it is drawn there at once.
    const back = e.ease(
      marksOf(car({ carIdx: 1 }), car({ carIdx: 2, lane: 1, overlapping: true })),
      2 * FRAME_MS
    )
    expect(xOf(back, '2')).toBe(LANE_SPACING)
    expect(e.size).toBe(2)
    expect(e.ease(NO_MARKS, 3 * FRAME_MS)).toBe(NO_MARKS)
    expect(e.size).toBe(0)
  })

  it('hands a settled frame back untouched, so the widget keeps its previous marks', () => {
    const e = widgetEaser()
    const cars = (): RadarCar[] => [
      car({ carIdx: 1, distM: -2, lane: -1, overlapping: true }),
      car({ carIdx: 2, distM: 8, proximity: 0.5 })
    ]
    const a = marksOf(...cars())
    expect(e.ease(a, 0)).toBe(a)
    const b = marksOf(...cars())
    const out = e.ease(b, FRAME_MS)
    expect(out).toBe(b)
    expect(out[0]).toBe(b[0])
    expect(out[1]).toBe(b[1])
    // What the widget's computed checks before swapping arrays: nothing to re-render.
    expect(sameMarks(a, out)).toBe(true)
  })

  it('while a car slides, changes only its x and transform, sharing every other mark', () => {
    const e = widgetEaser()
    e.ease(marksOf(car({ carIdx: 1, distM: -6 }), car({ carIdx: 2, distM: 9, proximity: 0.4 })), 0)
    let t = 0
    // Car 1 closes in and comes alongside: y, colour step and glow follow the data at once.
    for (const distM of [-4.5, -3, -1.5, 0]) {
      const input = marksOf(
        car({ carIdx: 1, distM, lane: 1, overlapping: true, proximity: 1 }),
        car({ carIdx: 2, distM: 9, proximity: 0.4 })
      )
      const out = e.ease(input, (t += FRAME_MS))
      expect(out).not.toBe(input)
      expect(markOf(out, '2')).toBe(markOf(input, '2'))
      const want = markOf(input, '1')
      const got = markOf(out, '1')
      expect(got.x).toBeGreaterThan(0)
      expect(got.x).toBeLessThan(LANE_SPACING)
      expect(got).toEqual({ ...want, x: got.x, transform: markTransform(got.x, want.y) })
      expect(got.bucket).toBe(PROX_BUCKETS - 1)
      expect(got.overlapping).toBe(true)
      expect(got.opacity).toBe(1)
      expect(out.map((m) => m.key)).toEqual(input.map((m) => m.key))
    }
  })

  it('draws phantom side cars in place and drops them at once', () => {
    const e = widgetEaser()
    const phantom = (lane: -2 | -1 | 1 | 2): RadarCar =>
      car({ carIdx: -1, distM: 0, lane, overlapping: true, proximity: 1 })
    const one = marksOf(car({ carIdx: 4, distM: -7 }), phantom(-1))
    expect(e.ease(one, 0)).toBe(one)
    expect(xOf(one, 'p-1')).toBe(-LANE_SPACING)
    // The phantom becomes a matched car, now drawn in your lane: the phantom is gone.
    e.ease(marksOf(car({ carIdx: 4, distM: -7 })), FRAME_MS)
    expect(e.size).toBe(1)
    // A phantom on the other side appears straight in its lane, as do two on one side.
    const two = marksOf(car({ carIdx: 4, distM: -7 }), phantom(1), phantom(2))
    expect(e.ease(two, 2 * FRAME_MS)).toBe(two)
    expect(xOf(two, 'p1')).toBe(LANE_SPACING)
    expect(xOf(two, 'p2')).toBe(2 * LANE_SPACING)
  })

  it('reset forgets every car: the next frame draws each at its lane', () => {
    const e = widgetEaser()
    e.ease(marksOf(car({ lane: 0 })), 0)
    e.reset()
    expect(e.size).toBe(0)
    const shown = marksOf(car({ lane: -2 }))
    expect(e.ease(shown, 5000)).toBe(shown)
    // The clock restarted too: the next frame's step is one frame, not the time since.
    const out = e.ease(marksOf(car({ lane: -1 })), 5000 + FRAME_MS)
    expect(xOf(out)).toBeLessThan(-LANE_SPACING)
    expect(xOf(out)).toBeGreaterThan(-2 * LANE_SPACING)
  })

  it('a lane that is not a number never sticks to the car and costs no mark per frame', () => {
    /** The car's marks with x replaced, as toCarMarks would build them. */
    const withX = (list: readonly CarMark[], x: number): readonly CarMark[] =>
      list.map((m) => ({ ...m, x, transform: markTransform(x, m.y) }))
    for (const firstX of [0, NaN]) {
      const e = widgetEaser()
      e.ease(withX(marksOf(car({ lane: 0 })), firstX), 0)
      let t = 0
      // While x is not a number the marks go through untouched, frame after frame.
      for (let i = 0; i < 3; i++) {
        const bad = withX(marksOf(car({ lane: 0 })), NaN)
        expect(e.ease(bad, (t += FRAME_MS))).toBe(bad)
      }
      // Valid again: drawn at its lane at once (nothing to slide from), never stuck at NaN.
      const back = marksOf(car({ lane: -1, overlapping: true }))
      expect(e.ease(back, (t += FRAME_MS))).toBe(back)
      expect(xOf(back)).toBe(-LANE_SPACING)
      // And the next lane change slides as usual.
      const x = xOf(e.ease(marksOf(car({ lane: 0 })), t + FRAME_MS))
      expect(x).toBeGreaterThan(-LANE_SPACING)
      expect(x).toBeLessThan(0)
    }
  })

  it('snaps onto the lane within LANE_SNAP_UNITS', () => {
    const e = new LaneEaser({ posSteps: 0 })
    e.ease(marksOf(car({ lane: 0 })), 0)
    let t = 0
    let x = 0
    let out: readonly CarMark[] = NO_MARKS
    let input: readonly CarMark[] = NO_MARKS
    while (x !== -LANE_SPACING && t < 1000) {
      input = marksOf(car({ lane: -1 }))
      out = e.ease(input, (t += 1))
      const nx = xOf(out)
      if (nx !== -LANE_SPACING) expect(nx + LANE_SPACING).toBeGreaterThan(LANE_SNAP_UNITS)
      x = nx
    }
    expect(x).toBe(-LANE_SPACING)
    expect(out).toBe(input)
  })
})
