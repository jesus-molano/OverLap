import { describe, expect, it } from 'vitest'
import { MINUS } from '@shared/format'
import { messagesFor } from '@shared/i18n'
import type { BattleData, BattleOpponent } from '@shared/types'
import { createDriverStyles } from '@renderer/view/styles'
import { PREVIEW_BATTLE, previewBattle } from './preview'
import {
  LAP_CHIPS,
  SIDE_MIN_EM,
  arrangement,
  catchView,
  gapView,
  hasOpponents,
  isLastLap,
  lapChips,
  lapDelta,
  laneRows,
  sectorChips,
  stakeText,
  toLaneView,
  toLaneViews,
  trendView,
  type LaneOptions
} from './view'

const M = MINUS

const NB = ' '
const ES = messagesFor('es')
const EN = messagesFor('en')

function opponent(over: Partial<BattleOpponent> = {}): BattleOpponent {
  return {
    inPits: false,
    carIdx: 5,
    carNumber: '23',
    driverName: 'Ana López',
    classColor: '#ffda59',
    iRating: 2140,
    licString: 'B 3.41',
    licColor: '#00c702',
    gapS: 0.8,
    trendSPerLap: 0.1,
    lapsToCatch: null,
    catchesBeforeEnd: null,
    neededSPerLap: null,
    lastLaps: [],
    sectorDeltas: null,
    iRatingAtStake: null,
    ...over
  }
}

function battle(over: Partial<BattleData> = {}): BattleData {
  return {
    visible: true,
    lapsRemaining: 10,
    playerLastLaps: [],
    ahead: null,
    behind: null,
    ...over
  }
}

const OPTS: LaneOptions = {
  detail: 'sectors',
  showPrediction: true,
  showStake: true,
  nameFormat: 'abbr'
}

describe('rows and arrangement', () => {
  it('rows follow the options only', () => {
    expect(laneRows({ detail: 'none', showPrediction: false })).toEqual({
      catch: false,
      sectors: false,
      laps: false
    })
    expect(laneRows({ detail: 'sectors', showPrediction: true })).toEqual({
      catch: true,
      sectors: true,
      laps: false
    })
    expect(laneRows({ detail: 'laps', showPrediction: true })).toMatchObject({
      sectors: false,
      laps: true
    })
    expect(laneRows({ detail: 'both', showPrediction: true })).toMatchObject({
      sectors: true,
      laps: true
    })
  })

  it('side by side only with two lanes and room for them', () => {
    expect(arrangement('side', 2)).toBe('side')
    expect(arrangement('side', 2, SIDE_MIN_EM)).toBe('side')
    expect(arrangement('side', 2, SIDE_MIN_EM - 0.1)).toBe('stack')
    expect(arrangement('side', 1)).toBe('stack')
    expect(arrangement('stacked', 2, 80)).toBe('stack')
  })
})

describe('gapView / trendView', () => {
  it('splits the hero gap from its unit', () => {
    expect(gapView(0.64)).toEqual({ value: '0.6', unit: 's' })
    expect(gapView(-1.2)).toEqual({ value: '1.2', unit: 's' })
    expect(gapView(0)).toEqual({ value: '0.0', unit: 's' })
    expect(gapView(65)).toEqual({ value: '1:05', unit: '' })
    expect(gapView(null)).toEqual({ value: '—', unit: '' })
    expect(gapView(NaN)).toEqual({ value: '—', unit: '' })
  })

  it('+ is in your favour on both sides, with a chevron and words', () => {
    expect(trendView(0.15, 'ahead', ES)).toEqual({
      icon: 'arrow-up',
      text: `+0.15${NB}s/v`,
      note: 'le recortas',
      tone: 'good'
    })
    expect(trendView(-0.12, 'ahead', ES)).toMatchObject({ icon: 'arrow-down', note: 'se escapa' })
    expect(trendView(0.1, 'behind', ES)).toMatchObject({ note: 'te escapas', tone: 'good' })
    expect(trendView(-0.2, 'behind', ES)).toMatchObject({ note: 'te alcanza', tone: 'bad' })
  })

  it('stable and unknown', () => {
    expect(trendView(0.004, 'ahead', ES)).toEqual({
      icon: null,
      text: `=${NB}0.00${NB}s/v`,
      note: 'estable',
      tone: 'neutral'
    })
    expect(trendView(null, 'behind', ES)).toEqual({
      icon: null,
      text: `—${NB}s/v`,
      note: 'midiendo…',
      tone: 'dim'
    })
    expect(trendView(Infinity, 'behind', ES).tone).toBe('dim')
  })
})

