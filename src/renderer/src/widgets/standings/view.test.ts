import { describe, expect, it } from 'vitest'
import { MINUS } from '@shared/format'
import { messagesFor } from '@shared/i18n'
import { lapCell } from '@renderer/view/carExtras'
import { createDriverStyles } from '@renderer/view/styles'
import { reuseViews } from '@renderer/view/reuse'
import { lineMetrics, planLines } from './layout'
import { block, makeRow } from './testing/rows'
import {
  META_SEP,
  bestCell,
  classMeta,
  gainedCell,
  gapCell,
  gapLeaderCell,
  pitKind,
  pitLapCell,
  toLineViews,
  type CarLineView,
  type ClassLineView,
  type LineContext,
  type LineView
} from './view'

const M = MINUS

type ClassLine = LineContext['classLine']
const BOTH: ClassLine = [
  { id: 'sof', visible: true },
  { id: 'carCount', visible: true }
]
const line = (sof: boolean, cars: boolean, carsFirst = false): ClassLine => {
  const l: ClassLine = [
    { id: 'sof', visible: sof },
    { id: 'carCount', visible: cars }
  ]
  return carsFirst ? [...l].reverse() : l
}

const ES = messagesFor('es')
const EN = messagesFor('en')

function ctx(over: Partial<LineContext> = {}): LineContext {
  return {
    gapMode: 'interval',
    race: true,
    deltaAll: false,
    nameFormat: 'abbr',
    classLine: BOTH,
    showFlags: true,
    gapLeaderShown: false,
    styles: createDriverStyles(),
    m: ES,
    ...over
  }
}

function carView(row = makeRow(), c = ctx()): CarLineView {
  const v = toLineViews([{ kind: 'car', row, gapBefore: false, alt: false }], c)[0]
  if (v?.kind !== 'car') throw new Error('expected a car line')
  return v
}

const t = (seconds: number) => ({ kind: 'time', seconds }) as const
const l = (laps: number) => ({ kind: 'laps', laps }) as const

describe('gapCell', () => {
  const row = makeRow({ classPosition: 4, interval: t(1.24), gapToLeader: t(12.3) })

  it('shows the interval, the gap to the leader, or the interval in both mode', () => {
    expect(gapCell(row, 'interval', true, ES)).toEqual({ text: '+1.2', kind: 'time' })
    expect(gapCell(row, 'leader', true, ES)).toEqual({ text: '+12.3', kind: 'time' })
    expect(gapCell(row, 'both', true, ES)).toEqual({ text: '+1.2', kind: 'time' })
  })

  it('reads LEADER in English', () => {
    expect(gapCell(makeRow({ classPosition: 1 }), 'interval', true, EN)).toEqual({
      text: 'LEADER',
      kind: 'leader'
    })
    const lines = toLineViews(
      [{ kind: 'car', row: makeRow({ classPosition: 1 }), gapBefore: false, alt: false }],
      ctx({ m: EN })
    )
    expect((lines[0] as CarLineView).gap).toBe('LEADER')
  })

  it('falls back to the other gap when the chosen one is missing', () => {
    expect(gapCell({ ...row, interval: null }, 'interval', true, ES).text).toBe('+12.3')
    expect(gapCell({ ...row, gapToLeader: null }, 'leader', true, ES).text).toBe('+1.2')
  })

  // Lime Rock: a car 0.02 laps behind the one ahead read "+1L +1L" with gap mode 'both'.
  it('never repeats the gap to the leader its own column already shows (B16)', () => {
    const lapped = makeRow({ classPosition: 8, interval: null, gapToLeader: l(1) })
    expect(gapCell(lapped, 'both', true, ES, true)).toEqual({ text: '—', kind: 'none' })
    expect(gapCell(lapped, 'interval', true, ES, true).text).toBe('—')
    // Without that column it still stands in.
    expect(gapCell(lapped, 'both', true, ES, false).text).toBe('+1L')
    // In leader mode the column shows the gap to the leader anyway.
    expect(gapCell(lapped, 'leader', true, ES, true).text).toBe('+1L')
    const lines = toLineViews(
      [{ kind: 'car', row: lapped, gapBefore: false, alt: false }],
      ctx({ gapMode: 'both', gapLeaderShown: true })
    )
    expect(lines[0]).toMatchObject({ gap: '—', gapLeader: '+1L' })
  })

  it('reads LÍDER for the class leader, a dash when unknown, +NL for laps', () => {
    expect(gapCell(makeRow({ classPosition: 1 }), 'interval', true, ES)).toEqual({
      text: 'LÍDER',
      kind: 'leader'
    })
    expect(gapCell(makeRow({ classPosition: 3 }), 'interval', true, ES)).toEqual({
      text: '—',
      kind: 'none'
    })
    expect(gapCell(makeRow({ classPosition: 3, interval: l(2) }), 'interval', true, ES)).toEqual({
      text: '+2L',
      kind: 'laps'
    })
  })

  it('outside races shows the gap to the best lap with three decimals', () => {
    const q = makeRow({ classPosition: 3, interval: t(0.105), gapToLeader: t(0.412) })
    expect(gapCell(q, 'interval', false, ES)).toEqual({ text: '+0.412', kind: 'time' })
    expect(gapCell(q, 'leader', false, ES).text).toBe('+0.412')
    // 'both': the interval here, the gap to the best in the gapLeader column.
    expect(gapCell(q, 'both', false, ES).text).toBe('+0.105')
  })
})

