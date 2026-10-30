import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { DEFAULT_SETTINGS } from '@shared/settings'
import type { ConditionsData } from '@shared/types'
import {
  FOOTER_ITEMS,
  NO_FOOTER,
  PREVIEW_CONDITIONS,
  WETNESS_CELLS,
  footerReadingsOf,
  footerView,
  hasFooter,
  precipText,
  reuseFooter,
  rubberKey,
  rubberText,
  tempText,
  trendIcon,
  unwrapDeg,
  wetnessText,
  type FooterReadings,
  type FooterView
} from './conditions'

const ES = messagesFor('es')
const EN = messagesFor('en')
const NB = ' '

const ALL_ON: FooterReadings = {
  conditionsFooter: true,
  conditionsTrackTemp: true,
  conditionsTrend: true,
  conditionsWet: true,
  conditionsWind: true,
  conditionsWindDirection: true,
  conditionsAirTemp: true,
  conditionsRubber: true
}

/** A shower: every reading, the wet ones included. */
const SHOWER: ConditionsData = {
  ...PREVIEW_CONDITIONS,
  trackTempC: 27.8,
  airTempC: 18.6,
  wetness: 4,
  precipPct: 40,
  declaredWet: true
}

function data(over: Partial<ConditionsData> = {}): ConditionsData {
  return { ...SHOWER, ...over }
}

function view(
  d: ConditionsData | null,
  o: Partial<FooterReadings> = {},
  units: 'metric' | 'imperial' = 'metric',
  m = ES
): FooterView {
  return footerView(d, { ...ALL_ON, ...o }, units, m)
}

const items = (v: FooterView): string[] => FOOTER_ITEMS.filter((k) => v[k] !== null)

describe('readings', () => {
  it('writes temperatures in whole degrees, in °C or °F (TrackTempCrew moves by 1 °F, Q11)', () => {
    expect(tempText(27.84, 'metric')).toBe('28')
    expect(tempText(30, 'metric')).toBe('30')
    expect(tempText(-0.04, 'metric')).toBe('0')
    expect(tempText(30, 'imperial')).toBe('86')
    expect(tempText(null, 'metric')).toBe('—')
    // The race at Lime Rock: 71 °F reads 21.7 °C after the provider rounds to 0.1, 72 °F 22.2.
    expect(tempText(21.7, 'imperial')).toBe('71')
    expect(tempText(21.7, 'metric')).toBe('22')
    expect(tempText(22.2, 'imperial')).toBe('72')
  })

  it('draws the trend as a shape, nothing while measuring', () => {
    expect(trendIcon('up')).toBe('arrow-up')
    expect(trendIcon('down')).toBe('arrow-down')
    expect(trendIcon('steady')).toBe('minus')
    expect(trendIcon(null)).toBeNull()
  })

  it('turns the arrow the short way, even through 180', () => {
    expect(unwrapDeg(null, 190)).toBe(-170)
    expect(unwrapDeg(175, -175)).toBe(185)
    expect(unwrapDeg(185, 170)).toBe(170)
    expect(unwrapDeg(-170, 170)).toBe(-190)
    expect(unwrapDeg(720, 10)).toBe(730)
  })

  it('words the wetness, never "dry" when unknown', () => {
    expect(wetnessText(1, ES)).toBe('Seco')
    expect(wetnessText(4, ES)).toBe('Poco mojado')
    expect(wetnessText(7, EN)).toBe('Extremely wet')
    expect(wetnessText(null, ES)).toBe('—')
    expect(wetnessText(0, ES)).toBe('—')
    expect(wetnessText(8, ES)).toBe('—')
    expect(ES.widgets.conditions.wetness).toHaveLength(7)
    expect(EN.widgets.conditions.wetness).toHaveLength(7)
  })

  it('matches iRacing rubber states by their words, and shows an unknown one as written', () => {
    expect(rubberKey('moderate usage')).toBe('moderate')
    expect(rubberKey('Moderately Low Usage')).toBe('moderateLow')
    expect(rubberKey('moderately high usage')).toBe('moderateHigh')
    expect(rubberKey('low usage')).toBe('low')
    expect(rubberKey('slight usage')).toBe('low')
    expect(rubberKey('high usage')).toBe('high')
    expect(rubberKey('carry over')).toBe('carryOver')
    expect(rubberKey('clean')).toBe('clean')
    expect(rubberKey('no usage')).toBe('clean')
    expect(rubberKey('')).toBeNull()
    expect(rubberKey('marbles everywhere')).toBeNull()
    expect(rubberText('moderate usage', ES)).toBe('Moderada')
    expect(rubberText('carry over', EN)).toBe('Carried over')
    expect(rubberText('marbles everywhere', ES)).toBe('Marbles everywhere')
    expect(rubberText(' ', ES)).toBe('—')
  })

  it('marks a rubber state carried over from an earlier session', () => {
    expect(rubberText('moderately high usage', ES, true)).toBe('Media-alta (heredada)')
    expect(rubberText('moderately high usage', EN, true)).toBe('Moderately high (carried over)')
    expect(rubberText('', ES, true)).toBe('—')
    const v = view(data({ rubberState: 'moderately high usage', rubberCarried: true }))
    expect(v.rubber?.value).toBe('Media-alta (heredada)')
  })

  it('writes the rain with each language percent', () => {
    expect(precipText(40, ES)).toBe(`40${NB}%`)
    expect(precipText(40, EN)).toBe('40%')
    expect(precipText(null, ES)).toBe('—')
  })
})

