import { describe, expect, it } from 'vitest'
import { LIGHT_OPTION, LIGHT_ORDER } from '@shared/lights'
import { messagesFor } from '@shared/i18n'
import { defaultOptions } from '@shared/settings'
import type { LightKind, LightReading, LightsData } from '@shared/types'
import { ENGINE_ICON_NAMES } from '@renderer/ui/engineIcons'
import { PREVIEW_LIGHTS } from './preview'
import {
  LIGHT_ICONS,
  formatDegrees,
  formatRise,
  hasLights,
  layoutKey,
  lightsFilter,
  lightsView,
  previewFilter,
  type LightView,
  type LightsFilter
} from './view'

const NB = ' '
const ES = messagesFor('es')
const EN = messagesFor('en')
const DEFAULTS: LightsFilter = lightsFilter(defaultOptions('lights'))
const ALL: LightsFilter = { ...DEFAULTS, showPitLimiter: true, showRevLimiter: true }

const reading = (o: Partial<LightReading> & Pick<LightReading, 'kind'>): LightReading => ({
  level: 'off',
  tempC: null,
  riseC: null,
  draft: false,
  seconds: null,
  ...o
})
const data = (lights: LightReading[], visible = true): LightsData => ({ visible, lights })
const texts = (v: readonly LightView[]): string[] => v.map((l) => `${l.kind}=${l.text}`)

describe('lightsView', () => {
  it('draws each light with its pictogram, in the strip’s order', () => {
    const sent = [...LIGHT_ORDER].reverse().map((kind) => reading({ kind }))
    const v = lightsView(data(sent), ALL, 'metric', ES)
    expect(v.map((l) => l.kind)).toEqual([...LIGHT_ORDER])
    for (const l of v) {
      expect(ENGINE_ICON_NAMES).toContain(l.icon)
      expect(l.icon).toBe(LIGHT_ICONS[l.kind])
    }
    // Two lights, two pictograms: none is told apart by colour alone.
    expect(new Set(Object.values(LIGHT_ICONS)).size).toBe(LIGHT_ORDER.length)
  })

  it('icons alone by default; the repair time and the rise as the light says them', () => {
    const v = lightsView(PREVIEW_LIGHTS, DEFAULTS, 'metric', ES)
    expect(texts(v)).toEqual([
      'oilPressure=',
      'fuelPressure=',
      'stalled=',
      `repair=42${NB}s`,
      `repairOptional=38${NB}s`,
      'water=+6°',
      'oilTemp='
    ])
    expect(v.map((l) => l.level)).toEqual(['off', 'off', 'off', 'alarm', 'warn', 'caution', 'off'])
  })

  it('captions in each language: «REPARAR · 42 s», «OPC. · 38 s»', () => {
    const o = { ...ALL, showCaptions: true, showTemps: true }
    expect(texts(lightsView(PREVIEW_LIGHTS, o, 'metric', ES))).toEqual([
      'oilPressure=P. ACEITE',
      'fuelPressure=GASOLINA',
      'stalled=CALADO',
      `repair=REPARAR · 42${NB}s`,
      `repairOptional=OPC. · 38${NB}s`,
      'water=AGUA · 98° +6° · ¿rebufo?',
      'oilTemp=T. ACEITE · 104°',
      'pitLimiter=LIMITADOR',
      'revLimiter=CORTE'
    ])
    expect(texts(lightsView(PREVIEW_LIGHTS, o, 'metric', EN))).toEqual([
      'oilPressure=OIL P.',
      'fuelPressure=FUEL',
      'stalled=STALL',
      `repair=REPAIR · 42${NB}s`,
      `repairOptional=OPT. · 38${NB}s`,
      'water=WATER · 98° +6° · slipstream?',
      'oilTemp=OIL T. · 104°',
      'pitLimiter=LIMITER',
      'revLimiter=REV LIM.'
    ])
  })

  it('tells every light apart by its caption and its name, in both languages', () => {
    for (const m of [ES, EN]) {
      const t = m.widgets.lights
      expect(new Set(LIGHT_ORDER.map((k) => t.captions[k])).size).toBe(LIGHT_ORDER.length)
      expect(new Set(LIGHT_ORDER.map((k) => t.names[k])).size).toBe(LIGHT_ORDER.length)
      for (const k of LIGHT_ORDER) expect(t.captions[k].length, k).toBeLessThanOrEqual(10)
    }
  })

  it('the temperatures in the chosen units', () => {
    const w = reading({ kind: 'water', level: 'caution', tempC: 98, riseC: 6 })
    const o = { ...ALL, showTemps: true }
    expect(lightsView(data([w]), o, 'imperial', EN)[0]?.text).toBe('208° +11°')
    expect(formatDegrees(98, 'metric')).toBe('98°')
    expect(formatRise(-2, 'metric')).toBe('+0°')
    // Without showTemps, the reading goes; the rise is what the yellow light says.
    expect(lightsView(data([w]), ALL, 'metric', ES)[0]?.text).toBe('+6°')
  })

  it('applies every option, at once and on the sample', () => {
    for (const k of LIGHT_ORDER) {
      const v = lightsView(PREVIEW_LIGHTS, { ...ALL, [LIGHT_OPTION[k]]: false }, 'metric', ES)
      expect(
        v.map((l) => l.kind),
        k
      ).not.toContain(k)
    }
    // Without the trend a yellow light is off; without the repair time, no seconds.
    const noTrend = lightsView(PREVIEW_LIGHTS, { ...ALL, showTrend: false }, 'metric', ES)
    expect(noTrend.find((l) => l.kind === 'water')).toMatchObject({ level: 'off', text: '' })
    const noTime = lightsView(PREVIEW_LIGHTS, { ...ALL, showRepairTime: false }, 'metric', ES)
    expect(noTime.find((l) => l.kind === 'repair')?.text).toBe('')
    // Only the lit ones.
    const lit = lightsView(PREVIEW_LIGHTS, { ...ALL, onlyWhenLit: true }, 'metric', ES)
    expect(lit.map((l) => l.kind)).toEqual(['repair', 'repairOptional', 'water', 'pitLimiter'])
  })

  it('names each light and its state for screen readers', () => {
    const v = lightsView(PREVIEW_LIGHTS, ALL, 'metric', ES)
    const label = (k: LightKind): string | undefined => v.find((l) => l.kind === k)?.label
    expect(label('repair')).toBe('Reparación obligatoria: encendido')
    expect(label('water')).toBe('Temperatura del agua: por encima de tu media')
    expect(label('stalled')).toBe('Motor calado: apagado')
    expect(lightsView(PREVIEW_LIGHTS, ALL, 'metric', EN)[0]?.label).toBe('Oil pressure: off')
  })

  it('drops what it does not know and repeats (the payload crosses IPC)', () => {
    const bogus = [
      { kind: 'bogus', level: 'off' },
      { kind: 'water', level: 'purple' },
      { kind: 'water', level: 'warn', tempC: 'hot' },
      { kind: 'repair', level: 'alarm', seconds: Number.NaN },
      null
    ] as unknown as LightReading[]
    expect(lightsView(data(bogus), ALL, 'metric', ES)).toEqual([])
    const twice = [
      reading({ kind: 'water', level: 'warn' }),
      reading({ kind: 'water', level: 'off' })
    ]
    expect(lightsView(data(twice), ALL, 'metric', ES).map((l) => l.level)).toEqual(['warn'])
    expect(lightsView({ lights: 'x' as unknown as LightReading[] }, ALL, 'metric', ES)).toEqual([])
  })
})