describe('gapLeaderCell', () => {
  it('is the gap to the leader, blank on the leader itself', () => {
    expect(gapLeaderCell(makeRow({ classPosition: 2, gapToLeader: t(3.06) }), true)).toEqual({
      text: '+3.1',
      kind: 'time'
    })
    expect(gapLeaderCell(makeRow({ classPosition: 1 }), true)).toEqual({ text: '', kind: 'leader' })
    expect(gapLeaderCell(makeRow({ classPosition: 2 }), true).text).toBe('—')
    expect(gapLeaderCell(makeRow({ classPosition: 2, gapToLeader: t(0.4123) }), false).text).toBe(
      '+0.412'
    )
  })
})

describe('pitKind', () => {
  it('prefers the flag, then PIT, then OUT, then the stop count', () => {
    expect(pitKind(makeRow({ status: 'finished', outLap: true }))).toBe('finished')
    expect(pitKind(makeRow({ status: 'pits', outLap: true }))).toBe('pit')
    expect(pitKind(makeRow({ outLap: true, pitStops: 1 }))).toBe('out')
    expect(pitKind(makeRow({ pitStops: 2, lastPitLap: 12 }))).toBe('stops')
    expect(pitKind(makeRow())).toBe('none')
    // Unknown (a replay): no stops shown, but PIT and OUT still are.
    expect(pitKind(makeRow({ pitStops: null, lastPitLap: null }))).toBe('none')
    expect(pitKind(makeRow({ pitStops: null, status: 'pits' }))).toBe('pit')
  })

  it('tells a tow to the box from a stop (Q9)', () => {
    expect(pitKind(makeRow({ status: 'pits', towed: true }))).toBe('tow')
    // Out of the box after a tow: an out lap like any other.
    expect(pitKind(makeRow({ outLap: true }))).toBe('out')
  })
})

describe('lapCell', () => {
  it('races: the last lap, its kind as best / pb', () => {
    expect(lapCell(makeRow({ lastLap: 98.452 }), true)).toEqual({
      text: '1:38.452',
      kind: 'normal'
    })
    expect(lapCell(makeRow({ lastLap: 98.452, lastLapKind: 'class-best' }), true).kind).toBe('best')
    expect(lapCell(makeRow({ lastLap: 98.452, lastLapKind: 'personal-best' }), true).kind).toBe(
      'pb'
    )
    expect(lapCell(makeRow(), true)).toEqual({ text: '—', kind: 'none' })
  })

  it('practice and qualifying: the best lap, filled for the fastest of the class', () => {
    expect(lapCell(makeRow({ classPosition: 1, bestLap: 97.1, lastLap: 99 }), false)).toEqual({
      text: '1:37.100',
      kind: 'best'
    })
    expect(lapCell(makeRow({ classPosition: 2, bestLap: 97.5 }), false).kind).toBe('normal')
    expect(lapCell(makeRow({ classPosition: 2 }), false).kind).toBe('none')
  })
})

describe('gainedCell', () => {
  it('gives the count and a triangle for its direction', () => {
    expect(gainedCell(4)).toEqual({ text: '4', icon: 'arrow-up' })
    expect(gainedCell(-2.4)).toEqual({ text: '2', icon: 'arrow-down' })
    expect(gainedCell(12)).toEqual({ text: '12', icon: 'arrow-up' })
  })

  it('leaves the cell empty for none or unknown, never a placeholder glyph', () => {
    const empty = { text: '', icon: null }
    expect(gainedCell(0)).toEqual(empty)
    expect(gainedCell(0.4)).toEqual(empty)
    expect(gainedCell(-0.4)).toEqual(empty)
    expect(gainedCell(null)).toEqual(empty)
    expect(gainedCell(Number.NaN)).toEqual(empty)
  })
})

