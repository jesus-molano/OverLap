import type { RaceCarState, RaceView } from './raceView'

const NO_CARS: readonly RaceCarState[] = Object.freeze([])
const NO_SAMPLES: readonly { distance: number; gap: number; clean: boolean }[] = Object.freeze([])

/**
 * A RaceView with no cars and no timing: stands in for a RaceModel that could
 * not be built, so providers still get a view (relative and radar keep working).
 */
export const EMPTY_RACE_VIEW: RaceView = Object.freeze({
  sessionTime: 0,
  sessionKey: '',
  racing: false,
  playerCarIdx: -1,
  car: () => undefined,
  cars: () => NO_CARS,
  timeGap: () => null,
  lapsBehind: () => 0,
  gapHistory: () => NO_SAMPLES,
  lastLapSectors: () => null,
  lapSectors: () => null,
  lapsRemaining: () => null,
  currentLap: () => null,
  lapProfile: () => null,
  timeRemainingS: null,
  playerDistanceDriven: 0,
  playerIncidents: 0
})
