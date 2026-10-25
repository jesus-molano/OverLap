import { describe, expect, it } from 'vitest'
import { recorder, segments } from './testing/recorder'
import {
  CH_ABS,
  CH_BRAKE,
  CH_CLUTCH,
  CH_THROTTLE,
  MAX_SEGMENT_S,
  PHASE_STEPS,
  SampleRing,
  TRACE_PAD_CSS,
  clampTraceSeconds,
  clampTraceWidth,
  drawTraceFull,
  drawTraceStep,
  phaseOffsetCss,
  phaseStep,
  phaseTransforms,
  ringCapacity,
  sampleX,
  scrollPhase,
  scrollShift,
  traceGeometry,
  valueY,
  type TraceColors,
  type TraceGeometry,
  type TraceStyle
} from './trace'

const COLORS: TraceColors = {
  throttle: '#00ff00',
  brake: '#ff0000',
  abs: '#ffaa00',
  clutch: '#0000ff'
}
const PLAIN: TraceStyle = { clutch: false, outline: false, colors: COLORS }
const canvas = {} as CanvasImageSource
const DT = 1 / 60

/** A ring with `values` throttle samples (brake/clutch from the tuples) every `dt` s from t0. */
function ringOf(
  samples: readonly (readonly [number, number?, number?, boolean?])[],
  dt = DT,
  t0 = 100,
  capacity = 1000
): SampleRing {
  const r = new SampleRing(capacity)
  samples.forEach(([th, br = 0, cl = 0, abs = false], i) => r.push(t0 + i * dt, th, br, cl, abs))
  return r
}

describe('option clamps', () => {
  it('trace seconds: 2..10, rounded, invalid -> default', () => {
    expect(clampTraceSeconds(1)).toBe(2)
    expect(clampTraceSeconds(4.6)).toBe(5)
    expect(clampTraceSeconds(30)).toBe(10)
    expect(clampTraceSeconds(undefined)).toBe(5)
    expect(clampTraceSeconds(NaN)).toBe(5)
  })

  it('trace width: 1..3 px, invalid -> default', () => {
    expect(clampTraceWidth(0.2)).toBe(1)
    expect(clampTraceWidth(2.5)).toBe(2.5)
    expect(clampTraceWidth(9)).toBe(3)
    expect(clampTraceWidth('2')).toBe(2)
  })

  it('ring capacity leaves room for a faster stream', () => {
    expect(ringCapacity(5, 60)).toBe(452)
    expect(ringCapacity(99, 60)).toBe(ringCapacity(10, 60))
  })
})

