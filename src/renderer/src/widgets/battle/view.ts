/**
 * BattleData to what each lane of the battle widget shows (ux §5). Pure. Tones always come with
 * a shape or words (chevron, icon, sign, 'te alcanza'), never colour alone.
 *
 * Which rows a lane has depends on the options only, never on the data: a lane with nothing to
 * say on a row keeps the row (blank or with '—' chips), so the content never jumps and an
 * auto-height window does not resize every time a prediction comes and goes.
 *
 * Words come from the dictionary `m` (messagesFor(lang)); the examples are the Spanish ones.
 */
import type { BrandId } from '@shared/carBrands'
import { NBSP, formatGap, formatLaps, formatTrend, signAt } from '@shared/format'
import type { Messages } from '@shared/i18n'
import type {
  CarPenalty,
  BattleData,
  BattleGapStyle,
  BattleLaneId,
  BattleOpponent,
  BattleOptions,
  BattlePartId,
  BattlePredictionId,
  BattleRowId,
  NameFormat
} from '@shared/types'
import type { IconName } from '@renderer/ui/icons'
import type { Tone } from '@renderer/ui/tones'
import { toDriverCell, type DriverCellView } from '@renderer/view/driverCell'
import type { DriverStyles } from '@renderer/view/styles'

export type BattleSide = BattleLaneId

/**
 * The rival's driver cell: the shared cell plus what this widget adds to it. `brand` and
 * `country` are present only when drawn (DriverCell draws a slot for each one given).
 */
export interface LaneDriverView extends DriverCellView {
  readonly brand?: BrandId
  readonly country?: string
  /** The rival's iRating after the name (battle.parts 'rating'; never side by side). */
  readonly withRating: boolean
  /** The rival's licence after the name (battle.parts 'license'). */
  readonly withLicense: boolean
  /** Its flag badge after the name, while the «Piloto» block shows them (null: none). */
  readonly penalty: CarPenalty | null
}

/** The hero gap split in number and unit ('0.6' + 's'; '1:05' needs no unit). */
export interface GapView {
  readonly value: string
  readonly unit: string
}

export interface TrendView {
  /** Chevron in the trend's direction, null when stable or unknown. */
  readonly icon: IconName | null
  /** '+0.15 s/v' */
  readonly text: string
  /** 'le recortas', 'midiendo…' */
  readonly note: string
  readonly tone: Tone
}

/** The catch prediction: icon + verdict + muted numbers ('Le alcanzas en ~4 v' 'de 19'). */
export interface CatchView {
  /** Which saying it is (battle.prediction: its eye, and the preview's data-el). */
  readonly kind: BattlePredictionId
  readonly icon: IconName
  readonly text: string
  readonly note: string
  readonly tone: Tone
}

export interface DeltaChipView {
  readonly label: string
  /** '+0.12', '—' when unknown. */
  readonly text: string
  readonly tone: Tone
}

export interface LaneView {
  readonly side: BattleSide
  readonly carIdx: number
  readonly tag: string
  readonly tagIcon: IconName
  readonly driver: LaneDriverView
  /** On pit road or in the stall: the lane is dimmed, with a PIT badge after the name. */
  readonly inPits: boolean
  readonly gap: GapView
  readonly trend: TrendView
  /**
   * The trend's tone (dim while unknown or in the pits). Only good and bad draw the lane's rail:
   * a neutral or dim lane has none.
   */
  readonly tone: Tone
  /** iRating at stake ('±17'), null when hidden or unknown. */
  readonly stake: string | null
  /** Null: nothing to say this time (the row stays, blank). */
  readonly catch: CatchView | null
  /** Last lap of the race: the catch row shows ÚLTIMA VUELTA instead. */
  readonly lastLap: boolean
  /** Sector deltas (+ = you were faster), null when battle.rows hides the row. */
  readonly sectors: readonly DeltaChipView[] | null
  /** Lap deltas V-1..V-3, null when battle.rows hides the row. */
  readonly laps: readonly DeltaChipView[] | null
}

/** The options a lane reads (display side; the provider also skips what is off). */
export interface LaneOptions {
  /** The rows under the headline, top to bottom (battle.rows' shown ids, in order). */
  readonly rows: readonly BattleRowId[]
  /** What the lane adds to the rival (battle.parts). */
  readonly parts: Readonly<Record<BattlePartId, boolean>>
  /** The car's make before the name (brandMarksOn(battle.brandMarks, multiBrand)). */
  readonly brand: boolean
  /** The driver's flag before the name (the «Piloto» block's countryFlags). */
  readonly flag: boolean
  /** The black flag, meatball and furled flag badges (the «Piloto» block's showFlags). */
  readonly penalties: boolean
  readonly nameFormat: NameFormat
  /** What the prediction row may say (battle.prediction); every saying when absent. */
  readonly prediction?: Readonly<Record<BattlePredictionId, boolean>>
  /** The big gap: measured and unsigned (absent too), or Relativo's signed time. */
  readonly gapStyle?: BattleGapStyle
}

