/**
 * Edit-mode sample of the alerts banner: every part filled (flag band, chips, limiter line), so the
 * window is placed and sized on its tallest usual content. The options still apply to it (see
 * previewFilter in view.ts): without the blue flag, its chip goes.
 */
import type { AlertsData, FlagKind } from '@shared/types'

const FLAGS: readonly FlagKind[] = Object.freeze(['yellow', 'blue', 'white'])

export const PREVIEW_ALERTS: AlertsData = Object.freeze({
  visible: true,
  flags: FLAGS as FlagKind[],
  pitLimiter: 'on',
  speedKmh: 58,
  pitLimitKmh: 60
})
