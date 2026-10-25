/**
 * The furled black flag (CarIdxSessionFlags 0x80000: a warning, for track limits or unsafe
 * driving) in the mock: the classmate battling the player from ahead gets one early in every
 * session and iRacing withdraws it a little later, so the badge shows in the relative and the
 * standings next to the meatball and black flags of the other cast cars.
 */
import { SessionFlag } from '@shared/flags'
import type { SimCar } from './car'

/** Seconds since the session started, and how long the warning stays out. */
export const MOCK_WARNING = { atS: 150, forS: 45 } as const

export interface MockWarningEvent {
  readonly atS: number
  readonly apply: () => void
}

/** The warning's two moments for `car` (none without it); `log` records them. */
export function warningEvents(
  car: SimCar | undefined,
  log: (kind: 'warning-flag' | 'warning-end', carIdx: number) => void
): MockWarningEvent[] {
  if (!car) return []
  const { atS, forS } = MOCK_WARNING
  return [
    {
      atS,
      apply: () => {
        car.flags |= SessionFlag.Furled
        log('warning-flag', car.idx)
      }
    },
    {
      atS: atS + forS,
      apply: () => {
        car.flags &= ~SessionFlag.Furled
        log('warning-end', car.idx)
      }
    }
  ]
}