/** Every saying of the prediction row shown (battle.prediction's default). */
export const ALL_PREDICTIONS: Readonly<Record<BattlePredictionId, boolean>> = Object.freeze({
  catchIn: true,
  caughtIn: true,
  need: true,
  noCatch: true
})

/** battle.prediction as one flag per saying. */
export function predictionParts(
  shown: (id: BattlePredictionId) => boolean
): Readonly<Record<BattlePredictionId, boolean>> {
  return {
    catchIn: shown('catchIn'),
    caughtIn: shown('caughtIn'),
    need: shown('need'),
    noCatch: shown('noCatch')
  }
}

/** The rows every lane has with these options. */
export interface LaneRows {
  /** The rows drawn under the headline, top to bottom (each once). */
  readonly order: readonly BattleRowId[]
  readonly catch: boolean
  readonly sectors: boolean
  readonly laps: boolean
}

/** 'stack': one lane per row; 'side': two lanes side by side. */
export type Arrangement = 'stack' | 'side'

export const LAP_CHIPS = 3
const DASH = '—'

const TAG_ICONS: Readonly<Record<BattleSide, IconName>> = {
  ahead: 'arrow-up',
  behind: 'arrow-down'
}

/** Trend note: + is in your favour on both sides. */
function trendNote(side: BattleSide, good: boolean, m: Messages): string {
  const t = m.widgets.battle
  if (side === 'ahead') return good ? t.aheadGood : t.aheadBad
  return good ? t.behindGood : t.behindBad
}

const finite = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v)

const toneOf = (v: number | null, decimals: number): Tone => {
  const s = signAt(v, decimals)
  return s === null ? 'dim' : s > 0 ? 'good' : s < 0 ? 'bad' : 'neutral'
}

/** The rows a lane draws, in the order given (a repeated id counts once). */
export function laneRows(rows: readonly BattleRowId[]): LaneRows {
  const order = rows.filter((r, i) => rows.indexOf(r) === i)
  return {
    order,
    catch: order.includes('prediction'),
    sectors: order.includes('sectors'),
    laps: order.includes('laps')
  }
}

/** battle.parts as one flag per part. */
export function laneParts(
  shown: (id: BattlePartId) => boolean
): Readonly<Record<BattlePartId, boolean>> {
  return {
    rating: shown('rating'),
    license: shown('license'),
    trendNote: shown('trendNote'),
    stake: shown('stake')
  }
}

/** Narrower than this (em of the widget font, ~520 px at 13 px), two lanes side by side are cramped. */
export const SIDE_MIN_EM = 40

/**
 * Side by side only when asked for, with two lanes and room for them (else stacked); one lane
 * always spans the panel. `widthEm` unknown (not measured yet) honours the option.
 */
export function arrangement(
  layout: BattleOptions['layout'],
  lanes: number,
  widthEm = Infinity
): Arrangement {
  return layout === 'side' && lanes > 1 && widthEm >= SIDE_MIN_EM ? 'side' : 'stack'
}

/**
 * The big gap: measured and unsigned ('0.6' + 's'), or with `relative` the signed time of the
 * Relativo widget exactly as its gap column draws it ('0.6' ahead, '−0.6' behind: formatGap, no
 * unit).
 */
export function gapView(gapS: number | null, relative = false): GapView {
  if (!finite(gapS)) return { value: DASH, unit: '' }
  if (relative) return { value: formatGap(gapS), unit: '' }
  const g = formatGap(Math.abs(gapS))
  return g.includes(':') ? { value: g, unit: '' } : { value: g, unit: 's' }
}

/**
 * «Como Relativo»: Relativo's time for that car; while it has none (no estimate for one of the
 * two cars), the measured gap with the lane's sign, rather than «—».
 */
export function relativeGapView(op: BattleOpponent, side: BattleSide): GapView {
  if (finite(op.relativeGapS)) return gapView(op.relativeGapS, true)
  if (!finite(op.gapS)) return gapView(null, true)
  const g = Math.abs(op.gapS)
  return gapView(side === 'ahead' ? g : -g, true)
}

