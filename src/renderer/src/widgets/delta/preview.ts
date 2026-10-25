/**
 * Edit-mode sample of the delta bar: a lap two tenths up on the chosen reference, mid S3, with
 * one sector won and one lost, so every part (hero, trend, bar, predicted lap, chips, the live
 * sector) is drawn. The reference follows the option, so its label reads as it will on track
 * (the widget names it in its language; the class best is an invented driver's).
 */
import type { DeltaData, DeltaReference } from '@shared/types'

const DELTA = -0.24

const REFS: Readonly<Record<DeltaReference, { driver: string; lapTime: number }>> = {
  pb: { driver: '', lapTime: 136.089 },
  session: { driver: '', lapTime: 136.412 },
  class: { driver: '#44 J. Lindqvist', lapTime: 135.671 }
}

function sample(reference: DeltaReference): DeltaData {
  const ref = REFS[reference]
  return Object.freeze({
    visible: true,
    reference,
    refDriver: ref.driver,
    refSelf: false,
    refLapTime: ref.lapTime,
    delta: DELTA,
    trend: -0.04,
    predictedLap: Math.round((ref.lapTime + DELTA) * 1000) / 1000,
    sectors: Object.freeze([-0.12, 0.05, null]) as (number | null)[],
    lapValid: true
  })
}

const SAMPLES: Readonly<Record<DeltaReference, DeltaData>> = Object.freeze({
  pb: sample('pb'),
  session: sample('session'),
  class: sample('class')
})

/** The sample for a reference (the same object every time: nothing re-renders in edit mode). */
export function previewDelta(reference: DeltaReference): DeltaData {
  return Object.prototype.hasOwnProperty.call(SAMPLES, reference) ? SAMPLES[reference] : SAMPLES.pb
}