describe('catchView', () => {
  it('ahead, catching in time: laps to catch of laps left', () => {
    expect(
      catchView(opponent({ lapsToCatch: 4.2, catchesBeforeEnd: true }), 'ahead', 19, ES)
    ).toEqual({
      icon: 'check',
      text: `Le alcanzas en ~4${NB}v`,
      note: `de${NB}19`,
      tone: 'good'
    })
    // Laps left unknown: no 'de N'.
    expect(catchView(opponent({ lapsToCatch: 4.2 }), 'ahead', null, ES)).toMatchObject({
      text: `Le alcanzas en ~4${NB}v`,
      note: ''
    })
  })

  it('ahead, closing too slowly: the pace you need (confirmed semantics#7)', () => {
    const v = catchView(
      opponent({ lapsToCatch: 12, catchesBeforeEnd: false, neededSPerLap: 0.24 }),
      'ahead',
      5,
      ES
    )
    expect(v).toEqual({
      icon: 'minus',
      text: `Necesitas +0.24${NB}s/v`,
      note: `a este ritmo ~12${NB}v de${NB}5`,
      tone: 'bad'
    })
    expect(
      catchView(opponent({ lapsToCatch: 12, catchesBeforeEnd: false }), 'ahead', 5, ES)
    ).toEqual({
      icon: 'minus',
      text: 'No le alcanzas',
      note: `~12${NB}v de${NB}5`,
      tone: 'bad'
    })
  })

  it('ahead, not closing: the pace you need when known, else nothing', () => {
    expect(
      catchView(opponent({ trendSPerLap: -0.1, neededSPerLap: 0.18 }), 'ahead', 8, ES)
    ).toEqual({
      icon: 'minus',
      text: `Necesitas +0.18${NB}s/v`,
      note: '',
      tone: 'neutral'
    })
    expect(catchView(opponent({ trendSPerLap: -0.1 }), 'ahead', 8, ES)).toBeNull()
  })

  it('behind: when it catches you, or that it will not', () => {
    expect(
      catchView(opponent({ lapsToCatch: 11.6, catchesBeforeEnd: true }), 'behind', 19, ES)
    ).toEqual({ icon: 'alert', text: `Te alcanza en ~12${NB}v`, note: `de${NB}19`, tone: 'bad' })
    expect(
      catchView(opponent({ lapsToCatch: 9, catchesBeforeEnd: false }), 'behind', 4, ES)
    ).toEqual({
      icon: 'check',
      text: 'No te alcanza',
      note: `~9${NB}v de${NB}4`,
      tone: 'good'
    })
    // neededSPerLap is an ahead-only field; not closing behind says nothing.
    expect(catchView(opponent({ neededSPerLap: 0.3 }), 'behind', 4, ES)).toBeNull()
  })

  it('nothing while the trend is measured or the opponent is in the pits', () => {
    expect(
      catchView(
        opponent({ trendSPerLap: null, lapsToCatch: 3, neededSPerLap: 0.2 }),
        'ahead',
        9,
        ES
      )
    ).toBeNull()
    expect(catchView(opponent({ inPits: true, lapsToCatch: 3 }), 'ahead', 9, ES)).toBeNull()
  })

  it('under a lap reads "< 1 v"', () => {
    expect(catchView(opponent({ lapsToCatch: 0.3 }), 'ahead', 3, ES)?.text).toBe(
      `Le alcanzas en <${NB}1${NB}v`
    )
  })

  it('last lap', () => {
    expect(isLastLap(1)).toBe(true)
    expect(isLastLap(0.4)).toBe(true)
    expect(isLastLap(1.1)).toBe(false)
    expect(isLastLap(0)).toBe(false)
    expect(isLastLap(null)).toBe(false)
  })
})

describe('delta chips', () => {
  it('lap delta: their lap minus yours at the shown precision', () => {
    expect(lapDelta(98.452, 98.601)).toBe(0.149)
    expect(lapDelta(98.7, 98.5)).toBe(-0.2)
    expect(lapDelta(null, 98.5)).toBeNull()
    expect(lapDelta(0, 98.5)).toBeNull()
    expect(lapDelta(undefined, undefined)).toBeNull()
  })

  it('always three lap chips, — where a time is missing', () => {
    const chips = lapChips([98.452, 98.63], [98.601, 98.512, 98.774], ES)
    expect(chips).toHaveLength(LAP_CHIPS)
    expect(chips).toEqual([
      { label: 'V-1', text: '+0.15', tone: 'good' },
      { label: 'V-2', text: `${M}0.12`, tone: 'bad' },
      { label: 'V-3', text: '—', tone: 'dim' }
    ])
    expect(lapChips([], [], ES).every((c) => c.text === '—')).toBe(true)
  })

  it('sector chips keep the row while unknown, plus Últ when asked', () => {
    expect(sectorChips([0.12, -0.05, 0.003], undefined, ES)).toEqual([
      { label: 'S1', text: '+0.12', tone: 'good' },
      { label: 'S2', text: `${M}0.05`, tone: 'bad' },
      { label: 'S3', text: '0.00', tone: 'neutral' }
    ])
    expect(sectorChips(null, undefined, ES)).toEqual([
      { label: 'Sectores', text: '—', tone: 'dim' }
    ])
    expect(sectorChips([], 0.17, ES)).toEqual([
      { label: 'Sectores', text: '—', tone: 'dim' },
      { label: 'Últ', text: '+0.17', tone: 'good' }
    ])
    expect(sectorChips([0.1], null, ES).at(-1)).toEqual({ label: 'Últ', text: '—', tone: 'dim' })
  })

  it('iRating at stake', () => {
    expect(stakeText(18.4)).toBe('±18')
    expect(stakeText(-7)).toBe('±7')
    expect(stakeText(0.2)).toBeNull()
    expect(stakeText(null)).toBeNull()
  })
})

