import { describe, expect, it } from 'vitest'
import { LIGHT_ORDER } from '@shared/lights'
import { messagesFor } from '@shared/i18n'
import { defaultOptions } from '@shared/settings'
import type { LightKind, LightReading, LightsData } from '@shared/types'
import { ENGINE_ICON_NAMES } from '@renderer/ui/engineIcons'
import { PREVIEW_LIGHTS, PREVIEW_LIGHTS_REAL } from './preview'
import {
  LIGHT_ICONS,
  formatDegrees,
  formatRise,
  hasLightTexts,
  hasLights,
  layoutKey,
  lightsFilter,
  lightsView,
  previewFilter,
  repairSampleText,
  type LightView,
  type LightsFilter
} from './view'

const NB = ' '
const ES = messagesFor('es')
const EN = messagesFor('en')
const DEFAULTS: LightsFilter = lightsFilter(defaultOptions('lights'))
const ALL: LightsFilter = { ...DEFAULTS, icons: LIGHT_ORDER.map((id) => ({ id, visible: true })) }

/** `f` with these lights hidden. */
function without(f: LightsFilter, ...off: LightKind[]): LightsFilter {
  return { ...f, icons: f.icons.map((e) => ({ ...e, visible: e.visible && !off.includes(e.id) })) }
}

