/** Test double of the trace's 2D context: records strokes (style and points) and other calls. */
import type { TraceContext } from '../trace'

export interface RecordedStroke {
  color: string
  width: number
  cap: string
  /** A [NaN, NaN] entry marks a gap (moveTo inside the path). */
  points: [number, number][]
}

export interface Recorder {
  ctx: TraceContext
  strokes: RecordedStroke[]
  calls: string[]
  /** Forgets everything recorded so far. */
  reset(): void
}

export function recorder(): Recorder {
  const strokes: RecordedStroke[] = []
  const calls: string[] = []
  let path: [number, number][] = []
  const ctx = {
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: true,
    beginPath() {
      path = []
    },
    moveTo(x: number, y: number) {
      if (path.length > 0) path.push([NaN, NaN])
      path.push([x, y])
    },
    lineTo(x: number, y: number) {
      path.push([x, y])
    },
    stroke() {
      strokes.push({
        color: String(this.strokeStyle),
        width: this.lineWidth,
        cap: String(this.lineCap),
        points: path
      })
    },
    clearRect(x: number, y: number, w: number, h: number) {
      calls.push(`clear ${x} ${y} ${w} ${h}`)
    },
    drawImage(_img: unknown, x: number, y: number) {
      calls.push(`blit ${x} ${y} ${this.globalCompositeOperation}`)
    }
  }
  return {
    ctx: ctx as unknown as TraceContext,
    strokes,
    calls,
    reset() {
      strokes.length = 0
      calls.length = 0
    }
  }
}

/** Drawn segments of a stroke (pairs of consecutive points without a gap between them). */
export function segments(s: RecordedStroke): number {
  let n = 0
  for (let i = 1; i < s.points.length; i++) {
    const a = s.points[i - 1]
    const b = s.points[i]
    if (a && b && !Number.isNaN(a[0]) && !Number.isNaN(b[0])) n++
  }
  return n
}
