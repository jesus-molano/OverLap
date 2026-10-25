import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import type { DeltaReference } from '@shared/types'
import { previewDelta } from './preview'
import { currentSector, formatDelta, liveSectorDelta, refView, stateView, trendKind } from './view'

const REFS: readonly DeltaReference[] = ['pb', 'session', 'class']
const ES = messagesFor('es')

describe('previewDelta', () => {
  it('draws every part: hero, trend, predicted lap, sectors and the live one', () => {
    for (const r of REFS) {
      const d = previewDelta(r)
      expect(d.visible).toBe(true)
      expect(d.reference).toBe(r)
      expect(d.lapValid).toBe(true)
      expect(formatDelta(d.delta)).toBe('−0.24')
      expect(stateView(d.lapValid, trendKind(d.trend), true, ES).kind).toBe('gain')
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
    expect(refView(previewDelta('class'), ES).label).toBe('#44 J. Lindqvist')
    expect(refView(previewDelta('session'), messagesFor('en')).label).toBe('Session best')
    expect(previewDelta('session')).toBe(previewDelta('session'))
    expect(Object.isFrozen(previewDelta('pb'))).toBe(true)
    expect(previewDelta('bogus' as DeltaReference)).toBe(previewDelta('pb'))
  })
})
