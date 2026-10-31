import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { INFO_ITEM_IDS } from '@shared/infoBar'
import { DEFAULT_SETTINGS } from '@shared/settings'
import type { InfoBarData, InfoBarEntryId } from '@shared/types'
import {
  NO_BAR,
  PREVIEW_INFO,
  barEntries,
  hasInfoBar,
  infoBarView,
  reuseInfoBar,
  simClockText,
  simNight,
  srBudgetText,
  type InfoBarContext,
  type InfoItemView
} from './infoBar'

const ES = messagesFor('es')
const EN = messagesFor('en')
const ctx = (o: Partial<InfoBarContext> = {}): InfoBarContext => ({
  title: 'RELATIVO',
  sessionFallback: '',
  clock: '21:07',
  units: 'metric',
  trend: true,
  windDirection: true,
  m: ES,
  ...o
})
const ids = (items: readonly InfoItemView[]): string[] => items.map((v) => v.id)

describe('barEntries', () => {
  it('the shown entries in order, the marker included; none with the bar off', () => {
    const list = DEFAULT_SETTINGS.relative.headerBar
    expect(barEntries(list, 'normal')).toEqual(['title', 'split'])
    expect(barEntries(list, 'off')).toEqual([])
  })
})

describe('infoBarView', () => {
  it('splits at the marker: the relative header of today', () => {
    const v = infoBarView(['title', 'session', 'split', 'incidents'], PREVIEW_INFO, ctx())
    expect(ids(v.start)).toEqual(['title', 'session'])
    expect(ids(v.end)).toEqual(['incidents'])
    expect(v.start[0]).toEqual({ id: 'title', text: 'RELATIVO' })
    expect(v.start[1]).toEqual({ id: 'session', text: 'CARRERA' })
  })

  it('every item of the sample has something to show, in both languages', () => {
    const all: InfoBarEntryId[] = [...INFO_ITEM_IDS]
    for (const m of [ES, EN]) {
      const v = infoBarView(all, PREVIEW_INFO, ctx({ m }))
      expect(ids(v.start), m === ES ? 'es' : 'en').toEqual([...INFO_ITEM_IDS])
    }
  })

  it('formats the items', () => {
    const v = infoBarView(
      [
        'remaining',
        'sof',
        'carCount',
        'fastestLap',
        'fuelLaps',
        'clock',
        'iRating',
        'safetyRating'
      ],
      PREVIEW_INFO,
      ctx()
    )
    const by = Object.fromEntries(v.start.map((x) => [x.id, x]))
    expect(by.sof).toEqual({ id: 'sof', text: 'SoF 2.1k' })
    expect(by.carCount).toEqual({ id: 'carCount', text: '24 coches' })
    expect(by.fastestLap).toEqual({ id: 'fastestLap', tag: 'VR', text: '#9 2:08.734', mine: false })
    expect(by.fuelLaps).toEqual({ id: 'fuelLaps', label: 'Comb.', value: '6.4 v' })
    expect(by.clock).toEqual({ id: 'clock', text: '21:07' })
    expect(by.remaining).toMatchObject({ id: 'remaining', finished: false })
    expect(by.iRating).toMatchObject({
      value: '+13',
      tone: 'good',
      arrow: 'arrow-up',
      swingUp: 'P4 +31',
      neutral: 'neutro P6'
    })
    expect(by.safetyRating).toMatchObject({ from: '3.98', to: '4.02', budget: 'margen 4x' })
  })

  it('the sim time as the local clock, HH:MM in 24 h, and nothing while unknown', () => {
    const v = infoBarView(['clock', 'simClock'], PREVIEW_INFO, ctx())
    expect(v.start).toEqual([
      { id: 'clock', text: '21:07' },
      { id: 'simClock', text: '14:32', night: false }
    ])
    expect(simClockText(0)).toBe('00:00')
    expect(simClockText(9 * 60 + 5)).toBe('09:05')
    expect(simClockText(1439)).toBe('23:59')
    // A moon at night (20:00 to 06:00), a sun by day, so the sim's hour reads at a glance.
    for (const [m, night] of [
      [0, true],
      [5 * 60 + 59, true],
      [6 * 60, false],
      [19 * 60 + 59, false],
      [20 * 60, true],
      [23 * 60 + 50, true],
      [1440 + 7 * 60, false]
    ] as const) {
      expect(simNight(m)).toBe(night)
    }
    expect(simClockText(1440 + 61)).toBe('01:01')
    const none = infoBarView(['simClock'], { ...PREVIEW_INFO, simMinutes: null }, ctx())
    expect(none).toBe(NO_BAR)
  })

  it('leaves out an item with nothing to say, and is NO_BAR with nothing at all', () => {
    const empty: InfoBarData = { ...PREVIEW_INFO, iRating: null, fastestLap: null, fuelLaps: null }
    const v = infoBarView(['iRating', 'split', 'fastestLap', 'fuelLaps', 'incidents'], empty, ctx())
    expect(ids(v.start)).toEqual([])
    expect(ids(v.end)).toEqual(['incidents'])
    expect(infoBarView(['iRating', 'fuelLaps'], empty, ctx())).toBe(NO_BAR)
    expect(infoBarView([], PREVIEW_INFO, ctx())).toBe(NO_BAR)
    expect(hasInfoBar(NO_BAR)).toBe(false)
    expect(hasInfoBar(v)).toBe(true)
    // No data yet: only the renderer's items.
    expect(ids(infoBarView(['title', 'session', 'clock'], null, ctx()).start)).toEqual([
      'title',
      'clock'
    ])
  })

  it('the session falls back to what the widget gives (the standings: its name)', () => {
    const d: InfoBarData = { ...PREVIEW_INFO, sessionType: null }
    expect(infoBarView(['session'], d, ctx()).start).toEqual([])
    expect(infoBarView(['session'], d, ctx({ sessionFallback: 'CLASIFICACIÓN' })).start).toEqual([
      { id: 'session', text: 'CLASIFICACIÓN' }
    ])
  })

  it('what is left: the flag, the last lap, the clock and laps', () => {
    const at = (o: Partial<InfoBarData>): InfoItemView | undefined =>
      infoBarView(['remaining'], { ...PREVIEW_INFO, ...o }, ctx()).start[0]
    expect(at({ finished: true })).toEqual({ id: 'remaining', text: 'Final', finished: true })
    expect(at({ lapsRemaining: 1, timeRemainingS: null })).toMatchObject({ text: 'Última vuelta' })
    expect(at({ lapsRemaining: null, timeRemainingS: null })).toBeUndefined()
  })

  it('the weather items follow the trend and dial options and the units', () => {
    const items: InfoBarEntryId[] = ['trackTemp', 'wind', 'wet', 'airTemp', 'rubber']
    const v = infoBarView(items, PREVIEW_INFO, ctx({ trend: false, windDirection: false }))
    const by = Object.fromEntries(v.start.map((x) => [x.id, x]))
    expect(by.trackTemp).toMatchObject({ reading: { trend: null } })
    expect(by.wind).toMatchObject({ reading: { dial: false } })
    const f = infoBarView(['airTemp'], PREVIEW_INFO, ctx({ units: 'imperial', m: EN })).start[0]
    expect(f).toMatchObject({ reading: { label: 'Air', unit: '°F' } })
  })
})

