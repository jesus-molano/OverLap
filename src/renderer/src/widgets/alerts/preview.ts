/**
 * Samples of the alerts banner. The options still apply to them (see previewFilter in view.ts):
 * without the blue flag, its chip goes.
 *
 * - PREVIEW_ALERTS, edit mode over the game: every part filled (band, chips, limiter line), so the
 *   window is placed and sized on its tallest usual content.
 * - PREVIEW_GALLERY, the live sample of the settings page: every alert there is, the most
 *   important in the band and all the others as chips, so each option shows what it adds.
 */
import type { AlertNotice, AlertsData, FlagKind } from '@shared/types'

const FLAGS: readonly FlagKind[] = Object.freeze(['yellow', 'blue', 'white'])
const NOTICES: readonly AlertNotice[] = Object.freeze([
  Object.freeze<AlertNotice>({ kind: 'lapsToGo', laps: 5 }),
  Object.freeze<AlertNotice>({
    kind: 'engineTrend',
    fluid: 'water',
    tempC: 98,
    deltaC: 6,
    draft: true
  })
])

export const PREVIEW_ALERTS: AlertsData = Object.freeze({
  visible: true,
  flags: FLAGS as FlagKind[],
  notices: NOTICES as AlertNotice[],
  pitLimiter: 'on',
  speedKmh: 58,
  pitLimitKmh: 60
})

const GALLERY_FLAGS: readonly FlagKind[] = Object.freeze(['yellow', 'furled', 'blue', 'white'])
const GALLERY_NOTICES: readonly AlertNotice[] = Object.freeze([
  ...(
    [
      { kind: 'wrongWay' },
      { kind: 'pitEntry' },
      { kind: 'stalled' },
      { kind: 'oilPressure' },
      { kind: 'water' },
      { kind: 'oilTemp' },
      { kind: 'fuelPressure' },
      { kind: 'tow', seconds: 42 }
    ] satisfies AlertNotice[]
  ).map((n) => Object.freeze<AlertNotice>(n)),
  ...NOTICES
])

export const PREVIEW_GALLERY: AlertsData = Object.freeze({
  visible: true,
  flags: GALLERY_FLAGS as FlagKind[],
  notices: GALLERY_NOTICES as AlertNotice[],
  pitLimiter: 'offSpeeding',
  speedKmh: 68,
  pitLimitKmh: 60
})
