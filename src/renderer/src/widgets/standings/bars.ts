/**
 * What the standings' info bars are given: the payload's InfoBarData, less the SoF and the car
 * count while the class lines already say them (several classes drawn, each with its own line:
 * a header 'SoF 2.1k' would read as the whole field's). In a single-class table there is no
 * class line, so the header carries them, as it always did. Pure.
 */
import { isElementVisible } from '@shared/elements'
import type {
  ElementEntry,
  InfoBarData,
  StandingsClassBlock,
  StandingsClassLineId
} from '@shared/types'

export function barInfo(
  info: InfoBarData | null,
  classes: readonly StandingsClassBlock[] | null,
  classLine: readonly Readonly<ElementEntry<StandingsClassLineId>>[]
): InfoBarData | null {
  if (info === null || classes === null || classes.length < 2) return info
  const sof = info.sof !== null && isElementVisible(classLine, 'sof')
  const cars = info.carCount !== null && isElementVisible(classLine, 'carCount')
  if (!sof && !cars) return info
  return { ...info, sof: sof ? null : info.sof, carCount: cars ? null : info.carCount }
}
