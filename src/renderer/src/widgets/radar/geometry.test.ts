import { describe, it, expect } from 'vitest'
import { RADAR } from '@shared/radar'
import type { RadarCar } from '@shared/types'
import {
  ALERT_BAR_INSET,
  ALERT_BLOOM_PAD,
  BEZEL,
  BEZEL_INSET,
  BEZEL_TOP_PATH,
  BG_HALF,
  BG_RADIUS,
  BUCKET_CLASSES,
  CAR_ALONGSIDE_GLOW,
  CAR_BODY,
  CAR_GLASS,
  CAR_H,
  CAR_HALO_INNER,
  CAR_RX,
  CAR_W,
  LABEL_FONT,
  LABEL_FONT_MAX,
  LABEL_MIN_PX,
  LABEL_X,
  LANE_SPACING,
  NO_MARKS,
  PLAYER_HALO_INNER,
  PROX_BUCKETS,
  RANGE_UNITS,
  WIDGET_PRECISION,
  centeredRect,
  distToY,
  edgeOpacity,
  labelFontUnits,
  laneToX,
  markTransform,
  proximityBucket,
  rangeGuides,
  sameMarks,
  sideAlertStyle,
  toCarMarks,
  type CarMark,
  type CenteredRect,
  type MarkPrecision
} from './geometry'

const L = RADAR.carLengthM

/** True when (x, y) lies inside the rounded-square background (on its edge counts). */
function insideBackground(x: number, y: number): boolean {
  const corner = BG_HALF - BG_RADIUS
  const dx = Math.max(0, Math.abs(x) - corner)
  const dy = Math.max(0, Math.abs(y) - corner)
  return Math.abs(x) <= BG_HALF && Math.abs(y) <= BG_HALF && Math.hypot(dx, dy) <= BG_RADIUS
}
const FADE = RADAR.edgeFadeFrac
const RANGES = [RADAR.minRangeM, 7.5, 10, 20, 30, 50, RADAR.maxRangeM]

function car(over: Partial<RadarCar>): RadarCar {
  return {
    carIdx: 1,
    distM: 0,
    lane: 0,
    overlapping: false,
    proximity: 0.5,
    color: '#00ff00',
    classColor: '#ffffff',
    ...over
  }
}

describe('distToY', () => {
  it('keeps one car length equal to one icon at every range', () => {
    for (const r of RANGES) {
      expect(distToY(L, r)).toBeCloseTo(-CAR_H)
      expect(distToY(-L, r)).toBeCloseTo(CAR_H)
    }
  })

  it('is continuous at one car length', () => {
    for (const r of RANGES) {
      expect(distToY(L - 1e-6, r)).toBeCloseTo(distToY(L + 1e-6, r), 3)
    }
  })

  it('is strictly decreasing and symmetric within the range', () => {
    for (const r of RANGES) {
      let prev = Infinity
      for (let i = -100; i <= 100; i++) {
        const d = (i / 100) * r
        const y = distToY(d, r)
        expect(y).toBeLessThan(prev)
        expect(distToY(-d, r)).toBeCloseTo(-y)
        prev = y
      }
    }
  })

  it('spreads the rest of the range linearly beyond one car length', () => {
    expect(distToY(L + (20 - L) / 2, 20)).toBeCloseTo(-(CAR_H + (RANGE_UNITS - CAR_H) / 2))
  })

  it('maps the range edge to RANGE_UNITS and clamps beyond it', () => {
    expect(distToY(20, 20)).toBeCloseTo(-RANGE_UNITS)
    expect(distToY(-20, 20)).toBeCloseTo(RANGE_UNITS)
    expect(distToY(100, 20)).toBe(-RANGE_UNITS)
    expect(distToY(-100, 20)).toBe(RANGE_UNITS)
  })

  it('falls back to a linear scale for ranges no longer than a car', () => {
    expect(distToY(L / 2, L)).toBeCloseTo(-RANGE_UNITS / 2)
    expect(distToY(-1, 4)).toBeCloseTo(RANGE_UNITS / 4)
    expect(distToY(10, 4)).toBe(-RANGE_UNITS)
  })

  it('returns 0 at the player and for invalid input', () => {
    expect(distToY(0, 20)).toBe(0)
    expect(distToY(5, 0)).toBe(0)
    expect(distToY(5, -3)).toBe(0)
    expect(distToY(5, Infinity)).toBe(0)
    expect(distToY(Number.NaN, 20)).toBe(0)
    expect(distToY(Infinity, 20)).toBe(0)
    expect(distToY(5, Number.NaN)).toBe(0)
  })
})