describe('classMeta', () => {
  it('joins SoF and car count per option, with an en space and no glyph', () => {
    const b = { sof: 2140, carCount: 12 }
    expect(classMeta(b, BOTH, ES)).toBe('SoF 2.1k\u200212 coches')
    expect(META_SEP).toBe('\u2002')
    expect(classMeta(b, line(false, true), ES)).toBe('12 coches')
    expect(classMeta(b, line(true, false), ES)).toBe('SoF 2.1k')
    expect(classMeta({ sof: null, carCount: 1 }, BOTH, ES)).toBe('1 coche')
    expect(classMeta(b, line(false, false), ES)).toBe('')
  })

  it('follows the class line’s order', () => {
    const b = { sof: 2140, carCount: 12 }
    expect(classMeta(b, line(true, true, true), ES)).toBe('12 coches\u2002SoF 2.1k')
    expect(classMeta(b, line(true, false, true), ES)).toBe('SoF 2.1k')
  })

  it('says it in English', () => {
    expect(classMeta({ sof: 2140, carCount: 12 }, BOTH, EN)).toBe('SoF 2.1k\u200212 cars')
    expect(classMeta({ sof: null, carCount: 1 }, BOTH, EN)).toBe('1 car')
  })
})

describe('toLineViews', () => {
  it('formats every cell of a car line', () => {
    const v = carView(
      makeRow({
        classPosition: 5,
        carNumber: '07',
        driverName: 'Alejandro Ruiz',
        iRating: 2391,
        licString: 'B 3.27',
        positionsGained: 4,
        interval: t(0.7),
        lastLap: 136.734,
        pitStops: 1
      })
    )
    expect(v).toMatchObject({
      kind: 'car',
      classTag: '',
      pos: '5',
      number: '07',
      name: 'A. Ruiz',
      iRating: '2.4k',
      lic: 'B 3.2',
      gained: '4',
      gainedIcon: 'arrow-up',
      gainedTone: 'good',
      gap: '+0.7',
      lap: '2:16.734',
      pit: 'stops',
      pitStops: '1'
    })
  })

  it('carries the make, the flag and the fastest-lap mark of the row', () => {
    const v = carView(makeRow({ brand: 'porsche', country: 'ES', bestLapKind: 'class-best' }))
    expect(v).toMatchObject({ brand: 'porsche', country: 'ES', fastest: true })
    expect(carView(makeRow()).fastest).toBe(false)
    expect(carView(makeRow({ lastLapKind: 'class-best' })).fastest).toBe(false)
  })

  it('puts state classes on the line', () => {
    expect(carView(makeRow({ isPlayer: true })).css).toBe('sd-line sd-car ov-player')
    expect(carView(makeRow({ status: 'pits' })).css).toBe('sd-line sd-car is-pits')
    expect(carView(makeRow({ status: 'finished' })).css).toBe('sd-line sd-car is-finished')
    const lines = toLineViews(
      [{ kind: 'car', row: makeRow({ status: 'disconnected' }), gapBefore: true, alt: true }],
      ctx()
    )
    expect(lines[0]?.css).toBe('sd-line sd-car is-alt is-sep is-disconnected')
    const v = carView(makeRow({ status: 'off-track' }))
    expect(v.posWarn).toBe(true)
    expect(carView(makeRow({ status: 'disconnected' })).disconnected).toBe(true)
  })

  it('shows the iRating change on your row only, unless on every row', () => {
    const other = makeRow({ iRatingDelta: 23 })
    const you = makeRow({ iRatingDelta: -12, isPlayer: true })
    expect(carView(other).delta).toBe('')
    expect(carView(you)).toMatchObject({ delta: `${M}12`, deltaTone: 'bad' })
    expect(carView(other, ctx({ deltaAll: true }))).toMatchObject({
      delta: '+23',
      deltaTone: 'good'
    })
    // Small changes are noise: dim.
    expect(carView(makeRow({ iRatingDelta: 3 }), ctx({ deltaAll: true })).deltaTone).toBe('dim')
    // Outside races there is none.
    expect(carView(you, ctx({ race: false })).delta).toBe('')
  })

  it('leaves positions gained out of practice and qualifying, and blank when none', () => {
    expect(carView(makeRow({ positionsGained: 2 }), ctx({ race: false }))).toMatchObject({
      gained: '',
      gainedIcon: null
    })
    expect(carView(makeRow({ positionsGained: 0 }))).toMatchObject({
      gained: '',
      gainedIcon: null,
      gainedTone: 'dim'
    })
    expect(carView(makeRow({ positionsGained: -3 }))).toMatchObject({
      gained: '3',
      gainedIcon: 'arrow-down',
      gainedTone: 'bad'
    })
  })

  it('uses the name format', () => {
    const row = makeRow({ driverName: 'Zoë van der Berg' })
    expect(carView(row, ctx({ nameFormat: 'full' })).name).toBe('Zoë van der Berg')
    expect(carView(row, ctx({ nameFormat: 'surname' })).name).toBe('van der Berg')
    expect(carView(row, ctx({ nameFormat: 'tv' })).name).toBe('BER')
  })

  it("shows 'Piloto #7' (dim) or the team for a name iRacing wrote as '?'", () => {
    const unknown = makeRow({ carNumber: '7', driverName: '' })
    expect(carView(unknown, ctx({ nameFormat: 'tv' }))).toMatchObject({
      name: 'Piloto #7',
      nameUnknown: true
    })
    expect(carView(unknown, ctx({ m: EN })).name).toBe('Driver #7')
    const team = makeRow({ carNumber: '7', driverName: '', teamName: 'Apex Racing Team' })
    expect(carView(team, ctx({ nameFormat: 'abbr' }))).toMatchObject({
      name: 'Apex Racing Team',
      nameUnknown: false
    })
  })

  it('turns another class leader into a one-line leader with its class tag', () => {
    const classes = [block([1, 2], {}, 1), block([1], { classId: 2, className: 'LMP2' })]
    const lines = toLineViews(
      planLines(classes, { oneLineLeaders: true }, lineMetrics('compact')),
      ctx()
    )
    expect(lines.map((v) => v.kind)).toEqual(['class', 'car', 'car', 'leader'])
    const leader = lines[3] as CarLineView
    expect(leader.classTag).toBe('LMP2')
    expect(leader.css).toBe('sd-line sd-car sd-leader')
    expect((lines[1] as CarLineView).classSof).toBe('')
  })

  it('gives a one-line leader its class SoF, as its class line says it (2.4)', () => {
    const classes = [
      block([1, 2], {}, 1),
      block([1], { classId: 2, className: 'LMP2', sof: 2690, carCount: 9 })
    ]
    const plan = planLines(classes, { oneLineLeaders: true }, lineMetrics('compact'))
    const sof = (c: LineContext): string => (toLineViews(plan, c)[3] as CarLineView).classSof
    // The SoF alone: the car count stays on the class lines.
    expect(sof(ctx())).toBe('SoF 2.7k')
    // The class line's SoF hidden: none here either.
    expect(
      sof(
        ctx({
          classLine: [
            { id: 'sof', visible: false },
            { id: 'carCount', visible: true }
          ]
        })
      )
    ).toBe('')
    // Unknown SoF: nothing.
    const none = [classes[0]!, block([1], { classId: 2, className: 'LMP2', sof: 0 })]
    const plan0 = planLines(none, { oneLineLeaders: true }, lineMetrics('compact'))
    expect((toLineViews(plan0, ctx())[3] as CarLineView).classSof).toBe('')
  })

  it('words a class without a name in the window language, on its line and as a leader tag', () => {
    const classes = [block([1, 2], {}, 1), block([1], { classId: 30, className: '' })]
    const plan = planLines(classes, { oneLineLeaders: false }, lineMetrics('compact'))
    const names = (m: typeof ES): string[] =>
      toLineViews(plan, ctx({ m }))
        .filter((v): v is ClassLineView => v.kind === 'class')
        .map((v) => v.name)
    expect(names(ES)).toEqual(['GT3', 'Clase 30'])
    expect(names(EN)).toEqual(['GT3', 'Class 30'])

    const leaders = planLines(classes, { oneLineLeaders: true }, lineMetrics('compact'))
    const tag = (m: typeof ES): string =>
      (toLineViews(leaders, ctx({ m }))[3] as CarLineView).classTag
    expect(tag(ES)).toBe('Clase 30')
    expect(tag(EN)).toBe('Class 30')
  })

  it('builds class lines with their meta and shared colour styles', () => {
    const c = ctx({ classLine: line(true, false) })
    const lines = toLineViews([{ kind: 'class', block: block([1, 2], { sof: 1980 }, 1) }], c)
    const v = lines[0] as ClassLineView
    expect(v).toMatchObject({
      kind: 'class',
      name: 'GT3',
      meta: 'SoF 2.0k',
      metaSof: 'SoF 2.0k',
      metaCars: '',
      metaCarsFirst: false,
      css: 'sd-line sd-class is-own'
    })
    // Part by part in the class line's order, the same words as the joined meta.
    const both = toLineViews(
      [{ kind: 'class', block: block([1, 2], { sof: 1980 }, 1) }],
      ctx({ classLine: line(true, true, true) })
    )[0] as ClassLineView
    expect([both.metaCarsFirst, both.metaCars, both.metaSof]).toEqual([
      true,
      '2 coches',
      'SoF 2.0k'
    ])
    expect(both.meta).toBe('2 coches SoF 2.0k')
    expect(v.clsStyle).toBe(c.styles.cls('#ff0000'))
  })

  it('shares one style object per colour and falls back on bad colours', () => {
    const c = ctx()
    const a = carView(makeRow({ classColor: '#00ff00', licColor: 'nope' }), c)
    const b = carView(makeRow({ classColor: '#00ff00', carIdx: 9 }), c)
    expect(a.clsStyle).toBe(b.clsStyle)
    expect(a.licStyle['--lic']).toBe('#4b5160')
  })

  it('produces equal views for equal rows, so reuseViews keeps the previous objects', () => {
    const c = ctx()
    const classes = [block([1, 2, 3], {}, 2), block([1], { classId: 2 })]
    const plan = planLines(classes, { oneLineLeaders: true }, lineMetrics('compact'))
    const first = toLineViews(plan, c)
    const again = reuseViews<LineView>(first, toLineViews(plan, c))
    expect(again).toBe(first)
    const moved = planLines(
      [
        {
          ...classes[0]!,
          rows: classes[0]!.rows.map((r) => (r.classPosition === 3 ? { ...r, interval: t(2) } : r))
        },
        classes[1]!
      ],
      { oneLineLeaders: true },
      lineMetrics('compact')
    )
    const next = reuseViews<LineView>(first, toLineViews(moved, c))
    expect(next).not.toBe(first)
    expect(next.filter((v, i) => v === first[i])).toHaveLength(first.length - 1)
  })
})

