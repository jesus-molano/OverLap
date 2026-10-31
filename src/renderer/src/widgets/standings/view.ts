/**
 * Line view models of the standings widget: every value already formatted and flat (strings,
 * booleans and shared style objects only), so an unchanged line compares equal field by field
 * and keeps its previous object (`reuseViews`) for v-memo. Pure. Words come from the
 * dictionary `m` (messagesFor(lang)); the examples are the Spanish ones.
 */
import {
  formatBestLapGap,
  formatGapValue,
  formatIRating,
  formatIRatingDelta,
  formatLapTime
} from '@shared/format'
import type { BrandId } from '@shared/carBrands'
import { classOrderKey } from '@shared/classOrder'
import type { Messages } from '@shared/i18n'
import type {
  CarPenalty,
  ElementEntry,
  GapValue,
  IRatingFormat,
  NameFormat,
  StandingsClassBlock,
  StandingsClassLineId,
  StandingsOptions,
  StandingsRow
} from '@shared/types'
import {
  gainedCell,
  NO_GAIN,
  lapCell,
  stintCell,
  tyreCell,
  type GainedIcon,
  type LapKind
} from '@renderer/view/carExtras'
import { gapShowsLeader } from '@renderer/view/columnHeads'
import { toDriverCell, type DriverCellView } from '@renderer/view/driverCell'
import type { DriverStyles, InlineStyle } from '@renderer/view/styles'
import { signTone, type Tone } from '@renderer/ui/tones'
import type { DisplayRow, PlannedLine } from './layout'

/** |iRating change| below this is noise: drawn dim. */
const DELTA_DIM_BELOW = 5
/** Between the parts of a line of meta ('SoF 2.1k', '12 coches'): an en space, no glyph. */
export const META_SEP = '\u2002'

export type GapKind = 'time' | 'laps' | 'leader' | 'none'
/**
 * What the pit cell shows: a badge (in the pits, towed there, out lap), the stop count, or
 * the flag.
 */
export type PitKind = 'pit' | 'tow' | 'out' | 'stops' | 'finished' | 'none'

export interface CarLineView extends DriverCellView {
  /** 'leader': another class's leader on one line, its class tag in front. */
  kind: 'car' | 'leader'
  /** The iRating's licence colours (IRating, request 10), null for today's plain figure. */
  irColors: InlineStyle | null
  /** Class attribute of the line element, state classes included. */
  css: string
  /** Class short name of a one-line leader ('LMP2'), else ''. */
  classTag: string
  /** A one-line leader's class in «Orden de las clases» (ClassLineView.orderKey), else ''. */
  classKey: string
  /**
   * A one-line leader's class SoF ('SoF 2.7k'), as its class line would say it (the class line's
   * SoF shown and known), else ''.
   */
  classSof: string
  player: boolean
  /** The car's make and the driver's flag code ('' none): drawn when the columns have room. */
  brand: BrandId
  country: string
  /** This row set its class's fastest lap: the 'VR' tag after the name. */
  fastest: boolean
  /** Class position ('5'), '' when unclassified. */
  pos: string
  /** Off track: the position chip gets the warning ring. */
  posWarn: boolean
  penalty: CarPenalty | null
  disconnected: boolean
  /** Places gained or lost, digits only ('4', after gainedIcon); '' for none or unknown. */
  gained: string
  gainedIcon: GainedIcon | null
  gainedTone: Tone
  /** '+13', '' when not shown on this row. */
  delta: string
  deltaTone: Tone
  /** The 'gap' column: per gap mode, 'LÍDER' for the class leader, '—' when unknown. */
  gap: string
  gapKind: GapKind
  /** The 'gapLeader' column ('' for the leader). */
  gapLeader: string
  gapLeaderKind: GapKind
  /** Last lap in races, best lap in practice and qualifying. */
  lap: string
  lapKind: LapKind
  /** The 'best' column (races only): the best lap, 'best' kind for the class's fastest. */
  best: string
  bestKind: LapKind
  pit: PitKind
  /** Pit stops so far ('2'), '' when none or unknown (a replay). */
  pitStops: string
  /** Lap of the last stop ('V12'), '' before the first one. */
  pitLap: string
  /** Laps of the stint ('7', then stintUnit 'v'); both '' when unknown. */
  stint: string
  stintUnit: string
  /** Tyre compound letter ('H'), '—' when unknown (another car model, or not reported). */
  tyre: string
}