describe('SampleRing', () => {
  it('returns the newest first, with its time, and NaN outside', () => {
    const r = new SampleRing(4)
    expect(r.length).toBe(0)
    expect(r.at(0, CH_THROTTLE)).toBeNaN()
    expect(r.timeAt(0)).toBeNaN()
    r.push(10, 0.1, 0.2, 0.3, false)
    r.push(10.5, 0.4, 0.5, 0.6, true)
    expect(r.length).toBe(2)
    expect(r.epoch).toBe(10)
    expect(r.timeAt(0)).toBe(10.5)
    expect(r.timeAt(1)).toBe(10)
    expect(r.at(0, CH_THROTTLE)).toBeCloseTo(0.4)
    expect(r.at(0, CH_BRAKE)).toBeCloseTo(0.5)
    expect(r.at(0, CH_CLUTCH)).toBeCloseTo(0.6)
    expect(r.at(0, CH_ABS)).toBe(1)
    expect(r.at(1, CH_ABS)).toBe(0)
    expect(r.at(2, CH_THROTTLE)).toBeNaN()
    expect(r.at(-1, CH_THROTTLE)).toBeNaN()
  })

  it('keeps hours of SessionTime exact to the millisecond', () => {
    const r = new SampleRing(4)
    r.push(36000.001, 0, 0, 0, false)
    r.push(36000.018, 0, 0, 0, false)
    expect(r.timeAt(0) - r.timeAt(1)).toBeCloseTo(0.017, 9)
  })

  it('overwrites the oldest when full and keeps the epoch', () => {
    const r = new SampleRing(3)
    for (let i = 1; i <= 7; i++) r.push(i, i / 10, 0, 0, false)
    expect(r.length).toBe(3)
    expect(r.epoch).toBe(1)
    expect([0, 1, 2].map((a) => r.timeAt(a))).toEqual([7, 6, 5])
  })

  it('setNewest replaces the newest values, not its time', () => {
    const r = new SampleRing(3)
    expect(r.setNewest(1, 1, 1, true)).toBe(false)
    r.push(5, 0.2, 0, 0, false)
    expect(r.setNewest(0.9, 0.1, 0, true)).toBe(true)
    expect(r.length).toBe(1)
    expect(r.timeAt(0)).toBe(5)
    expect(r.at(0, CH_THROTTLE)).toBeCloseTo(0.9)
    expect(r.at(0, CH_ABS)).toBe(1)
  })

  it('clear empties it and forgets the epoch', () => {
    const r = new SampleRing(3)
    r.push(1, 1, 1, 1, true)
    r.clear()
    expect(r.length).toBe(0)
    expect(r.epoch).toBeNaN()
    r.push(9, 0.5, 0, 0, false)
    expect(r.epoch).toBe(9)
  })

  it('resized keeps the newest samples and the epoch', () => {
    const r = new SampleRing(5)
    for (let i = 1; i <= 5; i++) r.push(i, i / 10, i / 20, 0, i === 5)
    const small = r.resized(3)
    expect(small.capacity).toBe(3)
    expect(small.epoch).toBe(1)
    expect([0, 1, 2].map((a) => small.timeAt(a))).toEqual([5, 4, 3])
    expect(small.at(0, CH_ABS)).toBe(1)
    const big = r.resized(10)
    expect(big.length).toBe(5)
    expect(big.timeAt(4)).toBe(1)
  })

  it('enforces a minimum capacity of 2', () => {
    expect(new SampleRing(0).capacity).toBe(2)
  })
})

