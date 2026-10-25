import { describe, expect, it } from 'vitest'
import { EngineWarning } from '../flags'
import { DAMAGE, DamageReport } from './damage'

const MANDATORY = EngineWarning.MandatoryRepairs
const OPTIONAL = EngineWarning.OptionalRepairs

describe('DamageReport', () => {
  it('mandatory repairs while they are pending, whatever came before', () => {
    const d = new DamageReport()
    expect(d.update(0, MANDATORY | OPTIONAL)).toEqual({ kind: 'damage', mandatory: true })
    expect(d.update(300, MANDATORY | OPTIONAL | EngineWarning.PitSpeedLimiter)).toEqual({
      kind: 'damage',
      mandatory: true
    })
    expect(d.update(301, EngineWarning.PitSpeedLimiter)).toBeNull()
  })

  it('optional repairs for showS from the tick they appear, again only after a repair', () => {
    const d = new DamageReport()
    d.update(0, 0)
    expect(d.update(1, OPTIONAL)).toEqual({ kind: 'damage', mandatory: false })
    expect(d.update(1 + DAMAGE.optionalS - 0.1, OPTIONAL)).not.toBeNull()
    expect(d.update(1 + DAMAGE.optionalS, OPTIONAL)).toBeNull()
    expect(d.update(100, OPTIONAL)).toBeNull()
    // Repaired, then damaged again.
    d.update(101, 0)
    expect(d.update(102, OPTIONAL)).not.toBeNull()
    // A longer showS (the alerts' hold).
    const h = new DamageReport()
    h.update(0, 0)
    h.update(1, OPTIONAL, 9)
    expect(h.update(9.5, OPTIONAL, 9)).not.toBeNull()
  })

  it('no edge on the first tick, after resume() or without the variable', () => {
    const d = new DamageReport()
    expect(d.update(0, OPTIONAL)).toBeNull()
    d.update(1, 0)
    d.resume()
    expect(d.update(2, OPTIONAL)).toBeNull()
    const n = new DamageReport()
    n.update(0, null)
    expect(n.update(1, OPTIONAL)).toBeNull()
    expect(n.update(2, null)).toBeNull()
  })
})