describe('toLaneView', () => {
  const styles = createDriverStyles()

  it('builds every row of a lane', () => {
    const op = opponent({
      trendSPerLap: 0.15,
      lapsToCatch: 4,
      catchesBeforeEnd: true,
      lastLaps: [98.601],
      sectorDeltas: [0.12, -0.05, 0.08],
      iRatingAtStake: 18
    })
    const v = toLaneView(
      op,
      'ahead',
      { lapsRemaining: 19, playerLastLaps: [98.452] },
      OPTS,
      styles,
      ES
    )
    expect(v).toMatchObject({
      side: 'ahead',
      carIdx: 5,
      tag: 'DELANTE',
      tagIcon: 'arrow-up',
      inPits: false,
      gap: { value: '0.8', unit: 's' },
      tone: 'good',
      stake: '±18',
      lastLap: false,
      laps: null
    })
    expect(v.driver).toMatchObject({
      number: '23',
      name: 'A. López',
      iRating: '2.1k',
      lic: 'B 3.4'
    })
    expect(v.catch?.text).toBe(`Le alcanzas en ~4${NB}v`)
    expect(v.sectors?.map((c) => c.label)).toEqual(['S1', 'S2', 'S3', 'Últ'])
    expect(v.sectors?.at(-1)?.text).toBe('+0.15')
  })

  it('follows the options', () => {
    const op = opponent({ lapsToCatch: 4, iRatingAtStake: 18, lastLaps: [90, 91, 92] })
    const d = { lapsRemaining: 19, playerLastLaps: [90.5, 90.5, 90.5] }
    const none = toLaneView(
      op,
      'behind',
      d,
      { ...OPTS, detail: 'none', showPrediction: false, showStake: false },
      styles,
      ES
    )
    expect(none).toMatchObject({ catch: null, stake: null, sectors: null, laps: null })
    const both = toLaneView(op, 'behind', d, { ...OPTS, detail: 'both' }, styles, ES)
    // 'both': the laps row has V-1, so the sectors row has no Últ.
    expect(both.sectors?.map((c) => c.label)).toEqual(['Sectores'])
    expect(both.laps?.map((c) => c.text)).toEqual([`${M}0.50`, '+0.50', '+1.50'])
    expect(toLaneView(op, 'ahead', d, { ...OPTS, nameFormat: 'tv' }, styles, ES).driver.name).toBe(
      'LOP'
    )
  })

  it('opponent in the pits: dim bar, no prediction', () => {
    const v = toLaneView(
      opponent({ inPits: true, lapsToCatch: 3 }),
      'ahead',
      { lapsRemaining: 9, playerLastLaps: [] },
      OPTS,
      styles,
      ES
    )
    expect(v).toMatchObject({ inPits: true, tone: 'dim', catch: null })
  })

  it('last lap replaces the prediction (only where the row is shown)', () => {
    const op = opponent({ lapsToCatch: 3 })
    const d = { lapsRemaining: 1, playerLastLaps: [] }
    expect(toLaneView(op, 'ahead', d, OPTS, styles, ES)).toMatchObject({
      lastLap: true,
      catch: null
    })
    expect(toLaneView(op, 'ahead', d, { ...OPTS, showPrediction: false }, styles, ES).lastLap).toBe(
      false
    )
  })

  it('falls back on unknown colours and empty fields', () => {
    const v = toLaneView(
      opponent({
        carNumber: '',
        classColor: 'bad',
        licColor: null,
        iRating: null,
        licString: null
      }),
      'behind',
      { lapsRemaining: null, playerLastLaps: [] },
      OPTS,
      styles,
      ES
    )
    expect(v.tag).toBe('DETRÁS')
    expect(v.driver).toMatchObject({ number: '', iRating: '', lic: '' })
    expect(v.driver.clsStyle['--cls']).toBe('#ffffff')
  })

  it('equal inputs give equal views sharing their style objects', () => {
    const a = toLaneView(opponent(), 'ahead', battle(), OPTS, styles, ES)
    const b = toLaneView(opponent(), 'ahead', battle(), OPTS, styles, ES)
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
    expect(a.driver.clsStyle).toBe(b.driver.clsStyle)
  })
})