describe('reuseInfoBar', () => {
  it('keeps every equal item, and the whole view when nothing changed', () => {
    const a = infoBarView(['session', 'split', 'incidents'], PREVIEW_INFO, ctx())
    const b = infoBarView(['session', 'split', 'incidents'], { ...PREVIEW_INFO }, ctx())
    expect(reuseInfoBar(a, b)).toBe(a)
    const c = infoBarView(
      ['session', 'split', 'incidents'],
      { ...PREVIEW_INFO, incidents: { mine: 9, team: null, limit: null } },
      ctx()
    )
    const r = reuseInfoBar(a, c)
    expect(r).not.toBe(a)
    expect(r.start[0]).toBe(a.start[0])
    expect(r.end[0]).not.toBe(a.end[0])
    expect(reuseInfoBar(undefined, c)).toBe(c)
  })
})

describe('srBudgetText', () => {
  it('red only when the margin is really gone', () => {
    const sr = PREVIEW_INFO.safetyRating
    if (sr === null) throw new Error('no SR')
    expect(srBudgetText({ ...sr, incidentBudget: 0, incidents: 2 }, ES).tone).toBe('bad')
    expect(srBudgetText({ ...sr, incidentBudget: 0, incidents: 0 }, ES).tone).toBe('dim')
    expect(srBudgetText({ ...sr, incidentBudget: 2 }, ES).tone).toBe('warn')
  })
})
