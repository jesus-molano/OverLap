import { describe, expect, it } from 'vitest'
import { PREVIEW_READOUT } from './readout'
import { recorder } from './testing/recorder'
import {
  CH_THROTTLE,
  MAX_SEGMENT_S,
  PHASE_STEPS,
  phaseStep,
  phaseTransforms,
  ringCapacity,
  sampleX,
  scrollPhase,
  traceGeometry
} from './trace'
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

/** A canvas stand-in; `writes` records every transform written to its inline style. */
function fakeCanvas(): TraceCanvas & { writes: string[] } {
  const writes: string[] = []
  let transform = ''
  const style = {
    get transform(): string {
      return transform
    },
    set transform(v: string) {
      transform = v
      writes.push(v)
    }
  }
  return { width: 300, height: 150, style, writes } as unknown as TraceCanvas & {
    writes: string[]
  }
}

function setup(
  settings = SETTINGS,
  dpr = 1
): {
  trace: TraceController
  rec: ReturnType<typeof recorder>
  canvas: ReturnType<typeof fakeCanvas>
} {
  const trace = new TraceController(60, settings)
  const rec = recorder()
  const canvas = fakeCanvas()
  trace.attach(canvas, rec.ctx)
  trace.resize(400, 100, dpr)
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

describe('TraceController: sub-pixel phase translation', () => {
  /** The translation (CSS px) a transform string stands for. */
  const cssOf = (transform: string): number =>
    transform === 'none' ? 0 : Number(/^translateX\((.+)px\)$/.exec(transform)?.[1])

  /** Live samples with irregular arrivals; returns the time of the last one. */
  function drive(trace: TraceController, from: number, n: number): number {
    let t = from
    for (let i = 0; i < n; i++) trace.push(sample((t += i % 9 === 0 ? 2 * DT : DT), (i % 10) / 10))
    return t
  }

  for (const dpr of [1, 1.25, 1.5, 2]) {
    it(`dpr ${dpr}: the newest sample shows at right; the transform is written once per change`, () => {
      const { trace, canvas } = setup(SETTINGS, dpr)
      const g = traceGeometry(400, 100, dpr, SETTINGS.seconds, SETTINGS.lineCss)
      const table = phaseTransforms(dpr)
      expect(canvas.style.transform).toBe('none') // drawn empty on resize: no phase
      canvas.writes.length = 0
      let last = canvas.style.transform
      let changes = 0
      let t = 10
      for (let i = 0; i < 240; i++) {
        trace.push(sample((t += i % 9 === 0 ? 2 * DT : DT), (i % 10) / 10))
        const ring = trace.samples
        const want = table[phaseStep(scrollPhase(g, ring))]
        expect(canvas.style.transform).toBe(want)
        // On screen (device px): drawn at sampleX, moved by the translation.
        const shown = sampleX(g, ring, 0) + cssOf(canvas.style.transform) * dpr
        expect(Math.abs(shown - g.right)).toBeLessThanOrEqual(0.5 / PHASE_STEPS + 1e-9)
        if (want !== last) changes++
        last = want ?? last
      }
      expect(canvas.writes).toHaveLength(changes)
      expect(changes).toBeGreaterThan(100)
    })
  }

  it('a paused sim writes nothing; a pedal moved while paused keeps the translation', () => {
    const { trace, canvas } = setup()
    const t = drive(trace, 10, 7)
    const before = canvas.style.transform
    expect(before).not.toBe('none')
    canvas.writes.length = 0
    for (let i = 0; i < 100; i++) trace.push(sample(t, 0.6))
    trace.push(sample(t, 0.95)) // full redraw, same phase
    expect(canvas.writes).toEqual([])
    expect(canvas.style.transform).toBe(before)
  })

  it('a reset or a restart (time back, long gap) goes back to no translation', () => {
    const { trace, canvas } = setup()
    drive(trace, 10, 7)
    expect(canvas.style.transform).not.toBe('none')
    trace.reset()
    trace.push(sample(50))
    expect(canvas.style.transform).toBe('none')
    drive(trace, 50, 7)
    expect(canvas.style.transform).not.toBe('none')
    trace.push(sample(3)) // new session
    expect(canvas.style.transform).toBe('none')
    const t = drive(trace, 3, 7)
    expect(canvas.style.transform).not.toBe('none')
    trace.push(sample(t + 60)) // gap longer than the plot
    expect(canvas.style.transform).toBe('none')
  })

  it('the preview is never translated, also when resized or restyled', () => {
    const { trace, canvas } = setup()
    drive(trace, 10, 7)
    expect(canvas.style.transform).not.toBe('none')
    trace.preview()
    expect(canvas.style.transform).toBe('none')
    canvas.writes.length = 0
    trace.resize(357, 100, 1.5)
    trace.configure({ ...SETTINGS, seconds: 7, lineCss: 3 })
    trace.preview()
    expect(canvas.writes).toEqual([])
    // Back in the car: live again.
    trace.reset()
    drive(trace, 10, 7)
    expect(canvas.style.transform).not.toBe('none')
  })

  it('a new dpr or geometry recomputes the translation', () => {
    const { trace, canvas } = setup()
    drive(trace, 10, 7)
    trace.resize(400, 100, 2)
    const g = traceGeometry(400, 100, 2, SETTINGS.seconds, SETTINGS.lineCss)
    expect(canvas.style.transform).toBe(
      phaseTransforms(2)[phaseStep(scrollPhase(g, trace.samples))]
    )
    trace.configure({ ...SETTINGS, seconds: 7 })
    const g7 = traceGeometry(400, 100, 2, 7, SETTINGS.lineCss)
    expect(canvas.style.transform).toBe(
      phaseTransforms(2)[phaseStep(scrollPhase(g7, trace.samples))]
    )
  })

  it('a re-created canvas gets the translation with its first draw', () => {
    const { trace, canvas } = setup()
    drive(trace, 10, 7)
    const shown = canvas.style.transform
    expect(shown).not.toBe('none')
    trace.attach(null, null)
    const next = fakeCanvas()
    trace.attach(next, recorder().ctx)
    expect(next.writes).toEqual([shown])
  })
})