export interface ClassLineView {
  kind: 'class'
  css: string
  clsStyle: InlineStyle
  name: string
  /** 'SoF 2.1k', '12 coches' (en-spaced), in the class line's order; '' if nothing to say. */
  meta: string
  /**
   * The same part by part, each drawn in its own span (data-el) with the en space between them:
   * 'SoF 2.1k', '12 coches' ('' when hidden or unknown), the car count first or not. Plain
   * strings, so equal lines stay equal (reuseViews).
   */
  metaSof: string
  metaCars: string
  metaCarsFirst: boolean
  /**
   * The class in «Orden de las clases» (classOrderKey of its short name; '' without one): its
   * name is the handle the settings page's sample drags the block by (9b).
   */
  orderKey: string
}

export type LineView = CarLineView | ClassLineView

export interface LineContext {
  gapMode: StandingsOptions['gapMode']
  /** Race session (otherwise gaps and laps are about best laps). */
  race: boolean
  /** iRating change on every row (otherwise only on yours). */
  deltaAll: boolean
  nameFormat: NameFormat
  /** The «Piloto» block's «Formato del iRating» (request 10): the drivers' and the SoF; '2.5k' if absent. */
  irFormat?: IRatingFormat
  /** The iRating in its driver's licence colours (request 10); off if absent. */
  irColor?: boolean
  /** What the class lines say, in order (standings.classLine). */
  classLine: readonly Readonly<ElementEntry<StandingsClassLineId>>[]
  /** The flag badge after the name (black, meatball, furled). */
  showFlags: boolean
  /** The 'gapLeader' column is drawn: the 'gap' column never repeats it (gapCell). */
  gapLeaderShown: boolean
  styles: DriverStyles
  m: Messages
}

// ---------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------

const NO_GAP = { text: '—', kind: 'none' } as const

function gapText(gap: GapValue, race: boolean): string {
  if (gap.kind === 'time' && !race) return formatBestLapGap(gap.seconds)
  return formatGapValue(gap)
}

/**
 * The 'gap' column. Interval or gap to the leader per `gapMode` (in practice and qualifying
 * 'interval' means the gap to the best lap, as on every timing screen); when the chosen value
 * is missing for a classified car, the other one stands in, so a mode switch never blanks the
 * column, except the gap to the leader for an interval while the 'gapLeader' column shows it
 * (`leaderShown`): the same '+1L' twice would read as an interval. The class leader reads
 * 'LÍDER'; anything else unknown '—'.
 */
export function gapCell(
  row: StandingsRow,
  gapMode: StandingsOptions['gapMode'],
  race: boolean,
  m: Messages,
  leaderShown = false
): { text: string; kind: GapKind } {
  const toLeader = gapShowsLeader(gapMode, race)
  const first = toLeader ? row.gapToLeader : row.interval
  const gap = first ?? (toLeader ? row.interval : leaderShown ? null : row.gapToLeader)
  if (gap === null) {
    return row.classPosition === 1 ? { text: m.widgets.standings.leader, kind: 'leader' } : NO_GAP
  }
  const text = gapText(gap, race)
  return text === '' ? NO_GAP : { text, kind: gap.kind }
}

/** The 'gapLeader' column: always the gap to the class leader; blank on the leader itself. */
export function gapLeaderCell(row: StandingsRow, race: boolean): { text: string; kind: GapKind } {
  const gap = row.gapToLeader
  if (gap === null) return row.classPosition === 1 ? { text: '', kind: 'leader' } : NO_GAP
  const text = gapText(gap, race)
  return text === '' ? NO_GAP : { text, kind: gap.kind }
}