describe('best lap, last stop, stint and tyre cells', () => {
  it('best: the best lap, filled for the fastest of the class, a dash without one', () => {
    expect(bestCell(makeRow({ bestLap: 97.1, bestLapKind: 'class-best' }))).toEqual({
      text: '1:37.100',
      kind: 'best'
    })
    expect(bestCell(makeRow({ bestLap: 97.5 }))).toEqual({ text: '1:37.500', kind: 'normal' })
    expect(bestCell(makeRow())).toEqual({ text: '—', kind: 'none' })
  })

  it("last stop: the lap of the latest stop, in the window's language, blank without one", () => {
    expect(pitLapCell(makeRow({ pitStops: 2, lastPitLap: 12 }), ES)).toBe('V12')
    expect(pitLapCell(makeRow({ pitStops: 1, lastPitLap: 12 }), EN)).toBe('L12')
    expect(pitLapCell(makeRow(), ES)).toBe('')
    // A pit-lane start leaves the pits without stopping.
    expect(pitLapCell(makeRow({ pitStops: 0, lastPitLap: 1 }), ES)).toBe('')
    expect(pitLapCell(makeRow({ pitStops: null, lastPitLap: null }), ES)).toBe('')
  })

  it('fills the car line', () => {
    const row = makeRow({
      bestLap: 136.612,
      pitStops: 1,
      lastPitLap: 9,
      stintLaps: 6,
      tyre: 'Wet',
      penalty: 'furled'
    })
    expect(carView(row)).toMatchObject({
      best: '2:16.612',
      bestKind: 'normal',
      pitLap: 'V9',
      stint: '6',
      stintUnit: 'v',
      tyre: 'W',
      penalty: 'furled'
    })
    expect(carView(row, ctx({ m: EN }))).toMatchObject({ pitLap: 'L9', stintUnit: 'lp' })
    // Without its option the badge goes; the rest of the line stays.
    expect(carView(row, ctx({ showFlags: false }))).toMatchObject({ penalty: null, tyre: 'W' })
    // Unknown stint and tyre: no stint at all, a dash for the tyre.
    expect(carView(makeRow())).toMatchObject({ stint: '', stintUnit: '', tyre: '—', pitLap: '' })
  })
})
