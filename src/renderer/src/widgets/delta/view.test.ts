import { describe, expect, it } from 'vitest'
import { MINUS } from '@shared/format'
import { messagesFor } from '@shared/i18n'
import type { DeltaData, DeltaReference } from '@shared/types'
import {
  BAR_STEPS,
  TREND_OFF,
  TREND_ON,
  barOverflow,
  barStep,
  createBarStyles,
  currentSector,
  deltaSign,
  deltaTone,
  fillTransform,
  formatDelta,
  lapCounts,
  liveSectorDelta,
  predictedText,
  refView,
  sectorChips,
  sectorDensity,
  stateView,
  stateViews,
  tipTransform,
  trendKind,
  type SectorChipView
} from './view'

const M = MINUS
const ES = messagesFor('es')
const EN = messagesFor('en')
const STATE_VIEWS = stateViews(ES)

describe('formatDelta', () => {
  it('signs every value, with a typographic minus', () => {
    expect(formatDelta(-0.24)).toBe(`${M}0.24`)
    expect(formatDelta(0.31)).toBe('+0.31')
    expect(formatDelta(-9.994)).toBe(`${M}9.99`)
  })

  it('reads zero as 0.00, whatever the sign before rounding', () => {
    expect(formatDelta(0)).toBe('0.00')
    expect(formatDelta(-0.004)).toBe('0.00')
    expect(formatDelta(0.004)).toBe('0.00')
  })

  it('keeps five characters at most for big deltas', () => {
    expect(formatDelta(9.996)).toBe('+10.0')
    expect(formatDelta(-12.46)).toBe(`${M}12.5`)
    expect(formatDelta(59.94)).toBe('+59.9')
    expect(formatDelta(59.96)).toBe('+1:00')
    expect(formatDelta(-65.4)).toBe(`${M}1:05`)
    for (const v of [-0.01, 3.21, -9.99, 10, -59.9, 61, -599]) {
      expect(formatDelta(v).length).toBeLessThanOrEqual(5)
    }
  })

  it('shows a dash when unknown', () => {
    expect(formatDelta(null)).toBe('—')
    expect(formatDelta(undefined)).toBe('—')
    expect(formatDelta(Number.NaN)).toBe('—')
    expect(formatDelta(Number.POSITIVE_INFINITY)).toBe('—')
  })
})

describe('sign and tone', () => {
  it('negative is faster (good), positive slower (bad), at the shown precision', () => {
    expect(deltaSign(-0.24)).toBe(-1)
    expect(deltaSign(0.01)).toBe(1)
    expect(deltaSign(0.004)).toBe(0)
    expect(deltaSign(null)).toBeNull()
    expect(deltaTone(-0.24)).toBe('good')
    expect(deltaTone(0.3)).toBe('bad')
    expect(deltaTone(-0.001)).toBe('neutral')
    expect(deltaTone(null)).toBe('dim')
    expect(deltaTone(Number.NaN)).toBe('dim')
  })
})