describe('geometry', () => {
  const g = traceGeometry(300, 100, 1.25, 5, 2)

  it('insets the 0 and 1 levels by the CSS pad', () => {
    expect(g.top).toBeCloseTo(TRACE_PAD_CSS * 1.25)
    expect(g.bottom).toBeCloseTo(100 - TRACE_PAD_CSS * 1.25)
    expect(valueY(g, 1)).toBeCloseTo(g.top)
    expect(valueY(g, 0)).toBeCloseTo(g.bottom)
    expect(valueY(g, 0.5)).toBeCloseTo((g.top + g.bottom) / 2)
    expect(valueY(g, 2)).toBe(g.top)
    expect(valueY(g, NaN)).toBe(g.bottom)
  })

  it('line widths follow the option and the dpr; the clutch is thinner', () => {
    expect(g.lineWidth).toBeCloseTo(2 * 1.25)
    expect(g.clutchLineWidth).toBeLessThan(g.lineWidth)
    expect(traceGeometry(300, 100, 1, 5, 1).clutchLineWidth).toBe(1)
    expect(g.outlineWidth).toBeGreaterThan(g.lineWidth)
  })

  it('maps the trace seconds to the plot width', () => {
    expect(g.pxPerS * 5).toBeCloseTo(g.right)
    expect(traceGeometry(300, 100, 1.25, 10, 2).pxPerS).toBeCloseTo(g.pxPerS / 2)
  })

  it('spaces samples by time, not by count', () => {
    const r = new SampleRing(10)
    r.push(0, 0, 0, 0, false)
    r.push(0.1, 0, 0, 0, false)
    // Three samples dropped: the next one is 4 periods later.
    r.push(0.5, 0, 0, 0, false)
    const x0 = sampleX(g, r, 0)
    expect(x0 - sampleX(g, r, 1)).toBeCloseTo(0.4 * g.pxPerS)
    expect(sampleX(g, r, 1) - sampleX(g, r, 2)).toBeCloseTo(0.1 * g.pxPerS)
  })

  it('keeps the newest point and its cap inside the canvas', () => {
    const r = new SampleRing(100)
    for (let i = 0; i < 80; i++) {
      r.push(i * 0.0173, 0, 0, 0, false)
      const x = sampleX(g, r, 0)
      expect(x).toBeGreaterThanOrEqual(g.right)
      expect(x + g.outlineWidth / 2).toBeLessThan(g.width)
    }
  })

  it('scrolls by whole pixels that add up to the head position', () => {
    const fine = traceGeometry(250, 80, 1, 10, 2) // < 1 px per sample at 60 Hz
    const r = new SampleRing(4000)
    let scrolled = 0
    let t = 3
    for (let i = 0; i < 1234; i++) {
      // Irregular arrivals, as with a jittery stream.
      t += DT * (i % 7 === 0 ? 2 : 1)
      r.push(t, 0, 0, 0, false)
      const s = scrollShift(fine, r)
      expect(Number.isInteger(s)).toBe(true)
      expect(s).toBeGreaterThanOrEqual(0)
      scrolled += s
    }
    expect(scrolled).toBe(Math.floor((t - r.epoch) * fine.pxPerS))
  })

  it('a point keeps its pixel position across scrolls (incremental == full redraw)', () => {
    const geo: TraceGeometry = traceGeometry(333, 90, 1.5, 7, 2)
    const r = new SampleRing(2000)
    let t = 50
    for (let i = 0; i < 77; i++) r.push((t += DT), 0, 0, 0, false)
    const drawnAt = sampleX(geo, r, 0)
    let shifted = 0
    for (let i = 0; i < 150; i++) {
      r.push((t += i % 5 === 0 ? 3 * DT : DT), 0, 0, 0, false)
      shifted += scrollShift(geo, r)
    }
    expect(drawnAt - shifted).toBeCloseTo(sampleX(geo, r, 150), 6)
  })

  it('handles a bad devicePixelRatio and tiny canvases', () => {
    const tiny = traceGeometry(0, 0, NaN, 5, NaN)
    expect(tiny.width).toBe(1)
    expect(tiny.height).toBe(1)
    expect(Number.isFinite(tiny.pxPerS)).toBe(true)
    expect(tiny.bottom).toBeGreaterThanOrEqual(tiny.top)
  })
})

