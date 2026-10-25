/**
 * Shape validation of the untrusted messages overlay windows send to main (no Electron). Each
 * parser returns a clean copy (extra fields dropped) or null. Whether main accepts what a valid
 * message asks for (edit mode, locks, which window hosts the widget...) is decided in
 * overlayWindows.ts.
 */
import type { BoundsCommit, DragStateMessage, ScaleStepMessage } from '@shared/ipc'
import { clamp } from '@shared/num'
import type { Point, Rect, Size } from '@shared/types'
import { isWidgetId } from '@shared/widgets'

/** Window-local positions further than this are a renderer bug, not a layout. */
const MAX_COORD = 100_000
/** Same for sizes and heights. */
const MAX_SIZE = 10_000

type Fields = Record<string, unknown>

function record(raw: unknown): Fields | null {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Fields) : null
}

/** A safe integer ≥ `min`. */
function isCount(v: unknown, min: number): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= min
}

function isFiniteIn(v: unknown, lo: number, hi: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi
}

function parseSize(raw: unknown): Size | null {
  const r = record(raw)
  if (!r || !isFiniteIn(r.width, 1, MAX_SIZE) || !isFiniteIn(r.height, 1, MAX_SIZE)) return null
  return { width: r.width, height: r.height }
}

function parseRect(raw: unknown): Rect | null {
  const r = record(raw)
  const size = parseSize(raw)
  if (!r || !size) return null
  if (!isFiniteIn(r.x, -MAX_COORD, MAX_COORD) || !isFiniteIn(r.y, -MAX_COORD, MAX_COORD)) {
    return null
  }
  return { x: r.x, y: r.y, ...size }
}

function parsePoint(raw: unknown): Point | null {
  const r = record(raw)
  if (!r || !isFiniteIn(r.x, -MAX_COORD, MAX_COORD) || !isFiniteIn(r.y, -MAX_COORD, MAX_COORD)) {
    return null
  }
  return { x: r.x, y: r.y }
}

/** Validates an `IPC.commitBounds` message; a drop's `grab` is clamped into its `size`. */
export function parseBoundsCommit(raw: unknown): BoundsCommit | null {
  const r = record(raw)
  if (!r || !isCount(r.session, 1) || !isCount(r.seq, 1) || !isWidgetId(r.widget)) return null
  const head = { session: r.session, seq: r.seq, widget: r.widget }
  switch (r.kind) {
    case 'drag':
    case 'wheel': {
      const rect = parseRect(r.rect)
      if (!rect || !isCount(r.revision, 0)) return null
      return { ...head, kind: r.kind, revision: r.revision, rect }
    }
    case 'fit':
      return isFiniteIn(r.height, 1, MAX_SIZE) ? { ...head, kind: 'fit', height: r.height } : null
    case 'drop-outside': {
      const size = parseSize(r.size)
      const grab = parsePoint(r.grab)
      if (!size || !grab) return null
      return {
        ...head,
        kind: 'drop-outside',
        grab: { x: clamp(grab.x, 0, size.width), y: clamp(grab.y, 0, size.height) },
        size
      }
    }
    default:
      return null
  }
}

/** Validates an `IPC.scaleStep` message: one notch up or down. */
export function parseScaleStep(raw: unknown): ScaleStepMessage | null {
  const r = record(raw)
  if (!r || !isCount(r.session, 1) || !isWidgetId(r.widget)) return null
  if (r.step !== 1 && r.step !== -1) return null
  return { session: r.session, widget: r.widget, step: r.step }
}

/** Validates an `IPC.dragState` message. */
export function parseDragState(raw: unknown): DragStateMessage | null {
  const r = record(raw)
  if (!r || !isCount(r.session, 1) || typeof r.dragging !== 'boolean') return null
  return { session: r.session, dragging: r.dragging }
}
