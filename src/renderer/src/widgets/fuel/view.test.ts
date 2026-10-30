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
  fuelViewOptions,
  layoutKey,
  linesOf,
  reuseParts,
  sparkOf,
  wearLevel,
  windowText,
  type FuelViewOptions
} from './view'

const ES = messagesFor('es')
const EN = messagesFor('en')
const NB = ' '

const ALL_ON: FuelViewOptions = {
  units: 'metric',
  order: ['hero', 'gauge', 'perLap', 'finish', 'window', 'save', 'tyres', 'limits'],
  showGauge: true,
  showPerLap: true,
  showFinish: true,
  showBox: true,
  showWindow: true,
  showSave: true,
  showTyres: true,
  showLimits: true,
  tyresBeforeReading: true
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
  it('draws every line of the sample, each as a figure and its graphic', () => {
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
      fuelUnit: 'L',
      laps: '17.6',
      lapsUnit: 'v',
      tone: 'neutral',
      note: '',
      left: { label: 'Quedan', value: '18.7', unit: 'v' }
    })
    // The tank in laps of fuel (2.96 L of 85), short of the flag mark.
    expect(v.gauge).toEqual({
      fill: 0.612,
      need: 0.668,
      short: true,
      tone: 'neutral',
      lapStep: 0.0348,
      fiveStep: 0.1741
    })
    expect(v.perLap).toEqual({
      label: 'Consumo',
      value: '2.96',
      unit: 'L/v',
      note: '',
      measuring: false,
      spark: {
        points: '3,13.3 26.5,3 50,16.4 73.5,17 97,7.9',
        avgY: 11.5,
        max: { x: 26.5, y: 3 },
        last: { x: 97, y: 7.9 },
        tail: null
      }
    })
    expect(v.finish).toEqual({
      need: { label: 'Para meta', value: '56.8', unit: 'L' },
      add: { label: 'Repostar', value: '+4.9', unit: 'L' },
      addTone: 'neutral',
      // 20 L in the menu on a bar to 25 L, marked at the 4.9 L to add.
      box: { label: 'Menú', value: '20', unit: 'L', tone: 'good', fill: 0.8, mark: 0.196 }
    })
    // You at lap 16.5 of 35.2, the window from the end of lap 17 to the end of lap 33.
    expect(v.window).toEqual({
      label: 'Ventana',
      value: 'V17–V33',
      unit: '',
      tone: 'good',
      track: { now: 0.469, from: 0.483, to: 0.937 },
      stops: 1,
      stopsText: '1 parada',
      stopsTone: 'neutral'
    })
    // 2.70 on a bar from 2.37 (20 % less) to your 2.96.
    expect(v.save).toEqual({
      label: 'Ahorro',
      value: '2.70',
      unit: 'L/v',
      note: 'sin parar',
      target: 0.561,
      cut: `−9${NB}%`
    })
    expect(v.tyres).toEqual({
      label: 'Neumáticos',
      note: 'última parada · V13',
      shortNote: 'V13',
      measured: true,
      a11y: `Neumáticos: DI 78${NB}%, DD 74${NB}%, TI 86${NB}%, TD 82${NB}%`,
      tyres: [
        { name: 'DI', value: '78', bands: [4, 4, 5] },
        { name: 'DD', value: '74', bands: [4, 3, 3] },
        { name: 'TI', value: '86', bands: [5, 6, 6] },
        { name: 'TD', value: '82', bands: [6, 5, 4] }
      ],
      sets: { label: 'Juegos neum.', value: '2', unit: 'juegos' }
    })
    // The sets are the tyres line's: the limits keep the repairs.
    expect(v.limits).toEqual({
      repairs: { label: 'Rep. rápidas', value: '1', unit: '', pips: 1 },
      sets: null
    })
  })

  it('draws US gallons in imperial, the plan unchanged (R54)', () => {
    const v = fuelView(PREVIEW_FUEL, { ...ALL_ON, units: 'imperial' }, EN)
    const metric = fuelView(PREVIEW_FUEL, ALL_ON, EN)
    // 52.0 L is 13.7 gal; the laps it lasts do not change.
    expect(v.hero).toMatchObject({ fuel: '13.7', fuelUnit: 'gal', laps: metric.hero?.laps })
    expect(v.perLap).toMatchObject({ unit: 'gal/lap' })
    expect(Number(v.perLap?.value)).toBeCloseTo(Number(metric.perLap?.value) / 3.785411784, 2)
    expect(v.finish?.need.unit).toBe('gal')
    expect(v.finish?.add.unit).toBe('gal')
    expect(v.finish?.box).toMatchObject({
      unit: 'gal',
      value: '5.3',
      tone: metric.finish?.box?.tone
    })
    expect(v.save?.unit).toBe('gal/lap')
    // The drawings are fractions: the same in either unit.
    expect(v.gauge).toEqual(metric.gauge)
    expect(fuelView(PREVIEW_FUEL, { ...ALL_ON, units: 'imperial' }, ES).perLap?.unit).toBe('gal/v')
  })

  it('says it in English, with the same figures', () => {
    const v = fuelView(PREVIEW_FUEL, ALL_ON, EN)
    expect(v.hero?.left).toEqual({ label: 'To go', value: '18.7', unit: 'laps' })
    expect(v.finish?.box).toMatchObject({ label: 'Menu', value: '20' })
    expect(v.window).toMatchObject({ value: 'L17–L33', stopsText: '1 stop' })
    expect(v.save).toMatchObject({ note: 'no stop', cut: '−9%' })
    expect(v.tyres).toMatchObject({
      label: 'Tyres',
      note: 'last stop · L13',
      shortNote: 'L13',
      a11y: 'Tyres: FL 78%, FR 74%, RL 86%, RR 82%'
    })
    expect(v.tyres?.tyres.map((c) => c.name)).toEqual(['FL', 'FR', 'RL', 'RR'])
    expect(v.tyres?.sets?.unit).toBe('sets')
    expect(fuelView(data({ tyreSets: 1 }), ALL_ON, EN).tyres?.sets?.unit).toBe('set')
    expect(fuelView(data({ tyreSets: 1 }), ALL_ON, ES).tyres?.sets?.unit).toBe('juego')
  })

  it('leaves out each line with its option; the hero always stays', () => {
    const none: FuelViewOptions = {
      units: 'metric',
      order: ALL_ON.order,
      showGauge: false,
      showPerLap: false,
      showFinish: false,
      showBox: false,
      showWindow: false,
      showSave: false,
      showTyres: false,
      showLimits: false,
      tyresBeforeReading: false
    }
    expect(linesOf(fuelView(PREVIEW_FUEL, none, ES))).toEqual(['hero'])
    for (const k of Object.keys(ALL_ON) as (keyof FuelViewOptions)[]) {
      if (k === 'order' || k === 'units') continue
      const v = fuelView(PREVIEW_FUEL, { ...ALL_ON, [k]: false }, ES)
      if (k === 'showBox') expect(v.finish?.box).toBeNull()
      // Measured tyres are drawn either way.
      else if (k === 'tyresBeforeReading') expect(linesOf(v), k).toHaveLength(8)
      else expect(linesOf(v), k).toHaveLength(7)
    }
  })

  it('says the sets in the limits line when the tyres line is off', () => {
    const v = fuelView(PREVIEW_FUEL, { ...ALL_ON, showTyres: false }, ES)
    expect(v.limits?.sets).toEqual({ label: 'Juegos neum.', value: '2', unit: '', pips: 2 })
    // Past MAX_PIPS a count is a figure alone.
    expect(fuelView(data({ fastRepairs: 9 }), ALL_ON, ES).limits?.repairs?.pips).toBe(0)
  })

  it('measures before it plans', () => {
    const v = fuelView(
      data({
        lapsOfFuel: null,
        avgL: null,
        maxL: null,
        samples: 0,
        recentL: [],
        lastL: 2.9,
        finish: null
      }),
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
      measuring: true,
      spark: null
    })
    expect(linesOf(v)).toEqual(['hero', 'gauge', 'perLap', 'tyres', 'limits'])
    // No flag mark, and no graduations without an average.
    expect(v.gauge).toMatchObject({ need: null, short: false, lapStep: null, fiveStep: null })
  })

  it('says where an estimate from the last session comes from', () => {
    const v = fuelView(data({ carried: true }), ALL_ON, ES)
    expect(v.perLap?.note).toBe('de la sesión anterior')
    const one = fuelView(data({ samples: 1, recentL: [2.96], lastL: null }), ALL_ON, ES)
    expect(one.perLap).toMatchObject({ note: '', spark: null })
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
    // The race to the flag with no window on it.
    expect(v.window).toMatchObject({
      value: '',
      stops: 0,
      stopsText: 'sin parar',
      stopsTone: 'good',
      track: { from: null, to: null }
    })
    expect(v.save).toBeNull()
    expect(v.gauge).toMatchObject({ tone: 'good', short: false })
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
    expect(v.window).toMatchObject({ value: '', stopsText: 'sin parar', stopsTone: 'neutral' })
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
    expect(w.window).toMatchObject({ stopsText: 'sin parar', stopsTone: 'good' })
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
    expect(v.window).toMatchObject({
      value: 'V1–V3',
      stops: 3,
      stopsText: '3 paradas',
      tone: 'good'
    })
    // Need beyond a full tank: no flag mark on the gauge, nothing shaded.
    expect(v.gauge).toMatchObject({ need: null, short: false })
    // An unticked menu: an empty bar, marked where you need it.
    expect(fuelView(data({ boxL: 0 }), ALL_ON, ES).finish?.box).toEqual({
      label: 'Menú',
      value: '0',
      unit: 'L',
      tone: 'warn',
      fill: 0,
      mark: 0.8
    })
    expect(fuelView(data({ boxL: null }), ALL_ON, ES).finish?.box).toBeNull()
    expect(fuelView(data({ boxL: 4.9 }), ALL_ON, ES).finish?.box).toMatchObject({
      value: '4.9',
      tone: 'good',
      fill: 0.8,
      mark: 0.8
    })
    expect(fuelView(data({ boxL: 4.8 }), ALL_ON, ES).finish?.box?.tone).toBe('warn')
  })

  it('marks the window closing on this lap, and the fuel running out', () => {
    const closing: FuelFinish = { ...PREVIEW_FUEL.finish!, lap: 28, window: { from: 28, to: 28 } }
    const v = fuelView(data({ lapsOfFuel: 1.6, finish: closing }), ALL_ON, ES)
    expect(v.window).toMatchObject({ value: 'V28', tone: 'bad' })
    // A one-lap window still has its place on the race, just past you.
    expect(v.window?.track.from).toBe(v.window?.track.to)
    expect(v.window?.track.from).toBeGreaterThan(v.window?.track.now ?? 1)
    expect(v.hero?.tone).toBe('bad')
    const later: FuelFinish = { ...PREVIEW_FUEL.finish!, window: { from: 24, to: 33 } }
    expect(fuelView(data({ finish: later }), ALL_ON, ES).window?.tone).toBe('neutral')
  })

  it('draws the tyres dim before a reading, and no limits without any', () => {
    const v = fuelView(data({ tyres: null, fastRepairs: null, tyreSets: null }), ALL_ON, ES)
    expect(v.tyres).toEqual({
      label: 'Neumáticos',
      note: 'sin lectura · se miden en boxes',
      shortNote: 'sin lectura',
      measured: false,
      a11y: 'Neumáticos: sin lectura · se miden en boxes',
      tyres: ['DI', 'DD', 'TI', 'TD'].map((name) => ({
        name,
        value: '—',
        bands: [null, null, null]
      })),
      sets: null
    })
    expect(v.limits).toBeNull()
    const noTyres = { ...ALL_ON, showTyres: false }
    expect(fuelView(data({ fastRepairs: null }), noTyres, ES).limits).toEqual({
      repairs: null,
      sets: { label: 'Juegos neum.', value: '2', unit: '', pips: 2 }
    })
  })

  it('waits for the reading when the window keeps its own height (auto height off)', () => {
    // As before the redesign: no line to push the others out of a window sized for them.
    const fixed = fuelViewOptions(DEFAULT_SETTINGS.fuel, false)
    expect(fixed.tyresBeforeReading).toBe(false)
    expect(fuelViewOptions(DEFAULT_SETTINGS.fuel).tyresBeforeReading).toBe(true)
    const before = fuelView(data({ tyres: null }), fixed, ES)
    expect(before.tyres).toBeNull()
    expect(linesOf(before, fixed.order)).not.toContain('tyres')
    // The sets are not lost meanwhile: the limits line says them until the car is drawn.
    expect(before.limits?.sets).toMatchObject({ value: '2' })
    const after = fuelView(PREVIEW_FUEL, fixed, ES)
    expect(after.tyres?.measured).toBe(true)
    expect(after.limits?.sets).toBeNull()
  })

  it('draws a reading without its bands in one piece', () => {
    const old = { lap: 4, wearPct: [91, 80, 62, 40] } as unknown as FuelData['tyres']
    const v = fuelView(data({ tyres: old }), ALL_ON, ES)
    expect(v.tyres?.tyres.map((t) => t.bands)).toEqual([
      [6, 6, 6],
      [4, 4, 4],
      [2, 2, 2],
      [0, 0, 0]
    ])
  })

  it('draws nothing without a fuel reading', () => {
    expect(fuelView(data({ visible: false }), ALL_ON, ES)).toBe(EMPTY_VIEW)
    expect(fuelView(data({ fuelL: null }), ALL_ON, ES)).toBe(EMPTY_VIEW)
    expect(linesOf(EMPTY_VIEW)).toEqual([])
  })

  it('takes its options from the defaults (only the header is off)', () => {
    const o = DEFAULT_SETTINGS.fuel
    expect(o.headerBarSize).toBe('off')
    const v = fuelView(PREVIEW_FUEL, fuelViewOptions(o), ES)
    expect(linesOf(v, fuelViewOptions(o).order)).toEqual(linesOf(v))
    expect(linesOf(v)).toHaveLength(8)
  })

  it('draws the lines in the order of fuel.lines, the hidden ones left out', () => {
    const o = fuelViewOptions({
      showBox: true,
      lines: [
        { id: 'finish', visible: true },
        { id: 'hero', visible: true },
        { id: 'gauge', visible: false },
        { id: 'limits', visible: true },
        { id: 'perLap', visible: true },
        { id: 'window', visible: false },
        { id: 'save', visible: true },
        { id: 'tyres', visible: true }
      ]
    })
    const v = fuelView(PREVIEW_FUEL, o, ES)
    expect(linesOf(v, o.order)).toEqual(['finish', 'hero', 'limits', 'perLap', 'save', 'tyres'])
    expect(layoutKey(v, false, o.order)).not.toBe(layoutKey(v, false))
  })

  it('graduates the tank every lap, every five laps when that is too dense, or not at all', () => {
    expect(fuelView(data({ avgL: 0.5, tankL: 100 }), ALL_ON, ES).gauge).toMatchObject({
      lapStep: null,
      fiveStep: 0.025
    })
    expect(fuelView(data({ avgL: 0.1, tankL: 100 }), ALL_ON, ES).gauge).toMatchObject({
      lapStep: null,
      fiveStep: null
    })
    // A lap that takes the whole tank has nothing to divide.
    expect(fuelView(data({ avgL: 90, tankL: 85 }), ALL_ON, ES).gauge?.lapStep).toBeNull()
  })
})