export function pitKind(row: StandingsRow): PitKind {
  if (row.status === 'finished') return 'finished'
  if (row.status === 'pits') return row.towed ? 'tow' : 'pit'
  if (row.outLap) return 'out'
  return (row.pitStops ?? 0) > 0 ? 'stops' : 'none'
}

/** The 'best' column (races only): the best lap, filled when it is the class's fastest. */
export function bestCell(row: StandingsRow): { text: string; kind: LapKind } {
  const text = formatLapTime(row.bestLap)
  if (text === '—') return { text, kind: 'none' }
  return { text, kind: row.bestLapKind === 'class-best' ? 'best' : 'normal' }
}

/**
 * The 'pitLap' column: the lap of the last stop ('V12'); '' before the first one, also for a
 * pit-lane start (it left the pits, but that was no stop).
 */
export function pitLapCell(row: StandingsRow, m: Messages): string {
  const lap = row.lastPitLap
  if ((row.pitStops ?? 0) <= 0 || lap === null || !Number.isFinite(lap) || lap < 0) return ''
  return m.widgets.laps.number(lap)
}

function deltaTone(delta: number | null): Tone {
  if (delta === null || !Number.isFinite(delta) || Math.abs(delta) < DELTA_DIM_BELOW) return 'dim'
  return signTone(delta)
}

function carCss(row: StandingsRow, alt: boolean, sep: boolean, leader: boolean): string {
  let css = leader ? 'sd-line sd-car sd-leader' : 'sd-line sd-car'
  if (alt) css += ' is-alt'
  if (sep) css += ' is-sep'
  if (row.isPlayer) css += ' ov-player'
  if (row.status !== 'running') css += ` is-${row.status}`
  return css
}

function toCarView(
  row: DisplayRow,
  ctx: LineContext,
  o: { alt: boolean; sep: boolean; classTag: string; classSof?: string; classKey?: string }
): CarLineView {
  const gap = gapCell(row, ctx.gapMode, ctx.race, ctx.m, ctx.gapLeaderShown)
  const gapLeader = gapLeaderCell(row, ctx.race)
  const lap = lapCell(row, ctx.race)
  const best = bestCell(row)
  const stint = stintCell(row.stintLaps, ctx.m)
  const gained = ctx.race ? gainedCell(row.positionsGained) : NO_GAIN
  const showDelta = ctx.race && (ctx.deltaAll || row.isPlayer)
  const leader = o.classTag !== ''
  const cell = toDriverCell(row, ctx.styles, ctx.nameFormat, ctx.m, ctx.irFormat)
  return {
    ...cell,
    kind: leader ? 'leader' : 'car',
    irColors: ctx.irColor === true ? cell.licStyle : null,
    css: carCss(row, o.alt, o.sep, leader),
    classTag: o.classTag,
    classSof: o.classSof ?? '',
    classKey: o.classKey ?? '',
    player: row.isPlayer,
    brand: row.brand,
    country: row.country,
    fastest: row.bestLapKind === 'class-best',
    pos: row.classPosition > 0 ? String(row.classPosition) : '',
    posWarn: row.status === 'off-track',
    penalty: ctx.showFlags ? row.penalty : null,
    disconnected: row.status === 'disconnected',
    gained: gained.text,
    gainedIcon: gained.icon,
    gainedTone: signTone(row.positionsGained),
    delta: showDelta ? formatIRatingDelta(row.iRatingDelta) : '',
    deltaTone: showDelta ? deltaTone(row.iRatingDelta) : 'dim',
    gap: gap.text,
    gapKind: gap.kind,
    gapLeader: gapLeader.text,
    gapLeaderKind: gapLeader.kind,
    lap: lap.text,
    lapKind: lap.kind,
    best: best.text,
    bestKind: best.kind,
    pit: pitKind(row),
    pitStops: row.pitStops !== null && row.pitStops > 0 ? String(row.pitStops) : '',
    pitLap: pitLapCell(row, ctx.m),
    stint: stint.text,
    stintUnit: stint.unit,
    tyre: tyreCell(row.tyre)
  }
}

