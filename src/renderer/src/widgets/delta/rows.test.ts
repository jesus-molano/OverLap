import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { defaultOptions } from '@shared/settings'
import { DELTA_REFERENCE_VALUES } from '@shared/settingsSchema'
import type { DeltaLapId, DeltaReference, DeltaRowId, ElementEntry } from '@shared/types'
import { previewDelta } from './preview'
import {
  DELTA_FIT_TOP_EM,
  DELTA_ROW_FIT_EM,
  DELTA_MULTI_HEAD_EM,
  DELTA_MULTI_PAD_EM,
  DELTA_MULTI_ROW_EM,
  barsInRoom,
  deltaFitOf,
  deltaLanes,
  deltaMultiFit,
  deltaShapeOf,
  laneViews,
  lanesInRoom,
  shapeInRoom,
  deltaRows,
  deltaTopParts,
  lapTimesView,
  refBarsFitEm,
  refBarsView,
  refLapOf,
  referenceNames,
  referenceNote,
  refBarsThatFit
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
  const none = { preferred: null, pending: null, temporary: false }

  it('chosen mid-lap: from the next lap; then its name when it takes over', () => {
    const pending = referenceNote(
      { preferred: 'pb', pending: null, temporary: false },
      { preferred: 'pb', pending: 'optimal', temporary: false },
      ES
    )
    expect(pending).toBe('Vuelta óptima desde la próxima vuelta')
    expect(
      referenceNote(
        { preferred: 'pb', pending: 'optimal', temporary: false },
        { preferred: 'optimal', pending: null, temporary: false },
        ES
      )
    ).toBe('Vuelta óptima')
    // Applied at once (no reference in use, or at the line).
    expect(
      referenceNote(
        { preferred: 'pb', pending: null, temporary: false },
        { preferred: 'class', pending: null, temporary: false },
        EN
      )
    ).toBe(referenceNames(EN).class)
  })

  it('the cycle shortcut’s choice is named as temporary', () => {
    expect(
      referenceNote(
        { preferred: 'pb', pending: null, temporary: false },
        { preferred: 'pb', pending: 'optimal', temporary: true },
        ES
      )
    ).toBe('Vuelta óptima (temporal) desde la próxima vuelta')
    expect(
      referenceNote(
        { preferred: 'pb', pending: 'optimal', temporary: true },
        { preferred: 'optimal', pending: null, temporary: true },
        EN
      )
    ).toBe('Optimal lap (temporary)')
  })

  it('taken back before the line: the label goes; the first payload says nothing', () => {
    expect(
      referenceNote(
        { preferred: 'pb', pending: 'session', temporary: false },
        { preferred: 'pb', pending: null, temporary: false },
        ES
      )
    ).toBe('')
    expect(referenceNote(none, { preferred: 'pb', pending: null, temporary: false }, ES)).toBeNull()
    expect(
      referenceNote(
        { preferred: 'pb', pending: null, temporary: false },
        { preferred: 'pb', pending: null, temporary: false },
        ES
      )
    ).toBeNull()
  })

  it('names every reference in both languages', () => {
    for (const m of [ES, EN]) {
      for (const r of DELTA_REFERENCE_VALUES) expect(referenceNames(m)[r]).not.toBe('')
    }
  })
})

describe('refBarsView', () => {
  const list = (
    ids: DeltaReference[],
    hidden: DeltaReference[] = []
  ): ElementEntry<DeltaReference>[] => ids.map((id) => ({ id, visible: !hidden.includes(id) }))

  it('the shown references in your order, the one in use marked, short captions', () => {
    const v = refBarsView(
      list(['class', 'optimal', 'pb', 'session', 'classOptimal'], ['pb']),
      'optimal',
      ES
    )
    expect(v.map((b) => b.id)).toEqual(['class', 'optimal', 'session', 'classOptimal'])
    expect(v.map((b) => b.caption)).toEqual(['Clase', 'Ópt.', 'Mejor', 'Ópt. clase'])
    expect(v.map((b) => b.isRef)).toEqual([false, true, false, false])
    expect(v[1]?.name).toBe('Vuelta óptima')
    // The captions of your own laps are the lap times line's.
    for (const [bar, lap] of [
      ['pb', 'pb'],
      ['session', 'best'],
      ['optimal', 'optimal']
    ] as const) {
      expect(ES.widgets.delta.bars[bar]).toBe(ES.widgets.delta.laps[lap])
      expect(EN.widgets.delta.bars[bar]).toBe(EN.widgets.delta.laps[lap])
    }
  })

  it('none shown: no bars (the row draws and sizes nothing)', () => {
    expect(refBarsView(list(['pb'], ['pb']), 'pb', ES)).toHaveLength(0)
    expect(refBarsFitEm(0)).toBe(0)
    expect(refBarsFitEm(3)).toBeCloseTo(4.2, 9)
  })
})