describe('sub-pixel scroll phase', () => {
  const DPRS = [1, 1.25, 1.5, 2]
  /** Largest on-screen error (device px) of a phase rounded to whole steps. */
  const HALF_STEP = 0.5 / PHASE_STEPS + 1e-9

  it('is 0 while empty or with one sample, else the rest of the head', () => {
    const g = traceGeometry(280, 90, 1, 5, 2)
    const r = new SampleRing(10)
    expect(scrollPhase(g, r)).toBe(0)
    r.push(12, 0, 0, 0, false)
    expect(scrollPhase(g, r)).toBe(0)
    r.push(12 + DT, 0, 0, 0, false)
    const head = DT * g.pxPerS
    expect(scrollPhase(g, r)).toBeCloseTo(head - Math.floor(head), 9)
    expect(sampleX(g, r, 0) - scrollPhase(g, r)).toBeCloseTo(g.right, 9)
  })

  it('moved back by the phase, the newest point is at right and older ones at their exact distance', () => {
    for (const dpr of DPRS) {
      const g = traceGeometry(280, 90, dpr, 5, 2)
      const r = new SampleRing(1000)
      let t = 20
      for (let i = 0; i < 300; i++) {
        r.push((t += i % 7 === 0 ? 2 * DT : DT), 0, 0, 0, false)
        const p = scrollPhase(g, r)
        expect(p).toBeGreaterThanOrEqual(0)
        expect(p).toBeLessThan(1)
        expect(sampleX(g, r, 0) - p).toBeCloseTo(g.right, 9)
        // The translation actually written (whole steps, CSS px) is as good to half a step.
        const shown = sampleX(g, r, 0) + phaseOffsetCss(p, dpr) * dpr
        expect(Math.abs(shown - g.right)).toBeLessThanOrEqual(HALF_STEP)
        if (r.length > 5) {
          const exact = g.right - (r.timeAt(0) - r.timeAt(5)) * g.pxPerS
          expect(sampleX(g, r, 5) - p).toBeCloseTo(exact, 9)
        }
      }
    }
  })

  it('content blitted on earlier samples moves its exact distance per sample on screen', () => {
    // ~0.97 px per sample: the whole-pixel blits alone move it 1 px on most samples, 0 on some.
    const g = traceGeometry(300, 90, 1.25, 5, 2)
    const r = new SampleRing(2000)
    let t = 50
    for (let i = 0; i < 77; i++) r.push((t += DT), 0, 0, 0, false)
    const t0 = r.timeAt(0)
    const drawnAt = sampleX(g, r, 0) // on the canvas, when it was the newest point
    let shifted = 0
    let prevShown = drawnAt - scrollPhase(g, r)
    const shifts = new Set<number>()
    for (let i = 0; i < 150; i++) {
      r.push((t += DT), 0, 0, 0, false)
      const shift = scrollShift(g, r)
      shifts.add(shift)
      shifted += shift
      const shown = drawnAt - shifted - scrollPhase(g, r)
      expect(shown).toBeCloseTo(g.right - (r.timeAt(0) - t0) * g.pxPerS, 6)
      expect(prevShown - shown).toBeCloseTo(DT * g.pxPerS, 6)
      prevShown = shown
    }
    expect([...shifts].sort((a, b) => a - b)).toEqual([0, 1])
  })

  it('phase -> CSS px: -phase / dpr in whole steps', () => {
    const exact: [number, number, number][] = [
      // dpr, phase, CSS px
      [1, 0.5, -0.5],
      [1, 0.25, -0.25],
      [1.25, 0.5, -0.4],
      [1.25, 0.75, -0.6],
      [1.5, 0.75, -0.5],
      [1.5, 0.375, -0.25],
      [2, 0.5, -0.25],
      [2, 0.125, -0.0625]
    ]
    for (const [dpr, phase, css] of exact) expect(phaseOffsetCss(phase, dpr)).toBeCloseTo(css, 12)
    for (const dpr of DPRS) {
      expect(phaseOffsetCss(0, dpr)).toBe(0)
      // Just under a whole pixel rounds to a whole one: the same place as phase 0, one px left.
      expect(phaseOffsetCss(0.999, dpr)).toBeCloseTo(-1 / dpr, 12)
      for (let p = 0; p < 1; p += 0.0137) {
        const css = phaseOffsetCss(p, dpr)
        expect(css).toBeLessThanOrEqual(0)
        expect(Math.abs(css * dpr + p)).toBeLessThanOrEqual(HALF_STEP)
      }
    }
  })

  it('anything invalid reads as no translation (phase) or dpr 1', () => {
    for (const p of [NaN, -0.2, 1, 7, Infinity]) {
      expect(phaseStep(p)).toBe(0)
      expect(phaseOffsetCss(p, 1.5)).toBe(0)
    }
    expect(phaseStep(0.5 / PHASE_STEPS - 1e-6)).toBe(0)
    expect(phaseStep(0.5)).toBe(PHASE_STEPS / 2)
    expect(phaseOffsetCss(0.5, 0)).toBe(-0.5)
    expect(phaseOffsetCss(0.5, NaN)).toBe(-0.5)
  })

  it('phaseTransforms: one string per step, none at 0', () => {
    for (const dpr of DPRS) {
      const table = phaseTransforms(dpr)
      expect(table).toHaveLength(PHASE_STEPS + 1)
      expect(table[0]).toBe('none')
      expect(new Set(table).size).toBe(table.length)
      for (let s = 1; s <= PHASE_STEPS; s++) {
        const css = Number(/^translateX\((.+)px\)$/.exec(table[s] ?? '')?.[1])
        expect(css).toBeCloseTo(-s / PHASE_STEPS / dpr, 12)
      }
    }
    expect(phaseTransforms(1.25)[PHASE_STEPS / 2]).toBe('translateX(-0.4px)')
    expect(phaseTransforms(2)[PHASE_STEPS]).toBe('translateX(-0.5px)')
  })
})

