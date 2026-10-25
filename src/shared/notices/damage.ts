/**
 * 'DAÑOS', for the alerts widget: the car is damaged, from the repair bits of EngineWarnings
 * (MandatoryRepairs 0x80, OptionalRepairs 0x100). Online they come on the moment the car is hit,
 * seconds before the meatball flag (which only follows mandatory repairs). Mandatory repairs are
 * said while they are pending (the meatball, once out, says the same: the provider drops this
 * notice then); optional ones only for a few seconds after they appear, as the car can race on
 * with them for the rest of the session. Pure.
 */
import { EngineWarning } from '../flags'
import type { AlertNotice } from '../types'

export const DAMAGE = {
  /** Optional repairs are said this long at least (s of SessionTime) after they appear. */
  optionalS: 6
} as const

export type DamageNotice = Extract<AlertNotice, { kind: 'damage' }>

const MANDATORY: DamageNotice = Object.freeze({ kind: 'damage', mandatory: true })
const OPTIONAL: DamageNotice = Object.freeze({ kind: 'damage', mandatory: false })

/**
 * One per alerts provider. update() at every compute; resume() after a gap in the computes (the
 * optional repairs already there are not said again).
 */
export class DamageReport {
  /** The optional bit at the last compute, null right after a (re)start: no edge then. */
  private optionalWas: boolean | null = null
  private optionalSince = Number.NaN

  resume(): void {
    this.optionalWas = null
    this.optionalSince = Number.NaN
  }

  /**
   * `warnings`: EngineWarnings as an unsigned bit field, null when unknown. Returns the notice to
   * show now (before the provider's rules on when engine alerts are quiet), or null.
   */
  update(
    now: number,
    warnings: number | null,
    showS: number = DAMAGE.optionalS
  ): DamageNotice | null {
    const mandatory = warnings !== null && (warnings & EngineWarning.MandatoryRepairs) !== 0
    const optional = warnings !== null && (warnings & EngineWarning.OptionalRepairs) !== 0
    if (optional && this.optionalWas === false) this.optionalSince = now
    // Repaired: the next damage is said again.
    if (!optional) this.optionalSince = Number.NaN
    this.optionalWas = warnings === null ? null : optional
    if (mandatory) return MANDATORY
    return now - this.optionalSince < showS ? OPTIONAL : null
  }
}
