import { describe, expect, it } from 'vitest'
import { elementOrder, isElementVisible, visibleIds } from '@shared/elements'
import { MINUS, formatGap } from '@shared/format'
import { messagesFor } from '@shared/i18n'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import type { BattleData, BattleOpponent, BattlePredictionId } from '@shared/types'
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
  LANE_ORDER,
  laneParts,
  laneRows,
  predictionParts,
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
    brand: 'porsche',
    country: 'ES',
    gapS: 0.8,
    relativeGapS: null,
    trendSPerLap: 0.1,
    lapsToCatch: null,
    catchesBeforeEnd: null,
    neededSPerLap: null,
    lastLaps: [],
    sectorDeltas: null,
    iRatingAtStake: null,
    penalty: null,
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
    multiBrand: false,
    info: null,
    ...over
  }
}

const ALL_PARTS = { rating: true, license: true, trendNote: true, stake: true } as const

// The defaults: prediction and sectors, every part, no make or flag.
const OPTS: LaneOptions = {
  rows: ['prediction', 'sectors'],
  parts: ALL_PARTS,
  brand: false,
  flag: false,
  penalties: true,
  nameFormat: 'abbr'
}

describe('rows and arrangement', () => {
  it('rows follow the options only, in their order', () => {
    expect(laneRows([])).toEqual({ order: [], catch: false, sectors: false, laps: false })
    expect(laneRows(['prediction', 'sectors'])).toEqual({
      order: ['prediction', 'sectors'],
      catch: true,
      sectors: true,
      laps: false
    })
    expect(laneRows(['laps'])).toMatchObject({ catch: false, sectors: false, laps: true })
    expect(laneRows(['laps', 'sectors', 'prediction'])).toEqual({
      order: ['laps', 'sectors', 'prediction'],
      catch: true,
      sectors: true,
      laps: true
    })
    // A repeated id (a hand-built list) is drawn once.
    expect(laneRows(['sectors', 'sectors']).order).toEqual(['sectors'])
  })

  it("the defaults draw today's lanes", () => {
    const S = OPTION_SCHEMA.battle
    expect(visibleIds(S.rows.default)).toEqual(OPTS.rows)
    expect(elementOrder(S.lanes.default)).toEqual(LANE_ORDER)
    expect(laneParts((id) => isElementVisible(S.parts.default, id))).toEqual(ALL_PARTS)
  })

  it('reads every part as a flag', () => {
    expect(laneParts(() => true)).toEqual(ALL_PARTS)
    expect(laneParts((id) => id === 'stake')).toEqual({
      rating: false,
      license: false,
      trendNote: false,
      stake: true
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

  it('as Relativo: its signed time, exactly as its gap column (formatGap, no unit)', () => {
    expect(gapView(0.64, true)).toEqual({ value: '0.6', unit: '' })
    expect(gapView(-1.2, true)).toEqual({ value: `${M}1.2`, unit: '' })
    expect(gapView(-0.04, true)).toEqual({ value: '0.0', unit: '' })
    expect(gapView(-65, true)).toEqual({ value: `${M}1:05`, unit: '' })
    expect(gapView(null, true)).toEqual({ value: '—', unit: '' })
    // The very string of Relativo's gap column.
    expect(gapView(-2.04, true).value).toBe(formatGap(-2.04))
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
      kind: 'catchIn',
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
      kind: 'need',
      icon: 'minus',
      text: `Necesitas +0.24${NB}s/v`,
      note: `a este ritmo ~12${NB}v de${NB}5`,
      tone: 'bad'
    })
    expect(
      catchView(opponent({ lapsToCatch: 12, catchesBeforeEnd: false }), 'ahead', 5, ES)
    ).toEqual({
      kind: 'noCatch',
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
      kind: 'need',
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
    ).toEqual({
      kind: 'caughtIn',
      icon: 'alert',
      text: `Te alcanza en ~12${NB}v`,
      note: `de${NB}19`,
      tone: 'bad'
    })
    expect(
      catchView(opponent({ lapsToCatch: 9, catchesBeforeEnd: false }), 'behind', 4, ES)
    ).toEqual({
      kind: 'noCatch',
      icon: 'check',
      text: 'No te alcanza',
      note: `~9${NB}v de${NB}4`,
      tone: 'good'
    })
    // neededSPerLap is an ahead-only field; not closing behind says nothing.
    expect(catchView(opponent({ neededSPerLap: 0.3 }), 'behind', 4, ES)).toBeNull()
  })

  it('says only what battle.prediction shows: a hidden saying leaves the row blank (2.4)', () => {
    const only = (id: BattlePredictionId): Record<BattlePredictionId, boolean> =>
      predictionParts((x) => x === id)
    const catching = opponent({ lapsToCatch: 4.2, catchesBeforeEnd: true })
    expect(catchView(catching, 'ahead', 19, ES, only('catchIn'))?.kind).toBe('catchIn')
    expect(catchView(catching, 'ahead', 19, ES, only('caughtIn'))).toBeNull()
    const caught = opponent({ lapsToCatch: 11.6, catchesBeforeEnd: true })
    expect(catchView(caught, 'behind', 19, ES, only('caughtIn'))?.kind).toBe('caughtIn')
    expect(catchView(caught, 'behind', 19, ES, only('catchIn'))).toBeNull()
    const slow = opponent({ lapsToCatch: 12, catchesBeforeEnd: false, neededSPerLap: 0.24 })
    expect(catchView(slow, 'ahead', 5, ES, only('need'))?.kind).toBe('need')
    expect(catchView(slow, 'ahead', 5, ES, only('noCatch'))).toBeNull()
    const safe = opponent({ lapsToCatch: 9, catchesBeforeEnd: false })
    expect(catchView(safe, 'behind', 4, ES, only('noCatch'))?.text).toBe('No te alcanza')
    // The lane keeps the row (blank): what decides its height is battle.rows.
    const lane = toLaneView(
      catching,
      'ahead',
      { lapsRemaining: 19, playerLastLaps: [] },
      { ...OPTS, prediction: only('need') },
      createDriverStyles(),
      ES
    )
    expect(lane.catch).toBeNull()
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

  it('draws the big gap as chosen: measured and unsigned, or as Relativo (2.4)', () => {
    const op = opponent({ gapS: 0.8, relativeGapS: -0.9 })
    const d = { lapsRemaining: 19, playerLastLaps: [] }
    expect(toLaneView(op, 'behind', d, OPTS, styles, ES).gap).toEqual({ value: '0.8', unit: 's' })
    const rel = toLaneView(op, 'behind', d, { ...OPTS, gapStyle: 'relative' }, styles, ES)
    expect(rel.gap).toEqual({ value: `${M}0.9`, unit: '' })
    // Relativo has no time for it (no estimate for one of the cars): the measured gap with the
    // lane's sign, in the same format, rather than a dash.
    const none = opponent({ gapS: 1.24, relativeGapS: null })
    const rel2 = { ...OPTS, gapStyle: 'relative' as const }
    expect(toLaneView(none, 'ahead', d, rel2, styles, ES).gap).toEqual({ value: '1.2', unit: '' })
    expect(toLaneView(none, 'behind', d, rel2, styles, ES).gap).toEqual({
      value: `${M}1.2`,
      unit: ''
    })
    // Neither known: the dash.
    const neither = opponent({ gapS: Number.NaN, relativeGapS: null })
    expect(toLaneView(neither, 'ahead', d, rel2, styles, ES).gap.value).toBe('—')
  })

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
      { ...OPTS, rows: [], parts: { ...ALL_PARTS, stake: false } },
      styles,
      ES
    )
    expect(none).toMatchObject({ catch: null, stake: null, sectors: null, laps: null })
    const both = toLaneView(
      op,
      'behind',
      d,
      { ...OPTS, rows: ['laps', 'prediction', 'sectors'] },
      styles,
      ES
    )
    // Both chip rows: the laps row has V-1, so the sectors row has no Últ.
    expect(both.sectors?.map((c) => c.label)).toEqual(['Sectores'])
    expect(both.laps?.map((c) => c.text)).toEqual([`${M}0.50`, '+0.50', '+1.50'])
    expect(toLaneView(op, 'ahead', d, { ...OPTS, nameFormat: 'tv' }, styles, ES).driver.name).toBe(
      'LOP'
    )
  })

  it('the parts: rating, licence and trend words on the rival as asked', () => {
    const d = { lapsRemaining: 19, playerLastLaps: [] }
    const op = opponent({ trendSPerLap: 0.15 })
    expect(toLaneView(op, 'ahead', d, OPTS, styles, ES)).toMatchObject({
      driver: { withRating: true, withLicense: true },
      trend: { note: 'le recortas' }
    })
    const bare = toLaneView(
      op,
      'ahead',
      d,
      { ...OPTS, parts: { rating: false, license: false, trendNote: false, stake: true } },
      styles,
      ES
    )
    expect(bare.driver).toMatchObject({ withRating: false, withLicense: false })
    // Without its words the trend keeps its chevron, number and tone.
    expect(bare.trend).toEqual({ icon: 'arrow-up', text: `+0.15${NB}s/v`, note: '', tone: 'good' })
  })

  it('the make and the flag only when on and known', () => {
    const d = { lapsRemaining: 19, playerLastLaps: [] }
    const off = toLaneView(opponent(), 'ahead', d, OPTS, styles, ES).driver
    expect('brand' in off || 'country' in off).toBe(false)
    const on = { ...OPTS, brand: true, flag: true }
    expect(toLaneView(opponent(), 'ahead', d, on, styles, ES).driver).toMatchObject({
      brand: 'porsche',
      country: 'ES'
    })
    const unknown = toLaneView(
      opponent({ brand: 'unknown', country: '' }),
      'ahead',
      d,
      on,
      styles,
      ES
    )
    expect('brand' in unknown.driver || 'country' in unknown.driver).toBe(false)
    expect(
      toLaneView(opponent(), 'ahead', d, { ...OPTS, flag: true }, styles, ES).driver
    ).not.toHaveProperty('brand')
  })

  it("names an opponent iRacing wrote as '?' by car number, dim", () => {
    const d = { lapsRemaining: 19, playerLastLaps: [] }
    const op = opponent({ driverName: '' })
    expect(toLaneView(op, 'ahead', d, OPTS, styles, ES).driver).toMatchObject({
      name: 'Piloto #23',
      nameUnknown: true
    })
    expect(toLaneView(op, 'ahead', d, OPTS, styles, EN).driver.name).toBe('Driver #23')
    const team = opponent({ driverName: '', teamName: 'Équipe Rouge' })
    expect(toLaneView(team, 'behind', d, OPTS, styles, ES).driver.name).toBe('Équipe Rouge')
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
    expect(toLaneView(op, 'ahead', d, { ...OPTS, rows: ['sectors'] }, styles, ES).lastLap).toBe(
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

  it('in battle.lanes order; a side the order misses goes last', () => {
    const d = battle({ ahead: opponent(), behind: opponent({ carIdx: 9 }) })
    const sides = (order: readonly ('ahead' | 'behind')[]): string[] =>
      toLaneViews(d, OPTS, styles, ES, order).map((l) => l.side)
    expect(sides(LANE_ORDER)).toEqual(['ahead', 'behind'])
    expect(sides(['behind', 'ahead'])).toEqual(['behind', 'ahead'])
    expect(sides(['behind'])).toEqual(['behind', 'ahead'])
    expect(sides(['behind', 'behind'])).toEqual(['behind', 'ahead'])
    expect(
      toLaneViews(battle({ ahead: opponent() }), OPTS, styles, ES, ['behind', 'ahead']).map(
        (l) => l.side
      )
    ).toEqual(['ahead'])
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

  it('says the prediction in English, with laps as laps, never L (litres)', () => {
    expect(
      catchView(opponent({ lapsToCatch: 4.2, catchesBeforeEnd: true }), 'ahead', 19, EN)
    ).toMatchObject({
      text: `Catching in ~4${NB}laps`,
      note: `of${NB}19`
    })
    expect(
      catchView(
        opponent({ lapsToCatch: 12, catchesBeforeEnd: false, neededSPerLap: 0.24 }),
        'ahead',
        5,
        EN
      )
    ).toMatchObject({ text: `Need +0.24${NB}s/lap`, note: `at this pace ~12${NB}laps of${NB}5` })
    expect(
      catchView(opponent({ lapsToCatch: 12, catchesBeforeEnd: false }), 'ahead', 5, EN)?.text
    ).toBe('Out of reach')
    expect(
      catchView(opponent({ lapsToCatch: 11.6, catchesBeforeEnd: true }), 'behind', 19, EN)?.text
    ).toBe(`Catches you in ~12${NB}laps`)
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
    const lanes = toLaneViews(
      PREVIEW_BATTLE,
      { ...OPTS, rows: ['prediction', 'sectors', 'laps'], brand: true, flag: true },
      styles,
      ES
    )
    expect(lanes).toHaveLength(2)
    for (const l of lanes) {
      expect(l.catch).not.toBeNull()
      expect(l.stake).not.toBeNull()
      expect(l.sectors?.every((c) => c.text !== '—')).toBe(true)
      expect(l.laps?.every((c) => c.text !== '—')).toBe(true)
      expect(l.trend.tone).not.toBe('dim')
      // Two makes and two flags, so the sample shows both extras when they are on.
      expect(l.driver.brand).toBeDefined()
      expect(l.driver.country).toBeDefined()
    }
    expect(PREVIEW_BATTLE.multiBrand).toBe(true)
  })

  it('follows the side options; both when both are off', () => {
    expect(previewBattle(true, false).behind).toBeNull()
    expect(previewBattle(false, true).ahead).toBeNull()
    expect(previewBattle(false, false)).toBe(PREVIEW_BATTLE)
    expect(previewBattle(true, true)).toBe(PREVIEW_BATTLE)
    expect(Object.isFrozen(PREVIEW_BATTLE)).toBe(true)
  })
})

describe('the rival’s iRating (request 10)', () => {
  const styles = createDriverStyles()
  const d = { lapsRemaining: 19, playerLastLaps: [] }

  it('in the chosen format, and in its licence colours only when asked', () => {
    const op = opponent({ iRating: 2520 })
    const today = toLaneView(op, 'ahead', d, OPTS, styles, ES).driver
    expect(today).toMatchObject({ iRating: '2.5k', ratingColors: null })
    const full = toLaneView(op, 'ahead', d, { ...OPTS, irFormat: 'full' }, styles, ES).driver
    expect(full.iRating).toBe('2.520')
    const lit = toLaneView(op, 'ahead', d, { ...OPTS, irColor: true }, styles, ES).driver
    expect(lit.ratingColors).toBe(lit.licStyle)
  })
})