describe('bar', () => {
  it('scales the delta to the range, faster to the left', () => {
    expect(barStep(-0.5, 1)).toBe(-BAR_STEPS / 2)
    expect(barStep(0.25, 1)).toBe(BAR_STEPS / 4)
    expect(barStep(0.3, 3)).toBe(20)
    expect(barStep(0, 1)).toBe(0)
  })

  it('clamps beyond the range and flags the overflow', () => {
    expect(barStep(-4, 1)).toBe(-BAR_STEPS)
    expect(barStep(2.5, 2)).toBe(BAR_STEPS)
    expect(barOverflow(-4, 1)).toBe(-1)
    expect(barOverflow(2.5, 2)).toBe(1)
    expect(barOverflow(0.5, 1)).toBe(0)
    // At the shown precision: 1.004 reads as the scale itself, not beyond it.
    expect(barOverflow(1.004, 1)).toBe(0)
    expect(barOverflow(1.01, 1)).toBe(1)
    expect(barStep(1.004, 1)).toBe(BAR_STEPS)
  })

  it('is empty when the delta or the range is unusable', () => {
    for (const range of [0, -1, Number.NaN]) {
      expect(barStep(0.5, range)).toBe(0)
      expect(barOverflow(5, range)).toBe(0)
    }
    expect(barStep(null, 1)).toBe(0)
    expect(barStep(Number.NaN, 1)).toBe(0)
    expect(barOverflow(undefined, 1)).toBe(0)
    expect(Object.is(barStep(-0.0001, 1), -0)).toBe(false)
  })

  it('quantises to whole steps (about a pixel)', () => {
    const steps = new Set<number>()
    for (let d = -1.5; d <= 1.5; d += 0.0007) steps.add(barStep(d, 1))
    expect(Math.max(...steps)).toBe(BAR_STEPS)
    expect(Math.min(...steps)).toBe(-BAR_STEPS)
    for (const s of steps) expect(Number.isInteger(s)).toBe(true)
  })

  it('writes the fill and needle transforms', () => {
    expect(fillTransform(-50)).toBe('scaleX(-0.25)')
    expect(fillTransform(BAR_STEPS)).toBe('scaleX(1)')
    expect(fillTransform(0)).toBe('scaleX(0)')
    expect(tipTransform(-BAR_STEPS)).toBe('translateX(-50%)')
    expect(tipTransform(BAR_STEPS / 2)).toBe('translateX(25%)')
    expect(tipTransform(0)).toBe('translateX(0%)')
  })

  it('shares one frozen style pair per step, bounded by the step count', () => {
    const styles = createBarStyles()
    const a = styles(-48)
    expect(styles(-48)).toBe(a)
    expect(a.fill).toEqual({ transform: 'scaleX(-0.24)' })
    expect(a.tip).toEqual({ transform: 'translateX(-12%)' })
    expect(Object.isFrozen(a) && Object.isFrozen(a.fill) && Object.isFrozen(a.tip)).toBe(true)
    // Out-of-range or odd steps fold onto the real ones.
    expect(styles(BAR_STEPS + 50)).toBe(styles(BAR_STEPS))
    expect(styles(Number.NaN)).toBe(styles(0))
    const seen = new Set<object>()
    for (let s = -3 * BAR_STEPS; s <= 3 * BAR_STEPS; s++) seen.add(styles(s))
    expect(seen.size).toBe(2 * BAR_STEPS + 1)
  })
})

describe('trend', () => {
  it('needs a clear trend to start a caption', () => {
    expect(trendKind(-TREND_ON)).toBe('gain')
    expect(trendKind(TREND_ON + 0.01)).toBe('loss')
    expect(trendKind(-TREND_OFF)).toBe('steady')
    expect(trendKind(0)).toBe('steady')
    expect(trendKind(Number.NaN, 'gain')).toBe('steady')
  })

  it('keeps it until the trend is steady again (no flicker at the edge)', () => {
    expect(trendKind(-TREND_OFF, 'gain')).toBe('gain')
    expect(trendKind(TREND_OFF, 'loss')).toBe('loss')
    expect(trendKind(0, 'gain')).toBe('steady')
    // A sign change inside the band is steady, never the opposite caption.
    expect(trendKind(TREND_OFF, 'gain')).toBe('steady')
    expect(trendKind(-TREND_ON, 'loss')).toBe('gain')
  })

  it('an invalid lap says so first; the trend only when shown', () => {
    expect(stateView('invalid', 'gain', true, ES)).toBe(STATE_VIEWS.invalid)
    expect(stateView('invalid', 'steady', false, ES).text).toBe('vuelta inválida')
    expect(stateView('valid', 'gain', true, ES)).toBe(STATE_VIEWS.gain)
    expect(stateView('valid', 'loss', true, ES)).toEqual({
      kind: 'loss',
      text: 'perdiendo',
      tone: 'bad',
      icon: null
    })
    expect(stateView('valid', 'gain', false, ES)).toBe(STATE_VIEWS.none)
    expect(stateView('valid', 'steady', true, ES)).toBe(STATE_VIEWS.none)
    expect(STATE_VIEWS.gain.tone).toBe('good')
    expect(STATE_VIEWS.invalid.icon).toBe('warning')
  })

  it('without a lap says nothing; the out lap and the tow say what they are (B15)', () => {
    // Online: 'INVALID LAP' all the out lap from the pits, on the grid and the tow (145 s).
    expect(stateView('none', 'gain', true, ES)).toBe(STATE_VIEWS.none)
    expect(stateView('out', 'gain', true, ES)).toMatchObject({
      kind: 'out',
      text: 'vuelta de salida',
      tone: 'info',
      icon: 'out'
    })
    expect(stateView('tow', 'steady', false, ES)).toMatchObject({
      kind: 'tow',
      text: 'grúa',
      icon: 'clock'
    })
    expect(stateView('out', 'gain', true, EN).text).toBe('out lap')
    expect(stateView('tow', 'gain', true, EN).text).toBe('tow')
    // An unknown state (the payload crosses IPC) reads as a lap that counts.
    expect(stateView(undefined, 'gain', true, ES)).toBe(STATE_VIEWS.gain)
    // Only these step the numbers back.
    expect(lapCounts('valid')).toBe(true)
    expect(lapCounts('none')).toBe(true)
    expect(lapCounts(undefined)).toBe(true)
    expect(lapCounts('invalid')).toBe(false)
    expect(lapCounts('out')).toBe(false)
    expect(lapCounts('tow')).toBe(false)
  })

  it('says the state in English, one frozen set per language', () => {
    expect(stateView('valid', 'gain', true, EN)).toMatchObject({ kind: 'gain', text: 'gaining' })
    expect(stateView('valid', 'loss', true, EN).text).toBe('losing')
    expect(stateView('invalid', 'gain', true, EN).text).toBe('invalid lap')
    expect(stateView('valid', 'gain', true, EN)).toBe(stateViews(EN).gain)
    expect(stateViews(EN)).not.toBe(STATE_VIEWS)
    expect(Object.isFrozen(stateViews(EN).loss)).toBe(true)
  })
})