describe('sparkOf', () => {
  it('joins a last lap that was not clean with a dashed tail', () => {
    const s = sparkOf([3, 3.1], 3.4, 3.05, false)
    expect(s?.points).toBe('3,17 50,13.5')
    expect(s?.tail).toEqual({ x: 50, y: 13.5 })
    expect(s?.last).toEqual({ x: 97, y: 3 })
    expect(s?.max).toEqual({ x: 50, y: 13.5 })
  })

  it('keeps a steady run flat, and needs two points', () => {
    // 0.01 L apart on 3 L a lap: within the 4 % floor, near the middle of the box.
    const s = sparkOf([3, 3.01], 3.01, 3.005, true)
    expect(s?.avgY).toBe(10)
    expect(Math.abs((s?.last?.y ?? 0) - 10)).toBeLessThan(2)
    expect(sparkOf([3], 3, 3, true)).toBeNull()
    expect(sparkOf([], 3, 3, false)).toBeNull()
    expect(sparkOf([3], 3.2, 3, false)).toMatchObject({ points: '3,17', tail: { x: 3, y: 17 } })
  })

  it('tells a last lap that was not clean by the lap, not by its litres', () => {
    // A caution lap that burnt just what the newest clean one did is still drawn apart.
    const caution = sparkOf([3, 3.1], 3.1, 3.05, false)
    expect(caution?.tail?.x).toBe(50)
    expect(caution?.last).toEqual({ x: 97, y: caution?.tail?.y })
    // The newest clean lap itself: its own point, no tail.
    const clean = sparkOf([3, 3.1], 3.1, 3.05, true)
    expect(clean?.tail).toBeNull()
    expect(clean?.last?.x).toBe(97)
    expect(clean?.points.split(' ')).toHaveLength(2)
    // Clean but nothing to be the newest of (another car's laps went): apart.
    expect(sparkOf([], 3.1, 3.05, true)).toBeNull()
  })
})

describe('wearLevel', () => {
  it('steps finely near new and coarsely when worn', () => {
    expect([100, 96, 95, 92, 88, 84, 83, 78, 70, 60, 50, 49, 0].map(wearLevel)).toEqual([
      8, 8, 7, 7, 6, 5, 4, 4, 3, 2, 1, 0, 0
    ])
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
    // The tyres are drawn dim before a reading: one arriving does not move the panel.
    expect(layoutKey(fuelView(data({ tyres: null }), ALL_ON, ES), false)).toBe(layoutKey(a, false))
    const bare = fuelView(data({ tyreSets: null, fastRepairs: null }), ALL_ON, ES)
    expect(layoutKey(bare, false)).not.toBe(layoutKey(a, false))
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
