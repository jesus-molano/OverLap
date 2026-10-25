import { describe, expect, it } from 'vitest'
import { LOCALES, messagesFor } from '@shared/i18n'
import type { SafetyRatingProjection, StandingsHeader } from '@shared/types'
import { widgetCaption } from '@renderer/view/caption'
import { headerTier, srBudget, toHeaderView, type HeaderInput } from './headerView'
import { block, makeRow } from './testing/rows'

const ES = messagesFor('es')
const EN = messagesFor('en')
const WIDGET_TITLE = widgetCaption(ES, 'standings', LOCALES.es)

const SR: SafetyRatingProjection = {
  current: 3.27,
  projected: 3.31,
  licClass: 'B',
  projectedLicClass: 'B',
  incidents: 1,
  corners: 112,
  incidentBudget: 4
}

function header(over: Partial<StandingsHeader> = {}): StandingsHeader {
  return {
    sessionType: 'Race',
    lapsRemaining: 19,
    timeRemainingS: 2299,
    iRating: {
      iRatingDelta: 13,
      perPosition: 17,
      breakEvenPosition: 6,
      ifGainOne: 31,
      ifLoseOne: -5
    },
    safetyRating: SR,
    ...over
  }
}

function input(over: Partial<HeaderInput> = {}): HeaderInput {
  return {
    header: header(),
    classes: [block([1, 2, 3, 4, 5, 6], {}, 5), block([1], { classId: 2 })],
    race: true,
    showIRating: true,
    showSafetyRating: true,
    showSof: true,
    showCarCount: true,
    preview: false,
    title: WIDGET_TITLE,
    m: ES,
    ...over
  }
}

describe('toHeaderView', () => {
  it('builds both lines of a race', () => {
    const h = toHeaderView(input())
    expect(h).toMatchObject({
      title: 'CARRERA',
      meta: '',
      remaining: '38:19\u2002≈19 v',
      finished: false,
      lines: 2,
      hasIr: true,
      irValue: '+13',
      irTone: 'good',
      irArrow: 'arrow-up',
      irSwingUp: 'P4 +31',
      irSwingDown: 'P6 \u22125',
      irNeutral: 'neutro P6',
      hasSr: true,
      srFrom: '3.27',
      srTo: '3.31',
      srTone: 'good',
      srArrow: 'arrow-up',
      srIncidents: '1x',
      srBudget: 'margen 4x',
      srBudgetTone: 'neutral'
    })
  })

  it('is flat, so an unchanged header keeps its object (shallow reuse)', () => {
    for (const v of Object.values(toHeaderView(input()))) expect(typeof v).not.toBe('object')
  })

  it('falls back to the iRating per position without your row', () => {
    const h = toHeaderView(input({ classes: [block([1, 2, 3])] }))
    expect(h).toMatchObject({ irSwingUp: '±17/pos', irSwingDown: '' })
    const p1 = toHeaderView(input({ classes: [block([1, 2], {}, 1)] }))
    // P1 cannot gain a place: only the one behind.
    expect(p1).toMatchObject({ irSwingUp: '', irSwingDown: 'P2 −5' })
  })

  it('shows the licence letters when the projection changes class', () => {
    const h = toHeaderView(
      input({
        header: header({
          safetyRating: {
            ...SR,
            current: 3.98,
            projected: 4.02,
            licClass: 'B',
            projectedLicClass: 'A'
          }
        })
      })
    )
    expect(h.srFrom).toBe('B 3.98')
    expect(h.srTo).toBe('A 4.02')
  })

  it('compares the SR as shown: no arrow when it does not move in hundredths', () => {
    const h = toHeaderView(
      input({ header: header({ safetyRating: { ...SR, projected: 3.2741 } }) })
    )
    expect(h.srArrow).toBe('')
    expect(h.srTone).toBe('neutral')
  })

  it('names the single class next to the title instead of a class line', () => {
    const h = toHeaderView(input({ classes: [block([1, 2], { sof: 2050, carCount: 18 }, 1)] }))
    expect(h.meta).toBe('SoF 2.1k\u200218 coches')
    expect(
      toHeaderView(input({ classes: [block([1], {}, 1)], showSof: false, showCarCount: false }))
        .meta
    ).toBe('')
  })

  it('says Final once a car has taken the flag', () => {
    const classes = [
      {
        ...block([1, 2], {}, 2),
        rows: [makeRow({ status: 'finished' }), makeRow({ classPosition: 2, isPlayer: true })]
      }
    ]
    expect(toHeaderView(input({ classes })).finished).toBe(true)
    expect(toHeaderView(input({ classes, race: false })).finished).toBe(false)
  })

  it('outside races: no iRating, the session best on line 2', () => {
    const rows = [
      makeRow({ classPosition: 1, carNumber: '29', bestLap: 127.579 }),
      makeRow({ classPosition: 2, isPlayer: true, bestLap: 128 })
    ]
    const h = toHeaderView(
      input({
        header: header({ sessionType: 'Lone Qualify', safetyRating: null }),
        classes: [{ ...block([], {}, 2), rows }],
        race: false
      })
    )
    expect(h).toMatchObject({
      title: 'CLASIF.',
      hasIr: false,
      best: 'Mejor 2:07.579\u2002#29',
      lines: 2
    })
    expect(
      toHeaderView(
        input({
          header: header({ iRating: null, safetyRating: null }),
          race: false,
          classes: [block([2, 3], {}, 2)]
        })
      ).lines
    ).toBe(1)
  })

  it('falls back to the widget name and one line without data', () => {
    const h = toHeaderView(input({ header: null, classes: null }))
    expect(h).toMatchObject({
      title: WIDGET_TITLE,
      remaining: '',
      lines: 1,
      hasIr: false,
      hasSr: false
    })
    expect(WIDGET_TITLE).toBe('CLASIFICACIÓN')
  })

  it('hides a rating line part as soon as its option is off', () => {
    const noIr = toHeaderView(input({ showIRating: false }))
    expect(noIr).toMatchObject({ hasIr: false, hasSr: true, lines: 2 })
    const none = toHeaderView(input({ showIRating: false, showSafetyRating: false }))
    expect(none).toMatchObject({ hasIr: false, hasSr: false, lines: 1, srBudget: '' })
  })

  it('marks the preview', () => {
    expect(toHeaderView(input({ preview: true })).preview).toBe(true)
  })

  it('says both lines in English', () => {
    const en = (over: Partial<HeaderInput> = {}): HeaderInput =>
      input({ m: EN, title: widgetCaption(EN, 'standings', LOCALES.en), ...over })
    expect(toHeaderView(en())).toMatchObject({
      title: 'RACE',
      remaining: '38:19\u2002≈19 L',
      irNeutral: 'break-even P6',
      srIncidents: '1x',
      srBudget: 'margin 4x'
    })
    expect(toHeaderView(en({ header: null, classes: null })).title).toBe('STANDINGS')
    expect(
      toHeaderView(en({ classes: [block([1, 2], { sof: 2050, carCount: 18 }, 1)] })).meta
    ).toBe('SoF 2.1k\u200218 cars')
    const rows = [
      makeRow({ classPosition: 1, carNumber: '29', bestLap: 127.579 }),
      makeRow({ classPosition: 2, isPlayer: true, bestLap: 128 })
    ]
    const quali = toHeaderView(
      en({
        header: header({ sessionType: 'Open Qualify', safetyRating: null }),
        classes: [{ ...block([], {}, 2), rows }],
        race: false
      })
    )
    expect(quali).toMatchObject({ title: 'QUALIFY', best: 'Best 2:07.579\u2002#29' })
    expect(toHeaderView(en({ classes: [block([1, 2, 3])] })).irSwingUp).toBe('±17/pos')
  })
})

