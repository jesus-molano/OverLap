/**
 * FuelData to what the fuel widget ('Combustible') draws: a hero line and up to seven short
 * lines. Pure.
 *
 *   38.4 L  12.9 v                         QUEDAN 18.4 v
 *   [===================------------|----]         the tank, marked where you need to be
 *   CONSUMO   2.96 L/v   últ. 3.02 · máx. 3.10
 *   PARA META 54.1 L          REPOSTAR +15.7 L  menú 20 L
 *   VENTANA   V15–V28                     1 parada
 *   AHORRO    2.71 L/v   sin parar
 *   NEUM. V13  DI 78  DD 74  TI 86  TD 82
 *   REPARACIONES 1                         JUEGOS 2
 *
 * The fuel and the laps it lasts are always drawn; every other line is an option and goes when
 * it has nothing to say (no stop: no saving; no tyre reading yet; no session limits). Litres
 * always (the unit is not translated); words come from the dictionary `m` (messagesFor(lang)).
 */
import { elementOrder, isElementVisible } from '@shared/elements'
import { deepEqual } from '@shared/equal'
import { FUEL_ALERT } from '@shared/notices/fuel'
import type { Messages } from '@shared/i18n'
import type { FuelData, FuelFinish, FuelLineId, FuelOptions } from '@shared/types'
import type { Tone } from '@renderer/ui/tones'

const DASH = '—'
/** Litres, in every language. */
export const LITRES = 'L'
/** The pit menu covers what to add when it is at most this short (L, its own rounding). */
const BOX_SLACK_L = 0.05

const fixed = (v: number, decimals: number): string =>
  (Math.round(v * 10 ** decimals) / 10 ** decimals || 0).toFixed(decimals)

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
  /** The laps still to drive ('QUEDAN 18.4 v'), null when unknown. */
  readonly left: ReadingView | null
}

export interface GaugeView {
  /** Fuel over what the tank holds, 0..1. */
  readonly fill: number
  /** Where the fuel to the flag would reach, 0..1; null when unknown or beyond a full tank. */
  readonly need: number | null
  readonly tone: Tone
}

export interface PerLapView extends ReadingView {
  /** 'últ. 3.02 · máx. 3.10', 'de la sesión anterior' or ''. */
  readonly note: string
  readonly measuring: boolean
}

export interface FinishView {
  readonly need: ReadingView
  /** 'REPOSTAR +15.7 L', 'REPOSTAR LLENO', 'SOBRAN 2.3 L' or, on the last lap, 'FALTAN 0.4 L'. */
  readonly add: ReadingView
  readonly addTone: Tone
  /** What the pit menu adds, next to it ('menú 20 L'); null without a stop or unknown. */
  readonly box: { readonly text: string; readonly tone: Tone } | null
}

export interface WindowView extends ReadingView {
  /** bad: it closes on this lap; good: it is open; neutral: not yet, or no stop. */
  readonly tone: Tone
  readonly stops: string
  readonly stopsTone: Tone
}

export interface SaveView extends ReadingView {
  /** What saving that gets you: one stop less ('sin parar'). */
  readonly note: string
}

export interface TyresView {
  readonly label: string
  /** 'V13'. */
  readonly lap: string
  readonly corners: readonly { readonly name: string; readonly value: string }[]
}

export interface LimitsView {
  readonly repairs: ReadingView | null
  readonly sets: ReadingView | null
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
  const box =
    o.showBox && boxL !== null && finite(boxL)
      ? {
          text: f.box(fixed(boxL, boxL % 1 === 0 ? 0 : 1)),
          tone: (boxL + BOX_SLACK_L >= finish.addL ? 'good' : 'warn') as Tone
        }
      : null
  return { need, add, addTone: 'neutral', box }
}

function windowView(finish: FuelFinish, m: Messages): WindowView {
  const f = m.widgets.fuel
  const w = finish.window
  if (finish.stops === 0 || w === null) {
    return {
      label: f.window,
      value: DASH,
      unit: '',
      tone: 'neutral',
      stops: f.noStop,
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
    stops: f.stops(finish.stops),
    stopsTone: 'neutral'
  }
}

function perLapView(d: FuelData, m: Messages): PerLapView {
  const f = m.widgets.fuel
  const last = d.lastL !== null ? f.last(fixed(d.lastL, 2)) : ''
  if (d.avgL === null) {
    return { label: f.use, value: f.measuring, unit: '', note: last, measuring: true }
  }
  const parts = d.carried
    ? [f.carried]
    : [last, d.maxL !== null && d.samples > 1 ? f.max(fixed(d.maxL, 2)) : ''].filter(Boolean)
  return {
    label: f.use,
    value: fixed(d.avgL, 2),
    unit: f.perLap,
    note: parts.join(' · '),
    measuring: false
  }
}

function tyresView(d: FuelData, m: Messages): TyresView | null {
  const t = d.tyres
  if (t === null || !Array.isArray(t.wearPct) || t.wearPct.length !== 4) return null
  const f = m.widgets.fuel
  return {
    label: f.tyres,
    lap: f.readingLap(t.lap),
    corners: t.wearPct.map((v, i) => ({
      name: f.corners[i] ?? '',
      value: finite(v) ? String(Math.round(v)) : DASH
    }))
  }
}

function limitsView(d: FuelData, m: Messages): LimitsView | null {
  const f = m.widgets.fuel
  const repairs =
    d.fastRepairs !== null && finite(d.fastRepairs)
      ? { label: f.repairs, value: String(d.fastRepairs), unit: '' }
      : null
  const sets =
    d.tyreSets !== null && finite(d.tyreSets)
      ? { label: f.sets, value: String(d.tyreSets), unit: '' }
      : null
  return repairs === null && sets === null ? null : { repairs, sets }
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
  const gauge: GaugeView | null =
    o.showGauge && tank !== null && tank > 0
      ? {
          fill: Math.min(1, Math.max(0, d.fuelL / tank)),
          need: finish !== null && finish.needL <= tank ? Math.max(0, finish.needL / tank) : null,
          tone
        }
      : null
  return {
    hero,
    gauge,
    perLap: o.showPerLap ? perLapView(d, m) : null,
    finish: o.showFinish && finish !== null ? finishView(d, finish, o, m) : null,
    window: o.showWindow && finish !== null ? windowView(finish, m) : null,
    save:
      o.showSave && finish !== null && finish.stops > 0 && finish.saveL !== null
        ? {
            label: f.save,
            value: fixed(finish.saveL, 2),
            unit: f.perLap,
            note: finish.stops - 1 === 0 ? f.noStop : f.saveFor(finish.stops - 1)
          }
        : null,
    tyres: o.showTyres ? tyresView(d, m) : null,
    limits: o.showLimits ? limitsView(d, m) : null
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
