/**
 * Edit-mode sample of the radar: a car alongside on the left (with its side alert), one close
 * behind and one further ahead in your lane, at the configured range, so the window is placed
 * and sized on realistic content.
 */
import { clamp01 } from '@shared/num'
import { RADAR, proximityColor } from '@shared/radar'
import { CarLeftRight } from '@shared/telemetry'
import type { RadarCar, RadarData } from '@shared/types'

const CLASS_COLOR = '#ffda59'

function laneCar(carIdx: number, distM: number, rangeM: number): RadarCar {
  const proximity =
    1 - clamp01((Math.abs(distM) - RADAR.carLengthM) / Math.max(1e-6, rangeM - RADAR.carLengthM))
  return {
    carIdx,
    distM,
    lane: 0,
    overlapping: false,
    proximity,
    color: proximityColor(proximity),
    classColor: CLASS_COLOR
  }
}

/** The sample at `rangeM` (cars beyond the range are left out, as the provider would). */
export function previewRadar(rangeM: number): RadarData {
  const cars: RadarCar[] = [
    {
      carIdx: -1,
      distM: -1.2,
      lane: -1,
      overlapping: true,
      proximity: 1,
      color: proximityColor(1),
      classColor: CLASS_COLOR
    }
  ]
  for (const [idx, f] of [
    [-2, -0.45],
    [-3, 0.75]
  ] as const) {
    const distM = Math.max(RADAR.carLengthM + 1, Math.abs(f) * rangeM) * Math.sign(f)
    if (Math.abs(distM) < rangeM) cars.push(laneCar(idx, distM, rangeM))
  }
  return {
    visible: true,
    rangeM,
    carLeftRight: CarLeftRight.CarLeft,
    leftCount: 1,
    rightCount: 0,
    cars,
    trackLengthKnown: true
  }
}