describe('srBudget', () => {
  it('is red only when the margin is really gone', () => {
    expect(srBudget({ ...SR, incidents: 2, incidentBudget: 0 }, ES)).toEqual({
      text: 'sin margen',
      tone: 'bad'
    })
    expect(srBudget({ ...SR, incidents: 0, incidentBudget: 0, projected: 3.1 }, ES)).toEqual({
      text: 'sin margen',
      tone: 'bad'
    })
  })

  it('reads "margen —" for a clean driver with nothing measurable yet', () => {
    expect(
      srBudget({ ...SR, incidents: 0, corners: 0, incidentBudget: 0, projected: 3.27 }, ES)
    ).toEqual({
      text: 'margen —',
      tone: 'dim'
    })
  })

  it('warns at one or two incidents left', () => {
    expect(srBudget({ ...SR, incidentBudget: 2 }, ES)).toEqual({ text: 'margen 2x', tone: 'warn' })
    expect(srBudget({ ...SR, incidentBudget: 1.7 }, ES)).toEqual({
      text: 'margen 1x',
      tone: 'warn'
    })
    expect(srBudget({ ...SR, incidentBudget: 3 }, ES)).toEqual({
      text: 'margen 3x',
      tone: 'neutral'
    })
    expect(srBudget({ ...SR, incidentBudget: Number.NaN, incidents: 0 }, ES).tone).toBe('dim')
  })

  it('says the margin in English', () => {
    expect(srBudget({ ...SR, incidents: 2, incidentBudget: 0 }, EN).text).toBe('no margin')
    expect(srBudget({ ...SR, incidents: 0, incidentBudget: 0, projected: 3.27 }, EN).text).toBe(
      'margin —'
    )
    expect(srBudget({ ...SR, incidentBudget: 2 }, EN).text).toBe('margin 2x')
  })
})

describe('headerTier', () => {
  it('drops secondary pieces as the panel narrows', () => {
    expect(headerTier(40)).toBe('')
    expect(headerTier(31)).toBe('')
    expect(headerTier(30)).toBe('m')
    expect(headerTier(26)).toBe('m')
    expect(headerTier(25)).toBe('s')
    expect(headerTier(21)).toBe('s')
    expect(headerTier(20)).toBe('xs')
    expect(headerTier(0)).toBe('')
  })
})