export function trendView(trend: number | null, side: BattleSide, m: Messages): TrendView {
  const t = m.widgets.battle
  const sign = signAt(trend, 2)
  if (sign === null || trend === null) {
    return { icon: null, text: t.perLap(DASH), note: t.measuring, tone: 'dim' }
  }
  if (sign === 0) {
    return { icon: null, text: t.perLap(`=${NBSP}0.00`), note: t.steady, tone: 'neutral' }
  }
  const good = sign > 0
  return {
    icon: good ? 'arrow-up' : 'arrow-down',
    text: t.perLap(formatTrend(trend)),
    note: trendNote(side, good, m),
    tone: good ? 'good' : 'bad'
  }
}

/** Laps left as 'de 19' (rounded, at least 1); '' when unknown. */
function ofLaps(lapsRemaining: number | null, m: Messages): string {
  return finite(lapsRemaining) && lapsRemaining > 0
    ? m.widgets.battle.ofLaps(Math.max(1, Math.round(lapsRemaining)))
    : ''
}

/** True on the race's last lap (lapsRemaining counts the current lap). */
export function isLastLap(lapsRemaining: number | null): boolean {
  return finite(lapsRemaining) && lapsRemaining > 0 && lapsRemaining <= 1
}

/**
 * The prediction line (ux §5.3 and confirmed semantics#7):
 * - catching in time: 'Le alcanzas en ~4 v' / 'Te alcanza en ~4 v', 'de 19';
 * - closing, but not before the finish: the pace you need ('Necesitas +0.24 s/v', with
 *   'a este ritmo ~12 v de 5') or 'No le alcanzas'; behind, 'No te alcanza';
 * - ahead and not closing: the pace you need, when it is known.
 * Null when there is nothing to say (trend unknown, opponent in the pits, behind not closing).
 */
export function catchView(
  op: BattleOpponent,
  side: BattleSide,
  lapsRemaining: number | null,
  m: Messages,
  shown: Readonly<Record<BattlePredictionId, boolean>> = ALL_PREDICTIONS
): CatchView | null {
  const v = catchSaying(op, side, lapsRemaining, m)
  // A saying hidden in battle.prediction leaves the row blank (it keeps its height).
  return v !== null && shown[v.kind] ? { kind: v.kind, ...v.view } : null
}

function catchSaying(
  op: BattleOpponent,
  side: BattleSide,
  lapsRemaining: number | null,
  m: Messages
): { kind: BattlePredictionId; view: Omit<CatchView, 'kind'> } | null {
  if (op.inPits || !finite(op.trendSPerLap)) return null
  const t = m.widgets.battle
  const laps = finite(op.lapsToCatch) ? formatLaps(op.lapsToCatch, m) : null
  const of = ofLaps(lapsRemaining, m)
  // '~12 v de 5': how long it would take, against what is left.
  const against = laps === null ? '' : of === '' ? laps : `${laps} ${of}`
  const late = op.catchesBeforeEnd === false
  if (side === 'ahead') {
    const needed = finite(op.neededSPerLap) && op.neededSPerLap > 0 ? op.neededSPerLap : null
    const need = needed === null ? '' : t.need(t.perLap(formatTrend(needed)))
    if (laps !== null && !late) {
      return {
        kind: 'catchIn',
        view: { icon: 'check', text: t.catchIn(laps), note: of, tone: 'good' }
      }
    }
    if (laps !== null) {
      return need !== ''
        ? {
            kind: 'need',
            view: { icon: 'minus', text: need, note: t.atThisPace(against), tone: 'bad' }
          }
        : {
            kind: 'noCatch',
            view: { icon: 'minus', text: t.noCatch, note: against, tone: 'bad' }
          }
    }
    return need !== ''
      ? { kind: 'need', view: { icon: 'minus', text: need, note: '', tone: 'neutral' } }
      : null
  }
  if (laps === null) return null
  if (late) {
    return {
      kind: 'noCatch',
      view: { icon: 'check', text: t.noCaught, note: against, tone: 'good' }
    }
  }
  return {
    kind: 'caughtIn',
    view: { icon: 'alert', text: t.caughtIn(laps), note: of, tone: 'bad' }
  }
}

function deltaChip(label: string, delta: number | null): DeltaChipView {
  return finite(delta)
    ? { label, text: formatTrend(delta), tone: toneOf(delta, 2) }
    : { label, text: DASH, tone: 'dim' }
}

const lapOrNull = (t: number | null | undefined): number | null => (finite(t) && t > 0 ? t : null)

/** Their lap minus yours, at the shown precision (+ = you were faster); null when unknown. */
export function lapDelta(
  you: number | null | undefined,
  them: number | null | undefined
): number | null {
  const a = lapOrNull(you)
  const b = lapOrNull(them)
  return a === null || b === null ? null : Math.round((b - a) * 1000) / 1000
}

