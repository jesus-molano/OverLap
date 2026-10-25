/**
 * Edit-mode sample of the conditions widget: a shower, so every part is filled (the wetness
 * meter, the rain and the "declared wet" band), and the window is placed and sized on its
 * tallest content. The options still apply to it.
 */
import type { ConditionsData } from '@shared/types'

export const PREVIEW_CONDITIONS: ConditionsData = Object.freeze({
  visible: true,
  trackTempC: 27.8,
  trackTempTrend: 'down',
  airTempC: 18.6,
  windKmh: 14,
  // From the left, a little ahead of you.
  windFromDeg: -60,
  wetness: 4,
  precipPct: 40,
  declaredWet: true,
  skies: 3,
  rubberState: 'moderate usage'
})
