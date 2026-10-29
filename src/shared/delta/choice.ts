/**
 * Which delta reference the options choose: one per kind of session (DeltaOptions.reference*),
 * and the order of the 'cycleDeltaReference' shortcut. The shortcut never touches the settings:
 * main asks the telemetry process, whose DeltaProvider keeps the choice for the current session
 * only and takes it at the start of the next lap. Shared by the provider and the settings
 * window. Pure.
 */
import { DELTA_REFERENCE_VALUES } from '../settingsSchema'
import type { SessionKind } from '../sessionInfo'
import type { DeltaOptions, DeltaReference } from '../types'

/** The option holding each kind of session's reference. */
export const DELTA_REFERENCE_FIELD = {
  practice: 'referencePractice',
  qualify: 'referenceQualify',
  race: 'referenceRace'
} as const satisfies Record<SessionKind, keyof DeltaOptions>

export type DeltaReferenceField = (typeof DELTA_REFERENCE_FIELD)[SessionKind]

function isReference(v: unknown): v is DeltaReference {
  return (DELTA_REFERENCE_VALUES as readonly unknown[]).includes(v)
}

/**
 * The reference chosen for `kind` (an unknown kind reads as practice, like sessionKind's
 * "everything else"); 'pb' for a malformed option.
 */
export function deltaReferenceFor(
  opts: Pick<DeltaOptions, DeltaReferenceField>,
  kind: SessionKind | null
): DeltaReference {
  const v = opts[DELTA_REFERENCE_FIELD[kind ?? 'practice']]
  return isReference(v) ? v : 'pb'
}

/**
 * The chain each reference walks with DeltaOptions.fallback, the chosen one first. Your optimal
 * exists exactly when your session best does (a clean lap of yours), so it skips it: your record,
 * then the optimal of your class. Until someone in your class has a clean lap, your record is
 * the only lap a class optimal can fall back to. The class best has no fallback.
 */
export const DELTA_FALLBACK: Readonly<Record<DeltaReference, readonly DeltaReference[]>> = {
  pb: ['pb', 'session', 'class'],
  session: ['session', 'class'],
  optimal: ['optimal', 'pb', 'classOptimal'],
  class: ['class'],
  classOptimal: ['classOptimal', 'pb']
}

/** The reference after `ref` in DELTA_REFERENCE_VALUES' order, back to the first after the last. */
export function nextDeltaReference(ref: DeltaReference): DeltaReference {
  const i = DELTA_REFERENCE_VALUES.indexOf(ref)
  return DELTA_REFERENCE_VALUES[(i + 1) % DELTA_REFERENCE_VALUES.length] ?? 'pb'
}
