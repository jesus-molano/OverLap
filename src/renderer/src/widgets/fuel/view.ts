/**
 * FuelData to what the fuel widget ('Combustible') draws: a hero line and up to seven lines,
 * each one figure and one small graphic rather than a row of words. Pure.
 *
 *   17.6 v  52.0 L                                   [flag] 18.7 v
 *   [=========|=========|====////|------]   the tank in laps of fuel; the flag mark: what you need
 *   CONSUMO 2.96 L/v  ~~~~~~~~~~~~~~~~~~·   the laps behind the average: avg, max and last marked
 *   REPOSTAR +4.9 L  MENÚ [====|=====] 20          [flag] 56.8 L
 *   VENTANA  [---====V====---------[flag]]   V17–V33   [P] 1
 *   AHORRO   2.70 L/v  [=======|//]  −9 %               sin parar
 *    78 [▮▮] [▮▮] 74        NEUMÁTICOS
 *    86 [▮▮] [▮▮] 82        última parada · V13   2 juegos
 *   REP. RÁPIDAS 1 ■
 *
 * The fuel and the laps it lasts are always drawn; every other line is an option and goes when
 * it has nothing to say (no stop: no saving; no session limits), except the tyres, drawn dim
 * until a stop measures them so the panel does not jump when one does. Geometry is worked out
 * here (fractions of a track, a sparkline in a 100 x 20 box, a wear level per band), so the
 * component only binds it. Litres always (the unit is not translated); words come from `m`.
 */
import { elementOrder, isElementVisible } from '@shared/elements'
import { deepEqual } from '@shared/equal'
import { FUEL_STRATEGY } from '@shared/fuel/strategy'
import { FUEL_ALERT } from '@shared/notices/fuel'
import type { Messages } from '@shared/i18n'
import type { FuelData, FuelFinish, FuelLineId, FuelOptions } from '@shared/types'
import type { Tone } from '@renderer/ui/tones'

const DASH = '—'
/** Litres, in every language. */
export const LITRES = 'L'
/** The pit menu covers what to add when it is at most this short (L, its own rounding). */
const BOX_SLACK_L = 0.05
/** Tank graduations closer than this (fraction of the tank) are noise: one every 5 laps, or none. */
const MIN_TICK = 0.012
/** The pit menu's bar reaches this much past the larger of the menu and what to add. */
const BOX_HEADROOM = 1.25
/** Most pips drawn for a count left (repairs); more is a number alone. */
export const MAX_PIPS = 5
/** The sparkline's box (user units); the dots are drawn in screen pixels (non-scaling). */
export const SPARK_W = 100
export const SPARK_H = 20
const SPARK_PAD = 3
/** A sparkline never spreads less than this share of the average top to bottom: flat is flat. */
const SPARK_MIN_SPAN = 0.04

const fixed = (v: number, decimals: number): string =>
  (Math.round(v * 10 ** decimals) / 10 ** decimals || 0).toFixed(decimals)
/** Fractions kept to 0.001, so a view built twice from the same data is equal. */
const frac = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000
const coord = (v: number): number => Math.round(v * 10) / 10

/** A reading: caption, figures and unit ('' when it has none). */
export interface ReadingView {
  readonly label: string
  readonly value: string
  readonly unit: string
}

export interface HeroView {
  readonly fuel: string
  /** Laps the fuel lasts, '—' while measuring. */
  readonly laps: string
  readonly lapsUnit: string
  /** good: it reaches the flag; bad: under two laps and short; neutral otherwise. */
  readonly tone: Tone
  /** 'midiendo…' while no clean lap is measured and the consumption line is off, else ''. */
  readonly note: string
  /** The laps still to drive, after a chequered flag (its label is the flag's name), or null. */
  readonly left: ReadingView | null
}

export interface GaugeView {
  /** Fuel over what the tank holds, 0..1. */
  readonly fill: number
  /** Where the fuel to the flag would reach, 0..1; null when unknown or beyond a full tank. */
  readonly need: number | null
  /** The fuel falls short of `need`: the gap between them is shaded. */
  readonly short: boolean
  readonly tone: Tone
  /** One lap of fuel as a share of the tank (a graduation per lap), null when too dense. */
  readonly lapStep: number | null
  /** Five laps of fuel (a stronger graduation), null when too dense or unknown. */
  readonly fiveStep: number | null
}

/** A dot of the sparkline, in its 100 x 20 box. */
export interface SparkDot {
  readonly x: number
  readonly y: number
}

