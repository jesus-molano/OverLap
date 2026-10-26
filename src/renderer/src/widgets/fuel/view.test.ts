import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { fuelStrategy } from '@shared/fuel/strategy'
import { DEFAULT_SETTINGS } from '@shared/settings'
import type { FuelData, FuelFinish } from '@shared/types'
import { PREVIEW_FUEL } from './preview'
import {
  EMPTY_VIEW,
  fuelTone,
  fuelView,
  layoutKey,
  linesOf,
  reuseParts,
  windowText,
  type FuelViewOptions
} from './view'

const ES = messagesFor('es')
const EN = messagesFor('en')
const NB = ' '

const ALL_ON: FuelViewOptions = {
  showGauge: true,
  showPerLap: true,
  showFinish: true,
  showBox: true,
  showWindow: true,
  showSave: true,
  showTyres: true,
  showLimits: true
}

const NO_STOP: FuelFinish = {
  lap: 30,
  lapsLeft: 4.6,
  needL: 15.1,
  deficitL: -5.7,
  short: false,
  stops: 0,
  addL: 0,
  fill: false,
  window: null,
  saveL: null
}

const data = (o: Partial<FuelData> = {}): FuelData => ({ ...PREVIEW_FUEL, ...o })

describe('fuelView', () => {
  it('draws every line of the sample', () => {
    const v = fuelView(PREVIEW_FUEL, ALL_ON, ES)
    expect(linesOf(v)).toEqual([
      'hero',
      'gauge',
      'perLap',
      'finish',
      'window',
      'save',
      'tyres',
      'limits'
    ])
    expect(v.hero).toEqual({
      fuel: '52.0',
      laps: '17.6',
      lapsUnit: 'v',
      tone: 'neutral',
      note: '',
      left: { label: 'Quedan', value: '18.7', unit: 'v' }
    })
    expect(v.gauge?.fill).toBeCloseTo(52 / 85)
    expect(v.gauge?.need).toBeCloseTo(56.8 / 85)
    expect(v.perLap).toEqual({
      label: 'Consumo',
      value: '2.96',
      unit: 'L/v',
      note: `últ.${NB}3.02 · máx.${NB}3.10`,
      measuring: false
    })
    expect(v.finish).toEqual({
      need: { label: 'Para meta', value: '56.8', unit: 'L' },
      add: { label: 'Repostar', value: '+4.9', unit: 'L' },
      addTone: 'neutral',
      box: { text: `caja${NB}20${NB}L`, tone: 'good' }
    })
    expect(v.window).toEqual({
      label: 'Ventana',
      value: 'V17–V33',
      unit: '',
      tone: 'good',
      stops: '1 parada',
      stopsTone: 'neutral'
    })
    expect(v.save).toEqual({ label: 'Ahorro', value: '2.70', unit: 'L/v', note: 'sin parar' })
    expect(v.tyres).toEqual({
      label: 'Neum.',
      lap: 'V13',
      corners: [
        { name: 'DI', value: '78' },
        { name: 'DD', value: '74' },
        { name: 'TI', value: '86' },
        { name: 'TD', value: '82' }
      ]
    })
    expect(v.limits).toEqual({
      repairs: { label: 'Reparaciones', value: '1', unit: '' },
      sets: { label: 'Juegos', value: '2', unit: '' }
    })
  })

  it('says it in English, with the same figures', () => {
    const v = fuelView(PREVIEW_FUEL, ALL_ON, EN)
    expect(v.hero?.left).toEqual({ label: 'To go', value: '18.7', unit: 'laps' })
    expect(v.perLap?.note).toBe(`last${NB}3.02 · max${NB}3.10`)
    expect(v.finish?.box?.text).toBe(`menu${NB}20${NB}L`)
    expect(v.window).toMatchObject({ value: 'L17–L33', stops: '1 stop' })
    expect(v.save?.note).toBe('no stop')
    expect(v.tyres?.corners.map((c) => c.name)).toEqual(['FL', 'FR', 'RL', 'RR'])
  })

  it('leaves out each line with its option; the hero always stays', () => {
    const none: FuelViewOptions = {
      showGauge: false,
      showPerLap: false,
      showFinish: false,
      showBox: false,
      showWindow: false,
      showSave: false,
      showTyres: false,
      showLimits: false
    }
    expect(linesOf(fuelView(PREVIEW_FUEL, none, ES))).toEqual(['hero'])
    for (const k of Object.keys(ALL_ON) as (keyof FuelViewOptions)[]) {
      const v = fuelView(PREVIEW_FUEL, { ...ALL_ON, [k]: false }, ES)
      if (k === 'showBox') expect(v.finish?.box).toBeNull()
      else expect(linesOf(v), k).toHaveLength(7)
    }
  })

  it('measures before it plans', () => {
    const v = fuelView(
      data({ lapsOfFuel: null, avgL: null, maxL: null, samples: 0, lastL: 2.9, finish: null }),
      ALL_ON,
      ES
    )
    // The consumption line says it; without it, the hero does.
    expect(v.hero).toMatchObject({ laps: '—', note: '', left: null, tone: 'neutral' })
    const bare = fuelView(
      data({ lapsOfFuel: null, avgL: null, samples: 0, finish: null }),
      { ...ALL_ON, showPerLap: false },
      ES
    )
    expect(bare.hero?.note).toBe('midiendo…')
    expect(v.perLap).toEqual({
      label: 'Consumo',
      value: 'midiendo…',
      unit: '',
      note: `últ.${NB}2.90`,
      measuring: true
    })
    expect(linesOf(v)).toEqual(['hero', 'gauge', 'perLap', 'tyres', 'limits'])
    expect(v.gauge?.need).toBeNull()
  })

  it('says where an estimate from the last session comes from', () => {
    const v = fuelView(data({ carried: true }), ALL_ON, ES)
    expect(v.perLap?.note).toBe('de la sesión anterior')
    // A single lap has no "most" worth showing.
    expect(fuelView(data({ samples: 1, lastL: null }), ALL_ON, ES).perLap?.note).toBe('')
  })

  it('shows what is spare when no stop is needed, and nothing to save', () => {
    const v = fuelView(data({ fuelL: 20.8, lapsOfFuel: 7.1, finish: NO_STOP }), ALL_ON, ES)
    expect(v.hero?.tone).toBe('good')
    expect(v.finish).toEqual({
      need: { label: 'Para meta', value: '15.1', unit: 'L' },
      add: { label: 'Sobran', value: '5.7', unit: 'L' },
      addTone: 'good',
      box: null
    })
    expect(v.window).toMatchObject({ value: '—', stops: 'sin parar', stopsTone: 'good' })
    expect(v.save).toBeNull()
    expect(v.gauge?.tone).toBe('good')
  })

  it('on the last lap, says how short of the flag the fuel falls instead of a stop', () => {
    // 1.8 L at 3 L a lap from distance 19.2 of 20: 2.4 L to the flag and no stop left to make.
    const finish = fuelStrategy({
      fuelL: 1.8,
      avgL: 3,
      tankL: 85,
      distance: 19.2,
      lapsRemaining: 1,
      marginLaps: 0.5
    })
    const v = fuelView(data({ fuelL: 1.8, lapsOfFuel: 0.6, finish }), ALL_ON, ES)
    expect(v.hero?.tone).toBe('bad')
    expect(v.finish).toEqual({
      need: { label: 'Para meta', value: '2.4', unit: 'L' },
      add: { label: 'Faltan', value: '0.6', unit: 'L' },
      addTone: 'bad',
      box: null
    })
    expect(v.window).toMatchObject({ value: '—', stops: 'sin parar', stopsTone: 'neutral' })
    expect(v.save).toBeNull()
    expect(fuelView(data({ fuelL: 1.8, finish }), ALL_ON, EN).finish?.add.label).toBe('Short')
    // 3.6 L reach it (the margin no longer counts there): spare, in green.
    const enough = fuelStrategy({
      fuelL: 3.6,
      avgL: 3,
      tankL: 85,
      distance: 19.2,
      lapsRemaining: 1,
      marginLaps: 0.5
    })
    const w = fuelView(data({ fuelL: 3.6, lapsOfFuel: 1.2, finish: enough }), ALL_ON, ES)
    expect(w.hero?.tone).toBe('good')
    expect(w.finish?.add).toEqual({ label: 'Sobran', value: '1.2', unit: 'L' })
    expect(w.window).toMatchObject({ stops: 'sin parar', stopsTone: 'good' })
  })

  it('fills the tank when one stop is not enough, and flags a pit menu that falls short', () => {
    const finish = fuelStrategy({
      fuelL: 10,
      avgL: 3,
      tankL: 40,
      distance: 0,
      lapsRemaining: 30,
      marginLaps: 0
    })
    const v = fuelView(data({ fuelL: 10, lapsOfFuel: 3.3, tankL: 40, finish }), ALL_ON, ES)
    expect(v.finish?.add).toEqual({ label: 'Repostar', value: 'LLENO', unit: '' })
    expect(v.finish?.box?.tone).toBe('warn')
    expect(v.window).toMatchObject({ value: 'V1–V3', stops: '3 paradas', tone: 'good' })
    // Need beyond a full tank: no tick on the gauge.
    expect(v.gauge?.need).toBeNull()
    expect(fuelView(data({ boxL: 0 }), ALL_ON, ES).finish?.box).toEqual({
      text: `caja${NB}0${NB}L`,
      tone: 'warn'
    })
    expect(fuelView(data({ boxL: null }), ALL_ON, ES).finish?.box).toBeNull()
    expect(fuelView(data({ boxL: 4.9 }), ALL_ON, ES).finish?.box).toEqual({
      text: `caja${NB}4.9${NB}L`,
      tone: 'good'
    })
    expect(fuelView(data({ boxL: 4.8 }), ALL_ON, ES).finish?.box?.tone).toBe('warn')
  })

  it('marks the window closing on this lap, and the fuel running out', () => {
    const closing: FuelFinish = { ...PREVIEW_FUEL.finish!, lap: 28, window: { from: 28, to: 28 } }
    const v = fuelView(data({ lapsOfFuel: 1.6, finish: closing }), ALL_ON, ES)
    expect(v.window).toMatchObject({ value: 'V28', tone: 'bad' })
    expect(v.hero?.tone).toBe('bad')
    const later: FuelFinish = { ...PREVIEW_FUEL.finish!, window: { from: 24, to: 33 } }
    expect(fuelView(data({ finish: later }), ALL_ON, ES).window?.tone).toBe('neutral')
  })

  it('draws no tyres before a reading and no limits without any', () => {
    const v = fuelView(data({ tyres: null, fastRepairs: null, tyreSets: null }), ALL_ON, ES)
    expect(v.tyres).toBeNull()
    expect(v.limits).toBeNull()
    expect(fuelView(data({ fastRepairs: null }), ALL_ON, ES).limits).toEqual({
      repairs: null,
      sets: { label: 'Juegos', value: '2', unit: '' }
    })
  })

  it('draws nothing without a fuel reading', () => {
    expect(fuelView(data({ visible: false }), ALL_ON, ES)).toBe(EMPTY_VIEW)
    expect(fuelView(data({ fuelL: null }), ALL_ON, ES)).toBe(EMPTY_VIEW)
    expect(linesOf(EMPTY_VIEW)).toEqual([])
  })

  it('takes its options from the defaults (only the header is off)', () => {
    const o = DEFAULT_SETTINGS.fuel
    expect(o.showHeader).toBe(false)
    const v = fuelView(PREVIEW_FUEL, o, ES)
    expect(linesOf(v)).toHaveLength(8)
  })
})

