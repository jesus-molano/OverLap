/**
 * Edit-mode sample of the alerts banner: every part filled (flag band, chips, incident line,
 * limiter line), so the window is placed and sized on its tallest usual content. The options
 * still apply to it (see previewFilter in view.ts): without the blue flag, its chip goes.
 */
import type { AlertsData, FlagKind, IncidentAlert } from '@shared/types'

const FLAGS: readonly FlagKind[] = Object.freeze(['yellow', 'blue', 'white'])

const INCIDENT: IncidentAlert = Object.freeze({
  points: 2,
  kind: 'loss-of-control',
  lap: 5,
  sector: 3,
  surface: 'gravel'
})

export const PREVIEW_ALERTS: AlertsData = Object.freeze({
  visible: true,
  flags: FLAGS as FlagKind[],
  pitLimiter: 'on',
  speedKmh: 58,
  pitLimitKmh: 60,
  incident: INCIDENT
})