export interface SparkView {
  /** The clean laps, oldest to newest: an SVG polyline's points. */
  readonly points: string
  /** The average's height. */
  readonly avgY: number
  /** The thirstiest lap, null with a single lap. */
  readonly max: SparkDot | null
  /** Your last lap: the newest point, or a point of its own past them when it was not clean. */
  readonly last: SparkDot | null
  /** The last lap is not one of the clean ones: joined to the newest of them (here) dashed. */
  readonly tail: SparkDot | null
}

export interface PerLapView extends ReadingView {
  /** 'de la sesión anterior', or the last lap while measuring ('últ. 2.90'); else ''. */
  readonly note: string
  readonly measuring: boolean
  readonly spark: SparkView | null
}

/** The pit menu against what to add: a bar filled to the menu, marked where you need it. */
export interface BoxView {
  readonly label: string
  readonly value: string
  readonly tone: Tone
  /** The menu's litres and what to add, 0..1 of the bar. */
  readonly fill: number
  readonly mark: number
}

export interface FinishView {
  /** The fuel to the flag (after a flag; the label is its name). */
  readonly need: ReadingView
  /** 'REPOSTAR +15.7 L', 'REPOSTAR LLENO', 'SOBRAN 2.3 L' or, on the last lap, 'FALTAN 0.4 L'. */
  readonly add: ReadingView
  readonly addTone: Tone
  readonly box: BoxView | null
}

/** The race as a line: where you are, and the laps you can stop at the end of. */
export interface TrackView {
  /** You, 0..1 of the race. */
  readonly now: number
  /** The window, 0..1 of the race; null without a stop. */
  readonly from: number | null
  readonly to: number | null
}

export interface WindowView extends ReadingView {
  /** bad: it closes on this lap; good: it is open; neutral: not yet, or no stop. */
  readonly tone: Tone
  readonly track: TrackView
  /** Stops still needed: drawn as a pit sign and a count; 0 says `stopsText`. */
  readonly stops: number
  /** '1 parada', 'sin parar' (the pit sign's name, or the words when there is none). */
  readonly stopsText: string
  readonly stopsTone: Tone
}

export interface SaveView extends ReadingView {
  /** What saving that gets you: one stop less ('sin parar'). */
  readonly note: string
  /**
   * The target on a bar from twice the most saving offered (left) to your average (right), 0..1:
   * a cut within reach never reaches the left half.
   */
  readonly target: number
  /** How much less per lap: '−9 %'. */
  readonly cut: string
}

/** Tread left on the colour ramp: 8 fresh .. 0 spent. */
export type WearLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

/**
 * The least tread of each level, 8 down to 1 (under the last: 0). Fine steps near new, where a
 * stint moves the tread a few % and the bands of one tyre differ by a few more; coarse ones
 * below, where every step is a warning.
 */
const WEAR_STEPS = [96, 92, 88, 84, 78, 70, 60, 50] as const

export interface TyreView {
  /** 'DI': its name, for the accessible label. */
  readonly name: string
  /** The most worn band, whole % ('78'), '—' without a reading. */
  readonly value: string
  /** Its left, middle and right band; null without a reading. */
  readonly bands: readonly [WearLevel | null, WearLevel | null, WearLevel | null]
}

export interface TyresView {
  readonly label: string
  /** 'última parada · V13', or that nothing was measured yet. */
  readonly note: string
  readonly measured: boolean
  /** Front left, front right, rear left, rear right. */
  readonly tyres: readonly [TyreView, TyreView, TyreView, TyreView]
  /** Dry sets left when the session limits them ('2 juegos'), else null. */
  readonly sets: ReadingView | null
}

export interface CountView extends ReadingView {
  /** One pip per unit left when there are at most MAX_PIPS, else 0. */
  readonly pips: number
}

export interface LimitsView {
  readonly repairs: CountView | null
  /** Null when the tyres line is drawn: the sets are said there. */
  readonly sets: CountView | null
}

export interface FuelView {
  readonly hero: HeroView | null
  readonly gauge: GaugeView | null
  readonly perLap: PerLapView | null
  readonly finish: FinishView | null
  readonly window: WindowView | null
  readonly save: SaveView | null
  readonly tyres: TyresView | null
  readonly limits: LimitsView | null
}

/**
 * The drawing options of the view (the header is the widget's; the rest is the provider's): the
 * lines shown and their order (fuel.lines), the box flag.
 */
export interface FuelViewOptions {
  /** The lines top to bottom, as the user put them (fuel.lines; the hero always shown). */
  readonly order: readonly LineId[]
  readonly showGauge: boolean
  readonly showPerLap: boolean
  readonly showFinish: boolean
  readonly showBox: FuelOptions['showBox']
  readonly showWindow: boolean
  readonly showSave: boolean
  readonly showTyres: boolean
  readonly showLimits: boolean
}