describe('toLaneViews / hasOpponents', () => {
  const styles = createDriverStyles()

  it('ahead first, only the opponents present', () => {
    const both = toLaneViews(battle({ ahead: opponent(), behind: opponent() }), OPTS, styles, ES)
    expect(both.map((l) => l.side)).toEqual(['ahead', 'behind'])
    expect(
      toLaneViews(battle({ behind: opponent() }), OPTS, styles, ES).map((l) => l.side)
    ).toEqual(['behind'])
    expect(toLaneViews(battle(), OPTS, styles, ES)).toEqual([])
  })

  it('a payload is drawn only when visible with an opponent', () => {
    expect(hasOpponents(battle({ ahead: opponent() }))).toBe(true)
    expect(hasOpponents(battle({ visible: false, ahead: opponent() }))).toBe(false)
    expect(hasOpponents(battle())).toBe(false)
  })
})

describe('English', () => {
  const styles = createDriverStyles()

  it('says the trend and the tags in English', () => {
    expect(trendView(0.15, 'ahead', EN)).toMatchObject({
      text: `+0.15${NB}s/lap`,
      note: 'closing in'
    })
    expect(trendView(-0.12, 'ahead', EN).note).toBe('losing ground')
    expect(trendView(0.1, 'behind', EN).note).toBe('pulling away')
    expect(trendView(-0.2, 'behind', EN).note).toBe('catching you')
    expect(trendView(0.004, 'ahead', EN)).toMatchObject({
      text: `=${NB}0.00${NB}s/lap`,
      note: 'steady'
    })
    expect(trendView(null, 'ahead', EN).note).toBe('measuring…')
    const v = toLaneView(opponent(), 'behind', battle(), OPTS, styles, EN)
    expect(v.tag).toBe('BEHIND')
    expect(toLaneView(opponent(), 'ahead', battle(), OPTS, styles, EN).tag).toBe('AHEAD')
  })

  it('says the prediction in English, with laps as L', () => {
    expect(
      catchView(opponent({ lapsToCatch: 4.2, catchesBeforeEnd: true }), 'ahead', 19, EN)
    ).toMatchObject({
      text: `Catching in ~4${NB}L`,
      note: `of${NB}19`
    })
    expect(
      catchView(
        opponent({ lapsToCatch: 12, catchesBeforeEnd: false, neededSPerLap: 0.24 }),
        'ahead',
        5,
        EN
      )
    ).toMatchObject({ text: `Need +0.24${NB}s/lap`, note: `at this pace ~12${NB}L of${NB}5` })
    expect(
      catchView(opponent({ lapsToCatch: 12, catchesBeforeEnd: false }), 'ahead', 5, EN)?.text
    ).toBe('Out of reach')
    expect(
      catchView(opponent({ lapsToCatch: 11.6, catchesBeforeEnd: true }), 'behind', 19, EN)?.text
    ).toBe(`Catches you in ~12${NB}L`)
    expect(
      catchView(opponent({ lapsToCatch: 9, catchesBeforeEnd: false }), 'behind', 4, EN)?.text
    ).toBe('Safe to the flag')
  })

  it('labels the chips in English', () => {
    expect(lapChips([98.452], [98.601], EN).map((c) => c.label)).toEqual(['L-1', 'L-2', 'L-3'])
    expect(sectorChips(null, 0.17, EN).map((c) => c.label)).toEqual(['Sectors', 'Last'])
    expect(sectorChips([0.1, 0.2], undefined, EN).map((c) => c.label)).toEqual(['S1', 'S2'])
  })
})

describe('preview', () => {
  const styles = createDriverStyles()

  it('fills every row of both lanes', () => {
    const lanes = toLaneViews(PREVIEW_BATTLE, { ...OPTS, detail: 'both' }, styles, ES)
    expect(lanes).toHaveLength(2)
    for (const l of lanes) {
      expect(l.catch).not.toBeNull()
      expect(l.stake).not.toBeNull()
      expect(l.sectors?.every((c) => c.text !== '—')).toBe(true)
      expect(l.laps?.every((c) => c.text !== '—')).toBe(true)
      expect(l.trend.tone).not.toBe('dim')
    }
  })

  it('follows the side options; both when both are off', () => {
    expect(previewBattle(true, false).behind).toBeNull()
    expect(previewBattle(false, true).ahead).toBeNull()
    expect(previewBattle(false, false)).toBe(PREVIEW_BATTLE)
    expect(previewBattle(true, true)).toBe(PREVIEW_BATTLE)
    expect(Object.isFrozen(PREVIEW_BATTLE)).toBe(true)
  })
})
