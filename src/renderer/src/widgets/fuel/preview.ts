/**
 * Edit-mode sample of the fuel widget: mid-race, a little short with one stop to go and the
 * saving to skip it within reach, after a stop that measured the tyres in a session that limits
 * repairs and sets, so every line is filled and the window is placed and sized on its tallest
 * content. The options still apply to it. Consistent with fuel/strategy.ts: 52 L at 2.96 L/v
 * with 18.7 laps to go and a 0.5 lap margin need 56.8 L.
 */
import type { FuelData } from '@shared/types'

export const PREVIEW_FUEL: FuelData = Object.freeze({
  visible: true,
  fuelL: 52,
  tankL: 85,
  lapsOfFuel: 17.6,
  avgL: 2.96,
  lastL: 3.02,
  maxL: 3.1,
  samples: 5,
  carried: false,
  finish: Object.freeze({
    lap: 17,
    lapsLeft: 18.7,
    needL: 56.8,
    deficitL: 4.8,
    stops: 1,
    addL: 4.9,
    fill: false,
    window: Object.freeze({ from: 17, to: 33 }),
    saveL: 2.7
  }),
  boxL: 20,
  tyres: Object.freeze({ lap: 13, wearPct: Object.freeze([78, 74, 86, 82] as const) }),
  fastRepairs: 1,
  tyreSets: 2
})