/** The view's options from the widget's (its lines list and the box flag). */
export function fuelViewOptions(o: Pick<FuelOptions, 'lines' | 'showBox'>): FuelViewOptions {
  const shown = (id: FuelLineId): boolean => isElementVisible(o.lines, id)
  return {
    order: elementOrder(o.lines),
    showGauge: shown('gauge'),
    showPerLap: shown('perLap'),
    showFinish: shown('finish'),
    showBox: o.showBox,
    showWindow: shown('window'),
    showSave: shown('save'),
    showTyres: shown('tyres'),
    showLimits: shown('limits')
  }
}

export const EMPTY_VIEW: FuelView = Object.freeze({
  hero: null,
  gauge: null,
  perLap: null,
  finish: null,
  window: null,
  save: null,
  tyres: null,
  limits: null
})

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** The fuel lasts to the flag (good), is short and under two laps (bad), or neither. */
export function fuelTone(lapsOfFuel: number | null, finish: FuelFinish | null): Tone {
  if (finish !== null && finish.stops === 0 && !finish.short) return 'good'
  if (lapsOfFuel !== null && lapsOfFuel < FUEL_ALERT.lowLaps) return 'bad'
  return 'neutral'
}

/** 'V24–V28', 'V24' for a one-lap window. */
export function windowText(w: { from: number; to: number }, m: Messages): string {
  const f = m.widgets.fuel
  return w.from >= w.to ? f.window1(w.to) : f.windowN(w.from, w.to)
}

/** Tread left (whole %) to its level on the colour ramp (WEAR_STEPS). */
export function wearLevel(pct: number): WearLevel {
  const i = WEAR_STEPS.findIndex((least) => pct >= least)
  return (i < 0 ? 0 : WEAR_STEPS.length - i) as WearLevel
}

/** The graduations of a tank: a lap's share of it, and five laps', each null when too dense. */
function steps(avgL: number | null, tank: number): Pick<GaugeView, 'lapStep' | 'fiveStep'> {
  if (avgL === null || !(avgL > 0)) return { lapStep: null, fiveStep: null }
  const lap = avgL / tank
  const five = lap * 5
  return {
    lapStep: lap >= MIN_TICK && lap < 1 ? Math.round(lap * 10000) / 10000 : null,
    fiveStep: five >= MIN_TICK && five < 1 ? Math.round(five * 10000) / 10000 : null
  }
}

/**
 * The consumption's sparkline: the clean laps (oldest first) and the last lap, scaled to the
 * 100 x 20 box with a floor on the spread, so a steady run draws flat. Null with fewer than two
 * points to join.
 */
export function sparkOf(
  recent: readonly number[],
  lastL: number | null,
  avgL: number
): SparkView | null {
  const clean = recent.filter(finite)
  const newest = clean[clean.length - 1]
  const lastApart = lastL !== null && finite(lastL) && newest !== lastL
  const all = lastApart ? [...clean, lastL] : clean
  if (all.length < 2) return null
  let lo = Math.min(avgL, ...all)
  let hi = Math.max(avgL, ...all)
  const floor = avgL * SPARK_MIN_SPAN
  if (hi - lo < floor) {
    const mid = (hi + lo) / 2
    lo = mid - floor / 2
    hi = mid + floor / 2
  }
  const x = (i: number): number =>
    coord(SPARK_PAD + (i / (all.length - 1)) * (SPARK_W - 2 * SPARK_PAD))
  const y = (v: number): number =>
    coord(SPARK_H - SPARK_PAD - ((v - lo) / (hi - lo)) * (SPARK_H - 2 * SPARK_PAD))
  let maxI = -1
  if (clean.length > 1) {
    maxI = 0
    for (let i = 1; i < clean.length; i++) if ((clean[i] ?? 0) > (clean[maxI] ?? 0)) maxI = i
  }
  const lastI = lastL === null ? -1 : all.length - 1
  return {
    points: clean.map((v, i) => `${x(i)},${y(v)}`).join(' '),
    avgY: y(avgL),
    max: maxI < 0 ? null : { x: x(maxI), y: y(clean[maxI] ?? avgL) },
    last: lastI < 0 ? null : { x: x(lastI), y: y(all[lastI] ?? avgL) },
    tail: lastApart && newest !== undefined ? { x: x(clean.length - 1), y: y(newest) } : null
  }
}