describe('laneToX', () => {
  it('negative lanes are left', () => {
    expect(laneToX(-2)).toBe(-2 * LANE_SPACING)
    expect(laneToX(1)).toBe(LANE_SPACING)
    expect(laneToX(0)).toBe(0)
  })
})

describe('edgeOpacity', () => {
  it('is 1 inside the fade band, 0 at the edge, linear across the band', () => {
    expect(edgeOpacity(0, 20)).toBe(1)
    expect(edgeOpacity((1 - FADE) * 20, 20)).toBeCloseTo(1)
    expect(edgeOpacity(-(1 - FADE / 2) * 20, 20)).toBeCloseTo(0.5)
    expect(edgeOpacity(20, 20)).toBe(0)
    expect(edgeOpacity(25, 20)).toBe(0)
  })

  it('scales the band with the range, as computeRadar does for the panel thresholds', () => {
    for (const r of RANGES) {
      // computeRadar shows the panel at ~50% opacity and hides it at ~25%.
      expect(edgeOpacity(r * (1 - FADE / 2), r)).toBeCloseTo(0.5)
      expect(edgeOpacity(r * (1 - FADE / 4), r)).toBeCloseTo(0.25)
    }
  })

  it('is 0 for invalid input', () => {
    expect(edgeOpacity(5, 0)).toBe(0)
    expect(edgeOpacity(5, -20)).toBe(0)
    expect(edgeOpacity(Number.NaN, 20)).toBe(0)
  })
})

describe('proximityBucket', () => {
  it('steps from 0 at the edge of the range to the top step touching', () => {
    expect(proximityBucket(0, false)).toBe(0)
    expect(proximityBucket(1, false)).toBe(PROX_BUCKETS - 1)
    expect(proximityBucket(0.5, false)).toBe(Math.round((PROX_BUCKETS - 1) / 2))
    expect(proximityBucket(0.04, false)).toBe(0)
    expect(proximityBucket(0.96, false)).toBe(PROX_BUCKETS - 1)
  })

  it('never decreases as a car closes in', () => {
    let prev = 0
    for (let i = 0; i <= 1000; i++) {
      const b = proximityBucket(i / 1000, false)
      expect(b).toBeGreaterThanOrEqual(prev)
      expect(b - prev).toBeLessThanOrEqual(1)
      prev = b
    }
    expect(prev).toBe(PROX_BUCKETS - 1)
  })

  it('puts a car alongside on the top step and clamps bad input', () => {
    expect(proximityBucket(0, true)).toBe(PROX_BUCKETS - 1)
    expect(proximityBucket(Number.NaN, true)).toBe(PROX_BUCKETS - 1)
    expect(proximityBucket(Number.NaN, false)).toBe(0)
    expect(proximityBucket(-3, false)).toBe(0)
    expect(proximityBucket(7, false)).toBe(PROX_BUCKETS - 1)
  })

  it('has one shared class per step', () => {
    expect(BUCKET_CLASSES).toHaveLength(PROX_BUCKETS)
    expect(BUCKET_CLASSES[0]).toBe('rc-0')
    expect(BUCKET_CLASSES[PROX_BUCKETS - 1]).toBe(`rc-${PROX_BUCKETS - 1}`)
    expect(Object.isFrozen(BUCKET_CLASSES)).toBe(true)
  })
})

