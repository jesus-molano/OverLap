import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import type { IncidentAlert, IncidentKind, IncidentSurface } from '@shared/types'
import { SERIOUS_POINTS, hasIncident, incidentLineView } from './incident'

const ES = messagesFor('es')
const EN = messagesFor('en')

const alert = (o: Partial<IncidentAlert> = {}): IncidentAlert => ({
  points: 2,
  kind: 'loss-of-control',
  lap: 5,
  sector: 3,
  surface: 'gravel',
  ...o
})

describe('incidentLineView', () => {
  it("'+2x Pérdida de control · V5 · S3 · grava'", () => {
    expect(incidentLineView(alert(), true, ES)).toEqual({
      points: '+2x',
      label: 'Pérdida de control',
      detail: '· V5 · S3 · grava',
      tone: 'warn'
    })
    expect(incidentLineView(alert(), true, EN)).toEqual({
      points: '+2x',
      label: 'Loss of control',
      detail: '· L5 · S3 · gravel',
      tone: 'warn'
    })
  })

  it('names every type and surface in both languages', () => {
    const kinds: IncidentKind[] = [
      'loss-of-control',
      'off-track',
      'contact-world',
      'collision-world',
      'contact-car',
      'collision-car'
    ]
    const surfaces: IncidentSurface[] = ['kerb', 'grass', 'dirt', 'sand', 'gravel', 'astroturf']
    for (const m of [ES, EN]) {
      const labels = kinds.map((kind) => incidentLineView(alert({ kind }), true, m)?.label)
      expect(new Set(labels).size).toBe(kinds.length)
      for (const surface of surfaces) {
        const detail = incidentLineView(alert({ surface }), true, m)?.detail ?? ''
        expect(detail.endsWith(` · ${m.widgets.incidents.surfaces[surface]}`)).toBe(true)
      }
    }
  })

  it('just the points when PlayerIncidents said nothing, and only what is known of where', () => {
    expect(incidentLineView(alert({ kind: null }), true, ES)).toMatchObject({
      points: '+2x',
      label: '',
      detail: 'V5 · S3 · grava'
    })
    expect(
      incidentLineView(alert({ kind: null, lap: null, sector: null, surface: null }), true, ES)
    ).toMatchObject({ points: '+2x', label: '', detail: '' })
    expect(incidentLineView(alert({ sector: null, surface: null }), true, ES)?.detail).toBe('· V5')
    expect(incidentLineView(alert({ lap: 0, sector: Number.NaN }), true, ES)?.detail).toBe(
      '· grava'
    )
  })

  it('is serious from a car contact on (the number says it too)', () => {
    expect(incidentLineView(alert({ points: SERIOUS_POINTS - 1 }), true, ES)?.tone).toBe('warn')
    expect(incidentLineView(alert({ points: SERIOUS_POINTS }), true, ES)?.tone).toBe('bad')
  })

  it('nothing with the option off or nothing to show', () => {
    expect(incidentLineView(alert(), false, ES)).toBeNull()
    expect(incidentLineView(null, true, ES)).toBeNull()
    expect(incidentLineView(undefined, true, ES)).toBeNull()
    expect(incidentLineView(alert({ points: 0 }), true, ES)).toBeNull()
    expect(hasIncident(alert({ points: Number.NaN }))).toBe(false)
    expect(hasIncident(alert())).toBe(true)
  })
})
