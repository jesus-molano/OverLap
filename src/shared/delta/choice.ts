/**
 * Which delta reference the options choose: one per kind of session (DeltaOptions.reference*),
 * and the cycle of the 'cycleDeltaReference' shortcut, which main applies to the settings (the
 * provider then takes the new one at the start of the next lap). Shared by main, the provider
 * and the settings window. Pure.
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

/** The reference after `ref` in DELTA_REFERENCE_VALUES' order, back to the first after the last. */
export function nextDeltaReference(ref: DeltaReference): DeltaReference {
  const i = DELTA_REFERENCE_VALUES.indexOf(ref)
  return DELTA_REFERENCE_VALUES[(i + 1) % DELTA_REFERENCE_VALUES.length] ?? 'pb'
}

/** The patch the cycle shortcut applies: `kind`'s reference moved to the next one. */
export function cycleDeltaPatch(
  opts: Pick<DeltaOptions, DeltaReferenceField>,
  kind: SessionKind
): Partial<DeltaOptions> {
  const field = DELTA_REFERENCE_FIELD[kind]
  const patch: Partial<DeltaOptions> = {}
  patch[field] = nextDeltaReference(deltaReferenceFor(opts, kind))
  return patch
}
