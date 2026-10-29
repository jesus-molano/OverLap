import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { defaultOptions } from '@shared/settings'
import { DELTA_REFERENCE_VALUES } from '@shared/settingsSchema'
import type { DeltaLapId, DeltaRowId, ElementEntry } from '@shared/types'
import { previewDelta } from './preview'
import {
  DELTA_FIT_TOP_EM,
  DELTA_ROW_FIT_EM,
  deltaRows,
  deltaTopParts,
  lapTimesView,
  refLapOf,
  referenceNames,
  referenceNote
} from './rows'

const ES = messagesFor('es')
const EN = messagesFor('en')
const D = defaultOptions('delta')

const list = <Id extends string>(...e: [Id, boolean][]): ElementEntry<Id>[] =>
  e.map(([id, visible]) => ({ id, visible }))

describe('deltaRows / deltaTopParts', () => {
  it('the defaults draw today: the top line, the bar, the sectors; every part of the top', () => {
    expect(deltaRows(D.rows)).toEqual(['top', 'bar', 'sectors'])
    expect(deltaTopParts(D.top)).toEqual({ state: true, predicted: true, reference: true })
  })

  it('follows the order and the eyes; the top line is always drawn', () => {
    const rows = list<DeltaRowId>(['laps', true], ['sectors', true], ['top', true], ['bar', false])
    expect(deltaRows(rows)).toEqual(['laps', 'sectors', 'top'])
    expect(deltaRows(list<DeltaRowId>(['top', false], ['bar', true]))).toEqual(['top', 'bar'])
    expect(
      deltaTopParts(list(['state', false], ['predicted', true], ['reference', false]))
    ).toEqual({ state: false, predicted: true, reference: false })
  })

  it("keeps today's font fit: 4.3 em with the bar, 6 with the sectors", () => {
    expect(DELTA_FIT_TOP_EM + DELTA_ROW_FIT_EM.bar).toBeCloseTo(4.3, 9)
    expect(DELTA_FIT_TOP_EM + DELTA_ROW_FIT_EM.bar + DELTA_ROW_FIT_EM.sectors).toBeCloseTo(6, 9)
  })
})

describe('lapTimesView', () => {
  const laps = { last: 136.731, best: 136.412, optimal: 135.958, pb: 136.089 }

  it('the shown times in order, the reference in use marked (fallback included)', () => {
    const v = lapTimesView(laps, D.laps, 'optimal', ES)
    expect(v).toEqual([
      { id: 'last', caption: 'Últ.', time: '2:16.731', isRef: false },
      { id: 'best', caption: 'Mejor', time: '2:16.412', isRef: false },
      { id: 'optimal', caption: 'Ópt.', time: '2:15.958', isRef: true }
    ])
    const order = list<DeltaLapId>(
      ['pb', true],
      ['last', true],
      ['best', false],
      ['optimal', false]
    )
    expect(lapTimesView(laps, order, 'pb', EN)).toEqual([
      { id: 'pb', caption: 'PB', time: '2:16.089', isRef: true },
      { id: 'last', caption: 'Last', time: '2:16.731', isRef: false }
    ])
  })

  it('your session best is the "best" item; the class references are nobody’s lap here', () => {
    expect(lapTimesView(laps, D.laps, 'session', ES).find((l) => l.isRef)?.id).toBe('best')
    for (const r of ['class', 'classOptimal'] as const) {
      expect(lapTimesView(laps, D.laps, r, ES).some((l) => l.isRef)).toBe(false)
      expect(refLapOf(r)).toBeNull()
    }
    expect(refLapOf(null)).toBeNull()
  })

  it('a time not set yet reads as a dash; nothing shown, nothing drawn', () => {
    const none = { last: null, best: null, optimal: null, pb: null }
    expect(lapTimesView(none, D.laps, 'pb', ES).map((l) => l.time)).toEqual(['—', '—', '—'])
    expect(lapTimesView(null, D.laps, null, ES)).toHaveLength(3)
    expect(lapTimesView(laps, list<DeltaLapId>(['last', false]), 'pb', ES)).toEqual([])
  })

  it('the sample has every time, the reference marked for each choice of yours', () => {
    for (const r of DELTA_REFERENCE_VALUES) {
      const d = previewDelta(r)
      const all = list<DeltaLapId>(['last', true], ['best', true], ['optimal', true], ['pb', true])
      const v = lapTimesView(d.laps, all, d.reference, ES)
      expect(v.every((l) => l.time !== '—')).toBe(true)
      expect(v.filter((l) => l.isRef).map((l) => l.id)).toEqual(
        refLapOf(r) === null ? [] : [refLapOf(r)]
      )
    }
  })
})

describe('referenceNote', () => {
  const none = { preferred: null, pending: null }

  it('chosen mid-lap: from the next lap; then its name when it takes over', () => {
    const pending = referenceNote(
      { preferred: 'pb', pending: null },
      { preferred: 'pb', pending: 'optimal' },
      ES
    )
    expect(pending).toBe('Vuelta óptima desde la próxima vuelta')
    expect(
      referenceNote(
        { preferred: 'pb', pending: 'optimal' },
        { preferred: 'optimal', pending: null },
        ES
      )
    ).toBe('Vuelta óptima')
    // Applied at once (no reference in use, or at the line).
    expect(
      referenceNote({ preferred: 'pb', pending: null }, { preferred: 'class', pending: null }, EN)
    ).toBe(referenceNames(EN).class)
  })

  it('taken back before the line: the label goes; the first payload says nothing', () => {
    expect(
      referenceNote({ preferred: 'pb', pending: 'session' }, { preferred: 'pb', pending: null }, ES)
    ).toBe('')
    expect(referenceNote(none, { preferred: 'pb', pending: null }, ES)).toBeNull()
    expect(
      referenceNote({ preferred: 'pb', pending: null }, { preferred: 'pb', pending: null }, ES)
    ).toBeNull()
  })

  it('names every reference in both languages', () => {
    for (const m of [ES, EN]) {
      for (const r of DELTA_REFERENCE_VALUES) expect(referenceNames(m)[r]).not.toBe('')
    }
  })
})