/** One part of a class line's meta: 'SoF 2.1k' (each drawn in its own span, data-el). */
export interface ClassMetaPart {
  readonly id: StandingsClassLineId
  readonly text: string
}

/** The parts of a class line's meta in the order of `parts` (the visible and known ones). */
export function classMetaParts(
  block: Pick<StandingsClassBlock, 'sof' | 'carCount'>,
  parts: readonly Readonly<ElementEntry<StandingsClassLineId>>[],
  m: Messages,
  irFormat: IRatingFormat = 'compact'
): ClassMetaPart[] {
  const t = m.widgets.standings
  const out: ClassMetaPart[] = []
  for (const p of parts) {
    if (!p.visible) continue
    if (p.id === 'sof') {
      const sof = formatIRating(block.sof, irFormat, m)
      if (sof !== '') out.push({ id: 'sof', text: t.sof(sof) })
    } else if (block.carCount > 0) {
      out.push({ id: 'carCount', text: t.cars(block.carCount) })
    }
  }
  return out
}

/** Between two parts of the meta. */
export const CLASS_META_SEP = META_SEP

/**
 * 'SoF 2.1k', '12 coches' in the order of `parts` (the visible ones), en-spaced; '' when none is
 * shown or known.
 */
export function classMeta(
  block: Pick<StandingsClassBlock, 'sof' | 'carCount'>,
  parts: readonly Readonly<ElementEntry<StandingsClassLineId>>[],
  m: Messages,
  irFormat: IRatingFormat = 'compact'
): string {
  return classMetaParts(block, parts, m, irFormat)
    .map((p) => p.text)
    .join(META_SEP)
}

/** The class's short name, or 'Clase 30' when the session info gives it none. */
export function className(
  block: Pick<StandingsClassBlock, 'classId' | 'className'>,
  m: Messages
): string {
  return block.className.trim() || m.widgets.standings.unnamedClass(block.classId)
}

function toClassView(block: StandingsClassBlock, ctx: LineContext): ClassLineView {
  const metaParts = classMetaParts(block, ctx.classLine, ctx.m, ctx.irFormat)
  return {
    kind: 'class',
    css: block.isPlayerClass ? 'sd-line sd-class is-own' : 'sd-line sd-class',
    clsStyle: ctx.styles.cls(block.classColor),
    name: className(block, ctx.m),
    meta: metaParts.map((p) => p.text).join(META_SEP),
    metaSof: metaParts.find((p) => p.id === 'sof')?.text ?? '',
    metaCars: metaParts.find((p) => p.id === 'carCount')?.text ?? '',
    metaCarsFirst: metaParts[0]?.id === 'carCount',
    orderKey: classOrderKey(block.className)
  }
}

export function toLineViews(lines: readonly PlannedLine[], ctx: LineContext): LineView[] {
  return lines.map((l) => {
    if (l.kind === 'class') return toClassView(l.block, ctx)
    if (l.kind === 'leader') {
      const tag = className(l.block, ctx.m)
      // Its class line folded into it: the SoF of every class, also on one line (2.4).
      const sof = classMetaParts(l.block, ctx.classLine, ctx.m, ctx.irFormat).find(
        (p) => p.id === 'sof'
      )
      return toCarView(l.row, ctx, {
        alt: false,
        sep: false,
        classTag: tag,
        classSof: sof?.text,
        classKey: classOrderKey(l.block.className)
      })
    }
    return toCarView(l.row, ctx, { alt: l.alt, sep: l.gapBefore, classTag: '' })
  })
}