describe('reference and predicted lap', () => {
  type RefInput = Pick<DeltaData, 'reference' | 'refDriver' | 'refSelf' | 'refLapTime'>
  const ref = (
    reference: DeltaReference,
    refDriver = '',
    refSelf = false,
    refLapTime: number | null = 135.671
  ): RefInput => ({ reference, refDriver, refSelf, refLapTime })

  it('names each reference, with the lap time', () => {
    expect(refView(ref('pb'), ES)).toEqual({
      kind: 'pb',
      label: 'Récord personal',
      time: '2:15.671'
    })
    expect(refView(ref('session'), ES).label).toBe('Mejor vuelta')
    expect(refView(ref('class', '#44 J. Lindqvist'), ES)).toEqual({
      kind: 'class',
      label: '#44 J. Lindqvist',
      time: '2:15.671'
    })
    expect(refView(ref('class', '', true), ES).label).toBe('Tú')
    expect(refView(ref('class', '  '), ES).label).toBe('Vuelta rápida de clase')
    // The optimal laps are nobody's: named by kind, whatever the payload says of a driver.
    expect(refView(ref('optimal'), ES)).toEqual({
      kind: 'optimal',
      label: 'Vuelta óptima',
      time: '2:15.671'
    })
    expect(refView(ref('classOptimal'), ES).label).toBe('Óptima de la clase')
    expect(refView(ref('classOptimal', '#44 J. Lindqvist', true), ES).label).toBe(
      'Óptima de la clase'
    )
  })

  it('names them in English; driver names stay as they are', () => {
    expect(refView(ref('pb'), EN).label).toBe('Personal best')
    expect(refView(ref('session'), EN).label).toBe('Session best')
    expect(refView(ref('optimal'), EN).label).toBe('Optimal lap')
    expect(refView(ref('class', '', true), EN).label).toBe('You')
    expect(refView(ref('class'), EN).label).toBe('Class fastest lap')
    expect(refView(ref('class', '#44 J. Lindqvist'), EN).label).toBe('#44 J. Lindqvist')
    expect(refView(ref('classOptimal'), EN).label).toBe('Class optimal')
  })

  it("words the number alone (a name iRacing wrote as '?') as 'Piloto #44'", () => {
    expect(refView(ref('class', '#44'), ES).label).toBe('Piloto #44')
    expect(refView(ref('class', ' #44 '), EN).label).toBe('Driver #44')
    expect(refView(ref('class', '#44 Équipe Rouge'), ES).label).toBe('#44 Équipe Rouge')
  })

  it('falls back to your record and a dash', () => {
    expect(refView(ref('pb', '#44 J. Lindqvist', true, null), ES)).toEqual({
      kind: 'pb',
      label: 'Récord personal',
      time: '—'
    })
    const odd = refView(
      {
        reference: 'nope' as never,
        refDriver: undefined as never,
        refSelf: undefined as never,
        refLapTime: Number.NaN
      },
      ES
    )
    expect(odd).toEqual({ kind: 'pb', label: 'Récord personal', time: '—' })
  })

  it('formats the predicted lap', () => {
    expect(predictedText(135.849)).toBe('2:15.849')
    expect(predictedText(58.2)).toBe('58.200')
    expect(predictedText(null)).toBe('—')
    expect(predictedText(Number.NaN)).toBe('—')
  })
})