describe('the bars per reference in a short window', () => {
  const ids: DeltaReference[] = ['pb', 'session', 'optimal', 'class', 'classOptimal']
  /** The defaults with the line shown and `shown` bars on. */
  const opts = (shown: DeltaReference[]): ReturnType<typeof defaultOptions<'delta'>> => {
    const o = defaultOptions('delta')
    return {
      ...o,
      rows: o.rows.map((e) => (e.id === 'refs' ? { ...e, visible: true } : e)),
      refBars: ids.map((id) => ({ id, visible: shown.includes(id) }))
    }
  }
  const three = opts(['pb', 'session', 'optimal'])

  it('counts every bar while the text fits the window, and none in a very short one', () => {
    expect(refBarsThatFit(three, 3, 420, 170, 9)).toBe(3)
    expect(refBarsThatFit(three, 3, 400, 60, 9)).toBe(0)
    // No size yet (the first frame): all, as the page shows them.
    expect(refBarsThatFit(three, 3, 0, 0, 9)).toBe(3)
  })

  it('at the text floor, only the bars the height holds: two at the default 400 x 80', () => {
    // 6.15 em without bars, 1.35 em each, 9 px text: 80 px hold 8.9 em.
    expect(deltaFitOf(three, { lanes: 1, head: false, bars: 0 }).h).toBeCloseTo(
      DELTA_FIT_TOP_EM + 0.95 + 1.7,
      9
    )
    expect(refBarsThatFit(three, 3, 400, 80, 9)).toBe(2)
    // A larger text floor holds fewer.
    expect(refBarsThatFit(three, 3, 400, 80, 10)).toBe(1)
  })

  it('never leaves out the reference the delta is using', () => {
    const bars = refBarsView(three.refBars, 'optimal', ES)
    expect(barsInRoom(bars, 3)).toBe(bars)
    expect(barsInRoom(bars, 2).map((b) => b.id)).toEqual(['pb', 'optimal'])
    expect(barsInRoom(bars, 1).map((b) => b.id)).toEqual(['optimal'])
    expect(barsInRoom(bars, 0)).toHaveLength(0)
    // In use among the first ones already: your order as it is.
    const first = refBarsView(three.refBars, 'pb', ES)
    expect(barsInRoom(first, 2).map((b) => b.id)).toEqual(['pb', 'session'])
    // No reference in use (none chosen yet): the first ones.
    expect(barsInRoom(refBarsView(three.refBars, null, ES), 2).map((b) => b.id)).toEqual([
      'pb',
      'session'
    ])
  })
})

