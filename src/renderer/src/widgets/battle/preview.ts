/**
 * Edit-mode sample of the battle widget: invented drivers, every row of both lanes filled, so
 * the window is placed and sized on realistic content (names exercise the name formats). Two
 * makes, so the brand marks show in 'auto' mode.
 */
import type { BattleData, BattleOpponent } from '@shared/types'
import { PREVIEW_INFO } from '@renderer/view/infoBar'

const AHEAD: BattleOpponent = Object.freeze({
  inPits: false,
  carIdx: -1,
  carNumber: '19',
  driverName: 'Pierre-Étienne Duvalier',
  classColor: '#ffda59',
  iRating: 3480,
  licString: 'A 4.12',
  licColor: '#0153db',
  brand: 'porsche',
  country: 'FR',
  gapS: 0.6,
  trendSPerLap: 0.15,
  lapsToCatch: 4,
  catchesBeforeEnd: true,
  neededSPerLap: null,
  lastLaps: [98.621, 98.512, 98.774],
  sectorDeltas: [0.09, 0.02, 0.06],
  iRatingAtStake: 17,
  penalty: null
})

const BEHIND: BattleOpponent = Object.freeze({
  inPits: false,
  carIdx: -2,
  carNumber: '51',
  driverName: 'Marco Bianchi',
  classColor: '#ffda59',
  iRating: 2510,
  licString: 'A 1.83',
  licColor: '#0153db',
  brand: 'lamborghini',
  country: 'IT',
  gapS: 1,
  trendSPerLap: -0.09,
  lapsToCatch: 11.1,
  catchesBeforeEnd: true,
  neededSPerLap: null,
  lastLaps: [98.411, 98.655, 98.402],
  sectorDeltas: [0.03, -0.09, 0.02],
  iRatingAtStake: 16,
  // A rival on the furled flag: the «Piloto» block's badge in the sample.
  penalty: 'furled'
})

export const PREVIEW_BATTLE: BattleData = Object.freeze({
  visible: true,
  lapsRemaining: 19,
  playerLastLaps: [98.452, 98.63, 98.519],
  ahead: AHEAD,
  behind: BEHIND,
  multiBrand: true,
  // The info bars' sample (every item has something to show).
  info: PREVIEW_INFO
})

const ONLY_AHEAD: BattleData = Object.freeze({ ...PREVIEW_BATTLE, behind: null })
const ONLY_BEHIND: BattleData = Object.freeze({ ...PREVIEW_BATTLE, ahead: null })

/** The sample for the side options (both lanes when both are off: there is nothing else to place). */
export function previewBattle(showAhead: boolean, showBehind: boolean): BattleData {
  if (showAhead === showBehind) return PREVIEW_BATTLE
  return showAhead ? ONLY_AHEAD : ONLY_BEHIND
}
