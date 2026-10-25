import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { messagesFor } from '@shared/i18n'
import type { ConditionsData } from '@shared/types'
import { PREVIEW_CONDITIONS } from './preview'
import {
  EMPTY_VIEW,
  conditionsView,
  layoutKey,
  linesOf,
  precipText,
  reuseParts,
  rubberKey,
  rubberText,
  skiesText,
  tempText,
  trendIcon,
  unwrapDeg,
  wetnessText,
  windSide,
  type ConditionsViewOptions
} from './view'

const ES = messagesFor('es')
const EN = messagesFor('en')
const NB = ' '

const ALL_ON: ConditionsViewOptions = {
  showTrackTemp: true,
  showTrend: true,
  showAirTemp: true,
  showWind: true,
  showWindDirection: true,
  showWetness: true,
  showPrecipitation: true,
  showDeclaredWet: true,
  showSkies: true,
  showRubber: true
}

function data(over: Partial<ConditionsData> = {}): ConditionsData {
  return { ...PREVIEW_CONDITIONS, ...over }
}

describe('readings', () => {
  it('writes temperatures with one decimal, in °C or °F', () => {
    expect(tempText(27.84, 'metric')).toBe('27.8')
    expect(tempText(30, 'metric')).toBe('30.0')
    expect(tempText(-0.04, 'metric')).toBe('0.0')
    expect(tempText(30, 'imperial')).toBe('86.0')
    expect(tempText(null, 'metric')).toBe('—')
  })

  it('draws the trend as a shape, nothing while measuring', () => {
    expect(trendIcon('up')).toBe('arrow-up')
    expect(trendIcon('down')).toBe('arrow-down')
    expect(trendIcon('steady')).toBe('minus')
    expect(trendIcon(null)).toBeNull()
  })

  it('names the side the wind comes from: a quarter around the nose is a headwind', () => {
    expect([0, 45, -45, 46, 134, 135, 180, -135, -90].map(windSide)).toEqual([
      'head',
      'head',
      'head',
      'right',
      'right',
      'tail',
      'tail',
      'tail',
      'left'
    ])
    expect(windSide(360 + 90)).toBe('right')
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
  })

  it('words the sky', () => {
    expect(skiesText(0, ES)).toBe('Despejado')
    expect(skiesText(3, EN)).toBe('Overcast')
    expect(skiesText(null, ES)).toBe('—')
    expect(skiesText(4, ES)).toBe('—')
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

  it('writes the rain with each language percent', () => {
    expect(precipText(40, ES)).toBe(`40${NB}%`)
    expect(precipText(40, EN)).toBe('40%')
    expect(precipText(null, ES)).toBe('—')
  })
})

describe('conditionsView', () => {
  it('shows every reading by default but the header (a compact readout)', () => {
    const { showHeader, ...rest } = DEFAULT_SETTINGS.conditions
    expect(showHeader).toBe(false)
    expect(rest).toEqual(ALL_ON)
  })

  it('fills every part of the sample', () => {
    const v = conditionsView(PREVIEW_CONDITIONS, ALL_ON, 'metric', ES)
    expect(v.track).toEqual({ label: 'Pista', value: '27.8', unit: '°C', trend: 'arrow-down' })
    expect(v.air).toEqual({ label: 'Aire', value: '18.6', unit: '°C' })
    expect(v.wind).toEqual({
      label: 'Viento',
      value: '14',
      unit: 'km/h',
      dial: true,
      fromDeg: -60,
      side: 'por la izq.'
    })
    expect(v.wetness).toEqual({ label: 'Asfalto', value: 'Poco mojado', unit: '', level: 4 })
    expect(v.rain).toEqual({ label: 'Lluvia', value: `40${NB}%`, unit: '' })
    expect(v.sky).toEqual({ label: 'Cielo', value: 'Cubierto', unit: '' })
    expect(v.rubber).toEqual({ label: 'Goma', value: 'Moderada', unit: '' })
    expect(v.declaredWet).toEqual({
      label: 'DECLARADA MOJADA',
      note: 'neumáticos de lluvia permitidos'
    })
    expect(linesOf(v)).toEqual(['temps', 'wind', 'surface', 'sky', 'wet'])
  })

  it('follows the units', () => {
    const v = conditionsView(PREVIEW_CONDITIONS, ALL_ON, 'imperial', EN)
    expect(v.track?.value).toBe('82.0')
    expect(v.track?.unit).toBe('°F')
    expect(v.wind?.value).toBe('9')
    expect(v.wind?.unit).toBe('mph')
  })

  it('drops each part with its option, and a line with both its parts', () => {
    const off = (o: Partial<ConditionsViewOptions>): ReturnType<typeof conditionsView> =>
      conditionsView(PREVIEW_CONDITIONS, { ...ALL_ON, ...o }, 'metric', ES)
    expect(off({ showTrend: false }).track?.trend).toBeNull()
    expect(off({ showWindDirection: false }).wind).toMatchObject({
      dial: false,
      fromDeg: null,
      side: ''
    })
    expect(off({ showDeclaredWet: false }).declaredWet).toBeNull()
    expect(linesOf(off({ showTrackTemp: false, showAirTemp: false }))).toEqual([
      'wind',
      'surface',
      'sky',
      'wet'
    ])
    expect(linesOf(off({ showWind: false, showSkies: false }))).toEqual([
      'temps',
      'surface',
      'sky',
      'wet'
    ])
    const none = off({
      showTrackTemp: false,
      showAirTemp: false,
      showWind: false,
      showWetness: false,
      showPrecipitation: false,
      showDeclaredWet: false,
      showSkies: false,
      showRubber: false
    })
    expect(linesOf(none)).toEqual([])
  })

  it('says calm without a direction, and leaves the side empty without one', () => {
    expect(conditionsView(data({ windKmh: 1 }), ALL_ON, 'metric', ES).wind).toMatchObject({
      fromDeg: null,
      side: 'en calma'
    })
    expect(conditionsView(data({ windFromDeg: null }), ALL_ON, 'metric', EN).wind).toMatchObject({
      fromDeg: null,
      side: ''
    })
    expect(conditionsView(data({ windFromDeg: 170 }), ALL_ON, 'metric', EN).wind?.side).toBe(
      'tailwind'
    )
  })

  it('shows unknown wetness and rubber as "—", and leaves out what the sim does not send', () => {
    const v = conditionsView(
      data({ wetness: null, rubberState: '', trackTempC: null, precipPct: null, skies: null }),
      ALL_ON,
      'metric',
      ES
    )
    expect(v.wetness).toEqual({ label: 'Asfalto', value: '—', unit: '', level: null })
    expect(v.rubber?.value).toBe('—')
    expect(v.track).toBeNull()
    expect(v.rain).toBeNull()
    expect(v.sky).toBeNull()
    expect(v.air).not.toBeNull()
  })

  it('draws nothing without weather data', () => {
    expect(conditionsView(data({ visible: false }), ALL_ON, 'metric', ES)).toBe(EMPTY_VIEW)
    expect(linesOf(EMPTY_VIEW)).toEqual([])
  })

  it('keeps unchanged parts, and the whole view when nothing changed', () => {
    const a = conditionsView(PREVIEW_CONDITIONS, ALL_ON, 'metric', ES)
    const same = reuseParts(a, conditionsView(PREVIEW_CONDITIONS, ALL_ON, 'metric', ES))
    expect(same).toBe(a)
    const b = reuseParts(a, conditionsView(data({ airTempC: 19 }), ALL_ON, 'metric', ES))
    expect(b).not.toBe(a)
    expect(b.track).toBe(a.track)
    expect(b.wind).toBe(a.wind)
    expect(b.air).not.toBe(a.air)
    expect(reuseParts(undefined, a)).toBe(a)
  })

  it('keys the layout on the lines drawn and the header', () => {
    const v = conditionsView(PREVIEW_CONDITIONS, ALL_ON, 'metric', ES)
    expect(layoutKey(v, false)).toBe('temps,wind,surface,sky,wet')
    expect(layoutKey(v, true)).toBe('htemps,wind,surface,sky,wet')
    const dry = conditionsView(data({ declaredWet: false }), ALL_ON, 'metric', ES)
    expect(layoutKey(dry, false)).not.toBe(layoutKey(v, false))
  })
})