describe('drawTraceFull', () => {
  const g = traceGeometry(200, 60, 1, 2, 2)

  it('clears and draws nothing with fewer than two samples', () => {
    const { ctx, strokes, calls } = recorder()
    drawTraceFull(ctx, g, ringOf([[1]]), PLAIN)
    expect(calls).toEqual(['clear 0 0 200 60'])
    expect(strokes).toHaveLength(0)
  })

  it('draws throttle, then brake on top, skipping brake at rest', () => {
    const { ctx, strokes } = recorder()
    const r = ringOf([
      ...Array<[number]>(10).fill([1]),
      ...Array<[number, number]>(5).fill([0, 0.8])
    ])
    drawTraceFull(ctx, g, r, PLAIN)
    expect(strokes.map((s) => s.color)).toEqual([COLORS.throttle, COLORS.brake])
    const throttle = strokes[0]!
    expect(throttle.points).toHaveLength(15)
    expect(throttle.points.every(([x]) => !Number.isNaN(x))).toBe(true)
    const brake = strokes[1]!
    expect(brake.points.filter(([x]) => !Number.isNaN(x)).at(-1)?.[1]).toBeCloseTo(valueY(g, 0.8))
  })

  it('breaks the line across a gap in the stream', () => {
    const { ctx, strokes } = recorder()
    const r = new SampleRing(20)
    r.push(0, 0.5, 0, 0, false)
    r.push(DT, 0.5, 0, 0, false)
    r.push(DT + MAX_SEGMENT_S + 0.01, 0.6, 0, 0, false)
    r.push(2 * DT + MAX_SEGMENT_S + 0.01, 0.6, 0, 0, false)
    drawTraceFull(ctx, g, r, PLAIN)
    expect(segments(strokes[0]!)).toBe(2)
  })

  it('splits the brake into runs by ABS state', () => {
    const { ctx, strokes } = recorder()
    const r = ringOf([
      [0, 0.9, 0, false],
      [0, 0.9, 0, false],
      [0, 0.9, 0, true],
      [0, 0.9, 0, true],
      [0, 0.8, 0, false]
    ])
    drawTraceFull(ctx, g, r, PLAIN)
    expect(strokes.slice(1).map((s) => s.color)).toEqual([COLORS.brake, COLORS.abs, COLORS.brake])
    const [a, b, c] = strokes.slice(1)
    expect(a!.points.at(-1)).toEqual(b!.points[0])
    expect(b!.points.at(-1)).toEqual(c!.points[0])
  })

  it('draws the clutch first and the underlay only when asked', () => {
    const { ctx, strokes } = recorder()
    const g2 = traceGeometry(200, 60, 2, 2, 2)
    drawTraceFull(
      ctx,
      g2,
      ringOf([
        [0.5, 0.5, 0.5],
        [0.6, 0.6, 0.6]
      ]),
      { clutch: true, outline: true, colors: COLORS }
    )
    expect(strokes.map((s) => s.color)).toEqual([
      expect.stringMatching(/^rgba\(0, 0, 0/),
      expect.stringMatching(/^rgba\(0, 0, 0/),
      expect.stringMatching(/^rgba\(0, 0, 0/),
      COLORS.clutch,
      COLORS.throttle,
      COLORS.brake
    ])
    expect(strokes[0]!.width).toBe(g2.outlineWidth)
    expect(strokes[3]!.width).toBe(g2.clutchLineWidth)
    expect(strokes[4]!.width).toBe(g2.lineWidth)
  })

  it('does not walk samples that are far off the left edge', () => {
    const { ctx, strokes } = recorder()
    const r = new SampleRing(5000)
    for (let i = 0; i < 5000; i++) r.push(i * DT, i % 2, 0, 0, false)
    drawTraceFull(ctx, g, r, PLAIN) // 2 s visible: ~120 samples
    const xs = strokes[0]!.points.map(([x]) => x)
    expect(xs.length).toBeLessThan(130)
    expect(xs.length).toBeGreaterThan(115)
    expect(Math.min(...xs)).toBeLessThan(0)
  })
})

describe('drawTraceStep', () => {
  it('blits by the scroll shift, clears the strip and strokes the last two segments', () => {
    const { ctx, strokes, calls } = recorder()
    const g = traceGeometry(200, 60, 1, 1, 2) // ~3 px per sample
    const r = ringOf([[0.2], [0.4], [0.6]])
    drawTraceStep(ctx, canvas, g, r, PLAIN)
    const shift = scrollShift(g, r)
    expect(shift).toBeGreaterThan(0)
    expect(calls).toEqual([`blit ${-shift} 0 copy`, `clear ${200 - shift} 0 ${shift} 60`])
    expect(ctx.globalCompositeOperation).toBe('source-over')
    expect(strokes).toHaveLength(2)
    expect(strokes[0]!.points).toEqual([
      [sampleX(g, r, 2), valueY(g, Math.fround(0.2))],
      [sampleX(g, r, 1), valueY(g, Math.fround(0.4))]
    ])
    expect(strokes[1]!.points).toEqual([
      [sampleX(g, r, 1), valueY(g, Math.fround(0.4))],
      [sampleX(g, r, 0), valueY(g, Math.fround(0.6))]
    ])
  })

  it('does not blit while time stands still or the shift is under a pixel', () => {
    const { ctx, calls } = recorder()
    const g = traceGeometry(100, 40, 1, 10, 2) // ~0.15 px per sample
    const r = new SampleRing(10)
    r.push(0, 0, 0, 0, false)
    r.push(0.001, 0, 0, 0, false)
    drawTraceStep(ctx, canvas, g, r, PLAIN)
    expect(calls).toEqual([])
  })

  it('skips the newest segment across a gap', () => {
    const { ctx, strokes } = recorder()
    const g = traceGeometry(200, 60, 1, 5, 2)
    const r = new SampleRing(10)
    r.push(0, 0.5, 0, 0, false)
    r.push(DT, 0.5, 0, 0, false)
    r.push(1, 0.5, 0, 0, false)
    drawTraceStep(ctx, canvas, g, r, PLAIN)
    // Only the older segment (0 -> DT) is stroked again.
    expect(strokes).toHaveLength(1)
  })

  it('colours a brake segment by the ABS state of its newer sample', () => {
    const { ctx, strokes } = recorder()
    const g = traceGeometry(200, 60, 1, 1, 2)
    drawTraceStep(
      ctx,
      canvas,
      g,
      ringOf([
        [0, 0.5, 0, false],
        [0, 0.6, 0, false],
        [0, 0.7, 0, true]
      ]),
      PLAIN
    )
    const brake = strokes.filter((s) => s.color !== COLORS.throttle).map((s) => s.color)
    expect(brake).toEqual([COLORS.brake, COLORS.abs])
  })

  it('draws the underlay with butt caps before the lines', () => {
    const { ctx, strokes } = recorder()
    const g = traceGeometry(200, 60, 1, 1, 2)
    drawTraceStep(ctx, canvas, g, ringOf([[0.5], [0.6]]), { ...PLAIN, outline: true })
    expect(strokes.map((s) => s.cap)).toEqual(['butt', 'round'])
    expect(strokes[0]!.color).toMatch(/^rgba\(0, 0, 0/)
  })

  it('falls back to a full redraw when the shift covers the canvas', () => {
    const { ctx, calls } = recorder()
    const g = traceGeometry(40, 10, 1, 2, 2)
    const r = new SampleRing(4)
    r.push(0, 0, 0, 0, false)
    r.push(0.1, 1, 0, 0, false)
    r.push(5, 0, 0, 0, false) // further than the whole plot
    drawTraceStep(ctx, canvas, g, r, PLAIN)
    expect(calls).toEqual(['clear 0 0 40 10'])
  })
})