describe('toCarMarks', () => {
  it('positions cars and keeps their proximity step and class colour', () => {
    const [m] = toCarMarks(
      [car({ carIdx: 7, distM: L, lane: -1, proximity: 0.3, color: 'red' })],
      20
    )
    expect(m).toEqual({
      key: '7',
      x: -LANE_SPACING,
      y: -CAR_H,
      transform: `translate(${-LANE_SPACING} ${-CAR_H})`,
      bucket: proximityBucket(0.3, false),
      classColor: '#ffffff',
      overlapping: false,
      opacity: 1
    })
  })

  it('draws a car alongside on the top step, whatever its proximity says', () => {
    const [m] = toCarMarks([car({ lane: 1, overlapping: true, proximity: 0 })], 20)
    expect(m?.bucket).toBe(PROX_BUCKETS - 1)
  })

  it('puts a car at half range on the half-range guide', () => {
    for (const r of RANGES) {
      const [m] = toCarMarks([car({ distM: r / 2 })], r)
      expect(m?.transform).toBe(`translate(0 ${rangeGuides(r).halfY})`)
    }
  })

  it('draws the closest car last without mutating the input', () => {
    const cars = [car({ carIdx: 1, proximity: 0.9 }), car({ carIdx: 2, proximity: 0.1 })]
    const marks = toCarMarks(cars, 20)
    expect(marks.map((m) => m.key)).toEqual(['2', '1'])
    expect(cars.map((c) => c.carIdx)).toEqual([1, 2])
  })

  it('keys phantoms by lane and keeps keys unique', () => {
    const marks = toCarMarks(
      [
        car({ carIdx: -1, lane: -1 }),
        car({ carIdx: -1, lane: -1 }),
        car({ carIdx: -1, lane: 2 }),
        car({ carIdx: 3 })
      ],
      20
    )
    expect(marks.map((m) => m.key)).toEqual(['p-1', 'p-1#2', 'p2', '3'])
  })

  it('fades cars over the outer band unless they overlap, dropping invisible ones', () => {
    const marks = toCarMarks(
      [
        car({ carIdx: 1, distM: 20 }),
        car({ carIdx: 2, distM: -20, lane: 1, overlapping: true }),
        car({ carIdx: 3, distM: 20 * (1 - FADE / 4) })
      ],
      20
    )
    expect(marks.map((m) => m.key)).toEqual(['2', '3'])
    expect(marks[0]?.opacity).toBe(1)
    expect(marks[1]?.opacity).toBeCloseTo(0.25)
  })

  it('returns the shared frozen NO_MARKS when there is nothing to draw', () => {
    expect(toCarMarks([], 20)).toBe(NO_MARKS)
    expect(toCarMarks([car({ distM: 20 })], 20)).toBe(NO_MARKS)
    expect(Object.isFrozen(NO_MARKS)).toBe(true)
    expect(NO_MARKS).toHaveLength(0)
  })

  it('rounds coordinates for compact transforms', () => {
    const [m] = toCarMarks([car({ distM: 1 / 3, lane: 0 })], 7)
    expect(m?.transform).toBe('translate(0 -1.09)')
    expect(m?.y).toBe(-1.09)
  })

  it('builds the transform from the rounded centre', () => {
    for (const lane of [-2, -1, 0, 1, 2] as const) {
      const [m] = toCarMarks([car({ distM: -3.3, lane })], 20, WIDGET_PRECISION)
      expect(m?.x).toBe(laneToX(lane))
      expect(m?.transform).toBe(markTransform(m?.x ?? NaN, m?.y ?? NaN))
    }
    expect(markTransform(-6.5, 0)).toBe('translate(-6.5 0)')
  })
})

describe('toCarMarks with WIDGET_PRECISION', () => {
  const W = WIDGET_PRECISION

  it('rounds positions to 0.1 units and opacity to 1/50', () => {
    expect(toCarMarks([car({ distM: 1 / 3 })], 7, W)[0]?.transform).toBe('translate(0 -1.1)')
    const [m] = toCarMarks([car({ distM: 20 * (1 - FADE * 0.373) })], 20, W)
    expect(m?.opacity).toBe(0.38)
  })

  it('drops a car whose opacity rounds to 0', () => {
    const cars = [car({ distM: 20 * (1 - FADE * 0.009) })]
    expect(toCarMarks(cars, 20)).toHaveLength(1)
    expect(toCarMarks(cars, 20, W)).toBe(NO_MARKS)
  })

  it('draws the same marks for jitter below one step, but follows real movement', () => {
    const at = (distM: number, p?: MarkPrecision): readonly CarMark[] =>
      toCarMarks([car({ distM })], 20, p)
    expect(sameMarks(at(10, W), at(10.01, W))).toBe(true)
    expect(sameMarks(at(10), at(10.01))).toBe(false)
    expect(sameMarks(at(10, W), at(10.1, W))).toBe(false)
  })

  it('keeps the marks while the proximity moves within one colour step', () => {
    const at = (proximity: number): readonly CarMark[] =>
      toCarMarks([car({ distM: 10, proximity })], 20, W)
    expect(sameMarks(at(0.5), at(0.52))).toBe(true)
    expect(sameMarks(at(0.5), at(0.6))).toBe(false)
  })
})