describe('several references: one equal row each', () => {
  const ids: DeltaReference[] = ['pb', 'session', 'optimal', 'class', 'classOptimal']
  /** The defaults with the line shown (or not) and `shown` references on. */
  const opts = (
    shown: DeltaReference[],
    line = true,
    order: DeltaReference[] = ids
  ): ReturnType<typeof defaultOptions<'delta'>> => {
    const o = defaultOptions('delta')
    return {
      ...o,
      rows: o.rows.map((e) => (e.id === 'refs' ? { ...e, visible: line } : e)),
      refBars: order.map((id) => ({ id, visible: shown.includes(id) }))
    }
  }

  it('one reference is the delta of always: the default, or only the one in use shown', () => {
    expect(deltaLanes(D, 'optimal')).toEqual(['optimal'])
    expect(deltaLanes(opts(['optimal']), 'optimal')).toEqual(['optimal'])
    // References shown with their line hidden: nothing more.
    expect(deltaLanes(opts(['pb', 'session'], false), 'optimal')).toEqual(['optimal'])
    expect(deltaShapeOf(D, 'optimal')).toEqual({ lanes: 1, head: false, bars: 0 })
    // The one in use's small bar of 2.4 stays.
    expect(deltaShapeOf(opts(['optimal']), 'optimal')).toEqual({ lanes: 1, head: false, bars: 1 })
    // ...and so does its fit.
    expect(deltaFitOf(D, deltaShapeOf(D, 'optimal'))).toEqual({ h: 6, w: 26 })
  })

  it('two or more: a row each, in the list order, the one in use in its own place', () => {
    expect(deltaLanes(opts(['pb']), 'optimal')).toEqual(['pb', 'optimal'])
    const order: DeltaReference[] = ['class', 'optimal', 'pb', 'session', 'classOptimal']
    // In use but hidden in the list: its row goes where the list has it.
    expect(deltaLanes(opts(['pb', 'classOptimal'], true, order), 'optimal')).toEqual([
      'optimal',
      'pb',
      'classOptimal'
    ])
    expect(deltaLanes(opts(['pb', 'session'], true, order), 'session')).toEqual(['pb', 'session'])
    // The rows stay put when the reference in use changes among them.
    const three = opts(['pb', 'session', 'optimal'])
    expect(deltaLanes(three, 'pb')).toEqual(deltaLanes(three, 'optimal'))
    // Missing from the list (never in a valid file): first.
    expect(deltaLanes({ ...three, refBars: three.refBars.slice(0, 2) }, 'optimal')).toEqual([
      'optimal',
      'pb',
      'session'
    ])
    expect(deltaShapeOf(three, 'pb')).toEqual({ lanes: 3, head: true, bars: 0 })
    // No part of the top line shown: no head line.
    const bare = { ...three, top: three.top.map((e) => ({ ...e, visible: false })) }
    expect(deltaShapeOf(bare, 'pb').head).toBe(false)
  })

  it('in Settings, the most rows any session draws', () => {
    // Practice pb, qualifying and race optimal (the defaults).
    expect(deltaShapeOf(opts(['pb', 'session', 'optimal'])).lanes).toBe(3)
    expect(deltaShapeOf(opts(['optimal'])).lanes).toBe(2)
    expect(deltaShapeOf(opts([])).lanes).toBe(1)
    expect(deltaShapeOf(D)).toEqual({ lanes: 1, head: false, bars: 0 })
    const allPb = { ...opts(['pb']), referenceQualify: 'pb', referenceRace: 'pb' } as const
    expect(deltaShapeOf(allPb)).toEqual({ lanes: 1, head: false, bars: 1 })
  })

  it('fits the rows: 1.9 em each, the head line 1.45, the sectors as always', () => {
    const three = opts(['pb', 'session', 'optimal'])
    expect(DELTA_MULTI_PAD_EM + DELTA_MULTI_HEAD_EM + 2 * DELTA_MULTI_ROW_EM + 1.7).toBeCloseTo(7.9)
    expect(deltaMultiFit(three, 2, true)).toEqual({ h: 7.9, w: 21 })
    expect(deltaMultiFit(three, 3, true)).toEqual({ h: 9.8, w: 21 })
    expect(deltaMultiFit(three, 3, false)).toEqual({ h: 8.35, w: 21 })
    expect(deltaFitOf(three)).toEqual({ h: 9.8, w: 21 })
    // No bar: name, figure and trend only.
    const nobar = {
      ...three,
      rows: three.rows.map((e) => (e.id === 'bar' ? { ...e, visible: false } : e))
    }
    expect(deltaMultiFit(nobar, 3, true).w).toBe(13)
  })

  it('in a small window the head line goes first, then rows, then the delta of always', () => {
    const three = opts(['pb', 'session', 'optimal'])
    const shape = deltaShapeOf(three, 'optimal')
    // Room for everything: as it is (no size yet too).
    expect(shapeInRoom(three, shape, 400, 131, 9)).toBe(shape)
    expect(shapeInRoom(three, shape, 0, 0, 9)).toBe(shape)
    // The default 400 x 80 at a 9 px floor: three rows without the head line.
    expect(shapeInRoom(three, shape, 400, 80, 9)).toEqual({ lanes: 3, head: false, bars: 0 })
    // At 10 px: two rows.
    expect(shapeInRoom(three, shape, 400, 80, 10)).toEqual({ lanes: 2, head: false, bars: 0 })
    // Too short for rows: the delta of always.
    expect(shapeInRoom(three, shape, 400, 60, 9)).toEqual({ lanes: 1, head: false, bars: 0 })
    expect(shapeInRoom(three, shape, 400, 70, 14).lanes).toBe(1)
    // A single shape is drawn as it is.
    const one = deltaShapeOf(D, 'optimal')
    expect(shapeInRoom(D, one, 400, 30, 9)).toBe(one)
  })

  it('never leaves out the reference in use, and names every row', () => {
    const lanes = laneViews(['pb', 'session', 'optimal'], 'optimal', ES)
    expect(lanes.map((b) => b.caption)).toEqual(['Récord', 'Mejor', 'Ópt.'])
    expect(lanes.map((b) => b.isRef)).toEqual([false, false, true])
    expect(lanes[2]?.name).toBe('Vuelta óptima')
    expect(lanesInRoom(lanes, 2).map((b) => b.id)).toEqual(['pb', 'optimal'])
    expect(laneViews([], 'pb', ES)).toHaveLength(0)
  })
})