function finishView(d: FuelData, finish: FuelFinish, o: FuelViewOptions, m: Messages): FinishView {
  const f = m.widgets.fuel
  const need: ReadingView = { label: f.need, value: fixed(finish.needL, 1), unit: LITRES }
  if (finish.stops === 0) {
    // On the last lap no stop is left: short of the flag is all there is to say.
    return finish.short
      ? {
          need,
          add: { label: f.short, value: fixed(Math.max(0, finish.deficitL), 1), unit: LITRES },
          addTone: 'bad',
          box: null
        }
      : {
          need,
          add: { label: f.spare, value: fixed(Math.max(0, -finish.deficitL), 1), unit: LITRES },
          addTone: 'good',
          box: null
        }
  }
  const add: ReadingView = finish.fill
    ? { label: f.add, value: f.fill, unit: '' }
    : { label: f.add, value: `+${fixed(finish.addL, 1)}`, unit: LITRES }
  const boxL = d.boxL
  let box: BoxView | null = null
  if (o.showBox && boxL !== null && finite(boxL)) {
    const scale = Math.max(boxL, finish.addL, 1) * BOX_HEADROOM
    box = {
      label: f.menu,
      value: fixed(boxL, boxL % 1 === 0 ? 0 : 1),
      tone: boxL + BOX_SLACK_L >= finish.addL ? 'good' : 'warn',
      fill: frac(boxL / scale),
      mark: frac(finish.addL / scale)
    }
  }
  return { need, add, addTone: 'neutral', box }
}

/** The race from its start to the flag: you at the middle of the lap in progress. */
function trackOf(finish: FuelFinish): TrackView {
  const now = Math.max(0, finish.lap - 0.5)
  const end = now + Math.max(0, finish.lapsLeft)
  const w = finish.stops > 0 ? finish.window : null
  if (!(end > 0)) return { now: 1, from: null, to: null }
  return {
    now: frac(now / end),
    // Stopping at the end of lap n is being at distance n.
    from: w === null ? null : frac(w.from / end),
    to: w === null ? null : frac(w.to / end)
  }
}

function windowView(finish: FuelFinish, m: Messages): WindowView {
  const f = m.widgets.fuel
  const w = finish.window
  const track = trackOf(finish)
  if (finish.stops === 0 || w === null) {
    return {
      label: f.window,
      value: '',
      unit: '',
      tone: 'neutral',
      track,
      stops: 0,
      stopsText: f.noStop,
      // No stop left on the last lap is no good news when the fuel falls short.
      stopsTone: finish.short ? 'neutral' : 'good'
    }
  }
  const tone: Tone = w.to <= finish.lap ? 'bad' : w.from <= finish.lap ? 'good' : 'neutral'
  return {
    label: f.window,
    value: windowText(w, m),
    unit: '',
    tone,
    track,
    stops: finish.stops,
    stopsText: f.stops(finish.stops),
    stopsTone: 'neutral'
  }
}

function perLapView(d: FuelData, m: Messages): PerLapView {
  const f = m.widgets.fuel
  if (d.avgL === null) {
    const last = d.lastL !== null ? f.last(fixed(d.lastL, 2)) : ''
    return { label: f.use, value: f.measuring, unit: '', note: last, measuring: true, spark: null }
  }
  return {
    label: f.use,
    value: fixed(d.avgL, 2),
    unit: f.perLap,
    note: d.carried ? f.carried : '',
    measuring: false,
    spark: sparkOf(d.recentL, d.lastL, d.avgL)
  }
}

function saveView(d: FuelData, finish: FuelFinish, m: Messages): SaveView | null {
  const saveL = finish.saveL
  const avg = d.avgL
  if (finish.stops === 0 || saveL === null || avg === null || !(avg > 0)) return null
  const f = m.widgets.fuel
  const least = avg * (1 - 2 * FUEL_STRATEGY.saveReach)
  return {
    label: f.save,
    value: fixed(saveL, 2),
    unit: f.perLap,
    note: finish.stops - 1 === 0 ? f.noStop : f.saveFor(finish.stops - 1),
    target: frac((saveL - least) / (avg - least)),
    cut: f.cut(Math.max(0, Math.round(((avg - saveL) / avg) * 100)))
  }
}

const NO_BANDS = [null, null, null] as const

