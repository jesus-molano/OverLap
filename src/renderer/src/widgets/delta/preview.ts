/**
 * Edit-mode sample of the delta bar: a lap two tenths up on the chosen reference, mid S3, with
 * one sector won and one lost, so every part (hero, trend, bar, predicted lap, chips, the live
 * sector) is drawn. The reference follows the option, so its label reads as it will on track
 * (the widget names it in its language; the class best is an invented driver's).
 */
import { shallowRef } from 'vue'
import type { SessionKind } from '@shared/sessionInfo'
import type { DeltaBars, DeltaData, DeltaReference } from '@shared/types'

/**
 * Whose reference the sample draws: the race's (the one most drivers set the widget up for), or
 * the session whose reference the settings page changed last (R21: the reference in use, seen in
 * the preview). Per window: the overlay's edit mode keeps the race's.
 */
export const previewSession = shallowRef<SessionKind>('race')

const DELTA = -0.24
/** How much of the lap the sample is into (mid S3): the other bars scale the lap gap by it. */
const INTO_LAP = 0.8

// Plausible times: an optimal lap beats the best lap it is made of.
const REFS: Readonly<Record<DeltaReference, { driver: string; lapTime: number }>> = {
  pb: { driver: '', lapTime: 136.089 },
  session: { driver: '', lapTime: 136.412 },
  optimal: { driver: '', lapTime: 135.958 },
  class: { driver: '#44 J. Lindqvist', lapTime: 135.671 },
  classOptimal: { driver: '', lapTime: 135.304 }
}

/**
 * The bars per reference: the chosen one the hero's delta, each other the same lap against its
 * own time (so far into the lap): faster and slower ones, every reference with a lap.
 */
function sampleBars(reference: DeltaReference): DeltaBars {
  const own = REFS[reference].lapTime
  const at = (r: DeltaReference): number =>
    r === reference ? DELTA : Math.round((DELTA + INTO_LAP * (own - REFS[r].lapTime)) * 100) / 100
  return Object.freeze({
    pb: at('pb'),
    session: at('session'),
    optimal: at('optimal'),
    class: at('class'),
    classOptimal: at('classOptimal')
  })
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
    lapState: 'valid',
    preferred: reference,
    pending: null,
    temporary: false,
    // Last a little slower than the best, the optimal under it, the record the fastest of yours.
    laps: Object.freeze({ last: 136.731, best: 136.412, optimal: 135.958, pb: 136.089 }),
    bars: sampleBars(reference)
  })
}

const SAMPLES: Readonly<Record<DeltaReference, DeltaData>> = Object.freeze({
  pb: sample('pb'),
  session: sample('session'),
  optimal: sample('optimal'),
  class: sample('class'),
  classOptimal: sample('classOptimal')
})

/** The sample for a reference (the same object every time: nothing re-renders in edit mode). */
export function previewDelta(reference: DeltaReference): DeltaData {
  return Object.prototype.hasOwnProperty.call(SAMPLES, reference) ? SAMPLES[reference] : SAMPLES.pb
}