describe('sameMarks', () => {
  const mark = (over: Partial<CarMark>): CarMark => ({
    key: '1',
    x: 0,
    y: -5,
    transform: 'translate(0 -5)',
    bucket: 3,
    classColor: '#ffffff',
    overlapping: false,
    opacity: 1,
    ...over
  })
  const a = mark({})
  const b = mark({ key: '2', transform: 'translate(13 0)' })

  it('is true for the same list or an equal copy', () => {
    const list = [a, b]
    expect(sameMarks(list, list)).toBe(true)
    expect(sameMarks(list, [{ ...a }, { ...b }])).toBe(true)
    expect(sameMarks(NO_MARKS, [])).toBe(true)
  })

  it('is false when any drawn field, the order or the length differs', () => {
    const changes: Partial<CarMark>[] = [
      { key: '9' },
      { transform: 'translate(0 -5.1)' },
      { opacity: 0.98 },
      { bucket: 4 },
      { classColor: '#000000' },
      { overlapping: true }
    ]
    for (const change of changes) expect(sameMarks([a, b], [mark(change), b])).toBe(false)
    expect(sameMarks([a, b], [b, a])).toBe(false)
    expect(sameMarks([a, b], [a])).toBe(false)
  })
})

describe('centeredRect and the glow shapes', () => {
  it('centres the rect on the origin and grows it by pad on every side', () => {
    const r = centeredRect(7, 15, 2.2, 0.7)
    expect(r).toEqual({ x: -4.2, y: -8.2, width: 8.4, height: 16.4, rx: 2.9 })
    expect(Object.isFrozen(r)).toBe(true)
    expect(CAR_BODY).toEqual({
      x: -CAR_W / 2,
      y: -CAR_H / 2,
      width: CAR_W,
      height: CAR_H,
      rx: CAR_RX
    })
  })

  it('nests the halos and the alongside glow around the body', () => {
    const nested = (inner: CenteredRect, outer: CenteredRect): void => {
      expect(outer.width).toBeGreaterThan(inner.width)
      expect(outer.height).toBeGreaterThan(inner.height)
      expect(outer.x).toBeCloseTo(-outer.width / 2)
      expect(outer.y).toBeCloseTo(-outer.height / 2)
    }
    nested(CAR_BODY, CAR_HALO_INNER)
    nested(CAR_HALO_INNER, CAR_ALONGSIDE_GLOW)
    nested(CAR_BODY, PLAYER_HALO_INNER)
  })

  it('puts the windshield (the class mark) inside the front half of the body', () => {
    expect(Object.isFrozen(CAR_GLASS)).toBe(true)
    expect(CAR_GLASS.x).toBeCloseTo(-CAR_GLASS.width / 2)
    expect(CAR_GLASS.x).toBeGreaterThan(CAR_BODY.x)
    expect(CAR_GLASS.y).toBeGreaterThan(CAR_BODY.y)
    // Ahead is up (negative y): the glass ends before the body's centre.
    expect(CAR_GLASS.y + CAR_GLASS.height).toBeLessThan(0)
  })

  it('draws the bezel just inside the background, with concentric corners', () => {
    expect(BEZEL.x).toBeCloseTo(-BG_HALF + BEZEL_INSET)
    expect(BEZEL.y).toBeCloseTo(-BG_HALF + BEZEL_INSET)
    expect(BEZEL.width).toBeCloseTo(2 * (BG_HALF - BEZEL_INSET))
    expect(BEZEL.rx).toBeCloseTo(BG_RADIUS - BEZEL_INSET)
    expect(BEZEL.rx).toBeGreaterThan(0)
    // About 1 px in the default window (220 px wide: 2.2 px per unit).
    expect(BEZEL_INSET * 2.2).toBeCloseTo(1, 0)
    // The bezel's corner point lies inside the background's rounded corner.
    const c = BEZEL.x + BEZEL.rx * (1 - Math.SQRT1_2)
    expect(insideBackground(c, c)).toBe(true)
    expect(insideBackground(-BG_HALF + 0.1, -BG_HALF + 0.1)).toBe(false)
    expect(insideBackground(0, -BG_HALF)).toBe(true)
  })

  it('runs the lit top edge round the top corners of the bezel', () => {
    const r2 = (v: number): number => Math.round(v * 100) / 100
    const e = r2(BG_HALF - BEZEL_INSET)
    const s = r2(e - BEZEL.rx)
    expect(BEZEL_TOP_PATH).toBe(
      `M${-e} ${-s}A${BEZEL.rx} ${BEZEL.rx} 0 0 1 ${-s} ${-e}H${s}` +
        `A${BEZEL.rx} ${BEZEL.rx} 0 0 1 ${e} ${-s}`
    )
  })

  it('keeps the alert bloom inside the panel and clear of the range labels', () => {
    expect(-BG_HALF + ALERT_BAR_INSET - ALERT_BLOOM_PAD).toBeGreaterThanOrEqual(-BG_HALF)
    expect(LABEL_X).toBeLessThanOrEqual(
      BG_HALF - ALERT_BAR_INSET - sideAlertStyle(2).barWidth - ALERT_BLOOM_PAD
    )
  })
})

