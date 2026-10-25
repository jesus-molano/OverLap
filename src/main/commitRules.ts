/**
 * Whether main accepts a (shape-valid) `BoundsCommit` from an overlay window, and what it
 * becomes (no Electron). Rects come in window-local px and go out in screen DIP. A rejected
 * commit is still acknowledged by the caller, so the renderer stops drawing it.
 */
import type { BoundsCommit } from '@shared/ipc'
import type { Point, Rect, Size, WidgetSettings } from '@shared/types'
import type { WidgetDef } from '@shared/widgets'
import { rectsEqual } from '@shared/settings'
import { acceptRect, applyFit, dropRect, windowOrigin, type DisplayInfo } from './overlayLayout'

export interface CommitContext {
  editing: boolean
  /** The sending window hosts the widget. */
  hosted: boolean
  prefs: Pick<WidgetSettings, 'locked' | 'autoHeight' | 'anchor'>
  def: { sizeModel: WidgetDef['sizeModel']; minSize: Size }
  /** Drags and wheel notches computed against an older layout revision are stale. */
  geometryRevision: number
  /** The display the sending window covers. */
  display: DisplayInfo
  /** Where main draws the widget now (screen DIP). */
  current: Rect | undefined
  /** For drops only: the cursor and the display under it (read when needed). */
  dropTarget(): { cursor: Point; target: DisplayInfo | undefined }
}

export type CommitOutcome =
  | { accepted: false }
  | {
      accepted: true
      /** The widget's new rect, screen DIP. */
      rect: Rect
      /** 'now': drag or drop; 'wheel' and 'fit': debounced (different saves). */
      save: 'now' | 'wheel' | 'fit'
    }

const REJECTED: CommitOutcome = { accepted: false }

export function decideCommit(msg: BoundsCommit, c: CommitContext): CommitOutcome {
  if (!c.hosted) return REJECTED
  switch (msg.kind) {
    case 'drag':
    case 'wheel': {
      if (!c.editing || c.prefs.locked || msg.revision < c.geometryRevision) return REJECTED
      // Auto-height widgets change their content scale instead (`acceptScaleStep`).
      if (msg.kind === 'wheel' && c.def.sizeModel !== 'free') return REJECTED
      const rect = acceptRect(msg.rect, windowOrigin(c.display), c.display, c.def.minSize)
      if (!rect) return REJECTED
      return { accepted: true, rect, save: msg.kind === 'drag' ? 'now' : 'wheel' }
    }
    case 'fit': {
      if (c.def.sizeModel !== 'auto-height' || !c.prefs.autoHeight || !c.current) return REJECTED
      const rect = applyFit(
        c.current,
        msg.height,
        c.prefs.anchor,
        c.display.workArea,
        c.def.minSize.height
      )
      // Already that height: nothing to save.
      if (rectsEqual(rect, c.current)) return REJECTED
      return { accepted: true, rect, save: 'fit' }
    }
    case 'drop-outside': {
      if (!c.editing || c.prefs.locked) return REJECTED
      const { cursor, target } = c.dropTarget()
      if (!target) return REJECTED
      const rect = dropRect(cursor, msg.grab, msg.size, c.def.minSize, target)
      return { accepted: true, rect, save: 'now' }
    }
  }
}

/** A wheel notch over an auto-height widget becomes a content-scale step (edit mode only). */
export function acceptScaleStep(
  c: Pick<CommitContext, 'editing' | 'hosted' | 'prefs' | 'def'>
): boolean {
  return c.editing && c.hosted && !c.prefs.locked && c.def.sizeModel === 'auto-height'
}