function tyresView(d: FuelData, m: Messages, sets: ReadingView | null): TyresView {
  const f = m.widgets.fuel
  const t = d.tyres
  const ok = t !== null && Array.isArray(t.wearPct) && t.wearPct.length === 4
  const tyres = [0, 1, 2, 3].map((i): TyreView => {
    const name = f.corners[i] ?? ''
    const v = ok ? t.wearPct[i] : undefined
    if (!finite(v)) return { name, value: DASH, bands: NO_BANDS }
    const b = t?.bands?.[i]
    const bands =
      Array.isArray(b) && b.length === 3 && b.every(finite)
        ? (b.map(wearLevel) as unknown as TyreView['bands'])
        : ([wearLevel(v), wearLevel(v), wearLevel(v)] as const)
    return { name, value: String(Math.round(v)), bands }
  }) as unknown as TyresView['tyres']
  return {
    label: f.tyres,
    note: ok ? f.readingAt(t.lap) : f.noReading,
    measured: ok,
    tyres,
    sets
  }
}

function countOf(label: string, n: number | null, unit = ''): CountView | null {
  if (n === null || !finite(n)) return null
  return { label, value: String(n), unit, pips: n >= 0 && n <= MAX_PIPS ? n : 0 }
}

/** What to draw. */
export function fuelView(d: FuelData, o: FuelViewOptions, m: Messages): FuelView {
  if (!d.visible || d.fuelL === null) return EMPTY_VIEW
  const f = m.widgets.fuel
  const finish = d.finish
  const tone = fuelTone(d.lapsOfFuel, finish)
  const hero: HeroView = {
    fuel: fixed(d.fuelL, 1),
    laps: d.lapsOfFuel === null ? DASH : fixed(d.lapsOfFuel, 1),
    lapsUnit: f.laps,
    tone,
    // The consumption line says it when it is drawn.
    note: d.lapsOfFuel === null && !o.showPerLap ? f.measuring : '',
    left: finish === null ? null : { label: f.left, value: fixed(finish.lapsLeft, 1), unit: f.laps }
  }
  const tank = d.tankL
  let gauge: GaugeView | null = null
  if (o.showGauge && tank !== null && tank > 0) {
    const fill = frac(d.fuelL / tank)
    const need = finish !== null && finish.needL <= tank ? frac(finish.needL / tank) : null
    gauge = { fill, need, short: need !== null && need > fill, tone, ...steps(d.avgL, tank) }
  }
  // The sets are the tyres' when that line is drawn (one place for each figure).
  const setsCount = o.showTyres ? null : d.tyreSets
  const limits = o.showLimits
    ? {
        repairs: countOf(f.repairs, d.fastRepairs),
        sets: countOf(f.sets, setsCount)
      }
    : null
  return {
    hero,
    gauge,
    perLap: o.showPerLap ? perLapView(d, m) : null,
    finish: o.showFinish && finish !== null ? finishView(d, finish, o, m) : null,
    window: o.showWindow && finish !== null ? windowView(finish, m) : null,
    save: o.showSave && finish !== null ? saveView(d, finish, m) : null,
    tyres: o.showTyres
      ? tyresView(
          d,
          m,
          d.tyreSets !== null && finite(d.tyreSets)
            ? {
                label: f.sets,
                value: String(d.tyreSets),
                unit: d.tyreSets === 1 ? f.setOne : f.setMany
              }
            : null
        )
      : null,
    limits: limits === null || (limits.repairs === null && limits.sets === null) ? null : limits
  }
}

/**
 * `next` with every part equal to the one of `prev` replaced by that previous object, so the
 * components of an unchanged part see the same props; `prev` itself when nothing changed at all.
 * (No v-memo on the lines: each is a v-if in WidgetPanel's slot, see ui/memoSafety.test.ts.)
 */
export function reuseParts(prev: FuelView | undefined, next: FuelView): FuelView {
  if (prev === undefined) return next
  const out: Record<string, unknown> = {}
  let same = true
  for (const key of Object.keys(next) as (keyof FuelView)[]) {
    const p = prev[key]
    const n = next[key]
    const keep = p === n || deepEqual(p, n)
    out[key] = keep ? p : n
    if (!keep) same = false
  }
  return same ? prev : (out as unknown as FuelView)
}

/** The view's lines (fuel.lines' ids). */
export type LineId = FuelLineId

const LINES: readonly LineId[] = [
  'hero',
  'gauge',
  'perLap',
  'finish',
  'window',
  'save',
  'tyres',
  'limits'
]

/**
 * The view's lines with something to draw, top to bottom in `order` (fuel.lines; the default
 * order when not given), an empty list: nothing to draw.
 */
export function linesOf(v: FuelView, order: readonly LineId[] = LINES): LineId[] {
  return order.filter((id) => v[id] !== null)
}

/** Changes whenever the panel's height can (useReveal): which lines are drawn. */
export function layoutKey(v: FuelView, header: boolean, order?: readonly LineId[]): string {
  return `${header ? 'h' : ''}${linesOf(v, order).join(',')}`
}