describe('fuelTone', () => {
  it('is good when the fuel reaches the flag, bad under two laps and short', () => {
    expect(fuelTone(7, NO_STOP)).toBe('good')
    expect(fuelTone(1.5, NO_STOP)).toBe('good')
    // The last lap: no stop to make, and short of the flag.
    expect(fuelTone(0.6, { ...NO_STOP, deficitL: 0.6, short: true })).toBe('bad')
    expect(fuelTone(1.5, PREVIEW_FUEL.finish)).toBe('bad')
    expect(fuelTone(1.5, null)).toBe('bad')
    expect(fuelTone(5, PREVIEW_FUEL.finish)).toBe('neutral')
    expect(fuelTone(null, null)).toBe('neutral')
  })
})

describe('windowText', () => {
  it('writes a range, or one lap', () => {
    expect(windowText({ from: 12, to: 15 }, ES)).toBe('V12–V15')
    expect(windowText({ from: 15, to: 15 }, ES)).toBe('V15')
    expect(windowText({ from: 12, to: 15 }, EN)).toBe('L12–L15')
  })
})

describe('reuseParts and layoutKey', () => {
  it('keeps each unchanged line, and the whole view when nothing changed', () => {
    const a = fuelView(PREVIEW_FUEL, ALL_ON, ES)
    const b = fuelView(PREVIEW_FUEL, ALL_ON, ES)
    expect(reuseParts(a, b)).toBe(a)
    const c = reuseParts(a, fuelView(data({ fuelL: 51.9 }), ALL_ON, ES))
    expect(c).not.toBe(a)
    expect(c.hero).not.toBe(a.hero)
    expect(c.tyres).toBe(a.tyres)
    expect(c.window).toBe(a.window)
  })

  it('changes with the lines drawn and the header', () => {
    const a = fuelView(PREVIEW_FUEL, ALL_ON, ES)
    expect(layoutKey(a, false)).toBe('hero,gauge,perLap,finish,window,save,tyres,limits')
    expect(layoutKey(a, true)).toBe('hhero,gauge,perLap,finish,window,save,tyres,limits')
    expect(layoutKey(fuelView(data({ tyres: null }), ALL_ON, ES), false)).not.toBe(
      layoutKey(a, false)
    )
  })
})

describe('PREVIEW_FUEL', () => {
  it('is what the strategy plans for its own figures', () => {
    const plan = fuelStrategy({
      fuelL: PREVIEW_FUEL.fuelL ?? 0,
      avgL: PREVIEW_FUEL.avgL ?? 0,
      tankL: PREVIEW_FUEL.tankL,
      distance: 16.3,
      lapsRemaining: 19,
      marginLaps: 0.5
    })
    expect(plan).toEqual(PREVIEW_FUEL.finish)
    expect(Object.isFrozen(PREVIEW_FUEL)).toBe(true)
  })
})
