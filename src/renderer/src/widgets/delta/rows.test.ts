import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { defaultOptions } from '@shared/settings'
import { DELTA_REFERENCE_VALUES } from '@shared/settingsSchema'
import type { DeltaLapId, DeltaReference, DeltaRowId, ElementEntry } from '@shared/types'
import { ghostZones, withGhosts } from '../../settings/preview/previewEdit'
import { previewDelta } from './preview'
import {
  DELTA_FIT_TOP_EM,
  DELTA_ROW_FIT_EM,
  DELTA_MULTI_HEAD_EM,
  DELTA_MULTI_PAD_EM,
  DELTA_MULTI_NARROW_W,
  DELTA_MULTI_NOBAR_W,
  DELTA_MULTI_ROW_EM,
  DELTA_MULTI_W,
  barsInRoom,
  deltaFitOf,
  deltaLanes,
  deltaLiveShape,
  deltaMultiFit,
  deltaShapeOf,
  extraInRoom,
  laneViews,
  lanesDrawn,
  lanesInRoom,
  lanesNoRoom,
  shapeInRoom,
  withoutGhosts,
  type DeltaExtraWish,
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

  it('in a small window rows go first (the head names the one in use), then the head line', () => {
    const three = opts(['pb', 'session', 'optimal'])
    const shape = deltaShapeOf(three, 'optimal')
    // Room for everything: as it is (no size yet too).
    expect(shapeInRoom(three, shape, 400, 131, 9)).toBe(shape)
    expect(shapeInRoom(three, shape, 0, 0, 9)).toBe(shape)
    // The default 400 x 80 at a 9 or 10 px floor: two rows (the reference in use's among them)
    // under the head line, which names it and says when a lap won't count.
    expect(shapeInRoom(three, shape, 400, 80, 9)).toEqual({ lanes: 2, head: true, bars: 0 })
    expect(shapeInRoom(three, shape, 400, 80, 10)).toEqual({ lanes: 2, head: true, bars: 0 })
    // At 11 px two rows only fit without it.
    expect(shapeInRoom(three, shape, 400, 80, 11)).toEqual({ lanes: 2, head: false, bars: 0 })
    // Too short for rows: the delta of always.
    expect(shapeInRoom(three, shape, 400, 60, 9)).toEqual({ lanes: 1, head: false, bars: 0 })
    expect(shapeInRoom(three, shape, 400, 70, 14).lanes).toBe(1)
    // A single shape is drawn as it is.
    const one = deltaShapeOf(D, 'optimal')
    expect(shapeInRoom(D, one, 400, 30, 9)).toBe(one)
  })

  it('sizes a narrow window as the stylesheet does (15 em wide up to 300 px)', () => {
    const three = opts(['pb', 'session', 'optimal'])
    expect(deltaMultiFit(three, 3, true, 300)).toEqual({ h: 9.8, w: DELTA_MULTI_NARROW_W })
    expect(deltaMultiFit(three, 3, true, 301)).toEqual({ h: 9.8, w: DELTA_MULTI_W })
    expect(deltaMultiFit(three, 3, true)).toEqual({ h: 9.8, w: DELTA_MULTI_W })
    // Without the bar the rows are as narrow anyway; the head line counts at any width.
    const nobar = {
      ...three,
      rows: three.rows.map((e) => (e.id === 'bar' ? { ...e, visible: false } : e))
    }
    expect(deltaMultiFit(nobar, 3, true, 200)).toEqual({ h: 9.8, w: DELTA_MULTI_NOBAR_W })
    // The text a narrow window gets is the larger one the stylesheet draws: fewer extras fit.
    const two = { lanes: 2, head: true, bars: 0 }
    expect(
      extraInRoom(three, two, { news: false, ghostHead: false, ghosts: 3 }, 280, 200, 9).lanes
    ).toBe(1)
    expect(
      extraInRoom(three, two, { news: false, ghostHead: false, ghosts: 3 }, 301, 200, 9).lanes
    ).toBe(3)
  })

  it('draws ghosts into room left over only; a lap state may shrink the text, never a row', () => {
    const two = opts(['pb', 'optimal'])
    const shape = deltaShapeOf(two, 'optimal')
    const ghosts = (n: number, ghostHead = false): DeltaExtraWish => ({
      news: false,
      ghostHead,
      ghosts: n
    })
    // 400 x 104 (grown for two rows and the head line): no ghost fits at that text size.
    expect(shapeInRoom(two, shape, 400, 104, 9)).toBe(shape)
    expect(extraInRoom(two, shape, ghosts(3, true), 400, 104, 9)).toEqual({ head: false, lanes: 0 })
    // A taller window (the text bound by the width): as many ghost rows as fit at that size.
    expect(extraInRoom(two, shape, ghosts(3), 400, 200, 9)).toEqual({ head: false, lanes: 1 })
    // No head line of its own (no reference, no predicted lap shown).
    const bare = { ...two, top: two.top.map((e) => ({ ...e, visible: false })) }
    const noHead = deltaShapeOf(bare, 'optimal')
    expect(noHead.head).toBe(false)
    // Its ghost parts only into room left over: none in a window fitted to the rows.
    expect(extraInRoom(bare, noHead, ghosts(0, true), 400, 90, 9).head).toBe(false)
    // A lap that won't count: the line comes while the rows still fit at the floor...
    const news: DeltaExtraWish = { news: true, ghostHead: false, ghosts: 0 }
    expect(extraInRoom(bare, noHead, news, 400, 90, 9)).toEqual({ head: true, lanes: 0 })
    // ...and not when it would take a row's room.
    expect(shapeInRoom(bare, noHead, 400, 65, 9)).toBe(noHead)
    expect(extraInRoom(bare, noHead, news, 400, 65, 9).head).toBe(false)
    // The delta of always takes nothing more.
    const one = deltaShapeOf(D, 'pb')
    expect(extraInRoom(D, one, { news: true, ghostHead: true, ghosts: 2 }, 400, 400, 9)).toEqual({
      head: false,
      lanes: 0
    })
  })

  it('«Estado» alone keeps no head line (its chevrons are on the rows)', () => {
    const two = opts(['pb', 'optimal'])
    const stateOnly = {
      ...two,
      top: two.top.map((e) => ({ ...e, visible: e.id === 'state' }))
    }
    expect(deltaShapeOf(stateOnly, 'optimal').head).toBe(false)
    const refOnly = { ...two, top: two.top.map((e) => ({ ...e, visible: e.id === 'reference' })) }
    expect(deltaShapeOf(refOnly, 'optimal').head).toBe(true)
  })

  it("the preview's ghosts never turn the delta of always into rows", () => {
    // The defaults while you edit: the hidden line and every hidden reference drawn as ghosts.
    // (The settings window reads any section as a plain record.)
    const zones = (o: object): ReturnType<typeof ghostZones> =>
      ghostZones('delta', o as Readonly<Record<string, unknown>>)
    const view = withGhosts(D, zones(D))
    expect(view.ghosts).toContain('delta.rows.refs')
    expect(deltaShapeOf(view.options, 'optimal').lanes).toBeGreaterThan(1)
    const real = withoutGhosts(view.options, view.ghosts)
    expect(deltaShapeOf(real, 'optimal')).toEqual(deltaShapeOf(D, 'optimal'))
    expect(deltaFitOf(real)).toEqual(deltaFitOf(D))
    // Three shown, the class ones ghosted: still three rows (and the head line).
    const three = opts(['pb', 'session', 'optimal'])
    const v3 = withGhosts(three, zones(three))
    expect(deltaShapeOf(withoutGhosts(v3.options, v3.ghosts), 'optimal')).toEqual(
      deltaShapeOf(three, 'optimal')
    )
    // No ghosts: the options themselves.
    expect(withoutGhosts(three, [])).toBe(three)
  })

  it('draws the real rows the room holds, then the ghosts that fit, in the list order', () => {
    const all = laneViews(['pb', 'session', 'optimal', 'class'], 'optimal', ES)
    const own: DeltaReference[] = ['pb', 'optimal']
    expect(lanesDrawn(all, own, 2, 0).map((b) => b.id)).toEqual(['pb', 'optimal'])
    expect(lanesDrawn(all, own, 2, 1).map((b) => b.id)).toEqual(['pb', 'session', 'optimal'])
    expect(lanesDrawn(all, own, 2, 5).map((b) => b.id)).toEqual([
      'pb',
      'session',
      'optimal',
      'class'
    ])
    // Short of room: the reference in use's row stays.
    expect(lanesDrawn(all, ['pb', 'session', 'optimal'], 2, 0).map((b) => b.id)).toEqual([
      'pb',
      'optimal'
    ])
  })

  it('says «No cabe» for the listed rows left out, and for the head line that gave way', () => {
    const drawn = laneViews(['pb', 'optimal'], 'optimal', ES)
    const listed: DeltaReference[] = ['pb', 'session', 'optimal']
    expect(lanesNoRoom(listed, drawn, 'optimal', true, false)).toEqual(['delta.refBars.session'])
    expect(lanesNoRoom(listed, drawn, 'optimal', true, true)).toEqual([
      'delta.rows.top',
      'delta.refBars.session'
    ])
    // Everything drawn: nothing to say.
    expect(lanesNoRoom(['pb', 'optimal'], drawn, 'optimal', true, false)).toEqual([])
    // No rows left (the delta of always): the line, then the rest; never the one in use.
    expect(lanesNoRoom(listed, [], 'optimal', false, false)).toEqual([
      'delta.rows.refs',
      'delta.refBars.pb',
      'delta.refBars.session'
    ])
    expect(lanesNoRoom(['optimal'], [], 'optimal', false, false)).toEqual([])
  })

  it('a reference brought in live takes the last row instead of adding one', () => {
    // Practice on the record, qualifying and the race on the optimal (the defaults).
    const two = opts(['pb', 'optimal'])
    expect(deltaShapeOf(two).lanes).toBe(2)
    // The cycle shortcut (or a fallback) brings in the class best: still two rows...
    expect(deltaShapeOf(two, 'class').lanes).toBe(3)
    expect(deltaLiveShape(two, 'class')).toEqual({ lanes: 2, head: true, bars: 0 })
    // ...the first in the list and the one in use.
    const rows = laneViews(deltaLanes(two, 'class'), 'class', ES)
    expect(lanesInRoom(rows, 2).map((b) => b.id)).toEqual(['pb', 'class'])
    // A reference among the planned ones changes nothing.
    expect(deltaLiveShape(two, 'pb')).toEqual(deltaShapeOf(two, 'pb'))
    // A window made for one (only the reference of every session shown): the delta of always
    // for the one brought in, with the listed one's small bar (2.4).
    const one = { ...opts(['optimal']), referencePractice: 'optimal' } as const
    expect(deltaShapeOf(one).lanes).toBe(1)
    expect(deltaLiveShape(one, 'pb')).toEqual({ lanes: 1, head: false, bars: 1 })
    expect(deltaLiveShape(one, 'optimal')).toEqual({ lanes: 1, head: false, bars: 1 })
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