describe('rangeGuides', () => {
  it('places the guides through the car mapping', () => {
    for (const r of RANGES) {
      const g = rangeGuides(r)
      expect(g.halfY).toBeCloseTo(distToY(r / 2, r), 2)
      expect(g.ticksY).toHaveLength(8)
      expect(g.ticksY[0]).toBe(-RANGE_UNITS)
      expect(g.ticksY[2]).toBe(g.halfY)
      expect(g.ticksY[5]).toBe(-g.halfY)
      expect(g.ticksY[7]).toBe(RANGE_UNITS)
      for (let i = 1; i < g.ticksY.length; i++) {
        expect(g.ticksY[i]).toBeGreaterThan(g.ticksY[i - 1] ?? Infinity)
      }
    }
    // Not where a linear scale would put it.
    expect(rangeGuides(10).halfY).toBeCloseTo(
      -(CAR_H + ((5 - L) / (10 - L)) * (RANGE_UNITS - CAR_H)),
      2
    )
  })

  it('keeps the range labels inside the panel and apart, up to the largest label', () => {
    expect(LABEL_FONT).toBeGreaterThanOrEqual(4.5)
    // Clear of the strongest side alert bar.
    expect(LABEL_X).toBeLessThanOrEqual(BG_HALF - ALERT_BAR_INSET - sideAlertStyle(2).barWidth)
    for (const font of [LABEL_FONT, LABEL_FONT_MAX]) {
      for (const r of RANGES) {
        const g = rangeGuides(r, font)
        const fullTop = g.fullLabelY - font
        // Inside the bezel ring, its rounded corner included.
        expect(fullTop).toBeGreaterThan(BEZEL.y)
        expect(insideBackground(LABEL_X, fullTop)).toBe(true)
        expect(g.halfLabelY).toBeLessThan(g.halfY)
        expect(g.halfLabelY - font).toBeGreaterThan(g.fullLabelY)
      }
    }
  })
})

describe('labelFontUnits', () => {
  it('keeps the design size where it is legible', () => {
    expect(labelFontUnits(220, 260)).toBe(LABEL_FONT)
    expect(labelFontUnits(400, 400)).toBe(LABEL_FONT)
  })

  it('never renders under the text floor', () => {
    for (const side of [130, 150, 170, 199]) {
      const u = labelFontUnits(side, side + 40)
      expect(u).not.toBeNull()
      expect((u! * side) / 100).toBeGreaterThanOrEqual(LABEL_MIN_PX - 1e-9)
      expect(u).toBeLessThanOrEqual(LABEL_FONT_MAX)
    }
    // The radar's minimum window (120 x 140) still has its labels.
    expect(labelFontUnits(120, 140)).toBe(7.5)
  })

  it('leaves them out on a radar too small for them, and waits for a size', () => {
    expect(labelFontUnits(100, 300)).toBeNull()
    expect(labelFontUnits(0, 0)).toBe(LABEL_FONT)
    expect(labelFontUnits(NaN, 200)).toBe(LABEL_FONT)
  })
})

describe('sideAlertStyle', () => {
  it('hides with no car and strengthens with two', () => {
    expect(sideAlertStyle(0).opacity).toBe(0)
    const one = sideAlertStyle(1)
    const two = sideAlertStyle(2)
    expect(one.opacity).toBeGreaterThan(0)
    expect(two.opacity).toBeGreaterThanOrEqual(one.opacity)
    expect(two.barWidth).toBeGreaterThan(one.barWidth)
    expect(sideAlertStyle(1)).toBe(one)
  })
})
