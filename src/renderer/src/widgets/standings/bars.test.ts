import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/settings'
import type { InfoBarData, StandingsClassBlock } from '@shared/types'
import { PREVIEW_INFO } from '@renderer/view/infoBar'
import { barInfo } from './bars'
import { block } from './testing/rows'

const LINE = DEFAULT_SETTINGS.standings.classLine
const INFO: InfoBarData = { ...PREVIEW_INFO }
const one: StandingsClassBlock[] = [block([1, 2, 3], {}, 2)]
const two: StandingsClassBlock[] = [block([1, 2], {}, 1), block([1], { classId: 2 })]

describe('barInfo', () => {
  it('keeps the SoF and the car count in a single-class table (no class line says them)', () => {
    expect(barInfo(INFO, one, LINE)).toBe(INFO)
  })

  it('leaves them to the class lines while several classes are drawn', () => {
    const out = barInfo(INFO, two, LINE)
    expect(out).toMatchObject({ sof: null, carCount: null })
    expect(out?.fastestLap).toBe(INFO.fastestLap)
    expect(out?.iRating).toBe(INFO.iRating)
  })

  it('keeps what the class lines do not show (never said nowhere)', () => {
    const noSof = LINE.map((e) => (e.id === 'sof' ? { ...e, visible: false } : e))
    expect(barInfo(INFO, two, noSof)).toMatchObject({ sof: INFO.sof, carCount: null })
    const none = LINE.map((e) => ({ ...e, visible: false }))
    expect(barInfo(INFO, two, none)).toBe(INFO)
  })

  it('passes nothing through as nothing', () => {
    expect(barInfo(null, two, LINE)).toBeNull()
    expect(barInfo(INFO, null, LINE)).toBe(INFO)
    const blank = { ...INFO, sof: null, carCount: null }
    expect(barInfo(blank, two, LINE)).toBe(blank)
  })
})
