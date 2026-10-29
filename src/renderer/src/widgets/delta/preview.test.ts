import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { DELTA_REFERENCE_VALUES } from '@shared/settingsSchema'
import type { DeltaReference } from '@shared/types'
import { previewDelta } from './preview'
import { currentSector, formatDelta, liveSectorDelta, refView, stateView, trendKind } from './view'

const REFS: readonly DeltaReference[] = DELTA_REFERENCE_VALUES
const ES = messagesFor('es')

describe('previewDelta', () => {
  it('draws every part: hero, trend, predicted lap, sectors and the live one', () => {
    for (const r of REFS) {
      const d = previewDelta(r)
      expect(d.visible).toBe(true)
      expect(d.reference).toBe(r)
      expect(d.lapState).toBe('valid')
      expect(formatDelta(d.delta)).toBe('−0.24')
      expect(stateView(d.lapState, trendKind(d.trend), true, ES).kind).toBe('gain')
      // Consistent numbers: predicted = reference + delta.
      expect(d.predictedLap).toBeCloseTo((d.refLapTime ?? 0) + (d.delta ?? 0), 6)
      const cur = currentSector(d.sectors, d.delta !== null)
      expect(cur).toBe(2)
      expect(liveSectorDelta(d.sectors, d.delta, cur)).toBe(-0.17)
      expect(refView(d, ES).label).not.toBe('')
    }
  })

  it('names the chosen reference and is stable', () => {
    expect(refView(previewDelta('pb'), ES).label).toBe('Récord personal')
    expect(refView(previewDelta('session'), ES).label).toBe('Mejor vuelta')
    expect(refView(previewDelta('optimal'), ES).label).toBe('Vuelta óptima')
    expect(refView(previewDelta('class'), ES).label).toBe('#44 J. Lindqvist')
    expect(refView(previewDelta('classOptimal'), ES).label).toBe('Óptima de la clase')
    expect(refView(previewDelta('session'), messagesFor('en')).label).toBe('Session best')
    // An optimal lap is faster than the best lap it is made of.
    const time = (r: DeltaReference): number => previewDelta(r).refLapTime ?? 0
    expect(time('optimal')).toBeLessThan(time('session'))
    expect(time('classOptimal')).toBeLessThan(Math.min(time('class'), time('optimal')))
    expect(previewDelta('session')).toBe(previewDelta('session'))
    expect(Object.isFrozen(previewDelta('pb'))).toBe(true)
    expect(previewDelta('bogus' as DeltaReference)).toBe(previewDelta('pb'))
  })
})