describe('sectors', () => {
  it('finds the sector in progress', () => {
    // Nothing completed: the position is not certain (and S1 would repeat the hero).
    expect(currentSector([null, null, null], true)).toBe(-1)
    expect(currentSector([-0.1, null, null], true)).toBe(1)
    expect(currentSector([-0.1, 0.2, null], true)).toBe(2)
    expect(currentSector([-0.1, 0.2, 0.3], true)).toBe(-1)
    // Unknown position on the lap: none.
    expect(currentSector([-0.1, null, null], false)).toBe(-1)
    expect(currentSector([], true)).toBe(-1)
  })

  it('takes the completed sectors off the running delta', () => {
    expect(liveSectorDelta([-0.12, 0.05, null], -0.24, 2)).toBe(-0.17)
    expect(liveSectorDelta([null, null, null], 0.3, 0)).toBe(0.3)
    expect(liveSectorDelta([0.1, null], 0.1, 1)).toBe(0)
    // An unknown earlier sector makes the live value unknown.
    expect(liveSectorDelta([null, -0.1, null], -0.3, 2)).toBeNull()
    expect(liveSectorDelta([-0.1, null], null, 1)).toBeNull()
    expect(liveSectorDelta([-0.1, null], 0.1, 5)).toBeNull()
    expect(liveSectorDelta([-0.1, null], 0.1, -1)).toBeNull()
  })

  it('labels, values and tones every chip', () => {
    const chips = sectorChips([-0.12, 0.05, null, null], true, ES)
    expect(chips).toEqual([
      { label: 'S1', text: `${M}0.12`, tone: 'good', state: 'done' },
      { label: 'S2', text: '+0.05', tone: 'bad', state: 'done' },
      { label: 'S3', text: '', tone: 'dim', state: 'current' },
      { label: 'S4', text: '', tone: 'dim', state: 'ahead' }
    ])
    expect(sectorChips([0.004], true, ES)[0]).toMatchObject({ text: '0.00', tone: 'neutral' })
    // Without a delta the position on the lap is unknown: nothing is marked as in progress.
    expect(sectorChips([-0.1, null], false, ES).map((c) => c.state)).toEqual(['done', 'ahead'])
  })

  it('keeps one placeholder while the sectors are unknown', () => {
    const a = sectorChips([], true, ES)
    expect(a).toEqual([{ label: 'Sectores', text: '—', tone: 'dim', state: 'ahead' }])
    expect(sectorChips(null, true, ES)).toBe(a)
    expect(sectorChips(undefined, false, ES, a)).toBe(a)
    const en = sectorChips([], true, EN)
    expect(en[0]?.label).toBe('Sectors')
    expect(sectorChips(null, false, EN, a)).toBe(en)
  })

  it('reuses unchanged chips and an unchanged row', () => {
    const a = sectorChips([-0.12, null, null], true, ES)
    const same = sectorChips([-0.12, null, null], true, ES, a)
    expect(same).toBe(a)
    const b = sectorChips([-0.12, 0.05, null], true, ES, a)
    expect(b).not.toBe(a)
    expect(b[0]).toBe(a[0])
    expect(b[1]).not.toBe(a[1])
    expect(b[2]).not.toBe(a[2])
    // A new lap: every chip goes back to waiting (S1 is not marked, see currentSector).
    const lap = sectorChips([null, null, null], true, ES, b)
    expect(lap.map((c: SectorChipView) => c.state)).toEqual(['ahead', 'ahead', 'ahead'])
  })

  it('drops the labels first when crowded', () => {
    expect(sectorDensity(1)).toBe('normal')
    expect(sectorDensity(4)).toBe('normal')
    expect(sectorDensity(5)).toBe('compact')
    expect(sectorDensity(7)).toBe('compact')
    expect(sectorDensity(12)).toBe('tight')
  })
})