describe('footerView', () => {
  it('fills every reading of a shower, in the line order', () => {
    const v = view(SHOWER)
    expect(v.track).toEqual({ label: 'Pista', value: '28', unit: '°C', trend: 'arrow-down' })
    expect(v.declaredWet).toBe('DECLARADA MOJADA')
    expect(v.wetness).toEqual({ label: 'Agua', value: 'Poco mojado', cells: 3 })
    expect(v.rain).toEqual({ label: 'Lluvia', value: `40${NB}%`, unit: '' })
    expect(v.wind).toEqual({
      label: 'Viento',
      value: '14',
      unit: 'km/h',
      dial: true,
      fromDeg: -60
    })
    expect(v.air).toEqual({ label: 'Aire', value: '19', unit: '°C' })
    expect(v.rubber).toEqual({ label: 'Goma', value: 'Moderada', unit: '' })
    expect(items(v)).toEqual(['track', 'declaredWet', 'wetness', 'rain', 'wind', 'air', 'rubber'])
    expect(view(SHOWER, {}, 'metric', EN).declaredWet).toBe('DECLARED WET')
  })

  it('keeps the track temperature first and the rubber last: a narrow table drops from the end', () => {
    expect(FOOTER_ITEMS[0]).toBe('track')
    expect(FOOTER_ITEMS[FOOTER_ITEMS.length - 1]).toBe('rubber')
    // The water comes right after the track: it is what matters when there is some.
    expect(FOOTER_ITEMS.slice(1, 4)).toEqual(['declaredWet', 'wetness', 'rain'])
  })

  it('shows the water only when relevant: past dry, from 1 %, while declared', () => {
    const dry = view(data({ wetness: 1, precipPct: 0, declaredWet: false }))
    expect(dry.wetness).toBeNull()
    expect(dry.rain).toBeNull()
    expect(dry.declaredWet).toBeNull()
    expect(items(dry)).toEqual(['track', 'wind', 'air', 'rubber'])
    // Unknown wetness (0, missing) is no water either; a drizzle that rounds to 0 % is none.
    expect(view(data({ wetness: null })).wetness).toBeNull()
    expect(view(data({ wetness: 0 })).wetness).toBeNull()
    expect(view(data({ precipPct: 0.4 })).rain).toBeNull()
    expect(view(data({ precipPct: 0.6 })).rain?.value).toBe(`1${NB}%`)
    // Mostly dry is the first level past dry: one cell; extremely wet fills the meter.
    expect(view(data({ wetness: 2 })).wetness).toMatchObject({ value: 'Casi seco', cells: 1 })
    expect(view(data({ wetness: 7 })).wetness?.cells).toBe(WETNESS_CELLS)
    expect(WETNESS_CELLS).toBe(6)
  })

  it('follows the units', () => {
    const v = view(SHOWER, {}, 'imperial', EN)
    expect(v.track?.value).toBe('82')
    expect(v.track?.unit).toBe('°F')
    expect(v.wind?.value).toBe('9')
    expect(v.wind?.unit).toBe('mph')
    expect(v.air?.unit).toBe('°F')
  })

  it('drops each reading with its option', () => {
    expect(view(SHOWER, { conditionsTrend: false }).track?.trend).toBeNull()
    expect(view(SHOWER, { conditionsWindDirection: false }).wind).toMatchObject({
      dial: false,
      fromDeg: null
    })
    expect(items(view(SHOWER, { conditionsWet: false }))).toEqual([
      'track',
      'wind',
      'air',
      'rubber'
    ])
    expect(items(view(SHOWER, { conditionsTrackTemp: false, conditionsAirTemp: false }))).toEqual([
      'declaredWet',
      'wetness',
      'rain',
      'wind',
      'rubber'
    ])
    expect(items(view(SHOWER, { conditionsWind: false, conditionsRubber: false }))).toEqual([
      'track',
      'declaredWet',
      'wetness',
      'rain',
      'air'
    ])
    const none = view(SHOWER, {
      conditionsTrackTemp: false,
      conditionsWet: false,
      conditionsWind: false,
      conditionsAirTemp: false,
      conditionsRubber: false
    })
    expect(hasFooter(none)).toBe(false)
  })

  it('draws the caption instead of an empty dial in a calm or without a direction', () => {
    // Out of the car (the session screen) there is no direction: 'VIENTO 14 km/h', not a ring.
    const caption = { dial: false, fromDeg: null, label: 'Viento' }
    expect(view(data({ windKmh: 1 })).wind).toMatchObject(caption)
    expect(view(data({ windFromDeg: null })).wind).toMatchObject(caption)
    expect(view(data({ windFromDeg: 170 })).wind).toMatchObject({ dial: true, fromDeg: 170 })
    const off = view(data({ windFromDeg: 170 }), { conditionsWindDirection: false })
    expect(off.wind).toMatchObject(caption)
  })

  it('leaves out what the sim does not send, never "—"', () => {
    const v = view(
      data({ rubberState: '', trackTempC: null, airTempC: null, windKmh: null, precipPct: null })
    )
    expect(v.track).toBeNull()
    expect(v.air).toBeNull()
    expect(v.wind).toBeNull()
    expect(v.rain).toBeNull()
    expect(v.rubber).toBeNull()
    expect(items(v)).toEqual(['declaredWet', 'wetness'])
  })

  it('draws nothing with the footer off, no readings yet or no weather at all', () => {
    expect(view(SHOWER, { conditionsFooter: false })).toBe(NO_FOOTER)
    expect(view(null)).toBe(NO_FOOTER)
    expect(view(data({ visible: false }))).toBe(NO_FOOTER)
    expect(hasFooter(NO_FOOTER)).toBe(false)
    expect(hasFooter(view(SHOWER))).toBe(true)
  })

  it('keeps unchanged readings, and the whole view when nothing changed', () => {
    const a = view(SHOWER)
    expect(reuseFooter(a, view(SHOWER))).toBe(a)
    const b = reuseFooter(a, view(data({ airTempC: 21 })))
    expect(b).not.toBe(a)
    expect(b.track).toBe(a.track)
    expect(b.wind).toBe(a.wind)
    expect(b.wetness).toBe(a.wetness)
    expect(b.declaredWet).toBe(a.declaredWet)
    expect(b.air).not.toBe(a.air)
    expect(reuseFooter(undefined, a)).toBe(a)
    // A reading that goes away is replaced, the rest kept.
    const dry = reuseFooter(a, view(data({ declaredWet: false })))
    expect(dry.declaredWet).toBeNull()
    expect(dry.track).toBe(a.track)
  })
})

describe('the edit-mode sample', () => {
  it('is a drying track: the meter, no rain, no call, every default reading shown', () => {
    const v = view(PREVIEW_CONDITIONS)
    expect(items(v)).toEqual(['track', 'wetness', 'wind', 'air', 'rubber'])
    expect(v.wetness).toEqual({ label: 'Agua', value: 'Algo húmedo', cells: 2 })
  })

  it('matches the default options of both tables but the switch, the air and the rubber', () => {
    // A new install leaves the air and the rubber out of the footers since R30.
    for (const section of ['relative', 'standings'] as const) {
      const o = DEFAULT_SETTINGS[section]
      expect({ ...footerReadingsOf(o), conditionsFooter: true }).toEqual({
        ...ALL_ON,
        conditionsAirTemp: false,
        conditionsRubber: false
      })
    }
  })
})
