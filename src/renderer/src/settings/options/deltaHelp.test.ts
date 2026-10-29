import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { referenceRowHelp } from './deltaHelp'

const ES = messagesFor('es')
const EN = messagesFor('en')

describe('referenceRowHelp', () => {
  it('gives each session its own chain, not the race’s', () => {
    // The defaults: Práctica on the record, Clasificación and Carrera on the optimal.
    expect(referenceRowHelp('pb', true, ES)).toBe(
      `${ES.settings.delta.references.pb.hint} · Si no existe: Mejor → Vuelta rápida de clase`
    )
    expect(referenceRowHelp('optimal', true, ES)).toBe(
      `${ES.settings.delta.references.optimal.hint} · Si no existe: Récord → Óptima de clase`
    )
    expect(referenceRowHelp('optimal', true, EN)).toContain('If missing: Best ever → Class optimal')
  })

  it('says the class best has nothing after it, and nothing of chains with the switch off', () => {
    expect(referenceRowHelp('class', true, ES)).toContain('Sin otra si no existe')
    expect(referenceRowHelp('optimal', false, ES)).toBe(ES.settings.delta.references.optimal.hint)
  })
})
