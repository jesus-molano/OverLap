/**
 * Change detection for the auto-height protocol (ux §3.2): the renderer reports the height its
 * content wants, in whole DIP, only when that number changes. Pure.
 */
import type { ContentSizeMessage } from '@shared/ipc'

/** Float noise below this (px) does not round a height up to the next pixel. */
const ROUND_SLACK_PX = 0.01

export interface ContentSizeReporter {
  /** Reports a desired height in CSS px; sends it when its whole-pixel value changed. */
  report(heightPx: number): void
  /** Forgets the last sent height, so the next report is sent even if equal. */
  reset(): void
  /** Last height sent, null when none since the last reset. */
  readonly last: number | null
}

/** Whole DIP that hold `px` (rounded up, ignoring float noise); null for no usable height. */
export function contentHeightPx(px: number): number | null {
  if (!Number.isFinite(px) || px <= 0) return null
  return Math.max(1, Math.ceil(px - ROUND_SLACK_PX))
}

export function createContentSizeReporter(
  send: (msg: ContentSizeMessage) => void
): ContentSizeReporter {
  let last: number | null = null
  return {
    report(heightPx) {
      const h = contentHeightPx(heightPx)
      if (h === null || h === last) return
      last = h
      send({ height: h })
    },
    reset() {
      last = null
    },
    get last() {
      return last
    }
  }
}
