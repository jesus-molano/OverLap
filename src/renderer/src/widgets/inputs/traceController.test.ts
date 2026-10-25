import { describe, expect, it } from 'vitest'
import { PREVIEW_READOUT } from './readout'
import { recorder } from './testing/recorder'
import { CH_THROTTLE, MAX_SEGMENT_S, ringCapacity, sampleX, traceGeometry } from './trace'
import {
  TraceController,
  type TraceCanvas,
  type TraceSample,
  type TraceSettings
} from './traceController'

const SETTINGS: TraceSettings = {
  seconds: 5,
  lineCss: 2,
  clutch: true,
  outline: false,
  colors: { throttle: '#00ff00', brake: '#ff0000', abs: '#ffaa00', clutch: '#0000ff' }
}
const DT = 1 / 60

function sample(t: number, throttle = 0.5, brake = 0): TraceSample {
  return { t, throttle, brake, clutch: 0, abs: false }
}

function fakeCanvas(): TraceCanvas {
  return { width: 300, height: 150 } as TraceCanvas
}

function setup(settings = SETTINGS): {
  trace: TraceController
  rec: ReturnType<typeof recorder>
  canvas: TraceCanvas
} {
  const trace = new TraceController(60, settings)
  const rec = recorder()
  const canvas = fakeCanvas()
  trace.attach(canvas, rec.ctx)
  trace.resize(400, 100, 1)
  rec.reset()
  return { trace, rec, canvas }
}

const fullRedraws = (calls: readonly string[]): number =>
  calls.filter((c) => c === 'clear 0 0 400 100').length

describe('TraceController', () => {
  it('sizes the backing store on resize and draws nothing before', () => {
    const trace = new TraceController(60, SETTINGS)
    const rec = recorder()
    const canvas = fakeCanvas()
    trace.attach(canvas, rec.ctx)
    trace.push(sample(1))
    trace.push(sample(1 + DT))
    expect(rec.calls).toEqual([])
    trace.resize(400, 100, 1)
    expect(canvas.width).toBe(400)
    expect(canvas.height).toBe(100)
    expect(fullRedraws(rec.calls)).toBe(1)
    expect(rec.strokes.length).toBeGreaterThan(0)
    // Same size again: nothing.
    rec.reset()
    trace.resize(400, 100, 1)
    expect(rec.calls).toEqual([])
  })

  it('after a reset: one full draw, then incremental steps', () => {
    const { trace, rec } = setup()
    trace.reset()
    trace.push(sample(10))
    expect(fullRedraws(rec.calls)).toBe(1)
    trace.push(sample(10 + DT))
    trace.push(sample(10 + 2 * DT))
    expect(fullRedraws(rec.calls)).toBe(1)
    expect(rec.calls.filter((c) => c.startsWith('blit'))).toHaveLength(2)
    expect(rec.strokes.length).toBeGreaterThan(0)
  })

  it('places samples by their SessionTime, so dropped samples leave room', () => {
    const { trace } = setup()
    trace.push(sample(10))
    trace.push(sample(10 + DT))
    trace.push(sample(10 + 4 * DT)) // two lost on the way
    const ring = trace.samples
    const g = traceGeometry(400, 100, 1, 5, 2)
    expect(sampleX(g, ring, 0) - sampleX(g, ring, 1)).toBeCloseTo(3 * DT * g.pxPerS)
    expect(sampleX(g, ring, 1) - sampleX(g, ring, 2)).toBeCloseTo(DT * g.pxPerS)
  })

  it('a repeated time replaces the newest sample (a paused sim cannot flush the history)', () => {
    const { trace, rec } = setup()
    trace.push(sample(10, 0.1))
    trace.push(sample(10 + DT, 0.2))
    rec.reset()
    for (let i = 0; i < 1000; i++) trace.push(sample(10 + DT, 0.2))
    expect(trace.samples.length).toBe(2)
    expect(rec.calls).toEqual([])
    // Pedal moved while paused: one full redraw with the new value.
    trace.push(sample(10 + DT, 0.9))
    expect(trace.samples.length).toBe(2)
    expect(trace.samples.at(0, CH_THROTTLE)).toBeCloseTo(0.9)
    expect(fullRedraws(rec.calls)).toBe(1)
  })

  it('starts over when time goes back or jumps past the plot', () => {
    const { trace } = setup()
    for (let i = 0; i < 10; i++) trace.push(sample(100 + i * DT))
    trace.push(sample(3)) // new session
    expect(trace.samples.length).toBe(1)
    expect(trace.samples.epoch).toBe(3)
    for (let i = 1; i < 5; i++) trace.push(sample(3 + i * DT))
    trace.push(sample(3 + 4 * DT + 6)) // longer than 5 s
    expect(trace.samples.length).toBe(1)
    // A short gap is kept (drawn as a break, see trace.ts).
    trace.push(sample(trace.samples.timeAt(0) + MAX_SEGMENT_S * 2))
    expect(trace.samples.length).toBe(2)
  })

  it('without SessionTime, one sample per period', () => {
    const { trace } = setup()
    trace.push(sample(NaN))
    trace.push(sample(NaN))
    trace.push(sample(Infinity))
    expect(trace.samples.length).toBe(3)
    expect(trace.samples.timeAt(0) - trace.samples.timeAt(2)).toBeCloseTo(2 * DT)
  })

  it('reset clears the samples; the next push redraws in full', () => {
    const { trace, rec } = setup()
    trace.push(sample(1))
    trace.push(sample(1 + DT))
    trace.reset()
    expect(trace.samples.length).toBe(0)
    rec.reset()
    trace.push(sample(50))
    expect(fullRedraws(rec.calls)).toBe(1)
  })

  it('configure redraws only on a change, and resizes the ring for new seconds', () => {
    const { trace, rec } = setup()
    for (let i = 0; i < 20; i++) trace.push(sample(i * DT))
    rec.reset()
    trace.configure({ ...SETTINGS })
    expect(rec.calls).toEqual([])
    trace.configure({ ...SETTINGS, outline: true })
    expect(fullRedraws(rec.calls)).toBe(1)
    trace.configure({ ...SETTINGS, seconds: 2 })
    expect(trace.samples.capacity).toBe(ringCapacity(2, 60))
    expect(trace.samples.length).toBe(20)
    rec.reset()
    trace.configure({ ...SETTINGS, seconds: 2, colors: { ...SETTINGS.colors, brake: '#123456' } })
    expect(fullRedraws(rec.calls)).toBe(1)
  })

  it('the preview fills the plot and draws it', () => {
    const { trace, rec } = setup()
    trace.preview()
    expect(trace.samples.length).toBe(5 * 60 + 1)
    expect(trace.samples.timeAt(0)).toBe(PREVIEW_READOUT.t)
    expect(fullRedraws(rec.calls)).toBe(1)
  })

  it('a re-created canvas gets the known size and a full redraw at once', () => {
    const { trace, rec } = setup()
    trace.push(sample(1))
    trace.push(sample(1 + DT))
    trace.attach(null, null)
    rec.reset()
    trace.push(sample(1 + 2 * DT))
    expect(rec.calls).toEqual([])
    const next = fakeCanvas()
    trace.attach(next, rec.ctx)
    expect(next.width).toBe(400)
    expect(next.height).toBe(100)
    expect(fullRedraws(rec.calls)).toBe(1)
    expect(trace.samples.length).toBe(3)
  })
})