/** V-1..V-3 (most recent first), '—' where either time is missing. */
export function lapChips(
  you: readonly (number | null)[],
  them: readonly (number | null)[],
  m: Messages
): DeltaChipView[] {
  const label = m.widgets.battle.lapChip
  const out: DeltaChipView[] = []
  for (let i = 0; i < LAP_CHIPS; i++) out.push(deltaChip(label(i + 1), lapDelta(you[i], them[i])))
  return out
}

/**
 * S1..Sn, plus 'Últ' (the last lap) when the laps row is not shown; one '—' chip while the
 * sectors are unknown, so the row keeps its height.
 */
export function sectorChips(
  deltas: readonly number[] | null,
  lastLap: number | null | undefined,
  m: Messages
): DeltaChipView[] {
  const c = m.widgets.common
  const out: DeltaChipView[] =
    deltas === null || deltas.length === 0
      ? [{ label: c.sectors, text: DASH, tone: 'dim' }]
      : deltas.map((d, i) => deltaChip(c.sector(i + 1), d))
  if (lastLap !== undefined) out.push(deltaChip(m.widgets.battle.lastChip, lastLap))
  return out
}

/** '±17' (iR at stake either way), null when unknown or below one point. */
export function stakeText(iRatingAtStake: number | null): string | null {
  if (!finite(iRatingAtStake)) return null
  const r = Math.round(Math.abs(iRatingAtStake))
  return r > 0 ? `±${r}` : null
}

/**
 * The rival's cell: the make and the flag only when on and known (a card has no column of them
 * to keep aligned), the rating and the licence as battle.parts says.
 */
export function laneDriver(
  op: BattleOpponent,
  o: LaneOptions,
  styles: DriverStyles,
  m: Messages
): LaneDriverView {
  return {
    ...toDriverCell(op, styles, o.nameFormat, m),
    ...(o.brand && op.brand !== 'unknown' ? { brand: op.brand } : {}),
    ...(o.flag && op.country !== '' ? { country: op.country } : {}),
    withRating: o.parts.rating,
    withLicense: o.parts.license,
    penalty: o.penalties ? op.penalty : null
  }
}

export function toLaneView(
  op: BattleOpponent,
  side: BattleSide,
  d: Pick<BattleData, 'lapsRemaining' | 'playerLastLaps'>,
  o: LaneOptions,
  styles: DriverStyles,
  m: Messages
): LaneView {
  const rows = laneRows(o.rows)
  const trend = trendView(op.trendSPerLap, side, m)
  const lastLap = rows.catch && isLastLap(d.lapsRemaining)
  return {
    side,
    carIdx: op.carIdx,
    tag: m.widgets.battle[side],
    tagIcon: TAG_ICONS[side],
    driver: laneDriver(op, o, styles, m),
    inPits: op.inPits,
    gap: o.gapStyle === 'relative' ? relativeGapView(op, side) : gapView(op.gapS),
    // Without its words the trend keeps the chevron and the number (never colour alone).
    trend: o.parts.trendNote ? trend : { ...trend, note: '' },
    tone: op.inPits ? 'dim' : trend.tone,
    stake: o.parts.stake ? stakeText(op.iRatingAtStake) : null,
    catch:
      rows.catch && !lastLap
        ? catchView(op, side, d.lapsRemaining, m, o.prediction ?? ALL_PREDICTIONS)
        : null,
    lastLap,
    sectors: rows.sectors
      ? sectorChips(
          op.sectorDeltas,
          rows.laps ? undefined : lapDelta(d.playerLastLaps[0], op.lastLaps[0]),
          m
        )
      : null,
    laps: rows.laps ? lapChips(d.playerLastLaps, op.lastLaps, m) : null
  }
}

/** The default lane order: ahead on top, as on track. */
export const LANE_ORDER: readonly BattleSide[] = ['ahead', 'behind']

/**
 * The lanes to draw, top (or left) first: in `order` (battle.lanes' order, shown or not), a
 * side it misses after them; only the opponents present.
 */
export function toLaneViews(
  d: BattleData,
  o: LaneOptions,
  styles: DriverStyles,
  m: Messages,
  order: readonly BattleSide[] = LANE_ORDER
): LaneView[] {
  const out: LaneView[] = []
  for (const side of [...order, ...LANE_ORDER]) {
    if (out.some((l) => l.side === side)) continue
    const op = side === 'ahead' ? d.ahead : d.behind
    if (op) out.push(toLaneView(op, side, d, o, styles, m))
  }
  return out
}

/** Whether a payload has anything to draw. */
export function hasOpponents(d: BattleData): boolean {
  return d.visible && (d.ahead !== null || d.behind !== null)
}
