import { describe, expect, it } from 'vitest'
import { defaultOptions } from '../settings'
import { DELTA_REFERENCE_VALUES } from '../settingsSchema'
import type { DeltaReference } from '../types'
import { DELTA_REFERENCE_FIELD, deltaReferenceFor, nextDeltaReference } from './choice'

const DEFAULTS = defaultOptions('delta')

describe('deltaReferenceFor', () => {
  it('takes the reference of the kind of session', () => {
    expect(deltaReferenceFor(DEFAULTS, 'practice')).toBe('pb')
    expect(deltaReferenceFor(DEFAULTS, 'qualify')).toBe('optimal')
    expect(deltaReferenceFor(DEFAULTS, 'race')).toBe('optimal')
    const o = { ...DEFAULTS, referenceRace: 'class' as const }
    expect(deltaReferenceFor(o, 'race')).toBe('class')
  })

  it('reads an unknown session as practice, and a malformed option as the record', () => {
    expect(deltaReferenceFor({ ...DEFAULTS, referencePractice: 'session' }, null)).toBe('session')
    const bad = { ...DEFAULTS, referenceRace: 'nope' as unknown as 'pb' }
    expect(deltaReferenceFor(bad, 'race')).toBe('pb')
  })

  it('names one option per kind', () => {
    expect(DELTA_REFERENCE_FIELD).toEqual({
      practice: 'referencePractice',
      qualify: 'referenceQualify',
      race: 'referenceRace'
    })
  })
})

describe('the cycle shortcut', () => {
  it('walks every reference in UI order and back to the first', () => {
    const seen: DeltaReference[] = [DELTA_REFERENCE_VALUES[0]]
    for (let i = 0; i < DELTA_REFERENCE_VALUES.length; i++) {
      seen.push(nextDeltaReference(seen.at(-1) ?? 'pb'))
    }
    expect(seen).toEqual([...DELTA_REFERENCE_VALUES, 'pb'])
  })
})
