/**
 * Sample of the warning lights strip, for edit mode over the game and the settings page's live
 * sample: one light of each look (mandatory repairs red with their crew time, optional ones orange,
 * the water yellow above your average, the limiter blue) among dim ones, with every reading
 * filled, so each option shows what it adds. The options still apply to it (previewFilter in
 * view.ts): without the limiter, it goes.
 */
import type { LightReading, LightsData } from '@shared/types'

const light = (o: Partial<LightReading> & Pick<LightReading, 'kind'>): LightReading =>
  Object.freeze({
    level: 'off',
    tempC: null,
    riseC: null,
    draft: false,
    seconds: null,
    realTime: false,
    ...o
  })

export const PREVIEW_LIGHTS: LightsData = Object.freeze({
  visible: true,
  lights: Object.freeze([
    light({ kind: 'oilPressure' }),
    light({ kind: 'fuelPressure' }),
    light({ kind: 'stalled' }),
    light({ kind: 'repair', level: 'alarm', seconds: 42 }),
    light({ kind: 'repairOptional', level: 'warn', seconds: 38 }),
    light({ kind: 'water', level: 'caution', tempC: 98, riseC: 6, draft: true }),
    light({ kind: 'oilTemp', tempC: 104 }),
    light({ kind: 'pitLimiter', level: 'info' }),
    light({ kind: 'revLimiter' })
  ]) as LightReading[]
})

/**
 * The sample with lights.repairRealTime: the mandatory repairs as the real seconds estimated in
 * the stall, longer than the crew's 42 s as the crew's figure runs slower than the clock
 * ('≈ 95 s'), the optional ones still the crew's, so both forms show.
 */
export const PREVIEW_LIGHTS_REAL: LightsData = Object.freeze({
  visible: true,
  lights: Object.freeze(
    PREVIEW_LIGHTS.lights.map((l) =>
      l.kind === 'repair' ? light({ ...l, seconds: 95, realTime: true }) : l
    )
  ) as LightReading[]
})