describe('hasLights / previewFilter / layoutKey', () => {
  it('needs a visible payload with a light the options show', () => {
    const one = data([reading({ kind: 'water', level: 'warn' })])
    expect(hasLights(one, ALL, ES)).toBe(true)
    expect(hasLights({ ...one, visible: false }, ALL, ES)).toBe(false)
    expect(hasLights(one, { ...ALL, showWater: false }, ES)).toBe(false)
    expect(hasLights(data([reading({ kind: 'water' })]), { ...ALL, onlyWhenLit: true }, ES)).toBe(
      false
    )
  })

  it('the sample follows the options, unless they leave nothing to draw', () => {
    expect(previewFilter(PREVIEW_LIGHTS, DEFAULTS, ES)).toBe(DEFAULTS)
    const none = { ...DEFAULTS }
    for (const k of LIGHT_ORDER) none[LIGHT_OPTION[k]] = false
    const all = previewFilter(PREVIEW_LIGHTS, none, ES)
    expect(lightsView(PREVIEW_LIGHTS, all, 'metric', ES)).toHaveLength(LIGHT_ORDER.length)
  })

  it('changes the layout key with the layout, the lights and their words', () => {
    const v = lightsView(PREVIEW_LIGHTS, DEFAULTS, 'metric', ES)
    const captions = lightsView(PREVIEW_LIGHTS, { ...DEFAULTS, showCaptions: true }, 'metric', ES)
    const keys = [
      layoutKey(v, 'row'),
      layoutKey(v, 'column'),
      layoutKey(v.slice(1), 'row'),
      layoutKey(captions, 'row')
    ]
    expect(new Set(keys).size).toBe(keys.length)
    expect(layoutKey(v, 'row')).toBe(layoutKey([...v], 'row'))
  })
})

describe('preview', () => {
  it('has one light of each look among dim ones, every reading filled, frozen', () => {
    const levels = new Set(PREVIEW_LIGHTS.lights.map((l) => l.level))
    expect(levels).toEqual(new Set(['off', 'alarm', 'warn', 'caution', 'info']))
    expect(PREVIEW_LIGHTS.lights.map((l) => l.kind)).toEqual([...LIGHT_ORDER])
    expect(Object.isFrozen(PREVIEW_LIGHTS)).toBe(true)
  })
})