const reading = (o: Partial<LightReading> & Pick<LightReading, 'kind'>): LightReading => ({
  level: 'off',
  tempC: null,
  riseC: null,
  draft: false,
  seconds: null,
  realTime: false,
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

  it('icons alone by default; the repair time as the crew’s, the trend light yellow', () => {
    const v = lightsView(PREVIEW_LIGHTS, DEFAULTS, 'metric', ES)
    expect(texts(v)).toEqual([
      'oilPressure=',
      'fuelPressure=',
      'stalled=',
      `repair=42${NB}s${NB}(equipo)`,
      `repairOptional=38${NB}s${NB}(equipo)`,
      'water=',
      'oilTemp='
    ])
    expect(v.map((l) => l.level)).toEqual(['off', 'off', 'off', 'alarm', 'warn', 'caution', 'off'])
  })

  it('captions in each language: «REPARAR · 42 s (equipo)», «OPC. · 38 s (equipo)»', () => {
    const o = { ...ALL, showCaptions: true, showTemps: true }
    expect(texts(lightsView(PREVIEW_LIGHTS, o, 'metric', ES))).toEqual([
      'oilPressure=P. ACEITE',
      'fuelPressure=GASOLINA',
      'stalled=CALADO',
      `repair=REPARAR · 42${NB}s${NB}(equipo)`,
      `repairOptional=OPC. · 38${NB}s${NB}(equipo)`,
      'water=AGUA · 98° +6° · ¿rebufo?',
      'oilTemp=T. ACEITE · 104°',
      'pitLimiter=LIMITADOR',
      'revLimiter=CORTE'
    ])
    expect(texts(lightsView(PREVIEW_LIGHTS, o, 'metric', EN))).toEqual([
      'oilPressure=OIL P.',
      'fuelPressure=FUEL',
      'stalled=STALL',
      `repair=REPAIR · 42${NB}s${NB}(crew)`,
      `repairOptional=OPT. · 38${NB}s${NB}(crew)`,
      'water=WATER · 98° +6° · slipstream?',
      'oilTemp=OIL T. · 104°',
      'pitLimiter=LIMITER',
      'revLimiter=REV LIM.'
    ])
  })

  it('the crew’s time with its tag, short in narrow windows; bare without the tag', () => {
    const o = { ...ALL, showCaptions: true }
    const repair = (f: LightsFilter, m = ES): LightView | undefined =>
      lightsView(PREVIEW_LIGHTS, f, 'metric', m).find((l) => l.kind === 'repair')
    expect(repair(o)?.short).toBe(`REPARAR · 42${NB}s${NB}eq.`)
    expect(repair(o, EN)?.short).toBe(`REPAIR · 42${NB}s${NB}crew`)
    const bare = repair({ ...o, repairCrewTag: false })
    expect(bare?.text).toBe(`REPARAR · 42${NB}s`)
    // Nothing shorter to write: no narrow form.
    expect(bare?.short).toBe('')
    // A light without a time has none either.
    expect(lightsView(PREVIEW_LIGHTS, o, 'metric', ES).find((l) => l.kind === 'water')?.short).toBe(
      ''
    )
  })

  it('the real seconds estimated in the stall always read «≈», tagged «(real)» when wide', () => {
    const o = { ...ALL, showCaptions: true }
    const repair = (f: LightsFilter, m = ES): LightView | undefined =>
      lightsView(PREVIEW_LIGHTS_REAL, f, 'metric', m).find((l) => l.kind === 'repair')
    expect(repair(o)?.text).toBe(`REPARAR · ≈${NB}95${NB}s${NB}(real)`)
    expect(repair(o)?.short).toBe(`REPARAR · ≈${NB}95${NB}s`)
    expect(repair(o, EN)?.text).toBe(`REPAIR · ≈${NB}95${NB}s${NB}(real)`)
    // Without the crew's tag the estimate keeps its «≈»: it is never mistaken for iRacing's figure.
    expect(repair({ ...o, repairCrewTag: false })?.text).toBe(`REPARAR · ≈${NB}95${NB}s`)
    // The optional repairs of that sample are still the crew's.
    expect(
      lightsView(PREVIEW_LIGHTS_REAL, o, 'metric', ES).find((l) => l.kind === 'repairOptional')
        ?.text
    ).toBe(`OPC. · 38${NB}s${NB}(equipo)`)
  })

  it('reads a payload from before realTime as the crew’s time, and drops a bad one', () => {
    const old = {
      kind: 'repair',
      level: 'alarm',
      tempC: null,
      riseC: null,
      draft: false,
      seconds: 9
    }
    const bad = { ...old, kind: 'repairOptional', realTime: 'yes' }
    const v = lightsView({ lights: [old, bad] as unknown as LightReading[] }, ALL, 'metric', ES)
    expect(texts(v).filter((l) => l.startsWith('repair'))).toEqual([`repair=9${NB}s${NB}(equipo)`])
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
    // Without showTemps the reading and its rise go: icons only; the yellow light still says it.
    expect(lightsView(data([w]), ALL, 'metric', ES)[0]).toMatchObject({
      text: '',
      level: 'caution'
    })
  })

  it('knows when no light shows any text (the column’s text side does nothing then)', () => {
    const icons = { ...DEFAULTS, showCaptions: false, showTemps: false, showRepairTime: false }
    expect(hasLightTexts(icons)).toBe(false)
    // The trend alone is a yellow light, not a text.
    expect(hasLightTexts({ ...icons, showTrend: true })).toBe(false)
    expect(hasLightTexts({ ...icons, showCaptions: true })).toBe(true)
    expect(hasLightTexts({ ...ALL, ...icons, showTemps: true })).toBe(true)
    expect(hasLightTexts(without({ ...ALL, ...icons, showTemps: true }, 'water', 'oilTemp'))).toBe(
      false
    )
    expect(hasLightTexts({ ...ALL, ...icons, showRepairTime: true })).toBe(true)
  })

  it('values off and the trend on: no number at all, only the yellow light', () => {
    const w = reading({ kind: 'water', level: 'caution', tempC: 98, riseC: 6 })
    const o = { ...ALL, showTemps: false, showTrend: true, showCaptions: false }
    expect(lightsView(data([w]), o, 'metric', ES)[0]).toMatchObject({ text: '', level: 'caution' })
    expect(lightsView(data([w]), { ...o, showTemps: true }, 'metric', ES)[0]?.text).toBe('98° +6°')
  })

  it('draws the lights in the order of lights.icons', () => {
    const reversed: LightsFilter = { ...ALL, icons: [...ALL.icons].reverse() }
    const v = lightsView(PREVIEW_LIGHTS, reversed, 'metric', ES).map((l) => l.kind)
    const fwd = lightsView(PREVIEW_LIGHTS, ALL, 'metric', ES).map((l) => l.kind)
    expect(v).toEqual([...fwd].reverse())
    expect(fwd).toEqual(LIGHT_ORDER.filter((k) => fwd.includes(k)))
    // The order changes the strip (it may wrap otherwise): the reveal waits for it.
    expect(layoutKey(lightsView(PREVIEW_LIGHTS, reversed, 'metric', ES), 'row')).not.toBe(
      layoutKey(lightsView(PREVIEW_LIGHTS, ALL, 'metric', ES), 'row')
    )
    // The sample with nothing chosen shows every light, in that order too.
    const none = { ...reversed, icons: reversed.icons.map((e) => ({ ...e, visible: false })) }
    const all = previewFilter(PREVIEW_LIGHTS, none, ES)
    expect(all.icons.map((e) => e.id)).toEqual(reversed.icons.map((e) => e.id))
  })

  it('applies every option, at once and on the sample', () => {
    for (const k of LIGHT_ORDER) {
      const v = lightsView(PREVIEW_LIGHTS, without(ALL, k), 'metric', ES)
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
    expect(hasLights(one, without(ALL, 'water'), ES)).toBe(false)
    expect(hasLights(data([reading({ kind: 'water' })]), { ...ALL, onlyWhenLit: true }, ES)).toBe(
      false
    )
  })

  it('the sample follows the options, unless they leave nothing to draw', () => {
    expect(previewFilter(PREVIEW_LIGHTS, DEFAULTS, ES)).toBe(DEFAULTS)
    const none = without(DEFAULTS, ...LIGHT_ORDER)
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

describe('repairSampleText', () => {
  const o = { repairCrewTag: true, repairRealTime: false }
  it('writes the sample’s repairs as the strip does, following the tag and the real countdown', () => {
    expect(repairSampleText('repair', o, ES)).toBe(`REPARAR · 42${NB}s${NB}(equipo)`)
    expect(repairSampleText('repairOptional', o, ES)).toBe(`OPC. · 38${NB}s${NB}(equipo)`)
    expect(repairSampleText('repair', { ...o, repairCrewTag: false }, ES)).toBe(
      `REPARAR · 42${NB}s`
    )
    expect(repairSampleText('repair', { ...o, repairRealTime: true }, EN)).toBe(
      `REPAIR · ≈${NB}95${NB}s${NB}(real)`
    )
    // The legend's rows say the same as the strip with the same options.
    const strip = lightsView(PREVIEW_LIGHTS, { ...ALL, showCaptions: true }, 'metric', ES)
    expect(strip.find((l) => l.kind === 'repair')?.text).toBe(repairSampleText('repair', o, ES))
  })

  it('the sample’s real countdown is longer than the crew’s figure, as the feature measures', () => {
    const crew = PREVIEW_LIGHTS.lights.find((l) => l.kind === 'repair')?.seconds ?? 0
    const real = PREVIEW_LIGHTS_REAL.lights.find((l) => l.kind === 'repair')?.seconds ?? 0
    expect(real).toBeGreaterThan(crew)
  })
})
